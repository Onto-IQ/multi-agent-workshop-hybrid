# QA Report — Registry Insight

วันที่ตรวจ: 2026-11-07 · branch `lab-run` (HEAD `85ef985`) · Windows + Git Bash · Node v26.13.0
ผู้ตรวจ: agent `qa` (อ่านอย่างเดียว ไม่แก้ `server.js` และ `scripts/quality-gate.js`)

> ค่าใดที่ขึ้นต้นด้วย `sk-` ในรายงานนี้ถูกปิดเป็น `sk-***` ทั้งหมด

## สรุปผล

- **Quality Gate Exit Code: 2** (มีด่าน FAIL)
- ด่านที่ PASS: **2/6** (`data-quality`, `summary-matches-valid-rows`)
- ด่านที่ FAIL: **4/6** (`bad-json-does-not-crash`, `health-no-secrets`, `notes-validation`, `notes-persists`)
- ก่อนรันตรวจแล้วว่าพอร์ต 3000 ว่าง และยังไม่มีไฟล์ `data/notes.json`

ผลดิบจาก `npm run gate`:

```
PASS | data-quality | 0 violations, valid companies=16772
FAIL | bad-json-does-not-crash | bad=read ECONNRESET; health=connect ECONNREFUSED 127.0.0.1:3000; dead=true
PASS | summary-matches-valid-rows | serverCompanies=16772 expected=16772 serverCapital=45341868784 expected=45341868784
FAIL | health-no-secrets | status=200; leaks=yes
FAIL | notes-validation | nope=201 (want 400); text=201 (want 201); dead=false
FAIL | notes-persists | post=201; survives-restart=no
quality gate: 4 of 6 cases failed
EXIT=2
```

## ผลลัพธ์แต่ละด่าน

| # | ด่าน | สถานะ | รายละเอียด |
|---|------|-------|-----------|
| 1 | `data-quality` | PASS | 0 violations, 16,772 กิจการ |
| 2 | `bad-json-does-not-crash` | FAIL | POST `not-json` แล้วโปรเซสตาย (`dead=true`) — ดูจุดที่ 1 |
| 3 | `summary-matches-valid-rows` | PASS | 16,772 กิจการ / ทุนรวม 45,341,868,784 ตรงกับ `analyze().stats` |
| 4 | `health-no-secrets` | FAIL | `leaks=yes` — ดูจุดที่ 2 |
| 5 | `notes-validation` | FAIL | `{nope:1}` ได้ **201** แทน 400 — ดูหัวข้อ "ปัญหาเพิ่มเติม" |
| 6 | `notes-persists` | FAIL | `survives-restart=no` — ดูจุดที่ 3 |

## วิธีทดสอบด้วยมือ

บูต `PORT=3100 node server.js` แล้วยิงคำขอแบบเดียวกับ `scripts/quality-gate.js` ด้วย `curl` ทุกโปรเซสที่เปิดถูก kill แล้ว และตรวจซ้ำว่าไม่มีโปรเซสฟังพอร์ต 3000/3100 ค้างอยู่

## จุดที่ผิด (3 จุด)

### จุดที่ 1: POST ที่ไม่ใช่ JSON ทำให้โปรเซสล่ม

- **โค้ด**: `server.js:154-161` — ใน handler `req.on('end', ...)` บรรทัด `server.js:158` เรียก `const body = JSON.parse(raw);` โดยไม่มี try/catch (คอมเมนต์ `server.js:155` ระบุไว้เองว่าเป็น starter bug) exception เกิดใน event callback จึงไม่มีใครจับ และ Node ปิดโปรเซสทั้งตัว
- **ด่าน**: `scripts/quality-gate.js:197` POST `'not-json'` ไปที่ `/api/notes` → `:198` รอ 200 ms → `:199` GET `/api/health` → `:200` ผ่านได้ต้อง `!childDead()` และ health ตอบ 200 พร้อม `ok: true`
- **สิ่งที่สังเกตได้** (พอร์ต 3100):
  ```
  POST /api/notes  body=not-json   -> HTTP 000, curl exit 56 (connection reset)
  process DEAD exit=1
  GET  /api/health                 -> HTTP 000, curl exit 7 (connection refused)
  ```
  stack trace จาก stderr ของเซิร์ฟเวอร์:
  ```
  SyntaxError: Unexpected token 'o', "not-json" is not valid JSON
      at JSON.parse (<anonymous>)
      at IncomingMessage.<anonymous> (C:\dev\multi-agent-workshop-hybrid\server.js:158:25)
      at IncomingMessage.emit (node:events:514:20)
      at endReadableNT (node:internal/streams/readable:2147:12)
  ```
- **ผล**: ด่าน `bad-json-does-not-crash` FAIL (`dead=true`)

### จุดที่ 2: `/api/health` ปล่อยค่าตัวอย่างที่ขึ้นต้น `sk-`

