# Agents — Registry Insight (hybrid class)

ใช้คู่กับ `CLAUDE.md` กติกาต้องตรงกัน ถ้าแก้กฎฝั่งหนึ่ง ให้อัปเดตอีกฝั่ง

แอปนี้อยู่โฟลเดอร์นี้ บทเรียนและชุดตามให้ทันอยู่ที่ https://github.com/Onto-IQ/build-ai-multi-agent-hybrid อย่าคัดลอกเฉลยมาไว้ที่นี่

## ใครใช้อะไร

| งาน | เครื่องมือ |
|---|---|
| สำรวจ, ปิดด่าน 6/6, เช็กลิสต์, developer + teammates ลงมือสามสาย (Module 05), ความจำรายบทบาท `memory: project` (Module 10), planner / developer / qa ในวันปิดงาน | Claude Code บัญชีของศูนย์ฝึก |
| วางแผนสายการผลิต (`planner` เขียน `docs/TASKS.md`), ความจำกลาง `docs/MEMORY.md`, สรุปผู้บริหาร | OpenCode ผ่าน OpenRouter |
| ต่อ MCP DuckDB อ่านอย่างเดียว (Module 08) | Claude Code บัญชีของศูนย์ฝึก |

OpenCode อ่านคีย์จากตัวแปร `OPENROUTER_API_KEY` ผ่าน `opencode.json` (`{env:OPENROUTER_API_KEY}`) ห้ามวางค่าคีย์ลงไฟล์ `ANTHROPIC_API_KEY` ต้องว่าง เพื่อไม่ให้ทับบัญชี Claude ของคลาส

ชื่อโมเดลมาจาก `OPENCODE_MODEL` (ค่าเริ่มใน `.env.example` คือ `openrouter/anthropic/claude-sonnet-4.5`)

รูปแบบ permission ของ OpenCode เปลี่ยนตามรุ่น รุ่น 1 ใช้ `permission` กับ `bash` รุ่น 2 ใช้ `permissions` กับ `shell` ถ้ารุ่นที่ติดตั้งบ่น ให้ปรับตามข้อความ error แต่ยังต้องห้ามแก้ `scripts/quality-gate.js` และห้าม `git push` (ตอนนี้ `opencode.json` มีทั้ง `provider` ของรุ่น 1 และ `providers` ของรุ่น 2 พร้อมกัน อย่าถือว่าใช้ได้ทั้งสองรุ่น)

คีย์ของศูนย์ฝึกอีกตัวคือ `ONTOIQ_API_KEY` สำหรับ provider `ontoiq` (เกตเวย์ openai-compatible `https://model.ontoiq.tech/v1`) อ่านจากตัวแปรของเครื่องเช่นกัน model id ต้องตรงกับที่ `GET /v1/models` ตอบมา ห้ามวางค่าคีย์ทั้งสองลงไฟล์

## คำสั่ง

```bash
npm start            # เซิร์ฟเวอร์ที่ http://127.0.0.1:3000 (Windows: $env:PORT = 3001; npm start)
npm run gate         # ด่าน 6 เคส: exit 0 = ผ่านทุกเคส, exit 2 = ยังมีเคสแดง
npm test             # node --test scripts/test-starter.js ตรวจ "ชุดเริ่ม" ไม่ต้องมีคีย์
npm run verify       # ตรวจเครื่องและแอป (scripts/verify-setup.mjs)
npm run check-machine  # bash scripts/check-machine.sh (Windows ใช้ scripts/check-machine.ps1)
```

- ไม่มี build / lint / typecheck และรันเคสเดียวของด่านไม่ได้ — ให้รัน `npm run gate` ทั้งชุดเสมอ
- **`npm test` ตรวจว่าชุดเริ่มยังพังอยู่** มัน assert ว่าด่านแดง 0/6, `server.js` ไม่มี `writeFile`, และโน้ตยังอยู่ในหน่วยความจำเท่านั้น — เมื่อแก้แอปให้ผ่านแล้ว `npm test` จะแดงเองเป็นธรรมดา ให้ยึด `npm run gate` เป็นเกณฑ์ส่งมอบ อย่ารัน `npm test` แล้วสรุปว่างานพัง
- `npm run gate` spawn `node server.js` เองบน `PORT` (ค่าเริ่ม 3000) ถ้าพอร์ตถูกยึดอยู่ เช่นลืมปิด `npm start` เคสฝั่งเซิร์ฟเวอร์ 5 เคสจะตกพร้อมกันด้วยข้อความ `port 3000 is already in use` ให้ปิดเซิร์ฟเวอร์ก่อนรันด่าน
- `npm test` มี 1 เคสที่เรียก `bash scripts/check-machine.sh` ถ้า `bash` ไม่อยู่ใน PATH (เครื่อง Windows มักเป็นแบบนี้) เคสนั้นจะแดงด้วย `TypeError` เรื่อง status เป็น `NaN` ไม่ใช่ความผิดของโค้ดที่แก้ — เติม Git Bash เข้า PATH ชั่วคราวแล้วรันใหม่: `$env:PATH = "$env:ProgramFiles\Git\bin;$env:PATH"; npm test`
- งานข้อมูลใช้ DuckDB (CLI หรือ MCP) ถ้ายังไม่มี duckdb ใน PATH เป็นแค่คำเตือนตอน `npm run verify` แต่ต้องมีก่อนแล็บข้อมูล

