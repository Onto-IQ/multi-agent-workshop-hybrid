# PRODUCT-SPEC — Registry Insight App

สเปกนี้บรรยายแอป **ตามสภาพปัจจุบัน** บน branch `lab-run` (หลังคอมมิต M11) ทุกข้ออ้างอิง `file:line` ที่อ่านจริง ข้อที่ยังไม่ได้ตรวจซ้ำในรอบนี้เขียนว่า "ยังไม่ยืนยัน"

## 1. แอปนี้คืออะไร

- แดชบอร์ดธุรกิจจดทะเบียนใหม่ในไทย จากข้อมูล "นิติบุคคลที่จดทะเบียนจัดตั้งใหม่ พ.ศ. 2558" ของกรมพัฒนาธุรกิจการค้า (data.go.th) — `data/README.md:3`
- เซิร์ฟเวอร์ท้องถิ่น Node `http` ล้วน ไม่มี dependency — `server.js:23-27`, `package.json:12-19` (ไม่มีฟิลด์ `dependencies`)
- ฟังที่ `127.0.0.1` พอร์ต `PORT` (ค่าเริ่ม 3000) — `server.js:29-30`, `server.js:228-232`
- Node >= 20 — `package.json:9-11`

## 2. ข้อมูล

| รายการ | ค่า | ที่มา |
|---|---|---|
| ไฟล์ที่แอปอ่าน | `data/dataset.csv` | `server.js:32` |
| หัวตาราง | `month,seq,reg_no,company_name,reg_date,capital,objective,address,province` | `lib/inspect-data.js:38` |
| แถวดิบต้นทาง | 16,781 แถว | `data/README.md:3` |
| กิจการที่ผ่านกฎ | **16,772** | `data/README.md:32` |
| ทุนจดทะเบียนรวม | **45,341,868,784 บาท** | `data/README.md:33` |
| ทุนรายเดือน | ม.ค. 18,620,752,814 · ก.พ. 14,815,712,210 · มิ.ย. 11,905,403,760 | `data/README.md:34` |
| ภาคทุนสูงสุด | กลาง 31,680,888,983 บาท | `data/README.md:35` |

กฎคุณภาพ (`analyze()` ใน `lib/inspect-data.js:119-223`):

- หัวตารางต้องตรง `COLUMNS` ทุกตัว — `lib/inspect-data.js:132-137`
- `seq` จำนวนเต็ม ≥ 1 — `lib/inspect-data.js:146-150`
- `reg_no` 13 หลัก และไม่ซ้ำ — `lib/inspect-data.js:151-154`, `lib/inspect-data.js:194-198`
- `company_name`, `objective` ไม่ว่าง — `lib/inspect-data.js:155-158`, `lib/inspect-data.js:169-172`
- `reg_date` เป็น ISO `YYYY-MM-DD` — `lib/inspect-data.js:54-60`
- `capital` ตัวเลข ≥ 0 (ตัดช่องว่าง/ลูกน้ำก่อนแปลง) — `lib/inspect-data.js:45-49`, `lib/inspect-data.js:164-168`
- `province` ต้องอยู่ใน `PROVINCE_REGION` (77 จังหวัด + ภาค) — `lib/inspect-data.js:14-34`, `lib/inspect-data.js:173-177`
- ยอดเงินสะสมแบบปัดทีละแถวด้วย `roundMoney` ได้ `totalCapital`, `byProvince`, `byRegion`, `byMonth` — `lib/inspect-data.js:200-221`
- ตัวอ้างอิงแยกจังหวัดจากที่อยู่: `extractProvince()` เลือกชื่อจังหวัดที่อยู่ท้ายสุด — `lib/inspect-data.js:62-87`

ตัวอ่าน CSV:

- `analyze()` ใช้ `parseRows()` ภายใน (รองรับเครื่องหมายคำพูด) — `lib/inspect-data.js:96-117`
- `lib/csv.js` มี `parseCsv()` ตัวอ่านแบบเดียวกันสำหรับแอป — `lib/csv.js:8-63` แต่ `server.js` แค่ `require` ไว้ (`server.js:26`) ไม่ได้เรียกใช้ที่ไหน

## 3. Endpoint (เครื่องผู้เรียน, `server.js`)

| Method | Path | พฤติกรรม | อ้างอิง |
|---|---|---|---|
| GET | `/api/health` | `200 { ok: true }` เท่านั้น ไม่มีฟิลด์อื่น | `server.js:157-160` |
| GET | `/api/summary` | `200 { companyCount, totalCapital, source: 'inspect-data.js' }` คำนวณจาก `analyze().stats`; ล้มได้ `500 { error: 'SUMMARY_FAILED' }` | `server.js:91-99`, `server.js:162-170` |
| GET | `/api/provinces/top` | `200 { top: [{ province, capital }] }` 5 จังหวัดทุนสูงสุดจาก `stats.byProvince` เรียงมากไปน้อย; ล้มได้ `500 { error: 'PROVINCES_TOP_FAILED' }` | `server.js:101-109`, `server.js:172-179` |
| GET | `/api/notes` | `200 { notes: [{ text }] }` จากหน่วยความจำที่โหลดจาก `data/notes.json` ตอนบูต | `server.js:41-52`, `server.js:61`, `server.js:182-185` |
| POST | `/api/notes` | ดูหัวข้อ 4 | `server.js:187-217` |
| GET | `/`, `/index.html`, `/styles.css`, `/app.js` | ไฟล์จาก `web/` (กัน path traversal) | `server.js:118-135`, `server.js:219-223` |
| อื่น ๆ | — | `404 { error: 'NOT_FOUND' }` | `server.js:225` |

