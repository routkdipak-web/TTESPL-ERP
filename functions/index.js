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
const crypto = require('crypto');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
admin.initializeApp({ storageBucket: 'ttespl.firebasestorage.app' });
const KEY = defineSecret('GEMINI_API_KEY');
const GSTKEY = defineSecret('GST_API_KEY');   // gstinapi.in key (gak_...) or AppyFlow key_secret
const ALLOWED = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-4-argon'];

/* ---------- safety: only public https pages (no localhost / private network) ----------
   v42.3: the address is checked at CONNECT time (custom lookup), so DNS tricks between "check" and "fetch" cannot reach a private network.
   Also blocks 100.64/10, 198.18/15, 192.0.0/24, multicast/reserved and IPv4-mapped IPv6. */
const https = require('https');
function privateIp(ip) {
  ip = String(ip || '').toLowerCase();
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip); if (m) ip = m[1];
  if (net.isIPv6(ip)) return /^(::1?$|::$|fc|fd|fe[89ab]|ff|2001:db8|64:ff9b)/i.test(ip);
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] >= 224 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || (p[0] === 192 && p[1] === 0 && p[2] === 0) || (p[0] === 198 && (p[1] === 18 || p[1] === 19));
}
function safeLookup(hostname, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  require('dns').lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs || !addrs.length || addrs.some((a) => privateIp(a.address))) return cb(new Error('blocked'));
    if (opts && opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}
