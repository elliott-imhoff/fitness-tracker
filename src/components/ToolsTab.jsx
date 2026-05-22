import { useState } from "react";
import { fmtKey, fmtDisplay, startOfWeek, addDays } from "../utils.js";
import { fmtPlanWorkout } from "../plan.js";
import { cardSt, inputSt } from "./ui.jsx";
import { SNAPSHOT_SCHEMA_PROMPT } from "../schema.js";

function planToWeekSchedule(plan) {
  const byLabel = {};
  const DOW_IDX = {"Sun":0,"Mon":1,"Tue":2,"Wed":3,"Thu":4,"Fri":5,"Sat":6};
  const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  Object.entries(plan).forEach(([date, entry]) => {
    if (!byLabel[entry.label]) byLabel[entry.label] = { label:entry.label, start:date, days:{} };
    else if (date < byLabel[entry.label].start) byLabel[entry.label].start = date;
    const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(date+"T00:00:00").getDay()];
    byLabel[entry.label].days[dow] = fmtPlanWorkout(entry);
  });
  return Object.values(byLabel)
    .sort((a,b) => a.start < b.start ? -1 : 1)
    .map(w => {
      const days = DOW.map(d => w.days[d] || "Rest").join(" / ");
      return `${w.label.padEnd(12)} ${w.start}:  ${days}`;
    });
}

function buildTrackingPrompt(plan) {
  const today = new Date();
  const todayPlan = plan[fmtKey(today)];
  const currentWeekLabel = todayPlan ? todayPlan.label : "";
  const weekStart = startOfWeek(today);
  const upcomingWorkouts = Array.from({length:7},(_,i)=>addDays(weekStart,i))
    .filter(d=>d>=today)
    .map(d=>{ const p=plan[fmtKey(d)]; return p?fmtDisplay(d).split(", ")[0]+": "+fmtPlanWorkout(p):null; })
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
    "Phase 1 Wks 1-13: Mon/Wed/Fri Lift, Tue intervals/easy, Thu easy, Sat long, Sun rest",
    "Phase 2 Wks 14-22: Mon Lift, Tue intervals or easy, Wed longer easy, Thu Lift, Fri rest, Sat pace/long, Sun long","",
    "Full schedule:",
    ...planToWeekSchedule(plan),
    "",
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
    "At the end of each day output a JSON snapshot. Paste it raw — no markdown fences, no extra text.",
    "",
    SNAPSHOT_SCHEMA_PROMPT,
  ].join("\n");
}

export function ToolsTab({onSync, syncing, plan, viewMode="full", setViewMode}) {
  const P = plan || {};
  const [promptText, setPromptText] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = () => {
    try { setPromptText(buildTrackingPrompt(P)); } catch(e) { setPromptText("Error: "+e.message); }
  };
  const copy = () => {
    navigator.clipboard.writeText(promptText).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
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