หมายเหตุ: `/api/summary` และ `/api/provinces/top` อ่าน CSV และเรียก `analyze()` ใหม่ทุกคำขอ (ไม่มีแคช) — `server.js:92-93`, `server.js:102-103`

## 4. โน้ต

เครื่องผู้เรียน (ไม่มี `process.env.VERCEL`):

- บูต: อ่าน `data/notes.json` รับได้ทั้งอาร์เรย์และ `{ notes: [...] }`; ไฟล์หายหรือเสีย → เริ่มว่าง ไม่ล่ม — `server.js:42-52`
- POST body ไม่ใช่ JSON → `400 { ok: false, error: 'INVALID_JSON' }` — `server.js:195-199`
- ไม่มี `text` เป็นสตริงไม่ว่าง (เช่น `{nope:1}`) → `400 { ok: false, error: 'TEXT_REQUIRED' }` — `server.js:200-205`
- ตัดข้อความที่ 200 ตัวอักษร — `server.js:35`, `server.js:206`
- เขียนไฟล์ก่อนอัปเดตหน่วยความจำ ผ่านไฟล์ `.tmp` แล้ว rename — `server.js:55-59`, `server.js:206-213`
- เขียนไม่สำเร็จ → `500 NOTES_SAVE_FAILED` — `server.js:209-212`; สำเร็จ → `201 { ok: true, count }` — `server.js:214`

บน Vercel (`process.env.VERCEL`, `server.js:37-39`):

- ไม่โหลดไฟล์ — `server.js:61`
- GET → โน้ตตัวอย่าง `mode: 'readonly'` — `server.js:137-143`
- POST → `405 NOTES_READONLY` + header `Allow: GET` ไม่เขียนไฟล์ — `server.js:145-152`

## 5. หน้าเว็บ (`web/`)

- การ์ดยอดกิจการและทุนรวม — `web/index.html:14-17`, เติมโดย `loadSummary()` — `web/app.js:3-14`
- การ์ด "จังหวัดที่ทุนสูงสุด (Top 5)" — `web/index.html:20-26`, `loadProvinceTop()` สร้าง `<li>` ด้วย `textContent` — `web/app.js:16-33`
- ฟอร์มโน้ต + รายการ + จัดการ 405 — `web/index.html:28-39`, `web/app.js:35-93`
- ข้อความบนหน้ายังเป็นของชุดเริ่ม (ไม่ตรงกับพฤติกรรมปัจจุบัน): "ชุดเริ่มยังเก็บแค่ในหน่วยความจำ" — `web/index.html:30`; "โน้ตชุดเริ่มอยู่แค่ในหน่วยความจำของเซิร์ฟเวอร์นี้" — `web/app.js:59`; title "Registry Insight — starter" — `web/index.html:6`

## 6. Quality gate

- คำสั่ง `npm run gate` → `node scripts/quality-gate.js` — `package.json:14`
- 6 เคส: `data-quality` · `summary-matches-valid-rows` · `bad-json-does-not-crash` · `health-no-secrets` · `notes-validation` · `notes-persists` — `CLAUDE.md` หัวข้อ Quality gate
- สถานะล่าสุดตามข้อความคอมมิต: M06 "gate 6/6 exit 0", M11 "gate ยัง 6/6" (git log) — **ยืนยันแล้ว 2026-11-07 โดย qa: `npm run gate` 6/6, `GATE_EXIT=0`**
- `docs/QA-REPORT.md:10-12` บันทึก exit 2 (2/6) เป็นผลก่อนแก้ และเลขบรรทัดในรายงานนั้น (`server.js:36`, `:158` ฯลฯ) ไม่ตรงกับไฟล์ปัจจุบันแล้ว

## 7. การ deploy (Lab 11)

- ยังไม่มีโฟลเดอร์ `api/` และไม่มี `vercel.json` ที่รากโปรเจกต์ (ตรวจด้วย glob ในรอบนี้)
- ต้นแบบอยู่ที่ `reference/vercel/health.example.js`, `notes.example.js`, `summary.example.js`, `vercel.example.json`
- ตารางย้ายเส้นทางครอบคลุมแค่ `/api/summary`, `/api/health`, `/api/notes` — `reference/vercel/README.md:7-11` ส่วน `/api/provinces/top` ยังไม่มีแผนบน Vercel
- `api/summary.js` ต้องแนบ `data/dataset.csv` และ `lib/**` ผ่าน `includeFiles` — `reference/vercel/README.md:21-32`
- ห้ามตั้ง `ANTHROPIC_API_KEY` หรือ `OPENROUTER_API_KEY` บน Vercel — `reference/vercel/README.md:36`
- URL บน Vercel: ยังไม่มี

## 8. ข้อจำกัดที่ต้องคงไว้

- ห้ามแก้ `scripts/quality-gate.js`
- `notes-persists` ต้องผ่านเพราะเขียน `data/notes.json` จริง ไม่ใช่ค่าในหน่วยความจำ
- บน Vercel ห้าม `writeFile`, `appendFile`, `createWriteStream`
- ห้ามเพิ่ม dependency npm; ไม่มีคีย์ใดอยู่ในไฟล์ อ้างถึงคีย์ด้วยชื่อตัวแปรเท่านั้น
- ห้าม `git push` เอง
