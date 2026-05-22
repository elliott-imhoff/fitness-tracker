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
