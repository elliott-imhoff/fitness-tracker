import { useState, useEffect } from "react";
import { TYPE_STYLE, dotLabel, fmtKey, fmtDisplay, isToday, startOfWeek, addDays, MONTHS, DOWS, parsePaceMmSs } from "../utils.js";
import { cardSt, Badge, inputSt, Tooltip, dateLbl } from "./ui.jsx";
import { loadAerobic } from "../storage.js";

function fmtPaceSec(minPerMile) {
  const m = Math.floor(minPerMile);
  const s = Math.round((minPerMile - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtHHMMSS(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const s = Math.round((totalMinutes * 60) % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function runSimulation(ef0, slope, goalPaceStr, hrCeiling) {
  const goalPaceMin = parsePaceMmSs(goalPaceStr);
  if (!goalPaceMin || !ef0 || slope == null || !hrCeiling) return null;
  const goalSpeedMph = 60 / goalPaceMin;
  const hrAtStart = goalSpeedMph / ef0;
  if (hrAtStart >= hrCeiling) {
    return { wallMile: 0, finishTime: null, paceData: [], hrData: [], warning: "Goal pace exceeds HR ceiling from the start." };
  }
  const wallMile = slope !== 0 ? (goalSpeedMph / hrCeiling - ef0) / slope : Infinity;
  const hasWall = wallMile > 0 && wallMile < 26.2;
  const step = 0.1;
  const miles = [];
  for (let d = 0; d <= 26.2 + 0.001; d += step) miles.push(Math.round(d * 100) / 100);
  let totalTimeMin = 0;
  const paceData = [], hrData = [];
  for (let i = 0; i < miles.length; i++) {
    const d = miles[i];
    const ef = Math.max(ef0 + slope * d, 0.001);
    let speed, hr;
    if (!hasWall || d <= wallMile) {
      speed = goalSpeedMph;
      hr = goalSpeedMph / ef;
    } else {
      speed = Math.max(hrCeiling * ef, 0.01);
      hr = hrCeiling;
    }
    paceData.push({ x: d, y: 60 / speed });
    hrData.push({ x: d, y: hr });
    if (i > 0) totalTimeMin += (step / speed) * 60;
  }
  return { wallMile: hasWall ? wallMile : null, finishTime: fmtHHMMSS(totalTimeMin), totalTimeMin, paceData, hrData, warning: null };
}

function SimChart({ paceData, hrData, wallMile }) {
  const [hi, setHi] = useState(null);
  const W = 300, H = 100, PT = 12, PB = 4;
  if (!paceData.length) return null;
  const n = paceData.length;
  const xf = i => (i / (n - 1)) * W;
  const paceVals = paceData.map(p => p.y);
  let pmn = Math.min(...paceVals), pmx = Math.max(...paceVals);
  const ppad = (pmx - pmn) * 0.25 || 0.2; pmn -= ppad; pmx += ppad;
  const ypf = v => PT + (1 - (v - pmn) / (pmx - pmn)) * (H - PT - PB);
  const hrVals = hrData.map(p => p.y);
  let hmn = Math.min(...hrVals), hmx = Math.max(...hrVals);
  const hpad = (hmx - hmn) * 0.25 || 5; hmn -= hpad; hmx += hpad;
  const yhf = v => PT + (1 - (v - hmn) / (hmx - hmn)) * (H - PT - PB);
  const pacePath = paceData.map((p, i) => `${i === 0 ? "M" : "L"}${xf(i).toFixed(1)},${ypf(p.y).toFixed(1)}`).join(" ");
  const hrPath   = hrData.map((p, i)   => `${i === 0 ? "M" : "L"}${xf(i).toFixed(1)},${yhf(p.y).toFixed(1)}`).join(" ");
  const wallX = wallMile != null && wallMile <= 26.2 ? xf(Math.round(wallMile / 26.2 * (n - 1))) : null;
  const xLabels = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1];
  const tipText = hi != null ? `mi ${paceData[hi].x.toFixed(1)}  pace ${fmtPaceSec(paceData[hi].y)}  HR ${Math.round(hrData[hi].y)}` : null;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 18}`} style={{ overflow: "visible", cursor: "crosshair" }}
      onMouseMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const svgX = (e.clientX - rect.left) / rect.width * W;
        setHi(Math.max(0, Math.min(n - 1, Math.round(svgX / W * (n - 1)))));
      }}
      onMouseLeave={() => setHi(null)}>
      {wallX != null && <line x1={wallX} y1={PT} x2={wallX} y2={H} stroke="#E05C5C" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />}
      {wallX != null && <text x={wallX + 3} y={PT + 9} fontSize={8.5} fill="#E05C5C">wall</text>}
      <path d={pacePath} stroke="#185FA5" strokeWidth={2} fill="none" strokeLinejoin="round" />
      <path d={hrPath}   stroke="#E05C5C" strokeWidth={2} fill="none" strokeLinejoin="round" />
      {hi != null && <line x1={xf(hi)} y1={PT} x2={xf(hi)} y2={H} stroke="#999" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.6} />}
      {xLabels.map(i => (
        <text key={i} x={xf(i)} y={H + 16} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={9} fill="#AAA">
          mi {paceData[i].x.toFixed(0)}
        </text>
      ))}
      {hi != null && tipText && <Tooltip x={xf(hi)} y={PT + 28} text={tipText} W={W} />}
      <circle cx={W - 80} cy={H - 4} r={3} fill="#185FA5" />
      <text x={W - 75} y={H - 1} fontSize={8.5} fill="#185FA5">Pace</text>
      <circle cx={W - 42} cy={H - 4} r={3} fill="#E05C5C" />
      <text x={W - 37} y={H - 1} fontSize={8.5} fill="#E05C5C">HR</text>
    </svg>
  );
}

export function PlanTab({onViewLog, summary, plan, planMeta={}}) {
  const P = plan || {};
  const RACE_DATE = planMeta.goalDate ? new Date(planMeta.goalDate+"T00:00:00") : null;
  const RACE_NAME = planMeta.goalName || "Race";
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [planEntries, setPlanEntries] = useState(summary || {});
  const today = new Date();

  // ── Simulator ────────────────────────────────────────────────────────
  const [aerobic, setAerobic] = useState({});
  const [simPace, setSimPace] = useState("8:00");
  const [simHRCeil, setSimHRCeil] = useState("170");
  const [simEF0, setSimEF0] = useState("");
  const [simSlope, setSimSlope] = useState("-0.02");
  const [simResult, setSimResult] = useState(null);

  useEffect(() => { loadAerobic().then(setAerobic); }, []);

  const allRuns = Object.values(aerobic)
    .filter(r => r.ef0 != null)
    .sort((a, b) => a.date < b.date ? -1 : 1);
  const latestFit = allRuns.at(-1);

  useEffect(() => {
    if (latestFit) setSimEF0(String(Math.round(latestFit.ef0 * 100 * 10000) / 10000));
  }, [latestFit?.date]);

  const runSim = () => {
    const ef0 = parseFloat(simEF0) / 100;
    const slope = parseFloat(simSlope) / 100;
    const hrCeil = parseFloat(simHRCeil);
    if (isNaN(ef0) || isNaN(slope) || isNaN(hrCeil) || !simPace) return;
    setSimResult(runSimulation(ef0, slope, simPace, hrCeil));
  };

  const solveCleanPace = () => {
    const ef0 = parseFloat(simEF0) / 100;
    const slope = parseFloat(simSlope) / 100;
    const hrCeil = parseFloat(simHRCeil);
    if (isNaN(ef0) || isNaN(slope) || isNaN(hrCeil)) return;
    const efAtFinish = Math.max(ef0 + slope * 26.2, 0.001);
    const cleanSpeed = hrCeil * efAtFinish;
    const paceMin = 60 / cleanSpeed;
    const m = Math.floor(paceMin);
    const s = Math.round((paceMin - m) * 60);
    const paceStr = `${m}:${String(s).padStart(2, "0")}`;
    setSimPace(paceStr);
    setSimResult(runSimulation(ef0, slope, paceStr, hrCeil));
  };

  useEffect(() => { setPlanEntries(summary || {}); }, [summary]);
  // keep month view in sync when week navigation crosses a month boundary
  useEffect(() => {
    if (calOpen) setCalMonth(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
  }, [weekStart, calOpen]);

  const weekDays = Array.from({length:7}, (_,i)=>addDays(weekStart,i));

  const isLogged   = key => !!(planEntries[key]?.savedAt);
  const isComplete = key => planEntries[key]?.workout_status === "done";
  const isSkipped  = key => planEntries[key]?.workout_status === "skipped";

  const weekLabel = weekDays.map(d=>P[fmtKey(d)]).find(p=>p)?.label || "";

  function DotRow({day, idx, inMonth=true}) {
    const key = fmtKey(day);
    const dayPlan = P[key];
    const type = dayPlan?.type || "Rest";
    const st = TYPE_STYLE[type] || TYPE_STYLE.Rest;
    const done = isComplete(key);
    const skipped = isSkipped(key);
    const logged = isLogged(key);
    const tod = isToday(day);
    const [l1,l2] = dotLabel(dayPlan);
    const past = day < today && !isToday(day);
    const missed = past && dayPlan && !logged && type!=="Rest";
    const missedLogged = past && logged && !done && !skipped && type!=="Rest";
    return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",flex:1,background:tod?"#FEF6E8":inMonth?"#FAFAF8":"transparent",padding:"4px 0"}} onClick={()=>onViewLog(day)}>
      <span style={{fontSize:10,color:tod?"#BA7517":"#AAA",height:14}}>{DOWS[idx]}</span>
      <div style={{position:"relative",width:32,height:32,flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:500,
          background:done?"#1D9E75":skipped?"#F7C1C1":missedLogged?"#EEE":logged?"#A8D5B5":missed?"#F0F0EC":tod?"#BA7517":st.bg,
          color:done?"#E1F5EE":skipped?"#A32D2D":missedLogged?"#AAA":logged?"#085041":missed?"#AAA":tod?"#FAEEDA":st.color}}>
          {day.getDate()}
        </div>
        {done&&<span style={{position:"absolute",top:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#0E7A57",border:"1.5px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700,lineHeight:1}}>✓</span>}
        {skipped&&<span style={{position:"absolute",top:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#C0392B",border:"1.5px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",fontWeight:700,lineHeight:1}}>✕</span>}
        {missedLogged&&<span style={{position:"absolute",top:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#CCC",border:"1.5px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700,lineHeight:1}}>?</span>}
        {logged&&!done&&!skipped&&!missedLogged&&<span style={{position:"absolute",top:-2,right:-2,width:12,height:12,borderRadius:"50%",background:"#5AA07A",border:"1.5px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700,lineHeight:1}}>~</span>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:28}}>
        <span style={{fontSize:9,color:tod?"#BA7517":"#AAA7A0",textAlign:"center",lineHeight:1.3}}>{l1}</span>
        {l2&&<span style={{fontSize:9,color:tod?"#BA7517":"#AAA7A0",textAlign:"center",lineHeight:1.3}}>{l2}</span>}
      </div>
    </div>;
  }

  const planDays = Object.keys(P).length;
  const daysToRace = RACE_DATE ? Math.ceil((RACE_DATE - new Date(new Date().toDateString())) / 86400000) : null;
  const weeksToRace = daysToRace != null ? Math.floor(daysToRace / 7) : null;
  const planKeys = Object.keys(P);
  const totalPlannedWorkouts = planKeys.filter(k=>P[k].type!=="Rest").length;
  const totalPlannedMiles = planKeys.reduce((s,k)=>s+(parseFloat(P[k].distance)||0),0);
  const totalLoggedWorkouts = Object.values(planEntries).filter(e=>e?.workout_status==="done").length;
  const totalLoggedMiles = Object.values(planEntries).reduce((s,e)=>s+(e?.distance||0),0);
  const weekPlannedMiles = weekDays.reduce((s,d)=>s+(parseFloat(P[fmtKey(d)]?.distance)||0),0);
  const weekLoggedMiles = weekDays.reduce((s,d)=>{ const e=planEntries[fmtKey(d)]; return s+(e?.distance||0); },0);
  const weekPlannedWorkouts = weekDays.filter(d=>{ const p=P[fmtKey(d)]; return p && p.type!=="Rest"; }).length;
  const weekLoggedWorkouts = weekDays.filter(d=>planEntries[fmtKey(d)]?.workout_status==="done").length;
  const weekMissedWorkouts = weekDays.filter(d=>{ const p=P[fmtKey(d)]; if(!p||p.type==="Rest") return false; const e=planEntries[fmtKey(d)]; const past=d<today&&!isToday(d); return past&&e?.savedAt&&e?.workout_status!=="done"; }).length;
  const totalMissedWorkouts = planKeys.filter(k=>{ if(P[k].type==="Rest") return false; const e=planEntries[k]; const d=new Date(k+"T00:00:00"); const past=d<today&&!isToday(d); return past&&e?.savedAt&&e?.workout_status!=="done"; }).length;
  const todayKey = fmtKey(new Date());
  const tomorrowKey = fmtKey(addDays(new Date(), 1));
  const todayPlanEntry = P[todayKey];
  const tomorrowPlanEntry = P[tomorrowKey];

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>

    {(todayPlanEntry||tomorrowPlanEntry)&&<div style={cardSt}>
      {[["Today",todayKey,todayPlanEntry],["Tomorrow",tomorrowKey,tomorrowPlanEntry]].map(([lbl,key,dayPlan])=>dayPlan?(
        <div key={key} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:lbl==="Today"&&tomorrowPlanEntry?"0.5px solid #EEE":"none"}}>
          <span style={{fontSize:12,color:key===todayKey?"#BA7517":"#AAA",minWidth:52,flexShrink:0,fontWeight:key===todayKey?500:400}}>{lbl}</span>
          <Badge type={dayPlan.type}/>
          <span style={{fontSize:13,color:"#1A1A1A",flex:1}}>
            {dayPlan.distance ? `${dayPlan.distance} mi · ` : ""}{dayPlan.type}{dayPlan.structure ? ` · ${dayPlan.structure}` : ""}
          </span>
          {planEntries[key]?.workout_status==="done"&&<span style={{fontSize:13,color:"#1D9E75"}}>✓</span>}
          {planEntries[key]?.workout_status==="skipped"&&<span style={{fontSize:13,color:"#C0392B"}}>✕</span>}
        </div>
      ):null)}
    </div>}

    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:2}}>
          <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>&#8249;</button>
          <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>{weekLabel||"Training plan"}</span>
          <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>&#8250;</button>
          {fmtKey(weekStart)!==fmtKey(startOfWeek(today)) &&
            <button onClick={()=>setWeekStart(startOfWeek(today))} style={{marginLeft:4,background:"#ECEAE5",border:"none",color:"#555",cursor:"pointer",fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:500,lineHeight:1.4}}>Back to current week</button>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {calOpen
            ? <div style={{display:"flex",alignItems:"center",gap:2}}>
                <button onClick={()=>setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18,padding:"0 4px"}}>&#8249;</button>
                <span style={{fontSize:13,color:"#666",fontWeight:500,width:68,textAlign:"center",display:"inline-block"}}>{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
                <button onClick={()=>setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18,padding:"0 4px"}}>&#8250;</button>
              </div>
            : <span style={{fontSize:12,color:"#AAA7A0"}}>{fmtDisplay(weekStart).split(", ")[1]} – {fmtDisplay(addDays(weekStart,6)).split(", ")[1]}</span>
          }
          <button onClick={()=>setCalOpen(!calOpen)} style={{background:"#ECEAE5",border:"none",color:"#1A1A1A",cursor:"pointer",fontSize:17,padding:"2px 8px",lineHeight:1,borderRadius:8,fontWeight:700}}>{calOpen?"▴":"▾"}</button>
        </div>
      </div>

      {!calOpen && <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4}}>
        <div style={{display:"flex",flex:1,alignItems:"flex-start",justifyContent:"space-between"}}>
          {weekDays.map((day,idx)=><DotRow key={fmtKey(day)} day={day} idx={idx} inMonth={false}/>)}
        </div>
      </div>}

      {calOpen && <div style={{marginBottom:4}}>
        {(()=>{
          const first=new Date(calMonth.getFullYear(),calMonth.getMonth(),1);
          const lastDay=new Date(calMonth.getFullYear(),calMonth.getMonth()+1,0);
          let w=startOfWeek(first);
          const calWeeks=[];
          while(w<=lastDay){calWeeks.push(Array.from({length:7},(_,i)=>addDays(w,i)));w=addDays(w,7);}
          return calWeeks.map((days,wi)=>{
            const isSelectedWeek = fmtKey(days[0])===fmtKey(weekStart);
            return (
              <div key={wi} onClick={()=>setWeekStart(days[0])} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4,cursor:"pointer",
                borderRadius:10,border:isSelectedWeek?"1px solid #C8C4BC":"1px solid transparent",
                background:"transparent",overflow:"hidden",
                boxShadow:!isSelectedWeek&&wi<calWeeks.length-1?"inset 0 -0.5px 0 #F0EDE8":"none"}}>
                {days.map((day,idx)=><DotRow key={fmtKey(day)} day={day} idx={idx} inMonth={day.getMonth()===calMonth.getMonth()}/>)}
              </div>
            );
          });
        })()}
      </div>}
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
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden",display:"flex"}}>
            <div style={{height:"100%",background:"#1D9E75",width:weekPlannedWorkouts?Math.min(100,Math.round((weekLoggedWorkouts/weekPlannedWorkouts)*100))+"%":"0%",transition:"width 0.3s"}}/>
            <div style={{height:"100%",background:"#E05C5C",width:weekPlannedWorkouts?Math.min(100,Math.round((weekMissedWorkouts/weekPlannedWorkouts)*100))+"%":"0%",transition:"width 0.3s"}}/>
          </div>
        </div>
      </div>
    </div>

    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:2}}>
        <span style={{fontSize:13,fontWeight:600,color:"#1A1A1A"}}>{RACE_NAME}</span>
        <span style={{fontSize:13,color:"#888"}}>{planMeta.goalDate ? new Date(planMeta.goalDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""}</span>
      </div>
      <div style={{fontSize:12,color:"#AAA7A0",marginBottom:12}}>{weeksToRace!=null?weeksToRace+" weeks · ":""}{daysToRace!=null?daysToRace+" days to go":""}</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:4}}>
            <span>Plan progress</span>
            <span style={{color:"#1A1A1A",fontWeight:500}}>{daysToRace!=null?Math.round((1-(daysToRace/planDays))*100)+"%":""}</span>
          </div>
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,background:"#1A1A1A",width:daysToRace!=null?Math.round((1-(daysToRace/planDays))*100)+"%":"0%"}}/>
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
          <div style={{height:5,borderRadius:4,background:"#E5E2DB",overflow:"hidden",display:"flex"}}>
            <div style={{height:"100%",background:"#1D9E75",width:totalPlannedWorkouts?Math.min(100,Math.round((totalLoggedWorkouts/totalPlannedWorkouts)*100))+"%":"0%",transition:"width 0.3s"}}/>
            <div style={{height:"100%",background:"#E05C5C",width:totalPlannedWorkouts?Math.min(100,Math.round((totalMissedWorkouts/totalPlannedWorkouts)*100))+"%":"0%",transition:"width 0.3s"}}/>
          </div>
        </div>
      </div>
    </div>

    {/* Marathon simulator */}
    <div style={cardSt}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 12 }}>Marathon simulator</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Goal pace (/mi)</label>
          <input value={simPace} onChange={e => setSimPace(e.target.value)} placeholder="mm:ss" style={inputSt} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>HR ceiling (bpm)</label>
          <input value={simHRCeil} onChange={e => setSimHRCeil(e.target.value)} type="number" style={inputSt} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>EF₀ (×100)</label>
          <input value={simEF0} onChange={e => setSimEF0(e.target.value)} type="number" step="0.001" style={inputSt} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>EF slope (/mi)</label>
          <input value={simSlope} onChange={e => setSimSlope(e.target.value)} type="number" step="0.001" style={inputSt} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={runSim} style={{ flex: 1, padding: "9px 0", background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          Simulate
        </button>
        <button onClick={solveCleanPace} title="Find the fastest pace where you finish without hitting the HR ceiling" style={{ flex: 1, padding: "9px 0", background: "#fff", color: "#1A1A1A", border: "0.5px solid #D8D5CC", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Solve clean pace
        </button>
      </div>

      {simResult && (
        <div>
          {simResult.warning
            ? <p style={{ fontSize: 13, color: "#C0392B", marginBottom: 10 }}>{simResult.warning}</p>
            : <>
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ background: "#F5F3EF", borderRadius: 10, padding: "10px 14px", flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 20, fontWeight: 500, color: "#1A1A1A" }}>{simResult.finishTime}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Finish time</div>
                  </div>
                  <div style={{ background: "#F5F3EF", borderRadius: 10, padding: "10px 14px", flex: 1, minWidth: 100 }}>
                    {simResult.wallMile != null
                      ? <>
                          <div style={{ fontSize: 20, fontWeight: 500, color: "#E05C5C" }}>mi {simResult.wallMile.toFixed(1)}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Wall (HR ceiling hit)</div>
                        </>
                      : <>
                          <div style={{ fontSize: 20, fontWeight: 500, color: "#1D9E75" }}>Clean</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>No wall at this pace</div>
                        </>
                    }
                  </div>
                  {simResult.wallMile != null && (
                    <div style={{ background: "#F5F3EF", borderRadius: 10, padding: "10px 14px", flex: 1, minWidth: 100 }}>
                      <div style={{ fontSize: 20, fontWeight: 500, color: "#1A1A1A" }}>
                        {fmtPaceSec(simResult.paceData[simResult.paceData.length - 1]?.y ?? 0)}
                      </div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Finish pace</div>
                    </div>
                  )}
                </div>
                <SimChart paceData={simResult.paceData} hrData={simResult.hrData} wallMile={simResult.wallMile} />
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "#AAA7A0" }}>
                  <span style={{ color: "#185FA5" }}>— Pace (min/mi)</span>
                  <span style={{ color: "#E05C5C" }}>— HR (bpm)</span>
                </div>
              </>
          }
        </div>
      )}

      {!simResult && latestFit && (
        <p style={{ fontSize: 12, color: "#AAA7A0", margin: 0 }}>
          EF₀ pre-filled from {dateLbl(latestFit.date)} run. Enter EF slope from the Long runs chart.
        </p>
      )}
      {!simResult && !latestFit && (
        <p style={{ fontSize: 12, color: "#AAA7A0", margin: 0 }}>
          Upload a TCX run to auto-fill EF₀. Enter EF slope from the Long runs chart.
        </p>
      )}
    </div>

  </div>;
}
