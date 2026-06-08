import { useState, useEffect } from "react";
import { loadSummary, loadPlan, loadProfile, syncSummaryFromEntries } from "./storage.js";
import { LogTab } from "./components/LogTab.jsx";
import { PlanTab } from "./components/PlanTab.jsx";
import { DashboardTab } from "./components/DashboardTab.jsx";
import { ToolsTab } from "./components/ToolsTab.jsx";
import { ProfileTab } from "./components/ProfileTab.jsx";

export default function AthleteLog() {
  const [tab, setTab] = useState("log");
  const [date, setDate] = useState(new Date());
  const [summary, setSummary] = useState({});
  const [plan, setPlan] = useState({});
  const [planMeta, setPlanMeta] = useState({});
  const [profile, setProfile] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState("minimal");

  useEffect(() => {
    loadSummary().then(s => setSummary(s));
    loadPlan().then(({ meta, days }) => { setPlanMeta(meta); setPlan(days); });
    loadProfile().then(p => setProfile(p));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const rebuilt = await syncSummaryFromEntries(plan, profile);
    setSummary(rebuilt);
    setSyncing(false);
  };

  return <div style={{fontFamily:"system-ui,-apple-system,sans-serif",maxWidth:660,margin:"0 auto",background:"#F0EDE8",minHeight:"100vh"}}>
    <div style={{background:"#fff",borderBottom:"0.5px solid #E5E2DB",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
      <span style={{fontSize:17,fontWeight:600,color:"#1A1A1A"}}>Athlete log</span>
      <div style={{width:24}}/>
    </div>

    <div style={{background:"#fff",borderBottom:"0.5px solid #E5E2DB",display:"flex"}}>
      {["log","plan","dashboard","profile","tools"].map(t => (
        <button key={t} onClick={() => setTab(t)} style={{flex:1,padding:"11px 0",fontSize:13,fontWeight:tab===t?500:400,color:tab===t?"#1A1A1A":"#999",background:"none",border:"none",borderBottom:tab===t?"2px solid #1A1A1A":"2px solid transparent",cursor:"pointer",textTransform:"capitalize",marginBottom:-0.5}}>
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>

    {tab === "log" && <LogTab date={date} setDate={setDate} summary={summary} onSummaryChange={setSummary} plan={plan} onPlanChange={setPlan} viewMode={viewMode} profile={profile}/>}

    {tab === "plan" && <PlanTab onViewLog={d => { setDate(d); setTab("log"); }} summary={summary} plan={plan} planMeta={planMeta}/>}
    {tab === "dashboard" && <DashboardTab summary={summary} profile={profile}/>}
    {tab === "profile" && <ProfileTab profile={profile} onProfileChange={setProfile} summary={summary}/>}
    {tab === "tools" && <ToolsTab onSync={handleSync} syncing={syncing} plan={plan} planMeta={planMeta} profile={profile} summary={summary} viewMode={viewMode} setViewMode={setViewMode}/>}

    <style>{"@keyframes spin{to{transform:rotate(360deg)}} textarea:focus,input:focus{outline:none;border-color:#B8B5AE!important;}"}</style>
  </div>;
}
