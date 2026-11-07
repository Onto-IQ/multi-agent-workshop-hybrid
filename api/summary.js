'use strict';

/**
 * Vercel function for GET /api/summary.
 * Uses the same analyze() from lib/inspect-data.js as server.js and the
 * quality gate, so the numbers match the laptop exactly.
 * vercel.json bundles data/dataset.csv and lib/** via includeFiles.
 */

const fs = require('fs');
const path = require('path');
const { analyze } = require('../lib/inspect-data');

const CSV_PATH = path.join(__dirname, '..', 'data', 'dataset.csv');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const result = analyze(fs.readFileSync(CSV_PATH, 'utf8'));
    send(res, 200, {
      companyCount: result.stats.companyCount,
      totalCapital: result.stats.totalCapital,
      source: 'inspect-data.js',
    });
  } catch (err) {
    console.error(err);
    send(res, 500, { ok: false, error: 'SUMMARY_FAILED' });
  }
};
