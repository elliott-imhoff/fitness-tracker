import Ajv from "ajv";

export const WORKOUT_TYPES = [
  "Easy run", "Long run", "Tempo run", "Intervals", "Lift", "Race", "Rest",
];

// Full JSON schema for a daily log entry.
// This is the single source of truth for both validation and prompt generation.
export const ENTRY_SCHEMA = {
  type: "object",
  required: [],
  additionalProperties: true,
  properties: {
    workout: {
      type: "object",
      required: ["type"],
      description: "Primary workout for the day",
      properties: {
        type:             { type: "string", enum: [...WORKOUT_TYPES, ""], description: "Required. One of the allowed values, or empty string if no workout logged." },
        distance:         { type: "string", pattern: "^(\\d+(\\.\\d+)?)?$", description: "Miles, runs only. E.g. \"6.2\"" },
        pace:             { type: "string", pattern: "^(\\d+:\\d{2})?$", description: "mm:ss per mile. Steady runs only — omit for Intervals." },
        hr:               { type: "string", pattern: "^(\\d+)?$",   description: "Average heart rate bpm" },
        hr_peak:          { type: "string", pattern: "^(\\d+)?$",   description: "Peak heart rate bpm" },
        duration:         { type: "string", pattern: "^(\\d+)?$",   description: "Minutes. Required for Lift." },
        calories_burned:  { type: "string", pattern: "^(\\d+)?$",   description: "kcal" },
        structure:        { type: "string",                          description: "Intervals only. E.g. \"6x400m\"" },
        rep_count:        { type: "string", pattern: "^(\\d+)?$",   description: "Intervals only. Number of reps." },
        rep_distance_m:   { type: "string", pattern: "^(\\d+)?$",   description: "Intervals only. Meters per rep." },
        rep_times:        { type: "string", pattern: "^(\\d+:\\d{2},?)*$", description: "Intervals only. Every rep time mm:ss comma-separated. E.g. \"1:32,1:34,1:33\"" },
        exercises: {
          type: "array",
          description: "Lift days only. Each item: \"Exercise · sets x reps · weight\"",
          items: { type: "string" },
        },
        notes:            { type: "string", description: "Conditions, how it felt, anything notable" },
        vdot:             { type: "string", description: "Computed by app — omit, will be overwritten" },
      },
      additionalProperties: false,
    },

    other_activity: {
      type: "object",
      description: "Any secondary activity (walk, bike, etc.) — omit entire object if none",
      properties: {
        description: { type: "string", description: "Activity name" },
        duration:    { type: "string", pattern: "^(\\d+)?$", description: "Minutes" },
        calories:    { type: "string", pattern: "^(\\d+)?$", description: "kcal" },
      },
      additionalProperties: false,
    },

    metrics: {
      type: "object",
      required: [],
      description: "Daily biometrics and nutrition totals",
      properties: {
        sleep:     { type: "string", pattern: "^(\\d+(\\.\\d+)?)?$", description: "Hours, decimal. E.g. \"7.5\"" },
        weight:    { type: "string", pattern: "^(\\d+(\\.\\d+)?)?$", description: "Lbs, morning weight. E.g. \"189.5\"" },
        calIn:     { type: "string", pattern: "^(\\d+)?$",           description: "Total calories consumed" },
        calOut:    { type: "string", pattern: "^(\\d+)?$",           description: "Total calories burned (BMR + exercise = full TDEE)" },
        protein:   { type: "string", pattern: "^(\\d+)?$",           description: "Grams" },
        hydration: { type: "string", pattern: "^(\\d+)?$",           description: "Oz" },
      },
      additionalProperties: false,
    },

    food: {
      type: "object",
      description: "Meal breakdown. Summarize each meal as a readable string; include cal and protein per meal as numbers.",
      properties: {
        breakfast:     { type: "string",  description: "Summary of breakfast foods" },
        breakfast_cal: { type: "number",  description: "kcal" },
        breakfast_pro: { type: "number",  description: "Protein grams" },
        lunch:         { type: "string",  description: "Summary of lunch foods" },
        lunch_cal:     { type: "number",  description: "kcal" },
        lunch_pro:     { type: "number",  description: "Protein grams" },
        snacks:        { type: "string",  description: "Summary of snack foods" },
        snacks_cal:    { type: "number",  description: "kcal" },
        snacks_pro:    { type: "number",  description: "Protein grams" },
        dinner:        { type: "string",  description: "Summary of dinner foods" },
        dinner_cal:    { type: "number",  description: "kcal" },
        dinner_pro:    { type: "number",  description: "Protein grams" },
      },
      additionalProperties: false,
    },

    energy:      { type: "string", description: "Free-form: mood, mental state, motivation, stress, energy levels" },
    body:        { type: "string", description: "Physical observations: soreness, tightness, injuries" },
    sleep_notes: { type: "string", description: "Sleep quality, disturbances, anything notable" },
    journal:     { type: "string", description: "Personal note — paste verbatim exactly as written, no edits, keep my voice" },
  },
};

// Build a pretty prompt block from the schema
function schemaToPrompt(schema, indent = 0) {
  const pad = "  ".repeat(indent);
  const lines = [];
  if (schema.type === "object") {
    lines.push("{");
    const props = schema.properties || {};
    const entries = Object.entries(props);
    entries.forEach(([key, val], i) => {
      const comma = i < entries.length - 1 ? "," : "";
      const comment = val.description ? `  // ${val.description}` : "";
      const req = (schema.required || []).includes(key) ? " [required]" : "";
      if (val.type === "object") {
        lines.push(`${pad}  "${key}": ${schemaToPrompt(val, indent + 1)}${comma}${comment}`);
      } else if (val.type === "array") {
        const itemExample = val.items?.type === "string" ? `"${val.description?.match(/"([^"]+)"/)?.[1] || "..."}"` : "...";
        lines.push(`${pad}  "${key}": [${itemExample}]${comma}${comment}`);
      } else {
        const example = exampleValue(key, val);
        lines.push(`${pad}  "${key}": ${example}${comma}${comment}${req}`);
      }
    });
    lines.push(`${pad}}`);
  }
  return lines.join("\n" + pad);
}

function exampleValue(key, val) {
  if (val.enum) return `"${val.enum[0]}"`;
  if (val.type === "number") return "0";
  // pull a realistic example from description
  const ex = val.description?.match(/E\.g\. "([^"]+)"/)?.[1];
  if (ex) return `"${ex}"`;
  return `"..."`;
}

export const SNAPSHOT_SCHEMA_PROMPT = [
  "Output a single raw JSON object — no markdown fences, no extra text, nothing before or after the JSON.",
  "Omit any key where the value is unknown or not applicable.",
  "",
  schemaToPrompt(ENTRY_SCHEMA),
].join("\n");

// Ajv validator instance
const ajv = new Ajv({ allErrors: true });
const _validate = ajv.compile(ENTRY_SCHEMA);

export function validateEntry(obj) {
  const valid = _validate(obj);
  if (!valid) {
    const messages = _validate.errors.map(e => {
      const field = e.instancePath || e.schemaPath;
      return `${field} ${e.message}`;
    });
    throw new Error(messages.join("\n"));
  }
}
