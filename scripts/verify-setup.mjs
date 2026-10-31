#!/usr/bin/env node
/**
 * Registry Insight app machine and app check.
 * Run from this repo:
 *   node scripts/verify-setup.mjs
 *
 * Flags: --skip-claude --skip-opencode --skip-openrouter --claude-prompt
 *
 * Never prints API key values. OPENROUTER_API_KEY must be set.
 * ANTHROPIC_API_KEY must be empty so the class Claude login is used.
 * DuckDB missing is a warning until Lab 05.
 */

import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const skipClaude = args.has('--skip-claude');
const skipOpencode = args.has('--skip-opencode');
const skipOpenrouter = args.has('--skip-openrouter');
const claudePrompt = args.has('--claude-prompt');

const problems = [];

function note(message) {
  console.log(`OK   | ${message}`);
}

function warn(message) {
  console.log(`WARN | ${message}`);
}

function bad(message) {
  problems.push(message);
  console.log(`FAIL | ${message}`);
}

function parseVersion(text) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text || '');
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

function atLeast(found, minimum) {
  if (!found) return false;
  for (let i = 0; i < minimum.length; i += 1) {
    if (found[i] > minimum[i]) return true;
    if (found[i] < minimum[i]) return false;
  }
  return true;
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

function get(port, route) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: route, timeout: 4000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

function runNode(nodeArgs, cwd, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, nodeArgs, { cwd, env });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout }));
  });
}

async function commandVersion(bin, binArgs) {
  try {
    const result = await exec(bin, binArgs, { windowsHide: true });
    return `${result.stdout || ''}${result.stderr || ''}`.trim();
  } catch {
    return null;
  }
}

function runProcess(bin, binArgs, cwd) {
  return new Promise((resolve) => {
    const child = spawn(bin, binArgs, { cwd: cwd || repo, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 45000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function main() {
  console.log(`verify-setup (workshop) · ${repo}`);

  if (existsSync(path.join(repo, 'labs', 'lab-00-readiness'))) {
    bad('this folder looks like the course repo (has labs/lab-00-readiness). cd to the workshop app repo and run again.');
  }

  if (existsSync(path.join(repo, 'server.js')) && existsSync(path.join(repo, 'package.json'))) {
    note('workshop app files found (server.js + package.json)');
  } else {
    bad('missing server.js or package.json — you are not in the workshop app root');
  }

  if (
    existsSync(path.join(repo, 'data', 'raw', 'dbd-2558.parquet'))
    && existsSync(path.join(repo, 'data', 'warehouse.duckdb'))
    && existsSync(path.join(repo, 'data', 'dataset.csv'))
  ) {
    note('real dataset present (dataset.csv + dbd-2558.parquet + warehouse.duckdb)');
  } else {
    bad('data incomplete: expected data/dataset.csv, data/raw/dbd-2558.parquet, and data/warehouse.duckdb');
  }

  if (existsSync(path.join(repo, 'vercel.json')) || existsSync(path.join(repo, 'api'))) {
    bad('starter must not ship vercel.json or api/ — learners create those in Lab 11');
  } else {
    note('no root vercel.json or api/ yet (Lab 11 creates them)');
  }

  if (existsSync(path.join(repo, '.mcp.json'))) {
    warn('`.mcp.json` is present — day-1 starter should not have it. The trainer demonstrates MCP.');
  } else {
    note('no project `.mcp.json` yet (expected on day 1)');
  }

  const nodeVersion = parseVersion(process.version);
  if (atLeast(nodeVersion, [20, 0, 0])) note(`node ${process.version}`);
  else bad(`node ${process.version} is below 20`);

  const gitText = await commandVersion('git', ['--version']);
  if (gitText) note(gitText.split('\n')[0]);
  else bad('git is not on PATH');

  const duckText = await commandVersion('duckdb', ['--version']);
  if (duckText) note(`duckdb ${duckText.split('\n')[0]}`);
  else warn('duckdb is not on PATH. Install the DuckDB CLI before Lab 05. This warning does not fail the check.');

  const uvText = await commandVersion('uvx', ['--version']);
  if (uvText) note(`uvx ${uvText.split('\n')[0]} (trainer MCP demo only)`);
  else warn('uv/uvx is not on PATH — only the trainer MCP demo needs it');

  if (skipClaude) warn('skipped Claude Code checks (--skip-claude)');
  else {
    const claudeText = await commandVersion('claude', ['--version']);
    const claudeVersion = parseVersion(claudeText || '');
    if (!claudeText) bad('claude is not on PATH. Install with: npm install -g @anthropic-ai/claude-code');
    else if (!atLeast(claudeVersion, [2, 1, 296])) bad(`${claudeText.split('\n')[0]} is below 2.1.296. Run: claude update`);
    else note(claudeText.split('\n')[0]);

    if (claudePrompt && claudeText && atLeast(claudeVersion, [2, 1, 296])) {
      const prompt = await runProcess('claude', ['-p', 'Reply with exactly: CLAUDE-OK'], repo);
      if (prompt.code === 0 && prompt.stdout.includes('CLAUDE-OK')) note('claude -p returned CLAUDE-OK');
      else bad('claude -p did not return CLAUDE-OK. Log in with the class account, and keep ANTHROPIC_API_KEY empty.');
    }
  }

  if (skipOpencode) warn('skipped OpenCode checks (--skip-opencode)');
  else {
    const opencodeText = await commandVersion('opencode', ['--version']);
    if (!opencodeText) bad('opencode is not on PATH. See the course SETUP.md');
    else note(opencodeText.split('\n')[0]);
  }

  const anthropic = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (anthropic) bad('ANTHROPIC_API_KEY is set. Unset it so the class Claude login is used. Value not printed.');
  else note('ANTHROPIC_API_KEY is empty');

  if (skipOpenrouter) warn('skipped OpenRouter key check (--skip-openrouter)');
  else {
    const key = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!key) bad('OPENROUTER_API_KEY is empty. Set the key from the training center in your user environment. Never commit it.');
    else if (key.length >= 20) note(`OPENROUTER_API_KEY is set (${key.length} characters, value hidden)`);
    else bad(`OPENROUTER_API_KEY looks too short (${key.length} characters, value hidden)`);
  }

  if (await portOpen(3000)) warn('port 3000 is in use. Stop that process or set PORT before npm start');
  else note('port 3000 is free');

  const appPort = await freePort();
  const server = spawn(process.execPath, ['server.js'], {
    cwd: repo,
    env: { ...process.env, PORT: String(appPort) },
    stdio: 'ignore',
  });
  try {
    let status = 0;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && status !== 200) {
      try {
        status = await get(appPort, '/');
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (status === 200) note(`app homepage responded on port ${appPort}`);
    else bad('app server did not serve /');
  } finally {
    if (server.exitCode === null) server.kill('SIGKILL');
  }

  const gatePort = await freePort();
  const gate = await runNode(['scripts/quality-gate.js'], repo, { ...process.env, PORT: String(gatePort) });
  if (gate.code === 2 && gate.stdout.includes('FAIL | data-quality')) {
    note('starter quality gate exits 2 (intended day-1 state)');
  } else {
    bad(`starter quality gate expected exit 2 with data-quality FAIL, got exit ${gate.code}`);
  }

  if (problems.length > 0) {
    console.log(`verify-setup (workshop): ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log('verify-setup (workshop): passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
