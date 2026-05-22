import { useState, useEffect, useCallback } from "react";

const STORAGE_PREFIX = "athlete_log_entry:";
const SUMMARY_KEY = "athlete_log_summary";

function entryToSummary(e) {
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

async function loadSummary() {
  try {
    const res = await window.storage.get(SUMMARY_KEY);
    return res && res.value ? JSON.parse(res.value) : {};
  } catch(e) { return {}; }
}

async function saveSummary(s) {
  try { await window.storage.set(SUMMARY_KEY, JSON.stringify(s)); } catch(e) {}
}

async function syncSummaryFromEntries() {
  const keys = Object.keys(PLAN);
  const result = {};
  for (const key of keys) {
    try {
      const res = await window.storage.get(STORAGE_PREFIX + key);
      if (res && res.value) {
        const entry = JSON.parse(res.value);
        const s = entryToSummary(entry);
        if (s) result[key] = s;
      }
    } catch(e) {}
  }
  await saveSummary(result);
  return result;
}

const HR_REST = 58;
const HR_MAX  = 194;
const HR_RES  = HR_MAX - HR_REST;

// ── VDOT ──────────────────────────────────────────────────────
function calcVDOT(D, T) {
  const V = D / T;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * T) + 0.2989558 * Math.exp(-0.1932605 * T);
  const vo2 = -4.60 + 0.182258 * V + 0.000104 * V * V;
  return Math.round((vo2 / pct) * 10) / 10;
}
function paceToMin(p) {
  if (!p) return null;
  const a = p.split(":");
  if (a.length !== 2) return null;
  const v = parseInt(a[0]) + parseInt(a[1]) / 60;
  return isNaN(v) ? null : v;
}
function repTimesToAvgPace(repTimes, repDistM) {
  if (!repTimes || !repDistM) return null;
  const times = repTimes.split(",").map(t => {
    t = t.trim();
    const parts = t.split(":");
    if (parts.length !== 2) return null;
    const secs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    return isNaN(secs) ? null : secs;
  }).filter(Boolean);
  if (!times.length) return null;
  const avgSecs = times.reduce((a, b) => a + b, 0) / times.length;
  const secsPerMile = (avgSecs / parseFloat(repDistM)) * 1609.34;
  const mins = Math.floor(secsPerMile / 60);
  const secs = Math.round(secsPerMile % 60);
  return mins + ":" + String(secs).padStart(2, "0");
}
function estimateVDOT(w) {
  const type = (w.type || "").toLowerCase();
  const isInterval = type.includes("interval") || type.includes("repeat");
  const isSteady = type.includes("easy") || type.includes("long") || type.includes("recovery");
  const hr = parseFloat(w.hr);
  if (isInterval && w.rep_distance_m) {
    const pace = repTimesToAvgPace(w.rep_times, w.rep_distance_m) || w.pace;
    const paceMin = paceToMin(pace);
    if (!paceMin) return "";
    const repD = parseFloat(w.rep_distance_m);
    const repT = paceMin * (repD / 1609.34);
    const v = calcVDOT(repD, repT);
    return isNaN(v) || v <= 0 ? "" : String(v);
  }
  const pace = paceToMin(w.pace);
  if (!pace) return "";
  const dist = parseFloat(w.distance);
  if (!dist) return "";
  // Require at least 3 miles for any non-interval run — short warmups/cooldowns aren't meaningful for VDOT
  if (dist < 3) return "";
  const D = dist * 1609.34, T = pace * dist;
  const vdotPace = calcVDOT(D, T);
  if (isNaN(vdotPace) || vdotPace <= 0) return "";
  if (isSteady && !isNaN(hr) && hr > HR_REST && hr < HR_MAX) {
    // Use %HRmax (not %HRR) to estimate fraction of VO2max used at easy/aerobic pace.
    // VO2 cost at this pace / (%HRmax) gives a reliable aerobic VDOT estimate.
    const pctHRmax = hr / HR_MAX;
    const vo2AtPace = -4.60 + 0.182258 * (D/T) + 0.000104 * Math.pow(D/T, 2);
    const aerobicVDOT = vo2AtPace / pctHRmax;
    // Blend with raw pace VDOT and cap to ±25% to prevent outliers
    const capped = Math.min(Math.max(aerobicVDOT / vdotPace, 0.80), 1.25);
    return String(Math.round(vdotPace * capped * 10) / 10);
  }
  return String(Math.round(vdotPace * 10) / 10);
}

// ── Snapshot parser ───────────────────────────────────────────
function parseSnapshot(text) {
  function get(label) {
    const re = new RegExp("^" + label + ":\\s*(.+)$", "im");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  }
  function getBlock(header) {
    const re = new RegExp(header + "\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z ]+\\n|\\n[A-Z][A-Z ]+$|$)", "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  }
  const sleepBlock = getBlock("SLEEP");
  const sleepMatch = sleepBlock.match(/(\d+)h\s*(\d+)?m?i?n?/i);
  const sleep = sleepMatch ? String(Math.round((parseInt(sleepMatch[1]) + (parseInt(sleepMatch[2]||0)/60)) * 10) / 10) : "";
  const weightBlock = getBlock("WEIGHT");
  const wm = weightBlock.match(/(\d+(\.\d+)?)/);
  const weight = wm ? wm[1] : "";
  const repsRaw = get("Reps");
  const rep_times = repsRaw.replace(/\s+/g, "");
  const structure = get("Structure");
  const structMatch = structure.match(/(\d+)x(\d+)/i);
  const rep_count = structMatch ? structMatch[1] : "";
  const rep_distance_m = structMatch ? structMatch[2] : "";
  const hrRaw = get("HR");
  const hrParts = hrRaw.split("/");
  const hr = hrParts[0].replace(/[^\d]/g, "");
  const hr_peak = hrParts[1] ? hrParts[1].replace(/[^\d]/g, "") : "";
  const exRaw = get("Exercises");
  const exercises = exRaw ? exRaw.split("|").map(e => e.trim()).filter(Boolean) : [];
  const workout = {
    type: get("Type"), distance: get("Distance").replace(/[^\d.]/g, ""),
    pace: get("Pace").replace(/\/mi/i, "").trim(),
    hr, hr_peak, duration: get("Duration").replace(/[^\d]/g, ""),
    calories_burned: get("Calories").replace(/[^\d]/g, ""),
    structure, rep_count, rep_distance_m, rep_times, exercises,
    notes: get("Notes"), vdot: "",
  };
  workout.vdot = estimateVDOT(workout);
  const secBlock = getBlock("SECONDARY ACTIVITY");
  const secParts = secBlock.split("\n")[0].split("·").map(s => s.trim());
  const other_activity = { description: secParts[0]||"", duration: secParts[1]||"", calories: secParts[2]||"" };
  const nutritionBlock = getBlock("NUTRITION");
  function parseMeal(label) {
    const re = new RegExp("^" + label + ":\\s*(.+)$", "im");
    const m = nutritionBlock.match(re);
    if (!m) return { text:"", cal:0, protein:0 };
    const items = m[1].split("|").map(item => {
      const parts = item.split("·").map(s => s.trim());
      const cal = parseInt((parts[1]||"").replace(/[^\d]/g,"")) || 0;
      const protein = parseInt((parts[2]||"").replace(/[^\d]/g,"")) || 0;
      return { food: parts[0]||"", cal, protein };
    }).filter(i => i.food);
    return { text: items.map(i=>i.food).join(", "), cal: items.reduce((a,b)=>a+b.cal,0), protein: items.reduce((a,b)=>a+b.protein,0) };
  }
  const bp=parseMeal("Breakfast"), lp=parseMeal("Lunch"), sp=parseMeal("Snacks"), dp=parseMeal("Dinner");
  const food = {
    breakfast:bp.text, lunch:lp.text, snacks:sp.text, dinner:dp.text,
    breakfast_cal:bp.cal, breakfast_pro:bp.protein, lunch_cal:lp.cal, lunch_pro:lp.protein,
    snacks_cal:sp.cal, snacks_pro:sp.protein, dinner_cal:dp.cal, dinner_pro:dp.protein,
  };
  const calLine = nutritionBlock.match(/Calories:\s*(\d+)[^·\n]*·\s*Burned:\s*(\d+)/i);
  const phLine  = nutritionBlock.match(/Protein:\s*(\d+)g[^·\n]*·\s*Hydration:\s*(\d+)/i);
  const metrics = { calIn:calLine?calLine[1]:"", calOut:calLine?calLine[2]:"", protein:phLine?phLine[1]:"", hydration:phLine?phLine[2]:"", sleep, weight };
  const energy = getBlock("ENERGY");
  const body = getBlock("BODY");
  const sleep_notes = getBlock("SLEEP NOTES");
  const journal = getBlock("PERSONAL NOTE");
  return { workout, other_activity, metrics, food, energy, body, sleep_notes, journal };
}

// ── Helpers ───────────────────────────────────────────────────
function fmtKey(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fmtDisplay(d) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]+", "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]+" "+d.getDate();
}
function isToday(d) { const t=new Date(); return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear(); }
function startOfWeek(d) { const r=new Date(d); r.setDate(d.getDate()-((d.getDay()+6)%7)); return r; }
function addDays(d,n) { const r=new Date(d); r.setDate(d.getDate()+n); return r; }

const emptyEntry = () => ({
  raw:"", savedAt:null, workout_complete:false,
  workout:{ type:"", distance:"", pace:"", hr:"", hr_peak:"", vdot:"", rep_distance_m:"", rep_count:"", rep_times:"", structure:"", duration:"", calories_burned:"", exercises:[], notes:"" },
  other_activity:{ description:"", duration:"", calories:"" },
  metrics:{ calIn:"", calOut:"", protein:"", hydration:"", sleep:"", weight:"" },
  food:{ breakfast:"", lunch:"", snacks:"", dinner:"", breakfast_cal:0, breakfast_pro:0, lunch_cal:0, lunch_pro:0, snacks_cal:0, snacks_pro:0, dinner_cal:0, dinner_pro:0 },
  energy:"", body:"", sleep_notes:"", journal:""
});

