import { TYPE_STYLE } from "../utils.js";

export const cardSt   = { background:"#fff", borderRadius:14, border:"0.5px solid #E5E2DB", padding:"16px 18px" };
export const inputSt  = { fontSize:14, padding:"8px 12px", borderRadius:10, border:"0.5px solid #D8D5CC", background:"#F5F3EF", color:"#1A1A1A", width:"100%", boxSizing:"border-box", fontFamily:"inherit", outline:"none" };
export const saveBtnSt= { padding:"8px 18px", background:"#fff", border:"0.5px solid #C8C5BC", borderRadius:10, fontSize:14, fontWeight:500, color:"#1A1A1A", cursor:"pointer", marginTop:10 };

export function Spinner() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:"spin 1s linear infinite",flexShrink:0}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
}

export function Empty({text}) {
  return <p style={{fontSize:14,color:"#AAA7A0",fontStyle:"italic",margin:0,padding:"4px 0"}}>{text}</p>;
}

export function Badge({type}) {
  const st=TYPE_STYLE[type]||TYPE_STYLE.Easy;
  return <span style={{fontSize:11,padding:"3px 9px",borderRadius:20,fontWeight:500,background:st.bg,color:st.color,whiteSpace:"nowrap"}}>{type||"Rest"}</span>;
}

export function Metric({label,value,sub,hl}) {
  return <div style={{background:"#F5F3EF",borderRadius:10,border:"0.5px solid #E8E5DF",padding:"12px 14px"}}>
    <div style={{fontSize:22,fontWeight:500,color:hl||"#1A1A1A",lineHeight:1.15}}>{value||"—"}</div>
    <div style={{fontSize:13,color:"#555",marginTop:3}}>{label}</div>
    {sub&&<div style={{fontSize:12,color:"#AAA7A0",marginTop:1}}>{sub}</div>}
  </div>;
}

export function Field({label,value,onChange,type="text",placeholder=""}) {
  return <div style={{marginBottom:10}}>
    <label style={{fontSize:12,color:"#888",display:"block",marginBottom:4}}>{label}</label>
    <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={inputSt}/>
  </div>;
}

export function TArea({label,value,onChange,rows=2}) {
  return <div style={{marginBottom:10}}>
    {label&&<label style={{fontSize:12,color:"#888",display:"block",marginBottom:4}}>{label}</label>}
    <textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={rows} style={{...inputSt,resize:"vertical",lineHeight:1.6}}/>
  </div>;
}

export function EditCard({title,right,id,editSection,setEditSection,display,editor,error}) {
  return <div style={cardSt}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <span style={{fontSize:15,fontWeight:600,color:"#1A1A1A"}}>{title}</span>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {right&&<span style={{fontSize:13,color:"#AAA7A0"}}>{right}</span>}
        <button onClick={()=>setEditSection(editSection===id?null:id)} style={{fontSize:editSection===id?12:15,color:"#AAA7A0",background:"none",border:"none",cursor:"pointer",padding:"0 2px",lineHeight:1}}>
          {editSection===id?"✓":"✎"}
        </button>
      </div>
    </div>
    {editSection===id?editor:display}
    {editSection===id&&error&&<div style={{fontSize:13,color:"#C0392B",marginTop:8}}>{error}</div>}
  </div>;
}
