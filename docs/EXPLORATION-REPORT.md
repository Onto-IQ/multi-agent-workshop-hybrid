# รายงานสำรวจ Registry Insight (Lab 02)

สำรวจแบบอ่านอย่างเดียวด้วยตัวสำรวจ 3 ตัวที่รันพร้อมกัน: A ดู `server.js`, B ดู `data/dataset.csv`, C ดู `scripts/quality-gate.js` รอบนี้ไม่ได้รัน `npm run gate` ข้อสรุปเรื่องด่านมาจากการอ่านโค้ด

## โครงสร้าง

**`server.js`** เป็นเซิร์ฟเวอร์ Node `http` ล้วน ไม่มี dependency ภายนอก (`server.js:23-25`)

- ฟังที่ `127.0.0.1` บน `PORT` (ค่าเริ่ม 3000) (`server.js:27-28`)
- จะ listen ก็ต่อเมื่อ `require.main === module` (`server.js:180-184`)
- export `{ server, notesAreReadOnly }` (`server.js:186`)

**GET `/api/summary`** (`server.js:139-146`)

- อ่าน `data/dataset.csv` ทั้งไฟล์ใหม่ทุกคำขอด้วย `fs.readFileSync` (`server.js:70`)
- แยกแถวด้วย `naiveRecords` (`server.js:51-62`) ซึ่ง split ตามขึ้นบรรทัดใหม่และลูกน้ำโดยไม่สนเครื่องหมายคำพูด ทั้งที่มีตัวอ่านที่ถูกต้องอยู่แล้วคือ `parseCsv` ใน `lib/csv.js:8-63` แต่ไม่ได้ถูกเรียกใช้
- อ่านคอลัมน์ `record.capital_raw` (`server.js:75`) แต่ CSV มีคอลัมน์ชื่อ `capital` ค่าที่ได้จึงเป็น `undefined` แล้ว `naiveMoney` แปลงเป็น 0 (`server.js:64-67`) ทุนรวมจึงเป็น 0 เสมอ
- นับทุกแถวที่ `reg_no` ไม่ว่าง (`server.js:76-78`) รวมถึงแถวหัวตารางภาษาไทย `เลขทะเบียน`
- ถ้าเกิด error จะคืน 500 `SUMMARY_FAILED` (`server.js:142-145`)

**GET `/api/health`** (`server.js:134-136`)

- คืน `{ ok: true, sampleToken: SAMPLE_TOKEN }` โดย `SAMPLE_TOKEN` (`server.js:34`) เป็นค่าตัวอย่างที่ขึ้นต้นด้วยคำนำหน้าแบบคีย์ API
- ของจริงต้องคืนแค่ `{ ok: true }`

**GET `/api/notes`** (`server.js:149-152`)

- คืนอาร์เรย์ `notes` ในหน่วยความจำ (`server.js:35`)
- ถ้า `process.env.VERCEL` มีค่า จะคืนโน้ตตัวอย่างแบบอ่านอย่างเดียวแทน (`server.js:37-39`, `server.js:113-119`)

**POST `/api/notes`** (`server.js:154-169`)

- รวม body เป็นสตริงโดยไม่จำกัดขนาด (`server.js:156-159`)
- เรียก `JSON.parse(raw)` ใน callback `'end'` โดยไม่มี try/catch (`server.js:164`) JSON ที่เสียทำให้โปรเซสล่ม
- ไม่ตรวจฟิลด์ใด ๆ เก็บ `String(body.text || '').slice(0,200)` แล้วตอบ 201 (`server.js:165-166`)
- บน Vercel ตอบ 405 `NOTES_READONLY` (`server.js:121-128`)

**ไฟล์คงที่จาก `web/`** (`server.js:171-175`) ให้บริการแค่ `/`, `/styles.css` และ `/app.js` มีกันการไต่ path ด้วย `path.relative` (`server.js:95-101`)

