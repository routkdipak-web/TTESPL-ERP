/* TTESPL ERP module: 12-ai-copilot-insights.js */
/* ===== v30 · Business Copilot (deterministic tools + optional AI routing/explanation), Insights, Reports, Actions ===== */
(function () {
  'use strict';
  var X = window.ttx, H = X.H, ai = window.ttai, inr = X.inr, r2 = X.r2, ymd = X.ymd;
  function arr(n) { try { var v; switch (n) { case 'ordersData': v = ordersData; break; case 'leadsData': v = leadsData; break; case 'sampleInventory': v = sampleInventory; break; case 'quotationsData': v = quotationsData; break; default: v = window[n]; } return Array.isArray(v) ? v : []; } catch (e) { return Array.isArray(window[n]) ? window[n] : []; } }
  function N(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function dOf(o) { try { return ttDateOf(o); } catch (e) { return String(o.deliveredDate || o.orderDate || '').slice(0, 10); } }
  var ADM = function () { return X.isAdm(); };
  /* ---------- authorised, de-duplicated data ---------- */
  function orders() { var seen = {}, me = X.me(); return arr('ordersData').filter(function (o) { if (!o || o.status === 'Cancelled' || o.status === 'Void' || o.status === 'Voided' || o.deleted) return false; var k = String(o.id); if (seen[k]) return false; seen[k] = 1; return ADM() || o.bookedBy === me; }); }
  function leads() { var me = X.me(); return arr('leadsData').filter(function (l) { return l && (ADM() || l.handledBy === me); }); }
  function quotes() { var me = X.me(); return arr('quotationsData').filter(function (q) { return q && (ADM() || q.createdBy === me); }); }
  function inv() { return arr('sampleInventory'); }
  /* ---------- periods ---------- */
  var MN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function iso(d) { return ymd(d); }
  function mrange(y, m) { return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: new Date(y, m, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' }) }; }
  function shiftMonth(p, k) { var d = new Date(p.from + 'T00:00:00'); return mrange(d.getFullYear(), d.getMonth() + k); }
  function parsePeriod(q) {
    q = String(q || '').toLowerCase(); var now = new Date(), y = now.getFullYear(), m = now.getMonth(), p, assumed = false;
    var mm = new RegExp('\\b(' + MN.join('|') + ')[a-z]*\\.?\\s*(\\d{4})?').exec(q);
    if (/this month|is mahine|current month/.test(q)) p = mrange(y, m);
    else if (/last month|pichle mahine|previous month/.test(q)) p = mrange(y, m - 1);
    else if (/today|aaj/.test(q)) p = { from: iso(now), to: iso(now), label: 'Today' };
    else if (/yesterday|kal\b/.test(q)) { var yd = new Date(now.getTime() - 864e5); p = { from: iso(yd), to: iso(yd), label: 'Yesterday' }; }
    else if (/last 7|this week|7 days/.test(q)) p = { from: iso(new Date(now.getTime() - 6 * 864e5)), to: iso(now), label: 'Last 7 days' };
    else if (/last 30|30 days/.test(q)) p = { from: iso(new Date(now.getTime() - 29 * 864e5)), to: iso(now), label: 'Last 30 days' };
    else if (/last year|pichle saal/.test(q)) p = { from: (y - 1) + '-01-01', to: (y - 1) + '-12-31', label: String(y - 1) };
    else if (/this year|is saal/.test(q)) p = { from: y + '-01-01', to: iso(now), label: 'Year ' + y + ' to date' };
    else if (mm) { var yy = mm[2] ? +mm[2] : (MN.indexOf(mm[1]) > m ? y - 1 : y); p = mrange(yy, MN.indexOf(mm[1])); }
    else { p = mrange(y, m); assumed = true; }
    p.assumed = assumed;
    if (/\bmonth\b|mahine|^$/.test(p.label) || /^[A-Z][a-z]+ \d{4}$/.test(p.label)) p.prev = shiftMonth(p, -1);
    else { var a = new Date(p.from + 'T00:00:00'), b = new Date(p.to + 'T00:00:00'), n = Math.round((b - a) / 864e5) + 1, pe = new Date(a.getTime() - 864e5), ps = new Date(pe.getTime() - (n - 1) * 864e5); p.prev = { from: iso(ps), to: iso(pe), label: 'Previous ' + n + ' day(s)' }; }
    return p;
  }
  function inP(d, p) { return d && d >= p.from && d <= p.to; }
  /* ---------- deterministic metrics ---------- */
  function salesIn(p) {
    var os = orders().filter(function (o) { return o.status === 'Delivered' && inP(dOf(o), p); }), tot = 0; os.forEach(function (o) { tot += N(o.totalAmount); });
    return { count: os.length, total: r2(tot), avg: os.length ? r2(tot / os.length) : 0, orders: os };
  }
  function bookedIn(p) { var os = orders().filter(function (o) { return o.status !== 'Delivered' && inP(String(o.orderDate || '').slice(0, 10), p); }), t = 0; os.forEach(function (o) { t += N(o.totalAmount); }); return { count: os.length, total: r2(t) }; }
  function topProducts(os, k) { var m = {}; os.forEach(function (o) { (o.items || []).forEach(function (it) { var n = String(it.name || '').trim(); if (!n) return; m[n] = m[n] || { name: n, qty: 0, amt: 0 }; m[n].qty += N(it.qty); m[n].amt += N(it.total); }); }); return Object.keys(m).map(function (n) { m[n].amt = r2(m[n].amt); return m[n]; }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, k || 5); }
  function dueNow() { var os = orders().filter(function (o) { return N(o.dueAmount) > 0.005; }), t = 0; os.forEach(function (o) { t += N(o.dueAmount); }); var by = {}; os.forEach(function (o) { by[o.customerName] = (by[o.customerName] || 0) + N(o.dueAmount); }); return { count: os.length, total: r2(t), top: Object.keys(by).map(function (k) { return { name: k, due: r2(by[k]) }; }).sort(function (a, b) { return b.due - a.due; }).slice(0, 5) }; }
  function lowStock() { var th = 5; try { th = Number(ttFeat.get('lowThreshold')) || 5; } catch (e) {} var cat = {}; try { cat = (function () { return {}; })(); } catch (e) {} return { th: th, items: inv().filter(function (i) { return i && typeof i.stock === 'number' && i.stock <= th && i.category !== 'Catalog Equipment'; }).sort(function (a, b) { return a.stock - b.stock; }) }; }
  function findItems(q) { var t = String(q || '').toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; }); if (!t.length) return []; return inv().filter(function (i) { var s = (String(i.name) + ' ' + String(i.code || '') + ' ' + String(i.machine || '')).toLowerCase(); return t.every(function (w) { return s.indexOf(w) >= 0; }); }).slice(0, 8); }
  /* ---------- tools (whitelist). Each returns {title, lines[], facts{}, period?, assumptions[], actions[]} ---------- */
  var TOOLS = {
    sales: { label: 'Sales', run: function (a) {
      var p = a.period, s = salesIn(p), pv = salesIn(p.prev), b = bookedIn(p), L = [];
      L.push('Delivered sales (invoice total, by delivery date): ' + inr(s.total) + ' from ' + s.count + ' order(s)');
      L.push('Previous period (' + p.prev.label + '): ' + inr(pv.total) + ' from ' + pv.count + ' order(s)');
      if (pv.total > 0) { var ch = r2((s.total - pv.total) / pv.total * 100); L.push('Change: ' + (ch >= 0 ? '+' : '') + ch + '% (' + (s.total - pv.total >= 0 ? '+' : '−') + inr(Math.abs(r2(s.total - pv.total))) + ')'); } else L.push('Change: cannot be computed — previous period has no delivered sales in the records.');
      L.push('Not yet delivered, booked in this period: ' + inr(b.total) + ' (' + b.count + ' order(s)) — shown separately, not part of sales above');
      return { title: 'Sales — ' + p.label, lines: L, facts: { total: s.total, count: s.count, prevTotal: pv.total, prevCount: pv.count, booked: b.total }, period: p, def: 'Sales = Delivered orders only; Cancelled/voided and duplicate order IDs excluded. Cash received and outstanding are different numbers and are not mixed in.', actions: [{ a: 'open:insights', t: '📈 Open Insights' }] };
    } },
    topProducts: { label: 'Top products', run: function (a) { var s = salesIn(a.period), tp = topProducts(s.orders, 6); return { title: 'Top products — ' + a.period.label, lines: tp.length ? tp.map(function (x, k) { return (k + 1) + '. ' + x.name + ' — qty ' + x.qty + ', ' + inr(x.amt); }) : ['No delivered orders with items in this period.'], facts: { n: tp.length }, period: a.period, def: 'Ranked by invoice line total on delivered orders.' }; } },
    due: { label: 'Outstanding', run: function () { var d = dueNow(); return { title: 'Outstanding payments (today)', lines: ['Total due on non-cancelled orders: ' + inr(d.total) + ' across ' + d.count + ' order(s)'].concat(d.top.map(function (x, k) { return (k + 1) + '. ' + x.name + ' — ' + inr(x.due); })), facts: { total: d.total }, def: 'Outstanding = the dueAmount stored on each non-cancelled order, as of now.', actions: [{ a: 'open:follow-ups', t: '📌 Open Follow-ups' }] }; } },
    lowStock: { label: 'Low stock', run: function () { var l = lowStock(); return { title: 'Low stock (≤ ' + l.th + ')', lines: l.items.length ? l.items.slice(0, 12).map(function (i) { return i.name + ' — ' + i.stock + ' left'; }).concat(l.items.length > 12 ? ['…and ' + (l.items.length - 12) + ' more'] : []) : ['Everything is above the low-stock level.'], facts: { n: l.items.length }, def: 'Uses your Low-stock threshold from Settings. Catalogue-only items are excluded.', actions: [{ a: 'open:low-stock', t: '📉 Open low-stock list' }, { a: 'task:reorder', t: '✅ Create re-order task', write: 1, n: l.items.length }] }; } },
    stockOf: { label: 'Stock of item', run: function (a) { var f = findItems(a.text); return { title: 'Stock lookup', lines: f.length ? f.map(function (i) { return i.name + (i.code ? ' (' + i.code + ')' : '') + ' — ' + i.stock + ' in stock'; }) : ['No inventory item matched "' + a.text + '".'], facts: { n: f.length }, def: 'Direct from the inventory list. Prices are not shown here.' }; } },
    photos: { label: 'Product photos', run: function () { var it = []; try { it = getCatalogItems(); } catch (e) {} var c = { approved: 0, review: 0, none: 0 }; it.forEach(function (i) { var r = window.ttaiImg && window.ttaiImg.rec(i.id); c[r ? (r.status === 'approved' ? 'approved' : r.status === 'review' ? 'review' : 'none') : 'none']++; }); return { title: 'Catalogue photos', lines: [it.length + ' catalogue product(s)', c.approved + ' with an approved photo', c.review + ' waiting for Admin review', c.none + ' without a photo'], facts: c, def: 'Counts from the Product Image records.', actions: [{ a: 'open:image-studio', t: '🖼️ Open Image Studio' }] }; } },
    followups: { label: 'Follow-ups', run: function () { var c = window.ttxFollowCounts ? window.ttxFollowCounts() : null; return { title: 'Follow-ups', lines: c ? ['Overdue: ' + c.overdue, 'Due today: ' + c.today, 'Next 7 days: ' + c.upcoming, 'Snoozed: ' + c.snoozed] : ['Follow-up Centre is switched off.'], facts: c || {}, def: 'From the Follow-up Centre (own items for staff, all for Admin).', actions: [{ a: 'open:follow-ups', t: '📌 Open Follow-ups' }] }; } },
    tasks: { label: 'Tasks', run: function () { var c = window.ttxTaskCounts ? window.ttxTaskCounts() : null; return { title: 'Tasks', lines: c ? ['Open: ' + c.open, 'Overdue: ' + c.overdue] : ['Tasks module is switched off.'], facts: c || {}, def: 'From Employee Tasks.', actions: [{ a: 'open:tasks', t: '✅ Open Tasks' }] }; } },
    quotes: { label: 'Quotations', run: function (a) { var p = a.period, q = quotes().filter(function (x) { return inP(String(x.createdAt || '').slice(0, 10), p); }), t = 0; q.forEach(function (x) { t += N(x.final); }); return { title: 'Quotations — ' + p.label, lines: [q.length + ' quotation(s) created, total quoted value ' + inr(r2(t))], facts: { n: q.length, total: r2(t) }, period: p, def: 'Quoted value is not sales — it only becomes sales once an order is delivered.' }; } },
    orders: { label: 'Orders', run: function (a) { var p = a.period, os = orders().filter(function (o) { return inP(String(o.orderDate || '').slice(0, 10), p); }), by = {}; os.forEach(function (o) { by[o.status || '—'] = (by[o.status || '—'] || 0) + 1; }); return { title: 'Orders booked — ' + p.label, lines: [os.length + ' order(s) booked (cancelled excluded)'].concat(Object.keys(by).map(function (k) { return k + ': ' + by[k]; })), facts: { n: os.length }, period: p, def: 'By order date; cancelled and duplicate IDs excluded.' }; } },
    coOrdered: { label: 'Bought together', run: function (a) {
      var f = findItems(a.text), nm = f[0] ? f[0].name.toLowerCase() : String(a.text || '').toLowerCase().trim(), m = {}, n = 0;
      if (!nm) return { title: 'Bought together', lines: ['Tell me which product, e.g. "which products are ordered with valve kit".'], facts: {} };
      orders().forEach(function (o) { var its = (o.items || []).map(function (i) { return String(i.name || '').toLowerCase(); }); if (its.some(function (x) { return x.indexOf(nm) >= 0 || nm.indexOf(x) >= 0 && x.length > 3; })) { n++; its.forEach(function (x) { if (x && x.indexOf(nm) < 0 && nm.indexOf(x) < 0) m[x] = (m[x] || 0) + 1; }); } });
      var top = Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
      return { title: 'Ordered together with "' + nm + '"', lines: n ? [n + ' order(s) contain it'].concat(top.map(function (x) { return x[0] + ' — together in ' + x[1] + ' order(s)'; })) : ['No orders contain "' + nm + '".'], facts: { n: n }, def: 'Counts of orders where both items appear (all time, non-cancelled).' };
    } },
    customer: { label: 'Customer', run: function (a) { var t = String(a.text || '').toLowerCase().trim(), os = orders().filter(function (o) { return t && String(o.customerName || '').toLowerCase().indexOf(t) >= 0; }), tot = 0, due = 0; os.forEach(function (o) { tot += N(o.totalAmount); due += N(o.dueAmount); }); return { title: 'Customer — ' + (a.text || ''), lines: os.length ? [os.length + ' order(s), invoiced ' + inr(r2(tot)), 'Outstanding: ' + inr(r2(due))] : ['No orders found for "' + a.text + '".'], facts: { n: os.length, total: r2(tot), due: r2(due) }, def: 'Non-cancelled orders matching the name. Open Customer 360° for the full timeline.' }; } }
  };
  /* keyword router (works offline / when AI is off) */
  function route(q) {
    var s = q.toLowerCase(), p = parsePeriod(q), txt = s.replace(/^(.*?)(stock of|stock|of|for|with|ke saath|customer)\s+/i, '').trim();
    if (/photo|image|tasveer|picture/.test(s)) return { tool: 'photos', args: {} };
    if (/together|co-?order|saath|bought with|ordered with/.test(s)) return { tool: 'coOrdered', args: { text: s.replace(/.*(with|saath|together)\s+/, '').replace(/[?.]/g, '') } };
    if (/follow-?up|follow up|reminder/.test(s)) return { tool: 'followups', args: {} };
    if (/\btask|kaam/.test(s)) return { tool: 'tasks', args: {} };
    if (/quotation|quote|quotes/.test(s)) return { tool: 'quotes', args: { period: p } };
    if (/due|outstanding|baaki|pending pay|receivable|udhar/.test(s)) return { tool: 'due', args: {} };
    if (/low stock|reorder|re-order|kam stock|shortage|out of stock/.test(s)) return { tool: 'lowStock', args: {} };
    if (/top|best|most sold|bestsell|popular/.test(s)) return { tool: 'topProducts', args: { period: p } };
    if (/stock|inventory|available|kitna/.test(s)) return { tool: 'stockOf', args: { text: s.replace(/stock|inventory|of|available|kitna|hai|how many|how much|in|the|\?/g, ' ').trim() } };
    if (/sale|sales|revenue|bikri|turnover/.test(s) || (/compare|\bvs\b|versus/.test(s) && /month|week|year|day|mahine|saal|today/.test(s))) return { tool: 'sales', args: { period: p } };
    if (/order|invoice/.test(s)) return { tool: 'orders', args: { period: p } };
    if (/customer|client/.test(s)) return { tool: 'customer', args: { text: txt } };
    return null;
  }
  var ROLE_BLOCK = { sales: 1, topProducts: 1, quotes: 1, orders: 1 };
  function runTool(name, args) {
    var t = TOOLS[name]; if (!t) return { title: 'Not available', lines: ['That question type is not supported.'], facts: {} };
    args = args || {}; if (args.period && (!args.period.from || !args.period.to)) args.period = parsePeriod(''); if (!args.period && (name === 'sales' || name === 'topProducts' || name === 'quotes' || name === 'orders')) args.period = parsePeriod('');
    try { return t.run(args); } catch (e) { return { title: 'Could not compute', lines: ['Error: ' + e.message], facts: {} }; }
  }
  /* AI-assisted routing: model may only choose a whitelisted tool + simple params; question is fenced */
  function aiRoute(q) {
    var p = ai.GUARD + '\nChoose ONE tool to answer the question. Tools: ' + Object.keys(TOOLS).join(', ') + '. Return ONLY JSON {"tool":"name","period":"phrase like this month / last month / April 2026 / today or empty","text":"product or customer name if relevant else empty"}.\n' + ai.fence('QUESTION', q);
    return ai.call({ prompt: p, cap: 'chat', cacheTtl: 600e3 }).then(function (r) { var j = ai.parseJson(r.text); if (!j || !TOOLS[j.tool]) return null; return { tool: j.tool, args: { period: parsePeriod(String(j.period || '')), text: String(j.text || '').slice(0, 80) } }; }, function () { return null; });
  }
  function answer(q) {
    var rt = route(q), pr = rt ? Promise.resolve(rt) : (ai.aiOn() && ai.can('chat') ? aiRoute(q) : Promise.resolve(null));
    return pr.then(function (r) { if (!r) return { title: 'I could not map that to your data', lines: ['Try: "sales this month vs last month", "low stock", "overdue follow-ups", "outstanding payments", "top products last month", "which products have no photo", "stock of valve kit".'], facts: {}, none: 1 }; var res = runTool(r.tool, r.args); res.tool = r.tool; res.blocked = false; return res; });
  }
  function narrate(res) {
    if (!ai.aiOn() || !ai.can('chat') || res.none) return Promise.resolve(null);
    var facts = res.title + '\n' + res.lines.join('\n') + (res.def ? '\nDefinition: ' + res.def : '');
    var p = ai.GUARD + '\nExplain these ERP results to a business owner in 2-3 short sentences (simple English or Hinglish). Use ONLY the numbers given; do not add any new numbers, targets, causes you cannot see, or advice that changes stock/prices/payments.\n' + ai.fence('ERP RESULT', facts);
    return ai.call({ prompt: p, cap: 'chat', cacheTtl: 600e3 }).then(function (r) { return ai.numbersOk(r.text, facts) ? r.text : null; }, function () { return null; });
  }
  /* ---------- action registry (whitelist; writes need confirmation + idempotency) ---------- */
  function hubFn(label) { var t = X.hubTiles.filter(function (x) { return x.label === label; })[0]; return t && t.fn; }
  var ACTIONS = {
    'open:low-stock': function () { if (window.ttOpenLowStock) window.ttOpenLowStock(); },
    'open:follow-ups': function () { var f = hubFn('Follow-ups'); f ? f() : X.toast('Follow-up Centre is off', 1); },
    'open:tasks': function () { var f = hubFn('Tasks'); f ? f() : X.toast('Tasks is off', 1); },
    'open:image-studio': function () { window.ttaiStudio && window.ttaiStudio(); },
    'open:insights': function () { window.ttaiInsights && window.ttaiInsights(); },
    'open:reports': function () { window.ttaiReports && window.ttaiReports(); },
    'task:reorder': function (p) {
      if (!X.on('mTasks')) return X.toast('Tasks module is off', 1);
      var l = lowStock(), key = 'REORD-' + ymd(), id = 'TSK-' + ai.hash(key + X.meId()).toUpperCase();
      if (!l.items.length) return X.toast('Nothing is low on stock', 1);
      if (X.byId('TASKS', id)) return X.toast('A re-order task for today already exists (no duplicate created)');
      var names = l.items.slice(0, 10).map(function (i) { return i.name + ' (' + i.stock + ')'; }).join(', ');
      if (!confirm('Create this task for yourself?\n\nRe-order low-stock items (' + l.items.length + ')\n' + names + '\n\nNo stock, price or purchase order will be changed.')) return;
      var t = { id: id, title: 'Re-order low-stock items (' + l.items.length + ')', desc: names, assigneeId: X.meId(), assigneeName: X.me(), createdById: X.meId(), createdBy: X.me(), createdAt: new Date().toISOString(), due: ymd(), priority: 'Normal', status: 'Open', rel: null, hist: [], source: 'AI assistant (user confirmed)' };
      X.upsert('TASKS', t); X.cloudConfirm('TASKS', X.list('TASKS')).then(function () { X.toast('Task created and synced'); try { window.ttActAdd && ttActAdd('task', 'AI-assisted create', id, t.title); } catch (e) {} }, function (e) { X.toast('Task saved on this device — cloud not confirmed: ' + e.message, 1); });
    }
  };
  function doAction(a) { if (!ACTIONS[a]) return X.toast('Action not allowed', 1); try { ACTIONS[a](); } catch (e) { X.toast('Action failed: ' + e.message, 1); } }
  function actHtml(res) { var as = (res.actions || []); return as.length ? '<div class="ttx-btns">' + as.map(function (x) { return '<button class="ttx-b' + (x.write ? ' pri' : '') + '" data-a="act" data-p="' + H(x.a) + '">' + H(x.t) + '</button>'; }).join('') + '</div>' : ''; }
  /* ---------- Copilot sheet ---------- */
  var chat = [];
  function cardHtml(m) {
    if (m.role === 'u') return '<div class="ttai-u">' + H(m.text) + '</div>';
    var r = m.res, h = '<div class="ttai-a"><b>' + H(r.title) + '</b>' + (r.period ? '<div class="ttx-chips">' + X.chip('Period: ' + r.period.label + ' (' + r.period.from + ' → ' + r.period.to + ')') + (r.period.assumed ? X.chip('assumed: this month', 'warn') : '') + X.chip(ADM() ? 'All records' : 'Your records only') + '</div>' : '') + '<ul>' + r.lines.map(function (l) { return '<li>' + H(l) + '</li>'; }).join('') + '</ul>' + (r.def ? '<small class="ttai-def">ℹ ' + H(r.def) + '</small>' : '');
    if (m.ex) h += '<div class="ttai-ex">🤖 ' + H(m.ex) + '<small> AI wording — numbers checked against the data above</small></div>';
    return h + actHtml(r) + '</div>';
  }
  function cpDraw() {
    var sug = ['Sales this month vs last month', 'Low stock items', 'Overdue follow-ups', 'Outstanding payments', 'Top products last month', 'Which products have no photo?'];
    var h = '<div class="ttai-chat" id="ttaiChat">' + (chat.length ? chat.map(cardHtml).join('') : '<div class="ttx-note">Ask about your own ERP data. Numbers come from your records by fixed rules; the AI only helps understand the question and explain the result. It cannot change stock, prices, payments or customers.</div><div class="ttx-chips ttai-sug">' + sug.map(function (s) { return '<button class="ttx-b" data-a="ask" data-p="' + H(s) + '">' + H(s) + '</button>'; }).join('') + '</div>') + (chat.length && chat[chat.length - 1].busy ? '<div class="ttai-a"><span class="ttai-dots"><i></i><i></i><i></i></span></div>' : '') + '</div>' +
      '<div class="ttai-in"><input id="ttaiQ" data-i="q" placeholder="Ask e.g. sales last month, stock of valve kit…" maxlength="200" enterkeyhint="send"><button class="ttx-b pri" data-a="send">Send</button></div>' + (chat.length ? '<div class="ttx-btns"><button class="ttx-b" data-a="clear">Clear chat</button></div>' : '') + (ai.aiOn() ? '' : '<div class="ttx-inl-warn">AI is off — keyword questions still work from your data.</div>');
    X.body('ttaiCP', h, true); var c = document.getElementById('ttaiChat'); if (c) c.scrollTop = c.scrollHeight;
  }
  function ask(q) {
    q = String(q || '').trim(); if (!q) return; if (q.length > 200) q = q.slice(0, 200);
    chat.push({ role: 'u', text: q }); var m = { role: 'a', busy: true, res: { title: '…', lines: [] } }; chat.push(m); cpDraw();
    answer(q).then(function (res) {
      if (ROLE_BLOCK[res.tool] && false) return;
      chat.splice(chat.indexOf(m), 1, { role: 'a', res: res }); var cur = chat[chat.length - 1]; cpDraw();
      narrate(res).then(function (t) { if (t) { cur.ex = t; if (X.isOpen('ttaiCP')) cpDraw(); } });
    });
  }
  window.ttaiCopilot = function () {
    if (!X.on('mAi') || !X.on('mAiCopilot')) return X.toast('Business Copilot is switched off in Settings', 1);
    X.sheet('ttaiCP', '🧠 Business Copilot', '');
    X.bind('ttaiCP', { click: { ask: function (p) { ask(p); }, send: function () { var i = document.getElementById('ttaiQ'); var v = i && i.value; if (i) i.value = ''; ask(v); }, clear: function () { chat = []; cpDraw(); }, act: function (a) { doAction(a); } } });
    var o = document.getElementById('ttaiCP'); if (o && !o.__k) { o.__k = 1; o.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'ttaiQ') { e.preventDefault(); var v = e.target.value; e.target.value = ''; ask(v); } }); }
    cpDraw();
  };

  /* ---------- Insights ---------- */
  function monthsBack(n) { var now = new Date(), a = []; for (var k = n - 1; k >= 0; k--) a.push(mrange(now.getFullYear(), now.getMonth() - k)); return a; }
  function stockCover() {
    var p = { from: iso(new Date(Date.now() - 89 * 864e5)), to: iso(new Date()) }, os = orders().filter(function (o) { return o.status === 'Delivered' && inP(dOf(o), p); }), sold = {};
    os.forEach(function (o) { (o.items || []).forEach(function (it) { var k = String(it.name || '').toLowerCase().trim(); if (k) { sold[k] = sold[k] || { q: 0, n: 0 }; sold[k].q += N(it.qty); sold[k].n++; } }); });
    var out = []; inv().forEach(function (i) { if (!i || typeof i.stock !== 'number' || i.category === 'Catalog Equipment') return; var s = sold[String(i.name || '').toLowerCase().trim()]; if (s && s.n >= 3) { var per = s.q / 90; out.push({ name: i.name, stock: i.stock, sold90: s.q, orders: s.n, days: per > 0 ? Math.floor(i.stock / per) : null }); } });
    return out.filter(function (x) { return x.days !== null; }).sort(function (a, b) { return a.days - b.days; });
  }
  function insHtml() {
    var ms = monthsBack(6), rows = ms.map(function (m) { var s = salesIn(m); return { m: m, s: s }; }), max = Math.max.apply(null, rows.map(function (r) { return r.s.total; }).concat([1]));
    var h = '<div class="ttx-note"><b>Source:</b> delivered orders in your ERP (' + (ADM() ? 'all staff' : 'your orders only') + ') · <b>Method:</b> plain sums and averages — no AI is used for these numbers.</div>';
    h += '<div class="ttx-sec">Delivered sales, last 6 months (actual)</div>' + rows.map(function (r) { return '<div class="ttai-bar2"><span>' + H(r.m.label.slice(0, 3) + ' ' + r.m.label.slice(-2)) + '</span><div><i style="width:' + Math.round(100 * r.s.total / max) + '%"></i></div><b>' + inr(r.s.total) + '</b><small>' + r.s.count + '</small></div>'; }).join('');
    var last3 = rows.slice(-4, -1).map(function (r) { return r.s.total; }), cnt = rows.slice(-4, -1).filter(function (r) { return r.s.count > 0; }).length;
    if (cnt >= 2) h += '<div class="ttx-card"><b>Estimate for this month: ' + inr(r2(last3.reduce(function (a, b) { return a + b; }, 0) / 3)) + '</b><small> Simple average of the previous 3 months — an <u>estimate</u>, not a target or promise. Actual so far this month: ' + inr(rows[5].s.total) + '.</small></div>';
    else h += '<div class="ttx-note">Not enough months of delivered sales to give an estimate (need at least 2 of the previous 3 months).</div>';
    var tp = topProducts(salesIn({ from: ms[3].from, to: ms[5].to }).orders, 6);
    h += '<div class="ttx-sec">Top products, last 3 months</div>' + (tp.length ? tp.map(function (x, k) { return '<div class="ttx-card">' + (k + 1) + '. <b>' + H(x.name) + '</b><br><small>qty ' + x.qty + ' · ' + inr(x.amt) + '</small></div>'; }).join('') : X.empty('📊', 'No delivered orders with items yet'));
    var sc = stockCover().slice(0, 8);
    h += '<div class="ttx-sec">Stock cover (estimate)</div>' + (sc.length ? sc.map(function (x) { return '<div class="ttx-card"><b>' + H(x.name) + '</b><br><small>' + x.stock + ' in stock · ' + x.sold90 + ' sold in 90 days (' + x.orders + ' orders) → about <b>' + x.days + ' day(s)</b> of cover at the same pace</small></div>'; }).join('') + '<div class="ttx-note">Estimate from the last 90 days only; ignores seasonality, supplier lead time and pending orders. It does not create purchase orders.</div>' : '<div class="ttx-note">Needs items sold in at least 3 delivered orders in the last 90 days — none qualify yet.</div>');
    var l = lowStock(); h += '<div class="ttx-btns"><button class="ttx-b" data-a="act" data-p="open:low-stock">📉 Low stock (' + l.items.length + ')</button></div><div class="ttx-note"><b>Limits:</b> orders without a delivery date are counted by order date; returns/credit notes are not netted; quotations are not sales.</div>';
    return h;
  }
  window.ttaiInsights = function () {
    if (!X.on('mAi') || !X.on('mAiInsights')) return X.toast('Insights are switched off in Settings', 1);
    X.sheet('ttaiIN', '📈 Sales & Stock Insights', insHtml()); X.bind('ttaiIN', { click: { act: doAction } });
  };

  /* ---------- Report & document assistant ---------- */
  function today() { return ymd(); }
  var RPT = { kind: 'daily', text: '', meta: '' };
  function buildReport(kind, arg) {
    var t = today(), p = { from: t, to: t, label: 'Today' };
    if (kind === 'daily') { var s = salesIn(p), b = bookedIn(p), fu = window.ttxFollowCounts ? window.ttxFollowCounts() : null, ls = lowStock(), d = dueNow();
      return { text: 'Daily summary — ' + X.fmtD(t) + '\nTwin Town Express Services Pvt Ltd\n\nDelivered today: ' + inr(s.total) + ' (' + s.count + ' order(s))\nBooked today, not delivered: ' + inr(b.total) + ' (' + b.count + ')\nOutstanding on orders: ' + inr(d.total) + ' (' + d.count + ' order(s))\n' + (fu ? 'Follow-ups overdue: ' + fu.overdue + ', due today: ' + fu.today + '\n' : '') + 'Low-stock items: ' + ls.items.length, meta: 'Numbers come straight from your ERP records.' }; }
    if (kind === 'reorder') { var l = lowStock().items; return { text: 'Re-order request — Twin Town Express Services Pvt Ltd\n\n' + (l.length ? l.slice(0, 40).map(function (i, n) { return (n + 1) + '. ' + i.name + ' (stock ' + i.stock + ')'; }).join('\n') : '(no low-stock items)') + '\n\nPlease share rates & availability.', meta: 'No prices are included.' }; }
    if (kind === 'dues') { var dd = dueNow(); return { text: 'Outstanding summary — ' + X.fmtD(t) + '\n\n' + (dd.top.length ? dd.top.map(function (x, n) { return (n + 1) + '. ' + x.name + ' — ' + inr(x.due); }).join('\n') : 'No outstanding amounts.') + '\n\nTotal outstanding: ' + inr(dd.total), meta: 'Internal use. Amounts are the dueAmount stored on each order.' }; }
    if (kind === 'lead') { var ld = leads().filter(function (x) { return String(x.id) === String(arg); })[0]; if (!ld) return { text: '', meta: 'Select a lead first.' };
      return { text: 'Hello ' + (ld.customerName || '') + ',\n\nThis is ' + X.me() + ' from Twin Town Express Services Pvt Ltd. Following up on your enquiry' + (ld.machine ? ' for ' + ld.machine : '') + (N(ld.quotedPrice) ? ' (quoted ' + inr(N(ld.quotedPrice)) + ')' : '') + '. Please let me know if you would like to proceed or need any clarification.\n\nThank you.', meta: 'Amount is the quoted price saved on the lead.', phone: ld.phone }; }
    return { text: '', meta: '' };
  }
  function rpDraw() {
    var ld = leads().filter(function (l) { return l.followupDate || l.status; }).slice(0, 60);
    var h = '<div class="ttx-tabs">' + [['daily', 'Daily summary'], ['reorder', 'Re-order list'], ['dues', 'Outstanding'], ['lead', 'Lead follow-up']].map(function (t) { return '<button class="' + (RPT.kind === t[0] ? 'on' : '') + '" data-a="rk" data-p="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (RPT.kind === 'lead') h += '<div class="ttx-row"><select data-c="lead"><option value="">Choose a lead…</option>' + ld.map(function (l) { return '<option value="' + H(l.id) + '"' + (String(RPT.arg) === String(l.id) ? ' selected' : '') + '>' + H((l.customerName || '') + ' — ' + (l.machine || '')) + '</option>'; }).join('') + '</select></div>';
    var r = buildReport(RPT.kind, RPT.arg); RPT.text = RPT.edited != null && RPT.editKind === RPT.kind + RPT.arg ? RPT.edited : r.text; RPT.phone = r.phone;
    h += '<textarea id="ttaiRT" data-i="rt" rows="11" style="white-space:pre-wrap">' + H(RPT.text) + '</textarea><div class="ttx-note">' + H(r.meta) + ' Edit freely — nothing is sent until you press a button below.</div>';
    h += '<div class="ttx-btns"><button class="ttx-b" data-a="copy">📋 Copy</button><button class="ttx-b" data-a="wa">💬 Open in WhatsApp</button>' + (ai.aiOn() && ai.can('docs') ? '<button class="ttx-b" data-a="polish">✨ Improve wording (AI)</button>' : '') + '</div>';
    if (RPT.polished) h += '<div class="ttx-card"><b>AI-improved version</b><div style="white-space:pre-wrap;margin-top:6px">' + H(RPT.polished) + '</div><div class="ttx-btns"><button class="ttx-b pri" data-a="usep">Use this</button><button class="ttx-b" data-a="dropp">Discard</button></div></div>';
    if (RPT.err) h += '<div class="ttx-inl-warn">' + H(RPT.err) + '</div>';
    X.body('ttaiRP', h, true);
  }
  window.ttaiReports = function () {
    if (!X.on('mAi') || !X.on('mAiDocs')) return X.toast('Report assistant is switched off in Settings', 1);
    X.sheet('ttaiRP', '📝 Report & Message Assistant', ''); RPT.polished = ''; RPT.err = '';
    X.bind('ttaiRP', { click: { rk: function (k) { RPT.kind = k; RPT.edited = null; RPT.polished = ''; RPT.err = ''; rpDraw(); }, copy: function () { var t = (document.getElementById('ttaiRT') || {}).value || ''; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { X.toast('Copied'); }, function () { X.toast('Copy not allowed here — select the text manually', 1); }); },
      wa: function () { var t = (document.getElementById('ttaiRT') || {}).value || ''; if (!t.trim()) return X.toast('Nothing to send', 1); if (!confirm('Open WhatsApp with this message? You choose the recipient and press send there.')) return; var ph = (RPT.phone || '').replace(/\D/g, '').slice(-10); window.open('https://wa.me/' + (ph ? '91' + ph : '') + '?text=' + encodeURIComponent(t), '_blank', 'noopener'); },
      polish: function (p, b) { var t = (document.getElementById('ttaiRT') || {}).value || ''; if (!t.trim()) return; b.disabled = true; b.textContent = '⏳ …'; RPT.err = ''; ai.call({ prompt: ai.GUARD + '\nImprove the wording of this business message: keep every number, name and date EXACTLY as written, add no new facts, offers, discounts or promises. Return only the message.\n' + ai.fence('DRAFT', t), cap: 'docs' }).then(function (r) { if (!ai.numbersOk(r.text, t)) { RPT.err = 'The AI changed or added numbers, so its version was rejected. Your original is kept.'; RPT.polished = ''; } else RPT.polished = r.text; rpDraw(); }, function (e) { RPT.err = ai.friendly(e); rpDraw(); }); },
      usep: function () { RPT.edited = RPT.polished; RPT.editKind = RPT.kind + RPT.arg; RPT.polished = ''; rpDraw(); }, dropp: function () { RPT.polished = ''; rpDraw(); } },
      change: { lead: function (v) { RPT.arg = v; RPT.edited = null; rpDraw(); } }, input: { rt: function (v) { RPT.edited = v; RPT.editKind = RPT.kind + RPT.arg; } } });
    rpDraw();
  };
  window.ttaiTools = { TOOLS: TOOLS, route: route, runTool: runTool, parsePeriod: parsePeriod, answer: answer, ACTIONS: ACTIONS, doAction: doAction, stockCover: stockCover, salesIn: salesIn, buildReport: buildReport, narrate: narrate, orders: orders };
})();

