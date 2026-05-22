import { fmtKey } from "./utils.js";

export const emptyEntry = () => ({
  raw:"", savedAt:null, workout_complete:false,
  workout:{ type:"", distance:"", pace:"", hr:"", hr_peak:"", vdot:"", rep_distance_m:"", rep_count:"", rep_times:"", structure:"", duration:"", calories_burned:"", exercises:[], notes:"" },
  other_activity:{ description:"", duration:"", calories:"" },
  metrics:{ calIn:"", calOut:"", protein:"", hydration:"", sleep:"", weight:"" },
  food:{ breakfast:"", lunch:"", snacks:"", dinner:"", breakfast_cal:0, breakfast_pro:0, lunch_cal:0, lunch_pro:0, snacks_cal:0, snacks_pro:0, dinner_cal:0, dinner_pro:0 },
  energy:"", body:"", sleep_notes:"", journal:""
});

export const WEEKS = [
  { start:"2026-05-04", label:"Wk 1",       workouts:{ Mon:"2mi Lift", Tue:"4mi easy",   Wed:"2mi Lift", Thu:"5mi easy",  Fri:"2mi Lift", Sat:"8mi Long",  Sun:"Rest" }},
  { start:"2026-05-11", label:"Wk 2",       workouts:{ Mon:"2mi Lift", Tue:"4mi easy",   Wed:"2mi Lift", Thu:"6mi easy",  Fri:"2mi Lift", Sat:"9mi Long",  Sun:"Rest" }},
  { start:"2026-05-18", label:"Wk 3",       workouts:{ Mon:"2mi Lift", Tue:"5mi 6x400m", Wed:"2mi Lift", Thu:"6mi easy",  Fri:"2mi Lift", Sat:"10mi Long", Sun:"Rest" }},
  { start:"2026-05-25", label:"Wk 4",       workouts:{ Mon:"2mi Lift", Tue:"5mi 4x800m", Wed:"2mi Lift", Thu:"7mi easy",  Fri:"2mi Lift", Sat:"11mi Long", Sun:"Rest" }},
  { start:"2026-06-01", label:"Wk 5",       workouts:{ Mon:"2mi Lift", Tue:"5mi 6x400m", Wed:"2mi Lift", Thu:"7mi easy",  Fri:"2mi Lift", Sat:"12mi Long", Sun:"Rest" }},
  { start:"2026-06-08", label:"Wk 6",       workouts:{ Mon:"2mi Lift", Tue:"5mi 4x800m", Wed:"2mi Lift", Thu:"8mi easy",  Fri:"2mi Lift", Sat:"13mi Long", Sun:"Rest" }},
  { start:"2026-06-15", label:"Wk 7 down",  workouts:{ Mon:"2mi Lift", Tue:"5mi 7x400m", Wed:"2mi Lift", Thu:"8mi easy",  Fri:"2mi Lift", Sat:"10mi Long", Sun:"Rest" }},
  { start:"2026-06-22", label:"Wk 8",       workouts:{ Mon:"2mi Lift", Tue:"5mi 5x800m", Wed:"2mi Lift", Thu:"9mi easy",  Fri:"2mi Lift", Sat:"14mi Long", Sun:"Rest" }},
  { start:"2026-06-29", label:"Wk 9",       workouts:{ Mon:"2mi Lift", Tue:"5mi 7x400m", Wed:"2mi Lift", Thu:"9mi easy",  Fri:"2mi Lift", Sat:"15mi Long", Sun:"Rest" }},
  { start:"2026-07-06", label:"Wk 10",      workouts:{ Mon:"2mi Lift", Tue:"5mi 5x800m", Wed:"2mi Lift", Thu:"10mi easy", Fri:"2mi Lift", Sat:"16mi Long", Sun:"Rest" }},
  { start:"2026-07-13", label:"Wk 11",      workouts:{ Mon:"2mi Lift", Tue:"5mi 8x400m", Wed:"2mi Lift", Thu:"10mi easy", Fri:"2mi Lift", Sat:"17mi Long", Sun:"Rest" }},
  { start:"2026-07-20", label:"Wk 12",      workouts:{ Mon:"2mi Lift", Tue:"5mi 6x800m", Wed:"2mi Lift", Thu:"11mi easy", Fri:"2mi Lift", Sat:"18mi Long", Sun:"Rest" }},
  { start:"2026-07-27", label:"Wk 13 down", workouts:{ Mon:"2mi Lift", Tue:"4mi easy",   Wed:"2mi Lift", Thu:"4mi easy",  Fri:"Rest",     Sat:"13mi HM",   Sun:"Rest" }},
  { start:"2026-08-03", label:"Wk 14",      workouts:{ Mon:"1mi Lift", Tue:"4mi easy",   Wed:"7mi easy",  Thu:"2mi Lift", Fri:"Rest", Sat:"7mi pace",  Sun:"19mi Long" }},
  { start:"2026-08-10", label:"Wk 15",      workouts:{ Mon:"1mi Lift", Tue:"5mi easy",   Wed:"8mi easy",  Thu:"2mi Lift", Fri:"Rest", Sat:"8mi run",   Sun:"20mi Long" }},
  { start:"2026-08-17", label:"Wk 16 down", workouts:{ Mon:"1mi Lift", Tue:"5mi 6x800m", Wed:"6mi easy",  Thu:"2mi Lift", Fri:"Rest", Sat:"6mi pace",  Sun:"12mi Long" }},
  { start:"2026-08-24", label:"Wk 17",      workouts:{ Mon:"1mi Lift", Tue:"5mi easy",   Wed:"9mi easy",  Thu:"2mi Lift", Fri:"Rest", Sat:"9mi pace",  Sun:"20mi Long" }},
  { start:"2026-08-31", label:"Wk 18 down", workouts:{ Mon:"1mi Lift", Tue:"5mi 8x400m", Wed:"6mi easy",  Thu:"2mi Lift", Fri:"Rest", Sat:"6mi run",   Sun:"12mi Long" }},
  { start:"2026-09-07", label:"Wk 19",      workouts:{ Mon:"1mi Lift", Tue:"5mi easy",   Wed:"10mi easy", Thu:"2mi Lift", Fri:"Rest", Sat:"10mi pace", Sun:"20mi Long" }},
  { start:"2026-09-14", label:"Wk 20 down", workouts:{ Mon:"1mi Lift", Tue:"5mi 6x800m", Wed:"8mi easy",  Thu:"2mi Lift", Fri:"Rest", Sat:"4mi pace",  Sun:"12mi Long" }},
  { start:"2026-09-21", label:"Wk 21",      workouts:{ Mon:"1mi Lift", Tue:"4mi easy",   Wed:"6mi easy",  Thu:"2mi Lift", Fri:"Rest", Sat:"4mi run",   Sun:"8mi Long"  }},
  { start:"2026-09-28", label:"Wk 22 Race", workouts:{ Mon:"Rest",     Tue:"3mi easy",   Wed:"4mi easy",  Thu:"Rest",     Fri:"Rest", Sat:"2mi run",   Sun:"RACE"      }},
];

