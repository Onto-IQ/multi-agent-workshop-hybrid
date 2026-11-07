#!/usr/bin/env node
// cost-gate — ตรวจงบจากไฟล์ JSON (เช่นผลของ `claude -p --output-format json`)
// ใช้: node scripts/cost-gate.js <file.json>
// exit 0 = อยู่ในเพดาน (PASS), exit 2 = เกินเพดานหรืออ่านค่าไม่ได้ (FAIL)
// อ่านไฟล์ในเครื่องอย่างเดียว ไม่เรียกเน็ต
'use strict';

const fs = require('fs');

const MAX_COST_USD = 2;
const MAX_OUTPUT_TOKENS = 20000;

function fail(msg) {
  console.log(`FAIL | cost-gate | ${msg}`);
  process.exit(2);
}

// รองรับทั้งค่าที่ระดับบนสุดและใน usage (รูปแบบผลของ Claude Code)
function pick(obj, key) {
  if (obj && typeof obj === 'object') {
    if (key in obj) return obj[key];
    if (obj.usage && typeof obj.usage === 'object' && key in obj.usage) return obj.usage[key];
  }
  return undefined;
}

function toNumber(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const file = process.argv[2];
if (!file) fail('ไม่ได้ระบุไฟล์ — ใช้: node scripts/cost-gate.js <file.json>');

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  fail(`อ่าน ${file} ไม่ได้หรือไม่ใช่ JSON (${err.code || err.name})`);
}

const cost = toNumber(pick(data, 'total_cost_usd'));
const outTokens = toNumber(pick(data, 'output_tokens'));

// ไม่มีค่า = พิสูจน์ไม่ได้ว่าอยู่ในงบ จึงถือว่า FAIL
if (cost === null) fail('ไม่พบ total_cost_usd ที่เป็นตัวเลข');
if (outTokens === null) fail('ไม่พบ output_tokens ที่เป็นตัวเลข');

const problems = [];
if (cost > MAX_COST_USD) problems.push(`total_cost_usd=${cost} > ${MAX_COST_USD}`);
if (outTokens > MAX_OUTPUT_TOKENS) problems.push(`output_tokens=${outTokens} > ${MAX_OUTPUT_TOKENS}`);

if (problems.length) fail(problems.join('; '));

console.log(
  `PASS | cost-gate | total_cost_usd=${cost} (<= ${MAX_COST_USD}); output_tokens=${outTokens} (<= ${MAX_OUTPUT_TOKENS})`
);
process.exit(0);
