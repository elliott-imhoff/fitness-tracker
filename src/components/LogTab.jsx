import { useState, useEffect, useCallback } from "react";
import { cardSt, Spinner, Empty, Badge, EditCard, Metric, Field, TArea, saveBtnSt } from "./ui.jsx";
import { fmtKey, fmtDisplay, isToday } from "../utils.js";
import { emptyEntry, PLAN, getWorkoutType, fmtWorkout, matchesPlan } from "../plan.js";
import { entryToSummary, saveSummary, loadEntry, saveEntry } from "../storage.js";
import { validateEntry } from "../schema.js";

// --- vdot ---
const HR_REST = 58;
const HR_MAX  = 194;
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
  if (dist < 3) return "";
  const D = dist * 1609.34, T = pace * dist;
  const vdotPace = calcVDOT(D, T);
  if (isNaN(vdotPace) || vdotPace <= 0) return "";
  if (isSteady && !isNaN(hr) && hr > HR_REST && hr < HR_MAX) {
    const pctHRmax = hr / HR_MAX;
    const vo2AtPace = -4.60 + 0.182258 * (D/T) + 0.000104 * Math.pow(D/T, 2);
    const aerobicVDOT = vo2AtPace / pctHRmax;
    const capped = Math.min(Math.max(aerobicVDOT / vdotPace, 0.80), 1.25);
    return String(Math.round(vdotPace * capped * 10) / 10);
  }
  return String(Math.round(vdotPace * 10) / 10);
}

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
    <Field label="Activity" value={v.description} onChange={x=>u("description",x)} placeholder="e.g. Recreational softball"/>
    <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
      <div style={{flex:1}}><Field label="Duration" value={v.duration} onChange={x=>u("duration",x)} placeholder="36" type="number"/></div>
      <span style={{fontSize:13,color:"#888",paddingBottom:10,flexShrink:0}}>min</span>
      <div style={{flex:1}}><Field label="Calories" value={v.calories} onChange={x=>u("calories",x)} placeholder="150" type="number"/></div>
      <span style={{fontSize:13,color:"#888",paddingBottom:10,flexShrink:0}}>kcal</span>
    </div>
    <button style={saveBtnSt} onClick={()=>onSave(v)}>Save</button>
  </div>;
}

