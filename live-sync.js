/* TTESPL ERP - Real-Time Cloud Sync & Live Updates */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
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
    MACHINE_PARTS: 'machine_parts'
  };

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

    if (typeof F.enableIndexedDbPersistence === 'function') {
      F.enableIndexedDbPersistence(db).catch(function (e) {
        console.warn('IndexedDB persistence:', e && e.code);
      });
    }

    var lastCloud = {};

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
        if (!col || !Array.isArray(arr)) return Promise.resolve();

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

        function sizeOf(it) { try { return JSON.stringify(it).length; } catch (e) { return 0; } }
        var SAFE_LIMIT = 900000;
        function shrinkOrderForCloud(it, aggressive) {
          var copy;
          try { copy = JSON.parse(JSON.stringify(it)); } catch (e) { return it; }
          if (Array.isArray(copy.payments) && copy.payments.length) {
            var n = copy.payments.length;
            copy.payments.forEach(function (p, idx) {
              if (p && p.photo && (aggressive || idx < n - 1)) p.photo = '';
            });
          }
          if (copy.lastPaymentProof) copy.lastPaymentProof = '';
          if (aggressive && copy.deliveryProofPhoto) copy.deliveryProofPhoto = '';
          return copy;
        }

        var prepared = toSend.map(function (it) {
          if (col === 'orders' && sizeOf(it) > SAFE_LIMIT) return shrinkOrderForCloud(it, false);
          return it;
        });

        function commitAll(list) {
          var jobs = [];
          for (var i = 0; i < list.length; i += 400) {
            var b = F.writeBatch(db);
            list.slice(i, i + 400).forEach(function (it) {
              if (it && it.id != null) b.set(F.doc(db, col, did(it.id)), it, { merge: true });
            });
            jobs.push(b.commit());
          }
          return Promise.all(jobs);
        }

        return commitAll(prepared).then(function () { setSync('Live Cloud', true); })
          .catch(function (e) {
            console.error('Cloud pushKey Error:', e);
            var msg = (e && e.message) || '';
            if (col === 'orders' && /longer than|exceeds|too large|invalid-argument|resource-exhausted/i.test(msg)) {
              var shrunk = toSend.map(function (it) { return col === 'orders' ? shrinkOrderForCloud(it, true) : it; });
              return commitAll(shrunk).then(function () { setSync('Live Cloud', true); })
                .catch(function (e2) { console.error('Cloud pushKey retry Error:', e2); setSync('Offline', false); throw e2; });
            }
            setSync('Offline', false); throw e;
          });
      },

      sendChatMessage: function (msg) {
        var id = msg.cid ? did(msg.cid) : undefined;
        return id ? F.setDoc(F.doc(db, 'team_messages', id), msg, { merge: true })
                   : F.setDoc(F.doc(F.collection(db, 'team_messages')), msg);
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
      }
    };

    var pendingRender = {};
    var renderTimer = null;
    function scheduleRender(key) {
      pendingRender[key] = true;
      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(flushRender, 250);
    }
    function flushRender() {
      renderTimer = null;
      if (pendingRender.LEADS && typeof renderLeads === 'function') renderLeads();
      if (pendingRender.ORDERS) {
        if (typeof renderOrders === 'function') renderOrders();
        if (typeof renderBilling === 'function') renderBilling('all');
      }
      if (pendingRender.SERVICES && typeof renderServices === 'function') renderServices();
      if (pendingRender.INVENTORY && typeof renderStockList === 'function') renderStockList();
      if (pendingRender.CUSTOMERS && typeof renderCustomerList === 'function') renderCustomerList();
      if (pendingRender.STAFF && typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
      if (typeof renderDashboard === 'function') renderDashboard();
      setSync('Live Cloud', true);
      pendingRender = {};
    }

    var initialKeysPending = Object.keys(MAP).length;
    var initialLoadDone = false;
    window.ttCloudInitialLoadDone = false;
    var initialLoadTimer = setTimeout(function () {
      if (!initialLoadDone) { initialLoadDone = true; window.ttCloudInitialLoadDone = true; flushRender(); }
    }, 4000);

    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(F.collection(db, MAP[key]), function (snap) {
        var list = [];
        snap.forEach(function (d) { list.push(d.data()); });

        var cacheNow = {};
        list.forEach(function (it) { if (it && it.id != null) cacheNow[it.id] = JSON.stringify(it); });
        lastCloud[key] = cacheNow;

        switch (key) {
          case 'LEADS': leadsData = list; break;
          case 'ORDERS': ordersData = list; break;
          case 'SERVICES': serviceCallsData = list; break;
          case 'INVENTORY': sampleInventory = list; break;
          case 'MACHINERY': machineryDatabase = list; break;
          case 'CUSTOMERS': customerDatabase = list; break;
          case 'STAFF': if (list.length > 0) registeredEmployees = list; break;
        }

        if (!initialLoadDone) {
          pendingRender[key] = true;
          initialKeysPending--;
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
        setSync('Offline', false);
      });
    });

  }).catch(function (e) {
    console.error('Firebase initialization failed', e);
    setSync('Offline', false);
  });
})();
