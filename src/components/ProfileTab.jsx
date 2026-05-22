import { useState } from "react";
import { cardSt, saveBtnSt } from "./ui.jsx";
import { saveProfile } from "../storage.js";

const SECTIONS = [
  { key: "background",     title: "Background",    hint: "Training history, context..." },
  { key: "goals",          title: "Personal goals", hint: "Long-term goals beyond the current plan..." },
  { key: "physicalFlags",  title: "Physical flags", hint: "Injuries, niggles, things to monitor..." },
];

const STAT_FIELDS = [
  { key: "age",          label: "Age",            unit: "yr",  type: "number", step: 1,   min: 10, max: 99 },
  { key: "hrMax",        label: "HR max",         unit: "bpm", type: "number", step: 1,   min: 100, max: 230 },
  { key: "hrRest",       label: "HR rest",        unit: "bpm", type: "number", step: 1,   min: 30,  max: 100 },
  { key: "vdotShort",    label: "VDOT goal (short)", unit: "",    type: "number", step: 0.1, min: 20,  max: 85, placeholder: "—" },
  { key: "vdotLong",     label: "VDOT goal (long)",  unit: "",    type: "number", step: 0.1, min: 20,  max: 85, placeholder: "—" },
  { key: "proteinGoal",  label: "Protein goal",   unit: "g",   type: "number", step: 5,   min: 50,  max: 500 },
  { key: "hydrationGoal",label: "Hydration goal", unit: "oz",  type: "number", step: 5,   min: 32,  max: 300 },
  { key: "sleepGoal",    label: "Sleep goal",     unit: "hr",  type: "number", step: 0.5, min: 4,   max: 12 },
  { key: "calorieTarget",label: "Cal target",     unit: "kcal net", type: "number", step: 50, min: -1500, max: 1500, placeholder: "0 = even" },
];

function cmToFtIn(cm) {
  if (cm == null || cm === "") return { ft: "", in: "" };
  const totalIn = parseFloat(cm) / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn % 12);
  return { ft: String(ft), in: String(inch) };
}
function ftInToCm(ft, inch) {
  const f = parseFloat(ft), i = parseFloat(inch);
  if (isNaN(f) && isNaN(i)) return null;
  return Math.round(((isNaN(f) ? 0 : f) * 12 + (isNaN(i) ? 0 : i)) * 2.54 * 10) / 10;
}
function displayHeight(cm) {
  if (cm == null) return null;
  const { ft, in: inch } = cmToFtIn(cm);
  return `${ft}ft ${inch}in`;
}

const inputSt = { background: "#F5F3EF", border: "0.5px solid #D8D5CC", borderRadius: 8, padding: "5px 8px", fontSize: 13, color: "#1A1A1A", outline: "none", width: "70px", textAlign: "right", fontFamily: "inherit" };

