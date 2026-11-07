# เทียบสองเครื่องมือ (Module 04)

- ไฟล์ผู้ช่วยของ Claude อยู่ที่ `.claude/agents/data-researcher.md` (tools: Read, Grep, Glob — ไม่มี Bash/Edit/Write) ส่วนของ OpenCode อยู่ที่ `.opencode/agents/data-researcher.md` (mode: subagent, permission deny edit+bash)
- อ้างบรรทัดได้ชัดทั้งคู่ แต่คนละจุด: ฝั่ง Claude อ้าง `server.js:35/155/164/165–166` แล้วต่อยอดเป็นตารางผูกกับด่าน 6 เคส ฝั่ง OpenCode อ้าง `server.js:130/154/155/156–159/164/165/166` เป็นลำดับขั้นการทำงานทีละขั้น
- ทั้งสองฝั่งไม่พยายามแก้ไฟล์เลย ตอบอย่างเดียวตามบทบาทอ่านอย่างเดียวที่กำหนดใน frontmatter
