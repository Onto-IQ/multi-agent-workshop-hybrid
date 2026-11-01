'use strict';

async function loadSummary() {
  const status = document.getElementById('status');
  try {
    const res = await fetch('/api/summary');
    const body = await res.json();
    document.getElementById('companies').textContent = body.companyCount;
    document.getElementById('capital').textContent = body.totalCapital;
    status.textContent = 'โหลด /api/summary แล้ว — อย่าใช้ตัวเลขนี้ตัดสินใจจนกว่า quality gate จะผ่าน';
  } catch (err) {
    status.textContent = 'โหลดสรุปไม่สำเร็จ';
  }
}

function renderNotes(notes) {
  const list = document.getElementById('note-list');
  list.replaceChildren();
  if (!notes.length) {
    const item = document.createElement('li');
    item.textContent = 'ยังไม่มีโน้ตในรอบนี้';
    list.appendChild(item);
    return;
  }
  for (const note of notes) {
    const item = document.createElement('li');
    item.textContent = note.text || '';
    list.appendChild(item);
  }
}

async function loadNotes() {
  const status = document.getElementById('note-status');
  try {
    const res = await fetch('/api/notes');
    const body = await res.json();
    if (body.mode === 'readonly') {
      status.textContent = 'โหมดอ่านอย่างเดียวบน Vercel — บันทึกใหม่ไม่ได้';
    } else {
      status.textContent = 'โน้ตชุดเริ่มอยู่แค่ในหน่วยความจำของเซิร์ฟเวอร์นี้';
    }
    renderNotes(Array.isArray(body.notes) ? body.notes : []);
  } catch (err) {
    status.textContent = 'โหลดรายการโน้ตไม่สำเร็จ';
  }
}

async function saveNote(event) {
  event.preventDefault();
  const field = document.getElementById('note-text');
  const status = document.getElementById('note-status');
  const text = field.value.trim();
  if (!text) return;
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.status === 405) {
      status.textContent = 'เซิร์ฟเวอร์ปฏิเสธการบันทึก เพราะโน้ตเป็นอ่านอย่างเดียว';
      await loadNotes();
      return;
    }
    if (!res.ok) {
      status.textContent = 'บันทึกโน้ตไม่สำเร็จ';
      return;
    }
    field.value = '';
    await loadNotes();
  } catch (err) {
    status.textContent = 'บันทึกโน้ตไม่สำเร็จ';
  }
}

document.getElementById('note-form').addEventListener('submit', saveNote);
loadSummary();
loadNotes();
