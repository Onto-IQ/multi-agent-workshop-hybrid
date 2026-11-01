# Agents — Registry Insight (hybrid class)

ใช้คู่กับ `CLAUDE.md` กติกาต้องตรงกัน ถ้าแก้กฎฝั่งหนึ่ง ให้อัปเดตอีกฝั่ง

แอปนี้อยู่โฟลเดอร์นี้ บทเรียนและชุดตามให้ทันอยู่ที่ https://github.com/Onto-IQ/build-ai-multi-agent-hybrid อย่าคัดลอกเฉลยมาไว้ที่นี่

## ใครใช้อะไร

| งาน | เครื่องมือ |
|---|---|
| สำรวจ, ปิดด่าน 6/6, เช็กลิสต์, planner / developer / qa ในวันปิดงาน | Claude Code บัญชีของศูนย์ฝึก |
| สายการผลิตข้อมูล-หลังบ้าน-หน้าเว็บ, ความจำข้ามรอบ, สรุปผู้บริหาร | OpenCode ผ่าน OpenRouter |
| สาธิต MCP | วิทยากรเท่านั้น |

OpenCode อ่านคีย์จากตัวแปร `OPENROUTER_API_KEY` ผ่าน `opencode.json` (`{env:OPENROUTER_API_KEY}`) ห้ามวางค่าคีย์ลงไฟล์ `ANTHROPIC_API_KEY` ต้องว่าง เพื่อไม่ให้ทับบัญชี Claude ของคลาส

รูปแบบ permission ของ OpenCode เปลี่ยนตามรุ่น รุ่น 1 ใช้ `permission` กับ `bash` รุ่น 2 ใช้ `permissions` กับ `shell` ถ้ารุ่นที่ติดตั้งบ่น ให้ปรับตามข้อความ error แต่ยังต้องห้ามแก้ `scripts/quality-gate.js` และห้าม `git push`

## กติกา

- ตอบเป็นภาษาของผู้ถาม ชื่อไฟล์ ชื่อ endpoint และชื่อฟิลด์คงภาษาอังกฤษ
- งานสำรวจห้ามแก้ไฟล์
- แอปห้ามเพิ่ม dependency npm
- ห้ามแก้ `scripts/quality-gate.js`
- ห้าม `git push` เอง เว้นแต่ผู้เรียนสั่งหลังดู diff แล้ว
- อย่าอ่านหรือคัดลอกค่าที่ขึ้นต้นด้วย `sk-`
- ก่อนบอกว่าเสร็จ ให้รัน `npm run gate` แล้วรายงาน exit code จริง
- บนเครื่องผู้เรียน โน้ตต้องถูกเขียนลง `data/notes.json` เพื่อให้ด่าน `notes-persists` ผ่านหลังรีสตาร์ท ห้ามทำให้ด่านนี้หลวม
- บน Vercel (`process.env.VERCEL`) โน้ตเป็นอ่านอย่างเดียว ห้ามเขียนไฟล์ และห้ามตั้ง `ANTHROPIC_API_KEY` หรือ `OPENROUTER_API_KEY`
- ทางขึ้นของจริงคือ `api/*.js` ที่ผู้เรียนสร้างใน Lab 11 ไม่ใช่การเอา `server.js` ไปฟังพอร์ตบน Vercel อย่าสร้าง `vercel.json` หรือโฟลเดอร์ `api/` ก่อนแล็บนั้น
