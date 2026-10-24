TTESPL ERP  -  v41  (upgrade of v40)
=====================================================================
Naya kya hai: sab bug fix + naye option. Naye options Settings me alag category me hain
(Profile menu > Settings): Safety & Login, Payments & Receipts, Stock Control, Invoice & GST,
Data Safety & Export, Speed & Offline, Insights. Har switch is phone me save hota hai.

BUGS FIXED (hamesha ON, switch nahi)
  - Date UTC ki jagah India (local) date  (raat 12-5:30 baje galat date)
  - Decimal qty (1.5) ka total ab sahi save hota hai
  - Order ID ab 6 digit (do phone par same ID ka khatra khatam)
  - Customer naam me ' ya < ho to buttons/print nahi toot-te; invoice me \ nahi dikhta
  - Ledger edit karne par item ka HSN / MRP / id ab nahi udta
  - Bade photo (payments ke andar) ab 1 MB limit se save fail nahi karte
  - Previous Due: same naam, alag mobile wale customer mix nahi hote
  - Password placeholder "min 6", PIN 4 ya 6 digit
  - Stock card ka low-stock ab Settings ke level / item ke minimum se chalta hai
  - firebase-messaging-sw.js missing tha - ab file hai (push + offline)
  - Delete ab cloud se bhi hota hai (pehle wapas aa jata tha)

SWITCH WALE (Settings me on/off)
  Safety: login re-check, idle auto-logout, friendly pop-ups, self-register on/off, first-Admin protection, SECURE MODE
  Payments: over-payment block, latest copy check, receipt numbers, Receipts & refunds (credit note), Customer statement
  Stock: low-stock warning on order, double delivery block, stock wapas on cancel/delete, Stock in / adjust (log)
  Invoice/GST: FY-wise invoice number, per-item GST % (stock item me), courier taxable, auto IGST/CGST, bank details from company
  Data: Recycle bin (Admin restore), Excel(CSV) export, backup reminder
  Speed: offline app, photos Cloud Storage me, long lists pages me
  Insights: month compare, top customers, staff-wise sales, pending dues

DEPLOY (sirf jo use karna ho)
  1) App files: poora folder hosting par daal do (index.html, js/, css/, assets/, manifest.webmanifest, firebase-messaging-sw.js).
  2) Push + daily backup + secure login:  cd functions && npm install && firebase deploy --only functions
     (Blaze plan chahiye. Region asia-south1; agar Firestore ka location alag ho to functions/index.js me region badlo.)
  3) Photos Cloud Storage me: Firebase console > Storage enable > storage.rules publish > Settings me switch ON.
  4) SECURE MODE (asli suraksha) - is order me:
        a. functions deploy karo (step 2), "api" function ka https URL copy karo
        b. App me Admin login > Settings > Safety & Login > "Secure login server URL" me URL daalo > "Test" dabao
           (apna Admin password poochega, staff ke password-hash safe jagah chale jate hain, secure mode ON ho jata hai)
        c. Har phone par app band-khol ke dobara login karo
        d. Ab firestore.rules.secure ko Firebase console > Firestore > Rules me publish karo
     Agar kabhi lock ho jao: app ko  ...index.html?nosecure=1  se kholo.
     firestore.rules.example ko secure mode OFF hote hue publish MAT karna (sab phone lock ho jayenge).
  Note: Firebase Console me rules abhi jo hain wahi chalte rahenge jab tak aap naye publish nahi karte.

TESTING NOTE: browser me test hua (delete, payment, delivery, cancel, GST math, sab naye screens, paging, offline worker).
Firebase se jude hisse (secure login, push, daily backup, Cloud Storage photos) yahan live Firebase nahi tha,
isliye unko deploy karke ek baar khud test karna zaroori hai. Ye sab default OFF / optional hain.

---------------------------------------------------------------------
(purana README neeche)
---------------------------------------------------------------------
TTESPL ERP - modular build (v31)
Upload the WHOLE folder (index.html + css/ + js/ + live-sync.js + master-data.js) keeping the structure.
Load order is defined in index.html. Do not reorder the js files.
After every deploy bump the ?v=31 number in index.html so phones fetch the new files.

v31 changes
- AI: models centralised in js/00-ai-models.js (3.5 Flash-Lite / 3.8 Flash / 3.1 Pro / 4 Argon). Old gemini-2.5/2.0 IDs auto-map.
- No API key in code. Admin: AI Settings -> Set device key, or deploy functions/ (gateway) and paste its URL.
- Login: PBKDF2-hashed password/PIN, 5-try lockout, Admin cannot be self-registered, session holds no secrets.
- Lucide pinned to 0.525.0. Master data cleaned. CSS deduplicated, print-only css/02 removed.
- Liquid Water Glass: css/08-liquid-glass.css + js/13-liquid-glass.js. Demo: liquid-glass-demo.html
- firestore.rules.example = template for real server-side protection.
Decorative animations are off by default: document.documentElement.classList.add('tt-fancy')

v31.1
- Settings is now iPhone-style: categories list -> sub-pages, back button, search, profile card (css/09-settings-ios.css, js/07).
- Duplicate review: Admin can now Merge duplicate STOCK items and CUSTOMERS (pick kept record, choose each value, reason required).
  Every merge is logged first and can be undone from "Merge log". Settings -> Data cleanup opens it.

v31.2 - Liquid Water Glass on the whole app (css/08 section 6 + js/13)
- Water-light background, glass header/cards/tiles/buttons/fields/sheets/toasts, accent-aware.
- Sliding liquid indicator on the app's own tabs (.sub-tabs, .tt23-tabs, .ttx-tabs); no app code changed.
- Blur only on big surfaces; list rows use cheap gradient glass. Aurora animates only on desktop.
- Fix: login-guard functions renamed (ttLoginGuard*) - they clashed with the app-lock PIN function.

