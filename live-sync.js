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
        return Promise.all(jobs).then(function () { setSync('Live Cloud', true); })
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

    // Live Snapshot Listeners across all devices
    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(F.collection(db, MAP[key]), function (snap) {
        var list = [];
        snap.forEach(function (d) { list.push(d.data()); });

        // Is collection ka sabse latest "jaisa cloud me hai waisa" snapshot cache karo -
        // pushKey isi se compare karke decide karta hai ki kaun se items sach me local
        // badlav hain (dobara bhejne hain) aur kaun se sirf purane/untouched hain (skip).
        var cacheNow = {};
        list.forEach(function (it) { if (it && it.id != null) cacheNow[it.id] = JSON.stringify(it); });
        lastCloud[key] = cacheNow;

        switch (key) {
          case 'LEADS': leadsData = list; if (typeof renderLeads === 'function') renderLeads(); break;
          case 'ORDERS': 
            ordersData = list; 
            if (typeof renderOrders === 'function') renderOrders(); 
            if (typeof renderBilling === 'function') renderBilling('all'); 
            break;
          case 'SERVICES': serviceCallsData = list; if (typeof renderServices === 'function') renderServices(); break;
          case 'INVENTORY': 
            sampleInventory = list; 
            if (typeof renderStockList === 'function') renderStockList(); 
            break;
          case 'MACHINERY': machineryDatabase = list; break;
          case 'CUSTOMERS': 
            customerDatabase = list; 
            if (typeof renderCustomerList === 'function') renderCustomerList(); 
            break;
          case 'STAFF': 
            if (list.length > 0) registeredEmployees = list; 
            if (typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
            break;
          case 'MACHINE_PARTS':
            machinePartsData = list;
            if (typeof window.machinePartsData !== 'undefined') window.machinePartsData = list;
            if (typeof updateGlobalReminders === 'function') updateGlobalReminders();
            break;
        }

        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof updateAdminDeleteVisibility === 'function') updateAdminDeleteVisibility();
        setSync('Live Cloud', true);
      }, function (err) {
        console.error('Stream error:', key, err);
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
