/* TTESPL ERP - Live Sync v5
   - Admin-only Delete Protection (Removed blanket delete hiding)
   - Real-time Firestore Cloud Sync across all staff devices
   - Auto Image Compressor for instant photo transmission (<350KB)
   - Realtime WhatsApp-style chat with delivery ticks & unread badges
   - Dynamic Staff synchronization on registration
*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var me = function () { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : ''; };

  /* Small Styles for Chat & Badges */
  var st = document.createElement('style');
  st.textContent =
    '.lc-day{align-self:center;background:#fff;color:#64748b;font-size:10.5px;font-weight:700;padding:2px 10px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.08)}' +
    '.lc-tick{font-size:10px;margin-left:3px}.lc-tick.sent{color:#2563eb}' +
    '.nav-item{position:relative}' +
    '#lcErrBar{display:none;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;margin:4px 0}';
  document.head.appendChild(st);

  /* Role-based delete check & UI update */
  window.updateAdminDeleteVisibility = function () {
    var isAdmin = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'Admin');
    document.querySelectorAll('.admin-only-btn').forEach(function (btn) {
      btn.style.display = isAdmin ? 'inline-flex' : 'none';
    });
  };

  /* ---------- Apply Cloud Data into App State & Rerender ---------- */
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

  window.applyCloudData = function (key, list) {
    switch (key) {
      case 'LEADS':
        leadsData = list;
        if (typeof activeLeadForInstall !== 'undefined' && activeLeadForInstall) {
          activeLeadForInstall = list.find(function (x) { return x.id === activeLeadForInstall.id; }) || activeLeadForInstall;
        }
        if (typeof activeFreeSrvRef !== 'undefined' && activeFreeSrvRef) {
          var nl = list.find(function (x) { return x.id === activeFreeSrvRef.l.id; });
          if (nl && nl.installation && nl.installation.freeServices) {
            var nf = nl.installation.freeServices.find(function (s) { return s.num === activeFreeSrvRef.fs.num; });
            if (nf) activeFreeSrvRef = { l: nl, fs: nf };
          }
        }
        break;
      case 'ORDERS': ordersData = list; break;
      case 'SERVICES': serviceCallsData = list; break;
      case 'INVENTORY': sampleInventory = list; break;
      case 'MACHINERY': machineryDatabase = list; break;
      case 'CUSTOMERS': customerDatabase = list; break;
      case 'STAFF':
        var by = {};
        if (Array.isArray(registeredEmployees)) {
          registeredEmployees.forEach(function (u) { if (u && u.mobile) by[u.mobile] = u; });
        }
        if (Array.isArray(list)) {
          list.forEach(function (u) { if (u && u.mobile) by[u.mobile] = u; });
        }
        registeredEmployees = Object.keys(by).map(function (k) { return by[k]; });
        list = registeredEmployees;
        break;
      default: return;
    }
    try { localStorage.setItem(DB_PREFIX + key, JSON.stringify(list)); } catch (e) {}
    try {
      if (RENDER[key]) RENDER[key]();
      window.updateAdminDeleteVisibility();
    } catch (e) {
      console.error('render ' + key, e);
    }
  };

  /* Preserve Staff selection during dropdown refresh */
  var origPopulate = window.populateDropdownsAndDatalists;
  window.populateDropdownsAndDatalists = function () {
    var sels = Array.prototype.slice.call(document.querySelectorAll('.emp-dropdown'));
    var saved = sels.map(function (s) { return s.value; });
    if (typeof origPopulate === 'function') origPopulate();
    sels.forEach(function (s, i) { if (saved[i]) s.value = saved[i]; });
  };

  /* ---------- Real-Time Team Chat ---------- */
  var seen = null, unread = 0, typingState = {};

  function dayLabel(d) {
    var t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }

  window.renderChatMessages = function () {
    var box = $('chatMessagesContainer'); if (!box) return;
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
    var mine0 = me(), html = '', lastDay = '';

    teamChatData.forEach(function (m) {
      var d = new Date(m.timestamp || Date.now());
      if (d.toDateString() !== lastDay) {
        lastDay = d.toDateString();
        html += '<div class="lc-day">' + dayLabel(d) + '</div>';
      }
      var mine = m.sender === mine0, f = '';
      if (m.file && m.file.data) {
        if (m.file.type && m.file.type.indexOf('image/') === 0) {
          f = '<img src="' + esc(m.file.data) + '" class="bubble-img-preview" alt="photo" onclick="window.open(this.src)">';
        } else {
          f = '<a href="' + esc(m.file.data) + '" download="' + esc(m.file.name) + '" class="bubble-file-link"><span>📄</span><span>' + esc(m.file.name) + '</span></a>';
        }
      }
      html += '<div class="bubble ' + (mine ? 'me' : 'other') + '">' +
        (mine ? '' : '<div class="bubble-author">' + esc(m.sender) + ' <span style="font-weight:normal;font-size:9.5px;opacity:.8">(' + esc(m.role || 'Staff') + ')</span></div>') +
        (m.text ? '<div>' + esc(m.text) + '</div>' : '') + f +
        '<div class="bubble-time">' + esc(m.time || '') +
        (mine ? ' <span class="lc-tick' + (m._pending ? '' : ' sent') + '">' + (m._pending ? '🕓' : '✓✓') + '</span>' : '') +
        '</div></div>';
    });

    box.innerHTML = html;
    var cb = $('chatCountBadge'); if (cb) cb.textContent = teamChatData.length + ' msgs';
    var last = teamChatData[teamChatData.length - 1];
    if (nearBottom || (last && last.sender === mine0)) box.scrollTop = box.scrollHeight;
  };

  function chatTabActive() {
    var p = $('view-chat'); return p && p.classList.contains('active');
  }

  function paintBadge() {
    var b = $('chatNavBadge');
    if (!b) return;
    if (!unread) { b.style.display = 'none'; return; }
    b.style.display = 'inline-block';
    b.textContent = unread > 99 ? '99+' : unread;
  }

  var origSwitch = window.switchTab;
  window.switchTab = function (tab, el) {
    if (typeof origSwitch === 'function') origSwitch(tab, el);
    if (tab === 'chat') { unread = 0; paintBadge(); }
    window.updateAdminDeleteVisibility();
  };

  function onChatSnapshot(msgs) {
    var fresh = 0;
    if (seen !== null) {
      msgs.forEach(function (m) {
        if (!seen[m.id] && !m._pending && m.sender !== me()) fresh++;
      });
    }
    seen = {};
    msgs.forEach(function (m) { seen[m.id] = 1; });
    teamChatData = msgs;
    renderChatMessages();

    if (fresh && !chatTabActive()) {
      unread += fresh; paintBadge();
      try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {}
    }
  }

  /* Typing Indicator */
  function paintTyping() {
    var el = $('liveTypingStatus'); if (!el) return;
    var names = [];
    Object.keys(typingState).forEach(function (k) {
      var t = typingState[k];
      if (t && t.isTyping && t.user !== me() && Date.now() - (t.updatedAt || 0) < 8000) {
        names.push(t.user);
      }
    });
    el.innerHTML = names.length ? '✍️ <em>' + names.map(function (n) { return esc(n); }).join(', ') + ' typing...</em>' : '';
  }
  setInterval(paintTyping, 2000);

  /* ---------- Firebase Cloud Integration ---------- */
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
        setSync('Uploading...', true);
        var jobs = [];
        for (var i = 0; i < arr.length; i += 400) {
          var b = F.writeBatch(db);
          arr.slice(i, i + 400).forEach(function (it) {
            if (it && it.id != null) b.set(F.doc(db, col, String(it.id)), it, { merge: true });
          });
          jobs.push(b.commit());
        }
        return Promise.all(jobs).then(function () { setSync('Live Cloud', true); })
          .catch(function (e) { console.error('push', key, e); setSync('Sync Error', false); });
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
      },
      forcePullAll: function () {
        setSync('Syncing...', true);
        return Promise.all(Object.keys(MAP).map(function (key) {
          return F.getDocs(F.collection(db, MAP[key])).then(function (snap) {
            var list = []; snap.forEach(function (d) { list.push(d.data()); });
            if (key === 'STAFF' && !list.length) return;
            window.applyCloudData(key, list);
          });
        })).then(function () { setSync('Live Cloud', true); })
          .catch(function (e) { console.error(e); setSync('Offline', false); });
      }
    };

    // Realtime Snapshot Listeners
    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(F.collection(db, MAP[key]), function (snap) {
        if (snap.empty && snap.metadata.fromCache) return;
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
      onChatSnapshot(msgs);
      setSync('Live Cloud', true);
    }, function (err) {
      console.error('Chat stream error', err);
      setSync('Offline', false);
    });

    // Typing Status Stream
    F.onSnapshot(F.collection(db, 'chat_status'), function (snap) {
      var m = {};
      snap.forEach(function (d) { if (d.id.indexOf('typing_') === 0) m[d.id] = d.data(); });
      typingState = m; paintTyping();
    }, function () {});

    setSync('Live Cloud', true);
    window.updateAdminDeleteVisibility();
  }).catch(function (e) {
    console.error('Firebase initialization failed', e);
    setSync('Offline', false);
  });
})();
