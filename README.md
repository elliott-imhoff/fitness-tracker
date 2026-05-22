# Athlete Log

A personal fitness and nutrition tracking app for a structured 22-week marathon training plan. Logs daily workouts, nutrition, biometrics, and journal entries. Data is stored locally as JSON files on disk.

## Stack

- **React 19 + Vite** — UI
- **Express** — local storage server (reads/writes JSON files)
- **Ajv** — JSON schema validation on log entry import

## Project structure

```
src/
  App.jsx                  # Root component, tab nav
  components/
    LogTab.jsx             # Daily log entry (view + edit + paste snapshot)
    PlanTab.jsx            # Training plan calendar + progress
    DashboardTab.jsx       # Charts and trend visualizations
    ToolsTab.jsx           # Tracking chat prompt generator
    ui.jsx                 # Shared UI primitives
  plan.js                  # WEEKS array + PLAN map + workout helpers
  schema.js                # Ajv entry schema + SNAPSHOT_SCHEMA_PROMPT
  storage.js               # fetch() wrappers for the local server API
  utils.js                 # Date/format helpers
data/
  summary.json             # Index of all logged days (auto-maintained)
  entries/
    2026-05-04.json        # One file per logged day
    ...
server.js                  # Express server — GET/PUT /entries/:date, GET/PUT /summary
scripts/
  migrate-export.js        # One-time migration from old export format
```

`data/` is gitignored — your logs stay local.

## Setup

```bash
npm install
npm start
```

This starts both the Vite dev server (port 5173) and the storage server (port 3001) concurrently.

## Logging workflow

1. Open the app and go to **Tools** → generate a tracking prompt
2. Paste the prompt into a new Claude/ChatGPT conversation at the start of each day
3. Log workouts, meals, and notes throughout the day in that chat
4. At the end of the day, ask it to generate the daily snapshot JSON
5. Paste the JSON into the **Log** tab and hit save — it validates against the schema and stores to disk

## Build

```bash
npm run build   # outputs to dist/
```
