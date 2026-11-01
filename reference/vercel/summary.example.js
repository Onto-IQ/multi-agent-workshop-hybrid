'use strict';

/**
 * Shape for Lab 11. Place this file at api/summary.js only during that lab.
 * Read the same data/dataset.csv the local server reads, through the shared
 * helper the lab extracts from server.js. Do not keep a second formula here.
 *
 * vercel.example.json bundles that CSV with includeFiles because the file is
 * about 8 MB and Node file tracing does not reliably follow path.join.
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'dataset.csv');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  try {
    const csv = fs.readFileSync(CSV_PATH, 'utf8');
    // Replace this stub with the shared summary helper from the local server
    // after Lab 05 and Lab 06. The gate and this function must agree.
    send(res, 200, { ok: true, bytes: Buffer.byteLength(csv), source: 'dataset.csv' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'SUMMARY_FAILED' });
  }
};
