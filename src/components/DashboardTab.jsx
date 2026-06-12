import { useState, useEffect, useRef } from "react";
import { cardSt, Tooltip, dateLbl } from "./ui.jsx";
import { MONTHS, parsePaceMmSs } from "../utils.js";
import { loadAerobic } from "../storage.js";

function AvgToggle({ value, setValue, options }) {
  return <div style={{display:"flex",gap:4}}>
    {(options||["7d","14d","30d"]).map(o=>(
      <button key={o} onClick={()=>setValue(o)} style={{fontSize:11,padding:"2px 7px",borderRadius:20,border:"1px solid #CCC",background:value===o?"#1A1A1A":"none",color:value===o?"#FFF":"#666",cursor:"pointer",fontWeight:500}}>{o}</button>
    ))}
  </div>;
}

function LineChart({ data, avg = [], trend, dotColor = "#185FA5", lineColor = "#185FA5" }) {
  const [hi, setHi] = useState(null);
  const W = 300, H = 80, PT = 10, PB = 4;
  if (!data.length) return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 18}`}>
      <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="#CCC">No data</text>
    </svg>
  );
  const n = data.length;
  const vals = data.map(d => d.val);
  const allV = [...vals, ...(trend || [])];
  let mn = Math.min(...allV), mx = Math.max(...allV);
  const pad = (mx - mn) * 0.3 || 2; mn -= pad; mx += pad;
  const xf = i => n < 2 ? W / 2 : (i / (n - 1)) * W;
  const yf = v => PT + (1 - (v - mn) / (mx - mn)) * (H - PT - PB);
  const avgPath = avg.map((a, i) => `${i === 0 ? "M" : "L"}${xf(i).toFixed(1)},${yf(a).toFixed(1)}`).join(" ");
  const trendPath = trend && trend.length >= 2
    ? `M${xf(0).toFixed(1)},${yf(trend[0]).toFixed(1)} L${xf(n - 1).toFixed(1)},${yf(trend[n - 1]).toFixed(1)}`
    : null;
  const lblIdx = n <= 1 ? [0] : n <= 4 ? [0, n - 1] : [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1];
  const uniq = [...new Set(lblIdx)];
  const handleMouseMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * W;
    setHi(n < 2 ? 0 : Math.max(0, Math.min(n - 1, Math.round(svgX / W * (n - 1)))));
  };
  const tipText = hi != null ? (() => {
    const parts = [`${dateLbl(data[hi].date)}: ${data[hi].val.toFixed(1)}`];
    if (avg[hi] != null) parts.push(`avg ${avg[hi].toFixed(1)}`);
    if (trend?.[hi] != null) parts.push(`trend ${trend[hi].toFixed(1)}`);
    return parts.join("  ·  ");
  })() : null;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 18}`} style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHi(null)}>
      {trendPath && <path d={trendPath} stroke="#E05C5C" strokeWidth={1.5} fill="none" strokeDasharray="5 3" opacity={0.7} />}
      <path d={avgPath} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xf(i)} cy={yf(d.val)} r={hi === i ? 5 : 2.5} fill={dotColor} opacity={hi === i ? 1 : 0.75} style={{ transition: "r 0.1s" }} />
      ))}
      {hi != null && <line x1={xf(hi)} y1={PT} x2={xf(hi)} y2={H} stroke="#999" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.6} />}
      {hi != null && avg[hi] != null && <circle cx={xf(hi)} cy={yf(avg[hi])} r={4} fill={lineColor} opacity={0.9} />}
      {hi != null && trend?.[hi] != null && <circle cx={xf(hi)} cy={yf(trend[hi])} r={3.5} fill="#E05C5C" opacity={0.9} />}
      {uniq.map(i => (
        <text key={i} x={xf(i)} y={H + 16} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={9} fill="#AAA">
          {dateLbl(data[i].date)}
        </text>
      ))}
      {hi != null && tipText && <Tooltip x={xf(hi)} y={PT + 28} text={tipText} W={W} />}
    </svg>
  );
}

