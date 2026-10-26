v43.1 - Online Bill Link + Customer Portal + Tally Export
 NEW FILES: view.html, js/30-v43-public.js, js/31-v43-tally.js   (changed: index.html, live-sync.js, js/26, js/29, sw, 18-v41-core, firestore rules)
 - WhatsApp sheet: "Bill Link" (ek bill ka page) aur "Account Link" (customer ke saare bills + total pending + UPI QR). Link customer ko wa.me se jata he.
 - Page par: bill, GST breakup, payments, Pay-with-UPI button + QR, Print/PDF, "sample bill - not original GST" note. Payment aane par page khud update hota he.
 - Profile menu > Shared Links: sab links ki list, Copy, Stop (turant band).
 - Profile menu > Export to Tally: Masters.xml + Vouchers.xml (Sales/Receipt/Purchase/Payment) + CSV daybook.
 - ZAROORI: Firestore rules me public_bills / public_portals ka rule publish karna (firestore.rules.secure ya .example ki aakhri 2 lines).

v43.0 (v42.10) - message fix + Order PDF + Profit GST toggle
 - Payment message: jab tak payment mili nahi, "Payment received - thank you" nahi jayega. Due ho aur kuch paid na ho to "Payment reminder" (pending amount + QR).
   Payment mili ho to thank-you (amount + baki pending/cleared).
 - Pending/undelivered order ka bhi "Send Order (PDF)" (sample-copy note ke saath); delivered par "Send Bill (PDF)".
 - Orders aur Ledger ke opened card ke Profit report me "Without GST / With GST" toggle (yaad rehta he).

v42.9 - Bill + Money Receipt PDF on WhatsApp
 - Customer message sheet (order place / delivery / payment / Ledger) me ab: "Send Bill (PDF)" (sirf Delivered order) aur
   "Send Money Receipt (PDF)" (payment ho to; kai payment hon to list se chuno, default latest).
 - Bill PDF ke har page ke top par red note: "NOT the original GST invoice - app-generated sample bill - call/message Authorized person".
 - Share sheet se WhatsApp + customer chunna padta he (WhatsApp link se file attach nahi hoti). Fallback: PDF save + wa.me.
 - Sab manual, kuch bhi apne aap nahi jata.

v42.8 - UPI QR share
 - QR dialog (Scan & Pay) me ab "Share QR" button: QR + amount + UPI ID ka PNG banke seedha share (screenshot ki zarurat nahi).
 - WhatsApp customer message sheet me "Attach UPI QR for pending Rs X" (due ho tabhi, default ON). ON ho to share sheet khulta he
   (message text + QR image), WhatsApp aur customer chuno. OFF ho to purana direct wa.me text link.
 - Note: wa.me link se image attach nahi hoti, isliye QR ke saath phone ka share sheet aata he.

v42.7 - Ledger (delivered bills) now has the customer WhatsApp update too: open a bill card in Ledger > '📲 WhatsApp update to customer' (Delivered / Payment / Placed / Out for delivery messages). Button stays after filter / search / refresh. Cache v427

v42.6 - CUSTOMER WHATSAPP UPDATES (manual): order placed / out for delivery / delivered / payment received messages. A sheet opens after a new order, after delivery and after collecting a payment (Send on WhatsApp / Copy / Not now);
  also '📲 Update' on every pending order (opens 'Out for delivery') and a button on the Ledger detail page. Message has Order ID, items, courier charges, total, payment status (received / due / partly paid + pending), 'will be delivered soon' line and 'Thank you - TTESPL, Bhubaneswar'.
  Nothing is sent by itself - it only opens WhatsApp with the customer's number. Cache v426.

v42.5 - PURCHASE BILL drop-down fix: product / supplier / category suggestions now use the same solid box as the Order form (no more browser list that was sometimes transparent, sometimes solid).
  Catalog Equipment (read-only catalog) items no longer appear or match in the purchase bill - only real stock items, so no double entries. Cache name v425, ?v=425

