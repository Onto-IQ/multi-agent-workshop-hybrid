# Registry Insight

แดชบอร์ดธุรกิจจดทะเบียนใหม่ในไทย จากข้อมูลจริง "นิติบุคคลที่จดทะเบียนจัดตั้งใหม่ พ.ศ. 2558" ของกรมพัฒนาธุรกิจการค้า บนพอร์ทัล [data.go.th](https://data.go.th)

ใช้ในคลาสไฮบริด **Claude Code + OpenCode** วันที่ 12–13 พฤศจิกายน 2026 เปิดเครื่องมือทั้งสองที่โฟลเดอร์นี้ บทเรียน แบบฝึกหัด และชุดตามให้ทันอยู่คนละ repo: https://github.com/Onto-IQ/build-ai-multi-agent-hybrid

## สองเครื่องมือ

| เครื่องมือ | ไฟล์กติกา | คีย์ |
|---|---|---|
| Claude Code | `CLAUDE.md` | บัญชีของศูนย์ฝึก `ANTHROPIC_API_KEY` ต้องว่าง |
| OpenCode | `AGENTS.md` และ `opencode.json` | `OPENROUTER_API_KEY` ในตัวแปรของเครื่อง ห้าม commit |

`opencode.json` มีคอมเมนต์ว่ารูปแบบ permission เปลี่ยนตามรุ่นของ OpenCode ถ้าเปิดแล้วบ่นเรื่องรูปแบบ ให้ปรับตามข้อความ error แต่ยังต้องห้ามแก้ `scripts/quality-gate.js` และห้าม `git push`

## โครงสร้าง

```
├── package.json              สคริปต์ start / gate / verify — Node >= 20, ไม่มี dependency
├── server.js                 เซิร์ฟเวอร์ท้องถิ่น (ฟัง 127.0.0.1)
├── CLAUDE.md                 กติกาสำหรับ Claude Code
├── AGENTS.md                 กติกาสำหรับ OpenCode เนื้อหาตรงกับ CLAUDE.md
├── opencode.json             OpenRouter ผ่านตัวแปรสภาพแวดล้อม และเส้นสิทธิ์
├── data/
│   ├── dataset.csv           ตารางที่แอปอ่าน (ชุดเริ่มยังไม่สะอาด)
│   ├── raw/dbd-2558.parquet  ข้อมูลดิบ 16,781 แถว
│   ├── warehouse.duckdb      view businesses_raw สำหรับสาธิต MCP
│   └── README.md             พจนานุกรมคอลัมน์
├── lib/                      ตัวอ่าน CSV และกฎคุณภาพ
├── scripts/
│   ├── quality-gate.js       ด่าน 6 เคส (exit 2 = ยังไม่ผ่าน ตามดีไซน์)
│   ├── verify-setup.mjs      ตรวจเครื่องและแอปในโฟลเดอร์นี้
│   ├── check-machine.sh      ตรวจเครื่องบน macOS / Linux
│   └── check-machine.ps1     ตรวจเครื่องบน Windows
├── web/                      หน้าเว็บ มีช่องโน้ต
└── reference/vercel/         วิธีแนบ CSV ตอน Lab 11 อย่าคัดลอกก่อนแล็บนั้น
```

ชุดเริ่มไม่มี `vercel.json` และไม่มีโฟลเดอร์ `api/` เพราะผู้เรียนสร้างเองใน Lab 11

## วิธีรัน

```bash
npm start          # http://127.0.0.1:3000
npm run gate       # ด่านคุณภาพ ชุดเริ่มต้องจบที่ exit 2
npm test           # ตรวจชุดเริ่มโดยไม่ต้องมีคีย์
```

พอร์ตอื่น: `PORT=3001 npm start` บน Windows ใช้ `$env:PORT = 3001; npm start`

## เช็กเครื่อง

สคริปต์ไม่พิมพ์ค่าคีย์ บอกแค่จำนวนตัวอักษร

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-machine.ps1
```

Mac หรือ Linux:

```bash
bash scripts/check-machine.sh
```

ตรวจว่ามี Claude Code, OpenCode, Node 20 ขึ้นไป และ DuckDB ยืนยันว่า `OPENROUTER_API_KEY` ถูกตั้งแล้วโดยไม่พิมพ์ค่า และ `ANTHROPIC_API_KEY` ว่าง DuckDB ที่ยังไม่มีเป็นคำเตือน ไม่ทำให้สคริปต์ตก ต้องมีก่อน Lab 05

`npm run verify` ตรวจชุดเดียวกัน แล้วเปิดหน้าแรกและยืนยันว่าด่านชุดเริ่มเป็น exit 2

## สถานะเริ่มต้น (ตั้งใจให้เป็นแบบนี้)

- `data/dataset.csv` ยังเป็นของดิบ วันที่เป็น พ.ศ. มีแถวหัวตารางปน จังหวัดยังฝังในที่อยู่
- `npm run gate` จบด้วย **exit 2 (แดง 0/6)** งานของห้องคือพาให้ครบ **6/6**
- ช่องโน้ตบนหน้าแรกส่งไปที่ `/api/notes` ชุดเริ่มเก็บแค่ในหน่วยความจำ จึงหายเมื่อปิดเซิร์ฟเวอร์ ด่าน `notes-persists` จะผ่านเมื่อบันทึกลง `data/notes.json` บนเครื่องคุณ
- บน Vercel โน้ตเป็นอ่านอย่างเดียว อธิบายไว้บนหน้าเว็บและในกติกา ห้ามเขียนไฟล์ที่นั่น
- ห้ามเพิ่ม dependency npm ของแอป งานข้อมูลใช้ DuckDB ตามแล็บ
- ห้าม commit `.env` หรือค่าคีย์ ดูชื่อตัวแปรที่ว่างไว้ใน `.env.example`

## ตัวเลขอ้างอิงหลังข้อมูลสะอาด

16,772 กิจการ ทุนรวม 45,341,868,784 บาท รายละเอียดอยู่ใน `data/README.md`