export function BarChart({ data, goalLine, barColor, negColor, showDow }) {
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
        style={{cursor:"default"}}/> ;
    })}
    {data.map((d,i)=>{
      const n=data.length;
      const bx=xc(i);
      const lbl = d.lbl != null ? d.lbl
        : showDow && n<=7 ? DOWS_SHORT[((new Date(d.date+"T00:00:00").getDay()+6)%7)]
        : dateLbl(d.date);
      const show = (() => {
        const maxLbls = 6;
        if (n <= maxLbls) return true;
        const count = Math.min(maxLbls, n);
        const ticks = Array.from({length: count}, (_, k) => Math.round(k * (n - 1) / (count - 1)));
        return ticks.includes(i);
      })();
      return show ? <text key={i} x={bx} y={H+PT+15} textAnchor="middle" fontSize={9} fill="#AAA">{lbl}</text> : null;
    })}
    {tip&&<Tooltip x={tip.x} y={tip.y} text={tip.text} W={W}/>}
  </svg>;
}

function CalorieGroupChart({ data, goalNet=0 }) {
  const [tip, setTip] = useState(null);
  const W=280, H=90, PT=14;
  if (!data.length) return <svg width="100%" viewBox={`0 0 ${W} ${H+PT+18}`}><text x={W/2} y={(H+PT)/2} textAnchor="middle" fontSize={11} fill="#CCC">No data</text></svg>;
  const n = data.length;
  const allVals = data.flatMap(d=>[d.calIn,d.calOut,d.net]).filter(v=>!isNaN(v)&&v!=null);
  const rawMax=Math.max(...allVals,1), rawMin=Math.min(...allVals,0,goalNet);
  const buf=(rawMax-rawMin)*0.06||50;
  const mx=rawMax+buf, mn=rawMin-buf, range=mx-mn||1;
  const groupW=W/n, barW=Math.max(1.5, groupW*0.24);
  const xg=i=>(i+0.5)*groupW;
  const yf=v=>PT+H*(1-(v-mn)/range);
  const zY=yf(0);
  const BARS=[{f:"calIn",color:"#5B9BD5",lbl:"In"},{f:"calOut",color:"#E8A857",lbl:"Out"},{f:"net",lbl:"Net"}];
  const count=Math.min(6,n);
  const ticks=n<=count?Array.from({length:n},(_,k)=>k):Array.from({length:count},(_,k)=>Math.round(k*(n-1)/(count-1)));
  const goalY = yf(goalNet);
  return <svg width="100%" viewBox={`0 0 ${W} ${H+PT+18}`} style={{overflow:"visible"}} onMouseLeave={()=>setTip(null)}>
    <line x1={0} y1={zY} x2={W} y2={zY} stroke="#DDD" strokeWidth={0.8} strokeDasharray="3 3"/>
    {goalNet!==0&&<><line x1={0} y1={goalY} x2={W} y2={goalY} stroke="#6BAE8A" strokeWidth={1} strokeDasharray="4 3" opacity={0.7}/>
    <text x={4} y={goalY+10} textAnchor="start" fontSize={8} fontWeight={600} fill="#6BAE8A" opacity={0.9}>goal {goalNet>0?"+":""}{goalNet}</text></>}
    {data.map((d,i)=>{
      const cx=xg(i);
      return <g key={i}>{BARS.map(({f,color,lbl},bi)=>{
        const val=d[f]; if(val==null||isNaN(val)) return null;
        const col=f==="net"?(val>=0?"#6BAE8A":"#E07070"):color;
        const bx=cx+(bi-1)*(barW+1.5)-barW/2;
        const by=val>=0?yf(val):zY, bh=Math.max(1,Math.abs(yf(val)-zY));
        const isHot=tip?.i===i&&tip?.bi===bi;
        return <rect key={bi} x={bx} y={by} width={barW} height={bh} rx={1} fill={col}
          opacity={isHot?1:i===n-1?0.9:0.6}
          onMouseEnter={()=>setTip({i,bi,x:bx+barW/2,y:by,text:`${d.lbl||dateLbl(d.date)} ${lbl}: ${Math.round(val)}`})}
          style={{cursor:"default"}}/>;
      })}</g>;
    })}
    {ticks.map(i=><text key={i} x={xg(i)} y={H+PT+15} textAnchor="middle" fontSize={9} fill="#AAA">{data[i].lbl||dateLbl(data[i].date)}</text>)}
    {tip&&<Tooltip x={tip.x} y={tip.y} text={tip.text} W={W}/>}
  </svg>;
}