v42.4 - v42.3 (your bug-list fixes) + PURCHASE BILL ENTRY merged. Cache name v424, ?v=424
  PURCHASE BILL: Stock tab > '🧾 Purchase Bill' (and Profile > Work & Team > Purchase Bill). Supplier, bill no, date, items (name / qty / rate ex-GST / disc / GST%) - on Save the stock of every item goes up;
    an item not in stock is created as a new item; cost (dealer) price is updated from the bill (switch on the form); GST table, round-off, supplier payments, bill photo; Admin delete = stock goes back.
    Cloud collection: purchase_bills  ->  publish the new firestore.rules.secure if you use Secure mode (it has the purchase_bills line), redeploy functions (daily backup list has it too).

v42.3 - BUG LIST FIXES
  functions (redeploy: cd functions && firebase deploy --only functions):
    - Login lock is now per phone/IP + number (5 wrong = 5 min) plus a wide limit per number (40 wrong = 15 min). A stranger can no longer keep a staff member locked out.
    - Photo-finder (/og-image) checks the address at connect time (no DNS tricks) and blocks 100.64/10, 198.18/15, multicast, IPv4-mapped IPv6.
  rules (publish only with Secure mode ON):
    - firestore.rules.secure: staff cannot change total / items of a DELIVERED bill (Admin can). Payments, photos, bill number still work. Test: collect a due payment as staff after publishing.
    - storage.rules.secure (new): uploads need sign-in. storage.rules stays for Secure mode OFF.
  app:
    - Missing prices: typed prices are kept when you search, change page or switch Rate/Cost; Save saves all pages.
    - Free-text order lines in one save get different ids.
    - Service worker uses SDK 12.19.0 like the page (falls back to 10.12.2). Cache name v421 everywhere. Cache version ?v=422

v42.2 - FIXES + MERGE + DELETE
  FIX: customer naam me ' (jaise Gugu's Auto) ho to order form ki suggestion list me touch karne par kuch nahi hota tha (list nila atak jati thi). Ab theek (ttEnc). Machine / part / quotation list me bhi.
  MERGE: Customer > Edit > Merge another customer > Save ke baad poochta hai: purane customer ke bills / leads / services naye (main) naam + number par le aao? Haan karo to
         Ledger me un bills par "Merged from ... - update needed" warning aati hai. Admin "Updated" dabaye ya Ledger me bill edit karke Save kare to warning hat jati hai.
  DELETE: Customer card par Admin ko 🗑️ button (Recycle bin me copy, bills delete nahi hote).
  Cache version ?v=421

v42.1 - UI: profile menu ab 4 sections me (Sales & Reports / Work & Team / Admin & Data / Preferences) + search + quick tiles + Logout; tab badalna ab 0.24s ka ek halka slide (pehle ~1s, blur veil + water wave hata diya); popup ko header se neeche swipe karke band karo; 'saved' jaise message ab toast me; Ultra smooth mode (profile > Preferences, kam-memory phone par apne aap ON); har tab ka scroll yaad rehta hai.
  FIXES: stock ab negative ja sakta hai (delivery, service call parts, bill edit, stock form) - customer / stock edit ab string id par bhi chalta hai - cache version ?v=420

v42 - GST TABLE + FIXES + OFFICE TOOLS
  ORDER: har item ke saath "GST %" box (shuru me 18) + neeche GST table (rate-wise taxable, CGST/SGST ya IGST). Kapde jaise item ka rate badal sakte ho;
         stock item me GST % set karoge to us item ko chunte hi wahi rate aata hai. Invoice, GST report aur Profit&Loss isi rate se chalte hain. Switch: Settings > Invoice & GST.
  FIXES: A1 delivery par same-naam wale stock me galat item nahi katta - A2 customer rename par purane bills ka naam badalne ka option - A3 Missing prices (rate / cost) bulk edit
         A4 decimal stock - A5 stock CSV export safe - A6 ledger edit par "Admin adjustment" line - A7 delivered bill edit par stock sudhar - A9 Security status
         A10 bache hue unescaped text - A11 phone storage warning - A12 Customer data check (no phone / same phone / same name)
  OFFICE TOOLS (Settings > Office Tools): Collection list, Daily summary (+ 8 baje notification, functions deploy chahiye), Staff targets, Delivery challan, Price list share,
         Barcode labels (Code 39), E-way bill JSON (DRAFT - portal par check karo), auto service reminder after machine delivery.
  CUSTOMERS & CREDIT: customer ka personal credit limit, customer documents (photo / chhota PDF), card par Statement button.
  Pehle se maujood tha (dobara nahi banaya): Quotation -> Order, Goods receipt se stock, Expense approval.