// ── Training Plan ─────────────────────────────────────────────
const PLAN = (function() {
  var weeks = [
    { start:"2026-05-04", label:"Wk 1",       workouts:{ Mon:"2mi Lift", Tue:"4mi easy",   Wed:"2mi Lift", Thu:"5mi easy",  Fri:"2mi Lift", Sat:"8mi Long",  Sun:"Yoga" }},
    { start:"2026-05-11", label:"Wk 2",       workouts:{ Mon:"2mi Lift", Tue:"4mi easy",   Wed:"2mi Lift", Thu:"6mi easy",  Fri:"2mi Lift", Sat:"9mi Long",  Sun:"Yoga" }},
    { start:"2026-05-18", label:"Wk 3",       workouts:{ Mon:"2mi Lift", Tue:"5mi 6x400m", Wed:"2mi Lift", Thu:"6mi easy",  Fri:"2mi Lift", Sat:"10mi Long", Sun:"Yoga" }},
    { start:"2026-05-25", label:"Wk 4",       workouts:{ Mon:"2mi Lift", Tue:"5mi 4x800m", Wed:"2mi Lift", Thu:"7mi easy",  Fri:"2mi Lift", Sat:"11mi Long", Sun:"Yoga" }},
    { start:"2026-06-01", label:"Wk 5",       workouts:{ Mon:"2mi Lift", Tue:"5mi 6x400m", Wed:"2mi Lift", Thu:"7mi easy",  Fri:"2mi Lift", Sat:"12mi Long", Sun:"Yoga" }},
    { start:"2026-06-08", label:"Wk 6",       workouts:{ Mon:"2mi Lift", Tue:"5mi 4x800m", Wed:"2mi Lift", Thu:"8mi easy",  Fri:"2mi Lift", Sat:"13mi Long", Sun:"Yoga" }},
    { start:"2026-06-15", label:"Wk 7 down",  workouts:{ Mon:"2mi Lift", Tue:"5mi 7x400m", Wed:"2mi Lift", Thu:"8mi easy",  Fri:"2mi Lift", Sat:"10mi Long", Sun:"Yoga" }},
    { start:"2026-06-22", label:"Wk 8",       workouts:{ Mon:"2mi Lift", Tue:"5mi 5x800m", Wed:"2mi Lift", Thu:"9mi easy",  Fri:"2mi Lift", Sat:"14mi Long", Sun:"Yoga" }},
    { start:"2026-06-29", label:"Wk 9",       workouts:{ Mon:"2mi Lift", Tue:"5mi 7x400m", Wed:"2mi Lift", Thu:"9mi easy",  Fri:"2mi Lift", Sat:"15mi Long", Sun:"Yoga" }},
    { start:"2026-07-06", label:"Wk 10",      workouts:{ Mon:"2mi Lift", Tue:"5mi 5x800m", Wed:"2mi Lift", Thu:"10mi easy", Fri:"2mi Lift", Sat:"16mi Long", Sun:"Yoga" }},
    { start:"2026-07-13", label:"Wk 11",      workouts:{ Mon:"2mi Lift", Tue:"5mi 8x400m", Wed:"2mi Lift", Thu:"10mi easy", Fri:"2mi Lift", Sat:"17mi Long", Sun:"Yoga" }},
    { start:"2026-07-20", label:"Wk 12",      workouts:{ Mon:"2mi Lift", Tue:"5mi 6x800m", Wed:"2mi Lift", Thu:"11mi easy", Fri:"2mi Lift", Sat:"18mi Long", Sun:"Yoga" }},
    { start:"2026-07-27", label:"Wk 13 down", workouts:{ Mon:"2mi Lift", Tue:"4mi easy",   Wed:"2mi Lift", Thu:"4mi easy",  Fri:"Rest",     Sat:"13mi HM",   Sun:"Yoga" }},
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

function matchesPlan(workoutType, planDesc) {
  if (!workoutType || !planDesc) return false;
  const logged = workoutType.toLowerCase();
  const planned = getWorkoutType(planDesc);
  if (logged.includes("interval") && planned==="intervals") return true;
  if ((logged.includes("easy")||logged.includes("run")) && (planned==="easy"||planned==="run")) return true;
  if (logged.includes("long") && planned==="long") return true;
  if (logged.includes("tempo") && planned==="tempo") return true;
  if ((logged.includes("lift")||logged.includes("strength")) && planned==="strength") return true;
  if (logged.includes("yoga") && planned==="yoga") return true;
  if (logged.includes("rest") && planned==="rest") return true;
  if (logged.includes("race") && planned==="race") return true;
  return false;
}

function parsePlanMiles(desc) {
  if (!desc) return 0;
  const m = desc.match(/^(\d+(?:\.\d+)?)mi/i);
  return m ? parseFloat(m[1]) : 0;
}

function fmtWorkout(desc) {
  if (!desc) return "";
  return desc.replace(/(\d+mi)\s+(Lift)/i, "$1 + $2");
}
function dotLabel(desc) {
  if (!desc) return ["Rest",""];
  const d = desc.toLowerCase();
  if (d==="yoga") return ["Yoga",""];
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
function getWorkoutType(desc) {
  if (!desc) return "rest";
  const d = desc.toLowerCase();
  if (d.includes("race")) return "race";
  if (d.includes("lift")) return "strength";
  if (d.includes("yoga")) return "yoga";
  if (d.includes("rest")) return "rest";
  if (d.includes("hm")) return "race";
  if (d.includes("pace")) return "tempo";
  if (d.includes("x4")||d.includes("x8")||d.includes("interval")) return "intervals";
  if (d.includes("long")) return "long";
  if (d.includes("easy")) return "easy";
  return "run";
}
const TYPE_STYLE = {
  easy:      {bg:"#E6F1FB",color:"#0C447C"},
  long:      {bg:"#FAECE7",color:"#4A1B0C"},
  intervals: {bg:"#FBEAF0",color:"#4B1528"},
  tempo:     {bg:"#FAEEDA",color:"#633806"},
  strength:  {bg:"#EEEDFE",color:"#3C3489"},
  yoga:      {bg:"#E1F5EE",color:"#085041"},
  rest:      {bg:"#F0F0EC",color:"#666"},
  race:      {bg:"#FAECE7",color:"#4A1B0C"},
  run:       {bg:"#E6F1FB",color:"#0C447C"},
};
const TYPE_LABEL = { easy:"Easy", long:"Long", intervals:"Intervals", tempo:"Tempo", strength:"Lift", yoga:"Yoga", rest:"Rest", race:"Race", run:"Run" };

// ── UI primitives ─────────────────────────────────────────────
const cardSt   = { background:"#fff", borderRadius:14, border:"0.5px solid #E5E2DB", padding:"16px 18px" };
const inputSt  = { fontSize:14, padding:"8px 12px", borderRadius:10, border:"0.5px solid #D8D5CC", background:"#F5F3EF", color:"#1A1A1A", width:"100%", boxSizing:"border-box", fontFamily:"inherit", outline:"none" };
const saveBtnSt= { padding:"8px 18px", background:"#fff", border:"0.5px solid #C8C5BC", borderRadius:10, fontSize:14, fontWeight:500, color:"#1A1A1A", cursor:"pointer", marginTop:10 };

function Spinner() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:"spin 1s linear infinite",flexShrink:0}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>; }
function Empty({text}) { return <p style={{fontSize:14,color:"#AAA7A0",fontStyle:"italic",margin:0,padding:"4px 0"}}>{text}</p>; }
function Badge({type}) {
  const st=TYPE_STYLE[type]||TYPE_STYLE.rest;
  return <span style={{fontSize:11,padding:"3px 9px",borderRadius:20,fontWeight:500,background:st.bg,color:st.color,whiteSpace:"nowrap"}}>{TYPE_LABEL[type]||"Run"}</span>;
}
function Metric({label,value,sub,hl}) {
  return <div style={{background:"#F5F3EF",borderRadius:10,border:"0.5px solid #E8E5DF",padding:"12px 14px"}}>
    <div style={{fontSize:22,fontWeight:500,color:hl||"#1A1A1A",lineHeight:1.15}}>{value||"—"}</div>
    <div style={{fontSize:13,color:"#555",marginTop:3}}>{label}</div>
    {sub&&<div style={{fontSize:12,color:"#AAA7A0",marginTop:1}}>{sub}</div>}
  </div>;
}
function Field({label,value,onChange,type="text",placeholder=""}) {
  return <div style={{marginBottom:10}}>
    <label style={{fontSize:12,color:"#888",display:"block",marginBottom:4}}>{label}</label>
    <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={inputSt}/>
  </div>;
}
function TArea({label,value,onChange,rows=2}) {
  return <div style={{marginBottom:10}}>
    {label&&<label style={{fontSize:12,color:"#888",display:"block",marginBottom:4}}>{label}</label>}
    <textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={rows} style={{...inputSt,resize:"vertical",lineHeight:1.6}}/>
  </div>;
}
function EditCard({title,right,id,editSection,setEditSection,display,editor}) {
  return <div style={cardSt}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>{title}</span>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {right&&<span style={{fontSize:13,color:"#AAA7A0"}}>{right}</span>}
        <button onClick={()=>setEditSection(editSection===id?null:id)} style={{fontSize:13,color:"#AAA7A0",background:"none",border:"none",cursor:"pointer",padding:0}}>
          {editSection===id?"Done":"Edit"}
        </button>
      </div>
    </div>
    {editSection===id?editor:display}
  </div>;
}

// ── Section displays ──────────────────────────────────────────
function WorkoutDisplay({w}) {
  const type=getWorkoutType(w.type);
  const rows=[
    ["Distance",   w.distance        ? w.distance+" mi"          : null],
    ["Pace",       w.pace            ? w.pace+" /mi"             : null],
    ["Avg HR",     w.hr              ? w.hr+" bpm"               : null],
    ["Peak HR",    w.hr_peak         ? w.hr_peak+" bpm"          : null],
    ["Duration",   w.duration        ? w.duration+" min"         : null],
    ["Cal burned", w.calories_burned ? w.calories_burned+" kcal" : null],
    ["Structure",  w.structure       || null],
    ["Reps",       w.rep_times       ? w.rep_times.split(",").join(", ") : null],
    ["Est. VDOT",  w.vdot            ? Number(w.vdot).toFixed(1) : null],
    ["Notes",      w.notes           || null],
  ].filter(r=>r[1]);
  const exerciseRows = w.exercises && w.exercises.length > 0
    ? w.exercises.map((ex, i) => [i === 0 ? "Exercises" : "", ex])
    : [];
  const allRows = [...rows, ...exerciseRows];
  return <div>
    <div style={{marginBottom:12}}><Badge type={type}/></div>
    {allRows.map(([lbl,val],i)=>(
      <div key={i} style={{display:"flex",gap:12,fontSize:14,padding:"7px 0",borderBottom:i<allRows.length-1?"0.5px solid #EEE":"none"}}>
        <span style={{color:"#888",minWidth:90,flexShrink:0}}>{lbl}</span>
        <span style={{color:"#1A1A1A",fontWeight:lbl==="Est. VDOT"?500:400}}>{val}</span>
      </div>
    ))}
  </div>;
}
function MetricsDisplay({m,nc}) {
  const ncColor=nc===null?undefined:nc<0?"#C0392B":"#1D9E75";
  const ncVal=nc===null?null:(nc>0?"+":"")+Math.round(nc);
  return <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
      <Metric label="Cal in"    value={m.calIn?Number(m.calIn).toLocaleString():null} sub="kcal"/>
      <Metric label="Cal out"   value={m.calOut||null} sub="exercise"/>
      <Metric label="Net cal"   value={ncVal} sub="kcal" hl={ncColor}/>
      <Metric label="Protein"   value={m.protein?m.protein+"g":null} sub="goal 180g"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
      <Metric label="Hydration" value={m.hydration?m.hydration+" oz":null} sub="goal 100 oz"/>
      <Metric label="Sleep"     value={m.sleep?m.sleep+" hr":null} sub="goal 7 hr"/>
      <Metric label="Weight"    value={m.weight?m.weight+" lb":null}/>
    </div>
  </div>;
}
function FoodDisplay({f}) {
  const meals=[["Breakfast",f.breakfast,f.breakfast_cal,f.breakfast_pro],["Lunch",f.lunch,f.lunch_cal,f.lunch_pro],["Snacks",f.snacks,f.snacks_cal,f.snacks_pro],["Dinner",f.dinner,f.dinner_cal,f.dinner_pro]].filter(m=>m[1]);
  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    {meals.map(([lbl,val,cal,pro])=>(
      <div key={lbl}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
          <div style={{fontSize:13,fontWeight:500,color:"#666"}}>{lbl}</div>
          {(cal||pro)&&<div style={{fontSize:12,color:"#AAA7A0"}}>{cal?cal+" cal":""}{cal&&pro?" · ":""}{pro?pro+"g protein":""}</div>}
        </div>
        <div style={{fontSize:14,color:"#1A1A1A",paddingLeft:8,lineHeight:1.55}}>{val}</div>
      </div>
    ))}
  </div>;
}

// ── Editors ───────────────────────────────────────────────────
function WorkoutEditor({w,onSave}) {
  const [v,setV]=useState({...w});
  const u=(k,x)=>setV(prev=>({...prev,[k]:x}));
  return <div>
    <Field label="Type" value={v.type} onChange={x=>u("type",x)} placeholder="Easy run / Intervals / Lift / Rest..."/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="Distance (mi)"  value={v.distance}        onChange={x=>u("distance",x)}        type="number"/>
      <Field label="Pace (/mi)"     value={v.pace}            onChange={x=>u("pace",x)}            placeholder="mm:ss"/>
      <Field label="HR Avg (bpm)"   value={v.hr}              onChange={x=>u("hr",x)}              type="number"/>
      <Field label="HR Peak (bpm)"  value={v.hr_peak}         onChange={x=>u("hr_peak",x)}         type="number"/>
      <Field label="Duration (min)" value={v.duration}        onChange={x=>u("duration",x)}        type="number"/>
      <Field label="Cal burned"     value={v.calories_burned} onChange={x=>u("calories_burned",x)} type="number"/>
      <Field label="Structure"      value={v.structure}       onChange={x=>u("structure",x)}       placeholder="e.g. 6x400m"/>
      <Field label="Rep times"      value={v.rep_times}       onChange={x=>u("rep_times",x)}       placeholder="1:29,1:32,..."/>
      <Field label="VDOT override"  value={v.vdot}            onChange={x=>u("vdot",x)}            placeholder="auto-calculated"/>
    </div>
    <Field label="Notes" value={v.notes} onChange={x=>u("notes",x)}/>
    <button style={saveBtnSt} onClick={()=>onSave(v)}>Save</button>
  </div>;
}
function MetricsEditor({m,onSave}) {
  const [v,setV]=useState({...m});
  const u=(k,x)=>setV(prev=>({...prev,[k]:x}));
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="Calories in"    value={v.calIn}     onChange={x=>u("calIn",x)}     type="number" placeholder="kcal"/>
      <Field label="Calories out"   value={v.calOut}    onChange={x=>u("calOut",x)}    type="number" placeholder="kcal"/>
      <Field label="Protein (g)"    value={v.protein}   onChange={x=>u("protein",x)}   type="number"/>
      <Field label="Hydration (oz)" value={v.hydration} onChange={x=>u("hydration",x)} type="number"/>
      <Field label="Sleep (hr)"     value={v.sleep}     onChange={x=>u("sleep",x)}     type="number"/>
      <Field label="Weight (lb)"    value={v.weight}    onChange={x=>u("weight",x)}    type="number"/>
    </div>
    <button style={saveBtnSt} onClick={()=>onSave(v)}>Save</button>
  </div>;
}
function FoodEditor({f,onSave}) {
  const [v,setV]=useState({...f});
  const u=(k,x)=>setV(prev=>({...prev,[k]:x}));
  return <div>
    <TArea label="Breakfast" value={v.breakfast} onChange={x=>u("breakfast",x)}/>
    <TArea label="Lunch"     value={v.lunch}     onChange={x=>u("lunch",x)}/>
    <TArea label="Snacks"    value={v.snacks}    onChange={x=>u("snacks",x)}/>
    <TArea label="Dinner"    value={v.dinner}    onChange={x=>u("dinner",x)}/>
    <button style={saveBtnSt} onClick={()=>onSave(v)}>Save</button>
  </div>;
}
function JournalEditor({j,onSave}) {
  const [v,setV]=useState(j||"");
  return <div><TArea value={v} onChange={setV} rows={5}/><button style={saveBtnSt} onClick={()=>onSave(v)}>Save</button></div>;
}
function OtherActivityEditor({a,onSave}) {
  const [v,setV]=useState({...a});
  const u=(k,x)=>setV(prev=>({...prev,[k]:x}));
  return <div>
    <Field label="Activity"        value={v.description} onChange={x=>u("description",x)} placeholder="e.g. Recreational softball"/>
    <Field label="Duration"        value={v.duration}    onChange={x=>u("duration",x)}    placeholder="e.g. 2 hrs"/>
    <Field label="Calories burned" value={v.calories}    onChange={x=>u("calories",x)}    type="number"/>
    <button style={saveBtnSt} onClick={()=>onSave(v)}>Save</button>
  </div>;
}

// ── Plan Tab ──────────────────────────────────────────────────
// Reads directly from storage once on mount, keyed by date string
function PlanTab({onViewLog, summary}) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [planEntries, setPlanEntries] = useState(summary || {});
  const today = new Date();

  // Keep planEntries in sync whenever the parent's summary changes
  // (e.g. on initial load, after saving an entry, or after a manual sync)
  useEffect(() => { setPlanEntries(summary || {}); }, [summary]);
  const DOWS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const weekDays = Array.from({length:7}, (_,i)=>addDays(weekStart,i));

  const isLogged   = key => !!(planEntries[key]?.savedAt);
  const isComplete = key => !!(planEntries[key]?.workout_complete);

  const weekLabel = weekDays.map(d=>PLAN[fmtKey(d)]).find(p=>p)?.label || "";

  function DotRow({day, idx, inMonth=true}) {
    const key = fmtKey(day);
    const plan = PLAN[key];
    const type = plan ? getWorkoutType(plan.workout) : "rest";
    const st = TYPE_STYLE[type];
    const done = isComplete(key);
    const logged = isLogged(key);
    const tod = isToday(day);
    const past = day < today && !isToday(day);
    const missed = past && plan && !logged && type!=="rest" && type!=="yoga";
    const [l1,l2] = dotLabel(plan?plan.workout:"");
    return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",flex:1,borderRadius:8,background:tod?"#FEF6E8":inMonth?"#FAFAF8":"transparent",padding:"2px 0"}} onClick={()=>onViewLog(day)}>
      <span style={{fontSize:10,color:tod?"#BA7517":"#AAA",height:14}}>{DOWS[idx]}</span>
      <div style={{position:"relative",width:32,height:32,flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:500,
          background:done?"#1D9E75":logged?"#A8D5B5":missed?"#F7C1C1":tod?"#BA7517":st.bg,
          color:done?"#E1F5EE":logged?"#085041":missed?"#A32D2D":tod?"#FAEEDA":st.color}}>
          {day.getDate()}
        </div>
        {done&&<span style={{position:"absolute",top:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#0E7A57",border:"1.5px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700,lineHeight:1}}>✓</span>}
        {logged&&!done&&<span style={{position:"absolute",top:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#5AA07A",border:"1.5px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700,lineHeight:1}}>~</span>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:28}}>
        <span style={{fontSize:9,color:tod?"#BA7517":"#AAA7A0",textAlign:"center",lineHeight:1.3}}>{l1}</span>
        {l2&&<span style={{fontSize:9,color:tod?"#BA7517":"#AAA7A0",textAlign:"center",lineHeight:1.3}}>{l2}</span>}
      </div>
    </div>;
  }

  const RACE_DATE = new Date(2026, 9, 4);
  const daysToRace = Math.ceil((RACE_DATE - new Date(new Date().toDateString())) / 86400000);
  const weeksToRace = Math.floor(daysToRace / 7);
  const planKeys = Object.keys(PLAN);
  const totalPlannedWorkouts = planKeys.filter(k=>{ const t=getWorkoutType(PLAN[k].workout); return t!=="rest"&&t!=="yoga"; }).length;
  const totalPlannedMiles = planKeys.reduce((s,k)=>s+parsePlanMiles(PLAN[k].workout),0);
  const totalLoggedWorkouts = Object.values(planEntries).filter(e=>e?.workout_complete).length;
  const totalLoggedMiles = Object.values(planEntries).reduce((s,e)=>s+(e?.distance||0),0);
  const weekPlannedMiles = weekDays.reduce((s,d)=>s+parsePlanMiles(PLAN[fmtKey(d)]?.workout||""),0);
  const weekLoggedMiles = weekDays.reduce((s,d)=>{ const e=planEntries[fmtKey(d)]; return s+(e?.distance||0); },0);
  const weekPlannedWorkouts = weekDays.filter(d=>{ const p=PLAN[fmtKey(d)]; if(!p) return false; const t=getWorkoutType(p.workout); return t!=="rest"&&t!=="yoga"; }).length;
  const weekLoggedWorkouts = weekDays.filter(d=>planEntries[fmtKey(d)]?.workout_complete).length;
  const todayKey = fmtKey(new Date());
  const tomorrowKey = fmtKey(addDays(new Date(), 1));
  const todayPlanEntry = PLAN[todayKey];
  const tomorrowPlanEntry = PLAN[tomorrowKey];

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>

    {(todayPlanEntry||tomorrowPlanEntry)&&<div style={cardSt}>
      {[["Today",todayKey,todayPlanEntry],["Tomorrow",tomorrowKey,tomorrowPlanEntry]].map(([lbl,key,plan])=>plan?(
        <div key={key} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:lbl==="Today"&&tomorrowPlanEntry?"0.5px solid #EEE":"none"}}>
          <span style={{fontSize:12,color:key===todayKey?"#BA7517":"#AAA",minWidth:52,flexShrink:0,fontWeight:key===todayKey?500:400}}>{lbl}</span>
          <Badge type={getWorkoutType(plan.workout)}/>
          <span style={{fontSize:13,color:"#1A1A1A",flex:1}}>{fmtWorkout(plan.workout)}</span>
          {planEntries[key]?.workout_complete&&<span style={{fontSize:13,color:"#1D9E75"}}>✓</span>}
        </div>
      ):null)}
    </div>}

    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>
          {calOpen ? monthNames[calMonth.getMonth()]+" "+calMonth.getFullYear() : (weekLabel||"Training plan")}
        </span>
        {calOpen
          ? <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18,padding:"0 4px"}}>&#8249;</button>
              <button onClick={()=>setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18,padding:"0 4px"}}>&#8250;</button>
            </div>
          : <span style={{fontSize:12,color:"#AAA7A0"}}>{fmtDisplay(weekStart).split(", ")[1]} – {fmtDisplay(addDays(weekStart,6)).split(", ")[1]}</span>
        }
      </div>

      {!calOpen && <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
        <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 2px",marginTop:22}}>&#8249;</button>
        <div style={{display:"flex",flex:1,alignItems:"flex-start",justifyContent:"space-between"}}>
          {weekDays.map((day,idx)=><DotRow key={fmtKey(day)} day={day} idx={idx} inMonth={false}/>)}
        </div>
        <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 2px",marginTop:22}}>&#8250;</button>
      </div>}

      {calOpen && <div style={{marginBottom:14}}>
        {(()=>{
          const first=new Date(calMonth.getFullYear(),calMonth.getMonth(),1);
          const lastDay=new Date(calMonth.getFullYear(),calMonth.getMonth()+1,0);
          let w=startOfWeek(first);
          const calWeeks=[];
          while(w<=lastDay){calWeeks.push(Array.from({length:7},(_,i)=>addDays(w,i)));w=addDays(w,7);}
          return calWeeks.map((days,wi)=>{
            const isCurrentWeek=days.some(d=>isToday(d));
            return <div key={wi} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4,paddingBottom:4,borderBottom:wi<calWeeks.length-1?"0.5px solid #F0EDE8":"none"}}>
              {days.map((day,idx)=><DotRow key={fmtKey(day)} day={day} idx={idx} inMonth={day.getMonth()===calMonth.getMonth()}/>)}
            </div>;
          });
        })()}
      </div>}

      <button onClick={()=>setCalOpen(!calOpen)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"8px",background:"#F5F3EF",border:"0.5px solid #E5E2DB",borderRadius:10,fontSize:13,color:"#666",cursor:"pointer"}}>
        View {calOpen?"less":"full training calendar"} {calOpen?"▴":"▾"}
      </button>
    </div>

    <div style={cardSt}>
      <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",marginBottom:12}}>This week</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:4}}>
            <span>Miles run</span>
            <span style={{color:"#1A1A1A",fontWeight:500}}>{Math.round(weekLoggedMiles*10)/10} <span style={{color:"#AAA",fontWeight:400}}>/ {weekPlannedMiles} mi</span></span>
          </div>
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,background:"#185FA5",width:weekPlannedMiles?Math.min(100,Math.round((weekLoggedMiles/weekPlannedMiles)*100))+"%":"0%",transition:"width 0.3s"}}/>
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:4}}>
            <span>Workouts</span>
            <span style={{color:"#1A1A1A",fontWeight:500}}>{weekLoggedWorkouts} <span style={{color:"#AAA",fontWeight:400}}>/ {weekPlannedWorkouts} completed</span></span>
          </div>
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,background:"#1D9E75",width:weekPlannedWorkouts?Math.min(100,Math.round((weekLoggedWorkouts/weekPlannedWorkouts)*100))+"%":"0%",transition:"width 0.3s"}}/>
          </div>
        </div>
      </div>
    </div>

    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:2}}>
        <span style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>Twin Cities Marathon</span>
        <span style={{fontSize:13,color:"#888"}}>Oct 4, 2026</span>
      </div>
      <div style={{fontSize:12,color:"#AAA7A0",marginBottom:12}}>{weeksToRace} weeks · {daysToRace} days to go</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:4}}>
            <span>Plan progress</span>
            <span style={{color:"#1A1A1A",fontWeight:500}}>{Math.round((1-(daysToRace/154))*100)}%</span>
          </div>
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,background:"#1A1A1A",width:Math.round((1-(daysToRace/154))*100)+"%"}}/>
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:4}}>
            <span>Miles run</span>
            <span style={{color:"#1A1A1A",fontWeight:500}}>{Math.round(totalLoggedMiles*10)/10} <span style={{color:"#AAA",fontWeight:400}}>/ {totalPlannedMiles} mi</span></span>
          </div>
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,background:"#185FA5",width:totalPlannedMiles?Math.min(100,Math.round((totalLoggedMiles/totalPlannedMiles)*100))+"%":"0%",transition:"width 0.3s"}}/>
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:4}}>
            <span>Workouts</span>
            <span style={{color:"#1A1A1A",fontWeight:500}}>{totalLoggedWorkouts} <span style={{color:"#AAA",fontWeight:400}}>/ {totalPlannedWorkouts} completed</span></span>
          </div>
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,background:"#1D9E75",width:totalPlannedWorkouts?Math.min(100,Math.round((totalLoggedWorkouts/totalPlannedWorkouts)*100))+"%":"0%",transition:"width 0.3s"}}/>
          </div>
        </div>
      </div>
    </div>

  </div>;
}

