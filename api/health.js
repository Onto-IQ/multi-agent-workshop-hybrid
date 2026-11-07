'use strict';

/**
 * Vercel function (Lab 11): api/health.js.
 * Return ok and nothing else. Do not echo tokens or environment variables.
 */

module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true }));
};
