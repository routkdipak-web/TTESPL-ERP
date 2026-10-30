/* TTESPL ERP v44.7 - AUTOMATIC BACKUPS ON THIS PHONE (Admin)
   Once a day (when the Admin opens the app) a compressed copy of all records is kept inside the phone. The last 7 are kept.
   Restore goes through the normal preview-and-confirm screen, so nothing is overwritten blindly. Photos are left out to keep it small.
   The cloud function dailyBackup (Blaze plan) keeps a second, server-side copy. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, SID = 'ttAutoBk', DB = 'TTESPL_AUTOBK', ST = 'snaps', KEEP = 7, ONK = 'TTESPL_AUTOBK_ON';
  function isOn() { try { return localStorage.getItem(ONK) !== '0'; } catch (e) { return true; } }
  function db() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var r = indexedDB.open(DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: 'day' }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(ST, mode), s = t.objectStore(ST), q = fn(s); t.oncomplete = function () { res(q && q.result); }; t.onerror = function () { rej(t.error); }; }); }); }
  function listSnaps() { return tx('readonly', function (s) { return s.getAll(); }).then(function (a) { return (a || []).sort(function (x, y) { return x.day < y.day ? 1 : -1; }); }).catch(function () { return []; }); }
  function gz(str) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(new Blob([str], { type: 'application/json' }));
    return new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  }
  function ungz(snap) {
    if (!snap.gz) return snap.blob.text();
    return new Response(snap.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  function total(c) { return Object.keys(c || {}).reduce(function (a, k) { return a + (c[k] || 0); }, 0); }
  function make(force) {
    if (!X.isAdm() || !window.ttxBackupMake) return Promise.resolve(null);
    var day = X.ymd();
    return listSnaps().then(function (l) {
      if (!force && l.some(function (s) { return s.day === day; })) return null;
      var mk = window.ttxBackupMake(true), n = total(mk.out.counts);
      if (!n) return null;                                   /* never keep an empty copy */
      var json = JSON.stringify(mk.out), act = window.ttActivity; try { act && act.start('bk', { icon: '💾', label: 'Backing up your data', sub: n + ' records' }); } catch (e) {}
      return gz(json).then(function (blob) {
        var snap = { day: day, at: new Date().toISOString(), blob: blob, gz: typeof CompressionStream !== 'undefined', size: blob.size, records: n };
        return tx('readwrite', function (s) { return s.put(snap); }).then(function () {
          return listSnaps().then(function (all) { var old = all.slice(KEEP); return old.length ? tx('readwrite', function (s) { old.forEach(function (o) { s.delete(o.day); }); }) : null; });
        }).then(function () { try { localStorage.setItem('TTESPL_AUTOBK_LAST', snap.at); } catch (e) {} return snap; });
      }).then(function (r) { try { act && act.end('bk'); } catch (e) {} return r; }, function (e) { try { act && act.end('bk'); } catch (x) {} throw e; });
    }).catch(function (e) { console.warn('auto backup', e); return null; });
  }
  function auto() { if (isOn() && X.isAdm() && window.ttCloudInitialLoadDone) make(false); }
  setTimeout(auto, 40000); setInterval(auto, 3 * 3600 * 1000);

  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function html(l) {
    var h = '<div class="ttx-note"><b>Automatic backups</b> are kept on this phone once a day while you use the app (last ' + KEEP + ' days). They protect you from a wrong edit or delete. Photos are not included. Restore shows a preview first and never deletes anything.</div>' +
      '<label class="ttx-chk"><input type="checkbox" data-c="on"' + (isOn() ? ' checked' : '') + '> Make an automatic backup every day</label>' +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="now" style="flex:1">💾 Back up now</button></div>' +
      '<div class="ttx-sec">Saved on this phone</div>';
    h += l.length ? l.map(function (s) { return '<div class="ttx-row" style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1;min-width:0"><b>' + H(s.day.split('-').reverse().join('/')) + '</b> <small>' + H(new Date(s.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })) + '</small><br><small style="opacity:.75">' + s.records + ' records · ' + kb(s.size) + '</small></div><button class="ttx-b" data-a="res" data-p="' + H(s.day) + '">Restore…</button><button class="ttx-b" data-a="dl" data-p="' + H(s.day) + '">⬇</button></div>'; }).join('') : '<div class="ttx-note">No automatic backup yet. It is made about a minute after you open the app, or tap “Back up now”.</div>';
    h += '<div class="ttx-note" style="margin-top:10px">☁️ <b>Server copy:</b> if the cloud function <code>dailyBackup</code> is deployed (Firebase Blaze plan) a copy is also saved in Cloud Storage every night at 1:30 am (last 30 days).</div>';
    return h;
  }
  function open() {
    if (!X.isAdm()) return X.toast('Only the Admin can use backups', 1);
    listSnaps().then(function (l) {
      X.sheet(SID, '🗓️ Automatic backups', html(l), { z: 3900 });
      var redraw = function () { listSnaps().then(function (l2) { X.body(SID, html(l2), true); }); };
      X.bind(SID, {
        change: { on: function (v, el) { try { localStorage.setItem(ONK, el && el.checked === false ? '0' : '1'); } catch (e) {} X.toast(isOn() ? 'Automatic backup ON' : 'Automatic backup OFF'); } },
        click: {
          now: function () { X.toast('Backing up…'); make(true).then(function (s) { X.toast(s ? 'Backup saved (' + s.records + ' records)' : 'Nothing to back up yet – wait for the data to load', !s); redraw(); }); },
          res: function (day) { listSnaps().then(function (a) { var s = a.filter(function (x) { return x.day === day; })[0]; if (!s) return; ungz(s).then(function (t) { var o = JSON.parse(t); X.close(SID); window.ttxRestoreObj(o, 'Auto backup ' + day.split('-').reverse().join('/')); }).catch(function () { X.toast('Could not open this backup', 1); }); }); },
          dl: function (day) { listSnaps().then(function (a) { var s = a.filter(function (x) { return x.day === day; })[0]; if (!s) return; ungz(s).then(function (t) { var b = new Blob([t], { type: 'application/json' }), u = URL.createObjectURL(b), e = document.createElement('a'); e.href = u; e.download = 'TTESPL_AutoBackup_' + day + '.json'; document.body.appendChild(e); e.click(); setTimeout(function () { e.remove(); URL.revokeObjectURL(u); }, 1500); }); }); }
        }
      });
    });
  }
  window.ttOpenAutoBackups = open;
  X.hubTiles.push({ mod: 'mBackup', admin: true, icon: '🗓️', label: 'Auto backups', sub: function () { var l = ''; try { l = localStorage.getItem('TTESPL_AUTOBK_LAST') || ''; } catch (e) {} return l ? 'Last ' + X.fmtD(l.slice(0, 10)) : 'Daily, on this phone'; }, fn: open });
})();
