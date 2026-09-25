/* TTESPL ERP - Live Sync v4 */
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
    '#lcErrBar{display:none;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:700;padding:5px 10px}' +
    '.lc-compress-bar{display:none;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:5px 10px;text-align:center}';
  document.head.appendChild(st);

  var hdr = document.querySelector('.chat-header-bar');
  if (hdr) {
    var t = hdr.querySelector('strong'); if (t) t.textContent = '💬 TTESPL Team Live Hub · v4';
    hdr.insertAdjacentHTML('afterend', '<div id="lcErrBar"></div><div id="lcCompressBar" class="lc-compress-bar">📷 Photo compress ho rahi hai...</div>');
  }
  function showCompressing(on) {
    var b = $('lcCompressBar');
    if (b) b.style.display = on ? 'block' : 'none';
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

  function mergeWithMaster(key, list) {
    if (!window.MASTER_DATA || !window.MASTER_DATA[key]) return list || [];
    var master = window.MASTER_DATA[key];
    if (!list || list.length === 0) return master.slice();
    var map = {};
    if (key === 'INVENTORY') {
      list.forEach(function (i) { if (i && i.name) map[String(i.name).toLowerCase().trim()] = i; });
      master.forEach(function (m) {
        var k = (m.name || '').toLowerCase().trim();
        if (!map[k]) { list.push(m); map[k] = m; }
      });
    } else if (key === 'CUSTOMERS') {
      list.forEach(function (c) { if (c && c.phone) map[String(c.phone).trim()] = c; });
      master.forEach(function (m) {
        var p = String(m.phone || '').trim();
        if (p && !map[p]) { list.push(m); map[p] = m; }
      });
    } else if (key === 'MACHINERY') {
      list.forEach(function (m) { if (m && m.name) map[m.name.toLowerCase().trim()] = m; });
      master.forEach(function (m) {
        var k = (m.name || '').toLowerCase().trim();
        if (!map[k]) { list.push(m); map[k] = m; }
      });
    }
    return list;
  }

  window.applyCloudData = function (key, list) {
    if (key === 'INVENTORY' || key === 'CUSTOMERS' || key === 'MACHINERY') {
      list = mergeWithMaster(key, list);
    }
    switch (key) {
      case 'LEADS':
        leadsData = list;
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
    if (typeof origPopulate === 'function') origPopulate();
    sels.forEach(function (s, i) { if (saved[i]) s.value = saved[i]; });
  };

  /* ---------- Stock & Machinery cards ---------- */
  function stockCard(item) {
    return '<div class="card" style="cursor:pointer;" onclick="showProductSaleReport(\'' + esc(item.name) + '\')"><div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><strong style="font-size:13.5px;">' + esc(item.name) + '</strong>' +
      '<div style="font-size:11px;color:var(--text-muted);">' + esc(item.code || '') + ' | ' + esc(item.category || '') + ' | HSN: ' + esc(item.hsn || '84139190') + '</div></div>' +
      '<div style="text-align:right;"><span class="badge ' + (item.stock <= 5 ? 'badge-danger' : 'badge-delivered') + '">' + (item.stock || 0) + ' in stock</span></div></div>' +
      '<div class="grid-2" style="margin-top:6px; border-top:1px solid #f1f5f9; padding-top:6px; font-size:12px;">' +
      '<div>Dealer: <strong style="color:var(--danger);">₹' + (item.dealer_price || 0) + '</strong></div>' +
      '<div>Customer: <strong style="color:var(--primary);">₹' + (item.rate || 0) + '</strong></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;border-top:1px dashed #e2e8f0;padding-top:4px;">' +
      '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editStockItemPrompt(' + item.id + ')">✏️ Edit</button></div></div>';
  }

  window.showProductSaleReport = function(productName) {
    let html = '<div style="font-weight:bold; margin-bottom:10px; font-size:14px; color:var(--primary); border-bottom:2px solid var(--primary); padding-bottom:4px;">Sales Report: ' + esc(productName) + '</div>';
    let found = false;
    (window.ordersData || []).forEach(function(o) {
        (o.items || []).forEach(function(it) {
            if (it.name === productName || it.name.includes(productName)) {
                found = true;
                html += '<div style="border-bottom:1px solid #e2e8f0; padding:6px 0; font-size:11.5px;">' +
                        '<div style="display:flex; justify-content:space-between;"><strong>' + esc(o.customerName) + '</strong><span style="color:var(--text-muted);">' + esc(o.orderDate) + '</span></div>' +
                        '<div>Qty: ' + it.qty + ' | Rate: ₹' + it.rate + ' | <strong style="color:var(--success);">Total: ₹' + it.total + '</strong></div>' +
                        '</div>';
            }
        });
    });
    if (!found) html += '<div style="font-size:12px; color:#64748b; padding:10px 0;">No sales history found for this product yet.</div>';
    
    var contentDiv = document.getElementById('saleReportContent');
    if (contentDiv) {
        contentDiv.innerHTML = html;
        var m = document.getElementById('saleReportModal');
        if (m) m.style.display = 'flex';
    }
  };

  window.renderStockList = function () {
    var c = $('stockListContainer'); if (!c) return;
    $('totalPartsBadge').textContent = sampleInventory.length + ' Items Loaded';
    
    var grouped = {};
    sampleInventory.forEach(function(item) {
       var cat = item.category || 'Other';
       if (!grouped[cat]) grouped[cat] = [];
       grouped[cat].push(item);
    });
    
    var html = '';
    for (var cat in grouped) {
        html += '<div style="font-size:13px; font-weight:800; color:#0f3d6c; margin: 12px 0 6px 0; background:#e2e8f0; padding:4px 8px; border-radius:4px;">📂 ' + esc(cat) + ' (' + grouped[cat].length + ')</div>';
        html += grouped[cat].map(stockCard).join('');
    }
    c.innerHTML = html;
  };

  window.filterStockList = function (val) {
    var q = String(val || '').toLowerCase().trim(), c = $('stockListContainer'); if (!c) return;
    c.innerHTML = sampleInventory.filter(function (i) {
      return i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q)) || (i.category && i.category.toLowerCase().includes(q));
    }).slice(0, 100).map(stockCard).join('');
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
    if (typeof origSwitch === 'function') origSwitch(tab, el);
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
  }

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

  var MAX_DIM = 1600;
  var TARGET_BYTES = 550 * 1024;
  var MIN_QUALITY = 0.35;
  var FLOOR_DIM = 800;

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) { resolve(e.target.result); };
      r.onerror = function () { reject(new Error('File read failed')); };
      r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Image decode failed')); };
      img.src = src;
    });
  }

  function drawResized(img, maxDim) {
    var w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) {
      if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
      else { w = Math.round(w * (maxDim / h)); h = maxDim; }
    }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas;
  }

  function approxBytes(dataUrl) {
    return Math.round(dataUrl.length * 0.75);
  }

  window.compressImageFile = function (file) {
    return readFileAsDataURL(file)
      .then(loadImage)
      .then(function (img) {
        var canvas = drawResized(img, MAX_DIM);
        var quality = 0.82;
        var out = canvas.toDataURL('image/jpeg', quality);

        while (approxBytes(out) > TARGET_BYTES && quality > MIN_QUALITY) {
          quality -= 0.1;
          out = canvas.toDataURL('image/jpeg', quality);
        }

        if (approxBytes(out) > TARGET_BYTES && Math.max(canvas.width, canvas.height) > FLOOR_DIM) {
          var canvas2 = drawResized(img, FLOOR_DIM);
          out = canvas2.toDataURL('image/jpeg', 0.7);
        }

        return out;
      });
  };

  window.handleChatFileUpload = function (event) {
    var file = event.target.files[0]; if (!file) return;

    if (file.type && file.type.indexOf('image/') === 0) {
      showCompressing(true);
      window.compressImageFile(file).then(function (dataUrl) {
        showCompressing(false);
        window.sendLiveChatMessage({ name: (file.name || 'photo.jpg').replace(/\.[^.]+$/, '.jpg'), type: 'image/jpeg', data: dataUrl });
      }).catch(function (err) {
        showCompressing(false);
        if (file.size > 700 * 1024) {
          alert('Photo compress nahi ho payi aur size bada hai.');
        } else {
          var r = new FileReader();
          r.onload = function (e) { window.sendLiveChatMessage({ name: file.name, type: file.type, data: e.target.result }); };
          r.readAsDataURL(file);
        }
      });
    } else {
      if (file.size > 700 * 1024) { alert('Please select files under 700 KB for live chat!'); event.target.value = ''; return; }
      var r2 = new FileReader();
      r2.onload = function (e) { window.sendLiveChatMessage({ name: file.name, type: file.type, data: e.target.result }); };
      r2.readAsDataURL(file);
    }
    event.target.value = '';
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

    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(F.collection(db, MAP[key]), function (snap) {
        if (snap.empty && snap.metadata.fromCache) return;
        var list = []; snap.forEach(function (d) { list.push(d.data()); });
        if (key === 'STAFF' && !list.length) return;
        window.applyCloudData(key, list);
        setSync('Live Cloud', true);
      }, function (err) { console.error(key, err); setSync('Offline', false); });
    });

    var q = F.query(F.collection(db, 'team_messages'), F.orderBy('timestamp', 'desc'), F.limit(150));
    F.onSnapshot(q, { includeMetadataChanges: true }, function (snap) {
      var msgs = [];
      snap.forEach(function (d) { var m = d.data(); m.id = d.id; m._pending = d.metadata.hasPendingWrites; msgs.push(m); });
      msgs.reverse();
      onChatSnapshot(msgs);
      setSync('Live Cloud', true);
    }, onChatError);

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

  /* ---------- Custom Solid Dropdown for Search Inputs (replaces glitchy native datalist on mobile) ---------- */
  var dropEl = document.createElement('div');
  dropEl.id = 'appCustomDropdown';
  dropEl.style.cssText = 'position:fixed;display:none;background:#ffffff;border:1.5px solid #0f3d6c;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.3);max-height:220px;overflow-y:auto;z-index:999999;font-family:sans-serif;width:280px;';
  document.body.appendChild(dropEl);

  var activeTargetInput = null;

  function closeCustomDropdown() {
    dropEl.style.display = 'none';
    activeTargetInput = null;
  }
  document.addEventListener('click', function(e) {
    if (e.target !== activeTargetInput && !dropEl.contains(e.target)) {
      closeCustomDropdown();
    }
  });

  function positionDropdown(input) {
    var rect = input.getBoundingClientRect();
    dropEl.style.top = (rect.bottom + 4) + 'px';
    dropEl.style.left = rect.left + 'px';
    dropEl.style.width = Math.max(rect.width, 260) + 'px';
  }

  function showCustomSuggestions(input, type) {
    activeTargetInput = input;
    var query = (input.value || '').toLowerCase().trim();
    var list = [];

    if (type === 'customer') {
      list = (window.customerDatabase || []).filter(function(c) {
        return !query || (c.name && c.name.toLowerCase().includes(query)) || (c.phone && String(c.phone).includes(query)) || (c.address && c.address.toLowerCase().includes(query));
      }).slice(0, 25).map(function(c) {
        return {
          val: c.name + ' (' + c.phone + ')',
          title: c.name,
          sub: (c.phone ? '📞 ' + c.phone : '') + (c.address ? ' | 📍 ' + c.address : '')
        };
      });
    } else if (type === 'product') {
      list = (window.sampleInventory || []).filter(function(p) {
        return !query || (p.name && p.name.toLowerCase().includes(query)) || (p.code && p.code.toLowerCase().includes(query)) || (p.category && p.category.toLowerCase().includes(query));
      }).slice(0, 25).map(function(p) {
        return {
          val: p.name + (p.code ? ' [' + p.code + ']' : ''),
          title: p.name,
          sub: (p.code ? '[' + p.code + '] ' : '') + 'Stock: ' + (p.stock || 0) + ' | ₹' + (p.rate || 0) + (p.dealer_price ? ' (Dealer: ₹' + p.dealer_price + ')' : '')
        };
      });
    } else if (type === 'machine') {
      list = (window.machineryDatabase || []).filter(function(m) {
        return !query || (m.name && m.name.toLowerCase().includes(query)) || (m.pump && m.pump.toLowerCase().includes(query));
      }).slice(0, 25).map(function(m) {
        return {
          val: m.name,
          title: m.name,
          sub: (m.pump ? m.pump + ' | ' : '') + '₹' + (m.price || 0)
        };
      });
    }

    if (list.length === 0) {
      closeCustomDropdown();
      return;
    }

    positionDropdown(input);
    var html = '';
    list.forEach(function(item) {
      html += '<div class="custom-drop-item" style="padding:8px 10px;border-bottom:1px solid #f1f5f9;cursor:pointer;background:#ffffff;color:#111827;">' +
        '<div style="font-weight:700;font-size:12.5px;color:#0f3d6c;">' + esc(item.title) + '</div>' +
        '<div style="font-size:10.5px;color:#64748b;margin-top:2px;">' + esc(item.sub) + '</div>' +
        '</div>';
    });
    dropEl.innerHTML = html;
    dropEl.style.display = 'block';

    var items = dropEl.querySelectorAll('.custom-drop-item');
    items.forEach(function(el, idx) {
      el.addEventListener('mouseenter', function() { el.style.background = '#f0f7ff'; });
      el.addEventListener('mouseleave', function() { el.style.background = '#ffffff'; });
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        input.value = list[idx].val;
        closeCustomDropdown();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (input.id === 'leadMachine' && typeof window.onMachineSelect === 'function') {
          window.onMachineSelect(input.value);
        }
      });
    });
  }

  function setupSearchInputs() {
    var custInputs = ['leadCustSearchInput', 'ordCustSearchInput', 'srvCustSearchInput'];
    custInputs.forEach(function(id) {
      var el = $(id);
      if (el) {
        el.removeAttribute('list');
        el.setAttribute('autocomplete', 'off');
        el.onfocus = function() { showCustomSuggestions(el, 'customer'); };
        el.oninput = function() { showCustomSuggestions(el, 'customer'); };
      }
    });

    var machInputs = ['leadMachine', 'srvMachine'];
    machInputs.forEach(function(id) {
      var el = $(id);
      if (el) {
        el.removeAttribute('list');
        el.setAttribute('autocomplete', 'off');
        el.onfocus = function() { showCustomSuggestions(el, 'machine'); };
        el.oninput = function() { showCustomSuggestions(el, 'machine'); };
      }
    });

    var prodInputs = ['srvPartSearchInput'];
    prodInputs.forEach(function(id) {
      var el = $(id);
      if (el) {
        el.removeAttribute('list');
        el.setAttribute('autocomplete', 'off');
        el.onfocus = function() { showCustomSuggestions(el, 'product'); };
        el.oninput = function() { showCustomSuggestions(el, 'product'); };
      }
    });

    document.querySelectorAll('.item-product-input').forEach(function(el) {
      el.removeAttribute('list');
      el.setAttribute('autocomplete', 'off');
      el.onfocus = function() { showCustomSuggestions(el, 'product'); };
      el.oninput = function() {
        if (typeof onOrderItemInput === 'function') onOrderItemInput(el);
        showCustomSuggestions(el, 'product');
      };
    });
  }

  setInterval(setupSearchInputs, 800);

})();
