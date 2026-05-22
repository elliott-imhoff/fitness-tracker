export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const DOWS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export function fmtKey(d) {
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
export function fmtDisplay(d) {
  return DOWS[(d.getDay()+6)%7]+", "+MONTHS[d.getMonth()]+" "+d.getDate();
}
export function isToday(d) {
  const t=new Date();
  return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear();
}
export function startOfWeek(d) {
  const r=new Date(d); r.setDate(d.getDate()-((d.getDay()+6)%7)); return r;
}
export function addDays(d,n) {
  const r=new Date(d); r.setDate(d.getDate()+n); return r;
}
