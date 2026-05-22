import { PLAN } from "./plan.js";

const BASE = "http://localhost:3001";

export function entryToSummary(e) {
  if (!e || !e.savedAt) return null;
  return {
    savedAt: e.savedAt,
    workout_complete: !!e.workout_complete,
    weight:    e.metrics ? e.metrics.weight    : "",
    sleep:     e.metrics ? e.metrics.sleep     : "",
    calIn:     e.metrics ? e.metrics.calIn     : "",
    calOut:    e.metrics ? e.metrics.calOut    : "",
    protein:   e.metrics ? e.metrics.protein   : "",
    hydration: e.metrics ? e.metrics.hydration : "",
    vdot:      e.workout ? e.workout.vdot      : "",
    type:      e.workout ? e.workout.type      : "",
    distance:  e.workout ? (parseFloat(e.workout.distance) || 0) : 0,
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

export async function syncSummaryFromEntries() {
  const keys = Object.keys(PLAN);
  const result = {};
  await Promise.all(keys.map(async key => {
    const entry = await loadEntry(key);
    if (entry) {
      const s = entryToSummary(entry);
      if (s) result[key] = s;
    }
  }));
  await saveSummary(result);
  return result;
}
