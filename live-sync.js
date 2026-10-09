/* TTESPL ERP - Pure Direct Cloud Architecture (LocalStorage Bypassed) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Firestore document IDs cannot contain "/".
  var did = function (id) { return String(id).replace(/\//g, '~'); };
  var me = function () {
    return (typeof currentUser !== 'undefined' && currentUser)
      ? currentUser.name : '';
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
    SERVICES: 'services',
    MACHINE_PARTS: 'machine_parts',
    QUOTATIONS: 'quotations',
    TRAVEL_EXPENSES: 'travel_expenses'
  };

  function setSync(text, ok) {
    var t = $('syncText');
    var d = $('syncDot');
    if (t) t.textContent = text;
    if (d) d.classList[ok ? 'remove' : 'add']('offline');
  }

  Promise.all([
    import(V + 'firebase-app.js'),
    import(V + 'firebase-firestore.js')
  ]).then(function (mods) {
    var A = mods[0];
    var F = mods[1];

    var app = A.getApps().length ? A.getApp() : A.initializeApp(CFG);
    var db;

    try {
      db = F.initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true
      });
    } catch (e) {
      db = F.getFirestore(app);
    }

    // Offline persistence
    if (typeof F.enableIndexedDbPersistence === 'function') {
      F.enableIndexedDbPersistence(db).catch(function (e) {
        console.warn(
          'IndexedDB persistence unavailable:',
          e && e.code
        );
      });
    }

    // Keep a snapshot cache to avoid pushing unchanged records.
    var lastCloud = {};

    window.cloudSync = {
      saveDoc: function (key, item) {
        var col = MAP[key];
        if (!col || !item || item.id == null) {
          return Promise.resolve();
        }

        setSync('Saving...', true);

        return F.setDoc(
          F.doc(db, col, did(item.id)),
          item,
          { merge: true }
        ).then(function () {
          setSync('Live Cloud', true);
        }).catch(function (e) {
          console.error('Cloud Save Error:', e);
          setSync('Offline', false);
          throw e;
        });
      },

      deleteItem: function (key, id) {
        var col = MAP[key];
        if (!col || id == null) {
          return Promise.resolve();
        }

        setSync('Deleting...', true);

        return F.deleteDoc(
          F.doc(db, col, did(id))
        ).then(function () {
          setSync('Live Cloud', true);
        }).catch(function (e) {
          console.error('Cloud Delete Error:', e);
          setSync('Offline', false);
          throw e;
        });
      },

      pushKey: function (key, arr) {
        var col = MAP[key];

        if (!col || !Array.isArray(arr)) {
          return Promise.resolve();
        }

        var cache = lastCloud[key];
        var toSend = arr;

        if (cache) {
          toSend = arr.filter(function (it) {
            if (!it || it.id == null) return false;
            var prev = cache[it.id];
            return prev === undefined || prev !== JSON.stringify(it);
          });
        }

        if (!toSend.length) {
          return Promise.resolve();
        }

        var jobs = [];

        for (var i = 0; i < toSend.length; i += 400) {
          var b = F.writeBatch(db);

          toSend.slice(i, i + 400).forEach(function (it) {
            if (it && it.id != null) {
              b.set(
                F.doc(db, col, did(it.id)),
                it,
                { merge: true }
              );
            }
          });

          jobs.push(b.commit());
        }

        return Promise.all(jobs).then(function () {
          setSync('Live Cloud', true);
        }).catch(function (e) {
          console.error('Cloud pushKey Error:', e);
          setSync('Offline', false);
          throw e;
        });
      },

      sendChatMessage: function (msg) {
        var id = msg.cid ? did(msg.cid) : undefined;

        return id
          ? F.setDoc(
              F.doc(db, 'team_messages', id),
              msg,
              { merge: true }
            )
          : F.setDoc(
              F.doc(F.collection(db, 'team_messages')),
              msg
            );
      },

      editChatMessage: function (cid, newText) {
        return F.setDoc(
          F.doc(db, 'team_messages', did(cid)),
          {
            text: newText,
            edited: true,
            editedAt: Date.now()
          },
          { merge: true }
        );
      },

      deleteChatMessage: function (cid) {
        return F.deleteDoc(
          F.doc(db, 'team_messages', did(cid))
        );
      },

      setTypingStatus: function (user, isTyping) {
        var id = 'typing_' + String(user).replace(/[^a-zA-Z0-9]/g, '_');

        return F.setDoc(
          F.doc(db, 'chat_status', id),
          {
            user: user,
            isTyping: isTyping,
            updatedAt: Date.now()
          },
          { merge: true }
        );
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

        return F.addDoc(
          F.collection(db, 'app_notifications'),
          notifDoc
        );
      },

      saveFcmToken: function (token, staffName) {
        if (!token) return Promise.resolve();

        return F.setDoc(
          F.doc(db, 'fcm_tokens', did(token)),
          {
            token: token,
            staff: staffName || 'Staff',
            updatedAt: Date.now()
          },
          { merge: true }
        );
      },

      wipeAll: function () {
        var collectionsToWipe = Object.keys(MAP)
          .map(function (k) { return MAP[k]; })
          .concat([
            'team_messages',
            'chat_status',
            'app_notifications'
          ]);

        function wipeCollection(colName) {
          return F.getDocs(
            F.collection(db, colName)
          ).then(function (snap) {
            var docs = [];

            snap.forEach(function (d) {
              docs.push(d.ref);
            });

            var jobs = [];

            for (var i = 0; i < docs.length; i += 400) {
              var b = F.writeBatch(db);

              docs.slice(i, i + 400).forEach(function (ref) {
                b.delete(ref);
              });

              jobs.push(b.commit());
            }

            return Promise.all(jobs);
          });
        }

        setSync('Resetting...', true);

        return Promise.all(
          collectionsToWipe.map(wipeCollection)
        ).then(function () {
          setSync('Live Cloud', true);
        }).catch(function (e) {
          console.error('Factory Reset Error:', e);
          setSync('Offline', false);
          throw e;
        });
      }
    };

    // Batch UI rendering to reduce flicker.
    var pendingRender = {};
    var renderTimer = null;

    function scheduleRender(key) {
      pendingRender[key] = true;

      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(flushRender, 250);
    }

    function flushRender() {
      renderTimer = null;

      if (pendingRender.LEADS && typeof renderLeads === 'function') {
        renderLeads();
      }

      if (pendingRender.ORDERS) {
        if (typeof renderOrders === 'function') renderOrders();
        if (typeof renderBilling === 'function') renderBilling('all');
      }

      if (pendingRender.SERVICES && typeof renderServices === 'function') {
        renderServices();
      }

      if (pendingRender.INVENTORY && typeof renderStockList === 'function') {
        renderStockList();
      }

      if (pendingRender.CUSTOMERS && typeof renderCustomerList === 'function') {
        renderCustomerList();
      }

      if (pendingRender.STAFF &&
          typeof populateDropdownsAndDatalists === 'function') {
        populateDropdownsAndDatalists();
      }

      if (pendingRender.MACHINE_PARTS &&
          typeof updateGlobalReminders === 'function') {
        updateGlobalReminders();
      }

      if (pendingRender.TRAVEL_EXPENSES &&
          typeof window.renderTravelExpenses === 'function') {
        window.renderTravelExpenses();
      }

      if (pendingRender.QUOTATIONS &&
          typeof renderQuotationHistory === 'function') {
        renderQuotationHistory();
      }

      if (typeof renderDashboard === 'function') renderDashboard();

      if (typeof updateAdminDeleteVisibility === 'function') {
        updateAdminDeleteVisibility();
      }

      setSync('Live Cloud', true);
      pendingRender = {};
    }

    // Initial cloud-load status
    var initialKeysPending = Object.keys(MAP).length;
    var initialLoadDone = false;

    window.ttCloudInitialLoadDone = false;

    var initialLoadTimer = setTimeout(function () {
      if (!initialLoadDone) {
        initialLoadDone = true;
        window.ttCloudInitialLoadDone = true;
        flushRender();
      }
    }, 4000);

    // Real-time listeners for all mapped collections
    Object.keys(MAP).forEach(function (key) {
      F.onSnapshot(
        F.collection(db, MAP[key]),
        function (snap) {
          var list = [];

          snap.forEach(function (d) {
            list.push(d.data());
          });

          var cacheNow = {};

          list.forEach(function (it) {
            if (it && it.id != null) {
              cacheNow[it.id] = JSON.stringify(it);
            }
          });

          lastCloud[key] = cacheNow;

          switch (key) {
            case 'LEADS':
              leadsData = list;
              break;

            case 'ORDERS':
              ordersData = list;
              break;

            case 'SERVICES':
              serviceCallsData = list;
              break;

            case 'INVENTORY':
              sampleInventory = list;
              break;

            case 'MACHINERY':
              machineryDatabase = list;
              break;

            case 'CUSTOMERS':
              customerDatabase = list;
              break;

            case 'STAFF':
              if (list.length > 0) {
                registeredEmployees = list;
              }
              break;

            case 'TRAVEL_EXPENSES':
              var localTravel = [];

              try {
                localTravel = JSON.parse(
                  localStorage.getItem(
                    (window.DB_PREFIX || 'TTESPL_ERP_') +
                    'TRAVEL_EXPENSES'
                  ) || '[]'
                ) || [];
              } catch (e) {}

              if (!list.length && localTravel.length) {
                window.ttTravelExpenses = localTravel;

                window.cloudSync.pushKey(
                  'TRAVEL_EXPENSES',
                  localTravel
                ).catch(function (e) {
                  console.warn('Travel initial sync failed', e);
                });
              } else {
                try {
                  localStorage.setItem(
                    (window.DB_PREFIX || 'TTESPL_ERP_') +
                    'TRAVEL_EXPENSES',
                    JSON.stringify(list)
                  );
                } catch (e) {}

                window.ttTravelExpenses = list;
              }

              if (typeof window.renderTravelExpenses === 'function') {
                window.renderTravelExpenses();
              }
              break;

            case 'QUOTATIONS':
              try {
                list.sort(function (a, b) {
                  return Number(b.updatedAt || b.createdAt || 0) -
                    Number(a.updatedAt || a.createdAt || 0);
                });

                localStorage.setItem(
                  (window.DB_PREFIX || 'TTESPL_ERP_') +
                  'QUOTATIONS_HISTORY_FULL',
                  JSON.stringify(list)
                );
              } catch (e) {}

              if (typeof renderQuotationHistory === 'function') {
                renderQuotationHistory();
              }
              break;

            case 'MACHINE_PARTS':
              machinePartsData = list;

              if (typeof window.machinePartsData !== 'undefined') {
                window.machinePartsData = list;
              }
              break;
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
        },
        function (err) {
          console.error('Stream error:', key, err);
          setSync('Offline', false);
        }
      );
    });

    // Team chat listener
    var q = F.query(
      F.collection(db, 'team_messages'),
      F.orderBy('timestamp', 'desc'),
      F.limit(150)
    );

    F.onSnapshot(q, function (snap) {
      var msgs = [];

      snap.forEach(function (d) {
        msgs.push(d.data());
      });

      msgs.reverse();
      teamChatData = msgs;

      if (typeof renderChatMessages === 'function') {
        renderChatMessages();
      }
    });

    // Live notifications listener
    var startTimestamp = Date.now() - 60000;

    var notifQuery = F.query(
      F.collection(db, 'app_notifications'),
      F.orderBy('timestamp', 'desc'),
      F.limit(15)
    );

    F.onSnapshot(notifQuery, function (snap) {
      snap.docChanges().forEach(function (change) {
        if (change.type === 'added') {
          var n = change.doc.data();

          if (n.timestamp > startTimestamp) {
            if (typeof window.showBroadcastToastAlert === 'function') {
              window.showBroadcastToastAlert(n);
            }
          }
