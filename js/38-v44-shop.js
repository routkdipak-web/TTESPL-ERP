/* TTESPL ERP v44 - ONLINE STORE (settings, product manager, publisher, SEO pack)
   The public page is shop.html. Staff choose which products are online (per-product switch), set online price / offer % / bulk slabs / photos.
   Only a small public copy is written to Firestore (shop_catalog/*, shop_img/*, shop_track/*) - never cost price, dealer price or customers. */
(function () {
  'use strict';
  var X = window.ttx, T = window.TTSHOP; if (!X || !T) return;
  var H = X.H, N = T.N, R2 = T.R2, CFGID = 'ttShopCfg', PRID = 'ttShopProds', EDID = 'ttShopProd';
  function $(i) { return document.getElementById(i); }
  function rs(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function inv() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }
  function isMach(i) { return i && (i.category === 'Machines & Equipment' || i.category === 'Catalog Equipment'); }
  function co() { return window.companyDetailsData || {}; }
  var DEF = { id: 'main', open: true, pub: false, name: 'TTESPL Shop', wa: '', upiPa: 'eazypay.574099310@icici', upiPn: 'TWINTOWN EXPRESS SERVICES', area: 'odisha', shipO: 100, shipI: 100, freeAbove: 0, backorder: false, banner: '', promo: '', coupons: [], baseUrl: '' };
  function cfg() { var l = X.list('SHOP_CFG'); return Object.assign({}, DEF, (l && l[0]) || {}); }
  function saveCfg(c) { c.id = 'main'; X.upsert('SHOP_CFG', c); }
  window.ttShopCfg = cfg;
  function baseUrl() { var c = cfg(); if (c.baseUrl) return c.baseUrl.replace(/\/+$/, '') + '/'; try { return location.origin + location.pathname.replace(/[^\/]*$/, ''); } catch (e) { return ''; } }
  window.ttShopUrl = function () { return baseUrl() + 'shop.html'; };

  /* ---------- the public copy of one product ---------- */
  function onl(i) { return (i && i.online) || {}; }
  function pubProd(i) {
    var o = onl(i), m = isMach(i), price = N(o.p) > 0 ? N(o.p) : (m ? 0 : N(i.rate));   // machines: public price only if you type one (else "Call for price")
    return { id: String(i.id), on: true, n: String(i.name || '').slice(0, 140), c: String(i.subCategory || i.category || '').replace(/^Machines & Equipment$/, 'Machines').slice(0, 60), k: String(i.code || ''), t: m ? 'm' : 'c',
      p: price, mrp: N(o.mrp) > price ? N(o.mrp) : 0, off: N(o.off), bulk: (o.bulk || []).filter(function (b) { return N(b.q) > 0 && N(b.pct) > 0; }).map(function (b) { return { q: N(b.q), pct: N(b.pct) }; }),
      d: String(o.d || i.desc || '').slice(0, 1500), sp: String(i.specs || '').slice(0, 1000), s: m ? 0 : Math.max(0, N(i.stock)), f: o.f ? 1 : 0 };
  }
  function pubCfg() {
    var c = cfg(), d = co();
    return { name: c.name, wa: c.wa, upi: { pa: c.upiPa, pn: c.upiPn }, area: c.area, ship: { odisha: N(c.shipO), india: N(c.shipI) }, freeAbove: N(c.freeAbove), backorder: !!c.backorder, open: c.open !== false, banner: c.banner, promo: c.promo,
      coupons: (c.coupons || []).filter(function (x) { return x && x.code && x.on !== false; }).map(function (x) { return { code: String(x.code).toUpperCase(), type: x.type === 'flat' ? 'flat' : 'pct', val: N(x.val), min: N(x.min), max: N(x.max), on: true, show: !!x.show }; }),
      catN: (window.ttShopCatWant ? ttShopCatCount() : 0), addr: d.address || 'Plot 1270/8566, Satya Vihar, Rasulgarh, Bhubaneswar - 751010', gstin: d.gstin || '21AAICT6014E1ZT', contact: d.contact || '+91 8917465040 / 6743175599' };
  }
  window.ttShopPubProd = pubProd;

  /* ---------- publisher: writes only what changed ---------- */
  var HK = 'TTESPL_SHOP_HASH', busy = false, tmr = null, dirty = false;
  function hashes() { try { return JSON.parse(localStorage.getItem(HK) || '{}'); } catch (e) { return {}; } }
  function saveHashes(h) { try { localStorage.setItem(HK, JSON.stringify(h)); } catch (e) {} }
  function hs(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
  function cs() { return window.cloudSync; }
  function publishAll(force) {
    var c = cfg(); if (!c.pub || !cs() || !cs().putPublic) return Promise.resolve({ w: 0, d: 0 });
    if (busy) { dirty = true; return Promise.resolve({ w: 0, d: 0 }); }
    busy = true; var h = hashes(), want = {}, jobs = [], w = 0, d = 0;
    want['shop_catalog/_cfg'] = JSON.stringify(pubCfg());
    inv().forEach(function (i) { if (i && onl(i).on) want['shop_catalog/p_' + i.id] = JSON.stringify(pubProd(i)); });
    try { if (window.ttShopCatWant) Object.assign(want, ttShopCatWant()); } catch (e) { console.warn('shop cat', e); }
    Object.keys(want).forEach(function (k) {
      var hh = hs(want[k]); if (!force && h[k] === hh) return;
      var p = k.split('/'); jobs.push(cs().putPublic(p[0], p[1], { j: want[k] }).then(function () { h[k] = hh; w++; }));
    });
    Object.keys(h).forEach(function (k) {
      if ((k.indexOf('shop_catalog/p_') === 0 || k.indexOf('shop_cat/') === 0) && !want[k]) { var p = k.split('/'); jobs.push(cs().delPublic(p[0], p[1]).then(function () { delete h[k]; d++; })); }
    });
    return Promise.all(jobs.map(function (j) { return j.catch(function (e) { console.warn('shop publish', e); return 'x'; }); })).then(function () {
      saveHashes(h); busy = false; if (dirty) { dirty = false; sched(); } return { w: w, d: d };
    });
  }
  function sched() { clearTimeout(tmr); tmr = setTimeout(function () { publishAll(false); }, 4000); }
  window.ttShopPublish = publishAll; window.ttShopSched = sched;
  function wrap() {
    var f = window.setStored; if (typeof f !== 'function' || f.__shop) return;
    var w = function (k) { var r = f.apply(this, arguments); if (k === 'INVENTORY' || k === 'SHOP_CFG' || k === 'COMPANY_DETAILS') sched(); return r; }; w.__shop = 1;
    window.setStored = w; try { setStored = w; } catch (e) {}
  }
  wrap(); setTimeout(wrap, 1500); setTimeout(function () { if (cfg().pub) publishAll(false); }, 22000);

  /* ---------- photos: compress on the phone, one small document per product ---------- */
  function shrink(file, max) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onerror = rej;
      fr.onload = function () { var im = new Image(); im.onerror = rej; im.onload = function () {
        var s = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.72)); }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  window.ttShopShrink = shrink;
  function getImgs(id) { return cs() && cs().getPublic ? cs().getPublic('shop_img', 'p_' + id).then(function (d) { try { return d && d.d ? JSON.parse(d.d) : []; } catch (e) { return []; } }) : Promise.resolve([]); }
  window.ttShopGetImgs = getImgs;

  /* ============ SETTINGS SHEET ============ */
  function inp(label, key, c, type, extra) { return '<label style="font-size:12.5px;display:block;margin-top:8px">' + label + '</label><input data-c="' + key + '" type="' + (type || 'text') + '" value="' + H(c[key] == null ? '' : c[key]) + '" ' + (extra || '') + ' style="width:100%">'; }
  function sel(label, key, c, opts) { return '<label style="font-size:12.5px;display:block;margin-top:8px">' + label + '</label><select data-c="' + key + '" style="width:100%">' + opts.map(function (o) { return '<option value="' + H(o[0]) + '"' + (String(c[key]) === String(o[0]) ? ' selected' : '') + '>' + H(o[1]) + '</option>'; }).join('') + '</select>'; }
  function cnt() { var on = 0, tot = 0; inv().forEach(function (i) { if (i && (i.category !== 'Catalog Equipment' || true)) { tot++; if (onl(i).on) on++; } }); return on; }
  function drawCfg() {
    var c = cfg(), url = window.ttShopUrl();
    var h = '<div class="ttx-note"><b>🛒 Online store</b> — customers see only the products you switch ON. Prices include GST. Online orders arrive in <b>Online Orders</b> (menu).</div>' +
      '<div class="ttx-note" style="word-break:break-all"><b>Store link</b><br>' + H(url) + '</div>' +
      '<div class="ttx-btns" style="flex-wrap:wrap"><button class="ttx-b pri" data-a="pubnow" style="flex:1 1 100%">' + (c.pub ? '🔄 Publish changes now' : '🚀 Start / publish the store') + '</button>' +
      '<button class="ttx-b" data-a="copy" style="flex:1 1 48%">📋 Copy link</button><button class="ttx-b" data-a="wa" style="flex:1 1 48%">📤 Share link</button>' +
      '<button class="ttx-b" data-a="prods" style="flex:1 1 100%">📦 Choose products, price, photos & offers (' + cnt() + ' online)</button>' +
      '<button class="ttx-b" data-a="catw" style="flex:1 1 100%">📚 “Our other products” – Catalog photos (' + (window.ttShopCatCount ? ttShopCatCount() : 0) + ' products)</button></div>' +
      sel('Store status', 'open', { open: c.open !== false ? '1' : '0' }, [['1', '🟢 Open – customers can order'], ['0', '🔴 Closed – browsing only']]) +
      inp('Store name', 'name', c) + inp('Your WhatsApp number (customers can message you)', 'wa', c, 'tel', 'inputmode="numeric" placeholder="10-digit"') +
      inp('Website address (only if you use your own domain, e.g. https://ttespl.in/)', 'baseUrl', c, 'text', 'placeholder="leave blank to use the current GitHub address"') +
      inp('UPI ID for payments', 'upiPa', c) + inp('UPI account name', 'upiPn', c) +
      '<div class="ttx-note" style="margin-top:12px"><b>🚚 Delivery</b></div>' +
      sel('Deliver to', 'area', c, [['odisha', 'Odisha only (default)'], ['india', 'All India (customer can choose)']]) +
      inp('Delivery charge – Odisha (₹)', 'shipO', c, 'number') + inp('Delivery charge – rest of India (₹)', 'shipI', c, 'number') +
      inp('Free delivery above order value (₹, 0 = never)', 'freeAbove', c, 'number') +
      sel('When stock is 0', 'backorder', { backorder: c.backorder ? '1' : '0' }, [['0', 'Show “Out of stock” (no order)'], ['1', 'Still allow orders (we arrange stock)']]) +
      '<div class="ttx-note" style="margin-top:12px"><b>🎁 Home page banner</b></div>' + inp('Banner headline', 'banner', c, 'text', 'placeholder="e.g. Diwali Sale – up to 20% off"') + inp('Banner small line', 'promo', c, 'text', 'placeholder="e.g. Bulk orders get extra discount"') +
      '<div class="ttx-note" style="margin-top:12px"><b>🏷️ Coupon codes</b></div>' + couponsHtml(c) +
      '<div class="ttx-btns"><button class="ttx-b" data-a="addcp" style="flex:1">➕ Add coupon</button></div>' +
      '<div class="ttx-note" style="margin-top:12px"><b>🔎 Google visibility</b><br>Make a ready-to-upload SEO pack (a page for every product + sitemap) so Google can find each product. Upload it to GitHub next to <b>index.html</b>.</div>' +
      '<div class="ttx-btns" style="flex-wrap:wrap"><button class="ttx-b" data-a="seo" style="flex:1 1 100%">📥 Download SEO pack</button><button class="ttx-b" data-a="gtips" style="flex:1 1 100%">How to appear on Google (steps)</button></div>';
    X.sheet(CFGID, '🏪 Online Store', h, { z: 3900 });
  }
  function couponsHtml(c) {
    if (!(c.coupons || []).length) return '<div class="ttx-note" style="opacity:.8">No coupons yet.</div>';
    return (c.coupons || []).map(function (k, n) {
      return '<div class="ttx-note" style="display:flex;gap:8px;align-items:center"><div style="flex:1"><b>' + H(String(k.code).toUpperCase()) + '</b> · ' + (k.type === 'flat' ? rs(k.val) + ' off' : N(k.val) + '% off' + (N(k.max) ? ' (max ' + rs(k.max) + ')' : '')) + (N(k.min) ? ' · min ' + rs(k.min) : '') + '<br><small>' + (k.on === false ? 'OFF' : 'ON') + (k.show ? ' · shown on store' : ' · private code') + '</small></div><button class="ttx-b" data-a="cptog" data-p="' + n + '">' + (k.on === false ? 'Turn on' : 'Turn off') + '</button><button class="ttx-b" data-a="cpdel" data-p="' + n + '" style="color:#dc2626">✕</button></div>';
    }).join('');
  }
  window.ttOpenShop = function () {
    drawCfg();
    X.bind(CFGID, {
      change: new Proxy({}, { get: function (t, key) { return function (v) {
        var c = cfg();
        if (key === 'open') c.open = v === '1'; else if (key === 'backorder') c.backorder = v === '1';
        else if (['shipO', 'shipI', 'freeAbove'].indexOf(key) >= 0) c[key] = Math.max(0, N(v)); else if (key === 'wa') c.wa = String(v).replace(/\D/g, '').slice(-10); else c[key] = String(v).trim();
        saveCfg(c); X.toast('Saved'); };
      }, has: function () { return true; } }),
      click: {
        pubnow: function () {
          var c = cfg(); if (!c.pub) { if (!X.isAdm()) return X.toast('Only the Admin can start the store', 1); if (cnt() === 0) return X.toast('First choose at least one product to show online', 1); c.pub = true; saveCfg(c); }
          X.toast('Publishing…'); publishAll(true).then(function (r) { X.toast('Store updated ✔ (' + r.w + ' items)'); drawCfg(); });
        },
        copy: function () { var u = window.ttShopUrl(); try { navigator.clipboard.writeText(u); X.toast('Link copied'); } catch (e) { prompt('Copy this link', u); } },
        wa: function () { var u = window.ttShopUrl(), t = '🛒 Shop online at ' + (cfg().name || 'TTESPL') + '\nCar wash chemicals, detailing products & machines. Bulk discounts, pay by UPI.\n' + u; if (navigator.share) navigator.share({ text: t }).catch(function () {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t)); },
        prods: function () { openProds(); },
        catw: function () { if (window.ttShopCatList) ttShopCatList(); },
        addcp: addCoupon,
        cptog: function (n) { var c = cfg(); c.coupons = (c.coupons || []).slice(); c.coupons[n] = Object.assign({}, c.coupons[n], { on: c.coupons[n].on === false }); saveCfg(c); drawCfg(); },
        cpdel: function (n) { if (!confirm('Delete this coupon?')) return; var c = cfg(); c.coupons = (c.coupons || []).filter(function (x, i) { return i !== N(n); }); saveCfg(c); drawCfg(); },
        seo: function () { seoPack(); }, gtips: gtips
      }
    });
  };
  function addCoupon() {
    var code = (prompt('Coupon code (letters/numbers), e.g. DIWALI10', '') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!code) return;
    var type = confirm('OK = percentage off (e.g. 10%)\nCancel = flat rupees off (e.g. ₹200)') ? 'pct' : 'flat';
    var val = N(prompt(type === 'pct' ? 'Discount percent (e.g. 10)' : 'Flat discount in rupees (e.g. 200)', '')); if (!(val > 0)) return X.toast('Enter a number above 0', 1);
    var min = N(prompt('Minimum order value in ₹ (0 = none)', '0')), max = type === 'pct' ? N(prompt('Maximum discount in ₹ (0 = no limit)', '0')) : 0;
    var show = confirm('Show this code on the store home page?\nOK = show to everyone\nCancel = keep private (you tell customers)');
    var c = cfg(); c.coupons = (c.coupons || []).filter(function (x) { return String(x.code).toUpperCase() !== code; }).concat([{ code: code, type: type, val: val, min: min, max: max, show: show, on: true }]); saveCfg(c); drawCfg();
  }
  function gtips() {
    var u = window.ttShopUrl();
    X.sheet('ttShopTips', '🔎 Appear on Google', '<div class="ttx-note"><b>Step 1 – Business Profile (fastest, free)</b><br>Open <b>business.google.com</b> → add “Twin Town Express Services”, category “Car wash equipment supplier”, address Rasulgarh Bhubaneswar, phone, photos. Put this website link: <b>' + H(u) + '</b>. People searching “car wash chemicals Bhubaneswar” then see you on Google Maps.</div>' +
      '<div class="ttx-note"><b>Step 2 – Search Console</b><br>Open <b>search.google.com/search-console</b> → Add property (URL prefix) with your site address → verify (use the HTML-file method: download the file Google gives and upload it to GitHub next to index.html) → Sitemaps → submit <b>sitemap.xml</b> from the SEO pack.</div>' +
      '<div class="ttx-note"><b>Step 3 – Keep it fresh</b><br>Add a photo and a good description to every product. After adding many products, download the SEO pack again and upload it. Google usually takes a few weeks to show a new site.</div>' +
      '<div class="ttx-note">Share the store link on WhatsApp status and with customers – real visits also help Google.</div><div class="ttx-btns"><button class="ttx-b" data-a="__close">Close</button></div>', { z: 4000 });
  }

  /* ============ PRODUCT MANAGER ============ */
  var PS = { q: '', f: 'all' };
  function rowsFor() {
    var q = PS.q.toLowerCase().trim();
    return inv().filter(function (i) {
      if (!i || !i.name) return false;
      if (PS.f === 'on' && !onl(i).on) return false; if (PS.f === 'off' && onl(i).on) return false;
      if (PS.f === 'mach' && !isMach(i)) return false; if (PS.f === 'chem' && (isMach(i) || i.category === 'Machine Spares')) return false;
      return !q || (String(i.name) + ' ' + (i.code || '') + ' ' + (i.category || '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (onl(b).on ? 1 : 0) - (onl(a).on ? 1 : 0) || String(a.name).localeCompare(String(b.name)); });
  }
  function prodRow(i) {
    var o = onl(i), price = N(o.p) > 0 ? N(o.p) : N(i.rate);
    return '<div class="ttx-row" style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1;min-width:0" data-a="edit" data-p="' + H(i.id) + '"><b style="font-size:13.5px">' + H(i.name) + '</b><br><small style="opacity:.75">' + (isMach(i) ? '⚙️ Enquiry' : '🧴 Order') + ' · ' + (price > 0 ? rs(price) : 'no price') + (N(o.off) ? ' · ' + N(o.off) + '% off' : '') + ((o.bulk || []).length ? ' · bulk' : '') + (o.nimg ? ' · 📷' + o.nimg : '') + '</small></div>' +
      '<button class="ttx-b ' + (o.on ? 'pri' : '') + '" data-a="tog" data-p="' + H(i.id) + '" style="min-width:64px">' + (o.on ? 'ON' : 'OFF') + '</button><button class="ttx-b" data-a="edit" data-p="' + H(i.id) + '">✏️</button></div>';
  }
  function drawProds(keep) {
    var l = rowsFor();
    var h = '<div class="ttx-note">Switch products <b>ON</b> to sell them online. Tap ✏️ to set online price, offer, bulk discount, description and photos.</div>' +
      '<input data-i="q" placeholder="Search product…" value="' + H(PS.q) + '" style="width:100%;margin-bottom:6px"><select data-c="f" style="width:100%;margin-bottom:6px">' + [['all', 'All products'], ['on', 'Online only'], ['off', 'Not online'], ['chem', 'Chemicals / detailing'], ['mach', 'Machines']].map(function (o) { return '<option value="' + o[0] + '"' + (PS.f === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<div class="ttx-btns"><button class="ttx-b" data-a="allon" style="flex:1">Turn ON all shown</button><button class="ttx-b" data-a="alloff" style="flex:1">Turn OFF all shown</button></div>' +
      '<div id="shopPL">' + (l.slice(0, 80).map(prodRow).join('') || '<div class="ttx-note">No products found.</div>') + (l.length > 80 ? '<div class="ttx-note">Showing 80 of ' + l.length + ' – use search.</div>' : '') + '</div>';
    if (keep && $('shopPL')) { $('shopPL').innerHTML = l.slice(0, 80).map(prodRow).join('') || '<div class="ttx-note">No products found.</div>'; return; }
    X.sheet(PRID, '📦 Online products', h, { z: 3950 });
  }
  function setOn(i, v) { i.online = Object.assign({}, i.online || {}, { on: !!v }); }
  function openProds() {
    drawProds();
    X.bind(PRID, {
      input: { q: function (v) { PS.q = v; drawProds(true); } },
      change: { f: function (v) { PS.f = v; drawProds(); } },
      click: {
        tog: function (id) { var i = inv().filter(function (x) { return String(x.id) === String(id); })[0]; if (!i) return; if (!X.isAdm()) return X.toast('Only the Admin can change this', 1); setOn(i, !onl(i).on); setStored('INVENTORY', inv()); drawProds(true); refreshCfgCount(); },
        edit: function (id) { editProd(id); },
        allon: function () { bulkSet(true); }, alloff: function () { bulkSet(false); }
      }
    });
  }
  function refreshCfgCount() { if (X.isOpen(CFGID)) drawCfg(); }
  function bulkSet(v) {
    if (!X.isAdm()) return X.toast('Only the Admin can change this', 1);
    var l = rowsFor(); if (!l.length) return; if (!confirm((v ? 'Turn ON ' : 'Turn OFF ') + l.length + ' products for the online store?')) return;
    l.forEach(function (i) { setOn(i, v); }); setStored('INVENTORY', inv()); drawProds(true); refreshCfgCount();
  }

  /* ============ ONE PRODUCT ============ */
  var ED = { id: null, imgs: [], dirtyImg: false };
  function editProd(id) {
    var i = inv().filter(function (x) { return String(x.id) === String(id); })[0]; if (!i) return;
    ED = { id: id, imgs: [], dirtyImg: false };
    drawEdit(i, true);
    getImgs(id).then(function (a) { if (ED.id === id && !ED.dirtyImg) { ED.imgs = a; paintImgs(); } });
  }
  function bulkRow(b, n) { return '<div style="display:flex;gap:8px;margin-top:4px"><input data-b="q' + n + '" type="number" min="0" placeholder="Qty (e.g. 5)" value="' + (b && N(b.q) ? N(b.q) : '') + '" style="flex:1"><input data-b="p' + n + '" type="number" min="0" max="90" placeholder="% off (e.g. 5)" value="' + (b && N(b.pct) ? N(b.pct) : '') + '" style="flex:1"></div>'; }
  function drawEdit(i, open) {
    var o = onl(i), m = isMach(i), bl = o.bulk || [];
    var h = '<div class="ttx-note"><b>' + H(i.name) + '</b><br><small>Stock: ' + N(i.stock) + ' · ERP customer price: ' + (N(i.rate) ? rs(i.rate) : '—') + ' · This page never shows dealer price.</small></div>' +
      '<label style="font-size:12.5px">📷 Photos (up to 3, first one is the cover)</label><div id="shopImgs" class="ttx-note">Loading photos…</div><input id="shopFile" type="file" accept="image/*" multiple style="display:none"><div class="ttx-btns"><button class="ttx-b" data-a="addimg" style="flex:1">➕ Add photo (camera / gallery)</button></div>' +
      '<label style="font-size:12.5px;margin-top:8px;display:block">' + (m ? 'Starting price shown (₹, leave 0 for “Call for price”)' : 'Online selling price incl. GST (₹)') + '</label><input id="shopP" type="number" step="0.01" value="' + (N(o.p) || (m ? '' : (N(i.rate) || ''))) + '" style="width:100%">' +
      (m ? '' : '<label style="font-size:12.5px;margin-top:8px;display:block">MRP to show as strike-through (₹, optional)</label><input id="shopM" type="number" step="0.01" value="' + (N(o.mrp) || '') + '" style="width:100%">' +
        '<label style="font-size:12.5px;margin-top:8px;display:block">Offer – extra % off on this product (optional)</label><input id="shopO" type="number" step="0.1" min="0" max="90" value="' + (N(o.off) || '') + '" style="width:100%">' +
        '<label style="font-size:12.5px;margin-top:8px;display:block">📦 Bulk discount slabs (buy more, save more)</label>' + bulkRow(bl[0], 0) + bulkRow(bl[1], 1) + bulkRow(bl[2], 2)) +
      '<label style="font-size:12.5px;margin-top:8px;display:block">Description for customers</label><textarea id="shopD" rows="4" style="width:100%">' + H(o.d != null ? o.d : (i.desc || '')) + '</textarea>' +
      '<label style="font-size:12.5px;margin-top:8px;display:block"><input id="shopF" type="checkbox"' + (o.f ? ' checked' : '') + '> ★ Mark as Best seller (shown first)</label>' +
      '<div id="shopPrev" class="ttx-note" style="margin-top:8px"></div>' +
      '<div class="ttx-btns" style="flex-wrap:wrap"><button class="ttx-b pri" data-a="save" style="flex:1 1 100%">💾 Save</button><button class="ttx-b" data-a="back" style="flex:1 1 100%">‹ Back</button></div>';
    X.sheet(EDID, '✏️ Online details', h, { z: 4000 });
    var root = $(EDID);
    var prev = function () { var p = collect(i), el = $('shopPrev'); if (!el) return; var tmp = { p: p.p, off: p.off, bulk: p.bulk }, lines = ['Customer sees: <b>' + (N(tmp.p) > 0 ? rs(T.unit(tmp, 1)) : 'Call for price') + '</b>' + (N(p.mrp) > N(tmp.p) ? ' <s>' + rs(p.mrp) + '</s>' : '')]; p.bulk.forEach(function (b) { lines.push('Buy ' + b.q + '+ → ' + rs(T.unit(tmp, b.q)) + ' each (' + b.pct + '% off)'); }); el.innerHTML = lines.join('<br>'); };
    root.oninput = prev; root.onchange = prev; prev();
    var file = $('shopFile'); if (file) file.onchange = function () {
      var fs = Array.prototype.slice.call(file.files || []).slice(0, 3 - ED.imgs.length); if (!fs.length) return;
      Promise.all(fs.map(function (f) { return shrink(f, 800); })).then(function (a) { ED.imgs = ED.imgs.concat(a).slice(0, 3); ED.dirtyImg = true; paintImgs(); }).catch(function () { X.toast('Could not read that photo', 1); });
      file.value = '';
    };
    X.bind(EDID, { click: {
      addimg: function () { if (ED.imgs.length >= 3) return X.toast('Maximum 3 photos', 1); $('shopFile').click(); },
      delimg: function (n) { ED.imgs.splice(N(n), 1); ED.dirtyImg = true; paintImgs(); },
      cover: function (n) { var a = ED.imgs.splice(N(n), 1); ED.imgs = a.concat(ED.imgs); ED.dirtyImg = true; paintImgs(); },
      back: function () { X.close(EDID); drawProds(true); },
      save: function () { saveProd(i); }
    } });
    paintImgs();
  }
  function paintImgs() {
    var el = $('shopImgs'); if (!el) return;
    el.innerHTML = ED.imgs.length ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' + ED.imgs.map(function (s, n) { return '<div style="width:96px;text-align:center"><img src="' + s + '" style="width:96px;height:96px;object-fit:cover;border-radius:10px"><div><button class="ttx-b" data-a="cover" data-p="' + n + '" style="padding:2px 6px;font-size:11px">' + (n ? 'Make cover' : '★ Cover') + '</button><button class="ttx-b" data-a="delimg" data-p="' + n + '" style="padding:2px 6px;font-size:11px;color:#dc2626">✕</button></div></div>'; }).join('') + '</div>' : 'No photos yet. A good photo gets many more orders.';
  }
  function collect(i) {
    var g = function (id) { return $(id) ? $(id).value : ''; }, bulk = [];
    [0, 1, 2].forEach(function (n) { var q = N(document.querySelector('[data-b=q' + n + ']') && document.querySelector('[data-b=q' + n + ']').value), p = N(document.querySelector('[data-b=p' + n + ']') && document.querySelector('[data-b=p' + n + ']').value); if (q > 0 && p > 0) bulk.push({ q: q, pct: Math.min(p, 90) }); });
    bulk.sort(function (a, b) { return a.q - b.q; });
    return { p: N(g('shopP')), mrp: N(g('shopM')), off: Math.min(90, N(g('shopO'))), bulk: bulk, d: g('shopD').trim(), f: $('shopF') && $('shopF').checked };
  }
  function saveProd(i) {
    if (!X.isAdm()) return X.toast('Only the Admin can change online details', 1);
    var c = collect(i); if (!isMach(i) && !(c.p > 0)) return X.toast('Enter the online price', 1);
    if (!isMach(i) && c.mrp && c.mrp < c.p) return X.toast('MRP must be higher than the selling price', 1);
    var o = Object.assign({}, i.online || {}, { p: c.p, mrp: c.mrp, off: c.off, bulk: c.bulk, d: c.d, f: c.f, nimg: ED.imgs.length });
    i.online = o; setStored('INVENTORY', inv());
    var done = function () { X.toast('Saved'); X.close(EDID); drawProds(true); };
    if (ED.dirtyImg && cs() && cs().putPublic) {
      var done2 = ED.imgs.length ? cs().putPublic('shop_img', 'p_' + i.id, { d: JSON.stringify(ED.imgs) }) : (cs().delPublic ? cs().delPublic('shop_img', 'p_' + i.id) : Promise.resolve());
      done2.then(done).catch(function () { X.toast('Saved, but photos could not upload. Check internet and save again.', 1); });
    } else done();
  }

  /* ============ SEO PACK (zip of static product pages + sitemap) ============ */
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {   // files: [{name, data:Uint8Array}] -> Blob (stored, no compression)
    var parts = [], cen = [], off = 0, enc = new TextEncoder();
    function u16(v) { return new Uint8Array([v & 255, (v >> 8) & 255]); } function u32(v) { return new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]); }
    function cat(a) { var l = 0, i; a.forEach(function (x) { l += x.length; }); var o = new Uint8Array(l), p = 0; a.forEach(function (x) { o.set(x, p); p += x.length; }); return o; }
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), hdr = cat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(f.data.length), u32(f.data.length), u16(nm.length), u16(0), nm]);
      parts.push(hdr, f.data);
      cen.push(cat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(f.data.length), u32(f.data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nm]));
      off += hdr.length + f.data.length;
    });
    var cd = cat(cen);
    parts.push(cd, cat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(off), u16(0)]));
    return new Blob(parts, { type: 'application/zip' });
  }
  window.ttShopZip = zip;
  function b64u8(d) { var b = atob(d.split(',')[1] || ''), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function esc(s) { return H(s); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
  function pageHtml(p, base, img, c) {
    var u = T.unit(p, 1), url = base + 'p/' + p.id + '.html', desc = (p.d || p.n).replace(/\s+/g, ' ').slice(0, 155), mach = p.t === 'm';
    var ld = { '@context': 'https://schema.org', '@type': 'Product', name: p.n, description: p.d || p.n, sku: String(p.k || p.id), category: p.c, brand: { '@type': 'Brand', name: 'TTESPL' } };
    if (img) ld.image = base + 'p/img/' + p.id + '-1.jpg';
    if (!mach || p.p > 0) ld.offers = { '@type': 'Offer', priceCurrency: 'INR', price: String(u), availability: (mach || p.s > 0 || c.backorder) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: url, seller: { '@type': 'Organization', name: c.name } };
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(p.n) + ' - Buy Online | TTESPL Bhubaneswar</title><meta name="description" content="' + esc(desc) + '"><link rel="canonical" href="' + esc(url) + '">' +
      '<meta property="og:title" content="' + esc(p.n) + '"><meta property="og:type" content="product">' + (img ? '<meta property="og:image" content="' + esc(base + 'p/img/' + p.id + '-1.jpg') + '">' : '') + '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
      '<style>body{font:16px/1.5 -apple-system,Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;padding:16px;color:#0f172a}img{max-width:100%;border-radius:12px}.b{display:inline-block;background:#0369a1;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700;margin:10px 0}.m{color:#64748b;font-size:14px}</style></head><body>' +
      '<p><a href="../shop.html">‹ ' + esc(c.name) + '</a></p><h1>' + esc(p.n) + '</h1><p class="m">' + esc(p.c) + (p.k ? ' · Code ' + esc(p.k) : '') + '</p>' + (img ? '<img src="img/' + p.id + '-1.jpg" alt="' + esc(p.n) + '">' : '') +
      '<p><b style="font-size:24px">' + (mach ? (p.p > 0 ? 'From ₹' + p.p.toLocaleString('en-IN') : 'Call for price') : '₹' + u.toLocaleString('en-IN')) + '</b>' + (mach ? '' : ' <span class="m">incl. GST</span>') + '</p>' +
      ((p.bulk || []).length ? '<p class="m">Bulk offer: ' + p.bulk.map(function (b) { return 'buy ' + b.q + '+ and save ' + b.pct + '%'; }).join(', ') + '</p>' : '') +
      '<p style="white-space:pre-line">' + esc(p.d) + '</p>' + (p.sp ? '<h2>Specifications</h2><p style="white-space:pre-line">' + esc(p.sp) + '</p>' : '') +
      '<a class="b" href="../shop.html?p=' + esc(p.id) + '">' + (mach ? 'Get best quote' : 'Buy now') + '</a><p class="m">Twin Town Express Services Pvt Ltd, ' + esc(c.addrShort) + '. Delivery ' + (c.area === 'india' ? 'across India' : 'across Odisha') + '. Pay by UPI.</p></body></html>';
  }
  function seoPack() {
    var c = cfg(), base = baseUrl(), items = inv().filter(function (i) { return i && onl(i).on; });
    if (!items.length) return X.toast('No product is ON yet', 1);
    X.toast('Building SEO pack…');
    var d = co(); var cc = { name: c.name, backorder: c.backorder, area: c.area, addrShort: (d.address || 'Rasulgarh, Bhubaneswar').slice(0, 90) };
    var enc = new TextEncoder(), files = [], today = X.ymd(), idx = [];
    var chain = Promise.resolve();
    items.forEach(function (it) {
      chain = chain.then(function () { return getImgs(it.id); }).then(function (imgs) {
        var p = pubProd(it); imgs.forEach(function (s, n) { try { files.push({ name: 'p/img/' + p.id + '-' + (n + 1) + '.jpg', data: b64u8(s) }); } catch (e) {} });
        files.push({ name: 'p/' + p.id + '.html', data: enc.encode(pageHtml(p, base, imgs.length, cc)) }); idx.push(p);
      });
    });
    chain.then(function () {
      files.push({ name: 'p/index.html', data: enc.encode('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All products - ' + esc(c.name) + '</title><link rel="canonical" href="' + esc(base + 'p/') + '"></head><body style="font:16px/1.6 Arial;max-width:680px;margin:0 auto;padding:16px"><h1>' + esc(c.name) + ' – all products</h1><ul>' + idx.map(function (p) { return '<li><a href="' + p.id + '.html">' + esc(p.n) + '</a></li>'; }).join('') + '</ul><p><a href="../shop.html">Open the store</a></p></body></html>') });
      var urls = [base + 'shop.html', base + 'p/'].concat(idx.map(function (p) { return base + 'p/' + p.id + '.html'; }));
      files.push({ name: 'sitemap.xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(function (u) { return '<url><loc>' + esc(u) + '</loc><lastmod>' + today + '</lastmod></url>'; }).join('\n') + '\n</urlset>\n') });
      files.push({ name: 'robots.txt', data: enc.encode('User-agent: *\nAllow: /\nSitemap: ' + base + 'sitemap.xml\n') });
      var blob = zip(files), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'TTESPL-shop-seo-' + today + '.zip'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      X.toast('SEO pack downloaded – unzip and upload to GitHub');
    }).catch(function (e) { X.toast('Could not build the pack: ' + e.message, 1); });
  }
  window.ttShopSeo = seoPack;

  /* ---------- menu entry ---------- */
  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt44-sm')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt44-sm'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenShop(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>🏪</span><span>Online Store</span></div>'; list.appendChild(d);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