**ข้อมูลต้นทาง** อยู่ที่ `data/raw/dbd-2558.parquet` มีคอลัมน์ `month, seq_raw, reg_no, company_name, reg_date_raw, capital_raw, objective, address` ทุกคอลัมน์เป็นข้อความ และมี view `businesses_raw` ใน `data/warehouse.duckdb` (`data/README.md:5-6`, `data/README.md:24`)

## คุณภาพข้อมูล

**ข้อเท็จจริงของไฟล์ `data/dataset.csv`**

- UTF-8 ไม่มี BOM ใช้ CRLF
- มี 16,781 แถวข้อมูลหลังหัวตาราง: เดือน jan 5,983 แถว, feb 5,634 แถว, jun 5,164 แถว
- หัวตารางจริงคือ `month,seq,reg_no,company_name,reg_date,capital,objective,address,province`
- มีคอลัมน์ `province` เพิ่มจากสัญญา 8 คอลัมน์ใน `data/README.md:11-20` แต่ `COLUMNS` ใน `lib/inspect-data.js:38` รวม `province` ไว้ด้วย หัวตารางจึงผ่าน

**ปัญหาที่พบ**

1. **มีแถวขยะ 9 แถว** เดือนละ 3 แถว อยู่ที่บรรทัด 2-4, 5986-5988 และ 11622-11624 ได้แก่ แถวชื่อเรื่อง `นิติบุคคลจัดตั้งเดือนมกราคม 2558`, แถว `ทั่วประเทศ` และแถวหัวตารางภาษาไทย (`ที่,เลขทะเบียน,...`) ซึ่งเซลล์ `" ทุนจดทะเบียน\n (บาท) "` มีขึ้นบรรทัดใหม่อยู่ในเครื่องหมายคำพูด ทั้ง 9 แถวตกกฎ `bad-seq`
2. **`reg_date` เป็นปี พ.ศ. รูปแบบ d/m/yyyy ทั้ง 16,772 แถว** เช่น `12/1/2558` ต้องแปลงเป็น `2015-01-12` (ISO) ตามกฎใน `lib/inspect-data.js:54-60` ทุกแถวตกกฎ `bad-reg-date`
3. **`capital` มีช่องว่างครอบทุกแถว และมีลูกน้ำคั่นหลักพัน 16,770 แถว** เช่น `" 2,000,000,000 "` ตอนนี้ `parseCapital` ยังอ่านได้ (`lib/inspect-data.js:45-49`) แต่ตารางสะอาดควรเก็บเป็นตัวเลขล้วน ผลรวมคือ 45,341,868,784 ตรงกับยอดอ้างอิง
4. **`seq` มีลูกน้ำคั่นหลักพัน 3,239 แถว** เช่น `1,000` ซึ่ง `parseSeq` ยังรับได้ (`lib/inspect-data.js:89-93`)
5. **`province` ว่างทุกแถว** ต้องดึงจาก `address` ด้วย `extractProvince()` (`lib/inspect-data.js:65-87`) ซึ่งใช้ได้กับที่อยู่ทั้ง 16,772 แถว ถ้าแก้วันที่แล้วแต่ยังไม่เติมคอลัมน์นี้ ทุกแถวจะไปตกกฎ `unknown-province` (`lib/inspect-data.js:173-176`) แทน
6. **มีที่อยู่ 124 แถวที่มีลูกน้ำอยู่ในเครื่องหมายคำพูด** ตัวอ่านที่รองรับเครื่องหมายคำพูดอ่านได้ถูกต้อง แต่ทำให้ `naiveRecords` เลื่อนคอลัมน์ผิด

**สิ่งที่ปกติดี**

- `reg_no` ไม่ซ้ำและยาว 13 หลักทุกแถว
- ไม่มี `company_name` หรือ `objective` ว่าง
- ไม่มีแถวว่างและไม่มีปัญหา encoding

**ผลของ `analyze()` ตอนนี้** คือ `{ 'bad-seq': 9, 'bad-reg-date': 16772 }` และแถวที่ผ่านเท่ากับ 0 เป้าหมายหลังทำความสะอาดคือ 16,772 กิจการ ทุนรวม 45,341,868,784 บาท (`data/README.md:32-33`)

