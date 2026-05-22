import { useState } from "react";
import { cardSt } from "./ui.jsx";

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dateLbl(ds) {
  const d = new Date(ds + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  return d.getTime() === today.getTime() ? "Today" : MO[d.getMonth()] + " " + d.getDate();
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

function AvgToggle({ value, setValue, options }) {
  return <div style={{display:"flex",gap:4}}>
    {(options||["7d","14d","30d"]).map(o=>(
      <button key={o} onClick={()=>setValue(o)} style={{fontSize:11,padding:"2px 7px",borderRadius:20,border:"1px solid #CCC",background:value===o?"#1A1A1A":"none",color:value===o?"#FFF":"#666",cursor:"pointer",fontWeight:500}}>{o}</button>
    ))}
  </div>;
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
  const DOWS_SHORT = ["M","T","W","T","F","S","S"];
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
      const lbl = d.lbl != null ? d.lbl
        : showDow && n<=7 ? DOWS_SHORT[((new Date(d.date+"T00:00:00").getDay()+6)%7)]
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

export function DashboardTab({ summary }) {
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

  function weekChange(data) {
    if (data.length < 2) return null;
    const recent = data[data.length - 1].val;
    const ago = new Date(); ago.setDate(ago.getDate() - 7); ago.setHours(0,0,0,0);
    const base = [...data].reverse().find(d => new Date(d.date + "T00:00:00") <= ago);
    return base != null ? recent - base.val : null;
  }

  function groupBarData(daily, grouping) {
    if (!daily.length) return [];
    if (grouping === "1d") return daily.map(d => ({ ...d, lbl: null }));
    const buckets = new Map();
    const first = new Date(daily[0].date + "T00:00:00"); first.setHours(0,0,0,0);
    daily.forEach(d => {
      const dt = new Date(d.date + "T00:00:00");
      const key = grouping === "7d"
        ? String(Math.floor((dt - first) / 604800000))
        : d.date.slice(0, 7);
      if (!buckets.has(key)) buckets.set(key, { firstDate: d.date, vals: [], idx: buckets.size });
      buckets.get(key).vals.push(d.val);
    });
    return [...buckets.values()].map(b => ({
      date: b.firstDate,
      val: b.vals.reduce((s,v)=>s+v,0) / b.vals.length,
      lbl: grouping === "7d" ? `Wk ${b.idx+1}` : MO[new Date(b.firstDate+"T00:00:00").getMonth()]
    }));
  }

  const VDOT_TYPE_GROUPS = {
    aerobic:  e => { const t=(e.type||"").toLowerCase(); return t.includes("long")||t.includes("easy")||t.includes("recovery"); },
    interval: e => { const t=(e.type||"").toLowerCase(); return t.includes("interval")||t.includes("repeat"); },
    long:     e => (e.type||"").toLowerCase().includes("long"),
    easy:     e => { const t=(e.type||"").toLowerCase(); return t.includes("easy")||t.includes("recovery"); },
  };
  const VDOT_COLORS = { aerobic:"#A8D5B8", interval:"#F4A460", long:"#7BAFD4", easy:"#B8A8D5" };

  const wN=windowN[wWindow], vN=windowN[vWindow];
  const weightData = getField(allEntries,"weight",wN+30).slice(-wN);
  const weightAvg  = rollingAvg(weightData,wN);
  const vdotRaw    = allEntries.filter(e=>e.vdot!==""&&e.vdot!=null&&!isNaN(parseFloat(e.vdot))&&VDOT_TYPE_GROUPS[vdotFilter](e));
  const vdotData   = getField(vdotRaw,"vdot",vN+30).slice(-vN);
  const vdotAvg    = rollingAvg(vdotData,vN);
  const vdotTarget = vdotFilter==="interval" ? 53.5 : 46.5;
  const vdotTargetLabel = vdotFilter==="interval" ? "5:30mi (53.5)" : "3:30 (46.5)";

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

    {/* Protein & Sleep */}
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
