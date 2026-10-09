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

  // UNSYNCED-DATA PROTECTION: pehle jab kisi order/lead/service ka cloud push
  // kisi bhi wajah se fail hota tha (size, net, permission waghera), to us
  // device ka local data to sahi rehta tha, LEKIN thodi hi der me agla real-time
  // cloud snapshot (jisme wo naya/update hua record abhi tak nahi pahuncha tha)
  // aakar seedha "ordersData = list" karke is device ki memory me CHALU change
  // ko purane cloud data se OVERWRITE kar deta tha. Agle kisi bhi save par ye
  // purana (galat) data wapas localStorage me bhi likha jaata, aur app reopen
  // karne par us device ka kiya hua kaam hamesha ke liye gayab ho jaata tha -
  // chahe push sirf 1 baar fail hua ho. Ab jab bhi kisi key (ORDERS, LEADS,
  // SERVICES waghera) ka cloud push abhi tak confirm nahi hua hai, us key ke
  // liye aane wale cloud snapshot ko IGNORE kiya jaata hai (jab tak push safal
  // na ho jaye) - taaki local (abhi tak un-synced) data kabhi overwrite/delete
  // na ho. Jaise hi push safal hota hai, agla cloud snapshot normal tarike se
  // wapas apply hone lagta hai.
  var dbPrefix = function () { return (typeof window !== 'undefined' && window.DB_PREFIX) ? window.DB_PREFIX : 'TTESPL_ERP_'; };
  var pendingFlagKey = function (key) { return dbPrefix() + 'SYNC_PENDING_' + key; };
  var markPending = function (key, on) {
    try {
      if (on) localStorage.setItem(pendingFlagKey(key), '1');
      else localStorage.removeItem(pendingFlagKey(key));
    } catch (e) {}
  };
  var isPending = function (key) {
    try { return !!localStorage.getItem(pendingFlagKey(key)); } catch (e) { return false; }
  };

  // UNDEFINED-VALUE SAFEGUARD: Firestore SDK kisi bhi document me "undefined"
  // value dekhte hi use turant (synchronously) reject kar deta hai - bina kisi
  // retry/error-toast ke, poora save chupchaap ruk jata hai. Cloud me jaane se
  // pehle har "undefined" ko yahan null me badal dete hain (saveDoc aur pushKey
  // dono use karte hain), taaki koi bhi save sirf iss wajah se kabhi na ruke.
  function sanitizeForFirestore(val) {
    if (val === undefined) return null;
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(sanitizeForFirestore);
    var out = {};
    Object.keys(val).forEach(function (k) { out[k] = sanitizeForFirestore(val[k]); });
    return out;
  }

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

    // App pichli baar band/crash hui ho aur tab OFFLINE_QUEUE me kisi key ka
    // data bhejna reh gaya ho, to is naye session ke shuru hote hi us key ko
    // turant "pending" maan lo - taaki pehla hi cloud snapshot us purane
    // un-synced data ko galti se overwrite na kar de.
    try {
      var _oq = JSON.parse(localStorage.getItem(dbPrefix() + 'OFFLINE_QUEUE') || '{}');
      Object.keys(_oq).forEach(function (k) { if (MAP[k]) markPending(k, true); });
    } catch (e) {}

    // Direct Real-Time Cloud Methods with Persistence Guarantee
    window.cloudSync = {
      saveDoc: function (key, item) {
        var col = MAP[key];
        if (!col || !item || item.id == null) return Promise.resolve();
        setSync('Saving...', true);
        try {
          return F.setDoc(F.doc(db, col, did(item.id)), sanitizeForFirestore(item), { merge: true })
            .then(function () { setSync('Live Cloud', true); })
            .catch(function (e) { console.error('Cloud Save Error:', e); setSync('Offline', false); });
        } catch (e) {
          console.error('Cloud Save Error:', e); setSync('Offline', false); return Promise.reject(e);
        }
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

        // Push shuru hote hi is key ko "pending" maan lo - jab tak Firestore se
        // pakka confirm na ho jaye ki ye data safal save ho gaya, tab tak koi
        // bhi aane wala cloud snapshot is key ka local data overwrite nahi karega.
        markPending(key, true);

        // DOCUMENT SIZE SAFEGUARD (orders): har partial "due payment" collect hote
        // waqt uska proof photo order.payments[] array ke andar HAMESHA ke liye jama
        // ho jata tha. Kai due-collections ke baad (jo normal hai - customers kai
        // baar me payment karte hain) ye poora order document Firestore ki hard
        // ~1MB/document limit se bada ho jata tha - aur tab "Deliver & Upload Proof"
        // jaisa koi bhi naya save us order ke liye CHUPCHAAP (sirf browser console
        // me) fail ho jata tha: UI turant "Delivered"/ledger dikha deta tha (local
        // change), lekin cloud me kabhi jaata hi nahi tha - isliye app band karke
        // dobara kholne par purana status wapas aa jata tha. Fix: agar kisi order
        // ka size bada lage (ya Firestore size-error se fail ho), to sirf us order
        // ke CLOUD-bound copy me se purane payment-proof photos hata kar ek chhota
        // version bhejte hain - is device ka local data (poora photo history sahit)
        // bilkul nahi badalta, sirf cloud me jo jaata hai wahi chhota hota hai.
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
          var out = (col === 'orders' && sizeOf(it) > SAFE_LIMIT) ? shrinkOrderForCloud(it, false) : it;
          return sanitizeForFirestore(out);
        });

        function commitAll(list) {
          try {
            var jobs = [];
            for (var i = 0; i < list.length; i += 400) {
              var b = F.writeBatch(db);
              list.slice(i, i + 400).forEach(function (it) {
                if (it && it.id != null) b.set(F.doc(db, col, did(it.id)), it, { merge: true });
              });
              jobs.push(b.commit());
            }
            return Promise.all(jobs);
          } catch (e) {
            // SYNC-THROW SAFEGUARD: Firestore SDK kabhi-kabhi (jaise koi field
            // uska bharosemand data-type na ho) .set() ke andar hi turant error
            // "throw" kar deta tha, jo normal Promise .catch() tak kabhi
            // pahunchta hi nahi tha - isse poora save chupchaap, bina kisi
            // retry/offline-queue ke, ruk jata tha. Ab aisi error bhi reject
            // hui Promise ki tarah hi retry/offline-queue tak pahunchti hai.
            return Promise.reject(e);
          }
        }

        // BUG FIX: pehle yahan koi .catch() nahi tha, isliye jab bhi ye save cloud
        // tak fail hokar nahi pahunchta tha, na to sync status "Offline" dikhata tha
        // na hi app ko pata chalta tha - upar wala UI hamesha theek dikhata rehta
        // tha jabki data cloud me ja hi nahi raha tha. Ab failure clearly dikhega
        // aur error upar (index.html ke retry/offline-queue) tak bhi jayega.
        return commitAll(prepared).then(function () { setSync('Live Cloud', true); markPending(key, false); })
          .catch(function (e) {
            console.error('Cloud pushKey Error:', e);
            var msg = (e && e.message) || '';
            if (col === 'orders' && /longer than|exceeds|too large|invalid-argument|resource-exhausted/i.test(msg)) {
              // Aakhri koshish: is batch ke sabhi orders se purane proof photos
              // poori tarah hata kar bhejo - taaki status/amount jaisi zaroori
              // cheezein size ki wajah se kabhi bhi cloud jaane se na ruke.
              var shrunk = toSend.map(function (it) { return sanitizeForFirestore(col === 'orders' ? shrinkOrderForCloud(it, true) : it); });
              return commitAll(shrunk).then(function () { setSync('Live Cloud', true); markPending(key, false); })
                .catch(function (e2) { console.error('Cloud pushKey retry Error:', e2); setSync('Offline', false); throw e2; });
            }
            setSync('Offline', false); throw e;
          });
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
      if (pendingRender.LEADS && typeof renderLeads === 'function') renderLeads();
      if (pendingRender.ORDERS) {
        if (typeof renderOrders === 'function') renderOrders();
        if (typeof renderBilling === 'function') renderBilling('all');
      }
      if (pendingRender.SERVICES && typeof renderServices === 'function') renderServices();
      if (pendingRender.INVENTORY && typeof renderStockList === 'function') renderStockList();
      if (pendingRender.CUSTOMERS && typeof renderCustomerList === 'function') renderCustomerList();
      if (pendingRender.STAFF && typeof populateDropdownsAndDatalists === 'function') populateDropdownsAndDatalists();
      if (pendingRender.MACHINE_PARTS && typeof updateGlobalReminders === 'function') updateGlobalReminders();
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
    var initialKeysPending = Object.keys(MAP).length;
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

        // Is collection ka sabse latest "jaisa cloud me hai waisa" snapshot cache karo -
        // pushKey isi se compare karke decide karta hai ki kaun se items sach me local
        // badlav hain (dobara bhejne hain) aur kaun se sirf purane/untouched hain (skip).
        var cacheNow = {};
        list.forEach(function (it) { if (it && it.id != null) cacheNow[it.id] = JSON.stringify(it); });
        lastCloud[key] = cacheNow;

        if (isPending(key)) {
          // Is device ka is key ka data abhi tak cloud me confirm-save nahi hua
          // hai (push chal raha hai ya pehle fail ho chuka hai) - is round ka
          // cloud snapshot isliye jaan-boojh kar ignore kiya ja raha hai, taaki
          // abhi tak un-synced local kaam (naya order/delivery/payment) galti
          // se purane cloud data se overwrite/delete na ho jaye. Push safal
          // hote hi agla snapshot normal tarike se apply hoga.
          console.warn('Cloud snapshot skipped for', key, '- local changes still pending upload.');
        } else {
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
            case 'MACHINE_PARTS':
              machinePartsData = list;
              if (typeof window.machinePartsData !== 'undefined') window.machinePartsData = list;
              break;
          }
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
