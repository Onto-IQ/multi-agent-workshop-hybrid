#!/usr/bin/env node
// PreToolUse hook (matcher: Bash) — อ่าน JSON จาก stdin แล้ว exit 2 เมื่อคำสั่งอันตราย
// exit 0 = ปล่อยผ่าน, exit 2 = บล็อก (ข้อความใน stderr ถูกส่งกลับให้ Claude)
'use strict';

// คำสั่งที่ต้องผ่านเสมอ (ตรงตัวทั้งบรรทัด) — ถ้ามีอะไรต่อท้าย เช่น "; rm -rf" จะไม่เข้ากลุ่มนี้
const ALLOW = [
  /^\s*node\s+(\.\/)?server\.js\s*$/,
  /^\s*node\s+(\.\/)?scripts\/quality-gate\.js\s*$/,
];

const RULES = [
  // rm -rf / rm -fr / rm -r -f / rm --recursive --force
  { name: 'rm -rf', re: /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\b/i },
  { name: 'rm -r -f', re: /\brm\s+(?:\S+\s+)*?(?:-r|-R|--recursive)\b(?:\s+\S+)*?\s+(?:-f|--force)\b/ },
  { name: 'rm -f -r', re: /\brm\s+(?:\S+\s+)*?(?:-f|--force)\b(?:\s+\S+)*?\s+(?:-r|-R|--recursive)\b/ },
  { name: 'taskkill', re: /\btaskkill(?:\.exe)?\b/i },
  // Remove-Item ... -Recurse (และชื่อย่อ rm/ri/del/rd/rmdir/erase ฝั่ง PowerShell ที่มี -Recurse)
  { name: 'Remove-Item -Recurse', re: /\b(?:Remove-Item|ri|rd|rmdir|del|erase)\b[^\n;|&]*\s-Rec(?:urse|urs|ur|u)?\b/i },
  // ... | sh / bash / zsh / dash / ksh / pwsh / powershell / iex
  { name: 'pipe into shell', re: /\|\s*(?:sudo\s+)?(?:\/usr\/bin\/|\/bin\/)?(?:sh|bash|zsh|dash|ksh)\b/i },
  { name: 'pipe into PowerShell', re: /\|\s*(?:pwsh|powershell|iex|Invoke-Expression)\b/i },
];

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

function check(command) {
  if (typeof command !== 'string' || command.trim() === '') return null;
  if (ALLOW.some((re) => re.test(command))) return null;
  for (const rule of RULES) {
    if (rule.re.test(command)) return rule.name;
  }
  return null;
}

module.exports = { check };

if (require.main === module) {
  readStdin().then((raw) => {
    let input;
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      // อ่าน JSON ไม่ได้ = ไม่รู้ว่าคำสั่งคืออะไร ปิดทางไว้ก่อน
      process.stderr.write('block-dangerous-bash: stdin ไม่ใช่ JSON ที่ถูกต้อง — บล็อกไว้ก่อน\n');
      process.exit(2);
    }
    const command = input && input.tool_input && input.tool_input.command;
    const hit = check(command);
    if (hit) {
      process.stderr.write(
        `block-dangerous-bash: บล็อกคำสั่งอันตราย (${hit}). ` +
          'ถ้าจำเป็นจริง ให้ผู้เรียนรันเองหลังตรวจแล้ว\n'
      );
      process.exit(2);
    }
    process.exit(0);
  });
}
