/* TTESPL v44 - ONLINE STORE: shared price rules (used by shop.html AND by the ERP, so both always agree).
   All prices are GST-inclusive rupees.
   product = { id, p (online price), off (extra % off, optional), bulk:[{q,pct}] (buy q or more -> pct % off) }
   cfg     = { ship:{odisha,india}, freeAbove, coupons:[{code,type:'pct'|'flat',val,min,max,on}] } */
(function (g) {
  'use strict';
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function bulkPct(pr, q) {
    var best = 0; (pr.bulk || []).forEach(function (b) { if (q >= N(b.q) && N(b.q) > 0 && N(b.pct) > best) best = N(b.pct); });
    return Math.min(best, 90);
  }
  /* price of ONE unit for a given quantity (offer % first, then the bulk slab) */
  function unit(pr, q) {
    var u = N(pr.p) * (1 - Math.min(N(pr.off), 90) / 100);
    var b = bulkPct(pr, q);
    return R2(u * (1 - b / 100));
  }
  function findCoupon(cfg, code) {
    code = String(code || '').trim().toUpperCase(); if (!code) return null;
    return ((cfg && cfg.coupons) || []).filter(function (c) { return c && c.on !== false && String(c.code || '').toUpperCase() === code; })[0] || null;
  }
  /* lines: [{pid, q}], prods: {pid: product} -> full price breakdown */
  function calc(lines, prods, cfg, o) {
    o = o || {}; cfg = cfg || {};
    var rows = [], mrpSum = 0, sub = 0;
    (lines || []).forEach(function (l) {
      var pr = prods[l.pid]; var q = Math.max(0, Math.floor(N(l.q))); if (!pr || !q) return;
      var u = unit(pr, q), t = R2(u * q), mrp = N(pr.mrp) > N(pr.p) ? N(pr.mrp) : N(pr.p);
      rows.push({ pid: l.pid, n: pr.n, q: q, u: u, t: t, mrp: mrp, bp: bulkPct(pr, q) });
      sub = R2(sub + t); mrpSum = R2(mrpSum + mrp * q);
    });
    var cp = findCoupon(cfg, o.coupon), cdisc = 0, cerr = '';
    if (o.coupon && !cp) cerr = 'Invalid or expired coupon';
    if (cp) {
      if (sub < N(cp.min)) cerr = 'Coupon needs a minimum order of ₹' + N(cp.min);
      else { cdisc = cp.type === 'flat' ? N(cp.val) : sub * N(cp.val) / 100; if (N(cp.max) > 0 && cp.type !== 'flat') cdisc = Math.min(cdisc, N(cp.max)); cdisc = R2(Math.min(cdisc, sub)); }
    }
    var after = R2(sub - cdisc), area = o.area === 'india' ? 'india' : 'odisha';
    var ship = N(((cfg.ship || {})[area] != null ? cfg.ship[area] : 100));
    var free = N(cfg.freeAbove) > 0 && after >= N(cfg.freeAbove);
    if (!rows.length || free) ship = 0;
    return { rows: rows, mrpSum: mrpSum, sub: sub, saved: R2(Math.max(0, mrpSum - sub)), coupon: cdisc > 0 ? String(cp.code).toUpperCase() : '', cdisc: cdisc, cerr: cerr, ship: ship, free: free, total: R2(after + ship) };
  }
  g.TTSHOP = { N: N, R2: R2, unit: unit, bulkPct: bulkPct, calc: calc, findCoupon: findCoupon };
})(typeof window !== 'undefined' ? window : this);
