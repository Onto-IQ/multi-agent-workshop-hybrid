# รายงานสำรวจ Registry Insight App (Lab 02)

สำรวจโดยผู้ช่วยอ่านอย่างเดียว 3 คนทำงานพร้อมกัน (server.js / ข้อมูล / quality gate) ไม่มีการแก้ไฟล์ใด ๆ ของแอป ค่าที่ขึ้นต้นด้วย `sk-` ในรายงานนี้ถูกปิดเป็น `sk-***`

## โครงสร้าง

### ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `server.js` | เซิร์ฟเวอร์ Node `http` ล้วน ฟังที่ `127.0.0.1` พอร์ต `PORT` หรือ 3000 (`server.js:27-28`) |
| `data/dataset.csv` | ตารางแบนที่แอปอ่าน (ยังดิบ) 16,786 บรรทัด ≈ 7.3 MB |
| `data/raw/dbd-2558.parquet` | ข้อมูลต้นทางจาก data.go.th (นิติบุคคลจัดตั้งใหม่ พ.ศ. 2558) 16,781 แถว คอลัมน์ VARCHAR 8 คอลัมน์ (`month, seq_raw, reg_no, company_name, reg_date_raw, capital_raw, objective, address`) ไม่มีคอลัมน์ `province` |
| `data/warehouse.duckdb` | มีแค่ view `businesses_raw` = `read_parquet('data/raw/dbd-2558.parquet')` ใช้สาธิต MCP แบบอ่านอย่างเดียว |
| `lib/inspect-data.js` | `analyze()`, `extractProvince()`, `PROVINCE_REGION`, `roundMoney` ซึ่งเป็นกฎชุดเดียวกับที่ด่านใช้ |
| `lib/csv.js` | ตัวอ่าน CSV ที่รองรับเครื่องหมายคำพูด (ชุดเริ่มยังไม่ได้ใช้) |
| `scripts/quality-gate.js` | ด่าน 6 เคส ห้ามแก้ |

### `server.js` แยกตาม endpoint

**GET `/api/summary`** (`server.js:139-146` → `summaryFromCsv()` บรรทัด 69-85)
- อ่าน `data/dataset.csv` แบบ synchronous ทุกครั้งที่มีคำขอ (บรรทัด 30, 70)
- `naiveRecords` (บรรทัด 51-62) แยกหัวตารางและทุกแถวด้วย `split(',')` (บรรทัด 53, 55) ไม่สนเครื่องหมายคำพูด
- นับทุกแถวที่ `reg_no` ไม่ว่าง (บรรทัด 76) จึงนับแถวหัวเรื่อง แถวหัวตารางซ้ำ และเศษแถวที่ถูกแยกพังไปด้วย
- อ่านทุนจาก `record.capital_raw` (บรรทัด 75) แต่ไม่มีคอลัมน์นี้ใน CSV `naiveMoney(undefined)` ได้ NaN แล้วกลายเป็น 0 ผลคือ **`totalCapital` เป็น 0 เสมอ** ต่อให้ชื่อคอลัมน์ถูก `parseFloat("2,000,000")` ก็ยังได้แค่ 2
- ถ้า error ตอบ 500 `{error:'SUMMARY_FAILED'}` (บรรทัด 142-144)

**GET `/api/health`** (`server.js:134-136`)
- ตอบ `{ ok: true, sampleToken: SAMPLE_TOKEN }` (บรรทัด 135) โดย `SAMPLE_TOKEN` ตั้งไว้ที่บรรทัด 34 เป็นค่าตัวอย่างรูปแบบ `sk-***` ปล่อยออกไปให้ทุกคนที่เรียก
- ไม่ได้ปล่อยตัวแปร env (อ่านแค่ `PORT` กับ `VERCEL`)