function checkUrl(u) {
  const x = new URL(u);
  if (x.protocol !== 'https:' || net.isIP(x.hostname.replace(/^\[|\]$/g, '')) || /(^|\.)(localhost|internal|local)$/i.test(x.hostname)) throw new Error('blocked');
  return x;
}
function fetchSafe(x) {   // one GET, no auto-redirect, max 400 KB, 7 s
  return new Promise((resolve, reject) => {
    const req = https.request({ protocol: 'https:', hostname: x.hostname, port: x.port || 443, path: x.pathname + x.search, method: 'GET', lookup: safeLookup, timeout: 7000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TTESPL-ERP/1.0)', Accept: 'text/html', 'Accept-Encoding': 'identity' } }, (r) => {
      const status = r.statusCode || 0, type = String(r.headers['content-type'] || ''), loc = r.headers.location;
      if (status >= 300 && status < 400 && loc) { r.resume(); return resolve({ redirect: new URL(loc, x.href).href }); }
      if (status < 200 || status >= 300 || !/html/i.test(type)) { r.resume(); return reject(new Error('not html')); }
      let size = 0; const chunks = [];
      r.on('data', (c) => { size += c.length; if (size > 400000) { r.destroy(); resolve({ html: Buffer.concat(chunks).toString('utf8').slice(0, 400000) }); } else chunks.push(c); });
      r.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8').slice(0, 400000) }));
      r.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}
async function getPage(u) {
  let url = u;
  for (let hop = 0; hop < 3; hop++) {
    const x = checkUrl(url), r = await fetchSafe(x);
    if (r.redirect) { url = r.redirect; continue; }
    return { html: r.html, url: x.href };
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


/* ---------- v41: password / PIN check on the SERVER (same hash format as the app: pbkdf2$iter$salt$hex) ---------- */
function sha256hex(x) { return crypto.createHash('sha256').update(x, 'utf8').digest('hex'); }
function safeEq(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function hashSecret(secret, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return 'pbkdf2$150000$' + salt + '$' + crypto.pbkdf2Sync(String(secret), salt, 150000, 32, 'sha256').toString('hex');
}
function verifySecret(secret, stored) {
  const p = String(stored || '').split('$'); if (p.length !== 4) return false;
  const alg = p[0], iter = Number(p[1]) || 0, salt = p[2];
  let calc;
  if (alg === 'pbkdf2') calc = crypto.pbkdf2Sync(String(secret), salt, iter, 32, 'sha256').toString('hex');
  else if (alg === 'sha256') { let h = salt + ':' + secret; for (let i = 0; i < iter; i++) h = sha256hex(h + salt); calc = h; }
  else return false;
  return safeEq(calc, p[3]);
}
async function guard(id) {   // 5 wrong tries -> 5 minute lock, kept in the database (cannot be bypassed from the phone)
  const ref = admin.firestore().collection('login_guard').doc(id), d = (await ref.get()).data() || {};
  return { ref, n: d.n || 0, until: d.until || 0 };
}
async function failTry(g, max, lockMin) { max = max || 5; lockMin = lockMin || 5; const n = g.n + 1; await g.ref.set(n >= max ? { n: 0, until: Date.now() + lockMin * 60000 } : { n, until: 0 }); }
/* v42.3: two counters. (1) this phone/IP + number: 5 wrong -> 5 min lock (a stranger can no longer lock a staff member out from anywhere).
   (2) the number from anywhere: 40 wrong -> 15 min lock (stops slow guessing from many IPs). */
function clientIp(req) { return String(((req && req.headers && req.headers['x-forwarded-for']) || (req && req.ip) || 'x')).split(',')[0].trim(); }
async function guards(kind, mobile, req) {
  const tag = crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
  return { ip: await guard(kind + 'ip:' + tag + ':' + mobile), all: await guard(kind + 'all:' + mobile) };
}
function lockedMsg(G) { const u = Math.max(G.ip.until, G.all.until); return u > Date.now() ? 'Too many wrong attempts. Try again in ' + Math.ceil((u - Date.now()) / 60000) + ' minute(s).' : ''; }
async function failBoth(G) { await failTry(G.ip, 5, 5); await failTry(G.all, 40, 15); }
async function clearBoth(G) { await G.ip.ref.delete().catch(() => {}); await G.all.ref.delete().catch(() => {}); }
async function findStaff(mobile) {
  const q = await admin.firestore().collection('staff').where('mobile', '==', mobile).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0], st = doc.data(), sec = (await admin.firestore().collection('staff_secrets').doc(doc.id).get()).data() || {};
  return { id: doc.id, st, sec };
}
function checkField(f, field, secret) {   // field = 'pass' | 'pin'  (secrets doc first, then old staff doc fields)
  const h = f.sec[field + 'Hash'] || f.st[field + 'Hash'];
  if (h) return verifySecret(secret, h);
  const plain = f.st[field]; return plain != null && plain !== '' && safeEq(plain, secret);
}
async function moveSecrets(f) {   // move hashes out of the staff document (which every staff phone can read)
  const sec = {}, st = f.st;
  if (st.passHash) sec.passHash = st.passHash; else if (st.pass) sec.passHash = hashSecret(String(st.pass));
  if (st.pinHash) sec.pinHash = st.pinHash; else if (st.pin) sec.pinHash = hashSecret(String(st.pin));
  if (!Object.keys(sec).length) return false;
  await admin.firestore().collection('staff_secrets').doc(f.id).set(sec, { merge: true });
  const del = admin.firestore.FieldValue.delete();
  await admin.firestore().collection('staff').doc(f.id).set({ passHash: del, pinHash: del, pass: del, pin: del }, { merge: true });
  return true;
}
async function migrateAllSecrets() {
  const all = await admin.firestore().collection('staff').get(); let n = 0;
  for (const d of all.docs) { if (await moveSecrets({ id: d.id, st: d.data(), sec: {} })) n++; }
  return n;
}
async function secureLogin(b, res, req) {
  const mobile = String(b.mobile || '').trim(), pass = String(b.pass || '');
  if (!/^\d{10}$/.test(mobile) || !pass) return res.status(400).json({ error: 'Enter mobile and password' });
  try {
    const G = await guards('', mobile, req), lm = lockedMsg(G);
    if (lm) return res.status(429).json({ error: lm });
    const f = await findStaff(mobile);
    if (!f || !checkField(f, 'pass', pass)) { await failBoth(G); return res.status(401).json({ error: 'Invalid Mobile Number or Password!' }); }
    await clearBoth(G);
    await moveSecrets(f).catch(() => {});
    const role = String(f.st.role || 'Staff');
    const token = await admin.auth().createCustomToken('staff_' + f.id, { role, staffId: f.st.id == null ? f.id : f.st.id, name: String(f.st.name || '') });
    const user = Object.assign({}, f.st); ['pass', 'pin', 'passHash', 'pinHash'].forEach((k) => delete user[k]);
    return res.json({ token, user });
  } catch (e) { return res.status(500).json({ error: 'Login service error' }); }
}
async function securePinReset(b, res, req) {
  const mobile = String(b.mobile || '').trim(), pin = String(b.pin || ''), np = String(b.newPass || '');
  if (!/^\d{10}$/.test(mobile) || !pin) return res.status(400).json({ error: 'Enter mobile and PIN' });
  if (np.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters!' });
  try {
    const G = await guards('reset:', mobile, req), lm = lockedMsg(G);
    if (lm) return res.status(429).json({ error: lm });
    const f = await findStaff(mobile);
    if (!f || !checkField(f, 'pin', pin)) { await failBoth(G); return res.status(401).json({ error: 'Invalid Mobile Number or PIN!' }); }
    await clearBoth(G);
    await admin.firestore().collection('staff_secrets').doc(f.id).set({ passHash: hashSecret(np) }, { merge: true });
    await moveSecrets(f).catch(() => {});
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: 'Reset service error' }); }
}

exports.api = onRequest({ secrets: [KEY, GSTKEY], cors: true, region: 'asia-south1', timeoutSeconds: 60, memory: '256MiB' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {};

  /* ===== v41 SECURE MODE routes (public: they check the staff password / PIN themselves, with a server-side lock) ===== */
  if (req.path === '/login') return secureLogin(b, res, req);
  if (req.path === '/reset') return securePinReset(b, res, req);

  let decoded;
  try { decoded = await admin.auth().verifyIdToken(String(req.get('Authorization') || '').replace(/^Bearer /, '')); }   // only signed-in users
  catch (e) { return res.status(401).json({ error: 'Not signed in' }); }

  /* Admin-only routes */
  if (req.path === '/staff-secret' || req.path === '/migrate') {
    if (decoded.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    try {
      if (req.path === '/migrate') return res.json({ moved: await migrateAllSecrets() });
      const id = String(b.staffId || ''); if (!id) return res.status(400).json({ error: 'staffId missing' });
      const sec = {};
      if (b.passHash) sec.passHash = String(b.passHash); else if (b.pass) sec.passHash = hashSecret(String(b.pass));
      if (b.pinHash) sec.pinHash = String(b.pinHash); else if (b.pin) sec.pinHash = hashSecret(String(b.pin));
      if (!Object.keys(sec).length) return res.status(400).json({ error: 'Nothing to set' });
      await admin.firestore().collection('staff_secrets').doc(id).set(sec, { merge: true });
      await admin.firestore().collection('staff').doc(id).set({ passHash: admin.firestore.FieldValue.delete(), pinHash: admin.firestore.FieldValue.delete(), pass: admin.firestore.FieldValue.delete(), pin: admin.firestore.FieldValue.delete() }, { merge: true }).catch(() => {});
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'Failed' }); }
  }

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


/* ===== v41: real push notifications (phone gets it even when the app is closed) =====
   Fires whenever the app writes a document to app_notifications (new order, delivery, payment...). Needs: firebase deploy --only functions */
exports.pushOnNotification = onDocumentCreated({ document: 'app_notifications/{id}', region: 'asia-south1' }, async (event) => {
  const n = event.data && event.data.data(); if (!n) return;
  const snap = await admin.firestore().collection('fcm_tokens').get();
  const tokens = []; snap.forEach((d) => { const x = d.data(); if (x && x.token && x.staff !== n.by) tokens.push(x.token); });
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const r = await admin.messaging().sendEachForMulticast({ tokens: chunk, notification: { title: String(n.title || 'TTESPL Alert').slice(0, 100), body: String(n.body || '').slice(0, 250) }, data: { type: String(n.type || 'info') } });
    const dead = []; r.responses.forEach((x, k) => { const c = x.error && x.error.code; if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') dead.push(chunk[k]); });
    await Promise.all(dead.map((t) => admin.firestore().collection('fcm_tokens').doc(t.replace(/\//g, '~')).delete().catch(() => {})));
  }
});

/* ===== v43.3: customer says "I paid by UPI" on view.html -> push to every staff phone (Admin verifies in the app). Needs: firebase deploy --only functions ===== */
exports.pushOnClaim = onDocumentCreated({ document: 'payment_claims/{id}', region: 'asia-south1' }, async (event) => {
  const n = event.data && event.data.data(); if (!n) return;
  const snap = await admin.firestore().collection('fcm_tokens').get();
  const tokens = []; snap.forEach((d) => { const x = d.data(); if (x && x.token) tokens.push(x.token); });
  const title = '💳 Payment claim from customer', body = String((n.by || n.name || 'Customer') + ' says ₹' + Number(n.amt || 0).toLocaleString('en-IN') + ' paid by UPI (UTR ' + String(n.utr || '').slice(0, 30) + '). Please verify.').slice(0, 250);
  for (let i = 0; i < tokens.length; i += 500) {
    const r = await admin.messaging().sendEachForMulticast({ tokens: tokens.slice(i, i + 500), notification: { title, body }, data: { type: 'claim' } });
    const dead = []; r.responses.forEach((x, k) => { const c = x.error && x.error.code; if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') dead.push(tokens[i + k]); });
    await Promise.all(dead.map((t) => admin.firestore().collection('fcm_tokens').doc(t.replace(/\//g, '~')).delete().catch(() => {})));
  }
});

/* ===== v41: automatic daily backup to Cloud Storage (backups/YYYY-MM-DD.json, last 30 kept). Needs the Blaze plan. ===== */
exports.dailyBackup = onSchedule({ schedule: '30 1 * * *', timeZone: 'Asia/Kolkata', region: 'asia-south1', memory: '512MiB', timeoutSeconds: 300 }, async () => {
  const cols = ['customers', 'inventory', 'machinery', 'leads', 'orders', 'services', 'machine_parts', 'quotations', 'travel_expenses', 'crm_records', 'company_settings', 'catalog_categories', 'brands', 'expenses', 'overheads', 'perms', 'tasks', 'suppliers', 'purchases', 'purchase_bills', 'payment_claims', 'attendance', 'leaves', 'events', 'notices', 'cash_closings', 'office_config', 'recycle_bin', 'counters', 'staff'];
  const out = { app: 'TTESPL-ERP', kind: 'server-backup', exportedAt: new Date().toISOString(), data: {} };
  for (const c of cols) {
    const s = await admin.firestore().collection(c).get(); out.data[c] = [];
    s.forEach((d) => { const x = d.data(); if (c === 'staff') ['pass', 'pin', 'passHash', 'pinHash'].forEach((k) => delete x[k]); out.data[c].push(x); });
  }
  const bucket = admin.storage().bucket(), day = new Date().toISOString().slice(0, 10);
  await bucket.file('backups/' + day + '.json').save(JSON.stringify(out), { contentType: 'application/json' });
  const [files] = await bucket.getFiles({ prefix: 'backups/' });
  const old = files.map((f) => f.name).sort().slice(0, Math.max(0, files.length - 30));
  await Promise.all(old.map((n) => bucket.file(n).delete().catch(() => {})));
});


/* ===== v41: evening summary (8 pm IST) -> becomes a push notification through pushOnNotification. Turn off: Settings > Office Tools > Evening summary ===== */
exports.dailySummary = onSchedule({ schedule: '0 20 * * *', timeZone: 'Asia/Kolkata', region: 'asia-south1', memory: '256MiB', timeoutSeconds: 120 }, async () => {
  const db = admin.firestore();
  const flag = await db.collection('office_config').doc('v41_flags').get();
  if (flag.exists && flag.data().dailySummary === false) return;
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const snap = await db.collection('orders').get();
  let sales = 0, bills = 0, coll = 0, booked = 0, pend = 0, due = 0;
  snap.forEach((d) => {
    const o = d.data(); if (!o || o.status === 'Cancelled') return;
    const pays = Array.isArray(o.payments) ? o.payments : [], sum = pays.reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const dd = String(o.deliveredDate || o.orderDate || '').slice(0, 10);
    if (o.status === 'Delivered' && dd === today) { sales += Number(o.totalAmount) || 0; bills++; }
    if (o.orderDate === today) { booked++; const adv = (Number(o.recvAmount) || 0) - sum; if (adv > 0) coll += adv; }
    pays.forEach((p) => { if (p && !p.adjust && Number(p.amount) > 0 && String(p.at || '').slice(0, 10) === today) coll += Number(p.amount); });
    if (o.status === 'Pending') pend++;
    if (o.status === 'Delivered') due += Number(o.dueAmount) || 0;
  });
  const f = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  await db.collection('app_notifications').doc('DS-' + today).set({ id: 'DS-' + today, title: '📊 Today: ' + f(sales) + ' sales', body: bills + ' bills delivered · collected ' + f(coll) + ' · ' + booked + ' new orders · ' + pend + ' pending deliveries · total dues ' + f(due), type: 'summary', by: 'system', at: Date.now() });
});
