import { calcBMR, calcCalSteps, estimateVDOT } from "./utils.js";

const BASE = "http://localhost:3001";

export function entryToSummary(e, profile={}) {
  if (!e || !e.savedAt) return null;
  const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const w = num(e.metrics?.weight) || num(profile.weightLb) || 185;
  const bmr = calcBMR(w, profile.heightCm, profile.age, profile.sex);
  const steps = num(e.metrics?.steps);
  const calSteps = calcCalSteps(steps, w);
  const calIn = num(e.metrics?.calIn);
  const liftBonus = (e.workout?.type||'').toLowerCase().includes('lift') && e.workout_status === 'done' ? 300 : 0;
  const calAdj = profile.calAdjustment ?? 0;
  const calBase = bmr + liftBonus + calAdj;
  const calOut = calSteps != null ? Math.round(calSteps + calBase) : null;
  const ncSteps = calIn != null && calOut != null ? calIn - calOut : null;
  const vdot = estimateVDOT(e.workout, profile.hrRest ?? 58, profile.hrMax ?? 194);
  return {
    savedAt: e.savedAt,
    workout_status: e.workout_status || null,
    weight:    num(e.metrics?.weight),
    sleep:     num(e.metrics?.sleep),
    calIn,
    protein:   num(e.metrics?.protein),
    hydration: num(e.metrics?.hydration),
    steps:     steps != null ? Math.round(steps) : null,
    bmr,
    calSteps,
    calBase,
    calOut,
    ncSteps,
    vdot,
    type:     e.workout?.type || null,
    distance: num(e.workout?.distance),
  };
}

export async function loadEntry(date) {
  try {
    const res = await fetch(`${BASE}/entries/${date}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function saveEntry(date, entry) {
  await fetch(`${BASE}/entries/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export async function loadSummary() {
  try {
    const res = await fetch(`${BASE}/summary`);
    return res.ok ? await res.json() : {};
  } catch { return {}; }
}

export async function saveSummary(s) {
  await fetch(`${BASE}/summary`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
}

export async function loadPlan() {
  try {
    const res = await fetch(`${BASE}/plan`);
    if (!res.ok) return { meta: {}, days: {} };
    const raw = await res.json();
    const { goalDate, goalName, goal, startDate: rawStartDate, ...days } = raw;
    const derivedStart = Object.keys(days).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort()[0] || rawStartDate || "";
    return { meta: { goalDate: goalDate||"", goalName: goalName||"", goal: goal||"", startDate: derivedStart }, days };
  } catch { return { meta: {}, days: {} }; }
}

export async function loadProfile() {
  try {
    const res = await fetch(`${BASE}/profile`);
    return res.ok ? await res.json() : {};
  } catch { return {}; }
}

export async function saveProfile(p) {
  await fetch(`${BASE}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
}

export async function savePlanDay(date, dayPlan) {
  await fetch(`${BASE}/plan/${date}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dayPlan),
  });
}

export async function syncSummaryFromEntries(plan, profile={}) {
  const keys = Object.keys(plan || {});
  const result = {};
  await Promise.all(keys.map(async key => {
    const entry = await loadEntry(key);
    if (entry) {
      const s = entryToSummary(entry, profile);
      if (s) result[key] = s;
    }
  }));
  await saveSummary(result);
  return result;
}
