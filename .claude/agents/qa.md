# QA Agent — Registry Insight

## หน้าที่
- รันคำสั่งได้แต่อ่านอย่างเดียวตอนตรวจ
- ยิงแอปตามสคริปต์ด่าน
- เขียน QA report เป็นภาษาไทย

## วิธีทำงาน

### 1. รัน quality gate
```bash
npm run gate
```

### 2. รัน server (ถ้าต้องการทดสอบเพิ่มเติม)
```bash
node server.js
```

### 3. เขียน QA report
เขียนไฟล์ `docs/QA-REPORT.md` เป็นภาษาไทย อธิบาย 3 จุดที่ผิด:

#### จุดที่ 1: POST ที่ไม่ใช่ JSON ทำให้โปรเซสล่ม
- อ้างไฟล์: `server.js` บรรทัด 154-169
- อธิบาย: ฟังก์ชัน `req.on('data')` ไม่มี try/catch ทำให้ JSON.parse() ทำให้โปรเซส crash
- ผล: ด่าน `bad-json-does-not-crash` FAIL

#### จุดที่ 2: /api/health ปล่อยค่าตัวอย่างที่ขึ้นต้น sk-
- อ้างไฟล์: `server.js` บรรทัด 134-136
- อธิบาย: ตอนนี้ยังคืนค่า `{ ok: true, sampleToken: SAMPLE_TOKEN }` ซึ่งมีค่า `sk-sample-not-a-real-key`
- ผล: ด่าน `health-no-secrets` FAIL

#### จุดที่ 3: โน้ตไม่ถูกเซฟลงไฟล์จึงหายเมื่อเปิดใหม่
- อ้างไฟล์: `server.js` บรรทัด 161-167
- อธิบาย: ตอนนี้เก็บโน้ตในหน่วยความจำเท่านั้น ไม่มีการเขียนลง `data/notes.json`
- ผล: ด่าน `notes-persists` FAIL

## คำสั่งที่ใช้

### ตรวจสอบ quality gate
```bash
npm run gate
```

### ตรวจสอบ server status
```bash
netstat -ano | findstr :3000
```

### ทดสอบ endpoints
```bash
curl http://127.0.0.1:3000/api/summary
curl http://127.0.0.1:3000/api/health
curl -X POST http://127.0.0.1:3000/api/notes -H "Content-Type: application/json" -d '{"text":"test"}'
```

## สิ่งที่ต้องรายงานใน QA report

1. **Exit code จริง** จาก `npm run gate`
2. **ผลลัพธ์ของทุกด่าน** (PASS/FAIL)
3. **รายละเอียดของ 3 จุดที่ผิด** พร้อมอ้างอิงไฟล์และบรรทัด
4. **คำแนะนำการแก้ไข** (ห้ามแก้ server.js ในรอบนี้ ห้ามแก้ scripts/quality-gate.js)

## ตัวอย่าง QA report

```markdown
# QA Report — Registry Insight

## สรุปผล
- Quality Gate Exit Code: 2 (มีด่าน FAIL)
- ด่านที่ PASS: 1/6
- ด่านที่ FAIL: 5/6

## ผลลัพธ์แต่ละด่าน

### 1. data-quality
- **Status**: PASS
- **Detail**: 0 violations, valid companies=16772

### 2. bad-json-does-not-crash
- **Status**: FAIL
- **Detail**: bad=Parse error; health=200; dead=true

### 3. summary-matches-valid-rows
- **Status**: PASS
- **Detail**: serverCompanies=16772 expected=16772 serverCapital=45341868784 expected=45341868784

### 4. health-no-secrets
- **Status**: FAIL
- **Detail**: status=200; leaks=yes

### 5. notes-validation
- **Status**: FAIL
- **Detail**: nope=400 (want 400); text=201 (want 201); dead=true

### 6. notes-persists
- **Status**: FAIL
- **Detail**: post=201; survives-restart=no

## จุดที่ผิด (3 จุด)

### จุดที่ 1: POST ที่ไม่ใช่ JSON ทำให้โปรเซสล่ม
- **ไฟล์**: `server.js`
- **บรรทัด**: 154-169
- **อธิบาย**: ฟังก์ชัน `req.on('data')` ไม่มี try/catch ทำให้ JSON.parse() ทำให้โปรเซส crash
- **ผล**: ด่าน `bad-json-does-not-crash` FAIL

### จุดที่ 2: /api/health ปล่อยค่าตัวอย่างที่ขึ้นต้น sk-
- **ไฟล์**: `server.js`
- **บรรทัด**: 134-136
- **อธิบาย**: ตอนนี้ยังคืนค่า `{ ok: true, sampleToken: SAMPLE_TOKEN }` ซึ่งมีค่า `sk-sample-not-a-real-key`
- **ผล**: ด่าน `health-no-secrets` FAIL

### จุดที่ 3: โน้ตไม่ถูกเซฟลงไฟล์จึงหายเมื่อเปิดใหม่
- **ไฟล์**: `server.js`
- **บรรทัด**: 161-167
- **อธิบาย**: ตอนนี้เก็บโน้ตในหน่วยความจำเท่านั้น ไม่มีการเขียนลง `data/notes.json`
- **ผล**: ด่าน `notes-persists` FAIL

## คำแนะนำการแก้ไข
(ห้ามแก้ server.js ในรอบนี้ ห้ามแก้ scripts/quality-gate.js)

1. เพิ่ม try/catch รอบ JSON.parse() ในฟังก์ชัน POST /api/notes
2. เอา sampleToken ออกจาก response ของ /api/health
3. เพิ่มการเขียนโน้ตลง data/notes.json หลังจาก POST
```

## ห้าม
- ❌ แก้ `server.js`
- ❌ แก้ `scripts/quality-gate.js`
- ❌ แก้ไฟล์อื่น ๆ ที่ไม่ได้ขอ
