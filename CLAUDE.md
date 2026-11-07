# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Registry Insight App

แดชบอร์ดธุรกิจจดทะเบียนใหม่ในไทย สำหรับคลาสไฮบริด **Claude Code + OpenCode** (12–13 พฤศจิกายน 2026) สร้างจากข้อมูลจริง "นิติบุคคลที่จดทะเบียนจัดตั้งใหม่ พ.ศ. 2558" ของกรมพัฒนาธุรกิจการค้า จาก [data.go.th](https://data.go.th) ข้อมูลดิบอยู่ใน `data/raw/dbd-2558.parquet` ตารางแบนที่แอปอ่านคือ `data/dataset.csv` เซิร์ฟเวอร์ท้องถิ่นคือ `server.js` (Node `http` ล้วน ห้ามเพิ่ม dependency ของแอป) งานข้อมูลใช้ DuckDB ตามแล็บ

กติกาชุดเดียวกับไฟล์นี้อยู่ใน `AGENTS.md` สำหรับ OpenCode ถ้าแก้กฎฝั่งหนึ่ง ให้อัปเดตอีกฝั่งให้ตรงกัน

## ภาพรวม

- `server.js` — เซิร์ฟเวอร์ HTTP บนเครื่องผู้เรียน ฟังที่ `127.0.0.1` เท่านั้น: `/api/summary`, `/api/health`, `/api/notes`, หน้าเว็บจาก `web/`
- ทางขึ้นของจริงใน Lab 11 คือ `api/summary.js`, `api/health.js`, `api/notes.js` ไม่ใช่การเอา `server.js` ไปฟังพอร์ตบน Vercel
- ชุดเริ่มยังไม่มี `vercel.json` และไม่มีโฟลเดอร์ `api/` ผู้เรียนสร้างเองใน Lab 11 วิธีแนบ `data/dataset.csv` (ประมาณ 8 MB) ผ่าน `includeFiles` อยู่ที่ `reference/vercel/README.md` อย่าคัดลอกไฟล์นั้นขึ้นรากโปรเจกต์ก่อนแล็บนั้น
- `data/dataset.csv` — ตารางแบนที่แอปอ่าน (ชุดเริ่มต้นยังไม่สะอาด)
- `lib/inspect-data.js` — กฎคุณภาพข้อมูลและตัวคำนวณยอดอ้างอิง (ชุดเดียวกับ quality gate)
- วันแรกยังไม่มี `.mcp.json` วิทยากรสาธิต DuckDB MCP เอง
- `scripts/quality-gate.js` — เกณฑ์ตรวจ 6 เคส ห้ามแก้ไฟล์นี้

## คำสั่ง

```bash
npm start                 # http://127.0.0.1:3000  (Windows: $env:PORT = 3001; npm start)
npm run gate              # quality gate 6 เคส — exit 0 = ผ่านครบ, exit 2 = ยังมีเคสแดง
npm test                  # node --test scripts/test-starter.js — ตรวจว่า "ชุดเริ่ม" ยังอยู่ในสภาพตั้งต้น
npm run verify            # ตรวจเครื่อง (claude, opencode, Node >= 20, DuckDB, คีย์) + เปิดแอป
node --test --test-name-pattern="red 0/6" scripts/test-starter.js   # รันเทสต์เดียว
```

- ด่านบูต `server.js` เองเป็น child process ที่ `PORT` (ค่าเริ่ม 3000) ถ้าพอร์ตถูกใช้อยู่ ทุกเคสฝั่งเซิร์ฟเวอร์จะ FAIL ทันที — ปิด `npm start` ก่อนรัน `npm run gate`
- `npm test` เป็นเทสต์ของ**สภาพชุดเริ่ม** (ด่านต้องแดง 0/6, `server.js` ห้ามมี `writeFile`, POST JSON เสียต้องยังทำเซิร์ฟเวอร์ล่ม, ไม่มี `vercel.json`/`api/`/`.mcp.json`) เทสต์เหล่านี้จะล้มตามธรรมชาติเมื่อแล็บแก้งาน ใช้ `npm run gate` เป็นตัววัดความคืบหน้า ไม่ใช่ `npm test`
- เทสต์ `rules match on both tools` บังคับให้ทั้ง `CLAUDE.md` และ `AGENTS.md` มีคำ `scripts/quality-gate.js`, `data/notes.json`, `VERCEL`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `notes-persists` — อย่าลบออกตอนแก้กติกา

## ด่านเชื่อมกับโค้ดอย่างไร

- `data-quality` เรียก `analyze()` ใน `lib/inspect-data.js` กับ `data/dataset.csv` ต้องได้ 0 violations: หัวตารางต้องเป็น `month,seq,reg_no,company_name,reg_date,capital,objective,address,province` ตรงตัว (คอลัมน์ `province` ต้องเป็นชื่อจังหวัดที่อยู่ใน `PROVINCE_REGION`), `reg_date` เป็น ISO ค.ศ., `capital` เป็นตัวเลขไม่มีลูกน้ำ, `reg_no` 13 หลักไม่ซ้ำ ใช้ `extractProvince()` ในไฟล์เดียวกันเป็นตัวอ้างอิงการแยกจังหวัดจากที่อยู่ พจนานุกรมคอลัมน์อยู่ที่ `data/README.md`
- `summary-matches-valid-rows` เทียบ `companyCount` และ `totalCapital` จาก `/api/summary` แบบ `===` กับ `analyze().stats` (ปัดเศษผ่าน `roundMoney` สะสมทีละแถว) ทางที่ปลอดภัยคือให้ `server.js` เรียก `analyze()` ตัวเดียวกัน แทน `naiveRecords`/`naiveMoney` ของชุดเริ่ม (ซึ่งแยกด้วย `split(',')` และอ่านคอลัมน์ `capital_raw` ที่ไม่มีอยู่) — `lib/csv.js` คือตัวอ่าน CSV ที่รองรับเครื่องหมายคำพูดสำหรับแอป
- `bad-json-does-not-crash` / `notes-validation`: POST `not-json` ต้องไม่ทำให้ process ตาย, `{nope:1}` ต้องได้ 400, `{text}` ต้องได้ 201/200
- `health-no-secrets`: ผลของ `/api/health` ต้องมี `ok: true` และห้ามมีข้อความ `sk-` หรือ `sampleToken`
- `notes-persists`: ด่าน kill แล้วบูตเซิร์ฟเวอร์ใหม่จริง แล้วอ่าน `/api/notes` อีกรอบ
- ไฟล์ตัวอย่างของ Lab 11 อยู่ใน `reference/vercel/*.example.js(on)` — ใช้เป็นต้นแบบตอนสร้าง `api/` เท่านั้น

## แผนที่คลาส

จุดเริ่มแดง 0/6 ตามดีไซน์ ปลายทางคือ quality gate 6/6 แล้วยอดจริง (16,772 กิจการ / ทุนรวม 45,341,868,784 บาท) พร้อม URL บน Vercel

1. **Lab 01** — อ่านกติกานี้และ `AGENTS.md` ยังไม่แก้ `server.js`
2. **Lab 02** — สำรวจพร้อมกันบน Claude Code ส่งรายงาน ไม่แก้ไฟล์
3. **Lab 03** — `data-researcher` อ่านอย่างเดียวทั้ง Claude Code และ OpenCode
4. **Lab 04** — ห้ามแก้ `scripts/quality-gate.js` และห้าม `git push`
5. **Lab 05** — OpenCode ทำความสะอาดข้อมูลและยอดสรุป บั๊กโน้ตยังอยู่
6. **Lab 06** — Claude Code ปิดด่านให้ครบ 6/6
7. **Lab 07** — กันคำสั่งอันตรายและงบ ด่านยัง 6/6
8. **Lab 08** — เช็กลิสต์บน Claude, ความจำข้ามรอบบน OpenCode
9. **Lab 09** — ฟีเจอร์ของตัวเอง ย่อได้ ด่านยังเขียว
10. **Lab 10** — ทีมปิดงาน สรุปภาษาไทยไม่เกิน 400 คำ
11. **Lab 11** — สร้าง `api/` กับ `vercel.json` แล้ว deploy โน้ตบนของจริงเป็นอ่านอย่างเดียว

บทเรียนอยู่ที่ https://github.com/Onto-IQ/build-ai-multi-agent-hybrid เปิด `claude` และ `opencode` ที่โฟลเดอร์แอปนี้เท่านั้น

## เครื่องมือ

- **Claude Code** ใช้บัญชีของศูนย์ฝึก `ANTHROPIC_API_KEY` ต้องว่างเสมอ ห้ามใส่คีย์นี้ในไฟล์หรือบน Vercel
- **OpenCode** เรียกโมเดลผ่าน OpenRouter คีย์อยู่ที่ตัวแปร `OPENROUTER_API_KEY` ของเครื่อง `opencode.json` อ้าง `{env:OPENROUTER_API_KEY}` เท่านั้น ห้าม commit ค่าคีย์
- รูปแบบ `permission` ของ OpenCode เปลี่ยนตามรุ่น คอมเมนต์ใน `opencode.json` อธิบายความต่างของรุ่น 1 และรุ่น 2 ถ้าไฟล์ตั้งค่าบ่น ให้ปรับตามข้อความ error แต่ยังต้องห้ามแก้ด่านและห้าม `git push`

## Quality gate — `npm run gate`

หกเคส: `data-quality` · `summary-matches-valid-rows` · `bad-json-does-not-crash` · `health-no-secrets` · `notes-validation` · `notes-persists`

- จุดเริ่มต้นแดง 0/6 **ตามดีไซน์** — ข้อมูลยังดิบ ตัวรับ POST พัง และ `/api/health` ปล่อยของที่ไม่ควรปล่อย
- ก่อนบอกว่าพร้อมส่งมอบอะไร ให้รัน `npm run gate` แล้วรายงาน exit code จริงเสมอ
- เคส `notes-persists` ต้องยังเข้ม: โน้ตบนเครื่องผู้เรียนต้องอยู่รอดหลังรีสตาร์ทเพราะถูกเขียนลง `data/notes.json` ห้ามทำให้เคสนี้ผ่านด้วยค่าในหน่วยความจำ

## โน้ต

- บนเครื่องผู้เรียน โน้ตที่บันทึกต้องอยู่รอดจากการรีสตาร์ทเซิร์ฟเวอร์ เก็บลง `data/notes.json`
- บน Vercel (`process.env.VERCEL`) โน้ตเป็นอ่านอย่างเดียว ห้าม `writeFile`, `appendFile` หรือ `createWriteStream` ดิสก์ของฟังก์ชันไม่ได้รับปากว่าจะอยู่ถึงคำขอถัดไป
- ชุดเริ่มเก็บโน้ตแค่ในหน่วยความจำเพื่อให้ด่านข้อนี้ยังแดง จนกว่าแล็บจะแก้

## กติกา

- ตอบเป็นภาษาของผู้ถาม ชื่อไฟล์ ชื่อ endpoint และชื่อฟิลด์คงภาษาอังกฤษ
- งานสำรวจห้ามแก้ไฟล์
- แอปห้ามเพิ่ม dependency npm เว้นแต่จะถูกขอ — งานข้อมูลใช้ DuckDB (CLI หรือ MCP) เท่านั้น
- อย่าแนะนำ Express, ฐานข้อมูล หรือแพ็กเกจ npm เว้นแต่จะถูกขอ
- อย่าอ่านหรือคัดลอกค่าที่ขึ้นต้นด้วย `sk-` ออกไปนอกโปรเจกต์ และห้ามพิมพ์ค่าเหล่านี้ออกมาในคำตอบ, log หรือผลคำสั่ง (ถ้าจำเป็นต้องอ้างถึง ให้ปิดเป็น `sk-***`)
- ห้ามแก้ `scripts/quality-gate.js` — ตัวตรวจตายตัว
- ห้าม `git push` เอง เว้นแต่ผู้เรียนสั่งหลังดู diff แล้ว
- ห้ามตั้ง `ANTHROPIC_API_KEY` หรือ `OPENROUTER_API_KEY` บน Vercel
