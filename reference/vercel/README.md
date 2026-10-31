# ทางขึ้น Vercel — อ่านหลัง Lab 11

อย่าคัดลอกไฟล์ในโฟลเดอร์นี้ขึ้นรากโปรเจกต์ก่อน Lab 11 ชุดเริ่มตั้งใจไม่มี `vercel.json` และไม่มีโฟลเดอร์ `api/` ผู้เรียนสร้างของนั้นเองตอนสั่ง deploy

`server.js` เป็นเซิร์ฟเวอร์ท้องถิ่นที่ฟัง `127.0.0.1` เท่านั้น แยกเส้นทางไว้แล้วให้ย้ายไปเป็นฟังก์ชันได้:

| เส้นทางใน `server.js` | ไฟล์ที่ Lab 11 สร้าง |
|---|---|
| `GET /api/summary` | `api/summary.js` |
| `GET /api/health` | `api/health.js` |
| `GET` / `POST /api/notes` | `api/notes.js` |

บน Vercel ไม่เรียก `server.listen` ฟังก์ชันแต่ละไฟล์ส่งออก handler เอง ถ้ารันไฟล์นี้ตอน `process.env.VERCEL` ถูกตั้ง โน้ตจะตอบแบบอ่านอย่างเดียวและปฏิเสธ POST ด้วยรหัส 405 โดยไม่เขียนไฟล์

## ทำไม CSV ประมาณ 8 MB ต้องใส่ includeFiles

`data/dataset.csv` ในชุดเริ่มใหญ่ประมาณ **7.3 MB** (ในบรีฟของห้องเรียกว่าประมาณ 8 MB) `api/summary.js` อ่านไฟล์นี้ตอนรันด้วย `fs.readFileSync` และเส้นทางที่ประกอบจาก `path.join`

ตัวตามไฟล์ของ `@vercel/node` มักไม่หยิบไฟล์ที่ถูกเปิดแบบนั้น โดยเฉพาะไฟล์ใหญ่ขนาดนี้ ผลคือบนเครื่อง `npm start` เห็นยอด แต่บน Vercel ฟังก์ชันไม่พบ `data/dataset.csv` แล้ว `/api/summary` ตอบ 500

ใส่ไฟล์เข้าบันเดิลของฟังก์ชันสรุปโดยตรง ตัวอย่างทั้งก้อนอยู่ใน `vercel.example.json`:

```json
{
  "src": "api/summary.js",
  "use": "@vercel/node",
  "config": { "includeFiles": ["data/dataset.csv", "lib/**"] }
}
```

- `data/dataset.csv` คือตารางที่แอปอ่าน ทั้งชุดดิบและชุดที่สะอาดแล้วหลัง Lab 05 ใช้ชื่อไฟล์เดียวกัน
- `lib/**` คือตัวอ่าน CSV และตัวคำนวณยอด ที่ฟังก์ชัน `require` ร่วมกับ `server.js` หลังผู้เรียนแยกโมดูลแล้ว จะได้ยอดชุดเดียวกับ `npm run gate`

`api/health.js` และ `api/notes.js` ไม่ได้อ่าน CSV จึงไม่ต้องแนบไฟล์นี้ โน้ตบนของจริงเป็นตัวอย่างอ่านอย่างเดียว: GET คืนโน้ตตัวอย่าง, POST ตอบ 405 พร้อม `NOTES_READONLY` และห้ามมี `writeFile` ด่าน `notes-persists` บนเครื่องยังต้องเขียน `data/notes.json` อยู่ อย่าทำให้ด่านนั้นหลวมเพื่อให้ deploy ง่ายขึ้น

ห้ามตั้ง `ANTHROPIC_API_KEY` หรือ `OPENROUTER_API_KEY` เป็นตัวแปรบน Vercel
