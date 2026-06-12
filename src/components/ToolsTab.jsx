import { useState } from "react";
import { fmtKey, fmtDisplay, startOfWeek, addDays, DOWS } from "../utils.js";
import { fmtPlanWorkout } from "../utils.js";
import { cardSt } from "./ui.jsx";
import { SNAPSHOT_SCHEMA_PROMPT } from "../schema.js";
import { loadEntry, recomputeAllTcx } from "../storage.js";

function planToWeekSchedule(plan) {
  const byLabel = {};
  Object.entries(plan).forEach(([date, entry]) => {
    if (!byLabel[entry.label]) byLabel[entry.label] = { label:entry.label, start:date, days:{} };
    else if (date < byLabel[entry.label].start) byLabel[entry.label].start = date;
    const dow = DOWS[(new Date(date+"T00:00:00").getDay()+6)%7];
    byLabel[entry.label].days[dow] = fmtPlanWorkout(entry);
  });
  return Object.values(byLabel)
    .sort((a,b) => a.start < b.start ? -1 : 1)
    .map(w => {
      const days = DOWS.map(d => w.days[d] || "Rest").join(" / ");
      return `${w.label.padEnd(12)} ${w.start}:  ${days}`;
    });
}

function buildTrackingPrompt(plan, planMeta={}, profile={}, recentEntries=[]) {
  const today = new Date();
  const todayPlan = plan[fmtKey(today)];
  const goalDate = planMeta.goalDate ? new Date(planMeta.goalDate+"T00:00:00") : null;
  const goalName = planMeta.goalName || "Goal race";
  const goalDateStr = goalDate ? goalDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : "TBD";
  const goalDateShort = planMeta.goalDate || "TBD";
  const planGoal = planMeta.goal || "";
  const startDate = planMeta.startDate || "";
  const planDays = Object.keys(plan).length;
  const planWeeks = Math.round(planDays / 7);
  const currentWeekLabel = todayPlan ? todayPlan.label : "";
  const weekStart = startOfWeek(today);
  const upcomingWorkouts = Array.from({length:7},(_,i)=>addDays(weekStart,i))
    .filter(d=>d>=today)
    .map(d=>{ const p=plan[fmtKey(d)]; return p?fmtDisplay(d).split(", ")[0]+": "+fmtPlanWorkout(p):null; })
    .filter(Boolean).join("\n");

  // Latest weight from recent entries (newest first), fall back to profile
  const latestWeightLb = (() => {
    for (const { entry: e } of [...recentEntries].reverse()) {
      const w = e.metrics?.weight;
      if (w != null && w !== "" && !isNaN(parseFloat(w))) return parseFloat(w);
    }
    return profile.weightLb ?? null;
  })();

  // Derived stats
  const wkg = (latestWeightLb || 0) * 0.453592;
  const bmr = (profile.age && profile.heightCm && latestWeightLb)
    ? Math.round(10 * wkg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === "female" ? -161 : 5))
    : null;
  const proteinGoal   = profile.proteinGoal;
  const hydrationGoal = profile.hydrationGoal;
  const sleepGoal     = profile.sleepGoal;
  const ct = profile.calorieTarget;
  const calAdj = profile.calAdjustment ?? 0;
  const calorieStr = ct == null ? "maintenance"
    : ct === 0  ? "even (maintenance)"
    : ct > 0    ? `surplus +${ct} kcal/day`
    :             `deficit ${ct} kcal/day`;
  const baseline = bmr ? bmr + calAdj : null;
  const calorieInstr = baseline
    ? `- Track my estimated calorie burn throughout the day in real time. Baseline burn = BMR (~${bmr} kcal) + adjustment (~${calAdj} kcal) = ~${baseline} kcal before activity. As I log workouts and activity, add estimated calories burned on top (runs: use distance × ~${Math.round((latestWeightLb||190)*0.63/10)*10} kcal/mi; lifts: ~300 kcal; other: estimate by type/duration). When I ask how many calories I have left, compute: calories remaining = (baseline + activity burned so far + ${ct} target) − cal in so far. Important: these activity calorie estimates are for intraday guidance only — do NOT include them in the snapshot JSON. The app calculates calories burned from step count at end of day.`
    : `- Track estimated calorie burn throughout the day. Baseline = BMR + adjustment before activity. Add workout/activity estimates as I log them. Do NOT include activity calorie estimates in the snapshot JSON.`;

  // Physical stats line
  const physLine = [profile.age && `${profile.age} yr`, profile.sex, profile.heightCm && (() => { const i = profile.heightCm / 2.54; return `${Math.floor(i/12)}ft ${Math.round(i%12)}in`; })(), latestWeightLb && `${latestWeightLb} lb`].filter(Boolean).join(", ");

  // Last 7 days of logs
  const recentLogLines = recentEntries.map(({ date, entry: e }) => {
    const lines = [date];
    if (e.workout && (e.workout.type || e.workout.distance)) {
      const w = e.workout;
      const wParts = [w.type, w.distance ? w.distance+" mi" : null, w.pace ? w.pace+" /mi" : null, w.hr ? "HR "+w.hr : null].filter(Boolean).join(", ");
      lines.push("  workout: "+wParts+" ["+( e.workout_status||"not logged")+"]");
      if (w.structure) lines.push("  structure: "+w.structure);
      if (w.notes) lines.push("  notes: "+w.notes);
      if (w.exercises && w.exercises.length) lines.push("  exercises: "+w.exercises.join("; "));
    }
    const m = e.metrics || {};
    if (m.calIn) {
      const calSteps = m.steps ? Math.round(parseFloat(m.steps) * (0.04 * (latestWeightLb||150) / 150)) : null;
      const net = bmr && calSteps != null ? (parseFloat(m.calIn)||0) - calSteps - bmr : null;
      lines.push("  cal in: "+m.calIn+(m.steps?", steps: "+Number(m.steps).toLocaleString():"")+( net!=null?", net: "+Math.round(net):""));
    }
    if (m.protein) lines.push("  protein: "+m.protein+"g");
    if (m.hydration) lines.push("  hydration: "+m.hydration+" oz");
    if (m.sleep) lines.push("  sleep: "+m.sleep+" hr");
    if (m.weight) lines.push("  weight: "+m.weight+" lb");
    const food = e.food || {};
    ["breakfast","lunch","snacks","dinner"].forEach(meal => {
      if (food[meal]) lines.push("  "+meal+": "+food[meal]+(food[meal+"_cal"]?" ("+food[meal+"_cal"]+" kcal"+(food[meal+"_pro"]?", "+food[meal+"_pro"]+"g protein":"")+")":""));
    });
    if (e.other_activity && e.other_activity.length) lines.push("  other activity: "+e.other_activity.map(a=>a.description+(a.duration?" "+a.duration+"min":"")).join("; "));
    if (e.journal) lines.push("  journal: "+e.journal);
    if (e.energy) lines.push("  energy: "+e.energy);
    return lines.join("\n");
  });

  return [
    "CONTEXT & PURPOSE",
    `You are my daily fitness and nutrition logging assistant for a structured ${planWeeks}-week ${goalName} training plan. Throughout the day I will post my workouts, meals, and other activity as I do them. Your job is to:`,
    "- Log everything I post and keep a running record for the day",
    "- Track cumulative nutrition (calories, protein, hydration) and update totals as I log meals",
    calorieInstr,
    "- Flag patterns, concerns, or observations worth noting",
    "- Answer questions about training and nutrition in context of my goals",
    "- At the end of the day, generate a DAILY SNAPSHOT in the exact format specified at the bottom of this prompt, ready for me to copy and paste into my tracking app",
    "This chat is purely for daily logging. I have a separate app that stores my full history and visualizes trends.","",
    "WHO I AM",
    physLine,
    profile.background || "[No background set — add in Profile tab]","",
    "GOALS",
    planGoal ? `${goalName} (${goalDateStr}): ${planGoal}` : `${goalName} (${goalDateStr})`,
    profile.goals || "","",
    "CURRENT TRAINING PLAN",
    `${planWeeks}-week plan${startDate ? ", started "+startDate : ""}, race ${goalDateShort}`,
    ...(currentWeekLabel ? ["Currently " + currentWeekLabel] : []),"",
    "Full schedule:",
    ...planToWeekSchedule(plan),
    "",
    "PHYSICAL FLAGS TO MONITOR",
    profile.physicalFlags || "[No flags set — add in Profile tab]","",
    "NUTRITION CONTEXT",
    [proteinGoal!=null&&`Protein goal: ${proteinGoal}g/day`, hydrationGoal!=null&&`Hydration goal: ${hydrationGoal} oz/day`, sleepGoal!=null&&`Sleep goal: ${sleepGoal} hr/night`, `Calorie target: ${calorieStr}`, baseline&&`Daily baseline burn (BMR + adj): ~${baseline} kcal`].filter(Boolean).join(" | "),"",
    "UPCOMING WORKOUTS THIS WEEK",
    upcomingWorkouts||"[no upcoming workouts found]","",
    "RECENT LOG (last 7 days)",
    ...(recentLogLines.length ? recentLogLines : ["[no recent entries]"]),
    "",
    "---",
    "DAILY SNAPSHOT FORMAT",
    "At the end of each day output a JSON snapshot. Paste it raw — no markdown fences, no extra text.",
    "",
    SNAPSHOT_SCHEMA_PROMPT,
  ].join("\n");
}