**GET/POST `/api/notes`** (`server.js:149-169`)
- เก็บในหน่วยความจำ `const notes = []` (บรรทัด 35) ไม่มี `writeFile` และไม่ได้แตะ `data/notes.json`
- ถ้ามี `process.env.VERCEL`: GET ตอบข้อมูลสาธิต, POST ตอบ 405 `NOTES_READONLY` (บรรทัด 113-128)
- POST รวม body โดยไม่จำกัดขนาด แล้วเรียก `JSON.parse(raw)` ใน `req.on('end')` (บรรทัด 164) **โดยไม่มี try/catch** JSON เสีย, body ว่าง หรือ `null` จะโยน exception ใน callback แบบ async ทำให้ process ตายทั้งตัว
- ไม่มีการตรวจข้อมูล: `notes.push({ text: String(body.text || '').slice(0, 200) })` (บรรทัด 165) `{nope:1}` ถูกเก็บเป็นข้อความว่างและได้ 201 ไม่มีทางได้ 400

**ไฟล์ static**: เสิร์ฟแค่ `/`, `/index.html`, `/styles.css`, `/app.js` จาก `web/` (บรรทัด 171-175) มีกันการไต่ path (บรรทัด 95-101) path อื่นได้ 404 แบบ JSON

## คุณภาพข้อมูล

ตรวจ `data/dataset.csv` เทียบกับ `data/README.md` และ `lib/inspect-data.js` วันนี้ `analyze()` ได้ `{"bad-seq":9, "bad-reg-date":16772}` ทำให้ `companyCount` = 0 และ `totalCapital` = 0

| ประเด็น | สิ่งที่พบ |
|---|---|
| หัวตาราง | บรรทัด 1 ตรงกับ `month,seq,reg_no,company_name,reg_date,capital,objective,address,province` ไม่มี BOM, เข้ารหัส UTF-8 สะอาด, ปิดบรรทัดด้วย CRLF |
| แถวขยะ 9 แถว | แถวหัวเรื่อง/หัวตารางซ้ำเดือนละ 3 แถว (jan บรรทัด 2-5, feb 5986-5989, jun 11622-11625) แถวหัวตารางมี `" ทุนจดทะเบียน\r\n (บาท) "` ที่ขึ้นบรรทัดใหม่ในเครื่องหมายคำพูด จึงกินพื้นที่ 2 บรรทัด |
| `reg_date` | **ทั้ง 16,772 แถว** เป็น พ.ศ. แบบ `d/m/2558` ไม่เติมศูนย์ ต้องแปลงเป็น ISO ค.ศ. เช่น `12/1/2558` → `2015-01-12` |
| `capital` | 16,770 แถวมีเครื่องหมายคำพูด ลูกน้ำ และช่องว่าง เช่น `" 2,000,000,000 "` อีก 2 แถวไม่มีลูกน้ำ (บรรทัด 2187 = 15 บาท, 13580 = 500 บาท ซึ่งมีมาจากต้นทาง) |
| `seq` | 3,239 ค่ามีลูกน้ำ เช่น `"1,000"` เดือน jun มีช่องว่างท้ายทุกค่า (`parseSeq` รองรับอยู่แล้ว) |
| `reg_no` | ครบ 13 หลักทุกแถว ไม่ซ้ำ ต้องเก็บเป็นข้อความ เพราะอ่านเป็นตัวเลขแล้วเลข 0 นำหน้าจะหาย |
| `province` | **ว่างทุกแถว** ต้องเติมจาก `extractProvince(address)` ซึ่งได้จังหวัดที่อยู่ใน `PROVINCE_REGION` ครบทั้ง 16,772 แถว (`analyze()` ยังไม่รายงานเรื่องนี้ เพราะทุกแถวไปตกที่กฎวันที่ก่อน) |
| ลูกน้ำในฟิลด์ | ทุกแถวข้อมูลมีลูกน้ำในเครื่องหมายคำพูด (`capital`, `seq`, `address` 124 แถว, `objective` 81 แถว) `split(',')` ได้ 2-17 ช่อง ถูก 9 ช่องแค่ 7 บรรทัด |
| อื่น ๆ | มี NBSP 4 ตัวและ tab ใน `company_name` (บรรทัด 10457, 13045) |

**ยอดหลังทำความสะอาด** (ตัดแถวขยะ แปลงตัวเลขและวันที่): 16,772 กิจการ / ทุนรวม 45,341,868,784 บาท ตรงกับ README (jan 5,980 · feb 5,631 · jun 5,161)
ข้อสังเกต: ทุนภาค "กลาง" ที่คำนวณได้คือ 31,680,988,983 แต่ README เขียน 31,680,888,983 ต่างกัน 100,000 พอดี อาจพิมพ์ผิดใน README ต้องตรวจซ้ำ

