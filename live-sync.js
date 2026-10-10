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
    COMPANY_DETAILS: 'company_settings'
  };

  // Naye optional collections: inke error/rules ki wajah se app 'Offline' nahi dikhayega
  var OPTIONAL_KEYS = { QUOTATIONS: true, TRAVEL: true, CRM_RECORDS: true, COMPANY_DETAILS: true };
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
        console.warn('IndexedDB persistence off rahi (normal agar ek se zyada tab khula ho):', e && e.code);
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
    function shrinkItem(it) {
      var n; try { n = JSON.stringify(it).length; } catch (e) { return it; }
      if (n < 900000) return it;
      var c = {}; Object.keys(it).forEach(function (k) {
        var v = it[k];
        c[k] = (typeof v === 'string' && v.length > 120000 && v.indexOf('data:') === 0) ? '' : v;
      });
      console.warn('Doc 1MB limit ke paas tha, badi photo cloud copy se hata di', it.id);
      return c;
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
        toSend = toSend.map(shrinkItem);

        var jobs = [];
        for (var i = 0; i < toSend.length; i += 400) {
          var b = F.writeBatch(db);
          toSend.slice(i, i + 400).forEach(function (it) {
            if (it && it.id != null) b.set(F.doc(db, col, did(it.id)), it, { merge: true });
          });
          jobs.push(b.commit());
        }
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
        return id ? F.setDoc(F.doc(db, 'team_messages', id), msg, { merge: true })
                   : F.setDoc(F.doc(F.collection(db, 'team_messages')), msg);
      },
      editChatMessage: function (cid, newText) {
        return F.setDoc(F.doc(db, 'team_messages', did(cid)), { text: newText, edited: true, editedAt: Date.now() }, { merge: true });
      },
      deleteChatMessage: function (cid) {
        return F.deleteDoc(F.doc(db, 'team_messages', did(cid)));
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
      if (pendingRender.CRM_RECORDS && typeof window.ttRenderCrmIfOpen === 'function') window.ttRenderCrmIfOpen();
      if (pendingRender.COMPANY_DETAILS && typeof window.ttRenderCompanyIfOpen === 'function') window.ttRenderCompanyIfOpen();
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

  }).catch(function (e) {
    console.error('Firebase initialization failed', e);
    setSync('Offline', false);
  });
})();
