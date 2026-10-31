'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const repo = path.join(__dirname, '..');
const notesPath = path.join(repo, 'data', 'notes.json');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'raw']);
const TEXT_EXT = new Set(['.js', '.mjs', '.md', '.json', '.html', '.css', '.sh', '.ps1', '.example', '.txt']);

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (entry.name === 'dataset.csv' || entry.name === 'warehouse.duckdb' || entry.name.endsWith('.parquet')) continue;
    const ext = path.extname(entry.name);
    if (TEXT_EXT.has(ext) || entry.name === '.gitignore' || entry.name === '.env.example' || entry.name === 'opencode.json') {
      files.push(full);
    }
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    const settle = (open) => {
      sock.destroy();
      resolve(open);
    };
    sock.setTimeout(400);
    sock.once('connect', () => settle(true));
    sock.once('error', () => settle(false));
    sock.once('timeout', () => settle(false));
  });
}

function request(port, method, route, body) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: route,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        timeout: 4000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8'), error: null });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ status: 0, text: '', error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

function startServer(port, extraEnv) {
  return spawn(process.execPath, ['server.js'], {
    cwd: repo,
    env: { ...process.env, PORT: String(port), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForPort(port, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    if (!child || child.exitCode !== null) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

function stop(child) {
  if (child && child.exitCode === null) child.kill('SIGKILL');
}

test('starter text has no previous product name', () => {
  const files = [];
  walk(repo, files);
  const banned = [
    ['Sales', ' Insight'].join(''),
    ['sales', '.csv'].join(''),
    ['sales', '-insight'].join(''),
    ['sales', ' sandbox'].join(''),
    ['sales', '.clean.csv'].join(''),
  ];
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const phrase of banned) {
      if (text.includes(phrase)) hits.push(`${path.relative(repo, file)}: ${phrase}`);
    }
  }
  assert.deepEqual(hits, []);
  assert.equal(fs.existsSync(path.join(repo, 'vercel.json')), false);
  assert.equal(fs.existsSync(path.join(repo, 'api')), false);
  assert.equal(fs.existsSync(path.join(repo, '.mcp.json')), false);
});

test('rules match on both tools and keys stay out of the repo', () => {
  const claude = fs.readFileSync(path.join(repo, 'CLAUDE.md'), 'utf8');
  const agents = fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
  const opencode = fs.readFileSync(path.join(repo, 'opencode.json'), 'utf8');
  const example = fs.readFileSync(path.join(repo, '.env.example'), 'utf8');
  for (const phrase of ['scripts/quality-gate.js', 'data/notes.json', 'VERCEL', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'notes-persists']) {
    assert.ok(claude.includes(phrase), `CLAUDE.md missing ${phrase}`);
    assert.ok(agents.includes(phrase), `AGENTS.md missing ${phrase}`);
  }
  assert.match(opencode, /รูปแบบ permission/);
  assert.match(opencode, /เปลี่ยนตามรุ่น/);
  assert.ok(opencode.includes('{env:OPENROUTER_API_KEY}'));
  assert.ok(opencode.includes('scripts/quality-gate.js'));
  assert.ok(opencode.includes('git push'));
  assert.ok(opencode.includes('deny'));
  assert.equal(opencode.includes('sk-or-'), false);
  assert.match(example, /OPENROUTER_API_KEY=\s*$/m);
  assert.match(example, /ANTHROPIC_API_KEY=\s*$/m);
  assert.equal(new RegExp(['sk-', 'or-v1-'].join('')).test(example), false);
});

test('local notes gate still demands a restart re-check', () => {
  const gate = fs.readFileSync(path.join(repo, 'scripts', 'quality-gate.js'), 'utf8');
  const server = fs.readFileSync(path.join(repo, 'server.js'), 'utf8');
  assert.match(gate, /cannot read dataset\.csv/);
  assert.equal(gate.includes(['sales', '.csv'].join('')), false);
  assert.equal(gate.includes('VERCEL'), false);
  assert.match(gate, /restartServer\(\)/);
  assert.match(gate, /survives-restart/);
  assert.equal(/writeFile/.test(server), false);
  assert.match(server, /process\.env\.VERCEL/);
  assert.match(server, /require\.main === module/);
});

test('homepage has a notes box and in-memory notes do not survive restart', async () => {
  fs.rmSync(notesPath, { force: true });
  const port = await freePort();
  const child = startServer(port);
  try {
    assert.equal(await waitForPort(port, child), true);
    const home = await request(port, 'GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.text, /id="notes-box"/);
    assert.match(home.text, /อ่านอย่างเดียว/);
    const mark = `mem-${Date.now()}`;
    const saved = await request(port, 'POST', '/api/notes', JSON.stringify({ text: mark }));
    assert.equal(saved.status, 201);
    const listed = await request(port, 'GET', '/api/notes');
    assert.equal(listed.status, 200);
    assert.ok(listed.text.includes(mark));
    assert.equal(fs.existsSync(notesPath), false);
  } finally {
    stop(child);
  }

  const again = await freePort();
  const restarted = startServer(again);
  try {
    assert.equal(await waitForPort(again, restarted), true);
    const after = await request(again, 'GET', '/api/notes');
    assert.equal(after.status, 200);
    assert.equal(after.text.includes('mem-'), false);
    assert.equal(fs.existsSync(notesPath), false);
  } finally {
    stop(restarted);
  }
});

test('Vercel mode refuses note writes and invalid JSON still crashes the local server', async () => {
  fs.rmSync(notesPath, { force: true });
  const vercelPort = await freePort();
  const vercel = startServer(vercelPort, { VERCEL: '1' });
  try {
    assert.equal(await waitForPort(vercelPort, vercel), true);
    const posted = await request(vercelPort, 'POST', '/api/notes', JSON.stringify({ text: 'nope' }));
    assert.equal(posted.status, 405);
    assert.match(posted.text, /NOTES_READONLY/);
    const listed = await request(vercelPort, 'GET', '/api/notes');
    assert.match(listed.text, /readonly/);
    assert.equal(fs.existsSync(notesPath), false);
  } finally {
    stop(vercel);
  }

  const port = await freePort();
  const child = startServer(port);
  try {
    assert.equal(await waitForPort(port, child), true);
    await request(port, 'POST', '/api/notes', 'not-json');
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && child.exitCode === null) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.notEqual(child.exitCode, null);
  } finally {
    stop(child);
  }
});

test('starter quality gate is red 0/6', { timeout: 40000 }, async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['scripts/quality-gate.js'], {
    cwd: repo,
    env: { ...process.env, PORT: String(port) },
  });
  let stdout = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stdout += chunk;
  });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 2, stdout);
  for (const name of [
    'data-quality',
    'summary-matches-valid-rows',
    'bad-json-does-not-crash',
    'health-no-secrets',
    'notes-validation',
    'notes-persists',
  ]) {
    assert.match(stdout, new RegExp(`FAIL \\| ${name}`), stdout);
  }
  assert.match(stdout, /quality gate: 6 of 6 cases failed/);
  assert.equal(stdout.includes(['sales', '.csv'].join('')), false);
});