## จุดเสี่ยง

### ทำไมชุดเริ่มแดง 0/6 ใน `scripts/quality-gate.js`

| เคส | ด่านตรวจอะไร | ทำไมชุดเริ่มไม่ผ่าน |
|---|---|---|
| `data-quality` (QG:174-182) | `analyze(csv).violations.length === 0` | วันที่เป็น พ.ศ., มีแถวขยะ 9 แถว, `province` ว่าง |
| `summary-matches-valid-rows` (QG:214-226) | `/api/summary` ต้องได้ `companyCount` และ `totalCapital` ตรงกับ `analyze().stats` แบบ `===` | ใช้ `split(',')` + `capital_raw` (`server.js:55, 75`) ทุนเป็น 0 และนับแถวเกิน |
| `bad-json-does-not-crash` (QG:197-205) | POST `not-json` แล้ว process ต้องยังอยู่ และ `/api/health` ต้องได้ `ok: true` | `JSON.parse` ไม่มี try/catch (`server.js:164`) |
| `health-no-secrets` (QG:228-241) | ต้องมี `ok: true` และห้ามมี `sk-` หรือ `sampleToken` | ส่ง `sampleToken` ออกไป (`server.js:135`) |
| `notes-validation` (QG:243-251) | `{nope:1}` → 400, `{text}` → 201/200 | รับทุกอย่างแล้วตอบ 201 (`server.js:165-166`) |
| `notes-persists` (QG:253-274) | POST โน้ต แล้ว SIGKILL บูตใหม่ แล้วต้องยังอ่านเจอใน `/api/notes` | เก็บในหน่วยความจำ (`server.js:35`) |

ด่านบูต `server.js` เป็น child process ที่ `PORT` แล้วจบด้วย exit 0 เมื่อผ่านครบ หรือ exit 2 ในกรณีอื่นทั้งหมด

### ความเสี่ยงที่ต้องระวังในแล็บถัดไป
1. **พอร์ตชน** ถ้า `npm start` ยังเปิดอยู่ ด่านจะ FAIL ทั้ง 5 เคสฝั่งเซิร์ฟเวอร์ทันที (QG:184-189) ดูเหมือนโค้ดพัง ต้องปิดเซิร์ฟเวอร์ก่อน
2. **`notes-persists` ใช้ SIGKILL** การเขียนไฟล์ตอนปิดเซิร์ฟเวอร์จะไม่ทำงาน ต้องเขียน `data/notes.json` ให้เสร็จก่อนตอบ POST และ `notes.json` ที่เสียหรือว่างต้องไม่ทำให้บูตล่ม
3. **บน Vercel ต้องอ่านอย่างเดียว** เมื่อมี `process.env.VERCEL` ห้าม `writeFile`/`appendFile`/`createWriteStream`
4. **ห้ามเทียบทศนิยมแบบปัดเอง** `totalCapital` เทียบด้วย `===` ทางที่ปลอดภัยคือให้ `server.js` เรียก `analyze()` ตัวเดียวกับด่าน
5. **ทางลัดที่ไม่ควรทำ** เช่น แก้ `scripts/quality-gate.js`, เปลี่ยนกฎใน `lib/inspect-data.js` แทนการล้างข้อมูล, เก็บโน้ตในหน่วยความจำ, หรือซ่อน `sk-` แทนการลบฟิลด์ออก
6. **การส่งออก CSV ใหม่** ต้องใส่เครื่องหมายคำพูดให้ฟิลด์ที่มีลูกน้ำ (`address`, `objective`) และเก็บ `reg_no` เป็นข้อความ
7. **`npm test` จะแดงตามธรรมชาติ** เมื่อแก้งาน เพราะเทสต์นี้ตรวจสภาพชุดเริ่ม ให้ใช้ `npm run gate` วัดความคืบหน้า

ห้ามแก้ไฟล์ในรอบสำรวจ
