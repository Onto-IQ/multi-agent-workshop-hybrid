# MY-FEATURE-TASKS — จังหวัดที่ทุนสูงสุด Top 5

อ้างอิง: `docs/MY-FEATURE.md` · แตะได้เฉพาะ `server.js`, `web/index.html`, `web/app.js`

1. **`server.js` — เพิ่ม `GET /api/provinces/top`**: เรียก `analyze()` ตัวเดิม (แบบเดียวกับ `summaryFromCsv()`) แล้วใช้ `stats.byProvince` ที่คำนวณไว้แล้ว เรียงทุนจากมากไปน้อย ตัด 5 อันดับ ตอบ `{ top: [{ province, capital }, ...] }` ด้วย `sendJson` — ไม่แตะ handler `/api/summary` เดิม
2. **`web/index.html` — เพิ่มการ์ด**: ต่อท้ายการ์ดเดิม หัวข้อ "จังหวัดที่ทุนสูงสุด (Top 5)" มี `<ol id="province-top">` และบรรทัดสถานะ `id="province-status"`
3. **`web/app.js` — เติมข้อมูล**: ฟังก์ชัน `loadProvinceTop()` เรียก `/api/provinces/top` สร้าง `<li>` ด้วย `textContent` (ไม่ใช้ `innerHTML`) แสดง `ชื่อจังหวัด — ทุน.toLocaleString('th-TH') บาท` ถ้าล้มให้ขึ้นข้อความในสถานะ แล้วเรียกตอนโหลดหน้า
4. **ตรวจด้วยมือ**: `npm start` → `curl http://127.0.0.1:3000/api/provinces/top` ได้ 5 แถวเรียงลดหลั่น และ `/api/summary` ยัง 16,772 / 45,341,868,784 เปิดหน้าเว็บเห็นการ์ด แล้ว**ปิดเซิร์ฟเวอร์**
5. **ด่าน**: `npm run gate` ต้อง exit 0 (6/6) รายงาน exit code จริง — ไม่แตะ `scripts/quality-gate.js` และ `data/`
