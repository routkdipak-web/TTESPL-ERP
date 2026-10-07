/* TTESPL ERP - Push Notification Sender (Firebase Cloud Function)
   =================================================================
   YE WO MISSING PIECE HAI jiske bina app band/kill hone par asli
   Android push notification kabhi nahi aa sakta tha.

   Ab tak index.html / live-sync.js sirf itna karte the:
     1. Staff jab "Enable Notifications" allow karta hai, uske phone ka
        FCM token "fcm_tokens" collection me save ho jaata hai.
     2. Jab order/payment/delivery hoti hai, ek chhota sa record
        "app_notifications" collection me likha jaata hai.

   Lekin koi bhi cheez us record ko padh kar asli FCM push message
   bhej nahi rahi thi - isliye app open hone par (jab JS chal raha ho
   aur Firestore ka "onSnapshot" listener live ho) hi notification
   dikhta tha; app pura band/kill hone par kabhi nahi aata tha.

   Ye Cloud Function wahi missing step hai: jab bhi "app_notifications"
   me naya document bane, ye function "fcm_tokens" collection ke sabhi
   saved tokens ko padh kar sabko ek real FCM push bhej deta hai - jo
   Android ke apne background service ke through deliver hota hai,
   chahe app pura band hi kyu na ho (bilkul WhatsApp/Zomato jaisa).
   =================================================================
*/

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

exports.sendPushOnNewNotification = onDocumentCreated(
  "app_notifications/{notifId}",
  async (event) => {
    const notif = event.data.data();
    if (!notif) return;

    const tokensSnap = await db.collection("fcm_tokens").get();
    const tokens = tokensSnap.docs
      .map((d) => d.data().token)
      .filter((t) => !!t);

    if (tokens.length === 0) {
      console.log("Koi FCM token saved nahi hai - push kisi ko nahi bhej sakte.");
      return;
    }

    const message = {
      notification: {
        title: notif.title || "TTESPL Alert",
        body: notif.body || "",
      },
      // Android par high-priority heads-up banner + sound/vibration ke
      // liye zaroori - isके bina notification silently tray me ja sakta
      // hai, popup nahi hota.
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "ttespl_alerts",
          priority: "max",
          visibility: "public",
        },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: "https://cdn-icons-png.flaticon.com/512/9422/9422891.png",
          requireInteraction: true,
        },
      },
      tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(
        `Push bhej diya: ${response.successCount} safal, ${response.failureCount} fail.`
      );

      // Jo token invalid/expired ho gaye hain (app uninstall ho gaya ya
      // purana token), unhe "fcm_tokens" se clean kar dete hain taaki
      // agli baar unhe dobara try na karein.
      const badTokens = [];
      response.responses.forEach((r, i) => {
        if (
          !r.success &&
          (r.error?.code === "messaging/invalid-registration-token" ||
            r.error?.code === "messaging/registration-token-not-registered")
        ) {
          badTokens.push(tokens[i]);
        }
      });
      if (badTokens.length) {
        const batch = db.batch();
        tokensSnap.docs.forEach((d) => {
          if (badTokens.includes(d.data().token)) batch.delete(d.ref);
        });
        await batch.commit();
        console.log(`${badTokens.length} purane/invalid tokens clean kar diye.`);
      }
    } catch (err) {
      console.error("Push bhejne me error:", err);
    }
  }
);