export function ProfileTab({ profile, onProfileChange, summary={} }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [statDraft, setStatDraft] = useState(null); // key -> value while editing stats
  const [saving, setSaving] = useState(false);

  const P = profile || {};

  // --- text sections ---
  const startEdit = (key) => { setEditing(key); setDraft(P[key] || ""); };
  const saveSection = async (key) => {
    setSaving(true);
    const updated = { ...P, [key]: draft };
    onProfileChange(updated);
    await saveProfile(updated);
    setSaving(false);
    setEditing(null);
  };

  // --- stats card ---
  const latestWeight = (() => {
    const entries = Object.entries(summary)
      .filter(([, e]) => e && e.weight != null && e.weight !== "" && !isNaN(parseFloat(e.weight)))
      .sort(([a], [b]) => a < b ? 1 : -1);
    return entries.length ? String(parseFloat(entries[0][1].weight)) : "";
  })();

  const startStatEdit = () => {
    const hft = cmToFtIn(P.heightCm);
    setStatDraft({
      ...Object.fromEntries(STAT_FIELDS.map(f => [f.key, P[f.key] != null ? String(P[f.key]) : ""])),
      __sex: P.sex || "male",
      __heightFt: hft.ft,
      __heightIn: hft.in,
      __weightLb: latestWeight || (P.weightLb != null ? String(P.weightLb) : ""),
    });
  };
  const saveStats = async () => {
    setSaving(true);
    const parsed = {};
    STAT_FIELDS.forEach(f => {
      const v = statDraft[f.key];
      parsed[f.key] = v === "" || v == null ? null : Number(v);
    });
    parsed.sex = statDraft.__sex || P.sex || "male";
    parsed.heightCm = ftInToCm(statDraft.__heightFt, statDraft.__heightIn);
    // Only save manual weight if no log weight exists
    if (!latestWeight) {
      parsed.weightLb = statDraft.__weightLb === "" || statDraft.__weightLb == null ? null : Number(statDraft.__weightLb);
    }
    const updated = { ...P, ...parsed };
    onProfileChange(updated);
    await saveProfile(updated);
    setSaving(false);
    setStatDraft(null);
  };

  // BMR — log weight takes precedence; fall back to manually stored weightLb
  const weightForBMR = latestWeight ? parseFloat(latestWeight) : (P.weightLb ?? null);
  const computedBMR = (() => {
    const wkg = (weightForBMR || 0) * 0.453592;
    if (!P.age || !P.heightCm || !weightForBMR) return null;
    const base = 10 * wkg + 6.25 * P.heightCm - 5 * P.age;
    return Math.round(P.sex === "female" ? base - 161 : base + 5);
  })();

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Stats card */}
      <div style={cardSt}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>Stats</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {computedBMR && !statDraft && (
              <span style={{ fontSize: 12, color: "#AAA" }}>BMR ~{computedBMR} kcal</span>
            )}
            <button
              onClick={() => statDraft ? saveStats() : startStatEdit()}
              style={{ fontSize: statDraft ? 12 : 15, color: "#AAA7A0", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
            >
              {statDraft ? "✓" : "✎"}
            </button>
            {statDraft && (
              <button onClick={() => setStatDraft(null)} style={{ fontSize: 12, color: "#AAA7A0", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>✕</button>
            )}
          </div>
        </div>

          {/* sex + height rows */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
          {/* Weight */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#666" }}>Weight</span>
            {statDraft && !latestWeight ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" step={0.1} min={80} max={400} placeholder="—"
                  value={statDraft.__weightLb}
                  onChange={e => setStatDraft(d => ({ ...d, __weightLb: e.target.value }))}
                  style={inputSt}/>
                <span style={{ fontSize: 12, color: "#AAA" }}>lb</span>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: latestWeight || P.weightLb ? "#1A1A1A" : "#C0BDB7" }}>
                {latestWeight || (P.weightLb != null ? String(P.weightLb) : "") || "—"} {(latestWeight || P.weightLb) ? "lb" : ""}
                {statDraft && latestWeight && <span style={{ fontSize: 11, color: "#AAA", marginLeft: 4 }}>from log</span>}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#666" }}>Sex</span>
            {statDraft ? (
              <select
                value={statDraft.__sex ?? (P.sex || "male")}
                onChange={e => setStatDraft(d => ({ ...d, __sex: e.target.value }))}
                style={{ ...inputSt, width: "auto", textAlign: "left", appearance: "none", WebkitAppearance: "none", paddingRight: 20, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23AAA'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            ) : (
              <span style={{ fontSize: 13, color: "#1A1A1A" }}>{P.sex || "—"}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#666", whiteSpace: "nowrap" }}>Height</span>
            {statDraft ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" min={3} max={8} step={1} placeholder="ft"
                  value={statDraft.__heightFt}
                  onChange={e => setStatDraft(d => ({ ...d, __heightFt: e.target.value }))}
                  style={{ ...inputSt, width: 40 }}/>
                <span style={{ fontSize: 12, color: "#AAA" }}>ft</span>
                <input type="number" min={0} max={11} step={1} placeholder="in"
                  value={statDraft.__heightIn}
                  onChange={e => setStatDraft(d => ({ ...d, __heightIn: e.target.value }))}
                  style={{ ...inputSt, width: 40 }}/>
                <span style={{ fontSize: 12, color: "#AAA" }}>in</span>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: "#1A1A1A" }}>
                {P.heightCm != null ? displayHeight(P.heightCm) : <span style={{ color: "#C0BDB7" }}>—</span>}
              </span>
            )}
          </div>
          {STAT_FIELDS.map(f => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#666", whiteSpace: "nowrap" }}>{f.label}</span>
              {statDraft ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    step={f.step}
                    min={f.min}
                    max={f.max}
                    placeholder={f.placeholder || ""}
                    value={statDraft[f.key]}
                    onChange={e => setStatDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    style={inputSt}
                  />
                  {f.unit && <span style={{ fontSize: 12, color: "#AAA", whiteSpace: "nowrap" }}>{f.unit}</span>}
                </div>
              ) : (
                <span style={{ fontSize: 13, color: "#1A1A1A" }}>
                  {P[f.key] != null ? `${P[f.key]}${f.unit ? " " + f.unit : ""}` : <span style={{ color: "#C0BDB7" }}>—</span>}
                </span>
              )}
            </div>
          ))}
        </div>

        {statDraft && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={saveStats} disabled={saving} style={saveBtnSt}>Save</button>
            <button onClick={() => setStatDraft(null)} style={{ ...saveBtnSt, background: "#F5F3EF", color: "#888", border: "0.5px solid #D8D5CC" }}>Cancel</button>
          </div>
        )}
      </div>

      {/* Text section cards */}
      {SECTIONS.map(({ key, title, hint }) => (
        <div key={key} style={cardSt}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing === key ? 10 : (P[key] ? 10 : 0) }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>{title}</span>
            <button
              onClick={() => editing === key ? saveSection(key) : startEdit(key)}
              style={{ fontSize: editing === key ? 12 : 15, color: "#AAA7A0", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
            >
              {editing === key ? "✓" : "✎"}
            </button>
          </div>
          {editing === key ? (
            <>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={hint}
                autoFocus
                rows={5}
                style={{ width: "100%", background: "#F5F3EF", border: "0.5px solid #D8D5CC", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1A1A1A", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, outline: "none", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => saveSection(key)} disabled={saving} style={saveBtnSt}>Save</button>
                <button onClick={() => setEditing(null)} style={{ ...saveBtnSt, background: "#F5F3EF", color: "#888", border: "0.5px solid #D8D5CC" }}>Cancel</button>
              </div>
            </>
          ) : P[key] ? (
            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{P[key]}</p>
          ) : (
            <p style={{ fontSize: 13, color: "#C0BDB7", margin: 0, fontStyle: "italic" }}>{hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
