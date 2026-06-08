import { useState, useEffect } from "react";
import { TYPE_STYLE, dotLabel } from "../utils.js";
import { fmtKey, fmtDisplay, isToday, startOfWeek, addDays, MONTHS, DOWS } from "../utils.js";
import { cardSt, Badge } from "./ui.jsx";

export function PlanTab({onViewLog, summary, plan, planMeta={}}) {
  const P = plan || {};
  const RACE_DATE = planMeta.goalDate ? new Date(planMeta.goalDate+"T00:00:00") : null;
  const RACE_NAME = planMeta.goalName || "Race";
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [planEntries, setPlanEntries] = useState(summary || {});
  const today = new Date();

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

  </div>;
}