function writeFakeBin(dir, name, body) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, { mode: 0o755 });
  return file;
}

test('bash machine check hides keys and fails when the Anthropic key is set', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'machine-bins-'));
  writeFakeBin(dir, 'node', '#!/bin/sh\necho v22.23.4\n');
  writeFakeBin(dir, 'claude', '#!/bin/sh\necho "2.1.300 (Claude Code)"\n');
  writeFakeBin(dir, 'opencode', '#!/bin/sh\necho 1.2.3\n');
  writeFakeBin(dir, 'duckdb', '#!/bin/sh\necho v1.1.0\n');
  const sentinel = 'openrouter-hidden-sentinel-do-not-print-value';
  const anthropic = 'anthropic-hidden-sentinel-do-not-print-value';
  const env = {
    ...process.env,
    PATH: `${dir}:${process.env.PATH}`,
    OPENROUTER_API_KEY: sentinel,
    ANTHROPIC_API_KEY: '',
  };
  const pass = spawnSync('bash', ['scripts/check-machine.sh'], { cwd: repo, env, encoding: 'utf8' });
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /check-machine: passed/);
  assert.match(pass.stdout, /value hidden/);
  assert.equal(pass.stdout.includes(sentinel), false);
  assert.equal(pass.stderr.includes(sentinel), false);

  const fail = spawnSync('bash', ['scripts/check-machine.sh'], {
    cwd: repo,
    env: { ...env, ANTHROPIC_API_KEY: anthropic },
    encoding: 'utf8',
  });
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /ANTHROPIC_API_KEY is set/);
  assert.equal(fail.stdout.includes(anthropic), false);
  assert.equal(fail.stdout.includes(sentinel), false);
  assert.equal(`${fail.stderr}`.includes(anthropic), false);
});
