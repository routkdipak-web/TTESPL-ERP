/* TTESPL gateway (Firebase Cloud Function v2): ONE function "api" with two routes
     POST <url>/ai        -> Gemini answer (key stays on the server)
     POST <url>/og-image  -> finds the real product photo on given product pages (server-side, so no browser CORS limit)
   Setup:  cd functions && npm i firebase-admin firebase-functions
           firebase functions:secrets:set GEMINI_API_KEY
           firebase deploy --only functions
   Then ERP -> Settings -> AI -> Gateway URL = the https URL of the "api" function (without /ai). */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const dns = require('dns').promises;
const net = require('net');
admin.initializeApp();
const KEY = defineSecret('GEMINI_API_KEY');
const GSTKEY = defineSecret('GST_API_KEY');   // gstinapi.in key (gak_...) or AppyFlow key_secret
const ALLOWED = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-4-argon'];

/* ---------- safety: only public https pages (no localhost / private network) ---------- */
function privateIp(ip) {
  if (net.isIPv6(ip)) return /^(::1|fc|fd|fe80)/i.test(ip);
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}
async function safeUrl(u) {
  const x = new URL(u);
  if (x.protocol !== 'https:' || net.isIP(x.hostname) || /(^|\.)(localhost|internal|local)$/i.test(x.hostname)) throw new Error('blocked');
  const { address } = await dns.lookup(x.hostname);
  if (privateIp(address)) throw new Error('blocked');
  return x;
}
async function getPage(u) {
  let url = u;
  for (let hop = 0; hop < 3; hop++) {
    const x = await safeUrl(url);
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 7000);
    try {
      const r = await fetch(x.href, { redirect: 'manual', signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TTESPL-ERP/1.0)', Accept: 'text/html' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), x.href).href; continue; }
      if (!r.ok || !/html/i.test(r.headers.get('content-type') || '')) throw new Error('not html');
      return { html: (await r.text()).slice(0, 400000), url: x.href };
    } finally { clearTimeout(t); }
  }
  throw new Error('too many redirects');
}
function pickImage(html, base) {
  const metas = [], re = /<meta\s+[^>]*>/gi; let m;
  while ((m = re.exec(html))) metas.push(m[0]);
  const find = (names) => {
    for (const tag of metas) {
      const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag), val = /content\s*=\s*["']([^"']+)["']/i.exec(tag);
      if (key && val && names.includes(key[1].toLowerCase())) return val[1];
    }
    return '';
  };
  let img = find(['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
  if (!img) { const l = /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i.exec(html); if (l) img = l[1]; }
  if (!img) { const j = /"image"\s*:\s*(?:\[\s*)?"([^"]+)"/i.exec(html); if (j) img = j[1]; }
  if (!img) return null;
  const title = (/<title[^>]*>([^<]{0,200})/i.exec(html) || [])[1] || find(['og:title']);
  try { const abs = new URL(img.replace(/&amp;/g, '&'), base).href; return /^https:/.test(abs) ? { imageUrl: abs, title: String(title || '').trim() } : null; } catch (e) { return null; }
}

exports.api = onRequest({ secrets: [KEY, GSTKEY], cors: true, region: 'asia-south1', timeoutSeconds: 60, memory: '256MiB' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try { await admin.auth().verifyIdToken(String(req.get('Authorization') || '').replace(/^Bearer /, '')); }   // only signed-in users
  catch (e) { return res.status(401).json({ error: 'Not signed in' }); }
  const b = req.body || {};

  if (req.path === '/og-image') {
    const pages = (Array.isArray(b.pages) ? b.pages : []).filter((u) => typeof u === 'string').slice(0, 6);
    const out = await Promise.all(pages.map(async (u) => {
      try { const pg = await getPage(u); const im = pickImage(pg.html, pg.url); return im ? { imageUrl: im.imageUrl, sourcePage: pg.url, title: im.title } : null; } catch (e) { return null; }
    }));
    return res.json({ images: out.filter(Boolean) });
  }

  if (req.path === '/gst') {
    const g = String(b.gstin || '').trim().toUpperCase();
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return res.status(400).json({ error: 'Invalid GSTIN' });
    try {
      const k = GSTKEY.value();
      if (/^gak_/.test(k)) {   // gstinapi.in  (free 75 credits, no card)
        const r = await fetch('https://www.gstinapi.in/v1/gstin/' + g, { headers: { 'x-api-key': k } });
        const j = await r.json().catch(() => ({}));
        if (r.status === 402) return res.status(402).json({ error: 'GST API credits finished' });
        if (!r.ok || j.success === false) return res.status(502).json({ error: j.error || j.message || 'GST lookup failed' });
        const x = j.data || {};
        const ad = [x.address, x.pincode && String(x.address || '').indexOf(x.pincode) < 0 ? x.pincode : ''].filter(Boolean).join(', ');
        return res.json({ gstin: x.gstin || j.gstin || g, name: x.trade_name || x.legal_name || '', person: x.legal_name || '', address: ad, status: x.status || '' });
      }
      const r = await fetch('https://appyflow.in/api/verifyGST?gstNo=' + encodeURIComponent(g) + '&key_secret=' + encodeURIComponent(k));
      const j = await r.json().catch(() => ({}));
      if (j.error) return res.status(502).json({ error: j.message || 'GST lookup failed' });
      const i = j.taxpayerInfo || j.data || j || {};
      const a = (i.pradr && (i.pradr.addr || i.pradr)) || {};
      const addr = typeof a === 'string' ? a : [a.bno, a.flno, a.bnm, a.st, a.loc, a.dst, a.stcd, a.pncd].filter(Boolean).join(', ');
      return res.json({ gstin: i.gstin || i.gstIn || g, name: i.tradeNam || i.lgnm || '', person: i.lgnm || '', address: addr || i.adr || '', status: i.sts || '' });
    } catch (e) { return res.status(502).json({ error: 'GST service not reachable' }); }
  }

  /* default: /ai */
  const model = ALLOWED.includes(b.model) ? b.model : 'gemini-3.8-flash';
  const prompt = String(b.prompt || '').slice(0, 20000);
  if (!prompt) return res.status(400).json({ error: 'Empty prompt' });
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (b.search) payload.tools = [{ google_search: {} }];
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY.value() }, body: JSON.stringify(payload)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: (d.error && d.error.message) || 'Provider error' });
  const c = d.candidates && d.candidates[0];
  const text = ((c && c.content && c.content.parts) || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
  const sources = (((c && c.groundingMetadata) || {}).groundingChunks || []).filter((x) => x.web).map((x) => ({ title: x.web.title || '', uri: x.web.uri || '' }));
  res.json({ text, sources });
});
