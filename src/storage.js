const BASE = "http://localhost:3001";

export function entryToSummary(e) {
  if (!e || !e.savedAt) return null;
  return {
    savedAt: e.savedAt,
    workout_status: e.workout_status || null,
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

export async function syncSummaryFromEntries(plan) {
  const keys = Object.keys(plan || {});
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
