#!/usr/bin/env node
// TaskCompleted hook — อ่าน JSON จาก stdin แล้ว exit 2 ถ้า qualityGatePassed ไม่ใช่ true
// ต้องเป็น boolean true ตรงตัว ("true", 1, หรือไม่มีฟิลด์ ถือว่าไม่ผ่าน)
'use strict';

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

// หา qualityGatePassed ที่ระดับบนสุดก่อน แล้วค่อยดูใน object ย่อยที่พบบ่อย
function findFlag(input) {
  if (!input || typeof input !== 'object') return undefined;
  if ('qualityGatePassed' in input) return input.qualityGatePassed;
  for (const key of ['task', 'metadata', 'result', 'tool_input']) {
    const v = input[key];
    if (v && typeof v === 'object' && 'qualityGatePassed' in v) return v.qualityGatePassed;
  }
  return undefined;
}

module.exports = { findFlag };

if (require.main === module) {
  readStdin().then((raw) => {
    let input;
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      process.stderr.write('task-completed-gate: stdin ไม่ใช่ JSON ที่ถูกต้อง — ยังปิดงานไม่ได้\n');
      process.exit(2);
    }
    if (findFlag(input) !== true) {
      process.stderr.write(
        'task-completed-gate: qualityGatePassed ไม่ใช่ true — รัน `npm run gate` ให้ได้ exit 0 (6/6) ก่อนปิดงาน\n'
      );
      process.exit(2);
    }
    process.exit(0);
  });
}