// ── Prompts ───────────────────────────────────────────────────
const SNAPSHOT_FORMAT = [
  "DAILY SNAPSHOT — [Weekday, Month Day] · Week [N] · Day [N]","",
  "SLEEP","[X]h [Y]min · [start time]–[end time]","",
  "WEIGHT","[X] lbs","",
  "WORKOUT",
  "Type: [Easy run / Long run / Tempo run / Intervals / Lift / Yoga / Race / Rest]",
  "Distance: [X] miles","Pace: [mm:ss/mi]","HR: [avg]/[peak] bpm","Duration: [X] min","Calories: [X]",
  "Structure: [NxYm e.g. 6x400m — intervals only]","Reps: [mm:ss, mm:ss, ... — every rep, intervals only]",
  "Exercises: [Exercise · sets x reps · weight] | [Exercise · sets x reps · weight]",
  "Notes: [anything notable about the workout]","",
  "SECONDARY ACTIVITY","[Activity name] · [duration] · [calories]","",
  "NUTRITION",
  "Breakfast: [food] · [cal] · [protein] | [food] · [cal] · [protein]",
  "Lunch: [food] · [cal] · [protein] | [food] · [cal] · [protein]",
  "Snacks: [food] · [cal] · [protein] | [food] · [cal] · [protein]",
  "Dinner: [food] · [cal] · [protein] | [food] · [cal] · [protein]",
  "Calories: [total in] · Burned: [BMR + exercise kcal] · Net: [in minus out]",
  "Protein: [X]g · Hydration: [X] oz","",
  "SLEEP NOTES","[Quality, disturbances, anything notable about the night's sleep]","",
  "ENERGY","[How you felt — mood, mental state, motivation, stress, energy levels throughout the day]","",
  "BODY","[Physical observations — soreness, injuries, anything to monitor]","",
  "PERSONAL NOTE","[I will provide this at the end of the day — copy it exactly as written, in my voice, no edits]",
].join("\n");

