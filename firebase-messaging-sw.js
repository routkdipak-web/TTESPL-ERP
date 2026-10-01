/* TTESPL ERP - Background push notification handler.
   Ye file index.html ke BRABAR (same folder/root) me GitHub par honi chahiye,
   taaki browser ise sahi se register kar sake. App band/minimize hone par
   bhi yahi file asli Android system notification dikhati hai. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAjsq2wbyXmt8_MjEazM9mAYd5vlZW0dy4",
  authDomain: "ttespl.firebaseapp.com",
  projectId: "ttespl",
  storageBucket: "ttespl.firebasestorage.app",
  messagingSenderId: "244674439608",
  appId: "1:244674439608:web:7f7299ffd94e0a0cc5474d"
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || 'TTESPL Alert';
  var body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || '';
  self.registration.showNotification(title, {
    body: body,
    tag: 'ttespl-notif-' + Date.now()
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
