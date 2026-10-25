/* TTESPL ERP - Pure Direct Cloud Architecture (LocalStorage Bypassed) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  // BUG FIX: Firestore doc id me '/' allowed nahi hai - agar invoice number
  // "TTE/26/0001" jaisa ho to us "/" ki wajah se ye ek alag nested sub-collection
  // path ban jata tha (orders/TTE/26/0001), jo top-level 'orders' collection ke
  // realtime listener me kabhi nahi aata - isliye doosre device par data nahi
  // dikhta tha. Ab id ke andar ke "/" ko "~" se badal kar ek hi flat document
  // banaya jata hai, jo sabhi devices par turant sync hota hai.
  var did = function (id) { return String(id).replace(/\//g, '~'); };
  var me = function () { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : ''; };

  var CFG = {
    apiKey: "AIzaSyAjsq2wbyXmt8_MjEazM9mAYd5vlZW0dy4",
    authDomain: "ttespl.firebaseapp.com",
    projectId: "ttespl",
    storageBucket: "ttespl.firebasestorage.app",
    messagingSenderId: "244674439608",
    appId: "1:244674439608:web:7f7299ffd94e0a0cc5474d",
    measurementId: "G-HGJFN4G1MV"
  };
  var V = 'https://www.gstatic.com/firebasejs/12.19.0/';
  var MAP = {
    STAFF: 'staff',
    CUSTOMERS: 'customers',
    INVENTORY: 'inventory',
    MACHINERY: 'machinery',
    LEADS: 'leads',
    ORDERS: 'orders',
    SERVICES: 'services',
    MACHINE_PARTS: 'machine_parts',
    QUOTATIONS: 'quotations',
    TRAVEL: 'travel_expenses',
    CRM_RECORDS: 'crm_records',
    COMPANY_DETAILS: 'company_settings',
    CATALOG_CATS: 'catalog_categories',
    BRANDS: 'brands',
    EXPENSES: 'expenses',
    OVERHEADS: 'overheads',
    PERMS: 'perms',
    ACTIVITY: 'activity',
    TASKS: 'tasks',
    SUPPLIERS: 'suppliers',
    PURCHASES: 'purchases',
    ATTENDANCE: 'attendance',
    LEAVES: 'leaves',
    EVENTS: 'events',
    NOTICES: 'notices',
    CLOSINGS: 'cash_closings',
    OFFICE_CFG: 'office_config',
    PRODUCT_IMAGES: 'product_images',
    AI_JOBS: 'ai_jobs',
    RECYCLE: 'recycle_bin'      // v41: deleted records (Admin can restore)
  };

  // Naye optional collections: inke error/rules ki wajah se app 'Offline' nahi dikhayega
  var OPTIONAL_KEYS = { QUOTATIONS: true, TRAVEL: true, CRM_RECORDS: true, COMPANY_DETAILS: true, CATALOG_CATS: true, BRANDS: true, EXPENSES: true, OVERHEADS: true, PERMS: true, ACTIVITY: true, TASKS: true, SUPPLIERS: true, PURCHASES: true, ATTENDANCE: true, LEAVES: true, EVENTS: true, NOTICES: true, CLOSINGS: true, OFFICE_CFG: true, PRODUCT_IMAGES: true, AI_JOBS: true, RECYCLE: true };
  // Inka purana local data pehli baar cloud par automatically upload hota hai (ek baar)
  var MIGRATE_KEYS = OPTIONAL_KEYS;

  function setSync(text, ok) {
    var t = $('syncText'), d = $('syncDot');
    if (t) t.textContent = text;
    if (d) d.classList[ok ? 'remove' : 'add']('offline');
  }

  Promise.all([import(V + 'firebase-app.js'), import(V + 'firebase-firestore.js')]).then(function (mods) {
    var A = mods[0], F = mods[1];
    var app = A.getApps().length ? A.getApp() : A.initializeApp(CFG);
    var db;
    try {
      db = F.initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
    } catch (e) { db = F.getFirestore(app); }

    // OFFLINE PERSISTENCE: Firestore ka apna IndexedDB local cache on karte hain, taaki
    // net na ho tab bhi pichla dekha hua data turant dikhe. Agar isi browser me app
    // ek se zyada TAB me khula ho to ye fail ho sakta hai (normal, sirf ek tab me hi
    // active hota hai) - is liye fail hone par bhi app bilkul pehle jaisa hi chalta rahega.
    if (typeof F.enableIndexedDbPersistence === 'function') {
      F.enableIndexedDbPersistence(db).catch(function (e) {
        console.warn('IndexedDB persistence is off (normal if more than one tab is open):', e && e.code);
      });
    }

    // MULTI-DEVICE CONFLICT FIX: jab same profile do device/tab me ek saath khula ho,
    // to purane tarike me har chhote se change par is device ka POORA local array cloud
    // par dobara likh diya jata tha - agar ye local array thoda purana/stale hota (dusre
    // device ka abhi-abhi kiya hua naya change abhi tak isme aaya hi nahi), to wo naya
    // change cloud par OVERWRITE ho jata tha. Fix: har collection ka jo aakhri cloud
    // snapshot mila usko yahan cache karte hain, aur push karte waqt sirf wahi items
    // bhejte hain jo IS device par sach me badle hain (cache se alag hain). Jo item is
    // device ne chhua hi nahi, wo dobara push hi nahi hoga - isliye dusre device ka naya
    // data kabhi overwrite nahi hoga, chahe dono ek saath login ho.
    var lastCloud = {};

    // OUTBOX: jo changes abhi cloud tak confirm nahi hue unki id phone me likhi rehti hai.
    // App beech me band ho jaye to bhi agli baar khulte hi wo changes khud cloud par
    // jaate hain (aur tab tak screen par bhi local wala naya data dikhta hai).
    var OUTBOX_KEY = 'TTESPL_ERP_OUTBOX', obSeq = Date.now(), obFlushed = {};
    function obRead() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function obWrite(o) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(o)); } catch (e) {} }
    function obAdd(key, ids) {
      var o = obRead(), m = o[key] || {}, seq = ++obSeq;
      ids.forEach(function (i) { m[String(i)] = seq; });
      o[key] = m; obWrite(o); return seq;
    }
    function obDone(key, ids, seq) {
      var o = obRead(), m = o[key]; if (!m) return;
      ids.forEach(function (i) { if (m[String(i)] === seq) delete m[String(i)]; });
      if (!Object.keys(m).length) delete o[key]; else o[key] = m;
      obWrite(o);
    }
    /* v41: also finds photos NESTED inside a document (payments[].photo etc.), biggest first, until the document fits under ~1 MB */
    function shrinkItem(it) {
      var n; try { n = JSON.stringify(it).length; } catch (e) { return it; }
      if (n < 900000) return it;
      var c = JSON.parse(JSON.stringify(it)), refs = [];
      (function walk(o) { if (!o || typeof o !== 'object') return; Object.keys(o).forEach(function (k) { var v = o[k]; if (typeof v === 'string' && v.length > 20000 && v.indexOf('data:') === 0) refs.push({ o: o, k: k, n: v.length }); else if (v && typeof v === 'object') walk(v); }); })(c);
      refs.sort(function (a, b) { return b.n - a.n; });
      var size = n; for (var q = 0; q < refs.length && size >= 880000; q++) { size -= refs[q].n; refs[q].o[refs[q].k] = ''; }
      console.warn('Document was near the 1 MB limit; large photo(s) were removed from the cloud copy', it.id);
      return c;
    }
    /* v41 option: keep photos in Firebase Storage (the document keeps only a small link) */
    function flag(k) { try { var c = JSON.parse(localStorage.getItem('TTESPL_ERP_UI_SETTINGS') || '{}') || {}; return !!c[k]; } catch (e) { return false; } }
    var stMod = null, stCache = {};
    function hashStr(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '_' + s.length.toString(36); }
    function ensureStorage() { if (stMod) return Promise.resolve(stMod); return import(V + 'firebase-storage.js').then(function (m) { stMod = { m: m, st: m.getStorage(app) }; return stMod; }); }
    function uploadDataUrl(dataUrl, folder) {
      var key = hashStr(dataUrl); if (stCache[key]) return Promise.resolve(stCache[key]);
      var mt = (/^data:([^;,]+)/.exec(dataUrl) || [])[1] || 'image/jpeg', ext = (mt.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
      return ensureStorage().then(function (S) {
        var r = S.m.ref(S.st, 'erp/' + folder + '/' + key + '.' + ext);
        return S.m.uploadString(r, dataUrl, 'data_url').then(function () { return S.m.getDownloadURL(r); });
      }).then(function (u) { stCache[key] = u; return u; });
    }
    function externalize(colKey, it) {
      if (!flag('photoStorage') || !it) return Promise.resolve(it);
      var refs = []; (function walk(o) { if (!o || typeof o !== 'object') return; Object.keys(o).forEach(function (k) { var v = o[k]; if (typeof v === 'string' && v.length > 30000 && v.indexOf('data:image') === 0) refs.push({ o: o, k: k, v: v }); else if (v && typeof v === 'object') walk(v); }); })(it);
      if (!refs.length) return Promise.resolve(it);
      var c; try { c = JSON.parse(JSON.stringify(it)); } catch (e) { return Promise.resolve(it); }
      var live = []; (function walk(o) { if (!o || typeof o !== 'object') return; Object.keys(o).forEach(function (k) { var v = o[k]; if (typeof v === 'string' && v.length > 30000 && v.indexOf('data:image') === 0) live.push({ o: o, k: k, v: v }); else if (v && typeof v === 'object') walk(v); }); })(c);
      return Promise.all(live.map(function (r) { return uploadDataUrl(r.v, MAP[colKey] || 'misc').then(function (u) { r.o[r.k] = u; }).catch(function (e) { console.warn('Photo upload failed, keeping it inside the document', e && e.code); }); })).then(function () { return c; });
    }

    function fromCacheEarly(snap) { return !!(snap.metadata && snap.metadata.fromCache); }

    function migrateLocal(key, list, fromCache) {
      var flag = 'TTESPL_ERP_MIGRATED_' + key, done = false, local = null;
      try { done = !!localStorage.getItem(flag); } catch (e) {}
      if (done) return list;
      try { local = JSON.parse(localStorage.getItem('TTESPL_ERP_' + key) || 'null'); } catch (e) {}
      var isCompany = key === 'COMPANY_DETAILS';
      var localList = isCompany
        ? (local && typeof local === 'object' && !Array.isArray(local) ? [Object.assign({}, local, { id: 'company' })] : [])
        : (Array.isArray(local) ? local.filter(function (i) { return i && i.id != null; }) : []);
      if (!localList.length) { if (!fromCache) { try { localStorage.setItem(flag, '1'); } catch (e) {} } return list; }
      // Server abhi nahi aaya aur cache khali hai: local data screen se mat hatao
      if (fromCache) return list.length ? list : localList;
      var have = {};
      list.forEach(function (i) { if (i && i.id != null) have[i.id] = 1; });
      var extra = localList.filter(function (i) { return !have[i.id]; });
      try { localStorage.setItem(flag, '1'); } catch (e) {}
      if (!extra.length) return list;
      window.cloudSync.pushKey(key, extra).catch(function () { try { localStorage.removeItem(flag); } catch (e) {} });
      return list.concat(extra);
    }

    // Direct Real-Time Cloud Methods with Persistence Guarantee
    window.cloudSync = {
      saveDoc: function (key, item) {
        var col = MAP[key];
        if (!col || !item || item.id == null) return Promise.resolve();
        setSync('Saving...', true);
        return F.setDoc(F.doc(db, col, did(item.id)), item, { merge: true })
          .then(function () { setSync('Live Cloud', true); })
          .catch(function (e) { console.error('Cloud Save Error:', e); setSync('Offline', false); });
      },

      /* v41 helpers */
      fetchDoc: function (key, id) {   // latest copy from the server (null if offline / missing)
        var col = MAP[key]; if (!col || id == null) return Promise.resolve(null);
        var g = F.getDocFromServer || F.getDoc;
        return g(F.doc(db, col, did(id))).then(function (sn) { return sn.exists() ? sn.data() : null; }).catch(function () { return null; });
      },
      nextNumber: function (name) {    // gap-free counter shared by all phones (needs internet). Uses "counters"; if your rules refuse it, falls back to "office_config".
        function tx(col, withId) {
          var ref = F.doc(db, col, withId ? 'ctr_' + did(name) : did(name));
          return F.runTransaction(db, function (t) {
            return t.get(ref).then(function (sn) { var n = ((sn.exists() && sn.data().n) || 0) + 1, d = { n: n, updatedAt: Date.now() }; if (withId) d.id = 'ctr_' + did(name); t.set(ref, d, { merge: true }); return n; });
          });
        }
        var first = localStorage.getItem('TTESPL_COUNTER_COL') === 'office_config';
        return (first ? tx('office_config', true) : tx('counters', false)).catch(function (e) {
          if (!first && e && (e.code === 'permission-denied' || /permission/i.test(String(e.message || '')))) {
            return tx('office_config', true).then(function (n) { try { localStorage.setItem('TTESPL_COUNTER_COL', 'office_config'); } catch (x) {} return n; });
          }
          throw e;
        });
      },
      peekNumber: function (name) {
        function rd(col, withId) { return F.getDoc(F.doc(db, col, withId ? 'ctr_' + did(name) : did(name))).then(function (sn) { return (sn.exists() && sn.data().n) || 0; }); }
        var first = localStorage.getItem('TTESPL_COUNTER_COL') === 'office_config';
        return (first ? rd('office_config', true) : rd('counters', false)).catch(function (e) {
          if (!first) return rd('office_config', true).catch(function () { return null; });
          return null;
        });
      },
      secureSignIn: function (token) { return secureReady.then(function (A2) { return A2.signInWithCustomToken(A2.auth, token); }).then(function () { startListeners(); return true; }); },
      secureSignOut: function () { return secureReady.then(function (A2) { return A2.signOut(A2.auth); }).catch(function () {}); },
      secureIdToken: function () { return secureReady.then(function (A2) { return A2.auth.currentUser ? A2.auth.currentUser.getIdToken() : ''; }).catch(function () { return ''; }); },
      deleteItem: function (key, id) {
        var col = MAP[key];
        if (!col || id == null) return Promise.resolve();
        setSync('Deleting...', true);
        return F.deleteDoc(F.doc(db, col, did(id)))
          .then(function () { setSync('Live Cloud', true); })
          .catch(function (e) { console.error('Cloud Delete Error:', e); setSync('Offline', false); });
      },

      pushKey: function (key, arr) {
        var col = MAP[key];
        if (key === 'COMPANY_DETAILS' && arr && !Array.isArray(arr) && typeof arr === 'object') {
          arr = [Object.assign({}, arr, { id: 'company' })];
        }
        if (!col || !Array.isArray(arr)) return Promise.resolve();

        // Sirf wahi items bhejo jo is device par sach me badle hain (cache se alag) -
        // agar cache abhi taiyar nahi hui (app abhi-abhi khula, pehla cloud snapshot
        // aana baaki hai) to purane tarike se sab bhej do (safe fallback).
        var cache = lastCloud[key];
        var toSend = arr;
        if (cache) {
          toSend = arr.filter(function (it) {
            if (!it || it.id == null) return false;
            var prev = cache[it.id];
            return prev === undefined || prev !== JSON.stringify(it);
          });
        }
        if (!toSend.length) return Promise.resolve();

        var sentIds = toSend.map(function (it) { return it.id; });
        var sentSeq = obAdd(key, sentIds);
        var prep = flag('photoStorage') ? Promise.all(toSend.map(function (it) { return externalize(key, it); })) : Promise.resolve(toSend);
        var jobs = [prep.then(function (arr) {
          arr = arr.map(shrinkItem); var bj = [];
          for (var i = 0; i < arr.length; i += 400) {
            var b = F.writeBatch(db);
            arr.slice(i, i + 400).forEach(function (it) {
              if (it && it.id != null) b.set(F.doc(db, col, did(it.id)), it, { merge: true });
            });
            bj.push(b.commit());
          }
          return Promise.all(bj);
        })];
        // BUG FIX: pehle yahan koi .catch() nahi tha, isliye jab bhi ye save cloud
        // tak fail hokar nahi pahunchta tha, na to sync status "Offline" dikhata tha
        // na hi app ko pata chalta tha - upar wala UI hamesha theek dikhata rehta
        // tha jabki data cloud me ja hi nahi raha tha. Ab failure clearly dikhega
        // aur error upar (index.html ke retry/offline-queue) tak bhi jayega.
        return Promise.all(jobs).then(function () { obDone(key, sentIds, sentSeq); setSync('Live Cloud', true); })
          .catch(function (e) { console.error('Cloud pushKey Error:', e); setSync('Offline', false); throw e; });
      },

      sendChatMessage: function (msg) {
        // Message ka apna stable id (cid) hi Firestore doc id banate hain -
        // isse baad me wahi message edit/delete karna asaan ho jata hai
        var id = msg.cid ? did(msg.cid) : undefined;
        // v28: also record the server's own clock (sAt) next to the device clock (timestamp, still used for ordering)
        try { if (F.serverTimestamp) msg = Object.assign({}, msg, { sAt: F.serverTimestamp() }); } catch (e) {}
        return id ? F.setDoc(F.doc(db, 'team_messages', id), msg, { merge: true })
                   : F.setDoc(F.doc(F.collection(db, 'team_messages')), msg);
      },
      editChatMessage: function (cid, newText) {
        return F.setDoc(F.doc(db, 'team_messages', did(cid)), { text: newText, edited: true, editedAt: Date.now() }, { merge: true });
      },
      deleteChatMessage: function (cid) {
        return F.deleteDoc(F.doc(db, 'team_messages', did(cid)));
      },
      /* ===== v28 chat additions (all additive: old message fields/methods are untouched) ===== */
      chatReact: function (cid, key, uid, on) {
        // one array per reaction key; arrayUnion/arrayRemove make add/remove idempotent and race-safe
        var f = {}; f['reactions.' + key] = on ? F.arrayUnion(uid) : F.arrayRemove(uid);
        return F.updateDoc(F.doc(db, 'team_messages', did(cid)), f);
      },
      chatHideForMe: function (cid, uid) {
        return F.updateDoc(F.doc(db, 'team_messages', did(cid)), { hiddenFor: F.arrayUnion(uid) });
      },
      chatTombstone: function (cid, by) {
        // soft delete: the document stays (so replies / ordering / sync stay consistent) but content is removed
        return F.setDoc(F.doc(db, 'team_messages', did(cid)), { deleted: true, deletedBy: by, deletedAt: Date.now(), text: '', fileData: '', fileName: '', fileType: '', reactions: {} }, { merge: true });
      },
      chatPin: function (cid, on, by) {
        return F.setDoc(F.doc(db, 'team_messages', did(cid)), { pinned: !!on, pinnedBy: on ? by : '', pinnedAt: on ? Date.now() : 0 }, { merge: true });
      },
      chatEditSafe: function (cid, newText, prevEditedAt) {
        // transaction: refuses if the message was changed (edited / deleted) since this device last saw it
        var ref = F.doc(db, 'team_messages', did(cid));
        return F.runTransaction(db, function (tx) {
          return tx.get(ref).then(function (snap) {
            if (!snap.exists()) throw new Error('Message no longer exists');
            var d = snap.data();
            if (d.deleted) throw new Error('Message was deleted');
            if ((d.editedAt || 0) !== (prevEditedAt || 0)) throw new Error('Message was changed on another device — reopen it and try again');
            tx.set(ref, { text: newText, edited: true, editedAt: Date.now() }, { merge: true });
          });
        });
      },
      chatMarkRead: function (uid, name, lastRead) {
        return F.setDoc(F.doc(db, 'chat_status', 'read_' + String(uid).replace(/[^a-zA-Z0-9_-]/g, '_')), { kind: 'read', uid: String(uid), user: name, lastRead: lastRead, updatedAt: Date.now() }, { merge: true });
      },
      chatPresence: function (uid, name) {
        return F.setDoc(F.doc(db, 'chat_status', 'presence_' + String(uid).replace(/[^a-zA-Z0-9_-]/g, '_')), { kind: 'presence', uid: String(uid), user: name, lastActive: Date.now() }, { merge: true });
      },
      chatOlder: function (beforeTs, n) {
        var q = F.query(F.collection(db, 'team_messages'), F.where('timestamp', '<', beforeTs), F.orderBy('timestamp', 'desc'), F.limit(n || 50));
        return F.getDocs(q).then(function (snap) { var a = []; snap.forEach(function (d) { a.push(d.data()); }); return a.reverse(); });
      },
      watchChatStatus: function (cb) {
        return F.onSnapshot(F.collection(db, 'chat_status'), function (snap) {
          var a = []; snap.forEach(function (d) { var x = d.data(); x._id = d.id; a.push(x); }); cb(a);
        }, function (err) { console.warn('chat_status listener', err && err.code); cb(null, err); });
      },

      setTypingStatus: function (user, isTyping) {
        var id = 'typing_' + String(user).replace(/[^a-zA-Z0-9]/g, '_');
        return F.setDoc(F.doc(db, 'chat_status', id), { user: user, isTyping: isTyping, updatedAt: Date.now() }, { merge: true });
      },

      pushLiveNotification: function (notif) {
        var notifDoc = {
          title: notif.title || 'TTESPL Alert',
          body: notif.body || '',
          type: notif.type || 'info',
          by: me() || 'Staff',
          timestamp: Date.now(),
          photo: notif.photo || ''
        };
        return F.addDoc(F.collection(db, 'app_notifications'), notifDoc);
      },

      // Real Android push notification ke liye: jab bhi koi staff "Enable Notifications"
      // allow karta hai, uske phone ka FCM token yahan save hota hai. Cloud Function
      // isi list ko padh kar, jab bhi naya app_notifications doc bane, sabko asli
      // system notification bhejta hai (app band ho tab bhi).
      saveFcmToken: function (token, staffName) {
        if (!token) return Promise.resolve();
        return F.setDoc(F.doc(db, 'fcm_tokens', did(token)), {
          token: token,
          staff: staffName || 'Staff',
          updatedAt: Date.now()
        }, { merge: true });
      },

      wipeAll: function () {
        var collectionsToWipe = Object.keys(MAP).map(function (k) { return MAP[k]; })
          .concat(['team_messages', 'chat_status', 'app_notifications']);

        function wipeCollection(colName) {
          return F.getDocs(F.collection(db, colName)).then(function (snap) {
            var docs = [];
            snap.forEach(function (d) { docs.push(d.ref); });
            var jobs = [];
            for (var i = 0; i < docs.length; i += 400) {
              var b = F.writeBatch(db);
              docs.slice(i, i + 400).forEach(function (ref) { b.delete(ref); });
              jobs.push(b.commit());
            }
            return Promise.all(jobs);
          });
        }

        setSync('Resetting...', true);
        return Promise.all(collectionsToWipe.map(wipeCollection))
          .then(function () { setSync('Live Cloud', true); })
          .catch(function (e) {
            console.error('Factory Reset Error:', e);
            setSync('Offline', false);
            throw e;
          });
      }
    };

    // FLICKER FIX: jab cloud par bahut jaldi-jaldi (ek-ek second me kai baar) data
    // aata hai, to pehle har baar turant poora screen dobara draw ho jata tha - isse
    // numbers/UI baar-baar "jump" karte dikhte the (flicker jaisa lagta tha). Ab data
    // to turant (bina delay) update hota hai, lekin screen sirf ek chhoti si "shaant
    // pal" (250ms) ke baad ek hi baar dobara draw hoti hai - agar usi 250ms ke andar
    // aur bhi updates aa jayein to sab ek saath, ek hi baar me dikhaye jate hain.
    var pendingRender = {};
    var renderTimer = null;
    function scheduleRender(key) {
      pendingRender[key] = true;
      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(flushRender, 250);
    }
    function flushRender() {
      renderTimer = null;
      // PERF: sirf jo tab abhi screen par khula hai wahi dobara draw hota hai; baaki tabs
      // switchTab par khud fresh draw ho jaate hain (isliye data kabhi purana nahi dikhta).
      function vis(t) { var p = document.getElementById('view-' + t); return !p || p.classList.contains('active'); }
      if (pendingRender.LEADS && vis('leads') && typeof renderLeads === 'function') renderLeads();
      if (pendingRender.ORDERS) {
        if (vis('orders') && typeof renderOrders === 'function') renderOrders();
        if (vis('billing') && typeof renderBilling === 'function') renderBilling('all');
      }
      if (pendingRender.SERVICES && vis('services') && typeof renderServices === 'function') renderServices();
      if (pendingRender.INVENTORY && vis('inventory') && typeof renderStockList === 'function') renderStockList();
      if (pendingRender.CUSTOMERS && typeof renderCustomerList === 'function') renderCustomerList();
      if (pendingRender.STAFF && typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
      if (pendingRender.MACHINE_PARTS && typeof updateGlobalReminders === 'function') updateGlobalReminders();
      if (pendingRender.QUOTATIONS && typeof window.ttRenderQuotHistoryIfOpen === 'function') window.ttRenderQuotHistoryIfOpen();
      if (pendingRender.TRAVEL && typeof window.ttRenderTravelIfOpen === 'function') window.ttRenderTravelIfOpen();
      if ((pendingRender.CATALOG_CATS || pendingRender.INVENTORY) && typeof window.ttRenderCatalogIfOpen === 'function') window.ttRenderCatalogIfOpen();
      if (pendingRender.CRM_RECORDS && typeof window.ttRenderCrmIfOpen === 'function') window.ttRenderCrmIfOpen();
      if (pendingRender.EXPENSES && typeof window.ttRenderExpensesIfOpen === 'function') window.ttRenderExpensesIfOpen();
      if (pendingRender.OVERHEADS && typeof window.ttRenderPnlIfOpen === 'function') window.ttRenderPnlIfOpen();
      if (pendingRender.PERMS && typeof window.ttRenderPermsIfOpen === 'function') window.ttRenderPermsIfOpen();
      if (pendingRender.ACTIVITY && typeof window.ttRenderActivityIfOpen === 'function') window.ttRenderActivityIfOpen();
      if ((pendingRender.INVENTORY || pendingRender.ORDERS) && typeof window.ttRenderPnlIfOpen === 'function') window.ttRenderPnlIfOpen();
      if (pendingRender.BRANDS && typeof window.ttRenderBrandsIfOpen === 'function') window.ttRenderBrandsIfOpen();
      if (pendingRender.COMPANY_DETAILS && typeof window.ttRenderCompanyIfOpen === 'function') window.ttRenderCompanyIfOpen();
      try { if (typeof window.ttxOnCloud === 'function') window.ttxOnCloud(pendingRender); } catch (e) { console.warn('ttxOnCloud', e); }
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof updateAdminDeleteVisibility === 'function') updateAdminDeleteVisibility();
      setSync('Live Cloud', true);
      pendingRender = {};
    }

    // APP-RESUME FLICKER FIX: jab phone background se wapas app pe aata hai, Firestore
    // saari collections ka data thodi-thodi der me ek-ek karke bhejta hai. Agar har
    // collection turant screen draw kare to UI bahut tezi se kai baar badalta
    // (flicker) dikhta hai. Isliye: jab tak SAARI collections ka pehla data load nahi
    // ho jata (ya 4 second guzar nahi jate), screen ko bilkul nahi chhedte - jo pehle
    // se dikh raha hai wahi dikhta rehta hai. Fir ek hi saaf, turant update hota hai.
    // Uske baad se hamesha wala normal (250ms wala) tarika chalta hai.
    var initialKeysPending = Object.keys(MAP).filter(function (k) { return !OPTIONAL_KEYS[k]; }).length;
    var initialLoadDone = false;
    // SKELETON LOADER HOOK: index.html ke render functions isko check karke
    // decide karte hain ki "no data" dikhana hai ya shimmer placeholder -
    // pehla real cloud data aane tak ye false rehta hai.
    window.ttCloudInitialLoadDone = false;
    var initialLoadTimer = setTimeout(function () {
      if (!initialLoadDone) { initialLoadDone = true; window.ttCloudInitialLoadDone = true; flushRender(); }
    }, 4000);

    /* v41 SECURE MODE (optional, Settings > Security): listeners start only after the staff member is signed in
       to Firebase with the token issued by the server login (see functions/index.js + firestore.rules.secure). */
    var secureOn = false, secureReady, started = false;
    try {   // needs the switch AND a server URL; open the app with ?nosecure=1 to switch it off if you are ever locked out
      var cfgS = JSON.parse(localStorage.getItem('TTESPL_ERP_UI_SETTINGS') || '{}') || {};
      if (/[?&]nosecure=1/.test(location.search)) { cfgS.secureMode = 0; localStorage.setItem('TTESPL_ERP_UI_SETTINGS', JSON.stringify(cfgS)); }
      secureOn = !!cfgS.secureMode && /^https:\/\//.test(String(cfgS.secureUrl || ''));
    } catch (e) { secureOn = false; }
    if (secureOn) {
      secureReady = import(V + 'firebase-auth.js').then(function (AM) { return { auth: AM.getAuth(app), signInWithCustomToken: AM.signInWithCustomToken, signOut: AM.signOut, onAuthStateChanged: AM.onAuthStateChanged }; });
    } else { secureReady = Promise.resolve({ auth: { currentUser: null }, signInWithCustomToken: function () { return Promise.reject(new Error('Secure mode is off')); }, signOut: function () { return Promise.resolve(); } }); }
    window.ttSecureWait = secureOn;
    function startListeners() {
    if (started) return; started = true;
    // Live Snapshot Listeners across all devices
    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(F.collection(db, MAP[key]), function (snap) {
        var list = [];
        snap.forEach(function (d) { list.push(d.data()); });

        // Cache incremental: sirf badle hue docs dobara stringify hote hain (pehle har
        // snapshot par SAARE docs hote the) - bade data me bhi smooth rehta hai.
        var cacheNow = lastCloud[key];
        if (!cacheNow) {
          cacheNow = {};
          list.forEach(function (it) { if (it && it.id != null) cacheNow[it.id] = JSON.stringify(it); });
        } else {
          snap.docChanges().forEach(function (ch) {
            var o = ch.doc.data();
            if (!o || o.id == null) return;
            if (ch.type === 'removed') delete cacheNow[o.id]; else cacheNow[o.id] = JSON.stringify(o);
          });
        }
        lastCloud[key] = cacheNow;

        // Jo local changes abhi cloud tak nahi pahunche (outbox) unhe cloud list ke upar rakho
        // aur ek baar dobara bhejo - isse "delivered" wapas "pending" nahi hota.
        var obMap = obRead()[key];
        if (obMap && !(MIGRATE_KEYS[key] && key === 'COMPANY_DETAILS')) {
          var localArr = null;
          try { localArr = JSON.parse(localStorage.getItem('TTESPL_ERP_' + key) || 'null'); } catch (e) {}
          if (Array.isArray(localArr)) {
            var unsent = [];
            Object.keys(obMap).forEach(function (id) {
              var li = localArr.filter(function (x) { return x && String(x.id) === id; })[0];
              if (!li) return;
              var ix = -1;
              for (var q = 0; q < list.length; q++) { if (list[q] && String(list[q].id) === id) { ix = q; break; } }
              if (ix >= 0) list[ix] = li; else list.push(li);
              unsent.push(li);
            });
            if (unsent.length && !obFlushed[key] && !fromCacheEarly(snap)) {
              obFlushed[key] = true;
              window.cloudSync.pushKey(key, unsent).catch(function () { obFlushed[key] = false; });
            }
          }
        }

        // Naye synced keys: device ka purana local data ek baar cloud par chadhao
        var fromCache = !!(snap.metadata && snap.metadata.fromCache);
        if (MIGRATE_KEYS[key]) list = migrateLocal(key, list, fromCache);

        switch (key) {
          case 'LEADS': leadsData = list; break;
          case 'ORDERS': ordersData = list; break;
          case 'SERVICES': serviceCallsData = list; break;
          case 'INVENTORY': sampleInventory = list; break;
          case 'MACHINERY': machineryDatabase = list; break;
          case 'CUSTOMERS': customerDatabase = list; break;
          case 'STAFF':
            if (list.length > 0) registeredEmployees = list;
            break;
          case 'QUOTATIONS': quotationsData = list; break;
          case 'TRAVEL': travelData = list; break;
          case 'CATALOG_CATS': catalogCatsData = list; break;
          case 'BRANDS': brandsData = list; window.brandsData = list; break;
          case 'EXPENSES': expensesData = list; window.expensesData = list; break;
          case 'OVERHEADS': overheadsData = list; window.overheadsData = list; break;
          case 'PERMS': window.permsData = list; break;
          case 'ACTIVITY': window.activityData = list.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); }); break;
          case 'CRM_RECORDS': crmRecordsData = list; window.crmRecordsData = list; break;
          case 'COMPANY_DETAILS':
            if (list.length) {
              var co = Object.assign({}, list[0]); delete co.id;
              try { localStorage.setItem('TTESPL_ERP_COMPANY_DETAILS', JSON.stringify(co)); } catch (e) {}
              if (typeof COMPANY_DETAILS_DEFAULTS !== 'undefined') {
                companyDetailsData = Object.assign({}, COMPANY_DETAILS_DEFAULTS, co);
                window.companyDetailsData = companyDetailsData;
              }
            }
            break;
          case 'TASKS': case 'SUPPLIERS': case 'PURCHASES': case 'ATTENDANCE': case 'LEAVES': case 'EVENTS': case 'NOTICES': case 'CLOSINGS': case 'OFFICE_CFG': case 'PRODUCT_IMAGES': case 'AI_JOBS': case 'RECYCLE':
            window.TTX = window.TTX || {}; window.TTX[key] = list; break;
          case 'MACHINE_PARTS':
            machinePartsData = list;
            if (typeof window.machinePartsData !== 'undefined') window.machinePartsData = list;
            break;
        }

        if (!initialLoadDone) {
          pendingRender[key] = true;
          if (!OPTIONAL_KEYS[key]) initialKeysPending--;
          if (initialKeysPending <= 0) {
            initialLoadDone = true;
            window.ttCloudInitialLoadDone = true;
            clearTimeout(initialLoadTimer);
            flushRender();
          }
        } else {
          scheduleRender(key);
        }
      }, function (err) {
        console.error('Stream error:', key, err);
        if (OPTIONAL_KEYS[key]) return;
        setSync('Offline', false);
      });
    });

    var q = F.query(F.collection(db, 'team_messages'), F.orderBy('timestamp', 'desc'), F.limit(150));
    F.onSnapshot(q, function (snap) {
      var msgs = [];
      snap.forEach(function (d) { msgs.push(d.data()); });
      msgs.reverse();
      teamChatData = msgs;
      if (typeof renderChatMessages === 'function') renderChatMessages();
    });

    var startTimestamp = Date.now() - 60000;
    var notifQuery = F.query(F.collection(db, 'app_notifications'), F.orderBy('timestamp', 'desc'), F.limit(15));
    F.onSnapshot(notifQuery, function (snap) {
      snap.docChanges().forEach(function (change) {
        if (change.type === 'added') {
          var n = change.doc.data();
          if (n.timestamp > startTimestamp) {
            if (typeof window.showBroadcastToastAlert === 'function') {
              window.showBroadcastToastAlert(n);
            }
          }
        }
      });
    });

    }   // end startListeners
    if (secureOn) {
      secureReady.then(function (A2) {
        A2.onAuthStateChanged(A2.auth, function (u) { if (u) startListeners(); else { setSync('Sign in required', false); } });
      }).catch(function (e) { console.error('Secure mode: auth module failed', e); setSync('Offline', false); });
    } else { startListeners(); }

  }).catch(function (e) {
    console.error('Firebase initialization failed', e);
    setSync('Offline', false);
  });
})();