/* ===== v30 · AI Control Centre, AI Settings & Usage, Product intelligence, Settings switches, menu entry ===== */
(function () {
  'use strict';
  var X = window.ttx, H = X.H, ai = window.ttai;
  var SW = [
    ['mAi', '🤖', 'AI features (master switch)', 'Turns every AI feature in this app on or off on this device'],
    ['mAiImg', '🖼️', 'Product Image Studio', 'Find, review and approve catalogue product photos'],
    ['mAiProd', '🧠', 'Product intelligence panel', 'Web-researched product details with sources'],
    ['mAiCopilot', '💬', 'Business Copilot', 'Ask questions about your own ERP data'],
    ['mAiInsights', '📈', 'Sales & Stock Insights', 'Actual vs estimated trends with method and limits'],
    ['mAiDocs', '📝', 'Report & Message Assistant', 'Drafts from ERP numbers; you confirm before sending']
  ];
  var prevSet = window.ttModSettings;
  window.ttModSettings = function (sw, group) {
    var base = prevSet ? prevSet(sw, group) : '';
    var rows = SW.map(function (m) { return sw(m[0], m[1] + ' ' + m[2], m[3]); });
    rows.push('<div class="tt25-row"><div class="tt25-rt"><b>🤖 AI Control Centre</b><small>Limits, models, usage, photo auto-accept (Admin)</small></div><button class="btn btn-outline btn-sm" onclick="ttaiCentre()">Open</button></div>');
    return base + group('🤖 AI & Intelligence (on / off)', rows);
  };
  /* ---------- Product intelligence ---------- */
  function list(a) { return (Array.isArray(a) ? a : []).filter(function (x) { return x && typeof x === 'string'; }).slice(0, 8); }
  window.ttaiProd = function (pid) {
    var i; try { i = getCatalogItems().filter(function (x) { return String(x.id) === String(pid); })[0]; } catch (e) {} if (!i) return;
    X.sheet('ttaiPI', '🧠 ' + i.name, '<div class="ttx-empty"><span>⏳</span>Searching trusted web sources…</div>');
    var erp = '<div class="ttx-sec">From your ERP (entered by your team)</div><div class="ttx-card">' + [['Category', [i.category, i.subCategory].filter(Boolean).join(' → ')], ['Model / code', [i.machine && i.machine !== i.name ? i.machine : '', i.code].filter(Boolean).join(' • ')], ['Description', i.desc], ['Specs', i.specs]].filter(function (r) { return r[1]; }).map(function (r) { return '<div><small>' + H(r[0]) + '</small><div style="white-space:pre-wrap">' + H(r[1]) + '</div></div>'; }).join('') + '</div>';
    X.body('ttaiPI', erp + '<div class="ttx-empty"><span>⏳</span>Searching trusted web sources…</div>');
    var p = ai.GUARD + '\nUsing web search, research this exact product from the manufacturer or authorised sources. Return ONLY JSON: {"identified":true|false,"manufacturer":"","purpose":"","features":[],"specs":[{"k":"","v":""}],"compatibility":[],"instructions":[],"safety":[],"dilution":null,"accessories":[]}. Use "" / [] / null for anything you could not find in a reliable source. NEVER guess specs, dilution ratios, safety or warranty. "dilution" only if the manufacturer states it for this exact product.\n' + ai.fence('PRODUCT', 'Name: ' + i.name + '\nModel/Code: ' + [i.machine, i.code].filter(Boolean).join(' / ') + '\nCategory: ' + [i.category, i.subCategory].filter(Boolean).join(' > '));
    ai.call({ prompt: p, search: true, cap: 'research', cacheTtl: 7 * 864e5 }).then(function (r) {
      var j = ai.parseJson(r.text) || {}, srcs = r.sources || [], g = srcs.length > 0, h = erp;
      if (!j.identified) h += '<div class="ttx-inl-warn">The product could not be confidently identified online. Nothing below should be relied on.</div>';
      h += '<div class="ttx-sec">AI research ' + (g ? '(from ' + srcs.length + ' web source' + (srcs.length > 1 ? 's' : '') + ')' : '') + '</div>';
      if (!g) h += '<div class="ttx-inl-warn">No web sources were returned for this answer, so it is <b>unverified</b>. Check with the manufacturer before using it.</div>';
      var sec = function (t, v) { return v && v.length ? '<div class="ttx-card"><b>' + t + '</b><ul class="ttai-why">' + v.map(function (x) { return '<li>' + H(x) + '</li>'; }).join('') + '</ul></div>' : ''; };
      h += (j.manufacturer ? '<div class="ttx-card"><b>Manufacturer</b> ' + H(j.manufacturer) + '</div>' : '') + (j.purpose ? '<div class="ttx-card"><b>Purpose</b><br>' + H(j.purpose) + '</div>' : '') + sec('Features', list(j.features)) +
        sec('Specifications', (Array.isArray(j.specs) ? j.specs : []).filter(function (s) { return s && s.k && s.v; }).slice(0, 12).map(function (s) { return s.k + ': ' + s.v; })) + sec('Compatibility', list(j.compatibility)) + sec('Manufacturer instructions', list(j.instructions)) + sec('Safety', list(j.safety)) + sec('Accessories', list(j.accessories)) +
        '<div class="ttx-card"><b>Chemical dilution</b><br>' + (j.dilution && g ? H(String(j.dilution)) + '<br><small>Manufacturer-stated — confirm on the product label.</small>' : '<small>Not found in a reliable source for this product. Follow the product label.</small>') + '</div>';
      h += '<div class="ttx-sec">Sources</div>' + (srcs.length ? srcs.map(function (s) { var ok = /^https:\/\//.test(s.uri); return '<div class="ttx-card">' + (ok ? '<a href="' + H(s.uri) + '" target="_blank" rel="noopener noreferrer">' + H(s.title || s.uri) + '</a>' : H(s.title)) + '</div>'; }).join('') : '<div class="ttx-note">None returned.</div>');
      h += '<div class="ttx-note">⚠ AI-generated summary of web content. Dealer prices are never sent to the AI or shown here. Verify safety and dilution on the manufacturer label.</div>';
      X.body('ttaiPI', h);
    }, function (e) { X.body('ttaiPI', erp + '<div class="ttx-inl-warn">' + H(ai.friendly(e)) + '</div><div class="ttx-btns"><button class="ttx-b pri" onclick="ttaiProd(\'' + pid + '\')">↻ Retry</button></div>'); });
  };
  /* ---------- Control Centre ---------- */
  var TILES = [
    ['mAiCopilot', '💬', 'Business Copilot', 'Ask about sales, stock, dues, follow-ups', function () { window.ttaiCopilot(); }],
    ['mAiImg', '🖼️', 'Product Image Studio', function () { var n = 0; try { n = X.list('PRODUCT_IMAGES').filter(function (r) { return r.status === 'review'; }).length; } catch (e) {} return n ? n + ' to review' : 'Find & approve photos'; }, function () { window.ttaiStudio(); }],
    ['mAiProd', '🔎', 'Product Research', 'Open a catalogue product → Product intelligence', function () { try { switchTab('catalog'); } catch (e) {} }],
    ['mAiInsights', '📈', 'Sales & Stock Insights', 'Actual vs estimate, with method', function () { window.ttaiInsights(); }],
    ['mAiDocs', '📝', 'Reports & Messages', 'Daily summary, re-order list, follow-ups', function () { window.ttaiReports(); }],
    ['mAi', '⚙️', 'AI Settings & Usage', 'Limits, models, usage (Admin)', function () { window.ttaiSettings(); }, 1]
  ];
  function tiles() { return TILES.filter(function (t) { return X.on(t[0]) && (!t[5] || X.isAdm()); }); }
  window.ttaiCentre = function () {
    if (!X.on('mAi')) return X.toast('AI features are switched off in Settings', 1);
    var c = ai.cfg(), t = tiles(), u = ai.usage();
    var h = (!c.enabled ? '<div class="ttx-inl-warn">AI is switched off by Admin. ERP data and every other feature still work.</div>' : '') + (navigator.onLine === false ? '<div class="ttx-inl-warn">Offline — AI needs internet.</div>' : '') +
      '<div class="ttx-grid">' + t.map(function (x, k) { var s = typeof x[3] === 'function' ? x[3]() : x[3]; return '<button class="ttx-tile" data-a="go" data-p="' + k + '"><span>' + x[1] + '</span><b>' + H(x[2]) + '</b><small>' + H(s) + '</small></button>'; }).join('') + '</div>' +
      '<div class="ttx-note">Today on this device: ' + u.calls + ' AI call(s) of ' + c.dailyLimit + ' allowed · ' + (u.cached || 0) + ' answered from cache · ' + u.errors + ' error(s).</div>';
    X.sheet('ttaiCC', '🤖 AI Control Centre', h);
    X.bind('ttaiCC', { click: { go: function (k) { var x = t[+k]; X.close('ttaiCC'); setTimeout(x[4], 60); } } });
  };
  /* ---------- AI settings & usage (admin) ---------- */
  function keyInfo() { var c = ai.cfg(); if (c.gatewayUrl) return ['Secure gateway', 'AI calls go through your gateway; no key in the app is used.', 'ok']; var dev = ''; try { dev = localStorage.getItem('TTESPL_ERP_GEMINI_KEY'); } catch (e) {} if (dev) return ['Device key', 'A key saved on this device is used. Anyone with this device can read it.', 'warn']; return ['No key set', 'AI is off until Admin saves a device key or connects the AI gateway (see /functions). No key is stored in the app code.', 'bad']; }
  function usageRows() { var rows = []; X.list('OFFICE_CFG').filter(function (x) { return String(x.id).indexOf('ai_usage_') === 0; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 7).forEach(function (d) { var t = { calls: 0, errors: 0, cached: 0 }; Object.keys(d.byUser || {}).forEach(function (u) { t.calls += d.byUser[u].calls || 0; t.errors += d.byUser[u].errors || 0; t.cached += d.byUser[u].cached || 0; }); rows.push('<div class="tt25-row"><div class="tt25-rt"><b>' + H(d.date) + '</b><small>' + Object.keys(d.byUser || {}).length + ' user(s)</small></div><span>' + t.calls + ' calls · ' + t.errors + ' err · ' + t.cached + ' cached</span></div>'); }); return rows.join('') || '<div class="ttx-note">No usage recorded yet.</div>'; }
  function modelRow(id, label, sub, cur) { var M = window.TT_AI_MODELS, cm = M.resolve(cur); return '<div class="tt25-row"><div class="tt25-rt"><b>' + label + '</b><small>' + sub + '</small></div><select data-c="' + id + '">' + M.tiers.map(function (t) { return '<option value="' + H(t.model) + '"' + (t.model === cm ? ' selected' : '') + '>' + H(t.label + ' — ' + t.hint) + '</option>'; }).join('') + '</select></div>'; }
  function stDraw() {
    var c = ai.cfg(), k = keyInfo(), sw = function (id, label, sub, on) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + label + '</b><small>' + sub + '</small></div><label class="tt25-sw"><input type="checkbox" data-c="' + id + '"' + (on ? ' checked' : '') + '><i></i></label></div>'; };
    var num = function (id, label, sub, v, mn, mx) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + label + '</b><small>' + sub + '</small></div><input class="tt25-num" type="number" min="' + mn + '" max="' + mx + '" value="' + v + '" data-c="' + id + '"></div>'; };
    var h = '<div class="ttx-card ' + (k[2] === 'bad' ? 'urg' : '') + '"><b>AI access: ' + H(k[0]) + '</b><br><small>' + H(k[1]) + '</small></div>' +
      sw('enabled', 'AI enabled (all devices)', 'Admin master switch stored in the cloud', c.enabled) + sw('imageEnabled', 'Product photo automation', 'Search for catalogue photos', c.imageEnabled) + sw('autoAccept', 'Auto-accept High-confidence photos', 'Off = every photo waits for Admin review (recommended)', c.autoAccept) + sw('empCanSearch', 'Employees can start a photo search', 'Approval stays Admin-only', c.empCanSearch) +
      ['chat', 'research', 'images', 'docs'].map(function (cp) { return sw('cap_' + cp, 'Capability: ' + cp, 'Allow this kind of AI call', c.caps[cp]); }).join('') +
      num('dailyLimit', 'Daily AI calls per device', 'Hard stop to control cost', c.dailyLimit, 10, 2000) + num('concurrency', 'Batch: parallel searches', '1–4', c.concurrency, 1, 4) + num('recheckDays', 'Re-check “no photo” after (days)', 'Avoids repeating failed searches', c.recheckDays, 1, 90) +
      modelRow('model', 'Default model', 'Used for everyday AI answers', c.model) + modelRow('fallbackModel', 'Backup model', 'Used if the default model fails', c.fallbackModel) +
      '<div class="tt25-row"><div class="tt25-rt"><b>Gateway URL</b><small>Cloud Function base URL (blank = direct)</small></div><input type="url" data-c="gatewayUrl" value="' + H(c.gatewayUrl) + '" placeholder="https://…"></div>' +
      (typeof ttSetGeminiKey === 'function' ? '<div class="ttx-btns"><button class="ttx-b" data-a="key">🔑 Set device key</button></div>' : '') + '<div class="ttx-sec">Usage (cloud summary, last 7 days)</div>' + usageRows() + '<div class="ttx-note">Keys are never stored in these settings. Limits are enforced on each device — a modified device could bypass them; a gateway enforces them server-side.</div>';
    X.body('ttaiST', h, true);
  }
  window.ttaiSettings = function () {
    if (!X.isAdm()) return X.toast('Admin only', 1);
    X.sheet('ttaiST', '⚙️ AI Settings & Usage', ''); X.bind('ttaiST', { click: { key: function () { ttSetGeminiKey(); } }, change: new Proxy({}, { get: function (_, id) { return function (v, el) { var patch = {}; if (String(id).indexOf('cap_') === 0) { var cp = {}; cp[id.slice(4)] = el.checked ? 1 : 0; patch.caps = Object.assign({}, ai.cfg().caps, cp); } else if (el.type === 'checkbox') patch[id] = el.checked; else if (el.type === 'number') { var n = Number(v); if (!isFinite(n) || n < Number(el.min) || n > Number(el.max)) { X.toast('Value must be between ' + el.min + ' and ' + el.max, 1); return stDraw(); } patch[id] = n; } else if (id === 'gatewayUrl' && v && !/^https:\/\//.test(v)) { X.toast('Gateway must be https://', 1); return stDraw(); } else patch[id] = String(v).trim(); ai.saveCfg(patch, function () { stDraw(); }); }; }, has: function () { return true; } }) });
    stDraw();
  };
  /* ---------- menu entry + hub tile ---------- */
  X.hubTiles.push({ mod: 'mAi', icon: '🤖', label: 'AI Control Centre', sub: 'Copilot · Photos · Insights', fn: function () { window.ttaiCentre(); } });
  function inject() {
    var list = document.querySelector('#profileDropdownCard .profile-menu-list'); if (!list) return;
    var it = document.getElementById('ttaiMenu');
    if (!it) { it = document.createElement('div'); it.id = 'ttaiMenu'; it.className = 'profile-menu-item tt25-mi'; it.setAttribute('onclick', 'triggerAppHaptic(); ttaiCentre(); closeProfileDrawer();'); it.innerHTML = '<div class="profile-menu-item-left"><span>🤖</span><span>AI Control Centre</span></div><span style="font-size:10px;color:#38bdf8;">Copilot · Photos</span>'; var hub = document.getElementById('ttxMenuHub'); list.insertBefore(it, hub ? hub.nextSibling : (list.firstElementChild ? list.firstElementChild.nextSibling : null)); }
    it.style.display = X.on('mAi') ? '' : 'none';
  }
  var pr = window.ttxRefresh; window.ttxRefresh = function () { if (pr) try { pr(); } catch (e) {} try { inject(); } catch (e) {} };
  window.addEventListener('online', function () { try { var o = document.getElementById('ttaiCC'); if (o && o.style.display !== 'none') window.ttaiCentre(); } catch (e) {} });
  setTimeout(window.ttxRefresh, 1500); setTimeout(window.ttxRefresh, 4000);
})();


