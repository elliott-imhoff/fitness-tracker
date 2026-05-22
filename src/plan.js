export const emptyEntry = () => ({
  savedAt:null, workout_status:null,
  workout:{ type:"", distance:"", pace:"", hr:"", hr_peak:"", vdot:"", rep_distance_m:"", rep_count:"", rep_times:"", structure:"", duration:"", calories_burned:"", exercises:[], notes:"" },
  other_activity: [],
  metrics:{ calIn:"", calOut:"", protein:"", hydration:"", sleep:"", weight:"" },
  food:{ breakfast:"", lunch:"", snacks:"", dinner:"", breakfast_cal:0, breakfast_pro:0, lunch_cal:0, lunch_pro:0, snacks_cal:0, snacks_pro:0, dinner_cal:0, dinner_pro:0 },
  energy:"", body:"", sleep_notes:"", journal:""
});

// Single source of truth for plan workout types
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

export function parsePlanMiles(desc) {
  if (!desc) return 0;
  const m = desc.match(/^(\d+(?:\.\d+)?)mi/i);
  return m ? parseFloat(m[1]) : 0;
}

export function fmtWorkout(desc) {
  if (!desc) return "";
  return desc.replace(/(\d+mi)\s+(Lift)/i, "$1 + $2");
}

export function dotLabel(desc) {
  if (!desc) return ["",""];
  const d = desc.toLowerCase();
  if (d==="rest") return ["Rest",""];
  if (d.includes("race")) return ["RACE",""];
  const liftMatch = desc.match(/^(\d+mi)\s+Lift$/i);
  if (liftMatch) return [liftMatch[1],"Lift"];
  const intMatch = desc.match(/^(\d+mi)\s+(\d+x\d+m?)$/i);
  if (intMatch) return [intMatch[1],intMatch[2]];
  const easyMatch = desc.match(/^(\d+mi)\s+(easy|pace|run|Long)$/i);
  if (easyMatch) return [easyMatch[1],easyMatch[2]];
  return [desc.slice(0,8),""];
}
