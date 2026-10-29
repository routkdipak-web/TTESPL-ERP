/* TTESPL ERP v44.5 - STORE: "Our other products" (every Product Catalog item shows on the public store, no ON switch needed).
   Public copy = name, category, code, description, specs and the CUSTOMER price only (never dealer price). Photos (max 3) are added here by staff.
   Firestore: shop_cat/c0..cN (text, 50 items each), shop_img/c_<id> (up to 3 photos), shop_img/ct_<id> (one small thumbnail). */
(function () {
  'use strict';
  var X = window.ttx, T = window.TTSHOP; if (!X || !T) return;
  var H = X.H, N = T.N, SID = 'ttShopCatL', PID = 'ttShopCatP';
  function $(i) { return document.getElementById(i); }
  function inv() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }
  function cs() { return window.cloudSync; }
  function allCat() { return inv().filter(function (i) { return i && i.category === 'Catalog Equipment' && i.name; }); }
  function items() { return allCat().filter(function (i) { return !(i.online && i.online.on) && !i.webHide; }); }
  function catName(i) { var n = ''; try { n = window.ttCatCatName ? ttCatCatName(i) : ''; } catch (e) {} return String(n || i.subCategory || 'Catalog').slice(0, 60); }
  function pub(i) { return { id: String(i.id), n: String(i.name).slice(0, 140), c: catName(i), k: String(i.code || '').slice(0, 40), d: String(i.desc || '').slice(0, 900), sp: String(i.specs || '').slice(0, 700), p: Math.max(0, N(i.rate)), x: Math.min(3, N(i.webImgN)) }; }
  window.ttShopCatCount = function () { return items().length; };
  window.ttShopCatWant = function () {
    var l = items().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }).map(pub), out = {};
    for (var k = 0; k * 50 < l.length; k++) out['shop_cat/c' + k] = JSON.stringify({ c: l.slice(k * 50, k * 50 + 50) });
    return out;
  };

  /* ---------- helpers: photos ---------- */
  function thumb(src) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.onerror = rej; im.onload = function () {
        var s = Math.min(1, 240 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.7));
      }; im.src = src;
    });
  }
  function getImgs(id) { return cs() && cs().getPublic ? cs().getPublic('shop_img', 'c_' + id).then(function (d) { try { return d && d.d ? JSON.parse(d.d) : []; } catch (e) { return []; } }) : Promise.resolve([]); }

  /* ---------- list of catalog products (to add photos quickly) ---------- */
  var LS = { q: '' };
  function row(i) {
    return '<div class="ttx-row" data-a="ph" data-p="' + H(i.id) + '" style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1;min-width:0"><b style="font-size:13.5px">' + H(i.name) + '</b><br><small style="opacity:.75">' + H(catName(i)) + ' · ' + (N(i.rate) > 0 ? '₹' + N(i.rate).toLocaleString('en-IN') : 'no price') + (i.webHide ? ' · 🚫 hidden' : '') + '</small></div><span style="font-size:13px">' + (N(i.webImgN) ? '📷 ' + N(i.webImgN) : '➕📷') + '</span></div>';
  }
  function rows() {
    var q = LS.q.toLowerCase().trim();
    return allCat().filter(function (i) { return !q || (String(i.name) + ' ' + catName(i) + ' ' + (i.code || '')).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return (N(a.webImgN) ? 1 : 0) - (N(b.webImgN) ? 1 : 0) || String(a.name).localeCompare(String(b.name)); });
  }
  function drawList(keep) {
    var l = rows(), body = l.slice(0, 100).map(row).join('') || '<div class="ttx-note">No catalog products found.</div>';
    if (keep && $('shopCL')) { $('shopCL').innerHTML = body + (l.length > 100 ? '<div class="ttx-note">Showing 100 of ' + l.length + ' – use search.</div>' : ''); return; }
    X.sheet(SID, '📚 Our other products', '<div class="ttx-note">Every <b>Product Catalog</b> product shows on the store under <b>“Our other products”</b> (customer price only – dealer price is never shown). Tap a product to add up to 3 photos. Products without photos are listed first.</div>' +
      '<input data-i="q" placeholder="Search catalog product…" value="' + H(LS.q) + '" style="width:100%;margin-bottom:6px"><div class="ttx-note">' + items().length + ' of ' + allCat().length + ' catalog products are visible on the store.</div><div id="shopCL">' + body + (l.length > 100 ? '<div class="ttx-note">Showing 100 of ' + l.length + ' – use search.</div>' : '') + '</div>', { z: 3950 });
  }
  window.ttShopCatList = function () {
    drawList();
    X.bind(SID, { input: { q: function (v) { LS.q = v; drawList(true); } }, click: { ph: function (id) { window.ttShopCatPhotos(id); } } });
  };

  /* ---------- photos of one catalog product ---------- */
  var ED = { id: null, imgs: [], dirty: false };
  function paint() {
    var el = $('shopCImgs'); if (!el) return;
    el.innerHTML = ED.imgs.length ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' + ED.imgs.map(function (s, n) { return '<div style="width:96px;text-align:center"><img src="' + s + '" style="width:96px;height:96px;object-fit:cover;border-radius:10px"><div><button class="ttx-b" data-a="cover" data-p="' + n + '" style="padding:2px 6px;font-size:11px">' + (n ? 'Make cover' : '★ Cover') + '</button><button class="ttx-b" data-a="del" data-p="' + n + '" style="padding:2px 6px;font-size:11px;color:#dc2626">✕</button></div></div>'; }).join('') + '</div>' : 'No photos yet.';
  }
  window.ttShopCatPhotos = function (id) {
    var i = inv().filter(function (x) { return String(x.id) === String(id); })[0]; if (!i) return;
    ED = { id: id, imgs: [], dirty: false };
    var h = '<div class="ttx-note"><b>' + H(i.name) + '</b><br><small>' + H(catName(i)) + ' · Customer price on store: ' + (N(i.rate) > 0 ? '₹' + N(i.rate).toLocaleString('en-IN') + ' (MRP)' : 'not set – shows “Contact for price”') + '. Dealer price is never shown.</small></div>' +
      '<label style="font-size:12.5px">📷 Photos for the website (up to 3, first is the cover)</label><div id="shopCImgs" class="ttx-note">Loading photos…</div><input id="shopCFile" type="file" accept="image/*" multiple style="display:none">' +
      '<div class="ttx-btns"><button class="ttx-b" data-a="add" style="flex:1">➕ Add photo (camera / gallery)</button></div>' +
      '<label style="font-size:12.5px;margin-top:8px;display:block"><input id="shopCHide" type="checkbox"' + (i.webHide ? ' checked' : '') + '> 🚫 Hide this product from the website</label>' +
      '<div class="ttx-btns" style="flex-wrap:wrap"><button class="ttx-b pri" data-a="save" style="flex:1 1 100%">💾 Save</button><button class="ttx-b" data-a="back" style="flex:1 1 100%">‹ Back</button></div>';
    X.sheet(PID, '📷 Website photos', h, { z: 4000 });
    var f = $('shopCFile'); if (f) f.onchange = function () {
      var fs = Array.prototype.slice.call(f.files || []).slice(0, 3 - ED.imgs.length); if (!fs.length) return;
      Promise.all(fs.map(function (x) { return window.ttShopShrink(x, 800); })).then(function (a) { ED.imgs = ED.imgs.concat(a).slice(0, 3); ED.dirty = true; paint(); }).catch(function () { X.toast('Could not read that photo', 1); });
      f.value = '';
    };
    X.bind(PID, { click: {
      add: function () { if (ED.imgs.length >= 3) return X.toast('Maximum 3 photos', 1); $('shopCFile').click(); },
      del: function (n) { ED.imgs.splice(N(n), 1); ED.dirty = true; paint(); },
      cover: function (n) { var a = ED.imgs.splice(N(n), 1); ED.imgs = a.concat(ED.imgs); ED.dirty = true; paint(); },
      back: function () { X.close(PID); if (X.isOpen(SID)) drawList(true); },
      save: function () { save(i); }
    } });
    paint();
    getImgs(id).then(function (a) { if (ED.id === id && !ED.dirty) { ED.imgs = a; paint(); } });
  };
  function save(i) {
    if (!X.isAdm()) return X.toast('Only the Admin can change this', 1);
    var hide = !!($('shopCHide') && $('shopCHide').checked), id = i.id;
    var fin = function () { i.webImgN = ED.imgs.length; if (hide) i.webHide = true; else delete i.webHide; setStored('INVENTORY', inv()); X.toast('Saved'); X.close(PID); if (X.isOpen(SID)) drawList(true); };
    if (!ED.dirty || !cs() || !cs().putPublic) return fin();
    var job = ED.imgs.length
      ? thumb(ED.imgs[0]).then(function (t) { return Promise.all([cs().putPublic('shop_img', 'c_' + id, { d: JSON.stringify(ED.imgs) }), cs().putPublic('shop_img', 'ct_' + id, { d: t })]); })
      : Promise.all([cs().delPublic('shop_img', 'c_' + id), cs().delPublic('shop_img', 'ct_' + id)]);
    job.then(fin).catch(function () { X.toast('Could not upload the photos. Check internet and save again.', 1); });
  }
})();
