import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AthleteLog from './AthleteLog.jsx';

// ── window.storage polyfill (mirrors Claude artifact API) ─────
// Claude's artifact runtime exposes window.storage.get(key) → { value: string }
// and window.storage.set(key, value). We back it with localStorage here.
window.storage = {
  get: async (key) => {
    const value = localStorage.getItem(key);
    return value !== null ? { value } : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AthleteLog />
  </StrictMode>,
);
