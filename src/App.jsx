import { useState, useEffect } from "react";
import { loadSummary, loadPlan, syncSummaryFromEntries } from "./storage.js";
import { LogTab } from "./components/LogTab.jsx";
import { PlanTab } from "./components/PlanTab.jsx";
import { DashboardTab } from "./components/DashboardTab.jsx";
import { ToolsTab } from "./components/ToolsTab.jsx";

export default function AthleteLog() {
  const [tab, setTab] = useState("log");
  const [date, setDate] = useState(new Date());
  const [summary, setSummary] = useState({});
  const [plan, setPlan] = useState({});
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSummary().then(s => setSummary(s));
    loadPlan().then(p => setPlan(p));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const rebuilt = await syncSummaryFromEntries(plan);
    setSummary(rebuilt);
    setSyncing(false);
  };

  return <div style={{fontFamily:"system-ui,-apple-system,sans-serif",maxWidth:660,margin:"0 auto",background:"#F0EDE8",minHeight:"100vh"}}>
    <div style={{background:"#fff",borderBottom:"0.5px solid #E5E2DB",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
      <span style={{fontSize:17,fontWeight:600,color:"#1A1A1A"}}>Athlete log</span>
      <div style={{width:24}}/>
    </div>

    <div style={{background:"#fff",borderBottom:"0.5px solid #E5E2DB",display:"flex"}}>
      {["log","plan","dashboard","tools"].map(t => (
        <button key={t} onClick={() => setTab(t)} style={{flex:1,padding:"11px 0",fontSize:13,fontWeight:tab===t?500:400,color:tab===t?"#1A1A1A":"#999",background:"none",border:"none",borderBottom:tab===t?"2px solid #1A1A1A":"2px solid transparent",cursor:"pointer",textTransform:"capitalize",marginBottom:-0.5}}>
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>

    {tab === "log" && <LogTab date={date} setDate={setDate} summary={summary} onSummaryChange={setSummary} plan={plan} onPlanChange={setPlan}/>}

    {tab === "plan" && <PlanTab onViewLog={d => { setDate(d); setTab("log"); }} summary={summary} plan={plan}/>}
    {tab === "dashboard" && <DashboardTab summary={summary}/>}
    {tab === "tools" && <ToolsTab onSync={handleSync} syncing={syncing} plan={plan}/>}

    <style>{"@keyframes spin{to{transform:rotate(360deg)}} textarea:focus,input:focus{outline:none;border-color:#B8B5AE!important;}"}</style>
  </div>;
}
