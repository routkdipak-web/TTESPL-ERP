/* TTESPL service worker (v42.1): push notifications + offline app shell. One file, one registration. */
var CACHE = 'ttespl-shell-v447';
try {
  /* v42.3: same SDK version as the page (12.19.0); if that bundle cannot load, fall back to the old 10.12.2 one */
  try { importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js'); }
  catch (e0) { importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'); }
  firebase.initializeApp({ apiKey: 'AIzaSyAjsq2wbyXmt8_MjEazM9mAYd5vlZW0dy4', authDomain: 'ttespl.firebaseapp.com', projectId: 'ttespl', storageBucket: 'ttespl.firebasestorage.app', messagingSenderId: '244674439608', appId: '1:244674439608:web:7f7299ffd94e0a0cc5474d' });
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function (p) {
    var n = (p && p.notification) || {};
    self.registration.showNotification(n.title || 'TTESPL Alert', { body: n.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: p && p.data });
  });
} catch (e) { /* offline / blocked: caching below still works */ }

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && k.indexOf('ttespl-shell-') === 0; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) { for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) return cs[i].focus(); } if (self.clients.openWindow) return self.clients.openWindow('./'); }));
});
/* Network first (so a new version always wins), cached copy when there is no internet. Only same-site GET files + the CDN libraries. Firebase / API traffic is never cached. */
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url), same = u.origin === self.location.origin, lib = /(^|\.)(unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  if (!same && !lib) return;
  if (same && /firebase-messaging-sw\.js$/.test(u.pathname)) return;
  e.respondWith(caches.has('ttespl-nocache').then(function (off) { if (off) return fetch(r); return netFirst(r); }));
});
function netFirst(r) {
  return (fetch(r.mode === 'navigate' ? r.url : new Request(r, { cache: 'no-cache' }), r.mode === 'navigate' ? { cache: 'no-cache', credentials: 'same-origin' } : undefined).then(function (res) {
    if (res && (res.ok || res.type === 'opaque')) { var c = res.clone(); caches.open(CACHE).then(function (ch) { ch.put(r, c); }).catch(function () {}); }
    return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: false }).then(function (m) { return m || (r.mode === 'navigate' ? (/shop\.html/.test(r.url) ? caches.match('shop.html') : (caches.match('index.html') || caches.match('./'))) : undefined); }); }));
}