const SNAPSHOT_INSTRUCTIONS = [
  "Generate a DAILY SNAPSHOT at the end of each day using the format below. Omit any field or section that doesn't apply or has no data.",
  "","General rules:",
  "- Section headers exactly as shown in ALL CAPS",
  "- Labeled fields use Field: value format",
  "- Inline data within a line is separated by middle dot",
  "- Items within a field are separated by |",
  "- Numbers only, no approximation symbols","",
  SNAPSHOT_FORMAT,"",
  "Field-by-field guidance:",
  "SLEEP — total duration plus window. Example: 7h 30min · 11:00pm–6:30am",
  "WEIGHT — morning weight in lbs",
  "WORKOUT:",
  "- Type — exactly one of: Easy run, Long run, Tempo run, Intervals, Lift, Yoga, Race, Rest",
  "- Distance — total miles, runs only",
  "- Pace — average pace mm:ss/mi, steady runs only, omit for intervals",
  "- HR — avg/peak bpm. Example: 146/177 bpm",
  "- Duration — minutes, required for Lift and Yoga",
  "- Calories — calories burned",
  "- Structure — interval structure only e.g. 6x400m",
  "- Reps — every rep time mm:ss comma-separated, intervals only",
  "- Exercises — Lift days only, items separated by |, format: Exercise · sets x reps · weight",
  "- Notes — conditions, how it felt, observations",
  "SECONDARY ACTIVITY — single line: Activity name · duration · calories",
  "NUTRITION — each meal one line, items separated by |, format: Food · cal · protein",
  "- Summary: Calories: [in] · Burned: [BMR + exercise kcal, total TDEE for the day] · Net: [in minus out]",
  "- Protein and Hydration on same line, hydration in oz",
  "SLEEP NOTES — quality, disturbances, anything notable about the night's sleep",
  "ENERGY — free-form: mood, mental state, motivation, stress, energy levels",
  "BODY — soreness, tightness, injuries, anything worth monitoring",
  "PERSONAL NOTE — I will write and provide this at the end of the day. Copy it verbatim into the snapshot exactly as I write it. Do not rephrase, summarize, or edit. Keep it in my voice.",
].join("\n");