## จุดเสี่ยง

**`scripts/quality-gate.js` ตรวจ 6 เคส** ชุดเริ่มตกทั้ง 6 เคสตามดีไซน์ และด่านจะคืน exit 2 (`scripts/quality-gate.js:286-293`)

| เคส | ด่านตรวจอะไร | เหตุที่ชุดเริ่มตก |
|---|---|---|
| `data-quality` (`:174-182`) | `analyze()` ต้องไม่เจอ violation | มีแถวขยะ 9 แถว วันที่เป็นปี พ.ศ. และ `province` ว่าง |
| `bad-json-does-not-crash` (`:197-205`) | POST `not-json` ไปที่ `/api/notes` แล้วโปรเซสต้องยังอยู่และ health ต้องตอบ 200 | `JSON.parse` ที่ไม่มี try/catch (`server.js:164`) ทำให้โปรเซสล่ม |
| `summary-matches-valid-rows` (`:214-226`) | `companyCount` และ `totalCapital` ของ `/api/summary` ต้องตรงกับ `analyze().stats` | ด่านคาด 0/0 แต่เซิร์ฟเวอร์นับแถวที่ `reg_no` ไม่ว่างได้หลายพันแถว (ทุนเป็น 0 ตรงโดยบังเอิญเพราะอ่าน `capital_raw`) |
| `health-no-secrets` (`:228-241`) | body ต้องไม่มีคำนำหน้าคีย์และคำว่า `sampleToken` | คืน `SAMPLE_TOKEN` (`server.js:135`) |
| `notes-validation` (`:243-251`) | `{"nope":1}` ต้องได้ 400 | เซิร์ฟเวอร์รับไว้แล้วตอบ 201 |
| `notes-persists` (`:253-274`) | POST โน้ต แล้ว SIGKILL รีสตาร์ท โน้ตต้องยังอยู่ | เก็บโน้ตแค่ในหน่วยความจำ (`server.js:35`) |

**ความเสี่ยงอื่น ๆ**

- **พอร์ตชน:** ด่าน spawn `node server.js` เองบน `PORT` (`scripts/quality-gate.js:125-131`) ถ้ามีเซิร์ฟเวอร์อื่นใช้พอร์ตอยู่ ด่านจะนับ 5 เคสฝั่งเซิร์ฟเวอร์ว่าตก (`scripts/quality-gate.js:184-188`) ให้ปิด `npm start` ก่อนรันด่าน
- **`notes-persists` ห้ามโกง:** ต้องเขียน `data/notes.json` ก่อนตอบคำขอ และโหลดกลับตอนเซิร์ฟเวอร์เริ่ม การบันทึกใน exit handler ใช้ไม่ได้เพราะ SIGKILL ข้าม handler นั้น บน Vercel (`process.env.VERCEL`) ห้ามเขียนดิสก์
- **ทำความสะอาดข้อมูล:** ต้องใช้ตัวอ่าน CSV ที่รองรับเครื่องหมายคำพูดหรือ DuckDB จาก `data/raw/dbd-2558.parquet` ห้าม split ตามลูกน้ำ เพราะมีที่อยู่ 124 แถวที่มีลูกน้ำในเครื่องหมายคำพูด
- **ประสิทธิภาพ:** `/api/summary` อ่านและ parse CSV ขนาดประมาณ 8 MB แบบ sync ทุกคำขอโดยไม่มี cache ทำให้ event loop ถูกบล็อก
- **POST `/api/notes`:** ไม่จำกัดขนาด body และถ้า body เป็น `null` จะเกิด TypeError ที่ `body.text` จนโปรเซสล่ม
- **`notesAreReadOnly()`:** ใช้ `Boolean(process.env.VERCEL)` ค่าเช่น `"0"` จึงถูกนับว่าเป็นโหมดอ่านอย่างเดียวด้วย
- **ห้ามแก้ `scripts/quality-gate.js`** และห้ามทำให้เคส `notes-persists` หลวมลง (`scripts/quality-gate.js:8-9`)

ห้ามแก้ไฟล์ในรอบสำรวจ
