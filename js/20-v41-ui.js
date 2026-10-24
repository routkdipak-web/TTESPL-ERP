/* TTESPL ERP v41 - UI MODULE
   1) Orders / Leads / Services / Ledger cards: small 1-2 line card, tap to open all details, tap again to close (smooth)
   2) Profit mini report inside opened Order / Ledger cards (Admin only, same formula as Profit & Loss)
   3) New order: next empty item row appears by itself
   4) Smooth mode (lighter effects) for desktop + mobile
   Nothing here changes saved data or any calculation. Every part has a switch in Settings > Look & Speed. */
(function () {
  'use strict';
  var V = window.ttV41; if (!V) return;
  var $ = function (id) { return document.getElementById(id); };
  var FEAT = window.ttFeat;
  var D = { compactCards: 1, smoothMode: 1, autoNextRow: 1, profitOnCards: 1 };
  Object.keys(D).forEach(function (k) { V.DEFAULTS[k] = D[k]; if (FEAT && FEAT.get(k) === undefined) FEAT.set(k, D[k]); });
  var F = V.F;
  var H = function (s) { return window.ttEscHtml(s); };
  var N = function (x) { return Number(x) || 0; };
  var inr = function (n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  var inr2 = function (n) { return (N(n) < 0 ? '-' : '') + '₹' + Math.abs(N(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  /* ---------- settings category ---------- */
  var prev = window.ttModSettings;
  window.ttModSettings = function (sw, group) {
    var r; try { r = prev ? prev(sw, group) : ''; } catch (e) { console.warn(e); }
    var rows = [sw('compactCards', 'Compact cards (tap to open)', 'Orders, Leads, Services and Ledger show a short card; tap it to open all details and buttons'),
      sw('smoothMode', 'Smooth mode (lighter effects)', 'Removes the heavy blur on every card and background glow so scrolling is fast and cool on phone and PC'),
      sw('autoNextRow', 'Auto next item row in new order', 'When an item is added, a fresh empty item row appears by itself')];
    if (V.isAdm()) rows.push(sw('profitOnCards', 'Profit report inside opened bill (Admin)', 'Shows sale, cost, profit ₹ and margin % on opened Order / Ledger cards. Uses the Dealer / Cost price of each item'));
    group('🎨 Look & Speed (on / off)', rows);
    return r;
  };
  var oSet = window.ttSetOpt;
  window.ttSetOpt = function (k, v) {
    var r = oSet ? oSet.apply(this, arguments) : undefined;
    if (k === 'smoothMode') applySmooth();
    if (k === 'compactCards' || k === 'profitOnCards') rerender();
    return r;
  };
  function applySmooth() { document.documentElement.classList.toggle('tt-smooth', !!F('smoothMode')); }
  applySmooth();
  function rerender() {
    try { renderOrders(); } catch (e) {} try { renderLeads(); } catch (e) {} try { renderServices(); } catch (e) {} try { renderBilling('all'); } catch (e) {}
  }

  /* ---------- profit (same rule as Profit & Loss: dealer price = cost, ex-GST basis) ---------- */
  var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); };
  function aliasMap() {
    var m = {};
    try { var r = window.ttx && window.ttx.byId('OFFICE_CFG', 'pnl_aliases'); ((r && Array.isArray(r.list)) ? r.list : []).forEach(function (a) { if (a && a.n && a.id != null) m[a.n] = a.id; }); } catch (e) {}
    return m;
  }
  function profitOf(o) {
    var inv = (typeof sampleInventory !== 'undefined' && sampleInventory) || [], byId = {}, byName = {}, byCode = {}, al = aliasMap(), f = 1 / 1.18;
    inv.forEach(function (p) { byId[String(p.id)] = p; var n = norm(p.name); if (n && !byName[n]) byName[n] = p; if (p.code) { var c = norm(p.code); if (!byCode[c]) byCode[c] = p; } });
    var sale = 0, cost = 0, unp = 0, tot = 0;
    (o.items || []).forEach(function (it) {
      var a = al[norm(it.name)], p = (a != null && byId[String(a)]) || byId[String(it.id)] || byName[norm(it.name)] || (it.code ? byCode[norm(it.code)] : null);
      var qty = N(it.qty), t = N(it.total) || (qty * N(it.rate)), unit = p ? N(p.dealerPrice) : 0;
      tot += t;
      if (unit > 0) { sale += t * f; cost += unit * qty * f; } else unp++;
    });
    var profit = sale - cost;
    return { sale: sale, cost: cost, profit: profit, margin: sale > 0 ? profit / sale * 100 : 0, markup: cost > 0 ? profit / cost * 100 : 0, unp: unp, n: (o.items || []).length };
  }
  function profitHtml(o) {
    var P = profitOf(o);
    if (!P.n) return '';
    if (P.sale <= 0) return '<div class="tt41-pf"><h6>💹 Profit report</h6><p>Cost price is not set for ' + (P.unp || 'these') + ' item(s). Set “Dealer / Cost price” in Stock to see profit.</p></div>';
    var neg = P.profit < 0, c = neg ? 'negc' : 'pos';
    return '<div class="tt41-pf' + (neg ? ' neg' : '') + '"><h6>💹 Profit report <span>ex-GST</span></h6><div class="tt41-pfg">' +
      '<div><small>Sale</small><b>' + inr2(P.sale) + '</b></div><div><small>Cost</small><b>' + inr2(P.cost) + '</b></div><div><small>Profit</small><b class="' + c + '">' + inr2(P.profit) + '</b></div>' +
      '<div><small>Margin</small><b class="' + c + '">' + P.margin.toFixed(1) + '%</b></div><div><small>Markup</small><b class="' + c + '">' + P.markup.toFixed(1) + '%</b></div><div><small>Items</small><b>' + P.n + '</b></div></div>' +
      (P.unp ? '<p>⚠ ' + P.unp + ' item(s) without cost price are not counted.</p>' : '') + '</div>';
  }

  /* ---------- compact cards ---------- */
  var KINDS = { ordersListContainer: 'order', leadsListContainer: 'lead', serviceListContainer: 'service', billingListContainer: 'ledger' };
  var ID_RE = /(?:editOrderPrompt|editLeadPrompt|editServicePrompt|openAdminEditLedgerModal|openLedgerDetail|openDeliveryProofModal|cancelOrderAction|deleteOrderAction|deleteLeadAction|deleteServiceAction|openInstallationReportModal|openInstallationReportView|openExecuteServiceModal|openServiceReportModal|collectDuePayment)\('([^']+)'/;
  var OPEN = {};   // remembers which cards are open when the list is redrawn by a live update
  function rec(kind, id) {
    var list = kind === 'lead' ? (typeof leadsData !== 'undefined' ? leadsData : []) : kind === 'service' ? (typeof serviceCallsData !== 'undefined' ? serviceCallsData : []) : (typeof ordersData !== 'undefined' ? ordersData : []);
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function chip(t, c) { return '<span class="tt41-chip' + (c ? ' ' + c : '') + '">' + t + '</span>'; }
  function summary(kind, r) {
    if (!r) return '';
    if (kind === 'order') {
      var due = N(r.dueAmount), items = (r.items || []).length;
      return chip('₹ ' + N(r.totalAmount).toLocaleString('en-IN')) + (r.status === 'Cancelled' ? chip('🚫 Cancelled', 'd') : (due > 0 ? chip('Due ' + inr(due), 'd') : chip('Paid', 'o'))) + chip('📦 ' + items + ' item' + (items === 1 ? '' : 's')) + (r.status === 'Pending' && r.deliveryDate ? chip('🚚 ' + H(r.deliveryDate)) : '');
    }
    if (kind === 'ledger') {
      var d2 = N(r.dueAmount);
      return chip('👤 ' + H(r.bookedBy || '—')) + chip('₹ ' + N(r.totalAmount).toLocaleString('en-IN')) + chip('Recv ' + inr(r.recvAmount), 'o') + (d2 > 0 ? chip('Due ' + inr(d2), 'd') : chip('Paid', 'o')) + (d2 > 0 && r.payFollowupDate ? chip('📅 ' + H(r.payFollowupDate), 'w') : '');
    }
    if (kind === 'lead') return chip('🛠 ' + H(r.machine || '—')) + chip('Quoted ' + inr(r.quotedPrice)) + (r.followupDate ? chip('📞 ' + H(r.followupDate), 'w') : '');
    if (kind === 'service') return chip('🛠 ' + H(r.machine || '—')) + (r.problem ? chip('⚠ ' + H(String(r.problem).slice(0, 40)), r.status === 'Work Completed' ? '' : 'w') : '');
    return '';
  }
  function setOpen(card, open, instant) {
    if (instant) { card.classList.add('tt41-noanim'); }
    card.classList.toggle('open', open);
    var h = card.querySelector(':scope > .tt41c-head'); if (h) h.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) fillProfit(card);
    if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.remove('tt41-noanim'); }); });
  }
  function fillProfit(card) {
    var slot = card.querySelector('.tt41-pf-slot'); if (!slot || slot.__done) return;
    slot.__done = 1;
    try { if (F('profitOnCards') && V.isAdm()) { var o = rec('order', card.getAttribute('data-id')); if (o) slot.innerHTML = profitHtml(o); } } catch (e) { console.warn('profit', e); }
  }
  function compactCard(card, kind, idx) {
    if (card.__t41 || !card.classList || !card.classList.contains('card')) return;
    var head = card.firstElementChild; if (!head || !head.classList.contains('card-header')) return;
    var m = ID_RE.exec(card.innerHTML), id = m ? m[1] : '';
    var key = kind + ':' + (id || ('#' + idx)), r = id ? rec(kind, id) : null;
    var right = head.lastElementChild && head.lastElementChild !== head.firstElementChild ? head.lastElementChild : head;
    var act = document.createElement('div'); act.className = 'tt41-act';
    [].slice.call(head.querySelectorAll('button')).forEach(function (b) { act.appendChild(b); });
    var bw = document.createElement('div'), bi = document.createElement('div'); bw.className = 'tt41-bw'; bi.className = 'tt41-bi'; bw.appendChild(bi);
    bi.appendChild(act);
    while (head.nextSibling) bi.appendChild(head.nextSibling);
    if (r && (kind === 'order' || kind === 'ledger')) { var slot = document.createElement('div'); slot.className = 'tt41-pf-slot'; bi.appendChild(slot); }
    var sw = document.createElement('div'); sw.className = 'tt41-sw'; sw.innerHTML = '<div class="tt41-si"><div class="tt41-sum">' + summary(kind, r) + '</div></div>';
    var chev = document.createElement('span'); chev.className = 'tt41-chev'; chev.setAttribute('aria-hidden', 'true'); chev.textContent = '▾'; right.appendChild(chev);
    head.classList.add('tt41c-head'); head.setAttribute('role', 'button'); head.setAttribute('tabindex', '0'); head.setAttribute('aria-expanded', 'false');
    card.classList.add('tt41c'); card.setAttribute('data-k', key); if (id) card.setAttribute('data-id', id);
    card.appendChild(sw); card.appendChild(bw); card.__t41 = 1;
    if (OPEN[key]) setOpen(card, true, true);
  }
  function compactAll(c) {
    if (!c || !F('compactCards')) return;
    var kind = KINDS[c.id]; if (!kind) return;
    var i = 0; [].forEach.call(c.children, function (card) { try { compactCard(card, kind, i++); } catch (e) { console.warn('compact', e); } });
  }
  function toggle(card) {
    var open = !card.classList.contains('open'), k = card.getAttribute('data-k');
    if (k) { if (open) OPEN[k] = 1; else delete OPEN[k]; }
    setOpen(card, open, false);
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var h = t.closest('.tt41c-head, .tt41-sw'); if (!h) return;
    if (t.closest('button, a, input, select, textarea, label')) return;
    var card = h.closest('.tt41c'); if (!card) return;
    e.stopPropagation(); e.preventDefault(); toggle(card);
    try { if (window.triggerAppHaptic) triggerAppHaptic(); } catch (x) {}
  }, true);
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('tt41c-head')) { e.preventDefault(); toggle(e.target.parentNode); }
  });

  var obs = null;
  function watch() {
    if (obs) return;
    obs = new MutationObserver(function (recs) {   // runs before the browser paints, so the big card is never seen
      var seen = {}; recs.forEach(function (r) { var t = r.target; if (t && t.id && KINDS[t.id] && !seen[t.id]) { seen[t.id] = 1; compactAll(t); } });
    });
    var any = false;
    Object.keys(KINDS).forEach(function (id) { var c = $(id); if (c) { any = true; obs.observe(c, { childList: true }); compactAll(c); } });
    if (!any) obs = null;
  }
  document.addEventListener('DOMContentLoaded', function () { watch(); setTimeout(watch, 1200); });
  if (document.readyState !== 'loading') { watch(); setTimeout(watch, 1200); }

  /* ---------- new order: next empty item row by itself ---------- */
  function lastRow() { var tb = $('orderItemsTbody'); return tb ? tb.lastElementChild : null; }
  function addIfNeeded(row) {
    if (!F('autoNextRow') || !row || row !== lastRow() || typeof addOrderItemRow !== 'function') return;
    var name = (row.querySelector('.item-product-input') || {}).value;
    if (!name || !name.trim()) return;
    var rate = parseFloat((row.querySelector('.item-rate') || {}).value) || 0;
    if (rate > 0) { addOrderItemRow(); }
  }
  (function () {
    var o = window.selectOrderItemSuggestion; if (typeof o !== 'function') return;
    window.selectOrderItemSuggestion = function (el) {
      var row = el && el.closest ? el.closest('tr') : null, r = o.apply(this, arguments);
      try { addIfNeeded(row); } catch (e) { console.warn(e); }
      return r;
    };
  })();
  document.addEventListener('change', function (e) {   // typed item + rate entered by hand
    var t = e.target; if (!t || !t.closest || !t.closest('#orderItemsTbody')) return;
    if (t.classList.contains('item-rate') || t.classList.contains('item-qty') || t.classList.contains('item-mrp') || t.classList.contains('item-product-input')) { try { addIfNeeded(t.closest('tr')); } catch (x) {} }
  });
  /* mouse wheel must scroll the page, not change a number you just clicked in */
  document.addEventListener('wheel', function (e) { var t = e.target; if (t && t.type === 'number' && document.activeElement === t) t.blur(); }, { passive: true });
})();