export function LogTab({ date, setDate, summary, onSummaryChange }) {
  const [entry, setEntry] = useState(emptyEntry());
  const [raw, setRaw]     = useState("");
  const [parsing, setParsing]   = useState(false);
  const [parseError, setParseError] = useState("");
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [editSection, setEditSection] = useState(null);
  const [editError, setEditError] = useState("");
  const openSection = (id) => { setEditSection(id); setEditError(""); };

  const loadEntry_ = useCallback(async d => {
    setLoading(true); setEditSection(null); setEditError(""); setParseError("");
    try {
      const e = await loadEntry(fmtKey(d));
      if (e) { setEntry(e); setRaw(e.raw || ""); }
      else { setEntry(emptyEntry()); setRaw(""); }
    } catch { setEntry(emptyEntry()); setRaw(""); }
    setLoading(false);
  }, []);

  useEffect(() => { loadEntry_(date); }, [date, loadEntry_]);

  const persist = async e => {
    const key = fmtKey(date);
    await saveEntry(key, e);
    const newSummary = { ...summary, [key]: entryToSummary(e) };
    onSummaryChange(newSummary);
    await saveSummary(newSummary);
    setEntry(e);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const parseAndSave = async () => {
    if (!raw.trim()) return;
    setParsing(true); setParseError("");
    try {
      const parsed = JSON.parse(raw);
      validateEntry(parsed);
      const fresh = { ...emptyEntry(), ...parsed, raw, savedAt: new Date().toISOString() };
      fresh.workout.vdot = estimateVDOT(fresh.workout);
      const planForDay = PLAN[fmtKey(date)];
      fresh.workout_complete = planForDay
        ? matchesPlan(fresh.workout.type, planForDay.workout)
        : !!(fresh.workout.type && fresh.workout.type.toLowerCase() !== "rest");
      await persist(fresh);
    } catch(e) { setParseError(e.message); }
    setParsing(false);
  };

  const saveEdits = async (section, data) => {
    const updated = { ...entry, savedAt: new Date().toISOString() };
    updated[section] = data;
    if (section === "workout") {
      updated.workout.vdot = estimateVDOT(updated.workout);
      const planForDay = PLAN[fmtKey(date)];
      updated.workout_complete = planForDay
        ? matchesPlan(updated.workout.type, planForDay.workout)
        : !!(updated.workout.type && updated.workout.type.toLowerCase() !== "rest");
    }
    try {
      validateEntry(updated);
    } catch(e) {
      setEditError(e.message);
      return;
    }
    await persist(updated); setEditSection(null); setEditError("");
  };

  const nc = (() => { const i = parseFloat(entry.metrics.calIn), o = parseFloat(entry.metrics.calOut); if (isNaN(i) && isNaN(o)) return null; return (isNaN(i) ? 0 : i) - (isNaN(o) ? 0 : o); })();
  const hasData = !!entry.savedAt;
  const todayPlan = PLAN[fmtKey(date)];

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
    <div style={{background:"#fff",borderRadius:14,border:"0.5px solid #E5E2DB",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <button onClick={() => { const d = new Date(date); d.setDate(d.getDate()-1); setDate(d); }} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>&#8249;</button>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:500,color:"#1A1A1A"}}>{fmtDisplay(date)}</div>
        {!isToday(date) && <div onClick={() => setDate(new Date())} style={{fontSize:11,color:"#185FA5",cursor:"pointer",marginTop:1}}>back to today</div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13,color:saved?"#1D9E75":"#AAA7A0"}}>{saved ? "Saved" : hasData ? "Saved" : ""}</span>
        <button onClick={() => { const d = new Date(date); d.setDate(d.getDate()+1); setDate(d); }} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>&#8250;</button>
      </div>
    </div>

    {loading ? <div style={{textAlign:"center",padding:48,color:"#AAA",fontSize:14}}>Loading...</div> : <>

      <div style={cardSt}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Today's snapshot</span>
          {hasData && <span style={{fontSize:13,color:"#AAA7A0"}}>Saved {new Date(entry.savedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
        </div>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder="Paste your daily summary here..."
          style={{width:"100%",minHeight:110,background:"#F5F3EF",border:"0.5px solid #E0DDD6",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#1A1A1A",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.6,outline:"none"}}/>
        {parseError && <div style={{fontSize:13,color:"#C0392B",marginTop:6}}>{parseError}</div>}
        <button onClick={parseAndSave} disabled={parsing || !raw.trim()} style={{marginTop:10,width:"100%",padding:"10px",background:parsing||!raw.trim()?"#F5F3EF":"#fff",border:"0.5px solid #D8D5CC",borderRadius:10,fontSize:14,fontWeight:500,color:parsing||!raw.trim()?"#BBB":"#1A1A1A",cursor:parsing||!raw.trim()?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          {parsing ? <><Spinner/>Parsing...</> : "✦ Parse & save"}
        </button>
      </div>

      <div style={cardSt}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Today's workout</span>
          <span style={{fontSize:13,color:"#AAA7A0"}}>from plan</span>
        </div>
        {todayPlan ? <div>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:10,borderBottom:"0.5px solid #EEE",marginBottom:10}}>
            <Badge type={getWorkoutType(todayPlan.workout)}/>
            <span style={{fontSize:14,color:"#1A1A1A",flex:1}}>{fmtWorkout(todayPlan.workout)}</span>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#888",flexShrink:0}}>
              <input type="checkbox" checked={!!entry.workout_complete} onChange={async e => {
                const updated = { ...entry, workout_complete: e.target.checked, savedAt: entry.savedAt || new Date().toISOString() };
                await persist(updated);
              }} style={{width:16,height:16,cursor:"pointer",accentColor:"#1D9E75"}}/>
              Done
            </label>
          </div>
          <div style={{display:"flex",gap:8,fontSize:13}}>
            <span style={{color:"#888"}}>Week</span>
            <span style={{color:"#1A1A1A"}}>{todayPlan.label}</span>
          </div>
        </div> : <Empty text="No workout scheduled for this date."/>}
      </div>

      <EditCard title="Workout detail" id="workout" editSection={editSection} setEditSection={openSection} error={editError}
        display={hasData && entry.workout.type ? <WorkoutDisplay w={entry.workout}/> : <Empty text="No workout logged yet — paste your summary above"/>}
        editor={<WorkoutEditor w={entry.workout} onSave={w => saveEdits("workout", w)}/>}/>

      <EditCard title="Other activity" id="other_activity" editSection={editSection} setEditSection={openSection} error={editError}
        display={entry.other_activity?.description
          ? <div style={{display:"flex",gap:8,fontSize:14,flexWrap:"wrap"}}>
              <span style={{color:"#1A1A1A"}}>{entry.other_activity.description}</span>
              {entry.other_activity.duration && <span style={{color:"#AAA"}}>· {entry.other_activity.duration} min</span>}
              {entry.other_activity.calories && <span style={{color:"#AAA"}}>· {entry.other_activity.calories} kcal</span>}
            </div>
          : <Empty text="No secondary activity logged"/>}
        editor={<OtherActivityEditor a={entry.other_activity || {description:"",duration:"",calories:""}} onSave={a => saveEdits("other_activity", a)}/>}/>

      <EditCard title="Metrics" right="parsed from snapshot" id="metrics" editSection={editSection} setEditSection={openSection} error={editError}
        display={<MetricsDisplay m={entry.metrics} nc={nc}/>}
        editor={<MetricsEditor m={entry.metrics} onSave={m => saveEdits("metrics", m)}/>}/>

      <EditCard title="Food log" id="food" editSection={editSection} setEditSection={openSection} error={editError}
        display={hasData && (entry.food.breakfast || entry.food.lunch || entry.food.dinner || entry.food.snacks) ? <FoodDisplay f={entry.food}/> : <Empty text="No food logged yet"/>}
        editor={<FoodEditor f={entry.food} onSave={f => saveEdits("food", f)}/>}/>

      <EditCard title="Sleep notes" id="sleep_notes" editSection={editSection} setEditSection={openSection} error={editError}
        display={entry.sleep_notes ? <p style={{fontSize:14,color:"#555",lineHeight:1.7,margin:0}}>{entry.sleep_notes}</p> : <Empty text="No sleep notes logged"/>}
        editor={<JournalEditor j={entry.sleep_notes} onSave={j => saveEdits("sleep_notes", j)}/>}/>

      <EditCard title="Energy" id="energy" editSection={editSection} setEditSection={openSection} error={editError}
        display={entry.energy ? <p style={{fontSize:14,color:"#555",lineHeight:1.7,margin:0}}>{entry.energy}</p> : <Empty text="No energy notes logged"/>}
        editor={<JournalEditor j={entry.energy} onSave={j => saveEdits("energy", j)}/>}/>

      <EditCard title="Body" id="body" editSection={editSection} setEditSection={openSection} error={editError}
        display={entry.body ? <p style={{fontSize:14,color:"#555",lineHeight:1.7,margin:0}}>{entry.body}</p> : <Empty text="No body notes logged"/>}
        editor={<JournalEditor j={entry.body} onSave={j => saveEdits("body", j)}/>}/>

      <EditCard title="Journal" id="journal" editSection={editSection} setEditSection={openSection} error={editError}
        display={entry.journal ? <p style={{fontSize:14,color:"#555",lineHeight:1.75,margin:0}}>{entry.journal}</p> : <Empty text="No journal entry yet"/>}
        editor={<JournalEditor j={entry.journal} onSave={j => saveEdits("journal", j)}/>}/>
    </>}
  </div>;
}