function olsLinearTrend(vals) {
  const n = vals.length;
  if (n < 2) return [...vals];
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = vals.reduce((a, b) => a + b, 0);
  const sumXY = vals.reduce((sum, v, i) => sum + i * v, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return vals.map((_, i) => intercept + slope * i);
}

const MODE_CFG = {
  ef:   { label: "EF",   color: "#185FA5" },
  pace: { label: "Pace", color: "#1D9E75" },
  hr:   { label: "HR",   color: "#E05C5C" },
};

const RUN_COLORS = ["#185FA5","#E05C5C","#1D9E75","#E8A857","#7B5EA7","#0C8A8A","#C0392B","#888"];

function RunSplitChart({ runs }) {
  const [hi, setHi] = useState(null); // hovered mile number
  const [mode, setMode] = useState("ef");
  const W = 300, H = 90, PT = 10, PB = 4;
  // Drop mile 1 — it's noisy (GPS settle, warm-up surge, etc.)
  const trimmedRuns = runs.map(r => ({ ...r, mileSplits: r.mileSplits.filter(s => s.mile > 1) }));
  if (!trimmedRuns.length || !trimmedRuns[0].mileSplits?.length) return null;
  const getVal = s => mode === "ef" ? s.ef * 100 : mode === "pace" ? (parsePaceMmSs(s.pace) ?? 0) : s.avgHR;
  const maxMile = Math.max(...trimmedRuns.flatMap(r => r.mileSplits.map(s => s.mile)));
  const minMile = Math.min(...trimmedRuns.flatMap(r => r.mileSplits.map(s => s.mile)));
  const xf = mile => maxMile <= minMile ? W / 2 : ((mile - minMile) / (maxMile - minMile)) * W;
  const allTrends = trimmedRuns.flatMap(r => { const t = olsLinearTrend(r.mileSplits.map(getVal)); return [t[0], t[t.length-1]]; });
  const allVals = trimmedRuns.flatMap(r => r.mileSplits.map(getVal));
  let mn = Math.min(...allVals, ...allTrends), mx = Math.max(...allVals, ...allTrends);
  const pad = (mx - mn) * 0.25 || 0.001; mn -= pad; mx += pad;
  const yf = v => PT + (1 - (v - mn) / (mx - mn)) * (H - PT - PB);
  const handleMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * W;
    let bestMile = null, bestDist = Infinity;
    for (let m = minMile; m <= maxMile; m++) {
      const dx = Math.abs(xf(m) - svgX);
      if (dx < bestDist) { bestDist = dx; bestMile = m; }
    }
    setHi(bestMile);
  };
  const hiX = hi != null ? xf(hi) : null;
  // All runs' splits at the hovered mile
  const hiSplits = hi != null
    ? trimmedRuns.map((r, ri) => ({ ri, s: r.mileSplits.find(s => s.mile === hi) })).filter(x => x.s)
    : [];
  const fmtModeVal = s => mode === "ef" ? (s.ef * 100).toFixed(3)
    : mode === "pace" ? s.pace + "/mi"
    : Math.round(s.avgHR) + " bpm";
  const runMeta = trimmedRuns.map((r, ri) => {
    const vals = r.mileSplits.map(getVal);
    const t = olsLinearTrend(vals);
    const slope = vals.length >= 2 ? (t[t.length - 1] - t[0]) / (vals.length - 1) : 0;
    const good = mode === "ef" ? slope >= 0 : slope <= 0;
    const slopeText = mode === "ef" ? `${slope >= 0 ? "+" : ""}${slope.toFixed(3)}/mi`
      : mode === "pace" ? `${slope * 60 >= 0 ? "+" : ""}${Math.round(slope * 60)} sec/mi`
      : `${slope >= 0 ? "+" : ""}${slope.toFixed(1)} bpm/mi`;
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const avgText = avg == null ? null
      : mode === "ef" ? `avg ${avg.toFixed(3)}`
      : mode === "pace" ? (() => { const m = Math.floor(avg); return `avg ${m}:${String(Math.round((avg - m) * 60)).padStart(2, "0")}/mi`; })()
      : `avg ${Math.round(avg)} bpm`;
    const intercept = t[0]; // fitted value at mile minMile
    const interceptText = mode === "ef" ? `Start: ${intercept.toFixed(3)}`
      : mode === "pace" ? (() => { const m = Math.floor(intercept); return `Start: ${m}:${String(Math.round((intercept - m) * 60)).padStart(2, "0")}/mi`; })()
      : `Start: ${Math.round(intercept)} bpm`;
    return { color: RUN_COLORS[ri % RUN_COLORS.length], trend: t, slope, good, slopeText, avgText, interceptText };
  });
  const xLabels = Array.from({ length: maxMile - minMile + 1 }, (_, i) => i + minMile);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {Object.entries(MODE_CFG).map(([key, c]) => (
          <button key={key} onClick={() => { setMode(key); setHi(null); }}
            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20,
              border: `1px solid ${mode === key ? c.color : "#CCC"}`,
              background: mode === key ? c.color : "none",
              color: mode === key ? "#FFF" : "#666", cursor: "pointer", fontWeight: 500 }}>
            {c.label}
          </button>
        ))}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 30}`} style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMove} onMouseLeave={() => setHi(null)}>
        {hiX != null && <line x1={hiX} y1={PT} x2={hiX} y2={H} stroke="#999" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.6} />}
        {trimmedRuns.map((r, ri) => {
          const { color, trend } = runMeta[ri];
          const x0 = xf(r.mileSplits[0].mile), x1 = xf(r.mileSplits[r.mileSplits.length - 1].mile);
          const linePath = r.mileSplits.map((s, i) => `${i === 0 ? "M" : "L"}${xf(s.mile).toFixed(1)},${yf(getVal(s)).toFixed(1)}`).join(" ");
          return (
            <g key={ri}>
              <line x1={x0} y1={yf(trend[0])} x2={x1} y2={yf(trend[trend.length - 1])}
                stroke={color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.55} />
              <path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" opacity={0.85} />
              {r.mileSplits.map((s, si) => (
                <circle key={si} cx={xf(s.mile)} cy={yf(getVal(s))} r={s.mile === hi ? 6 : 3}
                  fill={color} opacity={s.mile === hi ? 1 : 0.8} style={{ transition: "r 0.1s" }} />
              ))}
            </g>
          );
        })}
        {xLabels.map(m => (
          <text key={m} x={xf(m)} y={H + 16} textAnchor={m === minMile ? "start" : m === maxMile ? "end" : "middle"} fontSize={9} fill="#AAA">{m}</text>
        ))}
        <text x={W / 2} y={H + 27} textAnchor="middle" fontSize={8} fill="#CCC" fontStyle="italic">mile</text>
        {hiSplits.length > 0 && (() => {
          const lineH = 14, vpad = 5, hpad = 8, dotR = 3, dotGap = 10;
          const tipLines = hiSplits.map(({ ri, s }) => ({
            color: runMeta[ri].color,
            text: `${trimmedRuns.length > 1 ? dateLbl(trimmedRuns[ri].date) + "  " : `mi ${hi}  `}${fmtModeVal(s)}`,
          }));
          const tw = Math.max(...tipLines.map(l => l.text.length)) * 5.8 + hpad * 2 + dotGap + dotR * 2;
          const th = tipLines.length * lineH + vpad * 2;
          const tx = Math.min(Math.max(hiX - tw / 2, 2), W - tw - 2);
          const ty = Math.min(PT + 4, H - th - 4);
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={tw} height={th} rx={4} fill="#1A1A1A" opacity={0.88} />
              {tipLines.map(({ color, text }, i) => (
                <g key={i}>
                  <circle cx={tx + hpad + dotR} cy={ty + vpad + i * lineH + lineH / 2} r={dotR} fill={color} />
                  <text x={tx + hpad + dotGap} y={ty + vpad + i * lineH + lineH * 0.72} fontSize={9.5} fill="#FFF" fontWeight={500}>{text}</text>
                </g>
              ))}
            </g>
          );
        })()}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {trimmedRuns.map((r, ri) => {
          const { color, good, slopeText, avgText, interceptText } = runMeta[ri];
          return (
            <div key={r.date} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <svg width="16" height="8" style={{ flexShrink: 0 }}><line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" /><circle cx="8" cy="4" r="2.5" fill={color} /></svg>
              <span style={{ fontSize: 12, color: "#555", minWidth: 56 }}>{dateLbl(r.date)}</span>
              {r.distance != null && <span style={{ fontSize: 12, color: "#888" }}>{r.distance} mi</span>}
              {avgText && <span style={{ fontSize: 12, color: "#888" }}><strong style={{ color: "#1A1A1A" }}>{avgText}</strong></span>}
              <span style={{ fontSize: 12, color: "#888" }}>Trend <strong style={{ color: good ? "#1D9E75" : "#E05C5C" }}>{slopeText}</strong></span>
              <span style={{ fontSize: 12, color: "#888" }}><strong style={{ color: "#1A1A1A" }}>{interceptText}</strong></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardTab({ summary, profile={} }) {
  const [bWindow, setBWindow] = useState("1d");

  // ── Aerobic / Long runs ───────────────────────────────────────────────────
  const [aerobic, setAerobic] = useState({});
  const [selectedDates, setSelectedDates] = useState(null);
  const [runDropdownOpen, setRunDropdownOpen] = useState(false);
  const runDropdownRef = useRef(null);

  useEffect(() => { loadAerobic().then(setAerobic); }, []);

  const allRuns = Object.values(aerobic)
    .filter(r => r.mileSplits && r.mileSplits.length > 0)
    .sort((a, b) => a.date < b.date ? -1 : 1);

  useEffect(() => {
    if (selectedDates === null && allRuns.length) {
      setSelectedDates(new Set([allRuns[allRuns.length - 1].date]));
    }
  }, [allRuns.length, selectedDates]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (runDropdownRef.current && !runDropdownRef.current.contains(e.target)) {
        setRunDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDate = date => {
    setSelectedDates(prev => {
      const next = new Set(prev ?? []);
      if (next.has(date)) { next.delete(date); } else { next.add(date); }
      return next;
    });
  };

  const selectedRuns = allRuns.filter(r => selectedDates?.has(r.date));

  const allEntries = Object.entries(summary)
    .filter(([,e]) => e && e.savedAt)
    .sort(([a],[b]) => a < b ? -1 : 1)
    .map(([key, e]) => ({ ...e, dateKey: key }));

  function getField(arr, field, n) {
    return arr
      .filter(e => e[field] != null && !isNaN(parseFloat(e[field])))
      .slice(-n)
      .map(e => ({ date: e.dateKey, val: parseFloat(e[field]) }));
  }

  function rollingAvg(data, n) {
    return data.map((_, i) => {
      const slice = data.slice(Math.max(0, i - n + 1), i + 1);
      return slice.reduce((s, x) => s + x.val, 0) / slice.length;
    });
  }

  function lrFit(data) {
    if (data.length < 3) return null;
    const n = data.length;
    const t0 = new Date(data[0].date + "T00:00:00").getTime();
    const xs = data.map(d => (new Date(d.date + "T00:00:00").getTime() - t0) / 86400000);
    const ys = data.map(d => d.val);
    const mx = xs.reduce((s,x)=>s+x,0)/n;
    const my = ys.reduce((s,y)=>s+y,0)/n;
    const num = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
    const den = xs.reduce((s,x)=>s+(x-mx)**2,0);
    if (den === 0) return null;
    const slope = num/den; // lb/day
    const intercept = my - slope * mx;
    return { slopePerWeek: slope * 7, fitted: xs.map(x => intercept + slope * x) };
  }

  function weekChange(data, days=7) {
    if (data.length < 2) return null;
    const recent = data[data.length - 1].val;
    const ago = new Date(); ago.setDate(ago.getDate() - days); ago.setHours(0,0,0,0);
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
      lbl: grouping === "7d" ? `Wk ${b.idx+1}` : MONTHS[new Date(b.firstDate+"T00:00:00").getMonth()]
    }));
  }

  function groupCalData(daily, grouping) {
    if (!daily.length) return [];
    if (grouping === "1d") return daily.map(d => ({ ...d, lbl: null }));
    const buckets = new Map();
    const first = new Date(daily[0].date + "T00:00:00"); first.setHours(0,0,0,0);
    daily.forEach(d => {
      const dt = new Date(d.date + "T00:00:00");
      const key = grouping === "7d"
        ? String(Math.floor((dt - first) / 604800000))
        : d.date.slice(0, 7);
      if (!buckets.has(key)) buckets.set(key, { firstDate: d.date, items: [], idx: buckets.size });
      buckets.get(key).items.push(d);
    });
    return [...buckets.values()].map(b => {
      const avg = f => b.items.reduce((s,d)=>s+(d[f]||0),0) / b.items.length;
      return {
        date: b.firstDate,
        calIn: avg("calIn"), calOut: avg("calOut"), net: avg("net"),
        lbl: grouping === "7d" ? `Wk ${b.idx+1}` : MONTHS[new Date(b.firstDate+"T00:00:00").getMonth()]
      };
    });
  }

  const weightData = getField(allEntries,"weight",9999);
  const weightAvg  = rollingAvg(weightData,7);
  const wTrend     = lrFit(weightData);

  const calDailyRaw   = allEntries
    .filter(e => e.calIn != null)
    .map(e => {
      const calIn = e.calIn;
      const calOut = e.calOut ?? (e.bmr ?? 0);
      return { date: e.dateKey, calIn, calOut, net: calIn - calOut };
    });
  const proDaily   = allEntries.filter(e=>e.protein!=null&&e.protein>0).map(e=>({ date:e.dateKey, val:e.protein }));
  const slpDaily   = allEntries.filter(e=>e.sleep!=null&&e.sleep>0).map(e=>({ date:e.dateKey, val:e.sleep }));
  const hydDaily   = allEntries.filter(e=>e.hydration!=null&&e.hydration>0).map(e=>({ date:e.dateKey, val:e.hydration }));
  const stepsDaily  = allEntries.filter(e=>e.steps!=null&&e.steps>0).map(e=>({ date:e.dateKey, val:e.steps }));
  const calGroupData  = groupCalData(calDailyRaw, bWindow);
  const proteinData   = groupBarData(proDaily, bWindow);
  const sleepData  = groupBarData(slpDaily, bWindow);
  const hydData    = groupBarData(hydDaily, bWindow);
  const stepsData  = groupBarData(stepsDaily, bWindow);

  const mean = arr => arr.length ? arr.reduce((s,d)=>s+d.val,0)/arr.length : null;
  const todayW=weightData.at(-1)?.val, avgW=weightAvg.at(-1);
  const todayCalEntry = calGroupData.at(-1);
  const avgCalIn  = calGroupData.length ? calGroupData.reduce((s,d)=>s+d.calIn,0)/calGroupData.length : null;
  const avgCalOut = calGroupData.length ? calGroupData.reduce((s,d)=>s+d.calOut,0)/calGroupData.length : null;
  const avgNet    = calGroupData.length ? calGroupData.reduce((s,d)=>s+d.net,0)/calGroupData.length : null;
  const todayPro=proteinData.at(-1)?.val, avgPro=mean(proteinData);
  const todaySleep=sleepData.at(-1)?.val, avgSleep=mean(sleepData);
  const todayHyd=hydData.at(-1)?.val, avgHyd=mean(hydData);
  const todaySteps=stepsData.at(-1)?.val, avgSteps=mean(stepsData);

  const fmtN = (v,d=1) => v!=null ? v.toFixed(d) : "—";

  return <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>

    {/* Long runs */}
    <div style={cardSt}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 12 }}>Long runs</div>
      {allRuns.length === 0
        ? <p style={{ fontSize: 14, color: "#AAA", fontStyle: "italic", margin: 0 }}>Upload TCX files to see run profiles.</p>
        : <>
            <div style={{ position: "relative", marginBottom: 12 }} ref={runDropdownRef}>
              <button
                onClick={() => setRunDropdownOpen(o => !o)}
                style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 10,
                  border: "0.5px solid #D8D5CC", background: "#F5F3EF", fontSize: 13,
                  color: "#1A1A1A", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {selectedRuns.length === 0
                    ? <span style={{ color: "#AAA" }}>Select runs…</span>
                    : selectedRuns.map(r => dateLbl(r.date)).join(", ")}
                </span>
                <span style={{ fontSize: 10, color: "#AAA", marginLeft: 8 }}>{runDropdownOpen ? "▲" : "▼"}</span>
              </button>
              {runDropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "#FFF", border: "0.5px solid #D8D5CC", borderRadius: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 20, overflow: "hidden" }}>
                  {[...allRuns].reverse().map((r, idx) => {
                    const sel = selectedDates?.has(r.date);
                    const selIdx = selectedRuns.indexOf(r);
                    const color = sel ? RUN_COLORS[selIdx % RUN_COLORS.length] : "#CCC";
                    return (
                      <label key={r.date}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                          cursor: "pointer", borderBottom: idx < allRuns.length - 1 ? "0.5px solid #F0EDE8" : "none",
                          background: sel ? "#F5F3EF" : "#FFF" }}
                        onClick={() => toggleDate(r.date)}>
                        <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${color}`,
                          background: sel ? color : "#FFF", flexShrink: 0, display: "flex",
                          alignItems: "center", justifyContent: "center" }}>
                          {sel && <svg width="8" height="6"><polyline points="1,3 3,5 7,1" stroke="#FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span style={{ fontSize: 13, color: "#1A1A1A", flex: 1 }}>{dateLbl(r.date)}</span>
                        <span style={{ fontSize: 12, color: "#AAA" }}>{r.distance} mi</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedRuns.length > 0
              ? <RunSplitChart runs={selectedRuns} />
              : <p style={{ fontSize: 13, color: "#AAA", fontStyle: "italic", margin: 0 }}>Select at least one run above.</p>
            }
          </>
      }
    </div>

    {/* Weight */}
    <div style={cardSt}>
      <div style={{marginBottom:10}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Weight</span>
      </div>
      <div style={{display:"flex",gap:14,fontSize:11,color:"#888",marginBottom:4}}>
        <span><svg width={18} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={18} y2={4} stroke="#A8D0C8" strokeWidth={2}/><circle cx={9} cy={4} r={2.5} fill="#A8D0C8"/></svg>Daily</span>
        <span><svg width={18} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={18} y2={4} stroke="#3A7BD5" strokeWidth={2.5}/></svg>7d rolling avg</span>
        <span><svg width={22} height={8} style={{verticalAlign:"middle",marginRight:3}}><line x1={0} y1={4} x2={22} y2={4} stroke="#E05C5C" strokeWidth={1.5} strokeDasharray="5 3"/></svg>Trend</span>
      </div>
      <LineChart data={weightData} avg={weightAvg} trend={wTrend?.fitted} dotColor="#A8D0C8" lineColor="#3A7BD5"/>
      {todayW!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
        Today <strong style={{color:"#1A1A1A"}}>{fmtN(todayW)} lb</strong>
        {avgW!=null&&<span> &nbsp;7d avg <strong style={{color:"#1A1A1A"}}>{fmtN(avgW)} lb</strong></span>}
        {wTrend!=null&&<span style={{marginLeft:8,color:wTrend.slopePerWeek<=0?"#1D9E75":"#E05C5C"}}>
          {wTrend.slopePerWeek<=0?"↓":"↑"} {Math.abs(wTrend.slopePerWeek).toFixed(2)} lb/wk trend
        </span>}
      </div>}
    </div>

    {/* Calories */}
    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Calories</span>
        <AvgToggle value={bWindow} setValue={setBWindow} options={["1d","7d","30d"]}/>
      </div>
      <div style={{display:"flex",gap:12,fontSize:11,color:"#888",marginBottom:8}}>
        <span><span style={{display:"inline-block",width:10,height:10,background:"#5B9BD5",borderRadius:2,verticalAlign:"middle",marginRight:4}}/>In</span>
        <span><span style={{display:"inline-block",width:10,height:10,background:"#E8A857",borderRadius:2,verticalAlign:"middle",marginRight:4}}/>Out</span>
        <span><span style={{display:"inline-block",width:10,height:10,background:"#6BAE8A",borderRadius:2,verticalAlign:"middle",marginRight:4}}/>Net +</span>
        <span><span style={{display:"inline-block",width:10,height:10,background:"#E07070",borderRadius:2,verticalAlign:"middle",marginRight:4}}/>Net −</span>
      </div>
      <CalorieGroupChart data={calGroupData} goalNet={profile.calorieTarget ?? 0}/>
      {calGroupData.length>0&&<div style={{fontSize:13,color:"#888",marginTop:8,display:"flex",flexWrap:"wrap",gap:"4px 16px"}}>
        {todayCalEntry&&<span>Today&nbsp;
          <strong style={{color:"#5B9BD5"}}>{Math.round(todayCalEntry.calIn)}</strong> in&nbsp;·&nbsp;
          <strong style={{color:"#E8A857"}}>{Math.round(todayCalEntry.calOut)}</strong> out&nbsp;·&nbsp;
          <strong style={{color:todayCalEntry.net>=0?"#1D9E75":"#E05C5C"}}>{todayCalEntry.net>=0?"+":""}{Math.round(todayCalEntry.net)}</strong> net
        </span>}
        {avgCalIn!=null&&<span>Avg&nbsp;
          <strong style={{color:"#5B9BD5"}}>{Math.round(avgCalIn)}</strong> in&nbsp;·&nbsp;
          <strong style={{color:"#E8A857"}}>{Math.round(avgCalOut)}</strong> out&nbsp;·&nbsp;
          <strong style={{color:avgNet>=0?"#1D9E75":"#E05C5C"}}>{avgNet>=0?"+":""}{Math.round(avgNet)}</strong> net
        </span>}
      </div>}
    </div>

    {/* Steps */}
    <div style={cardSt}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>Steps</span>
        <AvgToggle value={bWindow} setValue={setBWindow} options={["1d","7d","30d"]}/>
      </div>
      <BarChart data={stepsData} goalLine={profile.stepsGoal??null} barColor="#E8A857" showDow={true}/>
      {todaySteps!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
        Today <strong style={{color:"#1A1A1A"}}>{Math.round(todaySteps).toLocaleString()}</strong>
        {avgSteps!=null&&<span> · avg <strong style={{color:"#1A1A1A"}}>{Math.round(avgSteps).toLocaleString()}</strong></span>}
      </div>}
    </div>

    {/* Protein & Sleep */}
    {[{label:"Protein",data:proteinData,color:"#8B85D4",goal:profile.proteinGoal??null,unit:"g",today:todayPro,avg:avgPro,dp:0},
      {label:"Sleep",data:sleepData,color:"#7DBFA0",goal:profile.sleepGoal??null,unit:" hr",today:todaySleep,avg:avgSleep,dp:1}
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
      <BarChart data={hydData} goalLine={profile.hydrationGoal??null} barColor="#5B9BD5" showDow={false}/>
      {todayHyd!=null&&<div style={{fontSize:13,color:"#888",marginTop:6}}>
        Today <strong style={{color:"#1A1A1A"}}>{Math.round(todayHyd)} oz</strong>
        {avgHyd!=null&&<span> · avg <strong style={{color:"#1A1A1A"}}>{Math.round(avgHyd)} oz</strong></span>}
      </div>}
    </div>

  </div>;
}
