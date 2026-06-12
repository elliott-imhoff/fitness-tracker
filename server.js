import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR    = path.join(__dirname, "data");
const ENTRIES_DIR = path.join(DATA_DIR, "entries");
const TCX_DIR     = path.join(DATA_DIR, "tcx");
const SUMMARY_FILE  = path.join(DATA_DIR, "summary.json");
const PLAN_FILE     = path.join(DATA_DIR, "plan.json");
const PROFILE_FILE  = path.join(DATA_DIR, "profile.json");
const AEROBIC_FILE  = path.join(DATA_DIR, "aerobic.json");

await fs.mkdir(ENTRIES_DIR, { recursive: true });
await fs.mkdir(TCX_DIR, { recursive: true });

if (!await fs.access(PLAN_FILE).then(()=>true).catch(()=>false)) {
  console.warn("WARNING: data/plan.json not found. Run the seed script or copy plan.json into data/.");
}

const app = express();
app.use(express.json());

// Allow Vite dev server to call this server
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- plan ---

app.get("/plan", async (req, res) => {
  try {
    const text = await fs.readFile(PLAN_FILE, "utf8");
    res.json(JSON.parse(text));
  } catch {
    res.json(PLAN);
  }
});

app.patch("/plan/:date", async (req, res) => {
  try {
    const text = await fs.readFile(PLAN_FILE, "utf8");
    const plan = JSON.parse(text);
    plan[req.params.date] = { ...plan[req.params.date], ...req.body };
    await fs.writeFile(PLAN_FILE, JSON.stringify(plan, null, 2));
    res.json(plan[req.params.date]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// --- entries ---

app.get("/entries/:date", async (req, res) => {
  try {
    const file = path.join(ENTRIES_DIR, `${req.params.date}.json`);
    const text = await fs.readFile(file, "utf8");
    res.json(JSON.parse(text));
  } catch {
    res.status(404).json(null);
  }
});

app.put("/entries/:date", async (req, res) => {
  const file = path.join(ENTRIES_DIR, `${req.params.date}.json`);
  await fs.writeFile(file, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// --- summary ---

app.get("/summary", async (req, res) => {
  try {
    const text = await fs.readFile(SUMMARY_FILE, "utf8");
    res.json(JSON.parse(text));
  } catch {
    res.json({});
  }
});

app.put("/summary", async (req, res) => {
  await fs.writeFile(SUMMARY_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// --- profile ---

app.get("/profile", async (req, res) => {
  try {
    const text = await fs.readFile(PROFILE_FILE, "utf8");
    res.json(JSON.parse(text));
  } catch { res.json({}); }
});

app.put("/profile", async (req, res) => {
  await fs.writeFile(PROFILE_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// --- aerobic ---

app.get("/aerobic", async (req, res) => {
  try {
    const text = await fs.readFile(AEROBIC_FILE, "utf8");
    res.json(JSON.parse(text));
  } catch { res.json({}); }
});

// --- tcx upload & processing ---

const METERS_PER_MILE = 1609.344;

function parseTcx(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    isArray: (name) => ["Trackpoint", "Lap", "Activity"].includes(name),
  });
  const root = parser.parse(xmlText);
  const db = root?.TrainingCenterDatabase;
  const activities = db?.Activities?.Activity;
  const activity = Array.isArray(activities) ? activities[0] : activities;
  const laps = activity?.Lap;
  if (!laps) throw new Error("No laps found in TCX file");
  const lapArr = Array.isArray(laps) ? laps : [laps];
  const trackpoints = [];
  let distOffset = 0; // Garmin resets DistanceMeters to 0 at each lap boundary
  let totalTimeSec = 0; // sum of lap TotalTimeSeconds for accurate pace
  for (const lap of lapArr) {
    const lapTime = typeof lap.TotalTimeSeconds === "number" ? lap.TotalTimeSeconds : 0;
    totalTimeSec += lapTime;
    const tps = lap?.Track?.Trackpoint;
    if (!tps) continue;
    const tpArr = Array.isArray(tps) ? tps : [tps];
    let lapMaxDist = 0;
    for (const tp of tpArr) {
      const time = tp.Time ? new Date(tp.Time).getTime() : null;
      const rawDist = typeof tp.DistanceMeters === "number" ? tp.DistanceMeters : null;
      const hr = tp?.HeartRateBpm?.Value ?? null;
      if (rawDist != null && rawDist > lapMaxDist) lapMaxDist = rawDist;
      if (time != null && rawDist != null) {
        trackpoints.push({ time, distM: distOffset + rawDist, hr: hr != null ? Number(hr) : null });
      }
    }
    distOffset += lapMaxDist;
  }
  if (trackpoints.length < 2) throw new Error("Insufficient trackpoints with distance data");
  trackpoints.sort((a, b) => a.time - b.time);
  return { trackpoints, totalTimeSec };
}

function interpolateAt(tps, targetDistM) {
  let before = null, after = null;
  for (const tp of tps) {
    if (tp.distM <= targetDistM) before = tp;
    if (tp.distM >= targetDistM && !after) after = tp;
  }
  if (!before && !after) return null;
  if (!before) return after;
  if (!after) return before;
  if (before === after) return before;
  const t = (targetDistM - before.distM) / (after.distM - before.distM);
  return { time: before.time + t * (after.time - before.time), distM: targetDistM };
}

function computeMileSplits(trackpoints) {
  const totalDistMiles = trackpoints[trackpoints.length - 1].distM / METERS_PER_MILE;
  const totalMiles = Math.floor(totalDistMiles);
  if (totalMiles < 1) throw new Error("Run is less than 1 mile");
  const splits = [];
  for (let mile = 1; mile <= totalMiles; mile++) {
    const startDist = (mile - 1) * METERS_PER_MILE;
    const endDist = mile * METERS_PER_MILE;
    const startPt = interpolateAt(trackpoints, startDist);
    const endPt = interpolateAt(trackpoints, endDist);
    if (!startPt || !endPt) continue;
    const hrValues = trackpoints
      .filter(tp => tp.distM >= startDist && tp.distM <= endDist && tp.hr != null)
      .map(tp => tp.hr);
    if (!hrValues.length) continue;
    const elapsedSec = (endPt.time - startPt.time) / 1000;
    if (elapsedSec <= 0) continue;
    // Use actual distance covered between the two interpolated points for accurate pace
    const distCoveredMiles = (endPt.distM - startPt.distM) / METERS_PER_MILE;
    const speedMph = distCoveredMiles * 3600 / elapsedSec;
    const secsPerMile = elapsedSec / distCoveredMiles;
    const avgHR = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
    const ef = speedMph / avgHR;
    const paceMin = Math.floor(secsPerMile / 60);
    const paceSec = Math.round(secsPerMile % 60);
    splits.push({
      mile,
      avgHR: Math.round(avgHR * 10) / 10,
      pace: `${paceMin}:${String(paceSec).padStart(2, "0")}`,
      ef: Math.round(ef * 1e5) / 1e5,
    });
  }
  return { splits, totalDistMiles };
}

function computeEF0(splits) {
  const m2 = splits.find(s => s.mile === 2);
  const m3 = splits.find(s => s.mile === 3);
  if (!m2 && !m3) return null;
  const ef0 = m2 && m3 ? (m2.ef + m3.ef) / 2 : (m2 || m3).ef;
  return Math.round(ef0 * 1e5) / 1e5;
}

function computeWorkoutStats(trackpoints, totalTimeSec) {
  const allHR = trackpoints.map(tp => tp.hr).filter(h => h != null && h > 0);
  const avgHR = allHR.length ? Math.round(allHR.reduce((a, b) => a + b, 0) / allHR.length) : null;
  const peakHR = allHR.length ? Math.max(...allHR) : null;
  const last = trackpoints[trackpoints.length - 1];
  const fullDistMiles = last.distM / METERS_PER_MILE;
  // Use lap TotalTimeSeconds if available (accurate), fall back to trackpoint timestamp delta
  const durationSec = totalTimeSec > 0 ? totalTimeSec
    : (last.time - trackpoints[0].time) / 1000;
  const secsPerMile = durationSec / fullDistMiles;
  const paceMin = Math.floor(secsPerMile / 60);
  const paceSec = Math.round(secsPerMile % 60);
  const durationMin = String(Math.round(durationSec / 60));
  return {
    distance: String(Math.round(fullDistMiles * 100) / 100),
    pace: `${paceMin}:${String(paceSec).padStart(2, "0")}`,
    hr: avgHR != null ? String(avgHR) : null,
    hr_peak: peakHR != null ? String(peakHR) : null,
    duration: durationMin,
  };
}

app.post("/tcx/recompute-all", async (req, res) => {
  try {
    const files = (await fs.readdir(TCX_DIR)).filter(f => f.endsWith(".tcx"));
    if (!files.length) return res.json({ ok: true, recomputed: [], errors: [] });
    let aerobic = {};
    const errors = [];
    const recomputed = [];
    for (const file of files) {
      const date = file.replace(/\.tcx$/, "");
      try {
        const xmlText = await fs.readFile(path.join(TCX_DIR, file), "utf8");
        const { trackpoints, totalTimeSec } = parseTcx(xmlText);
        const { splits } = computeMileSplits(trackpoints);
        const ef0 = computeEF0(splits);
        const workoutStats = computeWorkoutStats(trackpoints, totalTimeSec);
        aerobic[date] = { date, ...workoutStats, mileSplits: splits, ef0 };
        recomputed.push(date);
      } catch(e) {
        errors.push({ date, error: e.message });
      }
    }
    await fs.writeFile(AEROBIC_FILE, JSON.stringify(aerobic, null, 2));
    res.json({ ok: true, recomputed, errors });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/tcx/:date", express.text({ type: "*/*", limit: "10mb" }), async (req, res) => {
  try {
    const { date } = req.params;
    const xmlText = req.body;
    await fs.writeFile(path.join(TCX_DIR, `${date}.tcx`), xmlText, "utf8");
    const { trackpoints, totalTimeSec } = parseTcx(xmlText);
    const { splits } = computeMileSplits(trackpoints);
    const ef0 = computeEF0(splits);
    const workoutStats = computeWorkoutStats(trackpoints, totalTimeSec);
    let aerobic = {};
    try { aerobic = JSON.parse(await fs.readFile(AEROBIC_FILE, "utf8")); } catch {}
    aerobic[date] = { date, distance: workoutStats.distance, mileSplits: splits, ef0 };
    await fs.writeFile(AEROBIC_FILE, JSON.stringify(aerobic, null, 2));
    res.json({ ok: true, workoutStats, aerobic: aerobic[date] });
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(3001, () => console.log("Storage server running on http://localhost:3001"));
