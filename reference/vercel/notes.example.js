'use strict';

/**
 * Shape for Lab 11. Place this file at api/notes.js only during that lab.
 *
 * The laptop server writes data/notes.json so notes-persists can pass.
 * This handler must not call writeFile, appendFile, or createWriteStream.
 */

const DEMO = [
  {
    text: 'ตัวอย่างโน้ตสำหรับเดโม อ่านอย่างเดียวบน Vercel',
    demo: true,
  },
];

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'GET') {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, mode: 'readonly', notes: DEMO }));
    return;
  }
  res.statusCode = 405;
  res.setHeader('Allow', 'GET');
  res.end(JSON.stringify({
    ok: false,
    error: 'NOTES_READONLY',
    message: 'โน้ตบน Vercel เป็นตัวอย่างอ่านอย่างเดียว เพราะดิสก์ของ serverless ไม่เก็บไฟล์ถาวร',
  }));
};
