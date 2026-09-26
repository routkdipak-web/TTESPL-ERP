/* TTESPL ERP - Live Sync v7 (Fixed: Race-Condition, Data Overwrite & Realtime Sync) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var me = function () { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : ''; };

  var st = document.createElement('style');
  st.textContent =
    '.lc-day{align-self:center;background:#fff;color:#64748b;font-size:10.5px;font-weight:700;padding:2px 10px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.08)}' +
    '.lc-tick{font-size:10px;margin-left:3px}.lc-tick.sent{color:#2563eb}' +
    '.nav-item{position:relative}';
  document.head.appendChild(st);

  window.updateAdminDeleteVisibility = function () {
    var isAdmin = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'Admin');
    document.querySelectorAll('.admin-only-btn').forEach(function (btn) {
      btn.style.display = isAdmin ? 'inline-flex' : 'none';
    });
  };

  function refilter(inputId, filterFn, fullFn) {
    var el = $(inputId); var q = el ? el.value : '';
    if (q) filterFn(q); else fullFn();
  }

  var RENDER = {
    LEADS: function () { if (typeof renderLeads === 'function') renderLeads(); },
    ORDERS: function () {
      if (typeof renderOrders === 'function') renderOrders();
      var f = $('billingEmployeeFilter');
      if (typeof renderBilling === 'function') renderBilling('all', f && f.value ? f.value : 'ALL');
    },
    SERVICES: function () { if (typeof renderServices === 'function') renderServices(); },
    INVENTORY: function () {
      if (typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
      refilter('stockFilterInput', filterStockList, renderStockList);
    },
    MACHINERY: function () {
      if (typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
      refilter('machFilterInput', filterMachineList, renderMachineryList);
    },
    CUSTOMERS: function () {
      if (typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
      refilter('custFilterInput', filterCustomerList, renderCustomerList);
    },
    STAFF: function () {
      if (typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
    }
  };

  /* Prevent Snapshot Overwrite during local user modifications */
  var pushingKeys = {};

  window.applyCloudData = function (key, list) {
    if (!Array.isArray(list)) return;
    if (pushingKeys[key]) return; // Local write in progress, skip cloud overwrite

    switch (key) {
      case 'LEADS': leadsData = list; break;
      case 'ORDERS': ordersData = list; break;
      case 'SERVICES': serviceCallsData = list; break;
      case 'INVENTORY': sampleInventory = list; break;
      case 'MACHINERY': machineryDatabase = list; break;
      case 'CUSTOMERS': customerDatabase = list; break;
      case 'STAFF':
        if (list.length > 0) {
          registeredEmployees = list;
        }
        break;
      default: return;
    }

    try { localStorage.setItem(DB_PREFIX + key, JSON.stringify(list)); } catch (e) {}
    try {
      if (RENDER[key]) RENDER[key]();
      if (typeof renderDashboard === 'function') renderDashboard();
      window.updateAdminDeleteVisibility();
    } catch (e) {
      console.error('render ' + key, e);
    }
  };

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
    SERVICES: 'services'
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

    window.cloudSync = {
      pushKey: function (key, arr) {
        var col = MAP[key]; if (!col || !Array.isArray(arr)) return Promise.resolve();
        pushingKeys[key] = true;
        setSync('Uploading...', true);
        var jobs = [];
        for (var i = 0; i < arr.length; i += 400) {
          var b = F.writeBatch(db);
          arr.slice(i, i + 400).forEach(function (it) {
            if (it && it.id != null) b.set(F.doc(db, col, String(it.id)), it, { merge: true });
          });
          jobs.push(b.commit());
        }
        return Promise.all(jobs).then(function () { 
          setTimeout(function() { pushingKeys[key] = false; }, 800);
          setSync('Live Cloud', true); 
        }).catch(function (e) { 
          pushingKeys[key] = false;
          console.error('push', key, e); 
          setSync('Live Cloud', true); 
        });
      },
      deleteItem: function (key, id) {
        var col = MAP[key]; if (!col || id == null) return Promise.resolve();
        return F.deleteDoc(F.doc(db, col, String(id))).catch(function (e) { console.error('delete', e); });
      },
      sendChatMessage: function (msg) {
        return F.setDoc(F.doc(F.collection(db, 'team_messages')), msg);
      },
      setTypingStatus: function (user, isTyping) {
        var id = 'typing_' + String(user).replace(/[^a-zA-Z0-9]/g, '_');
        return F.setDoc(F.doc(db, 'chat_status', id), { user: user, isTyping: isTyping, updatedAt: Date.now() }, { merge: true })
          .catch(function () {});
      }
    };

    // Realtime Snapshot Listeners with pending writes check
    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(F.collection(db, MAP[key]), { includeMetadataChanges: true }, function (snap) {
        if (snap.metadata.hasPendingWrites) return; // Ignore local inflight updates
        var list = []; snap.forEach(function (d) { list.push(d.data()); });
        if (key === 'STAFF' && !list.length) return;
        window.applyCloudData(key, list);
        setSync('Live Cloud', true);
      }, function (err) { console.error(key, err); setSync('Offline', false); });
    });

    // Realtime Chat Stream (Latest 150 messages)
    var q = F.query(F.collection(db, 'team_messages'), F.orderBy('timestamp', 'desc'), F.limit(150));
    F.onSnapshot(q, { includeMetadataChanges: true }, function (snap) {
      var msgs = [];
      snap.forEach(function (d) {
        var m = d.data(); m.id = d.id; m._pending = d.metadata.hasPendingWrites; msgs.push(m);
      });
      msgs.reverse();
      if (typeof onChatSnapshot === 'function') onChatSnapshot(msgs);
      setSync('Live Cloud', true);
    }, function () {});

    setSync('Live Cloud', true);
    window.updateAdminDeleteVisibility();
  }).catch(function (e) {
    console.error('Firebase initialization failed', e);
    setSync('Offline', false);
  });
})();