export function ToolsTab({onSync, syncing, plan, planMeta={}, profile={}, summary={}, viewMode="full", setViewMode}) {
  const P = plan || {};
  const [promptText, setPromptText] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState(null);

  const generate = async () => {
    setGenerating(true);
    try {
      const today = new Date();
      const dates = Array.from({length: 7}, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - i); return fmtKey(d);
      });
      const entries = (await Promise.all(dates.map(async date => {
        const entry = await loadEntry(date);
        return entry ? { date, entry } : null;
      }))).filter(Boolean).reverse();
      setPromptText(buildTrackingPrompt(P, planMeta, profile, entries));
    } catch(e) { setPromptText("Error: "+e.message); }
    setGenerating(false);
  };
  const copy = () => {
    navigator.clipboard.writeText(promptText).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const handleRecompute = async () => {
    setRecomputing(true); setRecomputeResult(null);
    try {
      const r = await recomputeAllTcx();
      setRecomputeResult(r);
    } catch(e) { setRecomputeResult({ error: e.message }); }
    setRecomputing(false);
  };

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
    <div style={{...cardSt,textAlign:"center",padding:"28px 18px"}}>
      <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",marginBottom:8}}>Recompute TCX data</div>
      <p style={{fontSize:14,color:"#555",marginBottom:16,lineHeight:1.6}}>Re-parses all TCX files in data/tcx/ and rebuilds aerobic.json. Run after fixing the parser or uploading bulk files.</p>
      <button onClick={handleRecompute} disabled={recomputing} style={{padding:"10px 24px",background:recomputing?"#E5E2DB":"#1A1A1A",color:recomputing?"#BBB":"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:recomputing?"default":"pointer",display:"inline-flex",alignItems:"center",gap:7}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:recomputing?"spin 1s linear infinite":"none"}}><path d="M21 12a9 9 0 1 1-2.636-6.364M21 3v6h-6"/></svg>
        {recomputing ? "Recomputing…" : "Recompute all TCX"}
      </button>
      {recomputeResult && !recomputeResult.error && (
        <div style={{marginTop:12,fontSize:13}}>
          <span style={{color:"#1D9E75",fontWeight:500}}>{recomputeResult.recomputed.length} run{recomputeResult.recomputed.length!==1?"s":""} recomputed</span>
          {recomputeResult.errors.length > 0 && (
            <div style={{marginTop:6,color:"#C0392B"}}>{recomputeResult.errors.map(e=>`${e.date}: ${e.error}`).join(" · ")}</div>
          )}
        </div>
      )}
      {recomputeResult?.error && <div style={{marginTop:10,fontSize:13,color:"#C0392B"}}>{recomputeResult.error}</div>}
    </div>
    <div style={{...cardSt,textAlign:"center",padding:"28px 18px"}}>
      <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",marginBottom:8}}>Rebuild summary</div>
      <p style={{fontSize:14,color:"#555",marginBottom:16,lineHeight:1.6}}>Re-reads all entry files and rebuilds the summary index. Run if dashboard or plan dots look stale.</p>
      <button onClick={onSync} disabled={syncing} style={{padding:"10px 24px",background:syncing?"#E5E2DB":"#1A1A1A",color:syncing?"#BBB":"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:syncing?"default":"pointer",display:"inline-flex",alignItems:"center",gap:7}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:syncing?"spin 1s linear infinite":"none"}}><path d="M21 12a9 9 0 1 1-2.636-6.364M21 3v6h-6"/></svg>
        {syncing ? "Rebuilding…" : "Rebuild summary"}
      </button>
    </div>
    {!promptText
      ? <div style={{...cardSt,textAlign:"center",padding:"28px 18px"}}>
          <div style={{fontSize:15,fontWeight:600,color:"#1A1A1A",marginBottom:8}}>Tracking chat prompt</div>
          <p style={{fontSize:14,color:"#555",marginBottom:16,lineHeight:1.6}}>
            Generates a prompt for starting a new tracking chat, including your full training plan and snapshot format.
          </p>
          <button onClick={generate} disabled={generating} style={{padding:"10px 24px",background:generating?"#E5E2DB":"#1A1A1A",color:generating?"#BBB":"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:generating?"default":"pointer"}}>
            {generating ? "Loading…" : "Generate prompt"}
          </button>
        </div>
      : <div style={cardSt}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Tracking chat prompt</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={generate} disabled={generating} style={{fontSize:12,color:generating?"#CCC":"#888",background:"none",border:"0.5px solid #D8D5CC",borderRadius:8,padding:"4px 10px",cursor:generating?"default":"pointer"}}>{generating?"Loading…":"Regenerate"}</button>
              <button onClick={copy} style={{fontSize:12,color:copied?"#1D9E75":"#888",background:"none",border:"0.5px solid #D8D5CC",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>{copied?"Copied!":"Copy"}</button>
            </div>
          </div>
          <textarea value={promptText} onChange={e=>setPromptText(e.target.value)}
            style={{width:"100%",minHeight:500,background:"#F5F3EF",border:"0.5px solid #E0DDD6",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#1A1A1A",fontFamily:"monospace",resize:"vertical",boxSizing:"border-box",lineHeight:1.7,outline:"none"}}/>
        </div>
    }
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 2px"}}>
      <span style={{fontSize:11,color:"#C0BDB7"}}>Sections</span>
      <div style={{display:"flex",gap:4}}>
        {[["full","All"],["minimal","Compact"]].map(([mode,label])=>(
          <button key={mode} onClick={()=>setViewMode(mode)} style={{fontSize:11,padding:"2px 9px",borderRadius:8,border:"0.5px solid",borderColor:viewMode===mode?"#AAA7A0":"#E0DDD6",background:viewMode===mode?"#E8E5E0":"transparent",color:viewMode===mode?"#555":"#C0BDB7",cursor:"pointer"}}>{label}</button>
        ))}
      </div>
    </div>
  </div>;
}
