import { useState, useEffect } from "react";
import { PLAN, getWorkoutType, TYPE_STYLE, matchesPlan, parsePlanMiles, fmtWorkout, dotLabel } from "../plan.js";
import { fmtKey, fmtDisplay, isToday, startOfWeek, addDays } from "../utils.js";
import { cardSt } from "./ui.jsx";
import { Badge } from "./ui.jsx";

const DOWS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const RACE_DATE = new Date(2026, 9, 4);

export function PlanTab({onViewLog, summary}) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [planEntries, setPlanEntries] = useState(summary || {});
  const today = new Date();

  useEffect(() => { setPlanEntries(summary || {}); }, [summary]);

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
    const missed = past && plan && !logged && type!=="rest";
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

  const daysToRace = Math.ceil((RACE_DATE - new Date(new Date().toDateString())) / 86400000);
  const weeksToRace = Math.floor(daysToRace / 7);
  const planKeys = Object.keys(PLAN);
  const totalPlannedWorkouts = planKeys.filter(k=>{ const t=getWorkoutType(PLAN[k].workout); return t!=="rest"; }).length;
  const totalPlannedMiles = planKeys.reduce((s,k)=>s+parsePlanMiles(PLAN[k].workout),0);
  const totalLoggedWorkouts = Object.values(planEntries).filter(e=>e?.workout_complete).length;
  const totalLoggedMiles = Object.values(planEntries).reduce((s,e)=>s+(e?.distance||0),0);
  const weekPlannedMiles = weekDays.reduce((s,d)=>s+parsePlanMiles(PLAN[fmtKey(d)]?.workout||""),0);
  const weekLoggedMiles = weekDays.reduce((s,d)=>{ const e=planEntries[fmtKey(d)]; return s+(e?.distance||0); },0);
  const weekPlannedWorkouts = weekDays.filter(d=>{ const p=PLAN[fmtKey(d)]; if(!p) return false; const t=getWorkoutType(p.workout); return t!=="rest"; }).length;
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
          return calWeeks.map((days,wi)=>(
            <div key={wi} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4,paddingBottom:4,borderBottom:wi<calWeeks.length-1?"0.5px solid #F0EDE8":"none"}}>
              {days.map((day,idx)=><DotRow key={fmtKey(day)} day={day} idx={idx} inMonth={day.getMonth()===calMonth.getMonth()}/>)}
            </div>
          ));
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
