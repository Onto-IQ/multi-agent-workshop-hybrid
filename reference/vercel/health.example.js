'use strict';

/**
 * Shape for Lab 11. Place this file at api/health.js only during that lab.
 * Return ok and nothing else. Do not echo tokens or environment variables.
 */

module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true }));
};