v31.3
- Settings: every page now opens in the same fixed-size sheet (no small/medium/big pages).
- Day theme: profile menu and sheets use dark letters on light glass (white-text safety net added).

v31.4
- Find photo fixed: private shop codes (CAT-/VST-/MFD-/MFC-/MNL-xxxx) and sizes (10L, 500ml) are no longer treated as model numbers;
  brand is read from the category (Mafra, Maniac, Maxshine, Vista); score works for products without a model number;
  2-pass search (default model, then Pro with a looser prompt). With the gateway deployed, product pages are read server-side
  (og:image) so real photos are found even when the AI gives no direct image link.
- functions/index.js is now ONE function "api" with routes /ai and /og-image. Gateway URL = the function URL (no /ai at the end).
- Settings > Data cleanup > "Sync master catalog to cloud": adds missing master items/customers to the live cloud, never overwrites.
- The old "Load master catalog" action (replaces ALL stock) now shows a clear warning.

v32 - Liquid Motion (css/10-liquid-motion.css + js/13-liquid-glass.js)
- Tab open: direction-aware liquid slide, staggered cards, glass veil + water ring from the tapped tab. switchTab is only wrapped (same result, same timing).
- Bottom nav: readable in day theme (dark labels on frosted glass), liquid blob that stretches between tabs, spring icons, tap ripple.
- Quick-action FAB: glass orb with breathing + squish, droplet menu that springs out and folds back, blurred scrim.
- Glass effects mode (Settings > Look & Feel): Auto / Full / Lite. Auto switches to Lite by itself on slow phones.

v33
- Pop-ups (orders, leads, service, every sheet): the whole page behind is blurred (22px) and the card is opaque glass, so page text can no longer be read through it.
  (A card inside a blurred overlay cannot blur by itself, so the overlay carries the blur.)
- Pop-up contents settle in one by one when it opens.
- Profile menu: melts out of the avatar, every line springs in one after another, folds back on close, soft blurred scrim behind it.

v34
- Ledger: search bar at the top (customer, invoice no., phone, amount, date; several words work together). Filters the cards already drawn,
  nothing in the ledger code/data changes. Typing while "Due only"/"Paid only" is on searches the whole ledger.
- Quick-action orb: your TTESPL logo (swoosh + TTESPL) in the centre; full company name ring spins FAST while the menu is open and slows down gently after closing.
- assets/ttespl-logo.png (full logo) and assets/ttespl-logo-mark.png (the version used in the orb, no tagline).

v35
- Office Hub pages (Tasks, Follow-ups, Purchase, Attendance, Duplicate review...) always open at the same fixed size; content scrolls inside (css/11-v35-fixes.css).
- Profile menu: page behind is blurred and untouchable; tapping outside just closes the menu.
- Home tiles are tappable: Today's Cash & Received -> today's ledger, Pending Dues -> all due bills, Service Schedules -> Services, Stock -> Stock.
- Bulk Ledger Import (js/08): manual entry grid with Add row / +5 rows / Copy last row, Paste from Excel, CSV import + template, validation and duplicate check before save.
- New Order: after choosing a customer, their latest 3 orders (id, date, amount, status, due) show below, with a warning if the last one was within 7 days (js/15-v35-fixes.js).
- No existing function, formula or data was changed.

v36
- Drop-down lists (customer, product, machine, part, quotation items) are now fully solid, always on top of the fields/cards below, and always open right under their own input
  (or above it when there is no room). Fixes letters showing through each other and the list opening in the wrong place inside glass pop-ups.
  css/12-v36-dropdown.css + js/16-v36-dropdown.js (layout only, no data/function/formula changed).

v37 - GST lookup like Tally (js/08, functions/index.js)
- Typing a valid 15-character GSTIN now fetches name + address automatically (button stays as retry).
- Look-up order: customer already saved in the ERP (free) -> device cache (free, each GSTIN is fetched only once) -> secure gateway route /gst -> device key to AppyFlow.
- Every answer is checked: different GSTIN returned, address of another state, or the provider's own demo company ("AppyFlow Technologies, Ludhiana") is REJECTED, never filled in.
- Gateway setup for /gst: firebase functions:secrets:set GST_API_KEY   then   firebase deploy --only functions
  (same gateway URL as AI; key stays on the server, only signed-in staff can call it).

v38 - second GST provider: gstinapi.in (free signup, 75 lookups, no card). Key starting with "gak_" is detected automatically
  (device key: Settings -> Customers & Service -> GST key; or server: firebase functions:secrets:set GST_API_KEY). AppyFlow key still works.

v39 - GST lookup server on Cloudflare Workers (free, no card). Browsers block calling gstinapi.in directly (CORS = "Failed to fetch"),
  so worker/gst-worker.js (in the separate worker folder) relays the call. ERP: Settings -> Customers & Service -> "GST lookup server" (URL + password).
  NOTE: the ERP uses its own login (no Firebase Auth), so the Firebase gateway /gst route cannot verify a user token; the Worker uses a shared password instead.

v40 - Ledger > Edit (admin): ON/OFF "Show customer's previous pending due on this bill" (js/17-v40-prevdue.js, small block in index.html).
  ON: amount is auto-filled with the customer's older pending dues (editable), saved on the bill as prevDueOn/prevDueAmt.
  The invoice then shows one extra line under "Received / Balance Due": "Previous Due ... Total Outstanding ...". OFF = invoice identical to before.
  Bill total / received / due, ledger totals and dashboard are untouched (no double counting).
