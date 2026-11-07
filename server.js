'use strict';

/**
 * Registry Insight — starter server (zero dependencies).
 * Run: node server.js
 *
 * Local only. This process listens on 127.0.0.1 for the learner machine.
 * Lab 11 does not deploy this file as a long-running server on Vercel.
 * Learners create api/summary.js, api/health.js, and api/notes.js there.
 * Do not add a root vercel.json or an api/ folder before that lab.
 * How the ~8 MB data/dataset.csv is bundled is documented in
 * reference/vercel/README.md.
 *
 * The starter build is supposed to fail scripts/quality-gate.js.
 * Cleaning data/dataset.csv and fixing the request handler are the labs.
 *
 * Notes:
 * - On the laptop, the finished app must write data/notes.json so a note
 *   survives a restart. This starter keeps notes in memory on purpose.
 * - When process.env.VERCEL is set, notes are read-only. Do not write a file.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { analyze } = require('./lib/inspect-data');

const PORT = Number(process.env.PORT || 3000);
const HOST = '127.0.0.1';
const ROOT = __dirname;
const CSV_PATH = path.join(ROOT, 'data', 'dataset.csv');
const WEB_ROOT = path.join(ROOT, 'web');
const NOTES_PATH = path.join(ROOT, 'data', 'notes.json');
const MAX_NOTE_LENGTH = 200;

function notesAreReadOnly() {
  return Boolean(process.env.VERCEL);
}

// Load saved notes at boot. A missing or unreadable file starts an empty list.
function loadNotes() {
  try {
    const parsed = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.notes;
    if (!Array.isArray(list)) return [];
    return list.filter((n) => n && typeof n.text === 'string').map((n) => ({ text: n.text }));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('notes load failed, starting empty', err.message);
    return [];
  }
}

// Laptop only: write to a temp file then rename so a crash mid-write keeps the old file.
function saveNotes(list) {
  const tmp = `${NOTES_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ notes: list }, null, 2), 'utf8');
  fs.renameSync(tmp, NOTES_PATH);
}

const notes = notesAreReadOnly() ? [] : loadNotes();

function sendJson(res, status, body, extraHeaders) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

function naiveRecords(text) {
  const lines = String(text).split(/\r?\n/).filter((line) => line.trim() !== '');
  const header = lines.shift().split(',').map((cell) => cell.trim());
  return lines.map((line) => {
    const cells = line.split(',');
    const record = {};
    header.forEach((name, index) => {
      record[name] = (cells[index] || '').trim();
    });
    return record;
  });
}

function naiveMoney(value) {
  const parsed = parseFloat(String(value).replace(/฿/g, '').replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function summaryFromCsv() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const result = analyze(text);
  return {
    companyCount: result.stats.companyCount,
    totalCapital: result.stats.totalCapital,
    source: 'inspect-data.js',
  };
}

function contentType(filePath) {
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function serveStatic(res, fileName) {
  const resolved = path.resolve(WEB_ROOT, fileName);
  const rel = path.relative(WEB_ROOT, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  fs.readFile(resolved, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(resolved), 'Content-Length': buf.length });
    res.end(buf);
  });
}

function readonlyNotes(res) {
  sendJson(res, 200, {
    ok: true,
    mode: 'readonly',
    notes: [{ text: 'ตัวอย่างโน้ตสำหรับเดโม อ่านอย่างเดียวบน Vercel', demo: true }],
  });
}

function rejectNoteWrite(req, res) {
  req.resume();
  sendJson(res, 405, {
    ok: false,
    error: 'NOTES_READONLY',
    message: 'โน้ตบน Vercel เป็นตัวอย่างอ่านอย่างเดียว เพราะดิสก์ของ serverless ไม่เก็บไฟล์ถาวร',
  }, { Allow: 'GET' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // Lab 11 maps this route to api/health.js. Production returns { ok: true } only.
  if (url.pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true });
  }

  // Lab 11 maps this route to api/summary.js and bundles data/dataset.csv.
  if (url.pathname === '/api/summary' && req.method === 'GET') {
    try {
      return sendJson(res, 200, summaryFromCsv());
    } catch (err) {
      console.error('summary failed', err);
      return sendJson(res, 500, { error: 'SUMMARY_FAILED' });
    }
  }

  // Lab 11 maps this route to api/notes.js. On Vercel it is read-only.
  if (url.pathname === '/api/notes' && req.method === 'GET') {
    if (notesAreReadOnly()) return readonlyNotes(res);
    return sendJson(res, 200, { notes });
  }

  if (url.pathname === '/api/notes' && req.method === 'POST') {
    if (notesAreReadOnly()) return rejectNoteWrite(req, res);
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'INVALID_JSON' });
      }
      const text = body && typeof body === 'object' && typeof body.text === 'string'
        ? body.text.trim()
        : '';
      if (!text) {
        return sendJson(res, 400, { ok: false, error: 'TEXT_REQUIRED' });
      }
      const next = [...notes, { text: text.slice(0, MAX_NOTE_LENGTH) }];
      try {
        saveNotes(next);
      } catch (err) {
        console.error('notes save failed', err);
        return sendJson(res, 500, { ok: false, error: 'NOTES_SAVE_FAILED' });
      }
      notes.splice(0, notes.length, ...next);
      sendJson(res, 201, { ok: true, count: notes.length });
    });
    return;
  }

  if (req.method === 'GET') {
    if (url.pathname === '/' || url.pathname === '/index.html') return serveStatic(res, 'index.html');
    if (url.pathname === '/styles.css') return serveStatic(res, 'styles.css');
    if (url.pathname === '/app.js') return serveStatic(res, 'app.js');
  }

  sendJson(res, 404, { error: 'NOT_FOUND' });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`registry-insight listening on http://${HOST}:${PORT}`);
  });
}

module.exports = { server, notesAreReadOnly };
