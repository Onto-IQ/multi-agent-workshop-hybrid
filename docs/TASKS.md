# TASKS — Registry Insight App (สถานะหลัง M11)

อ้างอิงสเปก: `docs/PRODUCT-SPEC.md` · เลขบรรทัดอ้างอิงจากไฟล์ปัจจุบันบน branch `lab-run`

กติกาตลอดงาน: ห้ามแก้ `scripts/quality-gate.js` · ห้าม `git push` เอง · ห้ามเพิ่ม dependency npm · ไม่ใส่คีย์ในไฟล์ (อ้างแค่ `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`) · ปิด `npm start` ก่อนรัน `npm run gate` แล้วรายงาน exit code จริง

## เสร็จแล้ว

- [x] **ข้อมูลสะอาด** — `data/dataset.csv` หัวตารางตรง `COLUMNS` (`lib/inspect-data.js:38`) ยอดอ้างอิง 16,772 กิจการ / 45,341,868,784 บาท (`data/README.md:32-33`)
- [x] **`/api/summary` ใช้ `analyze()`** — `server.js:91-99`, `server.js:162-170`
- [x] **`/api/health` คืน `{ ok: true }` เท่านั้น** — `server.js:157-160`
- [x] **POST `/api/notes` ไม่ล่มเมื่อ JSON เสีย** → 400 `INVALID_JSON` — `server.js:194-199`
- [x] **ตรวจ `text`** → 400 `TEXT_REQUIRED` — `server.js:200-205`
- [x] **โน้ตอยู่รอดรีสตาร์ท** — โหลด/เขียน `data/notes.json` (tmp + rename) — `server.js:42-59`, `server.js:206-213`
- [x] **โหมดอ่านอย่างเดียวบน Vercel** — GET ตัวอย่าง, POST 405 `NOTES_READONLY` — `server.js:37-39`, `server.js:137-152`
- [x] **ฟีเจอร์ Top 5 จังหวัดทุนสูงสุด** — `GET /api/provinces/top` (`server.js:101-109`, `server.js:172-179`), การ์ด (`web/index.html:20-26`), `loadProvinceTop()` (`web/app.js:16-33`) ตาม `docs/MY-FEATURE.md`
- [x] **Quality gate 6/6** — ตามข้อความคอมมิต M06 และ M11 (**ยืนยันแล้ว 2026-11-07 โดย qa: 6/6, `GATE_EXIT=0`**)

## งานที่เหลือ

### T1. Lab 11 — สร้าง `api/` และ `vercel.json` (ยังไม่มีทั้งคู่)

- [ ] `api/health.js` ตอบ `{ ok: true }` — ต้นแบบ `reference/vercel/health.example.js`
- [ ] `api/summary.js` เรียก `analyze()` จาก `lib/inspect-data.js` ให้ยอดตรงกับเครื่อง — ต้นแบบ `reference/vercel/summary.example.js`
- [ ] `api/notes.js` อ่านอย่างเดียว: GET โน้ตตัวอย่าง, POST 405 `NOTES_READONLY`, ไม่มี `writeFile`/`appendFile`/`createWriteStream` — ต้นแบบ `reference/vercel/notes.example.js`
- [ ] `vercel.json` แนบ `data/dataset.csv` และ `lib/**` ให้ `api/summary.js` ผ่าน `includeFiles` — `reference/vercel/README.md:21-32`, `reference/vercel/vercel.example.json`
- [ ] ตัดสินใจเรื่อง `/api/provinces/top` บน Vercel: เพิ่ม `api/provinces/top.js` (ต้องแนบ CSV ด้วย) หรือยอมให้การ์ดขึ้น "โหลดอันดับจังหวัดไม่สำเร็จ" (`web/app.js:31`) — ตารางใน `reference/vercel/README.md:7-11` ไม่ได้ครอบคลุมเส้นทางนี้
- [ ] ไม่ตั้ง `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` บน Vercel — `reference/vercel/README.md:36`
- [ ] deploy แล้วตรวจบน URL จริง: `/api/health` ไม่มี `sk-`, `/api/summary` ได้ 16,772 / 45,341,868,784, POST `/api/notes` ได้ 405
- [ ] `npm run gate` บนเครื่องยัง exit 0 (`notes-persists` ยังต้องเขียน `data/notes.json` จริง)

**เสร็จเมื่อ**: มี URL บน Vercel ที่ยอดตรง และ gate บนเครื่อง 6/6

หมายเหตุ: เมื่อเพิ่ม `api/` กับ `vercel.json` แล้ว `npm test` (เทสต์สภาพชุดเริ่ม) จะล้มตามธรรมชาติ ใช้ `npm run gate` เป็นตัววัด

### T2. ข้อความบนหน้าเว็บที่ค้างจากชุดเริ่ม (ไม่บังคับ)

- [ ] `web/app.js:59` ยังบอก "โน้ตชุดเริ่มอยู่แค่ในหน่วยความจำของเซิร์ฟเวอร์นี้" ทั้งที่ตอนนี้เขียน `data/notes.json` แล้ว
- [ ] `web/index.html:30` ยังบอก "ชุดเริ่มยังเก็บแค่ในหน่วยความจำ จึงหายเมื่อปิดเซิร์ฟเวอร์"
- [ ] `web/index.html:6` title ยังเป็น "Registry Insight — starter"

**เสร็จเมื่อ**: ข้อความตรงพฤติกรรมจริง และ gate ยัง exit 0

### T3. เก็บกวาดโค้ดตาย (ไม่บังคับ)

- [ ] `naiveRecords()` / `naiveMoney()` ไม่ถูกเรียกแล้ว — `server.js:73-89`
- [ ] `parseCsv` ถูก `require` แต่ไม่ได้ใช้ — `server.js:26`
- [ ] คอมเมนต์หัวไฟล์ยังบอกว่าชุดเริ่มเก็บโน้ตในหน่วยความจำ — `server.js:14-20`

**เสร็จเมื่อ**: ลบแล้ว gate ยัง exit 0 และ `/api/summary` ยัง 16,772 / 45,341,868,784

### T4. เอกสารที่ล้าสมัย (ไม่บังคับ)

- [ ] `docs/QA-REPORT.md` เป็นผลก่อนแก้ (exit 2, 2/6 — `docs/QA-REPORT.md:10-12`) และเลขบรรทัดไม่ตรง `server.js` ปัจจุบัน ควรรัน qa รอบใหม่หรือติดหมายเหตุว่าเป็นผลเก่า

### T5. ยืนยันสถานะก่อนส่งมอบ

- [ ] ปิดเซิร์ฟเวอร์ที่พอร์ต 3000 แล้วรัน `npm run gate` รายงาน exit code จริง (คาด 0)
- [ ] ตรวจว่า `/api/summary` ได้ 16,772 / 45,341,868,784 และ `/api/health` ไม่มี `sk-` หรือ `sampleToken`
- [ ] ไม่มีการแก้ `scripts/quality-gate.js` ใน diff