function buildTrackingPrompt() {
  const today = new Date();
  const todayPlan = PLAN[fmtKey(today)];
  const currentWeekLabel = todayPlan ? todayPlan.label : "";
  const weekStart = startOfWeek(today);
  const upcomingWorkouts = Array.from({length:7},(_,i)=>addDays(weekStart,i))
    .filter(d=>d>=today)
    .map(d=>{ const p=PLAN[fmtKey(d)]; return p?fmtDisplay(d).split(", ")[0]+": "+p.workout:null; })
    .filter(Boolean).join("\n");
  return [
    "CONTEXT & PURPOSE",
    "You are my daily fitness and nutrition logging assistant for a structured 22-week marathon training plan. Throughout the day I will post my workouts, meals, and other activity as I do them. Your job is to:",
    "- Log everything I post and keep a running record for the day",
    "- Track cumulative nutrition (calories, protein, hydration) and update totals as I log meals",
    "- When I ask (or towards the end of the day), tell me how many calories I have left to eat to hit my target, or how far over I am — factoring in BMR + any exercise calories burned",
    "- Flag patterns, concerns, or observations worth noting",
    "- Answer questions about training and nutrition in context of my goals",
    "- At the end of the day, generate a DAILY SNAPSHOT in the exact format specified at the bottom of this prompt, ready for me to copy and paste into my tracking app",
    "This chat is purely for daily logging. I have a separate app that stores my full history and visualizes trends.","",
    "WHO I AM",
    "29 years old, male, 5ft 9in",
    "Estimated BMR ~1818 kcal/day (Mifflin-St Jeor: 190 lb / 86.2 kg, 5ft 9in / 175.3 cm, 29 yr, male; recalculate if I log a new weight). TDEE = BMR + exercise calories burned.",
    "Background: competitive XC and track through high school, ran 4:55 mile and 3:03 marathon at age 19",
    "Had 4 subsequent marathons: 3:40, 4:20 (no training), 3:55 (poor training), roughly 2 years between each",
    "Currently rebuilding fitness after a decade away from serious training",
    "6 weeks of base building before starting current plan",
    "Taking creatine, current weight includes some extra water weight","",
    "GOALS",
    "Marathon (October 4, 2026 — Twin Cities): A goal 3:20, B goal 3:30",
    "Long term (5 years): Qualify for Boston Marathon, target ~2:50",
    "Mile time trial (few weeks post-marathon): Goal sub-5:30",
    "Lifting (by September 2027): Bench 285 lbs (current ~220), Pull-ups 10 (current 5)","",
    "CURRENT TRAINING PLAN",
    "22-week plan, started May 4 2026, race October 4 2026",
    "Currently " + currentWeekLabel,"",
    "Phase 1 Wks 1-13: Mon/Wed/Fri Lift, Tue intervals/easy, Thu easy, Sat long, Sun yoga",
    "Phase 2 Wks 14-22: Mon Lift, Tue intervals or easy, Wed longer easy, Thu Lift, Fri rest, Sat pace/long, Sun long","",
    "Full schedule:",
    "Wk 1  May 4:  Mon 2mi Lift / Tue 4mi easy / Wed 2mi Lift / Thu 5mi easy / Fri 2mi Lift / Sat 8mi Long / Sun Yoga",
    "Wk 2  May 11: Mon 2mi Lift / Tue 4mi easy / Wed 2mi Lift / Thu 6mi easy / Fri 2mi Lift / Sat 9mi Long / Sun Yoga",
    "Wk 3  May 18: Mon 2mi Lift / Tue 5mi 6x400m / Wed 2mi Lift / Thu 6mi easy / Fri 2mi Lift / Sat 10mi Long / Sun Yoga",
    "Wk 4  May 25: Mon 2mi Lift / Tue 5mi 4x800m / Wed 2mi Lift / Thu 7mi easy / Fri 2mi Lift / Sat 11mi Long / Sun Yoga",
    "Wk 5  Jun 1:  Mon 2mi Lift / Tue 5mi 6x400m / Wed 2mi Lift / Thu 7mi easy / Fri 2mi Lift / Sat 12mi Long / Sun Yoga",
    "Wk 6  Jun 8:  Mon 2mi Lift / Tue 5mi 4x800m / Wed 2mi Lift / Thu 8mi easy / Fri 2mi Lift / Sat 13mi Long / Sun Yoga",
    "Wk 7  Jun 15: Mon 2mi Lift / Tue 5mi 7x400m / Wed 2mi Lift / Thu 8mi easy / Fri 2mi Lift / Sat 10mi Long / Sun Yoga (down week)",
    "Wk 8  Jun 22: Mon 2mi Lift / Tue 5mi 5x800m / Wed 2mi Lift / Thu 9mi easy / Fri 2mi Lift / Sat 14mi Long / Sun Yoga",
    "Wk 9  Jun 29: Mon 2mi Lift / Tue 5mi 7x400m / Wed 2mi Lift / Thu 9mi easy / Fri 2mi Lift / Sat 15mi Long / Sun Yoga",
    "Wk 10 Jul 6:  Mon 2mi Lift / Tue 5mi 5x800m / Wed 2mi Lift / Thu 10mi easy / Fri 2mi Lift / Sat 16mi Long / Sun Yoga",
    "Wk 11 Jul 13: Mon 2mi Lift / Tue 5mi 8x400m / Wed 2mi Lift / Thu 10mi easy / Fri 2mi Lift / Sat 17mi Long / Sun Yoga",
    "Wk 12 Jul 20: Mon 2mi Lift / Tue 5mi 6x800m / Wed 2mi Lift / Thu 11mi easy / Fri 2mi Lift / Sat 18mi Long / Sun Yoga",
    "Wk 13 Jul 27: Mon 2mi Lift / Tue 4mi easy / Wed 2mi Lift / Thu 4mi easy / Fri Rest / Sat 13mi HM / Sun Yoga (down week)",
    "Wk 14 Aug 3:  Mon 1mi Lift / Tue 4mi easy / Wed 7mi easy / Thu 2mi Lift / Fri Rest / Sat 7mi pace / Sun 19mi Long",
    "Wk 15 Aug 10: Mon 1mi Lift / Tue 5mi easy / Wed 8mi easy / Thu 2mi Lift / Fri Rest / Sat 8mi run / Sun 20mi Long",
    "Wk 16 Aug 17: Mon 1mi Lift / Tue 5mi 6x800m / Wed 6mi easy / Thu 2mi Lift / Fri Rest / Sat 6mi pace / Sun 12mi Long (down week)",
    "Wk 17 Aug 24: Mon 1mi Lift / Tue 5mi easy / Wed 9mi easy / Thu 2mi Lift / Fri Rest / Sat 9mi pace / Sun 20mi Long",
    "Wk 18 Aug 31: Mon 1mi Lift / Tue 5mi 8x400m / Wed 6mi easy / Thu 2mi Lift / Fri Rest / Sat 6mi run / Sun 12mi Long (down week)",
    "Wk 19 Sep 7:  Mon 1mi Lift / Tue 5mi easy / Wed 10mi easy / Thu 2mi Lift / Fri Rest / Sat 10mi pace / Sun 20mi Long",
    "Wk 20 Sep 14: Mon 1mi Lift / Tue 5mi 6x800m / Wed 8mi easy / Thu 2mi Lift / Fri Rest / Sat 4mi pace / Sun 12mi Long (down week)",
    "Wk 21 Sep 21: Mon 1mi Lift / Tue 4mi easy / Wed 6mi easy / Thu 2mi Lift / Fri Rest / Sat 4mi run / Sun 8mi Long",
    "Wk 22 Sep 28: Mon Rest / Tue 3mi easy / Wed 4mi easy / Thu Rest / Fri Rest / Sat 2mi run / Sun RACE","",
    "Lifting A/B split: A: Squat, shoulder press, assisted pull-ups / B: Deadlift, bench, bent-over row",
    "Warmup: shoulder mobility. Finisher: face pulls, dead hangs. Modified for mild AC joint irritation.","",
    "PHYSICAL FLAGS TO MONITOR",
    "- Tibialis anterior tightness — improving",
    "- AC joint twinges — monitoring, using dumbbells at 30-45 degree angle",
    "- Fascia tightness — chronic, managed with stretching, massage gun, yoga",
    "- Wheezing during intervals — first occurrence May 19, monitor going forward","",
    "NUTRITION CONTEXT",
    "Eating intuitively, protein target 170g+ daily, hydration 100+ oz daily",
    "Goal: body recomposition — reduce belly fat, maintain/build muscle",
    "Calorie target: rough deficit or maintenance depending on the day. Use TDEE (BMR ~1818 + exercise burned) as the baseline when estimating calories remaining or surplus.","",
    "SLEEP","Bed around midnight, wake 6:30-7:00. Goal: 7 hrs average.","",
    "UPCOMING WORKOUTS THIS WEEK",
    upcomingWorkouts||"[no upcoming workouts found]","",
    "---",
    "DAILY SNAPSHOT FORMAT",
    "At the end of each day generate the snapshot below. Omit any field or section with no data.","",
    SNAPSHOT_INSTRUCTIONS,
  ].join("\n");
}