## สถาปัตยกรรมที่ต้องอ่านหลายไฟล์ถึงจะเห็น

- ยอดของด่าน `summary-matches-valid-rows` เทียบกับ `analyze()` ใน `lib/inspect-data.js` ตรง ๆ ตัวตรวจด่านกับตัวคำนวณยอดอ้างอิงจึงเป็นกฎชุดเดียวกับเคส `data-quality` — `/api/summary` ต้องนับเฉพาะแถวที่ผ่าน `analyze()`
- **สัญญาคอลัมน์ขัดกันอยู่**: `lib/inspect-data.js` (`COLUMNS`) ต้องการ **9 คอลัมน์ รวม `province`** แต่ `data/README.md` ตารางสัญญาสะอาดเขียนไว้แค่ 8 ไม่มี `province` — ให้ยึด `lib/inspect-data.js` เพราะเป็นโค้ดที่ด่านเรียกจริง และอย่าแก้ `data/README.md` ให้ตรงกับของเก่า
- `server.js` ชุดเริ่มอ่าน CSV ด้วย `naiveRecords` (split ตามลูกน้ำ ไม่รองรับเครื่องหมายคำพูด) และอ่านคอลัมน์ `capital_raw` ซึ่งเป็นชื่อของ parquet ดิบ ส่วนตารางสะอาดใช้ `capital` ตาม `data/README.md` — ตัวอ่าน CSV ที่ถูกต้องมีอยู่แล้วใน `lib/csv.js` (`parseCsv`)
- `/api/health` ชุดเริ่มคืน `SAMPLE_TOKEN` (`sk-sample-not-a-real-key` ค่าตัวอย่าง ไม่ใช่คีย์จริง) จึงตกเคส `health-no-secrets` — ของจริงต้องคืนแค่ `{ ok: true }`
- `data/dataset.csv` ถูกเขียนทับได้ (ชุดเริ่มคือสำเนาดิบ) การทำความสะอาดคือ regenerate จาก `data/raw/dbd-2558.parquet` ผ่าน DuckDB (`data/warehouse.duckdb` มี view `businesses_raw`) ห้ามเพิ่ม dependency npm เพื่องานนี้
- `server.js` export `{ server, notesAreReadOnly }` และ `listen` เฉพาะเมื่อ `require.main === module` — โครงนี้ไว้ให้ `api/*.js` ใช้ `lib/` ร่วมกัน

## กติกา

- ตอบเป็นภาษาของผู้ถาม ชื่อไฟล์ ชื่อ endpoint และชื่อฟิลด์คงภาษาอังกฤษ
- งานสำรวจห้ามแก้ไฟล์
- แอปห้ามเพิ่ม dependency npm อย่าแนะนำ Express ฐานข้อมูล หรือแพ็กเกจ npm เว้นแต่จะถูกขอ
- ห้ามแก้ `scripts/quality-gate.js`
- ห้ามแก้ `CLAUDE.md` `opencode.json` และ `server.js` ในแล็บนี้ (ไฟล์ตั้งค่าของอีกเครื่องมือกับเซิร์ฟเวอร์ชุดเริ่ม ไม่ใช่งานที่ต้องแก้ตอนนี้)
- ห้าม `git push` เอง เว้นแต่ผู้เรียนสั่งหลังดู diff แล้ว
- ห้ามพิมพ์ค่าที่ขึ้นต้นด้วย `sk-` ในคำตอบ log หรือไฟล์ใหม่ และอย่าอ่านหรือคัดลอกค่าแบบนี้ออกไปนอกโปรเจกต์ (รวมถึงอย่าเปิดอ่าน `.env`)
- ก่อนบอกว่าเสร็จ ให้รัน `npm run gate` แล้วรายงาน exit code จริง
- บนเครื่องผู้เรียน โน้ตต้องถูกเขียนลง `data/notes.json` เพื่อให้ด่าน `notes-persists` ผ่านหลังรีสตาร์ท ห้ามทำให้ด่านนี้หลวม
- บน Vercel (`process.env.VERCEL`) โน้ตเป็นอ่านอย่างเดียว ห้ามเขียนไฟล์ และห้ามตั้ง `ANTHROPIC_API_KEY` หรือ `OPENROUTER_API_KEY`
- ทางขึ้นของจริงคือ `api/*.js` ที่ผู้เรียนสร้างใน Lab 11 ไม่ใช่การเอา `server.js` ไปฟังพอร์ตบน Vercel อย่าสร้าง `vercel.json` หรือโฟลเดอร์ `api/` ก่อนแล็บนั้น ตัวอย่างรวม `data/dataset.csv` (~7.3 MB) ด้วย `includeFiles` อยู่ที่ `reference/vercel/README.md`