v41.6 - CUSTOMER CONTACTS
  - Customer > Edit me "More contacts": ek customer ke neeche bahut saare contact (naam, role, phone, email), "Merge another customer" button (dusre customer ka naam/phone/email contact bankar aa jata hai, Save dabane par pakka hota hai, purana record chaho to hata sakte ho - Recycle bin me copy rehti hai).
  - Order form me customer ab kisi bhi contact ke number / naam se mil jata hai. Customer card par contacts ke call / WhatsApp chip.
  - Statement me merge kiye hue customer ke purane bills bhi judte hain.
  - FIX: Customer form me Email aur Contact Person pehle save hi nahi hote the - ab hote hain.
  - Customer save par same phone dusre customer ka ho to chetavni.

v41.5 - BILL NUMBER FIX
  - Cache version ?v=414 (purane files phone me atke na rahein), service worker ab har baar server se naya file check karta hai.
  - Bill number counter 'counters' collection me banta hai; agar aapke Firebase rules wo refuse karein to app apne aap 'office_config' me counter banata hai.
  - Number na bane to ab saaf message dikhta hai, aur Settings > Invoice & GST > Bill number status me pending / agla number / problem dikhta hai + Retry.
  - Purane delivered bills ka number ORD-xxx hi rehta hai (naye deliver hue bills ko TTESPL-101 / TT-101 milta hai).

v41.4 - Delivery photo, Payment photo (delivery ke time) aur Collect Due payment photo - teeno me pehli photo ke baad "Add another photo (optional)".
  Delivery: total 3 photo, Payment: total 3 photo. Photo par X dabake hata sakte ho. Ledger Details me Photo 2 / Photo 3 ke button dikhte hain.

v41.3 - DELIVERY + BILL NUMBER
  - "Deliver & Upload Proof" screen me ab: (1) Invoice details (Delivery Note, Reference, Other Ref, Buyer's Order No./Date, Dispatch Doc,
    Delivery Note Date, Dispatched through, Destination, Terms of Delivery) - ye bill ke right side me print hote hain;
    (2) "Payment received now?" - amount likhte hi payment photo ka box apne aap aata hai (photo zaroori), mode chuno, "Full due amount" button;
    (3) Bill number apne aap.
  - Bill number: GST wale customer ko TTESPL-101, 102...  Non-GST customer ko TT-101, 102...  Number delivery par milta hai, kabhi repeat nahi hota
    (sab phone ke liye ek cloud counter). Internet na ho to delivery ho jati hai aur number internet aate hi apne aap lag jata hai.
    Prefix aur start number Settings > Invoice & GST me badal sakte ho. Purane bills ka number (ORD-xxx) waisa hi rahta hai.
  - Invoice details baad me Admin Edit Ledger screen me bhi badal sakte ho.
  - Ledger card, search, WhatsApp text, receipts me naya bill number dikhta hai.
  - Ledger search chalu ho to saare matching bills dikhte hain (sirf pehle 50 nahi).

v41.2 - Settings ke saare naye categories ko rangeen iPhone-style icon + chhota subtitle mila (grey gear hata).

v41.1 - UI UPDATE
  - Orders / Leads / Services / Ledger cards ab chhote (1-2 line) hain: naam, staff, date, amount, status. Card par tap karo = poori detail + buttons
    smooth khulte hain, dobara tap = band. Khula/band halat live update ke baad bhi yaad rehti hai.
  - Khule Order / Ledger card me Profit report (Sale, Cost, Profit Rs, Margin %, Markup %) - sirf Admin ko, P&L wale same formula se (ex-GST, Dealer price = cost).
  - Naye order me item add hote hi agla khali item row apne aap aata hai.
  - Order item me MRP / Disc / Rate se up-down arrows hata diye (Quantity me rehte hain). Mouse wheel se value badalna band.
  - Smooth mode: card / chip / background ka bhaari blur band, taaki phone aur PC dono par scroll halka chale.
  - Settings > Look & Speed me 4 switch: Compact cards, Smooth mode, Auto next item row, Profit report.
  - FIX: 50 se zyada cards wali list (Ledger / Orders) me "Show more" button se loop ban sakta tha - theek kar diya.

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