function ToolsTab({ onImport }) {
  const [promptText, setPromptText] = useState("");
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const generate = () => {
    try { setPromptText(buildTrackingPrompt()); } catch(e) { setPromptText("Error: "+e.message); }
  };
  const copy = () => {
    navigator.clipboard.writeText(promptText).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const handleExport = async () => {
    try {
      const summary = await loadSummary();
      const keys = Object.keys(PLAN);
      const entries = {};
      for (const key of keys) {
        const res = await window.storage.get("athlete_log_entry:" + key);
        if (res && res.value) entries[key] = JSON.parse(res.value);
      }
      const blob = new Blob([JSON.stringify({ entries, summary }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitness-log-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) { alert("Export failed: " + e.message); }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const { entries, summary } = data;
        let count = 0;
        for (const [key, entry] of Object.entries(entries || {})) {
          await window.storage.set("athlete_log_entry:" + key, JSON.stringify(entry));
          count++;
        }
        if (summary) await window.storage.set("athlete_log_summary", JSON.stringify(summary));
        onImport && onImport();
        setImportStatus(`✓ Imported ${count} entries`);
      } catch(err) {
        setImportStatus("✗ Failed: " + err.message);
      } finally { setImporting(false); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>

    {/* Export / Import */}
    <div style={cardSt}>
      <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",marginBottom:12}}>Data</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:13,fontWeight:500,color:"#1A1A1A"}}>Export logs</div>
            <div style={{fontSize:12,color:"#AAA7A0",marginTop:2}}>Download all entries as a JSON backup</div>
          </div>
          <button onClick={handleExport} style={{padding:"7px 16px",background:"#1A1A1A",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:500,cursor:"pointer",flexShrink:0}}>Export</button>
        </div>
        <div style={{borderTop:"0.5px solid #EEE",paddingTop:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:13,fontWeight:500,color:"#1A1A1A"}}>Import logs</div>
            <div style={{fontSize:12,color:"#AAA7A0",marginTop:2}}>Restore from a previously exported JSON{importStatus&&<span style={{marginLeft:6,color:importStatus.startsWith("✓")?"#1D9E75":"#E05C5C"}}>{importStatus}</span>}</div>
          </div>
          <label style={{padding:"7px 16px",background:"#F5F3EF",border:"0.5px solid #D8D5CC",borderRadius:9,fontSize:13,fontWeight:500,cursor:"pointer",flexShrink:0,color:"#1A1A1A"}}>
            {importing ? "Importing…" : "Import"}
            <input type="file" accept=".json" onChange={handleImport} style={{display:"none"}}/>
          </label>
        </div>
      </div>
    </div>

    {/* Prompt generator */}
    {!promptText
      ? <div style={{...cardSt,textAlign:"center",padding:"28px 18px"}}>
          <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",marginBottom:8}}>Tracking chat prompt</div>
          <p style={{fontSize:14,color:"#555",marginBottom:16,lineHeight:1.6}}>
            Generates a prompt for starting a new tracking chat, including your full training plan and snapshot format.
          </p>
          <button onClick={generate} style={{padding:"10px 24px",background:"#1A1A1A",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>
            Generate prompt
          </button>
        </div>
      : <div style={cardSt}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Tracking chat prompt</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={generate} style={{fontSize:12,color:"#888",background:"none",border:"0.5px solid #D8D5CC",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>Regenerate</button>
              <button onClick={copy} style={{fontSize:12,color:copied?"#1D9E75":"#888",background:"none",border:"0.5px solid #D8D5CC",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>{copied?"Copied!":"Copy"}</button>
            </div>
          </div>
          <textarea value={promptText} onChange={e=>setPromptText(e.target.value)}
            style={{width:"100%",minHeight:500,background:"#F5F3EF",border:"0.5px solid #E0DDD6",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#1A1A1A",fontFamily:"monospace",resize:"vertical",boxSizing:"border-box",lineHeight:1.7,outline:"none"}}/>
        </div>
    }
  </div>;
}

// ── Dashboard ────────────────────────────────────────────────
function DashboardTab({ summary }) {
  const [wWindow, setWWindow] = useState("7d");
  const [vWindow, setVWindow] = useState("7d");
  const [vdotFilter, setVdotFilter] = useState("aerobic");
  const [bWindow, setBWindow] = useState("1d");
  const windowN = { "7d": 7, "14d": 14, "30d": 30 };

  const allEntries = Object.entries(summary)
    .filter(([,e]) => e && e.savedAt)
    .sort(([a],[b]) => a < b ? -1 : 1)
    .map(([key, e]) => ({ ...e, dateKey: key }));

  function getField(arr, field, n) {
    return arr
      .filter(e => e[field] !== "" && e[field] != null && !isNaN(parseFloat(e[field])))
      .slice(-n)
      .map(e => ({ date: e.dateKey, val: parseFloat(e[field]) }));
  }

  function rollingAvg(data, n) {
    return data.map((_, i) => {
      const slice = data.slice(Math.max(0, i - n + 1), i + 1);
      return slice.reduce((s, x) => s + x.val, 0) / slice.length;
    });
  }

  const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function dateLbl(ds) {
    // ds is a YYYY-MM-DD key
    const d = new Date(ds + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    return d.getTime() === today.getTime() ? "Today" : MO[d.getMonth()] + " " + d.getDate();
  }

  function weekChange(data) {
    if (data.length < 2) return null;
    const recent = data[data.length - 1].val;
    const ago = new Date(); ago.setDate(ago.getDate() - 7); ago.setHours(0,0,0,0);
    const base = [...data].reverse().find(d => new Date(d.date + "T00:00:00") <= ago);
    return base != null ? recent - base.val : null;
  }

  // Group daily bar data into weekly or monthly buckets
  function groupBarData(daily, grouping) {
    if (!daily.length) return [];
    if (grouping === "1d") return daily.map(d => ({ ...d, lbl: null }));
    const buckets = new Map();
    const first = new Date(daily[0].date + "T00:00:00"); first.setHours(0,0,0,0);
    daily.forEach(d => {
      const dt = new Date(d.date + "T00:00:00");
      const key = grouping === "7d"
        ? String(Math.floor((dt - first) / 604800000))   // week index
        : d.date.slice(0, 7);                             // YYYY-MM
      if (!buckets.has(key)) buckets.set(key, { firstDate: d.date, vals: [], idx: buckets.size });
      buckets.get(key).vals.push(d.val);
    });
    return [...buckets.values()].map(b => ({
      date: b.firstDate,
      val: b.vals.reduce((s,v)=>s+v,0) / b.vals.length,
      lbl: grouping === "7d" ? `Wk ${b.idx+1}` : MO[new Date(b.firstDate+"T00:00:00").getMonth()]
    }));
  }

  function AvgToggle({ value, setValue, options }) {
    return <div style={{display:"flex",gap:4}}>
      {(options||["7d","14d","30d"]).map(o=>(
        <button key={o} onClick={()=>setValue(o)} style={{fontSize:11,padding:"2px 7px",borderRadius:20,border:"1px solid #CCC",background:value===o?"#1A1A1A":"none",color:value===o?"#FFF":"#666",cursor:"pointer",fontWeight:500}}>{o}</button>
      ))}
    </div>;
  }

function Tooltip({ x, y, text, W }) {
    const w = text.length * 5.8 + 12;
    const tx = Math.min(Math.max(x - w/2, 2), W - w - 2);
    const ty = y - 28;
    return <g pointerEvents="none">
      <rect x={tx} y={ty} width={w} height={18} rx={4} fill="#1A1A1A" opacity={0.85}/>
      <text x={tx + w/2} y={ty + 12} textAnchor="middle" fontSize={9.5} fill="#FFF" fontWeight={500}>{text}</text>
    </g>;
  }

  function LineChart({ data, avg, targetLine, targetLabel, dotColor, lineColor }) {
    const [tip, setTip] = useState(null);
    const W=300, H=80, PT=10, PB=4;
    if (!data.length) return <svg width="100%" viewBox={`0 0 ${W} ${H+18}`}><text x={W/2} y={H/2} textAnchor="middle" fontSize={11} fill="#CCC">No data</text></svg>;
    const n = data.length;
    const vals = data.map(d=>d.val);
    const allV = [...vals, ...(targetLine!=null?[targetLine]:[])];    
    let mn=Math.min(...allV), mx=Math.max(...allV);
    const pad=(mx-mn)*0.3||2; mn-=pad; mx+=pad;
    const xf = i => n<2 ? W/2 : (i/(n-1))*W;
    const yf = v => PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);
    const avgPath = avg.map((a,i)=>`${i===0?"M":"L"}${xf(i).toFixed(1)},${yf(a).toFixed(1)}`).join(" ");
    const lblIdx = n<=1?[0]:n<=4?[0,n-1]:[0,Math.floor(n/3),Math.floor(2*n/3),n-1];
    const uniq = [...new Set(lblIdx)];
    return <svg width="100%" viewBox={`0 0 ${W} ${H+18}`} style={{overflow:"visible"}} onMouseLeave={()=>setTip(null)}>
      {targetLine!=null&&<line x1={0} y1={yf(targetLine)} x2={W} y2={yf(targetLine)} stroke="#E8A857" strokeWidth={1} strokeDasharray="4 3"/>}
      {targetLabel&&<text x={W-2} y={yf(targetLine)-3} textAnchor="end" fontSize={9} fill="#E8A857">{targetLabel}</text>}
      <path d={avgPath} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round"/>
      {data.map((d,i)=>{
        const cx=xf(i), cy=yf(d.val);
        const isHot = tip?.i===i;
        return <g key={i} onMouseEnter={()=>setTip({i, x:cx, y:cy, text:`${dateLbl(d.date)}: ${Number(d.val).toFixed(1)}`})} style={{cursor:"default"}}>
          <circle cx={cx} cy={cy} r={isHot?5:2.5} fill={dotColor} opacity={isHot?1:0.75} style={{transition:"r 0.1s"}}/>
        </g>;
      })}
      {uniq.map(i=><text key={i} x={xf(i)} y={H+16} textAnchor={i===0?"start":i===n-1?"end":"middle"} fontSize={9} fill="#AAA">{dateLbl(data[i].date)}</text>)}
      {tip&&<Tooltip x={tip.x} y={tip.y} text={tip.text} W={W}/>}
    </svg>;
  }

  function BarChart({ data, goalLine, barColor, negColor, showDow }) {
    const [tip, setTip] = useState(null);
    const W=280, H=70, PT=14;
    if (!data.length) return <svg width="100%" viewBox={`0 0 ${W} ${H+PT+18}`}><text x={W/2} y={(H+PT)/2} textAnchor="middle" fontSize={11} fill="#CCC">No data</text></svg>;
    const vals = data.map(d=>d.val);
    const hasNeg = vals.some(v=>v<0);
    const rawMax = Math.max(...vals, goalLine||0, 1);
    const rawMin = hasNeg ? Math.min(...vals, 0) : 0;
    const buf = (rawMax - rawMin) * 0.04 || 2;
    const mx = rawMax + buf;
    const mn = rawMin;
    const range = mx - mn || 1;
    const gap=W/data.length, bw=gap*0.65;
    const zY = PT + H*(1-(0-mn)/range);
    const yf = v => PT + H*(1-(v-mn)/range);
    const xc = i => i*gap+gap/2;
    return <svg width="100%" viewBox={`0 0 ${W} ${H+PT+18}`} style={{overflow:"visible"}} onMouseLeave={()=>setTip(null)}>
      {goalLine!=null&&<><line x1={0} y1={yf(goalLine)} x2={W} y2={yf(goalLine)} stroke="#CCC" strokeWidth={0.8} strokeDasharray="3 3"/>
        <text x={4} y={yf(goalLine)-4} textAnchor="start" fontSize={8} fontWeight={600} fill="#999">goal {goalLine}{data[0]?.unit||""}</text></>}
      {hasNeg&&<line x1={0} y1={zY} x2={W} y2={zY} stroke="#CCC" strokeWidth={0.8} strokeDasharray="3 3"/>}
      {data.map((d,i)=>{
        const bx=i*gap+(gap-bw)/2;
        const col=negColor&&d.val<0?negColor:barColor;
        const bh=Math.max(Math.abs(yf(d.val)-zY),1);
        const by=d.val>=0?yf(d.val):zY;
        const isHot = tip?.i===i;
        return <rect key={i} x={bx} y={by} width={bw} height={bh} rx={2.5} fill={col}
          opacity={isHot?1:i===data.length-1?0.9:0.55}
          onMouseEnter={()=>setTip({i, x:xc(i), y:by, text:`${d.lbl||dateLbl(d.date)}: ${Number(d.val)%1===0?d.val:Number(d.val).toFixed(1)}`})}
          style={{cursor:"default"}}/>;
      })}
      {data.map((d,i)=>{
        const n=data.length;
        const bx=xc(i);
        const DOWS=["M","T","W","T","F","S","S"];
        const lbl = d.lbl != null ? d.lbl
          : showDow && n<=7 ? DOWS[((new Date(d.date+"T00:00:00").getDay()+6)%7)]
          : dateLbl(d.date);
        const show = (() => {
          const maxLbls = 14;
          if (n <= maxLbls) return true;
          const step = Math.ceil(n / maxLbls);
          return i % step === 0 || i === n - 1;
        })();
        return show ? <text key={i} x={bx} y={H+PT+15} textAnchor="middle" fontSize={9} fill="#AAA">{lbl}</text> : null;
      })}
      {tip&&<Tooltip x={tip.x} y={tip.y} text={tip.text} W={W}/>}
    </svg>;
  }

  const wN=windowN[wWindow], vN=windowN[vWindow];
  const weightData = getField(allEntries,"weight",wN+30).slice(-wN);
  const weightAvg  = rollingAvg(weightData,wN);
  const VDOT_TYPE_GROUPS = {
    aerobic:  e => { const t=(e.type||"lower").toLowerCase(); return t.includes("long")||t.includes("easy")||t.includes("recovery"); },
    interval: e => { const t=(e.type||"lower").toLowerCase(); return t.includes("interval")||t.includes("repeat"); },
    long:     e => (e.type||"lower").toLowerCase().includes("long"),
    easy:     e => { const t=(e.type||"lower").toLowerCase(); return t.includes("easy")||t.includes("recovery"); },
  };
  const vdotRaw    = allEntries.filter(e=>e.vdot!==""&&e.vdot!=null&&!isNaN(parseFloat(e.vdot))&&VDOT_TYPE_GROUPS[vdotFilter](e));
  const vdotData   = getField(vdotRaw,"vdot",vN+30).slice(-vN);
  const vdotAvg    = rollingAvg(vdotData,vN);
  const VDOT_COLORS = { aerobic:"#A8D5B8", interval:"#F4A460", long:"#7BAFD4", easy:"#B8A8D5" };
  // 3:30 marathon → VDOT 46.5 | 5:30 mile → VDOT ~53.5
  const vdotTarget = vdotFilter==="interval" ? 53.5 : 46.5;
  const vdotTargetLabel = vdotFilter==="interval" ? "5:30mi (53.5)" : "3:30 (46.5)";
  // All history, grouped by bWindow
  const calDaily   = allEntries.filter(e=>e.calIn!==""&&e.calIn!=null).map(e=>({ date:e.dateKey, val:(parseFloat(e.calIn)||0)-(parseFloat(e.calOut)||0) }));
  const proDaily   = allEntries.filter(e=>e.protein!==""&&e.protein!=null&&parseFloat(e.protein)>0).map(e=>({ date:e.dateKey, val:parseFloat(e.protein) }));
  const slpDaily   = allEntries.filter(e=>e.sleep!==""&&e.sleep!=null&&parseFloat(e.sleep)>0).map(e=>({ date:e.dateKey, val:parseFloat(e.sleep) }));
  const hydDaily   = allEntries.filter(e=>e.hydration!==""&&e.hydration!=null&&parseFloat(e.hydration)>0).map(e=>({ date:e.dateKey, val:parseFloat(e.hydration) }));
  const calData    = groupBarData(calDaily, bWindow);
  const proteinData= groupBarData(proDaily, bWindow);
  const sleepData  = groupBarData(slpDaily, bWindow);
  const hydData    = groupBarData(hydDaily, bWindow);

  const mean = arr => arr.length ? arr.reduce((s,d)=>s+d.val,0)/arr.length : null;
  const todayW=weightData.at(-1)?.val, avgW=weightAvg.at(-1), wChg=weekChange(weightData);
  const todayV=vdotData.at(-1)?.val, avgV=vdotAvg.at(-1), vChg=weekChange(vdotData);
  const todayCal=calData.at(-1)?.val, avgCal=mean(calData);
  const todayPro=proteinData.at(-1)?.val, avgPro=mean(proteinData);
  const todaySleep=sleepData.at(-1)?.val, avgSleep=mean(sleepData);
  const todayHyd=hydData.at(-1)?.val, avgHyd=mean(hydData);

  const fmtN = (v,d=1) => v!=null ? v.toFixed(d) : "—";
  const signStr = v => v==null?"—":(v>=0?"+":"")+Math.abs(v).toFixed(1);

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>

    {/* Weight */}
    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Weight</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:"#AAA"}}>Rolling avg</span>
          <AvgToggle value={wWindow} setValue={setWWindow}/>
        </div>
      </div>
      <div style={{display:"flex",gap:14,fontSize:11,color:"#888",marginBottom:4}}>
        <span><svg width={18} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={18} y2={4} stroke="#A8D0C8" strokeWidth={2}/><circle cx={9} cy={4} r={2.5} fill="#A8D0C8"/></svg>Daily</span>
        <span><svg width={18} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={18} y2={4} stroke="#3A7BD5" strokeWidth={2.5}/></svg>7d avg</span>
      </div>
      <LineChart data={weightData} avg={weightAvg} dotColor="#A8D0C8" lineColor="#3A7BD5"/>
      {todayW!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
        Today <strong style={{color:"#1A1A1A"}}>{fmtN(todayW)} lb</strong>
        {avgW!=null&&<span> &nbsp;7d avg <strong style={{color:"#1A1A1A"}}>{fmtN(avgW)} lb</strong></span>}
        {wChg!=null&&<span style={{marginLeft:8,color:wChg<=0?"#1D9E75":"#E05C5C"}}>{wChg<=0?"↓":"↑"} {Math.abs(wChg).toFixed(1)} lb this week</span>}
      </div>}
    </div>

    {/* VDOT */}
    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Est. VDOT</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:"#AAA"}}>Rolling avg</span>
          <AvgToggle value={vWindow} setValue={setVWindow}/>
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {[["aerobic","Aerobic"],["interval","Interval"],["long","Long"],["easy","Easy"]].map(([val,lbl])=>(
          <button key={val} onClick={()=>setVdotFilter(val)} style={{fontSize:11,padding:"2px 9px",borderRadius:20,border:`1px solid ${vdotFilter===val?VDOT_COLORS[val]:"#CCC"}`,background:vdotFilter===val?VDOT_COLORS[val]:"none",color:vdotFilter===val?"#1A1A1A":"#888",cursor:"pointer",fontWeight:vdotFilter===val?600:400}}>{lbl}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:14,fontSize:11,color:"#888",marginBottom:4}}>
        <span><svg width={18} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={18} y2={4} stroke={VDOT_COLORS[vdotFilter]} strokeWidth={2}/><circle cx={9} cy={4} r={2.5} fill={VDOT_COLORS[vdotFilter]}/></svg>Per run</span>
        <span><svg width={18} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={18} y2={4} stroke="#1D7A55" strokeWidth={2.5}/></svg>{vWindow} avg</span>
        <span><svg width={18} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={18} y2={4} stroke="#E8A857" strokeWidth={1.5} strokeDasharray="4 2"/></svg>{vdotTargetLabel}</span>
      </div>
      <LineChart data={vdotData} avg={vdotAvg} targetLine={vdotTarget} targetLabel={vdotFilter==="interval"?"53.5":"46.5"} dotColor={VDOT_COLORS[vdotFilter]} lineColor="#1D7A55"/>
      {todayV!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
        Today <strong style={{color:"#1A1A1A"}}>{fmtN(todayV)}</strong>
        {avgV!=null&&<span> &nbsp;7d avg <strong style={{color:"#1A1A1A"}}>{fmtN(avgV)}</strong></span>}
        {vChg!=null&&<span style={{marginLeft:8,color:vChg>=0?"#1D9E75":"#E05C5C"}}>{vChg>=0?"↑":"↓"} {vChg>=0?"+":""}{vChg.toFixed(1)} this week</span>}
      </div>}
    </div>

    {/* Net Calories */}
    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Net calories (in − out)</span>
        <AvgToggle value={bWindow} setValue={setBWindow} options={["1d","7d","30d"]}/>
      </div>
      <div style={{display:"flex",gap:14,fontSize:11,color:"#888",marginBottom:8}}>
        <span><span style={{display:"inline-block",width:10,height:10,background:"#6BAE8A",borderRadius:2,verticalAlign:"middle",marginRight:4}}/>Surplus</span>
        <span><span style={{display:"inline-block",width:10,height:10,background:"#E07070",borderRadius:2,verticalAlign:"middle",marginRight:4}}/>Deficit</span>
      </div>
      <BarChart data={calData} barColor="#6BAE8A" negColor="#E07070" showDow={false}/>
      {todayCal!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
        Today <strong style={{color:todayCal>=0?"#1D9E75":"#E05C5C"}}>{todayCal>=0?"+":""}{Math.round(todayCal)} kcal</strong>
        {avgCal!=null&&<span> &nbsp;avg <strong style={{color:avgCal>=0?"#1D9E75":"#E05C5C"}}>{avgCal>=0?"+":""}{Math.round(avgCal)} kcal</strong></span>}
      </div>}
    </div>

    {/* Protein */}
    {[{label:"Protein",data:proteinData,color:"#8B85D4",goal:180,unit:"g",today:todayPro,avg:avgPro,dp:0},
      {label:"Sleep",data:sleepData,color:"#7DBFA0",goal:7,unit:" hr",today:todaySleep,avg:avgSleep,dp:1}
    ].map(({label,data,color,goal,unit,today,avg,dp})=>(
      <div key={label} style={cardSt}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>{label}</span>
          <AvgToggle value={bWindow} setValue={setBWindow} options={["1d","7d","30d"]}/>
        </div>
        <BarChart data={data} goalLine={goal} barColor={color} showDow={true}/>
        {today!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
          Today <strong style={{color:"#1A1A1A"}}>{today.toFixed(dp)}{unit}</strong>
          {avg!=null&&<span> · avg <strong style={{color:"#1A1A1A"}}>{avg.toFixed(dp)}{unit}</strong></span>}
        </div>}
      </div>
    ))}

    {/* Hydration */}
    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Hydration</span>
        <AvgToggle value={bWindow} setValue={setBWindow} options={["1d","7d","30d"]}/>
      </div>
      <BarChart data={hydData} goalLine={100} barColor="#5B9BD5" showDow={false}/>
      {todayHyd!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
        Today <strong style={{color:"#1A1A1A"}}>{Math.round(todayHyd)} oz</strong>
        {avgHyd!=null&&<span> · avg <strong style={{color:"#1A1A1A"}}>{Math.round(avgHyd)} oz</strong></span>}
      </div>}
    </div>

  </div>;
}

// ── Main ──────────────────────────────────────────────────────
export default function AthleteLog() {
  const [date, setDate]   = useState(new Date());
  const [entry, setEntry] = useState(emptyEntry());
  const [raw, setRaw]     = useState("");
  const [parsing, setParsing]     = useState(false);
  const [parseError, setParseError] = useState("");
  const [debugLog, setDebugLog]   = useState([]);
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [editSection, setEditSection] = useState(null);
  const [tab, setTab] = useState("log");
  const [summary, setSummary] = useState({});
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    const rebuilt = await syncSummaryFromEntries();
    setSummary(rebuilt);
    setSyncing(false);
  };

  useEffect(() => { loadSummary().then(s => setSummary(s)); }, []);

  const addDebug = useCallback(msg=>setDebugLog(l=>[...l,String(msg)]),[]);

  const loadEntry = useCallback(async d => {
    setLoading(true); setEditSection(null); setParseError(""); setDebugLog([]);
    try {
      const res = await window.storage.get(STORAGE_PREFIX+fmtKey(d));
      if (res?.value) { const e=JSON.parse(res.value); setEntry(e); setRaw(e.raw||""); }
      else { setEntry(emptyEntry()); setRaw(""); }
    } catch { setEntry(emptyEntry()); setRaw(""); }
    setLoading(false);
  }, []);

  useEffect(()=>{ loadEntry(date); }, [date, loadEntry]);

  const persist = async e => {
    const key = fmtKey(date);
    await window.storage.set(STORAGE_PREFIX+key, JSON.stringify(e));
    const newSummary = {...summary, [key]: entryToSummary(e)};
    setSummary(newSummary);
    await saveSummary(newSummary);
    setEntry(e);
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  const parseAndSave = async () => {
    if (!raw.trim()) return;
    setParsing(true); setParseError(""); setDebugLog([]);
    try {
      addDebug("Parsing...");
      const parsed = parseSnapshot(raw);
      addDebug("Type: "+parsed.workout.type);
      addDebug("VDOT: "+parsed.workout.vdot);
      addDebug("Cal in: "+parsed.metrics.calIn);
      addDebug("Secondary: "+parsed.other_activity.description);
      const fresh = {...emptyEntry(), ...parsed, raw, savedAt:new Date().toISOString()};
      const planForDay = PLAN[fmtKey(date)];
      fresh.workout_complete = planForDay
        ? matchesPlan(fresh.workout.type, planForDay.workout)
        : !!(fresh.workout.type && fresh.workout.type.toLowerCase()!=="rest");
      await persist(fresh);
      addDebug("Saved!");
      setTimeout(()=>setDebugLog([]), 3000);
    } catch(e) { setParseError("Error: "+e.message); addDebug("ERROR: "+e.message); }
    setParsing(false);
  };

  const saveEdits = async (section, data) => {
    const updated = {...entry, savedAt:new Date().toISOString()};
    updated[section] = data;
    if (section==="workout") {
      updated.workout.vdot = estimateVDOT(updated.workout);
      const planForDay = PLAN[fmtKey(date)];
      updated.workout_complete = planForDay
        ? matchesPlan(updated.workout.type, planForDay.workout)
        : !!(updated.workout.type && updated.workout.type.toLowerCase()!=="rest");
    }
    await persist(updated); setEditSection(null);
  };

  const nc = (()=>{ const i=parseFloat(entry.metrics.calIn),o=parseFloat(entry.metrics.calOut); if(isNaN(i)&&isNaN(o))return null; return(isNaN(i)?0:i)-(isNaN(o)?0:o); })();
  const hasData = !!entry.savedAt;
  const todayPlan = PLAN[fmtKey(date)];

  return <div style={{fontFamily:"system-ui,-apple-system,sans-serif",maxWidth:660,margin:"0 auto",background:"#F0EDE8",minHeight:"100vh"}}>
    <div style={{background:"#fff",borderBottom:"0.5px solid #E5E2DB",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
      <span style={{fontSize:17,fontWeight:600,color:"#1A1A1A"}}>Athlete log</span>
      <button onClick={()=>handleSync()} disabled={syncing} title="Sync from log entries" style={{background:"none",border:"none",cursor:syncing?"default":"pointer",padding:4,color:syncing?"#CCC":"#888",display:"flex",alignItems:"center"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:syncing?"spin 1s linear infinite":"none"}}><path d="M21 12a9 9 0 1 1-2.636-6.364M21 3v6h-6"/></svg>
      </button>
    </div>

    <div style={{background:"#fff",borderBottom:"0.5px solid #E5E2DB",display:"flex"}}>
      {["log","plan","dashboard","tools"].map(t=>(
        <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"11px 0",fontSize:13,fontWeight:tab===t?500:400,color:tab===t?"#1A1A1A":"#999",background:"none",border:"none",borderBottom:tab===t?"2px solid #1A1A1A":"2px solid transparent",cursor:"pointer",textTransform:"capitalize",marginBottom:-0.5}}>
          {t.charAt(0).toUpperCase()+t.slice(1)}
        </button>
      ))}
    </div>

    {tab==="log"&&<div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:"#fff",borderRadius:14,border:"0.5px solid #E5E2DB",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>{const d=new Date(date);d.setDate(d.getDate()-1);setDate(d);}} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>&#8249;</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:500,color:"#1A1A1A"}}>{fmtDisplay(date)}</div>
          {!isToday(date)&&<div onClick={()=>setDate(new Date())} style={{fontSize:11,color:"#185FA5",cursor:"pointer",marginTop:1}}>back to today</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,color:saved?"#1D9E75":"#AAA7A0"}}>{saved?"Saved":hasData?"Saved":""}</span>
          <button onClick={()=>{const d=new Date(date);d.setDate(d.getDate()+1);setDate(d);}} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>&#8250;</button>
        </div>
      </div>
      {loading?<div style={{textAlign:"center",padding:48,color:"#AAA",fontSize:14}}>Loading...</div>:<>

        <div style={cardSt}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Today's snapshot</span>
            {hasData&&<span style={{fontSize:13,color:"#AAA7A0"}}>Saved {new Date(entry.savedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
          </div>
          <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste your daily summary here..."
            style={{width:"100%",minHeight:110,background:"#F5F3EF",border:"0.5px solid #E0DDD6",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#1A1A1A",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.6,outline:"none"}}/>
          {parseError&&<div style={{fontSize:13,color:"#C0392B",marginTop:6}}>{parseError}</div>}
          {debugLog.length>0&&<div style={{marginTop:8,padding:"8px 10px",background:"#F0EDE8",borderRadius:8,fontSize:11,color:"#555",fontFamily:"monospace",lineHeight:1.8}}>{debugLog.map((l,i)=><div key={i}>{l}</div>)}</div>}
          <button onClick={parseAndSave} disabled={parsing||!raw.trim()} style={{marginTop:10,width:"100%",padding:"10px",background:parsing||!raw.trim()?"#F5F3EF":"#fff",border:"0.5px solid #D8D5CC",borderRadius:10,fontSize:14,fontWeight:500,color:parsing||!raw.trim()?"#BBB":"#1A1A1A",cursor:parsing||!raw.trim()?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            {parsing?<><Spinner/>Parsing...</>:"✦ Parse & save"}
          </button>
        </div>

        <div style={cardSt}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Today's workout</span>
            <span style={{fontSize:13,color:"#AAA7A0"}}>from plan</span>
          </div>
          {todayPlan?<div>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:10,borderBottom:"0.5px solid #EEE",marginBottom:10}}>
              <Badge type={getWorkoutType(todayPlan.workout)}/>
              <span style={{fontSize:14,color:"#1A1A1A",flex:1}}>{fmtWorkout(todayPlan.workout)}</span>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#888",flexShrink:0}}>
                <input type="checkbox" checked={!!entry.workout_complete} onChange={async e=>{
                  const updated={...entry,workout_complete:e.target.checked,savedAt:entry.savedAt||new Date().toISOString()};
                  await persist(updated);
                }} style={{width:16,height:16,cursor:"pointer",accentColor:"#1D9E75"}}/>
                Done
              </label>
            </div>
            <div style={{display:"flex",gap:8,fontSize:13}}>
              <span style={{color:"#888"}}>Week</span>
              <span style={{color:"#1A1A1A"}}>{todayPlan.label}</span>
            </div>
          </div>:<Empty text="No workout scheduled for this date."/>}
        </div>

        <EditCard title="Workout detail" id="workout" editSection={editSection} setEditSection={setEditSection}
          display={hasData&&entry.workout.type?<WorkoutDisplay w={entry.workout}/>:<Empty text="No workout logged yet — paste your summary above"/>}
          editor={<WorkoutEditor w={entry.workout} onSave={w=>saveEdits("workout",w)}/>}/>

        <EditCard title="Other activity" id="other_activity" editSection={editSection} setEditSection={setEditSection}
          display={entry.other_activity?.description?<div style={{display:"flex",gap:8,fontSize:14}}><span style={{color:"#1A1A1A"}}>{entry.other_activity.description}</span>{entry.other_activity.duration&&<span style={{color:"#AAA"}}>· {entry.other_activity.duration}</span>}</div>:<Empty text="No secondary activity logged"/>}
          editor={<OtherActivityEditor a={entry.other_activity||{description:"",duration:"",calories:""}} onSave={a=>saveEdits("other_activity",a)}/>}/>

        <EditCard title="Metrics" right="parsed from snapshot" id="metrics" editSection={editSection} setEditSection={setEditSection}
          display={<MetricsDisplay m={entry.metrics} nc={nc}/>}
          editor={<MetricsEditor m={entry.metrics} onSave={m=>saveEdits("metrics",m)}/>}/>

        <EditCard title="Food log" id="food" editSection={editSection} setEditSection={setEditSection}
          display={hasData&&(entry.food.breakfast||entry.food.lunch||entry.food.dinner||entry.food.snacks)?<FoodDisplay f={entry.food}/>:<Empty text="No food logged yet"/>}
          editor={<FoodEditor f={entry.food} onSave={f=>saveEdits("food",f)}/>}/>

        <EditCard title="Sleep notes" id="sleep_notes" editSection={editSection} setEditSection={setEditSection}
          display={entry.sleep_notes?<p style={{fontSize:14,color:"#555",lineHeight:1.7,margin:0}}>{entry.sleep_notes}</p>:<Empty text="No sleep notes logged"/>}
          editor={<JournalEditor j={entry.sleep_notes} onSave={j=>saveEdits("sleep_notes",j)}/>}/>

        <EditCard title="Energy" id="energy" editSection={editSection} setEditSection={setEditSection}
          display={entry.energy?<p style={{fontSize:14,color:"#555",lineHeight:1.7,margin:0}}>{entry.energy}</p>:<Empty text="No energy notes logged"/>}
          editor={<JournalEditor j={entry.energy} onSave={j=>saveEdits("energy",j)}/>}/>

        <EditCard title="Body" id="body" editSection={editSection} setEditSection={setEditSection}
          display={entry.body?<p style={{fontSize:14,color:"#555",lineHeight:1.7,margin:0}}>{entry.body}</p>:<Empty text="No body notes logged"/>}
          editor={<JournalEditor j={entry.body} onSave={j=>saveEdits("body",j)}/>}/>

        <EditCard title="Journal" id="journal" editSection={editSection} setEditSection={setEditSection}
          display={entry.journal?<p style={{fontSize:14,color:"#555",lineHeight:1.75,margin:0}}>{entry.journal}</p>:<Empty text="No journal entry yet"/>}
          editor={<JournalEditor j={entry.journal} onSave={j=>saveEdits("journal",j)}/>}/>
      </>}
    </div>}

    {tab==="plan"&&<PlanTab onViewLog={d=>{setDate(d);setTab("log");}} summary={summary}/>}
    {tab==="dashboard"&&<DashboardTab summary={summary}/>}
    {tab==="tools"&&<ToolsTab onImport={async()=>{ const s=await syncSummaryFromEntries(); setSummary(s); }}/>}

    <style>{"@keyframes spin{to{transform:rotate(360deg)}} textarea:focus,input:focus{outline:none;border-color:#B8B5AE!important;}"}</style>
  </div>;
}