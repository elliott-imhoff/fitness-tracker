export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const DOWS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export function fmtKey(d) {
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
export function fmtDisplay(d) {
  return DOWS[(d.getDay()+6)%7]+", "+MONTHS[d.getMonth()]+" "+d.getDate();
}
export function isToday(d) {
  const t=new Date();
  return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear();
}
export function startOfWeek(d) {
  const r=new Date(d); r.setDate(d.getDate()-((d.getDay()+6)%7)); return r;
}
export function addDays(d,n) {
  const r=new Date(d); r.setDate(d.getDate()+n); return r;
}

// --- plan types & helpers ---

export const PLAN_TYPES = ["Easy","Long","Pace","Intervals","Lift","Yoga","Race","Rest"];

export const TYPE_STYLE = {
  Easy:      {bg:"#E6F1FB",color:"#0C447C"},
  Long:      {bg:"#FAECE7",color:"#4A1B0C"},
  Intervals: {bg:"#FBEAF0",color:"#4B1528"},
  Pace:      {bg:"#FAEEDA",color:"#633806"},
  Lift:      {bg:"#EEEDFE",color:"#3C3489"},
  Yoga:      {bg:"#E1F5EE",color:"#085041"},
  Rest:      {bg:"#F0F0EC",color:"#666"},
  Race:      {bg:"#FAECE7",color:"#4A1B0C"},
};

export function matchesPlan(loggedType, planType) {
  if (!loggedType || !planType) return false;
  return loggedType === planType;
}

export function fmtPlanWorkout(p) {
  if (!p) return "";
  if (p.distance) {
    return p.structure ? `${p.distance}mi ${p.structure}` : `${p.distance}mi ${p.type || ""}`;
  }
  return p.type || "";
}

export function dotLabel(p) {
  if (!p) return ["",""];
  const type = p.type || "";
  if (type === "Rest") return ["Rest",""];
  const dist = p.distance ? p.distance+"mi" : "";
  const sub  = p.structure || type;
  return [dist, sub];
}

// --- calorie helpers ---
export function calcBMR(weightLb, heightCm, age, sex) {
  const kg = (weightLb || 185) * 0.453592;
  const base = 10*kg + 6.25*(heightCm||175) - 5*(age||30);
  return Math.round(sex==='female' ? base-161 : base+5);
}
export function calcCalSteps(steps, weightLb) {
  if (steps == null || isNaN(steps)) return null;
  return Math.round(steps * (0.04 * (weightLb || 150) / 150));
}

// --- vdot helpers ---
function _calcVDOT(D, T) {
  const V = D / T;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * T) + 0.2989558 * Math.exp(-0.1932605 * T);
  const vo2 = -4.60 + 0.182258 * V + 0.000104 * V * V;
  return Math.round((vo2 / pct) * 10) / 10;
}
function _paceToMin(p) {
  if (!p) return null;
  const a = p.split(':');
  if (a.length !== 2) return null;
  const v = parseInt(a[0]) + parseInt(a[1]) / 60;
  return isNaN(v) ? null : v;
}
function _repTimesToAvgPace(repTimes, repDistM) {
  if (!repTimes || !repDistM) return null;
  const times = repTimes.split(',').map(t => {
    t = t.trim(); const parts = t.split(':');
    if (parts.length !== 2) return null;
    const secs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    return isNaN(secs) ? null : secs;
  }).filter(Boolean);
  if (!times.length) return null;
  const avgSecs = times.reduce((a, b) => a + b, 0) / times.length;
  const secsPerMile = (avgSecs / parseFloat(repDistM)) * 1609.34;
  const mins = Math.floor(secsPerMile / 60);
  const secs = Math.round(secsPerMile % 60);
  return mins + ':' + String(secs).padStart(2, '0');
}
export function estimateVDOT(w, hrRest=58, hrMax=194) {
  if (!w) return null;
  const type = (w.type || '').toLowerCase();
  const isInterval = type.includes('interval');
  const isRace     = type.includes('race');
  const isSteady   = type.includes('easy') || type.includes('long');
  const hr = parseFloat(w.hr);
  if (isInterval && w.rep_distance_m) {
    const pace = _repTimesToAvgPace(w.rep_times, w.rep_distance_m) || w.pace;
    const paceMin = _paceToMin(pace);
    if (!paceMin) return null;
    const repD = parseFloat(w.rep_distance_m);
    const repT = paceMin * (repD / 1609.34);
    const v = _calcVDOT(repD, repT);
    return isNaN(v) || v <= 0 ? null : v;
  }
  const pace = _paceToMin(w.pace);
  if (!pace) return null;
  const dist = parseFloat(w.distance);
  if (!dist) return null;
  if (!isRace && dist < 3) return null;
  const D = dist * 1609.34, T = pace * dist;
  const vdotPace = _calcVDOT(D, T);
  if (isNaN(vdotPace) || vdotPace <= 0) return null;
  if (isSteady && !isRace && !isNaN(hr) && hr > hrRest && hr < hrMax) {
    const pctHRmax = hr / hrMax;
    const vo2AtPace = -4.60 + 0.182258 * (D/T) + 0.000104 * Math.pow(D/T, 2);
    const aerobicVDOT = vo2AtPace / pctHRmax;
    const capped = Math.min(Math.max(aerobicVDOT / vdotPace, 0.80), 1.25);
    return Math.round(vdotPace * capped * 10) / 10;
  }
  return Math.round(vdotPace * 10) / 10;
}