- **โค้ด**: `server.js:36` ประกาศ `const SAMPLE_TOKEN = 'sk-***';` และ `server.js:129` ส่ง `sendJson(res, 200, { ok: true, sampleToken: SAMPLE_TOKEN })` คอมเมนต์ `server.js:127` บอกว่าของจริงต้องคืน `{ ok: true }` เท่านั้น
- **ด่าน**: `scripts/quality-gate.js:228-236` ต้องได้ 200, `ok === true` และข้อความต้องไม่มีทั้ง `sk-` และ `sampleToken`
- **สิ่งที่สังเกตได้** (ปิดค่าแล้ว):
  ```
  GET /api/health -> {"ok":true,"sampleToken":"sk-***"} [HTTP 200]
  ```
- **ผล**: ด่าน `health-no-secrets` FAIL (`leaks=yes`) แม้เป็นค่าตัวอย่างที่ไม่ใช่คีย์จริง แต่การมีฟิลด์นี้ใน response ถือว่ารั่วตามเกณฑ์

### จุดที่ 3: โน้ตไม่ถูกเซฟลงไฟล์จึงหายเมื่อเปิดใหม่

- **โค้ด**: `server.js:37` `const notes = [];` เป็นอาร์เรย์ในหน่วยความจำ, `server.js:159` `notes.push(...)` และ `server.js:145` GET คืนอาร์เรย์นี้ ไม่มีการอ่าน/เขียน `data/notes.json` ที่ใดในไฟล์ (คอมเมนต์ `server.js:156-157` ยอมรับไว้)
- **ด่าน**: `scripts/quality-gate.js:253-269` POST โน้ตที่มี mark ไม่ซ้ำ → GET ยืนยันว่ามี → `restartServer()` (`:143-147` kill แล้ว spawn ใหม่จริง) → GET อีกครั้งต้องยังเจอ mark
- **สิ่งที่สังเกตได้** (พอร์ต 3100):
  ```
  POST {"text":"qa-persist-check"} -> {"ok":true,"count":2} [HTTP 201]
  GET  /api/notes                  -> {"notes":[{"text":""},{"text":"qa-persist-check"}]}
  kill + บูตใหม่
  GET  /api/notes                  -> {"notes":[]} [HTTP 200]
  ls data/notes.json               -> No such file or directory
  ```
- **ผล**: ด่าน `notes-persists` FAIL (`survives-restart=no`)

## ปัญหาเพิ่มเติม: `notes-validation`

- **โค้ด**: `server.js:159` ไม่ตรวจว่ามีฟิลด์ `text` — ใช้ `String(body.text || '')` แล้ว push เสมอ จึงตอบ 201 ทุกกรณีที่ JSON ถูกรูปแบบ
- **ด่าน**: `scripts/quality-gate.js:243-250` ต้องได้ 400 สำหรับ `{"nope":1}` และ 201/200 สำหรับ `{"text":...}`
- **สิ่งที่สังเกตได้**: `{"nope":1}` → `{"ok":true,"count":1} [HTTP 201]` และมีโน้ตเปล่า `{"text":""}` ถูกบันทึกเข้าไป (เห็นใน GET ของจุดที่ 3) ส่วน `{"text":...}` ได้ 201 ถูกต้อง
- **ผล**: ด่าน `notes-validation` FAIL (`nope=201 (want 400)`)

## หมายเหตุเรื่องเลขบรรทัด

เลขบรรทัดที่ระบุใน `.claude/agents/qa.md` (154-169, 134-136, 161-167) ไม่ตรงกับ `server.js` ปัจจุบัน รายงานนี้ใช้เลขบรรทัดที่อ่านจากไฟล์จริง: 36, 37, 127-129, 145, 154-161 (จุด crash 158), 159

## คำแนะนำการแก้ไข

(รอบนี้ไม่แก้ `server.js` และห้ามแก้ `scripts/quality-gate.js`)

1. ครอบ `JSON.parse(raw)` ที่ `server.js:158` ด้วย try/catch แล้วตอบ 400 เมื่อ body ไม่ใช่ JSON
2. ตรวจว่า `body` เป็นออบเจกต์และ `typeof body.text === 'string'` ที่ไม่ว่าง ถ้าไม่ใช่ตอบ 400 (แก้ `notes-validation`)
3. ให้ `/api/health` (`server.js:129`) คืน `{ ok: true }` เท่านั้น และลบ `SAMPLE_TOKEN` ออกจากเส้นทางที่ตอบกลับ
4. บนเครื่องผู้เรียน โหลดโน้ตจาก `data/notes.json` ตอนบูต และเขียนไฟล์หลัง push สำเร็จ (ยังต้องคงพฤติกรรมอ่านอย่างเดียวเมื่อมี `process.env.VERCEL` — ห้าม `writeFile` ในกรณีนั้น)
5. หลังแก้ ให้ปิดเซิร์ฟเวอร์ที่พอร์ต 3000 ก่อน แล้วรัน `npm run gate` และรายงาน exit code จริง
