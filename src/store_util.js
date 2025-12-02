// store_util.js
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_FILE = path.join(DATA_DIR, 'terminal_history.jsonl');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export function appendEntry(entryObj) {
  const line = JSON.stringify(entryObj).replace(/\n/g, "\\n") + "\n";
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error("[LOG WRITE ERROR]", err);
  });
}

export function readSessionEntries(sessionId, limit = 50) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const data = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = data.trim().split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
  const filtered = lines.filter(e => e.sessionId === sessionId);
  return filtered.slice(-limit);
}
