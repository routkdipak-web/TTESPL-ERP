/* TTESPL ERP - Live Sync v2
   WhatsApp-style realtime chat + realtime data sync on all devices.
   Load with a normal <script src="live-sync.js?v=2"></script> just before </body>. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var me = function () { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : ''; };

  /* ---------- small styles ---------- */
  var st = document.createElement('style');
  st.textContent =
    '.lc-day{align-self:center;background:#fff;color:#64748b;font-size:10.5px;font-weight:700;padding:2px 10px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.08)}' +
    '.lc-tick{font-size:10px;margin-left:3px}.lc-tick.sent{color:#2563eb}' +
    '.nav-item{position:relative}' +
    'button[onclick*="delete"]{display:none!important}' +
    '.lc-badge{position:absolute;top:2px;left:calc(50% + 6px);background:#dc2626;color:#fff;font-size:9px;font-weight:800;min-width:15px;height:15px;line-height:15px;border-radius:8px;padding:0 3px}' +
    '#lcErrBar{display:none;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:700;padding:5px 10px}';
  document.head.appendChild(st);

  var hdr = document.querySelector('.chat-header-bar');
  if (hdr) {
    var t = hdr.querySelector('strong'); if (t) t.textContent = '💬 TTESPL Team Live Hub · v3';
    hdr.insertAdjacentHTML('afterend', '<div id="lcErrBar"></div>');
  }

  /* ---------- apply cloud data into app variables + re-render ---------- */
  function refilter(inputId, filterFn, fullFn) {
    var el = $(inputId); var q = el ? el.value : '';
    if (q) filterFn(q); else fullFn();
  }
  var RENDER = {
    LEADS: function () { renderLeads(); },
    ORDERS: function () {
      renderOrders();
      var f = $('billingEmployeeFilter'); renderBilling('all', f && f.value ? f.value : 'ALL');
    },
    SERVICES: function () { renderServices(); },
    INVENTORY: function () { populateDropdownsAndDatalists(); refilter('stockFilterInput', filterStockList, renderStockList); },
    MACHINERY: function () { populateDropdownsAndDatalists(); refilter('machFilterInput', filterMachineList, renderMachineryList); },
    CUSTOMERS: function () { populateDropdownsAndDatalists(); refilter('custFilterInput', filterCustomerList, renderCustomerList); },
    STAFF: function () { populateDropdownsAndDatalists(); }
  };

  window.applyCloudData = function (key, list) {
    switch (key) {
      case 'LEADS':
        leadsData = list;
        // keep open modals pointing at the fresh objects
        if (activeLeadForInstall) {
          activeLeadForInstall = list.find(function (x) { return x.id === activeLeadForInstall.id; }) || activeLeadForInstall;
        }
        if (activeFreeSrvRef) {
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
        registeredEmployees.forEach(function (u) { by[u.mobile] = u; });
        list.forEach(function (u) { by[u.mobile] = u; });
        registeredEmployees = Object.keys(by).map(function (k) { return by[k]; });
        list = registeredEmployees;
        break;
      default: return;
    }
    try { localStorage.setItem(DB_PREFIX + key, JSON.stringify(list)); } catch (e) {}
    try { RENDER[key](); } catch (e) { console.error('render ' + key, e); }
  };

  // do not reset selected staff in an open form when dropdowns refresh
  var origPopulate = window.populateDropdownsAndDatalists;
  window.populateDropdownsAndDatalists = function () {
    var sels = Array.prototype.slice.call(document.querySelectorAll('.emp-dropdown'));
    var saved = sels.map(function (s) { return s.value; });
    origPopulate();
    sels.forEach(function (s, i) { if (saved[i]) s.value = saved[i]; });
  };

  /* ---------- Stock & Machinery cards: Edit only (no delete), also while searching ---------- */
  function stockCard(item) {
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><strong style="font-size:13.5px;">' + esc(item.name) + '</strong>' +
      '<div style="font-size:11px;color:var(--text-muted);">' + esc(item.code) + ' | ' + esc(item.category) + ' | HSN: ' + esc(item.hsn || '84139190') + '</div></div>' +
      '<div style="text-align:right;"><span class="badge ' + (item.stock <= 5 ? 'badge-danger' : 'badge-delivered') + '">' + item.stock + ' in stock</span>' +
      '<div style="font-size:12px;font-weight:bold;color:var(--primary);">₹' + item.rate + '</div></div></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;border-top:1px solid #f1f5f9;padding-top:4px;">' +
      '<button class="btn btn-outline btn-sm" onclick="editStockItemPrompt(' + item.id + ')">✏️ Edit</button></div></div>';
  }
  window.renderStockList = function () {
    var c = $('stockListContainer'); if (!c) return;
    $('totalPartsBadge').textContent = sampleInventory.length + ' Items Loaded';
    c.innerHTML = sampleInventory.map(stockCard).join('');
  };
  window.filterStockList = function (val) {
    var q = String(val || '').toLowerCase().trim(), c = $('stockListContainer'); if (!c) return;
    c.innerHTML = sampleInventory.filter(function (i) {
      return i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
    }).map(stockCard).join('');
  };

  function machCard(m) {
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><strong style="font-size:14px;color:var(--primary);">🚜 ' + esc(m.name) + '</strong>' +
      '<div style="font-size:11px;color:var(--text-muted);">Pump: ' + esc(m.pump) + ' | Motor: ' + esc(m.motor) + '</div></div>' +
      '<div style="text-align:right;"><span class="badge badge-info">' + m.bar + ' Bar</span>' +
      '<div style="font-size:12.5px;font-weight:800;color:var(--primary);">₹' + Number(m.price).toLocaleString('en-IN') + '</div></div></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;border-top:1px solid #f1f5f9;padding-top:4px;">' +
      '<button class="btn btn-outline btn-sm" onclick="editMachinePrompt(' + m.id + ')">✏️ Edit</button></div></div>';
  }
  window.renderMachineryList = function () {
    var c = $('machineryListContainer'); if (!c) return;
    $('totalMachBadge').textContent = machineryDatabase.length + ' Machines';
    c.innerHTML = machineryDatabase.map(machCard).join('');
  };
  window.filterMachineList = function (val) {
    var q = String(val || '').toLowerCase().trim(), c = $('machineryListContainer'); if (!c) return;
    c.innerHTML = machineryDatabase.filter(function (m) {
      return m.name.toLowerCase().includes(q) || m.pump.toLowerCase().includes(q) || m.motor.toLowerCase().includes(q);
    }).map(machCard).join('');
  };

  /* ---------- WhatsApp style chat ---------- */
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
      if (d.toDateString() !== lastDay) { lastDay = d.toDateString(); html += '<div class="lc-day">' + dayLabel(d) + '</div>'; }
      var mine = m.sender === mine0, f = '';
      if (m.file && m.file.data) {
        if (m.file.type && m.file.type.indexOf('image/') === 0) f = '<img src="' + esc(m.file.data) + '" class="bubble-img-preview" alt="image">';
        else f = '<a href="' + esc(m.file.data) + '" download="' + esc(m.file.name) + '" class="bubble-file-link"><span>📄</span><span>' + esc(m.file.name) + '</span></a>';
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

  function chatTabActive() { var p = $('view-chat'); return p && p.classList.contains('active'); }
  function paintBadge() {
    var nav = document.querySelector('.nav-item[onclick*="\'chat\'"]'); if (!nav) return;
    var b = nav.querySelector('.lc-badge');
    if (!unread) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'lc-badge'; nav.appendChild(b); }
    b.textContent = unread > 99 ? '99+' : unread;
  }
  var origSwitch = window.switchTab;
  window.switchTab = function (tab, el) {
    origSwitch(tab, el);
    if (tab === 'chat') { unread = 0; paintBadge(); }
  };

  function onChatSnapshot(msgs) {
    var fresh = 0;
    if (seen !== null) msgs.forEach(function (m) { if (!seen[m.id] && !m._pending && m.sender !== me()) fresh++; });
    seen = {}; msgs.forEach(function (m) { seen[m.id] = 1; });
    teamChatData = msgs;
    renderChatMessages();
    var bar = $('lcErrBar'); if (bar) bar.style.display = 'none';
    if (fresh && !chatTabActive()) {
      unread += fresh; paintBadge();
      try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {}
    }
  }
  function onChatError(err) {
    console.error('Chat listener error', err);
    var bar = $('lcErrBar');
    if (bar) { bar.style.display = 'block'; bar.textContent = '⚠️ Chat connection problem: ' + (err && (err.code || err.message) || 'unknown') + ' (check Firestore Rules)'; }
  }

  /* typing indicator (one doc per user, so nobody overwrites another) */
  function paintTyping() {
    var el = $('liveTypingStatus'); if (!el) return;
    var names = [];
    Object.keys(typingState).forEach(function (k) {
      var t = typingState[k];
      if (t && t.isTyping && t.user !== me() && Date.now() - (t.updatedAt || 0) < 8000) names.push(t.user);
    });
    el.innerHTML = names.length ? '✍️ <em>' + names.map(function (n) { return esc(n); }).join(', ') + ' typing...</em>' : '';
  }
  setInterval(paintTyping, 2000);

  var lastTypingSent = 0, typingOff = null;
  window.handleTypingEvent = function () {
    if (!window.cloudSync) return;
    var now = Date.now(), name = me() || 'Staff';
    if (now - lastTypingSent > 2500) { lastTypingSent = now; window.cloudSync.setTypingStatus(name, true); }
    clearTimeout(typingOff);
    typingOff = setTimeout(function () { lastTypingSent = 0; window.cloudSync.setTypingStatus(name, false); }, 2500);
  };

  window.sendLiveChatMessage = function (fileObj) {
    var input = $('chatInputMessage');
    var txt = input.value.trim();
    if (fileObj && fileObj.target) fileObj = null;
    if (!txt && !fileObj) return;
    if (!window.cloudSync) { alert('Cloud is still connecting, please try again in a moment.'); return; }
    var msg = {
      sender: me() || 'Staff',
      role: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : 'Team',
      text: txt,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      file: fileObj || null
    };
    input.value = '';
    clearTimeout(typingOff); lastTypingSent = 0;
    window.cloudSync.setTypingStatus(msg.sender, false);
    window.cloudSync.sendChatMessage(msg).catch(function (err) {
      alert('Message NOT sent: ' + (err.code || err.message));
    });
    input.focus();
  };

  window.handleChatFileUpload = function (event) {
    var file = event.target.files[0]; if (!file) return;
    if (file.size > 700 * 1024) { alert('Please select files under 700 KB for live chat!'); event.target.value = ''; return; }
    var r = new FileReader();
    r.onload = function (e) { window.sendLiveChatMessage({ name: file.name, type: file.type, data: e.target.result }); };
    r.readAsDataURL(file);
    event.target.value = '';
  };

  /* ---------- Firebase (loaded dynamically, works from a classic script) ---------- */
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
  var MAP = { STAFF: 'staff', CUSTOMERS: 'customers', INVENTORY: 'inventory', MACHINERY: 'machinery', LEADS: 'leads', ORDERS: 'orders', SERVICES: 'services' };

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
      // auto long-polling keeps live updates working inside APK / WebView / strict networks
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

    // realtime listeners for all data
    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(F.collection(db, MAP[key]), function (snap) {
        if (snap.empty && snap.metadata.fromCache) return;
        var list = []; snap.forEach(function (d) { list.push(d.data()); });
        if (key === 'STAFF' && !list.length) return;
        window.applyCloudData(key, list);
        setSync('Live Cloud', true);
      }, function (err) { console.error(key, err); setSync('Offline', false); });
    });

    // realtime chat (latest 150 messages, tick shows pending -> sent)
    var q = F.query(F.collection(db, 'team_messages'), F.orderBy('timestamp', 'desc'), F.limit(150));
    F.onSnapshot(q, { includeMetadataChanges: true }, function (snap) {
      var msgs = [];
      snap.forEach(function (d) { var m = d.data(); m.id = d.id; m._pending = d.metadata.hasPendingWrites; msgs.push(m); });
      msgs.reverse();
      onChatSnapshot(msgs);
      setSync('Live Cloud', true);
    }, onChatError);

    // typing indicator
    F.onSnapshot(F.collection(db, 'chat_status'), function (snap) {
      var m = {};
      snap.forEach(function (d) { if (d.id.indexOf('typing_') === 0) m[d.id] = d.data(); });
      typingState = m; paintTyping();
    }, function () {});

    setSync('Live Cloud', true);
  }).catch(function (e) {
    console.error('Firebase load failed', e);
    setSync('Offline', false);
    onChatError(e);
  });
})();
