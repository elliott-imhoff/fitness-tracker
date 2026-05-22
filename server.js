import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR    = path.join(__dirname, "data");
const ENTRIES_DIR = path.join(DATA_DIR, "entries");
const SUMMARY_FILE = path.join(DATA_DIR, "summary.json");

await fs.mkdir(ENTRIES_DIR, { recursive: true });

const app = express();
app.use(express.json());

// Allow Vite dev server to call this server
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- entries ---

app.get("/entries/:date", async (req, res) => {
  try {
    const file = path.join(ENTRIES_DIR, `${req.params.date}.json`);
    const text = await fs.readFile(file, "utf8");
    res.json(JSON.parse(text));
  } catch {
    res.status(404).json(null);
  }
});

app.put("/entries/:date", async (req, res) => {
  const file = path.join(ENTRIES_DIR, `${req.params.date}.json`);
  await fs.writeFile(file, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// --- summary ---

app.get("/summary", async (req, res) => {
  try {
    const text = await fs.readFile(SUMMARY_FILE, "utf8");
    res.json(JSON.parse(text));
  } catch {
    res.json({});
  }
});

app.put("/summary", async (req, res) => {
  await fs.writeFile(SUMMARY_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

app.listen(3001, () => console.log("Storage server running on http://localhost:3001"));
