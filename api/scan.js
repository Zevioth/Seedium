'use strict';

const UPSTREAM_BASE = process.env.SEEDFINDER_API_BASE || 'https://www.mineseedfinder.com';
const ALLOWED_TYPES = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '23', '24']);

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (req.method === 'GET') {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    return Object.fromEntries(url.searchParams.entries());
  }
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Use GET or POST for scan requests.' });
  }

  const body = parseBody(req);
  if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'Request body must be valid JSON.' });

  const seed = String(body.seed ?? '').trim();
  if (!/^-?\d{1,20}$/.test(seed)) {
    return sendJson(res, 400, { error: 'Seed must be a numeric value containing up to 20 digits.' });
  }

  const x = Number(body.x ?? 0);
  const z = Number(body.z ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 30000000 || Math.abs(z) > 30000000) {
    return sendJson(res, 400, { error: 'X and Z must be valid coordinates between -30,000,000 and 30,000,000.' });
  }

  const radius = Number(body.radius ?? 100);
  const max = Number(body.max ?? 50);
  if (!Number.isInteger(radius) || radius < 1 || radius > 1000) {
    return sendJson(res, 400, { error: 'Radius must be an integer from 1 to 1,000 chunks.' });
  }
  if (!Number.isInteger(max) || max < 1 || max > 200) {
    return sendJson(res, 400, { error: 'Max results must be an integer from 1 to 200.' });
  }

  const rawTypes = Array.isArray(body.types) ? body.types.join(',') : String(body.types ?? '');
  const types = [...new Set(rawTypes.split(',').map(item => item.trim()).filter(Boolean))];
  if (!types.length || types.some(id => !ALLOWED_TYPES.has(id))) {
    return sendJson(res, 400, { error: 'Choose one or more supported structure types.' });
  }

  const upstreamUrl = new URL('/scan/bedrock', UPSTREAM_BASE);
  upstreamUrl.searchParams.set('seed', seed);
  upstreamUrl.searchParams.set('x', String(Math.trunc(x)));
  upstreamUrl.searchParams.set('z', String(Math.trunc(z)));
  upstreamUrl.searchParams.set('radius', String(radius));
  upstreamUrl.searchParams.set('max', String(max));
  upstreamUrl.searchParams.set('types', types.join(','));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'MozCraft-Seed-Map/1.0' },
      signal: controller.signal
    });
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { return sendJson(res, 502, { error: 'The structure service returned an unreadable response.' }); }

    if (!upstream.ok) {
      const message = payload.error || payload.message || `The structure service returned HTTP ${upstream.status}.`;
      return sendJson(res, upstream.status >= 500 ? 502 : upstream.status, { error: message });
    }
    if (payload && payload.error) {
      return sendJson(res, 502, { error: payload.error });
    }
    if (!payload || !Array.isArray(payload.results)) {
      return sendJson(res, 502, { error: 'The structure service response did not include a results array.' });
    }
    return sendJson(res, 200, { results: payload.results });
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    return sendJson(res, 502, {
      error: timedOut
        ? 'The structure service took too long to respond. Try a smaller radius.'
        : 'Could not connect to the upstream structure service. Try again later.'
    });
  } finally {
    clearTimeout(timeout);
  }
};