export const PLAN = (function() {
  var weeks = WEEKS;
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var map = {};
  weeks.forEach(function(week) {
    var parts = week.start.split("-").map(Number);
    var monday = new Date(parts[0], parts[1]-1, parts[2]);
    for (var j=0; j<7; j++) {
      var day = new Date(monday); day.setDate(monday.getDate()+j);
      var dow = DOW[day.getDay()];
      var key = fmtKey(day);
      if (week.workouts[dow]) map[key] = { label:week.label, workout:week.workouts[dow] };
    }
  });
  return map;
}());

export function getWorkoutType(desc) {
  if (!desc) return "rest";
  const d = desc.toLowerCase();
  if (d.includes("race")) return "race";
  if (d.includes("lift")) return "strength";
  if (d.includes("rest")) return "rest";
  if (d.includes("hm")) return "race";
  if (d.includes("pace")) return "tempo";
  if (d.includes("x4")||d.includes("x8")||d.includes("interval")) return "intervals";
  if (d.includes("long")) return "long";
  if (d.includes("easy")) return "easy";
  return "run";
}

export const TYPE_STYLE = {
  easy:      {bg:"#E6F1FB",color:"#0C447C"},
  long:      {bg:"#FAECE7",color:"#4A1B0C"},
  intervals: {bg:"#FBEAF0",color:"#4B1528"},
  tempo:     {bg:"#FAEEDA",color:"#633806"},
  strength:  {bg:"#EEEDFE",color:"#3C3489"},
  yoga:      {bg:"#E1F5EE",color:"#085041"},  // kept for any legacy data
  rest:      {bg:"#F0F0EC",color:"#666"},
  race:      {bg:"#FAECE7",color:"#4A1B0C"},
  run:       {bg:"#E6F1FB",color:"#0C447C"},
};

export const TYPE_LABEL = {
  easy:"Easy", long:"Long", intervals:"Intervals", tempo:"Tempo",
  strength:"Lift", rest:"Rest", race:"Race", run:"Run"
};

export function matchesPlan(workoutType, planDesc) {
  if (!workoutType || !planDesc) return false;
  const logged = workoutType.toLowerCase();
  const planned = getWorkoutType(planDesc);
  if (logged.includes("interval") && planned==="intervals") return true;
  if ((logged.includes("easy")||logged.includes("run")) && (planned==="easy"||planned==="run")) return true;
  if (logged.includes("long") && planned==="long") return true;
  if (logged.includes("tempo") && planned==="tempo") return true;
  if ((logged.includes("lift")||logged.includes("strength")) && planned==="strength") return true;
  if (logged.includes("rest") && planned==="rest") return true;
  if (logged.includes("race") && planned==="race") return true;
  return false;
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
  if (!desc) return ["Rest",""];
  const d = desc.toLowerCase();
  if (d==="rest") return ["Rest",""];
  if (d.includes("race")) return ["RACE",""];
  const liftMatch = desc.match(/^(\d+mi)\s+Lift$/i);
  if (liftMatch) return [liftMatch[1],"Lift"];
  const intMatch = desc.match(/^(\d+mi)\s+(\d+x\d+m?)$/i);
  if (intMatch) return [intMatch[1],intMatch[2]];
  const easyMatch = desc.match(/^(\d+mi)\s+(easy|pace|run|Long|HM)$/i);
  if (easyMatch) return [easyMatch[1],easyMatch[2]];
  return [desc.slice(0,8),""];
}
