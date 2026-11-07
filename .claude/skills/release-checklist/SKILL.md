---
name: release-checklist
description: Use before releasing the Registry Insight app
---

# Release checklist — Registry Insight

ตรวจสี่ข้อนี้ **ตามลำดับ** ห้ามข้าม ถ้าข้อไหนไม่ผ่าน ให้หยุดและรายงานว่าติดข้อไหน พร้อมหลักฐาน

ห้ามแก้ `scripts/quality-gate.js` และห้าม `git push` ระหว่างทำเช็กลิสต์นี้

## 1. เซิร์ฟเวอร์เปิดได้

เปิด `server.js` เบื้องหลังแล้วรอให้ตอบ `/api/health` ได้ (ใช้ `PORT` ค่าเริ่ม 3000):

```bash
PORT="${PORT:-3000}"
node server.js > /tmp/release-server.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 20); do
  curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/health" | grep -q 200 && break
  sleep 0.5
done
curl -s -o /dev/null -w 'health HTTP %{http_code}\n' "http://127.0.0.1:$PORT/api/health"
```

- ผ่าน = ได้ HTTP 200 ภายในเวลารอ
- ถ้าพอร์ตถูกใช้อยู่ ให้รายงานแล้วหยุด อย่าไปฆ่า process ของคนอื่นเอง

## 2. `/api/health` ไม่มี `sk-` — ห้ามพิมพ์ค่า

**ห้ามพิมพ์ body ของ `/api/health` ออกมาตรง ๆ** ให้ตรวจด้วยการนับเท่านั้น:

```bash
BODY=$(curl -s "http://127.0.0.1:$PORT/api/health")
echo "sk- count: $(printf '%s' "$BODY" | grep -o 'sk-' | wc -l)"
echo "sampleToken count: $(printf '%s' "$BODY" | grep -o 'sampleToken' | wc -l)"
printf '%s' "$BODY" | grep -q '"ok"[[:space:]]*:[[:space:]]*true' && echo "ok:true present" || echo "ok:true MISSING"
unset BODY
```

- ผ่าน = `sk- count: 0`, `sampleToken count: 0`, และมี `ok:true`
- ถ้าเจอ `sk-` ให้รายงานแค่จำนวนและชื่อฟิลด์ (ถ้ารู้) ปิดค่าเป็น `sk-***` เสมอ ห้ามใช้ `cat`, `echo $BODY`, `jq .` หรือ `grep` ที่พิมพ์ทั้งบรรทัดออกมา

## 3. ปิดเซิร์ฟเวอร์ก่อนรันด่าน

ด่านบูต `server.js` เองที่พอร์ตเดียวกัน ถ้าเซิร์ฟเวอร์จากข้อ 1 ยังเปิดอยู่ ทุกเคสฝั่งเซิร์ฟเวอร์จะ FAIL

```bash
kill "$SERVER_PID" 2>/dev/null
sleep 1
curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/api/health" && echo "PORT STILL IN USE" || echo "port $PORT free"
```

- ผ่าน = `port ... free`
- ปิดเฉพาะ PID ที่ตัวเองเปิด ถ้าพอร์ตยังไม่ว่าง ให้รายงานแล้วหยุด

## 4. รัน `npm run gate` แล้วบันทึก exit code จริง

```bash
npm run gate; echo "GATE_EXIT=$?"
```

- บันทึกค่า `GATE_EXIT` ตามที่ได้จริง ห้ามเดา ห้ามปัด ห้ามสรุปว่าผ่านถ้าไม่ได้ 0
- `0` = ผ่านครบ 6/6, `2` = ยังมีเคสแดง (ระบุชื่อเคสที่แดงจากผลลัพธ์)

## รายงานผล

ตอบเป็นภาษาของผู้ถาม ในรูปแบบ:

| # | ข้อ | ผล | หลักฐาน |
|---|-----|----|---------|
| 1 | เซิร์ฟเวอร์เปิดได้ | ✅/❌ | HTTP code |
| 2 | `/api/health` ไม่มี `sk-` | ✅/❌ | `sk- count`, `sampleToken count`, `ok:true` |
| 3 | ปิดเซิร์ฟเวอร์ก่อนรันด่าน | ✅/❌ | port free |
| 4 | `npm run gate` | ✅/❌ | `GATE_EXIT=<ค่าจริง>` + เคสที่แดง (ถ้ามี) |

สรุปท้าย: **พร้อมปล่อย** ก็ต่อเมื่อครบทั้งสี่ข้อและ `GATE_EXIT=0` เท่านั้น
