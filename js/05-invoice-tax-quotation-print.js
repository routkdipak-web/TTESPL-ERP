/* TTESPL ERP module: 05-invoice-tax-quotation-print.js */
/* ---------- TAX INVOICE ---------- */
function buildTallyInvoiceHtml(o) {
  try { return ttBuildInvoicePaged(o); }
  catch (e) { console.error('Paged invoice failed, legacy layout', e); return buildTallyInvoiceHtmlLegacy(o); }
}
window.buildTallyInvoiceHtml = buildTallyInvoiceHtml;

/* v15: purane bills me HSN/Disc missing ho to inventory / MRP se nikaalo (data change nahi hota, sirf print) */
function ttItemHsn(it) {
  var DEF = '84139190', h = String((it && it.hsn) || '').trim();
  if (h && h !== DEF) return h;
  try {
    var inv = (typeof sampleInventory !== 'undefined' && Array.isArray(sampleInventory)) ? sampleInventory : [];
    var nm = String((it && it.name) || '').trim().toLowerCase();
    var p = inv.find(function (x) { return it && it.id != null && String(x.id) === String(it.id); }) ||
            inv.find(function (x) { return nm && String(x.name || '').trim().toLowerCase() === nm; });
    var ph = p ? String(p.hsn || '').trim() : '';
    if (ph && ph !== DEF) return ph;
  } catch (e) {}
  return h || DEF;
}
function ttFmtDisc(d) { d = Number(d) || 0; return d > 0 ? String(Number(d.toFixed(2))) : ''; }
window.ttItemHsn = ttItemHsn;

function ttBuildInvoicePaged(o, opt) {
  opt = opt || {};
  const cust = opt.party || (customerDatabase.find(c => (c.phone && c.phone === o.phone) || c.name === o.customerName) || {});
  const gstNo = cust.gst || '';
  const intra = (o.taxType || 'INTRA') !== 'INTER';
  const dt = o.deliveredDate || o.orderDate || '';
  const items = (o.items || []).map(it => {
    const incl = Number(it.total) || 0;
    const gstRate = window.ttItemGstRate ? ttItemGstRate(it) : 18;   // v41: 18 unless "Per-item GST rate" is ON
    const taxable = Math.round(incl / (1 + gstRate / 100) * 100) / 100;
    const qty = Number(it.qty) || 1;
    const inclRate = qty ? incl / qty : incl;
    let mrp = Number(it.mrp) || 0, disc = Number(it.disc) || 0;
    if (!(mrp > 0)) mrp = (disc > 0 && disc < 100) ? inclRate / (1 - disc / 100) : inclRate;
    if (!(disc > 0) && mrp > inclRate + 0.005) disc = Math.round((1 - inclRate / mrp) * 10000) / 100;
    return { name: it.name, desc: it.desc, specs: it.specs, hsn: ttItemHsn(it), gstRate, qty, inclRate, rate: qty ? taxable / qty : taxable, mrp, disc, taxable, incl };
  });
  const sumTaxable = Math.round(items.reduce((s, i) => s + i.taxable, 0) * 100) / 100;
  const total = Number(o.totalAmount) || 0;
  const courierCharge = Number(o.courierCharge) || 0;
  const courTax = !!(window.ttCourierTaxable && ttCourierTaxable() && courierCharge > 0);   // v41 option: courier is part of taxable value (18%)
  const courTaxable = courTax ? Math.round(courierCharge / 1.18 * 100) / 100 : 0;
  const totalForTax = courTax ? total : Math.round((total - courierCharge) * 100) / 100;
  const tax = Math.round((totalForTax - sumTaxable - courTaxable) * 100) / 100;
  const half = Math.round(tax / 2 * 100) / 100;
  const roundOff = Math.round((totalForTax - (sumTaxable + courTaxable + (intra ? half * 2 : tax))) * 100) / 100;
  const hs = {};
  items.forEach(i => { const k = i.hsn + '|' + i.gstRate; hs[k] = hs[k] || 0; hs[k] += i.taxable; });
  if (courTaxable > 0) { hs['996511|18'] = (hs['996511|18'] || 0) + courTaxable; }
  let hsRows = '', hsTot = 0, hsTax = 0;
  Object.keys(hs).forEach(k => {
    const hsn = k.split('|')[0], rt = Number(k.split('|')[1]) || 18, hr = (rt / 2);
    const tv = Math.round(hs[k] * 100) / 100, tx = Math.round(tv * rt / 100 * 100) / 100;
    hsTot += tv; hsTax += tx;
    hsRows += `<tr><td style="text-align:left;">${ttEscHtml(hsn)}</td><td>${ttInr(tv)}</td>` +
      (intra ? `<td>${hr}%</td><td>${ttInr(tx / 2)}</td><td>${hr}%</td><td>${ttInr(tx / 2)}</td>` : `<td colspan="2">IGST ${rt}%</td><td colspan="2">${ttInr(tx)}</td>`) +
      `<td>${ttInr(tx)}</td></tr>`;
  });
  const B = 'border:1px solid #000;';
  const cell = 'padding:3px 5px;vertical-align:top;';
  const L = 'border-left:1px solid #000;';
  const meta = (l, v) => `<div style="${B}border-width:0 0 1px 1px;padding:2px 5px;min-height:30px;"><div style="font-size:9.5px;">${l}</div><div style="font-weight:700;font-size:11.5px;">${v || ''}</div></div>`;

  const head = (pageNo) => ttDocHead(opt.title || 'Tax Invoice', pageNo, opt.sub || '') + `
    <div style="display:grid;grid-template-columns:1.25fr 1fr;">
      <div>
        <div style="padding:5px 6px;border-bottom:1px solid #000;">
          <strong style="font-size:12.5px;">TWINTOWN EXPRESS SERVICES PVT LTD</strong><br>
          PLOT:1270/8566, SATYA VIHAR, RASHULGARH,<br>BHUBANESWAR-751010<br>
          Ph-8917465040 / 6743175599<br>GSTIN/UIN: 21AAICT6014E1ZT<br>State Name : Odisha, Code : 21<br>E-Mail : info@ttespl.com
        </div>
        <div style="padding:5px 6px;border-bottom:1px solid #000;">
          <span style="font-size:9.5px;">Consignee (Ship to)</span><br>
          <strong>${ttEscHtml(o.customerName)}</strong><br>${ttEscHtml(cust.address || '')}<br>${o.phone ? 'Mobile: ' + ttEscHtml(o.phone) + '<br>' : ''}
          GSTIN/UIN : ${ttEscHtml(gstNo || 'Unregistered')}<br>State Name : Odisha, Code : 21
        </div>
        <div style="padding:5px 6px;">
          <span style="font-size:9.5px;">Buyer (Bill to)</span><br>
          <strong>${ttEscHtml(o.customerName)}</strong><br>${ttEscHtml(cust.address || '')}<br>
          GSTIN/UIN : ${ttEscHtml(gstNo || 'Unregistered')}<br>State Name : Odisha, Code : 21
        </div>
      </div>
      <div style="border-left:1px solid #000;">
        <div style="display:grid;grid-template-columns:1fr 1fr;">
          ${meta(opt.noLabel || 'Invoice No.', ttEscHtml((window.ttInvNo ? ttInvNo(o, opt) : o.id)))}${meta('Dated', ttEscHtml(dt))}
          ${meta('Delivery Note', ttEscHtml((o.invMeta || {}).deliveryNote || ''))}${meta('Mode/Terms of Payment', ttEscHtml(o.payMode && o.payMode !== 'Imported' ? o.payMode : ''))}
          ${meta('Reference No. &amp; Date.', ttEscHtml((o.invMeta || {}).refNo || ''))}${meta('Other References', ttEscHtml((o.invMeta || {}).otherRef || ''))}
          ${meta("Buyer's Order No.", ttEscHtml((o.invMeta || {}).buyerOrderNo || ''))}${meta('Dated', ttEscHtml((o.invMeta || {}).buyerOrderDate || (opt.noOrderDate ? '' : (o.orderDate || ''))))}
          ${meta('Dispatch Doc No.', ttEscHtml((o.invMeta || {}).dispatchDoc || ''))}${meta('Delivery Note Date', ttEscHtml((o.invMeta || {}).deliveryNoteDate || ''))}
          ${meta('Dispatched through', ttEscHtml((o.invMeta || {}).dispatchedThrough || ''))}${meta('Destination', ttEscHtml((o.invMeta || {}).destination || ''))}
        </div>
        <div style="padding:3px 5px;min-height:40px;font-size:9.5px;">Terms of Delivery${(opt.delivery || (o.invMeta || {}).termsOfDelivery) ? ': <strong>' + ttEscHtml(opt.delivery || (o.invMeta || {}).termsOfDelivery) + '</strong>' : ''}<br>${opt.byLabel || 'Billed By'}: <strong>${ttEscHtml(o.bookedBy || '')}</strong></div>
      </div>
    </div>`;

  const colgroup = '<colgroup><col style="width:4%"><col style="width:21%"><col style="width:9%"><col style="width:5%"><col style="width:7%"><col style="width:9%"><col style="width:6%"><col style="width:10%"><col style="width:9%"><col style="width:5%"><col style="width:15%"></colgroup>';
  const thead = `<thead><tr style="text-align:center;">
        <th style="${B}${cell}">SI No.</th><th style="${B}${cell}">Description of Goods</th><th style="${B}${cell}">HSN/SAC</th>
        <th style="${B}${cell}">GST Rate</th><th style="${B}${cell}">Quantity</th><th style="${B}${cell}">MRP</th><th style="${B}${cell}">Disc. %</th>
        <th style="${B}${cell}">Rate (Incl. of Tax)</th><th style="${B}${cell}">Rate</th><th style="${B}${cell}">per</th><th style="${B}${cell}">Amount</th></tr></thead>`;
  const rows = items.map((i, n) => `<tr>
          <td style="${cell}${L}text-align:center;">${n + 1}</td><td style="${cell}${L}word-wrap:break-word;"><strong>${ttEscHtml(i.name)}</strong>${(i.desc || i.specs) ? `<div style="font-size:7.5px;line-height:1.25;color:#333;margin-top:2px;white-space:pre-wrap;">${i.desc ? ttH(i.desc) : ''}${(i.desc && i.specs) ? '\n' : ''}${i.specs ? '<b>Technical:</b> ' + ttH(i.specs) : ''}</div>` : ''}</td>
          <td style="${cell}${L}">${ttEscHtml(i.hsn)}</td><td style="${cell}${L}text-align:center;">${i.gstRate} %</td>
          <td style="${cell}${L}text-align:right;"><strong>${i.qty} PCS</strong></td><td style="${cell}${L}text-align:right;">${ttInr(i.mrp)}</td>
          <td style="${cell}${L}text-align:center;">${ttFmtDisc(i.disc)}</td><td style="${cell}${L}text-align:right;">${ttInr(i.inclRate)}</td>
          <td style="${cell}${L}text-align:right;">${ttInr(i.rate)}</td><td style="${cell}${L}text-align:center;">PCS</td>
          <td style="${cell}${L}border-right:1px solid #000;text-align:right;"><strong>${ttInr(i.taxable)}</strong></td></tr>`);
  const amounts = items.map(i => i.taxable);
  const cont = (sub, nextPage) => `<tr><td colspan="10" style="${L}${B}border-width:1px 0 0 1px;text-align:right;font-weight:700;padding:3px 5px;">Sub-total (carried forward)</td><td style="${B}border-width:1px 1px 0 1px;text-align:right;font-weight:700;padding:3px 5px;">${ttInr(sub)}</td></tr>
    <tr><td colspan="11" style="${B}border-width:0 1px 1px 1px;text-align:right;font-style:italic;padding:3px 6px;">continued to page number ${nextPage}</td></tr>`;
  const sumRow = (label, val) => `<tr><td colspan="10" style="text-align:right;font-weight:800;padding:2px 5px;${L}">${label}</td><td style="text-align:right;padding:2px 5px;${L}border-right:1px solid #000;font-weight:700;">${val}</td></tr>`;
  const finalTrs =
    (intra ? sumRow('CGST', ttInr(half)) + sumRow('SGST', ttInr(half)) : sumRow('IGST', ttInr(tax))) +
    (Math.abs(roundOff) >= 0.005 ? sumRow('ROUND OFF', ttInr(roundOff)) : '') +
    (courierCharge > 0 ? sumRow(opt.courierLabel || 'Courier / Transport Charges', ttInr(courTax ? courTaxable : courierCharge)) : '') +
    `<tr style="height:10px;"><td colspan="11" style="${L}border-right:1px solid #000;"></td></tr>
     <tr><td colspan="4" style="${B}text-align:right;font-weight:800;padding:3px 5px;">Total</td><td style="${B}text-align:right;font-weight:800;padding:3px 5px;">${items.reduce((s, i) => s + i.qty, 0)} PCS</td><td colspan="5" style="${B}"></td><td style="${B}text-align:right;font-weight:800;font-size:13px;padding:3px 5px;">₹ ${ttInr(total)}</td></tr>`;
  const finalBlocks = `
    <div style="padding:4px 6px;display:flex;justify-content:space-between;"><span>Amount Chargeable (in words)<br><strong style="font-size:12px;">${ttWords(total)}</strong></span><span style="font-size:10px;">E. &amp; O.E</span></div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;text-align:right;border-top:1px solid #000;">
      <thead><tr><th style="${B}${cell}text-align:center;" rowspan="2">HSN/SAC</th><th style="${B}${cell}" rowspan="2">Taxable Value</th>${intra ? `<th style="${B}${cell}text-align:center;" colspan="2">CGST</th><th style="${B}${cell}text-align:center;" colspan="2">SGST/UTGST</th>` : `<th style="${B}${cell}text-align:center;" colspan="4">IGST</th>`}<th style="${B}${cell}" rowspan="2">Total Tax Amount</th></tr>
      <tr>${intra ? '<th style="border:1px solid #000;padding:2px 4px;">Rate</th><th style="border:1px solid #000;padding:2px 4px;">Amount</th><th style="border:1px solid #000;padding:2px 4px;">Rate</th><th style="border:1px solid #000;padding:2px 4px;">Amount</th>' : '<th colspan="2" style="border:1px solid #000;">Rate</th><th colspan="2" style="border:1px solid #000;">Amount</th>'}</tr></thead>
      <tbody>${hsRows}<tr style="font-weight:800;"><td style="${B}${cell}text-align:right;">Total</td><td style="${B}${cell}">${ttInr(hsTot)}</td><td style="${B}${cell}" colspan="4">${ttInr(hsTax)}</td><td style="${B}${cell}">${ttInr(hsTax)}</td></tr></tbody>
    </table>
    <div style="padding:4px 6px;border-top:1px solid #000;">Tax Amount (in words) : <strong>${ttWords(hsTax)}</strong></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">
      <div style="padding:5px 6px;font-size:10px;"><u>Declaration</u><br>We declare that this ${opt.doc || 'invoice'} shows the actual price of the goods described and that all particulars are true and correct.
        ${opt.noRecv ? '' : `<div style="margin-top:6px;">Received: <strong>₹${ttInr(o.recvAmount)}</strong> &nbsp; Balance Due: <strong style="color:#b91c1c;">₹${ttInr(o.dueAmount)}</strong></div>`}${(!opt.noRecv && o.prevDueOn && Number(o.prevDueAmt) > 0) ? `<div style="margin-top:3px;">Previous Due: <strong>₹${ttInr(o.prevDueAmt)}</strong> &nbsp; Total Outstanding: <strong style="color:#b91c1c;">₹${ttInr((Number(o.dueAmount) || 0) + (Number(o.prevDueAmt) || 0))}</strong></div>` : ''}</div>
      <div style="padding:5px 6px;border-left:1px solid #000;font-size:10.5px;"><strong>Company's Bank Details</strong><br>${window.ttBankLines ? ttBankLines() : 'Bank Name : ICICI BANK AC-150005501249<br>A/c No. : 150005501249<br>Branch &amp; IFS Code : CUTTACK ROAD &amp; ICIC0001500'}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;min-height:60px;">
      <div style="padding:5px 6px;font-size:10px;">Customer's Seal and Signature</div>
      <div style="padding:5px 6px;border-left:1px solid #000;text-align:right;font-size:10.5px;">for <strong>TWINTOWN EXPRESS SERVICES PVT LTD</strong><br><br><br>Authorised Signatory</div>
    </div>
    ${opt.terms || TT_TERMS_INVOICE}`;
  return ttPaginate({ head, colgroup, thead, rows, amounts, ncols: 11, cont, finalTrs, finalBlocks, footnote: opt.footnote || 'This is a Computer Generated Invoice' });
}

/* ---------- QUOTATION ---------- */
function buildQuotationHtml(q) {
  try { return ttBuildQuotationPaged(q); }
  catch (e) { console.error('Paged quotation failed, legacy layout', e); return buildQuotationHtmlLegacy(q); }
}
window.buildQuotationHtml = buildQuotationHtml;

function ttBuildQuotationPaged(q) {
  // v18: Quotation ab bilkul Invoice jaisi (columns, tax, split pages, HSN summary) - sirf title/number/terms alag
  var items = (q.items || []).map(function (i) {
    var qty = Number(i.qty) || 0, rate = Number(i.rate) || 0, disc = Number(i.disc) || 0;
    return { id: i.id, name: i.name, hsn: i.hsn, desc: i.desc, specs: i.specs, qty: qty, mrp: rate, disc: disc, rate: rate * (1 - disc / 100), total: qty * rate * (1 - disc / 100) };
  });
  var o = { id: q.id, customerName: q.custName, phone: q.custPhone || '', orderDate: q.date, items: items,
    totalAmount: Number(q.final) || 0, courierCharge: Number(q.svc) || 0, taxType: 'INTRA', payMode: q.payMode || '',
    bookedBy: q.createdBy || (typeof currentUser !== 'undefined' && currentUser ? currentUser.name : ''), recvAmount: 0, dueAmount: 0 };
  return ttBuildInvoicePaged(o, { title: 'QUOTATION', noLabel: 'Quotation No.', byLabel: 'Prepared By', delivery: '100% Advance',
    courierLabel: 'Service & Travel Charges', doc: 'quotation', noRecv: true, noOrderDate: true, terms: TT_TERMS_QUOTE,
    footnote: 'This is a Computer Generated Quotation', party: { address: q.custAddr || '', gst: q.custGst || '' } });
}
function ttBuildQuotationPagedOld(q) {
  const B = 'border:1px solid #000;';
  const cell = 'padding:3px 5px;vertical-align:top;';
  const L = 'border-left:1px solid #000;';
  const meta = (l, v) => `<div style="${B}border-width:0 0 1px 1px;padding:2px 5px;min-height:28px;"><div style="font-size:9.5px;">${l}</div><div style="font-weight:700;font-size:11px;">${v || ''}</div></div>`;
  const rows = q.items.map((i, n) => `<tr>
    <td style="${cell}${L}text-align:center;">${n + 1}</td>
    <td style="${cell}${L}word-wrap:break-word;">${ttEscHtml(i.name)}${(i.desc || i.specs) ? `<div style="font-size:7.5px;line-height:1.25;color:#333;margin-top:2px;white-space:pre-wrap;">${i.desc ? ttH(i.desc) : ''}${(i.desc && i.specs) ? '\n' : ''}${i.specs ? '<b>Technical:</b> ' + ttH(i.specs) : ''}</div>` : ''}</td>
    <td style="${cell}${L}text-align:center;">${ttEscHtml(i.hsn)}</td>
    <td style="${cell}${L}text-align:center;">18</td>
    <td style="${cell}${L}text-align:center;">${i.qty}</td>
    <td style="${cell}${L}text-align:right;">${ttInr(i.rate)}</td>
    <td style="${cell}${L}text-align:center;">${ttFmtDisc(i.disc)}</td>
    <td style="${cell}${L}text-align:right;">${ttInr((Number(i.rate) || 0) * (1 - (Number(i.disc) || 0) / 100))}</td>
    <td style="${cell}${L}text-align:center;">Nos</td>
    <td style="${cell}${L}border-right:1px solid #000;text-align:right;">₹${ttInr(i.amount)}</td></tr>`);
  const amounts = q.items.map(i => Number(i.amount) || 0);
  const head = (pageNo) => ttDocHead('QUOTATION', pageNo, '(ORIGINAL FOR RECIPIENT)') + `
    <div style="display:grid;grid-template-columns:1.25fr 1fr;">
      <div style="padding:5px 6px;border-bottom:1px solid #000;">
        <strong style="font-size:12.5px;">TWINTOWN EXPRESS SERVICES PVT LTD</strong><br>
        PLOT:1270/8566, SATYA VIHAR, RASHULGARH,<br>BHUBANESWAR-751010<br>
        Ph-8917465040 / 6743175599<br>GSTIN/UIN: 21AAICT6014E1ZT<br>State Name : Odisha, Code : 21<br>E-Mail : info@ttespl.com
      </div>
      <div style="border-left:1px solid #000;display:grid;grid-template-columns:1fr 1fr;">
        ${meta('Quotation No.', ttEscHtml(q.id))}${meta('Dated', ttEscHtml(q.date))}
        ${meta('Mode/Terms of Payment', ttEscHtml(q.payMode))}${meta('Terms of Delivery', '100% Advance')}
      </div>
    </div>
    <div style="padding:5px 6px;border-top:1px solid #000;border-bottom:1px solid #000;">
      <span style="font-size:9.5px;">Consignee / Buyer (Bill to)</span><br>
      <strong>${ttEscHtml(q.custName)}</strong><br>${ttEscHtml(q.custAddr || '')}<br>${q.custPhone ? 'Contact: ' + ttEscHtml(q.custPhone) + '<br>' : ''}
      GSTIN/UIN : ${ttEscHtml(q.custGst || 'Unregistered')}
    </div>`;
  const colgroup = '<colgroup><col style="width:4%"><col style="width:27%"><col style="width:9%"><col style="width:5%"><col style="width:6%"><col style="width:11%"><col style="width:6%"><col style="width:11%"><col style="width:6%"><col style="width:15%"></colgroup>';
  const thead = `<thead><tr style="text-align:center;">
        <th style="${B}${cell}">SI No.</th><th style="${B}${cell}">Description of Goods</th><th style="${B}${cell}">HSN/SAC</th>
        <th style="${B}${cell}">GST Rate</th><th style="${B}${cell}">Qty.</th><th style="${B}${cell}">MRP</th>
        <th style="${B}${cell}">Disc. %</th><th style="${B}${cell}">Rate (Incl. of Tax)</th><th style="${B}${cell}">per</th><th style="${B}${cell}">Amount</th></tr></thead>`;
  const cont = (sub, nextPage) => `<tr><td colspan="9" style="${B}border-width:1px 0 0 1px;text-align:right;font-weight:700;padding:3px 5px;">Sub-total (carried forward)</td><td style="${B}border-width:1px 1px 0 1px;text-align:right;font-weight:700;padding:3px 5px;">₹${ttInr(sub)}</td></tr>
    <tr><td colspan="10" style="${B}border-width:0 1px 1px 1px;text-align:right;font-style:italic;padding:3px 6px;">continued to page number ${nextPage}</td></tr>`;
  const trow = (a, b, extra) => `<div style="display:flex;justify-content:space-between;padding:2px 6px;border-left:1px solid #000;border-top:1px solid #000;${extra || ''}"><span>${a}</span><strong>${b}</strong></div>`;
  const finalBlocks = `
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">
      <div></div>
      <div>
        <div style="display:flex;justify-content:space-between;padding:2px 6px;border-left:1px solid #000;"><span>Total Without GST</span><strong>₹${ttInr(q.totalNoGst)}</strong></div>
        ${trow('Out Put CGST @ 9%', '₹' + ttInr(q.cgst))}${trow('Out Put SGST @ 9%', '₹' + ttInr(q.sgst))}
        ${trow('Service &amp; travel charges', '₹' + ttInr(q.svc), 'background:#eef4e8;')}${trow('Round Off', '₹' + ttInr(q.roundOff))}
        <div style="display:flex;justify-content:space-between;padding:4px 6px;border-left:1px solid #000;border-top:1px solid #000;font-weight:800;font-size:13px;"><span>Total</span><strong>₹${q.final.toLocaleString('en-IN')}</strong></div>
      </div>
    </div>
    <div style="padding:4px 6px;border-top:1px solid #000;">Amount (in words)<br><strong style="font-size:12px;">${ttWords(q.final)}</strong></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">
      <div style="padding:5px 6px;font-size:10px;"><strong>Company's Bank Details</strong><br>A/c Name: TWINTOWN EXPRESS SERVICES PVT LTD<br>Bank Name: ICICI BANK (CUTTACK ROAD)<br>A/c No. &amp; IFSC: 150005501249 | ICIC0001500</div>
      <div style="padding:5px 6px;border-left:1px solid #000;text-align:right;font-size:10.5px;">for <strong>TWINTOWN EXPRESS SERVICES PVT LTD</strong><br><br><br>Authorised Signatory</div>
    </div>
    ${TT_TERMS_QUOTE}`;
  return ttPaginate({ head, colgroup, thead, rows, amounts, ncols: 10, cont, finalTrs: '', finalBlocks, footnote: 'This is a Computer Generated Quotation' });
}

/* ===== v13: smoothness guards ===== */
(function () {
  try {
    var amb = document.getElementById('ttAmbient');
    if (!amb) return;
    // Kamzor/budget phone: orbs static rahenge (look same, animation band)
    var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 3);
    if (weak) amb.classList.add('lite');
    // Scroll ke dauraan animation ruk jaye - scroll hamesha 60fps
    var t = 0;
    window.addEventListener('scroll', function () {
      if (!amb.classList.contains('scrolling')) amb.classList.add('scrolling');
      clearTimeout(t); t = setTimeout(function () { amb.classList.remove('scrolling'); }, 220);
    }, { passive: true, capture: true });
  } catch (e) {}
})();

/* =====================================================================
   v14 FEATURES: WhatsApp PDF share, Customer Dashboard, Item Sales History,
   7-day Backup reminder, Quotation follow-up sequence, Brand pages + local PDF viewer
   (purana koi function delete nahi kiya - sirf wrap/extend)
   ===================================================================== */
var brandsData = getStored("BRANDS", []);
window.brandsData = brandsData;
window.ttRenderBrandsIfOpen = function () {
  var m = document.getElementById('tt14BrandModal');
  if (m && m.style.display === 'flex' && typeof window.ttBrandsRerender === 'function') window.ttBrandsRerender();
};

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var INR = function (n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); };
  var last10 = function (p) { return String(p || '').replace(/\D/g, '').slice(-10); };
  var isAdm = function () { try { return typeof isAdminUser === 'function' && isAdminUser(); } catch (e) { return false; } };
  var meName = function () { try { return (currentUser && currentUser.name) || ''; } catch (e) { return ''; } };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };

  function notice(title, body, icon, onClick) {
    var c = $('broadcastToastContainer');
    if (!c) return;
    var t = document.createElement('div');
    t.className = 'broadcast-toast tt-toast-success';
    t.innerHTML = '<div class="toast-content"><div class="toast-icon">' + (icon || '✅') + '</div><div style="flex:1;"><div class="toast-title">' + H(title) +
      '</div><div class="toast-body">' + H(body) + '</div></div><button class="toast-close" onclick="this.closest(\'.broadcast-toast\').remove()">✕</button></div>';
    if (onClick) t.querySelector('.toast-content').addEventListener('click', function (e) {
      if (e.target.closest('.toast-close')) return; t.remove(); onClick();
    });
    c.prepend(t);
    setTimeout(function () { if (t.parentElement) t.remove(); }, 8000);
  }
  function ensureModal(id, z, maxW) {
    var m = $(id);
    if (!m) {
      m = document.createElement('div');
      m.id = id; m.className = 'auth-overlay'; m.style.display = 'none'; m.style.zIndex = String(z || 3200);
      m.innerHTML = '<div class="auth-card tt14-card" style="max-width:' + (maxW || 560) + 'px;"></div>';
      document.body.appendChild(m);
    }
    return m;
  }
  function setModal(m, html) { m.firstChild.innerHTML = html; }
  function closeM(id) { var m = $(id); if (m) m.style.display = 'none'; }
  window.tt14Close = closeM;
  function waUrl(phone, text) {
    var p = last10(phone);
    return (p ? 'https://wa.me/91' + p : 'https://wa.me/') + '?text=' + encodeURIComponent(text);
  }
  function downloadBlob(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }

  /* ================= 1. PDF ENGINE (koi external library nahi - offline bhi chalega) ================= */
  function buildPdf(pages) {
    var enc = new TextEncoder(), parts = [], len = 0, offs = [];
    function push(x) { var u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; }
    var PW = 595.28, PH = 841.89, n = pages.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + 3 * i) + ' 0 R');
    push('%PDF-1.4\n%âãÏÓ\n');
    offs[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offs[2] = len; push('2 0 obj\n<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>\nendobj\n');
    pages.forEach(function (p, i) {
      var pid = 3 + 3 * i, cid = 4 + 3 * i, iid = 5 + 3 * i;
      var ih = Math.min(PH, PW * p.h / p.w);
      var content = 'q ' + PW.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' 0 ' + (PH - ih).toFixed(2) + ' cm /Im0 Do Q';
      offs[pid] = len;
      push(pid + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>\nendobj\n');
      offs[cid] = len;
      push(cid + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n');
      offs[iid] = len;
      push(iid + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.data.length + ' >>\nstream\n');
      push(p.data);
      push('\nendstream\nendobj\n');
    });
    var total = 3 + 3 * n, xref = len, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var k = 1; k < total; k++) x += String(offs[k]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('img-load')); }; im.src = src;
    });
  }
  async function sheetsToPdf(html) {
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-12000px;top:0;width:210mm;pointer-events:none;';
    host.innerHTML = html; document.body.appendChild(host);
    try {
      var sheets = [].slice.call(host.querySelectorAll('.tt-sheet'));
      if (!sheets.length) throw new Error('no-sheets');
      var pages = [], SC = 2;
      for (var i = 0; i < sheets.length; i++) {
        var el = sheets[i], r = el.getBoundingClientRect(), W = Math.round(r.width), Hh = Math.round(r.height);
        var clone = el.cloneNode(true); clone.style.margin = '0'; clone.style.boxShadow = 'none';
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + Hh + '"><foreignObject x="0" y="0" width="' + W + '" height="' + Hh + '">' +
          new XMLSerializer().serializeToString(clone) + '</foreignObject></svg>';
        var img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
        var cv = document.createElement('canvas'); cv.width = W * SC; cv.height = Hh * SC;
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
        cx.scale(SC, SC); cx.drawImage(img, 0, 0, W, Hh);
        var blob = await new Promise(function (res) { cv.toBlob(res, 'image/jpeg', 0.92); });
        if (!blob) throw new Error('toBlob');
        pages.push({ data: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height });
        cv.width = cv.height = 0;
        await new Promise(function (res) { setTimeout(res, 0); });
      }
      return buildPdf(pages);
    } finally { host.remove(); }
  }
  window.ttSheetsToPdf = sheetsToPdf;

  window.ttShareDoc = function (o) {
    var m = ensureModal('tt14ShareModal', 3500, 420);
    window.__tt14Share = o;
    setModal(m,
      '<div class="card-header"><span class="card-title">📤 ' + H(o.title) + '</span><button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt14ShareModal\')">✕</button></div>' +
      '<div id="tt14ShStatus" class="tt14-status">⏳ Creating the PDF…</div>' +
      '<button class="btn btn-wa btn-block" onclick="triggerAppHaptic(); tt14ShareGo(\'wa\')">📎 Send PDF on WhatsApp</button>' +
      '<button class="btn btn-primary btn-block" style="margin-top:8px;" onclick="triggerAppHaptic(); tt14ShareGo(\'save\')">💾 Save PDF to Phone</button>' +
      '<button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="triggerAppHaptic(); tt14ShareGo(\'text\')">💬 Text Only (WhatsApp message)</button>' +
      '<button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="triggerAppHaptic(); tt14ShareGo(\'print\')">🖨️ Print / Save as PDF</button>');
    m.style.display = 'flex';
    o._blob = null; o._err = null;
    var st = function (t) { var e = $('tt14ShStatus'); if (e) e.innerHTML = t; };
    o._p = sheetsToPdf(o.html()).then(function (b) {
      o._blob = b; st('✅ PDF ready (' + Math.max(1, Math.round(b.size / 1024)) + ' KB)'); return b;
    }).catch(function (e) {
      o._err = e; console.warn('PDF build fail', e);
      st('⚠️ The PDF could not be created directly - use <b>Print / Save as PDF</b> or <b>Text</b>.'); return null;
    });
  };
  window.tt14ShareGo = async function (mode) {
    var o = window.__tt14Share; if (!o) return;
    if (mode === 'text') { closeM('tt14ShareModal'); try { o.textFn(); } catch (e) { console.error(e); } return; }
    if (mode === 'print') { closeM('tt14ShareModal'); try { o.printFn(); } catch (e) { console.error(e); } return; }
    var blob = await o._p;
    if (!blob) { closeM('tt14ShareModal'); try { o.printFn(); } catch (e) {} return; }
    if (mode === 'save') { downloadBlob(blob, o.fileName); notice('PDF save', o.fileName + ' downloaded', '💾'); return; }
    var file = null;
    try { file = new File([blob], o.fileName, { type: 'application/pdf' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: o.title, text: o.msg }); closeM('tt14ShareModal'); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    downloadBlob(blob, o.fileName);
    closeM('tt14ShareModal');
    notice('PDF ready', 'PDF downloaded - attach it with 📎 in WhatsApp and send', '📎');
    setTimeout(function () { window.open(waUrl(o.phone, o.msg), '_blank'); }, 700);
  };

  /* Invoice share: purana text-share function safe rakha (shareOrderWhatsAppText) */
  var _origOrderShare = window.shareOrderWhatsApp;
  window.shareOrderWhatsAppText = _origOrderShare;
  window.shareOrderWhatsApp = function (ordId) {
    var o = (ordersData || []).find(function (x) { return String(x.id) === String(ordId); });
    if (!o || typeof buildTallyInvoiceHtml !== 'function') return _origOrderShare && _origOrderShare(ordId);
    ttShareDoc({
      title: 'Invoice ' + o.id, fileName: 'TTESPL_Invoice_' + o.id + '.pdf', phone: o.phone,
      msg: 'Hello ' + (o.customerName || '') + ',\nPlease find attached the PDF of Invoice ' + o.id + ' (Total ' + INR(o.totalAmount) + ') from Twin Town Express Services Pvt Ltd.\nThank you!',
      html: function () { return buildTallyInvoiceHtml(o); },
      textFn: function () { _origOrderShare(ordId); },
      printFn: function () { ttPrintHtml('Tax Invoice ' + o.id, buildTallyInvoiceHtml(o)); }
    });
  };
  var _origOpenInv = window.openInvoicePrintModal;
  window.openInvoicePrintModal = function (ordId) { window.__ttCurInvoiceId = ordId; return _origOpenInv.apply(this, arguments); };
  window.ttShareCurrentInvoice = function () { if (window.__ttCurInvoiceId != null) window.shareOrderWhatsApp(window.__ttCurInvoiceId); };

  function quotShare(q) {
    ttShareDoc({
      title: 'Quotation ' + q.id, fileName: 'TTESPL_Quotation_' + q.id + '.pdf', phone: q.custPhone,
      msg: 'Hello ' + (q.custName || '') + ',\nPlease find attached the PDF of Quotation ' + q.id + ' (Total ' + INR(q.final) + ') from Twin Town Express Services Pvt Ltd.\nThank you!',
      html: function () { return buildQuotationHtml(q); },
      textFn: function () { ttNativeShareOrFallback({ title: 'TTESPL Quotation ' + q.id, text: ttQuotPlain(q) }, function () { ttPrintHtml('Quotation ' + q.id, buildQuotationHtml(q)); }); },
      printFn: function () { ttPrintHtml('Quotation ' + q.id, buildQuotationHtml(q)); }
    });
  }
  var _origPrintQuotation = window.printQuotation;
  window.printQuotationTextOnly = _origPrintQuotation;
  window.printQuotation = function () {
    var form = ttCollectQuotationForm(); if (!form) return;
    quotShare(ttPersistQuotation(form));
  };
  var _origShareQRec = window.ttShareQuotationRecord;
  window.ttShareQuotationRecordText = _origShareQRec;
  window.ttShareQuotationRecord = function (id) {
    var q = (quotationsData || []).find(function (x) { return x && x.id === id; });
    if (!q) return; quotShare(q);
  };

  /* ================= 2. CUSTOMER DASHBOARD (Master Data) ================= */
  function custOrders(c) {
    var p = last10(c.phone), n = String(c.name || '').trim().toLowerCase();
    return (ordersData || []).filter(function (o) {
      if (!o) return false;
      if (p && last10(o.phone) === p) return true;
      return !!n && String(o.customerName || '').trim().toLowerCase() === n;
    });
  }
  function stBadge(s) { return s === 'Delivered' ? 'badge-delivered' : (s === 'Cancelled' ? 'badge-danger' : 'badge-info'); }
  window.ttCustDash = function (id) {
    var c = (customerDatabase || []).find(function (x) { return String(x.id) === String(id); });
    if (!c) return;
    var all = custOrders(c), orders = all.filter(function (o) { return o.status !== 'Cancelled'; });
    var billed = 0, recv = 0, due = 0, pays = [];
    orders.forEach(function (o) {
      billed += Number(o.totalAmount) || 0; recv += Number(o.recvAmount) || 0; due += Number(o.dueAmount) || 0;
      var arr = Array.isArray(o.payments) ? o.payments : [], sum = 0;
      arr.forEach(function (p) {
        sum += Number(p.amount) || 0;
        pays.push({ date: String(p.at || '').slice(0, 10) || o.orderDate || '', amt: Number(p.amount) || 0, mode: p.mode || '', ref: o.id, by: p.by || '' });
      });
      var first = (Number(o.recvAmount) || 0) - sum;
      if (first > 0) pays.push({ date: o.orderDate || '', amt: first, mode: o.payMode || '', ref: o.id, by: o.bookedBy || '', adv: true });
    });
    pays.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var sorted = all.slice().sort(function (a, b) { return String(b.orderDate || '').localeCompare(String(a.orderDate || '')); });
    var qs = (quotationsData || []).filter(function (q) {
      return q && ((last10(c.phone) && last10(q.custPhone) === last10(c.phone)) || String(q.custName || '').trim().toLowerCase() === String(c.name || '').trim().toLowerCase());
    }).sort(function (a, b) { return (b.serial || 0) - (a.serial || 0); });
    var dates = orders.map(function (o) { return o.orderDate || ''; }).filter(Boolean).sort();
    var h = [];
    h.push('<div class="card-header"><div style="min-width:0;"><span class="card-title" style="display:block;">📊 ' + H(c.name) + '</span>' +
      '<div style="font-size:11.5px;color:var(--text-muted);">' + H(c.phone || '') + (c.address ? ' • ' + H(c.address) : '') + (c.gst && c.gst !== 'Unregistered' ? ' • GST ' + H(c.gst) : '') + '</div></div>' +
      '<button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt14CustModal\')">✕</button></div>');
    h.push('<div class="tt14-tiles"><div><small>ORDERS</small><b>' + orders.length + '</b></div><div><small>BILLED</small><b>' + INR(billed) + '</b></div>' +
      '<div><small>RECEIVED</small><b style="color:var(--success,#16a34a);">' + INR(recv) + '</b></div><div><small>DUE</small><b style="color:' + (due > 0 ? 'var(--danger,#e11d48)' : 'var(--success,#16a34a)') + ';">' + INR(due) + '</b></div></div>');
    h.push('<div style="font-size:11.5px;color:var(--text-muted);margin:8px 0;">First order: <b>' + H(dates[0] || '-') + '</b> • Last order: <b>' + H(dates[dates.length - 1] || '-') + '</b> • Quotations: <b>' + qs.length + '</b></div>');
    h.push('<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">' +
      (c.phone ? '<a class="btn btn-outline btn-sm" style="flex:1;text-align:center;text-decoration:none;" href="tel:' + H(last10(c.phone)) + '">📞 Call</a>' : '') +
      (due > 0 ? '<button class="btn btn-wa btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttCustDueMsg(\'' + H(c.id) + '\')">💬 Due Reminder (' + INR(due) + ')</button>' : '') + '</div>');
    h.push('<div class="tt14-sec">📦 Orders (date-wise)</div>');
    if (!sorted.length) h.push('<div class="tt14-empty">This customer has no orders yet.</div>');
    sorted.slice(0, 60).forEach(function (o) {
      var names = (o.items || []).map(function (i) { return i.name; });
      h.push('<div class="tt14-row"><div style="display:flex;justify-content:space-between;gap:8px;"><div><b>' + H(o.orderDate || '-') + '</b> • ' + H(o.id) +
        ' <span class="badge ' + stBadge(o.status) + '" style="font-size:9.5px;">' + H(o.status || '') + '</span></div><b>' + INR(o.totalAmount) + '</b></div>' +
        '<div class="tt14-sub">' + H(names.slice(0, 3).join(', ')) + (names.length > 3 ? ' +' + (names.length - 3) + ' more' : '') + '</div>' +
        '<div class="tt14-sub">Paid <b>' + INR(o.recvAmount) + '</b> • Due <b style="color:' + ((o.dueAmount || 0) > 0 ? 'var(--danger,#e11d48)' : 'inherit') + ';">' + INR(o.dueAmount) + '</b></div></div>');
    });
    if (sorted.length > 60) h.push('<div class="tt14-empty">…and ' + (sorted.length - 60) + ' older orders</div>');
    h.push('<div class="tt14-sec">💰 Payment Timeline</div>');
    if (!pays.length) h.push('<div class="tt14-empty">No payment records yet.</div>');
    pays.slice(0, 80).forEach(function (p) {
      h.push('<div class="tt14-row" style="display:flex;justify-content:space-between;gap:8px;"><div><b>' + H(p.date || '-') + '</b> • ' + H(p.ref) +
        '<div class="tt14-sub">' + H(p.adv ? 'At the time of order' : 'Due collect') + (p.mode ? ' • ' + H(p.mode) : '') + (p.by ? ' • ' + H(p.by) : '') + '</div></div>' +
        '<b style="color:var(--success,#16a34a);">+ ' + INR(p.amt) + '</b></div>');
    });
    if (qs.length) {
      h.push('<div class="tt14-sec">📝 Quotations</div>');
      qs.slice(0, 20).forEach(function (q) {
        h.push('<div class="tt14-row" style="display:flex;justify-content:space-between;gap:8px;"><div><b>' + H(q.id) + '</b> • ' + H(q.date || '') +
          (q.fuStatus ? ' • ' + (q.fuStatus === 'won' ? '✅ Won' : '❌ Lost') : '') + '</div><b>' + INR(q.final) + '</b></div>');
      });
    }
    var m = ensureModal('tt14CustModal', 3200, 600);
    setModal(m, h.join('')); m.style.display = 'flex';
  };
  window.ttCustDueMsg = function (id) {
    var c = (customerDatabase || []).find(function (x) { return String(x.id) === String(id); }); if (!c) return;
    var due = custOrders(c).filter(function (o) { return o.status !== 'Cancelled' && (o.dueAmount || 0) > 0; });
    var tot = due.reduce(function (s, o) { return s + (Number(o.dueAmount) || 0); }, 0);
    var msg = 'Hello ' + c.name + ',\nThis is a reminder from Twin Town Express Services Pvt Ltd (Rasulgarh, BBSR) that an amount of ' + INR(tot) +
      ' is outstanding (Invoice: ' + due.map(function (o) { return window.ttInvNo ? ttInvNo(o) : o.id; }).join(', ') + ').\nKindly pay at the earliest. Let us know if you need our UPI / bank details.\nThank you!';
    window.open(waUrl(c.phone, msg), '_blank');
  };

  /* ================= 3. ITEM SALES HISTORY (Stock detail) ================= */
  window.ttRenderItemSales = function (id) {
    var box = $('detSalesHistory'); if (!box) return;
    var item = (sampleInventory || []).find(function (x) { return String(x.id) === String(id); });
    if (!item) { box.innerHTML = ''; return; }
    var nm = String(item.name || '').trim().toLowerCase(), rows = [];
    (ordersData || []).forEach(function (o) {
      if (!o || o.status === 'Cancelled') return;
      (o.items || []).forEach(function (it) {
        var same = (it.id != null && String(it.id) === String(item.id)) || (nm && String(it.name || '').trim().toLowerCase() === nm);
        if (same) rows.push({ date: o.orderDate || '', cust: o.customerName || '', qty: Number(it.qty) || 0, rate: Number(it.rate) || (Number(it.total) / (Number(it.qty) || 1)), total: Number(it.total) || 0, id: o.id, st: o.status });
      });
    });
    rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var sold = rows.filter(function (r) { return r.st === 'Delivered'; });
    var q = sold.reduce(function (s, r) { return s + r.qty; }, 0), rev = sold.reduce(function (s, r) { return s + r.total; }, 0);
    var pend = rows.filter(function (r) { return r.st !== 'Delivered'; }).reduce(function (s, r) { return s + r.qty; }, 0);
    if (!rows.length) { box.innerHTML = '<div class="tt14-empty">No sales for this item yet.</div>'; return; }
    var h = ['<div class="tt14-tiles" style="grid-template-columns:repeat(4,1fr);margin:4px;"><div><small>SOLD</small><b>' + q + '</b></div><div><small>REVENUE</small><b>' + INR(rev) +
      '</b></div><div><small>AVG RATE</small><b>' + INR(q ? Math.round(rev / q) : 0) + '</b></div><div><small>BOOKED</small><b>' + pend + '</b></div></div>'];
    rows.slice(0, 60).forEach(function (r) {
      h.push('<div class="tt14-row"><div style="display:flex;justify-content:space-between;gap:8px;"><div><b>' + H(r.date || '-') + '</b> • ' + H(r.cust) +
        '</div><b>' + r.qty + ' × ' + INR(Math.round(r.rate)) + '</b></div><div class="tt14-sub">' + H(r.id) + ' • ' +
        '<span class="badge ' + stBadge(r.st) + '" style="font-size:9px;">' + H(r.st || '') + '</span> • Total ' + INR(r.total) + '</div></div>');
    });
    if (rows.length > 60) h.push('<div class="tt14-empty">…and ' + (rows.length - 60) + ' older entries</div>');
    box.innerHTML = h.join('');
  };
  var _origStockDetail = window.openStockDetailModal;
  window.openStockDetailModal = function (id) {
    var r = _origStockDetail.apply(this, arguments);
    try { ttRenderItemSales(id); } catch (e) { console.error(e); }
    return r;
  };

  /* ================= 4. BACKUP REMINDER (7 din) ================= */
  var BK = 'TTESPL_ERP_LAST_BACKUP_AT', BKS = 'TTESPL_ERP_BACKUP_SNOOZE_UNTIL', WEEK = 7 * 86400000;
  var _origDlBackup = window.downloadFullBackup;
  window.downloadFullBackup = function () {
    var r = _origDlBackup.apply(this, arguments);
    lsSet(BK, String(Date.now())); var b = $('tt14BackupBar'); if (b) b.remove();
    return r;
  };
  var _origOpenBackup = window.openBackupModal;
  window.openBackupModal = function () {
    var r = _origOpenBackup.apply(this, arguments);
    try {
      var m = $('backupModal'), line = $('ttLastBackupLine');
      if (m && !line) {
        line = document.createElement('div'); line.id = 'ttLastBackupLine'; line.className = 'tt14-status';
        var first = m.querySelector('.auth-card'); if (first) first.insertBefore(line, first.children[1] || null);
      }
      var t = parseInt(lsGet(BK) || '0', 10);
      if (line) line.textContent = t ? '🕒 Last backup: ' + new Date(t).toLocaleDateString('en-GB') + ' (' + Math.floor((Date.now() - t) / 86400000) + ' din pehle)' : '🕒 No backup taken yet';
    } catch (e) {}
    return r;
  };
  function backupCheck() {
    if (!isAdm() || $('tt14BackupBar')) return;
    var t = parseInt(lsGet(BK) || '0', 10), sn = parseInt(lsGet(BKS) || '0', 10), now = Date.now();
    if (t && now - t < WEEK) return;
    if (sn && now < sn) return;
    var days = t ? Math.floor((now - t) / 86400000) : null;
    var b = document.createElement('div'); b.id = 'tt14BackupBar'; b.className = 'tt14-backup';
    b.innerHTML = '<div style="flex:1;min-width:0;"><b>💾 Backup Reminder</b><div style="font-size:11.5px;opacity:.85;">' +
      (days == null ? 'No backup taken yet.' : H(days) + ' days since the last backup.') + ' Download one now to keep your data safe.</div></div>' +
      '<button class="btn btn-primary btn-sm" id="tt14BkGo">⬇️ Take Backup</button><button class="btn btn-outline btn-sm" id="tt14BkLater">Later</button>';
    document.body.appendChild(b);
    $('tt14BkGo').onclick = function () { try { triggerAppHaptic(); } catch (e) {} downloadFullBackup(); notice('Backup', 'Backup file downloaded', '💾'); };
    $('tt14BkLater').onclick = function () { lsSet(BKS, String(Date.now() + 86400000)); b.remove(); };
  }

  /* ================= 5. QUOTATION FOLLOW-UP SEQUENCE ================= */
  var FU = [{ n: 1, d: 2 }, { n: 2, d: 5 }, { n: 3, d: 10 }];
  var DAY = 86400000;
  function dStart(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function fuInfo(q) {
    if (!q || !q.createdAt) return null;
    if (q.fuStatus === 'won' || q.fuStatus === 'lost') return { closed: q.fuStatus };
    var done = q.fuDone || {}, base = dStart(q.createdAt), today = dStart(Date.now());
    var steps = FU.map(function (s) { return { n: s.n, d: s.d, due: base + s.d * DAY, done: !!done[s.n] }; });
    var next = steps.filter(function (s) { return !s.done; })[0] || null;
    return { steps: steps, next: next, today: today, isDue: !!(next && today >= next.due), late: next ? Math.floor((today - next.due) / DAY) : 0 };
  }
  function fuMine(q) { return isAdm() || (q && q.createdBy === meName()); }
  window.ttFuNextDue = function (q) {
    var f = fuInfo(q);
    return (f && !f.closed && f.isDue && Date.now() - q.createdAt < 45 * DAY && fuMine(q)) ? f.next : null;
  };
  function fuMsg(q, step) {
    var valid = new Date((q.createdAt || Date.now()) + 30 * DAY).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    var head = 'Hello ' + (q.custName || '') + ',\nThis is Twin Town Express Services Pvt Ltd (TTESPL).\n';
    var ref = 'We sent you Quotation ' + q.id + ' (' + INR(q.final) + ').';
    if (step === 1) return head + ref + ' Have you had a chance to review it? Please let us know if you have any questions.\nThank you!';
    if (step === 2) return head + ref + ' If you need any change in items, quantity or price, let us know - we will give you our best offer.\nThank you!';
    return head + ref + ' This quotation is valid until ' + valid + '. We will process your order as soon as you confirm.\nShall we go ahead?\nThank you!';
  }
  function fuSave() { setStored("QUOTATIONS", quotationsData); try { ttRenderQuotationHistory(); } catch (e) {} fuBadge(); }
  window.ttFuStrip = function (q) {
    var f = fuInfo(q); if (!f) return '';
    var mine = fuMine(q), id = H(q.id);
    if (f.closed) {
      return '<div class="tt14-fu"><span class="tt14-pill ' + (f.closed === 'won' ? 'ok' : 'bad') + '">' + (f.closed === 'won' ? '✅ Order won' : '❌ Lost') + '</span>' +
        (mine ? '<button class="tt14-lnk" onclick="triggerAppHaptic(); ttFuSet(\'' + id + '\',\'\')">↩ Reopen</button>' : '') + '</div>';
    }
    var pills = f.steps.map(function (s) {
      return '<span class="tt14-pill ' + (s.done ? 'ok' : (s.due <= f.today ? 'due' : '')) + '">' + (s.done ? '✓ ' : '') + 'Day ' + s.d + '</span>';
    }).join('');
    var h = '<div class="tt14-fu"><div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">📞 ' + pills + '</div>';
    if (f.next) {
      var when = f.isDue ? (f.late > 0 ? '<b style="color:var(--danger,#e11d48);">' + f.late + ' days late</b>' : '<b style="color:var(--warning,#d97706);">Due today</b>')
        : new Date(f.next.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ko';
      h += '<div class="tt14-sub" style="margin-top:4px;">Follow-up #' + f.next.n + ' (Day ' + f.next.d + '): ' + when + '</div>';
    } else h += '<div class="tt14-sub" style="margin-top:4px;">All three follow-ups are done.</div>';
    if (mine) {
      h += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">' +
        (f.next ? '<button class="btn btn-wa btn-sm" style="flex:2;" onclick="triggerAppHaptic(); ttFuSend(\'' + id + '\')">📲 Send Follow-up</button>' : '') +
        '<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttFuSet(\'' + id + '\',\'won\')">✅ Won</button>' +
        '<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttFuSet(\'' + id + '\',\'lost\')">❌ Lost</button></div>';
    }
    return h + '</div>';
  };
  window.ttFuSend = function (id) {
    var q = (quotationsData || []).find(function (x) { return x && x.id === id; }); var f = fuInfo(q);
    if (!q || !f || !f.next) return;
    var n = f.next.n;
    window.open(waUrl(q.custPhone, fuMsg(q, n)), '_blank');
    q.fuDone = Object.assign({}, q.fuDone || {}); q.fuDone[n] = Date.now(); q.fuBy = meName();
    fuSave(); notice('Follow-up #' + n, q.custName + ' - marked as done', '📲');
  };
  window.ttFuSet = function (id, st) {
    var q = (quotationsData || []).find(function (x) { return x && x.id === id; }); if (!q) return;
    q.fuStatus = st || ''; q.fuBy = meName(); fuSave();
  };
  window.ttFuToggle = function () {
    window.__ttQhFuOnly = !window.__ttQhFuOnly;
    var b = $('qhFuBtn'); if (b) b.classList.toggle('btn-accent', !!window.__ttQhFuOnly);
    try { ttRenderQuotationHistory(); } catch (e) {}
  };
  window.ttFuOpen = function () { window.__ttQhFuOnly = true; openQuotationHistory(); var b = $('qhFuBtn'); if (b) b.classList.add('btn-accent'); };
  function fuCount() { return (quotationsData || []).filter(function (q) { return q && ttFuNextDue(q); }).length; }
  function fuBadge() {
    try {
      var n = fuCount();
      var it = Array.prototype.find.call(document.querySelectorAll('.profile-menu-item'), function (e) { return (e.getAttribute('onclick') || '').indexOf('openQuotationHistory') >= 0; });
      if (it) { var s = it.lastElementChild; if (s) { s.textContent = n ? '📞 ' + n + ' follow-up' : 'Edit / Resend'; s.style.color = n ? '#f59e0b' : '#a78bfa'; s.style.fontWeight = n ? '800' : ''; } }
    } catch (e) {}
    return n;
  }
  var _origRQHIO = window.ttRenderQuotHistoryIfOpen;
  window.ttRenderQuotHistoryIfOpen = function () { var r = _origRQHIO && _origRQHIO.apply(this, arguments); fuBadge(); return r; };
  function fuDailyToast() {
    var n = fuCount(); if (!n) return;
    var key = 'TTESPL_ERP_FU_TOAST_DAY', today = ttYmd(new Date());
    if (lsGet(key) === today) return; lsSet(key, today);
    notice('📞 Quotation Follow-up', n + ' quotation follow-up due - tap to view', '📞', function () { ttFuOpen(); });
  }

  /* ================= 6. BRANDS (header) + LOCAL PDF CATALOG ================= */
  var DBN = 'TTESPL_CatalogDB', STORE = 'brand_catalogs', MAXPDF = 250 * 1024 * 1024;
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DBN, 2);
      r.onupgradeneeded = function (e) {
        var db = e.target.result;
        var st = db.objectStoreNames.contains(STORE) ? e.target.transaction.objectStore(STORE) : db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        if (!st.indexNames.contains('brand')) st.createIndex('brand', 'brand', { unique: false });
      };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function idbReq(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, mode), out = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
        tx.onerror = function () { rej(tx.error); }; tx.onabort = function () { rej(tx.error || new Error('abort')); };
      });
    });
  }
  function pdfList(brand) { return idbReq('readonly', function (s) { return s.indexNames.contains('brand') ? s.index('brand').getAll(brand) : s.getAll(); }).then(function (a) { return (a || []).filter(function (r) { return r && r.brand === brand; }); }).then(function (a) { return (a || []).sort(function (x, y) { return String(y.uploadedAt).localeCompare(String(x.uploadedAt)); }); }); }
  function pdfGet(id) { return idbReq('readonly', function (s) { return s.get(id); }); }
  function pdfDel(id) { return idbReq('readwrite', function (s) { return s.delete(id); }); }
  function pdfAdd(rec) { return idbReq('readwrite', function (s) { return s.add(rec); }); }
  function pdfDelBrand(brand) { return pdfList(brand).then(function (a) { return Promise.all(a.map(function (r) { return pdfDel(r.id); })); }); }

  var curBrand = null; // detail me khula brand id
  function brandById(id) { return (brandsData || []).find(function (b) { return b && String(b.id) === String(id); }); }
  function logoHtml(b, sz) {
    sz = sz || 46;
    return b.logo ? '<img class="tt14-logo" style="width:' + sz + 'px;height:' + sz + 'px;" src="' + H(b.logo) + '" alt="">'
      : '<div class="tt14-logo tt14-logo-ph" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * 0.42) + 'px;">' + H(String(b.name || '?').trim().slice(0, 2).toUpperCase()) + '</div>';
  }
  window.ttOpenBrands = function () { curBrand = null; var m = ensureModal('tt14BrandModal', 3300, 640); renderBrandList(); m.style.display = 'flex'; };
  window.ttBrandsRerender = function () { if ($('tt14BrandForm')) return; if (curBrand) { if (brandById(curBrand)) renderBrandDetail(curBrand); else renderBrandList(); } else if (!$('tt14BrandForm')) renderBrandList(); };
  function renderBrandList() {
    curBrand = null;
    var m = ensureModal('tt14BrandModal', 3300, 640), list = (brandsData || []).filter(Boolean).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var h = ['<div class="card-header"><span class="card-title">🏢 Our Brands</span><div style="display:flex;gap:6px;">' +
      (isAdm() ? '<button class="btn btn-accent btn-sm" onclick="triggerAppHaptic(); ttBrandForm(\'\')">+ Add Brand</button>' : '') +
      '<button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt14BrandModal\')">✕</button></div></div>'];
    if (!list.length) {
      h.push('<div class="tt14-empty" style="padding:18px 8px;">No brands added yet.' + (isAdm() ? '<br>Use quick add below or tap <b>+ Add Brand</b>:' : '') + '</div>');
      if (isAdm()) h.push('<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">' + ['Annovi Reverberi', 'Ma-Fra', 'Maniac Line', 'Maxshine', 'Vista', 'Fireball'].map(function (n) {
        return '<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttBrandForm(\'\',\'' + H(n) + '\')">+ ' + H(n) + '</button>'; }).join('') + '</div>');
    }
    list.forEach(function (b) {
      h.push('<div class="tt14-brand" onclick="triggerAppHaptic(); ttBrandOpen(\'' + H(b.id) + '\')">' + logoHtml(b, 48) +
        '<div style="min-width:0;flex:1;"><b style="font-size:14px;display:block;">' + H(b.name) + '</b><div class="tt14-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        H(b.tagline || b.about || 'Tap to view details / catalog') + '</div></div><span style="opacity:.5;">›</span></div>');
    });
    if (isAdm()) {
      var have = {}; list.forEach(function (b) { have[String(b.name || '').trim().toLowerCase()] = 1; });
      var sug = ['Annovi Reverberi', 'Ma-Fra', 'Maniac Line', 'Maxshine', 'Vista', 'Fireball'].filter(function (n) { return !have[n.toLowerCase()]; });
      h.push('<button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="triggerAppHaptic(); ttBrandForm(\'\')">➕ Add New Brand</button>');
      if (sug.length && list.length) h.push('<div class="tt14-sub" style="margin:10px 2px 4px;">Quick add:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + sug.map(function (n) {
        return '<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttBrandForm(\'\',\'' + H(n) + '\')">+ ' + H(n) + '</button>'; }).join('') + '</div>');
    }
    setModal(m, h.join(''));
  }
  window.ttBrandOpen = function (id) { curBrand = id; renderBrandDetail(id); };
  window.ttBrandBack = function () { renderBrandList(); };
  function renderBrandDetail(id) {
    var b = brandById(id); if (!b) return renderBrandList();
    var m = ensureModal('tt14BrandModal', 3300, 640);
    var row = function (ic, v, href) { return v ? '<div class="tt14-kv"><span>' + ic + '</span>' + (href ? '<a href="' + H(href) + '" target="_blank" rel="noopener">' + H(v) + '</a>' : '<div>' + H(v) + '</div>') + '</div>' : ''; };
    var site = b.website ? (/^https?:/i.test(b.website) ? b.website : 'https://' + b.website) : '';
    setModal(m,
      '<div class="card-header"><button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttBrandBack()">← Brands</button><div style="display:flex;gap:6px;">' +
      (isAdm() ? '<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttBrandForm(\'' + H(b.id) + '\')">✏️ Edit</button>' : '') +
      '<button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt14BrandModal\')">✕</button></div></div>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">' + logoHtml(b, 64) + '<div style="min-width:0;"><b style="font-size:17px;display:block;">' + H(b.name) + '</b>' +
      (b.tagline ? '<div class="tt14-sub">' + H(b.tagline) + '</div>' : '') + '</div></div>' +
      (b.about ? '<div class="tt14-about">' + H(b.about).replace(/\n/g, '<br>') + '</div>' : '') +
      row('👤', b.contact) + row('📞', b.phone, b.phone ? 'tel:' + last10(b.phone) : '') + row('✉️', b.email, b.email ? 'mailto:' + b.email : '') +
      row('🌐', b.website, site) + row('📍', b.address) + row('🧾', b.gst ? 'GSTIN: ' + b.gst : '') +
      '<div class="tt14-sec" style="display:flex;justify-content:space-between;align-items:center;">📚 Catalogs (is phone me offline save)' +
      '<label class="btn btn-primary btn-sm" style="margin:0;cursor:pointer;">+ PDF Upload<input type="file" accept="application/pdf,.pdf" multiple style="display:none;" onchange="ttCatUpload(\'' + H(b.id) + '\', this)"></label></div>' +
      '<div id="tt14CatList" class="tt14-sub">Loading…</div>');
    loadCats(b.id);
  }
  async function loadCats(bid) {
    var box = $('tt14CatList'); if (!box) return;
    try {
      var list = await pdfList(bid); box = $('tt14CatList'); if (!box || curBrand !== bid) return;
      if (!list.length) { box.innerHTML = '<div class="tt14-empty">No catalogs yet. <b>+ PDF Upload</b>  to save your PDF (up to 250 MB) - once saved it opens without internet.</div>'; return; }
      box.innerHTML = list.map(function (r) {
        return '<div class="tt14-row" style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><div style="min-width:0;"><b style="word-break:break-word;">' + H(r.name) +
          '</b><div class="tt14-sub">' + (r.size / 1048576).toFixed(1) + ' MB • ' + H(new Date(r.uploadedAt).toLocaleDateString('en-GB')) + '</div></div>' +
          '<div style="display:flex;gap:6px;flex-shrink:0;"><button class="btn btn-wa btn-sm" onclick="triggerAppHaptic(); ttPdfOpen(' + r.id + ')">👁 Open</button>' +
          '<button class="btn btn-danger-sm btn-sm" onclick="triggerAppHaptic(); ttCatDelete(' + r.id + ',\'' + H(bid) + '\')">🗑️</button></div></div>';
      }).join('');
    } catch (e) { box.innerHTML = '<div class="tt14-empty">⚠️ Could not open catalog storage (' + H(e && e.message) + ').</div>'; }
  }
  window.ttCatUpload = async function (bid, input) {
    var files = Array.prototype.slice.call(input.files || []); input.value = '';
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!/pdf/i.test(f.type) && !/\.pdf$/i.test(f.name)) { notice('Not a PDF', f.name, '⚠️'); continue; }
      if (f.size > MAXPDF) { notice('File too large', f.name + ' Larger than 250 MB', '⚠️'); continue; }
      try { await pdfAdd({ brand: bid, name: f.name, size: f.size, blob: f, uploadedAt: new Date().toISOString(), by: meName() }); notice('Catalog saved', f.name, '📚'); }
      catch (e) { notice('Not saved', (e && e.name === 'QuotaExceededError') ? 'Not enough storage on the phone' : (e && e.message) || f.name, '⚠️'); }
    }
    if (curBrand === bid) loadCats(bid);
  };
  window.ttCatDelete = async function (id, bid) {
    if (!confirm('Remove this catalog PDF from this phone?')) return;
    try { await pdfDel(id); } catch (e) {}
    loadCats(bid);
  };

  /* ---- Brand add/edit form ---- */
  var formLogo = '';
  window.ttBrandForm = function (id, prefill) {
    if (!isAdm()) { alert('Only an Admin can add or edit brands.'); return; }
    var b = id ? brandById(id) : null; formLogo = b ? (b.logo || '') : '';
    var m = ensureModal('tt14BrandModal', 3300, 640), v = function (k) { return b ? H(b[k] || '') : ''; };
    setModal(m,
      '<div id="tt14BrandForm"></div><div class="card-header"><span class="card-title">' + (b ? '✏️ Brand Edit' : '➕ New Brand') + '</span>' +
      '<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ' + (b ? 'ttBrandOpen(\'' + H(b.id) + '\')' : 'ttBrandBack()') + '">✕</button></div>' +
      '<input type="hidden" id="tt14BId" value="' + H(id || '') + '">' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;"><div id="tt14BLogoPrev">' + logoHtml({ logo: formLogo, name: b ? b.name : (prefill || '?') }, 64) + '</div>' +
      '<label class="btn btn-outline btn-sm" style="margin:0;cursor:pointer;">🖼️ Choose Logo<input type="file" accept="image/*" style="display:none;" onchange="ttBrandLogoPick(this)"></label>' +
      '<button class="btn btn-outline btn-sm" onclick="ttBrandLogoClear()">Hatao</button></div>' +
      '<div class="form-group"><label>Brand Name *</label><input type="text" id="tt14BName" value="' + (b ? v('name') : H(prefill || '')) + '" placeholder="e.g. Annovi Reverberi"></div>' +
      '<div class="form-group"><label>Tagline</label><input type="text" id="tt14BTag" value="' + v('tagline') + '" placeholder="e.g. High pressure plunger pumps"></div>' +
      '<div class="form-group"><label>About / Details</label><textarea id="tt14BAbout" rows="4" placeholder="Company ke baare me, products, dealership details…">' + v('about') + '</textarea></div>' +
      '<div class="grid-2"><div class="form-group"><label>Contact Person</label><input type="text" id="tt14BContact" value="' + v('contact') + '"></div>' +
      '<div class="form-group"><label>Phone</label><input type="tel" id="tt14BPhone" value="' + v('phone') + '"></div></div>' +
      '<div class="grid-2"><div class="form-group"><label>Email</label><input type="email" id="tt14BEmail" value="' + v('email') + '"></div>' +
      '<div class="form-group"><label>Website</label><input type="text" id="tt14BWeb" value="' + v('website') + '"></div></div>' +
      '<div class="form-group"><label>Address</label><input type="text" id="tt14BAddr" value="' + v('address') + '"></div>' +
      '<div class="form-group"><label>GSTIN</label><input type="text" id="tt14BGst" value="' + v('gst') + '"></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px;"><button class="btn btn-primary btn-block" onclick="triggerAppHaptic(); ttBrandSave()">💾 Save</button>' +
      (b ? '<button class="btn btn-danger-sm" onclick="triggerAppHaptic(); ttBrandDelete(\'' + H(b.id) + '\')">🗑️ Delete</button>' : '') + '</div>');
  };
  function logoPrev() { var p = $('tt14BLogoPrev'); if (p) p.innerHTML = logoHtml({ logo: formLogo, name: ($('tt14BName') || {}).value || '?' }, 64); }
  window.ttBrandLogoClear = function () { formLogo = ''; logoPrev(); };
  window.ttBrandLogoPick = function (input) {
    var f = input.files && input.files[0]; input.value = ''; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var out = '', max = 256;
        for (var attempt = 0; attempt < 3; attempt++) {
          var s = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s));
          var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cv.width, cv.height);
          out = cv.toDataURL('image/png');
          if (out.length > 90000) { cx.globalCompositeOperation = 'destination-over'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); out = cv.toDataURL('image/jpeg', 0.82); }
          if (out.length <= 90000) break; max = Math.round(max * 0.65);
        }
        formLogo = out.length <= 90000 ? out : ''; if (!formLogo) notice('Logo bada hai', 'Choose a small logo', '⚠️'); logoPrev();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  };
  window.ttBrandSave = function () {
    var g = function (id) { return ($(id).value || '').trim(); }, name = g('tt14BName');
    if (!name) { alert('Enter the brand name'); return; }
    var id = $('tt14BId').value, b = id ? brandById(id) : null;
    var dup = (brandsData || []).some(function (x) { return x && String(x.name).toLowerCase() === name.toLowerCase() && String(x.id) !== String(id); });
    if (dup) { alert('A brand with this name already exists.'); return; }
    var data = { name: name, tagline: g('tt14BTag'), about: g('tt14BAbout'), contact: g('tt14BContact'), phone: g('tt14BPhone'), email: g('tt14BEmail'), website: g('tt14BWeb'), address: g('tt14BAddr'), gst: g('tt14BGst'), logo: formLogo, updatedAt: Date.now(), updatedBy: meName() };
    if (b) Object.assign(b, data); else { b = Object.assign({ id: 'BR' + Date.now(), createdAt: Date.now(), createdBy: meName() }, data); if (!Array.isArray(brandsData)) brandsData = []; brandsData.push(b); }
    window.brandsData = brandsData; setStored("BRANDS", brandsData);
    notice('Brand saved', name, '🏢'); ttBrandOpen(b.id);
  };
  window.ttBrandDelete = async function (id) {
    if (!isAdm()) return; var b = brandById(id); if (!b) return;
    if (!confirm('Delete brand "' + b.name + '"? (Its catalog PDFs on this phone will also be removed.)')) return;
    try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('BRANDS', id); } catch (e) {}
    brandsData = (brandsData || []).filter(function (x) { return x && String(x.id) !== String(id); });
    window.brandsData = brandsData; setStored("BRANDS", brandsData);
    try { await pdfDelBrand(id); } catch (e) {}
    renderBrandList();
  };

  /* ---- Lag-free PDF viewer v2 (pinch / double-tap zoom, page jump, priority render, Open with) ---- */
  var PDFJS_VER = '4.10.38', ZMIN = 0.5, ZMAX = 4, PXCAP = 6e6;
  var V = { lib: null, pdf: null, url: null, obs: null, vis: new Set(), done: {}, busy: new Set(), running: 0, tok: 0, zoom: 1, ar: 1.414, n: 0, blob: null, name: '', cur: 0 };
  window.TT_PDFJS_BASE = window.TT_PDFJS_BASE || ('https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VER + '/legacy/build/');
  async function loadPdfJs() {
    if (V.lib) return V.lib;
    var base = window.TT_PDFJS_BASE;
    var lib = await import(base + (window.TT_PDFJS_MAIN || 'pdf.min.mjs'));
    lib.GlobalWorkerOptions.workerSrc = base + (window.TT_PDFJS_WORKER || 'pdf.worker.min.mjs');
    V.lib = lib; return lib;
  }
  function ensureViewer() {
    var v = $('tt14Viewer');
    if (v) return v;
    v = document.createElement('div'); v.id = 'tt14Viewer'; v.className = 'auth-overlay'; v.style.display = 'none'; v.style.zIndex = '3700'; v.style.padding = '0'; v.style.alignItems = 'stretch';
    v.innerHTML = '<div class="tt14-vw">' +
      '<div class="tt14-vbar"><button class="btn btn-outline btn-sm" onclick="ttPdfClose()">✕</button><div class="tt14-vtitle" id="tt14VTitle"></div>' +
      '<button class="btn btn-accent btn-sm" onclick="triggerAppHaptic(); ttPdfOpenWith()">↗ Open with</button>' +
      '<button class="btn btn-outline btn-sm" onclick="ttPdfSave()">⬇️</button></div>' +
      '<div class="tt14-vbar tt14-vbar2"><button class="btn btn-outline btn-sm" onclick="ttPdfZoom(-0.25)">−</button><span id="tt14VZ" class="tt14-vpg" style="min-width:42px;text-align:center;">100%</span>' +
      '<button class="btn btn-outline btn-sm" onclick="ttPdfZoom(0.25)">＋</button><button class="btn btn-outline btn-sm" onclick="ttPdfFit()">Fit</button><span style="flex:1;"></span>' +
      '<button class="btn btn-outline btn-sm" onclick="ttPdfStep(-1)">‹</button><button class="btn btn-outline btn-sm" onclick="ttPdfGoto()"><span id="tt14VPg">–</span></button>' +
      '<button class="btn btn-outline btn-sm" onclick="ttPdfStep(1)">›</button></div>' +
      '<div class="tt14-vbody" id="tt14VBody"><div id="tt14VInner" class="tt14-vinner"></div></div></div>';
    document.body.appendChild(v);
    new MutationObserver(function () { if (v.style.display === 'none') pdfCleanup(); }).observe(v, { attributes: true, attributeFilter: ['style'] });
    bindGestures();
    return v;
  }
  function pdfCleanup() {
    V.tok++; V.vis.clear(); V.done = {}; V.busy.clear(); V.running = 0;
    if (V.obs) { try { V.obs.disconnect(); } catch (e) {} V.obs = null; }
    if (V.pdf) { try { V.pdf.destroy(); } catch (e) {} V.pdf = null; }
    if (V.url) { try { URL.revokeObjectURL(V.url); } catch (e) {} V.url = null; }
    var b = $('tt14VInner'); if (b) { b.innerHTML = ''; b.style.transform = ''; }
    V.blob = null;
  }
  window.ttPdfClose = function () { var v = $('tt14Viewer'); if (v) v.style.display = 'none'; };
  window.ttPdfSave = function () { if (V.blob) downloadBlob(V.blob, V.name || 'catalog.pdf'); };
  window.ttPdfOpenWith = async function () {
    if (!V.blob) return;
    var file = null; try { file = new File([V.blob], V.name || 'catalog.pdf', { type: 'application/pdf' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: V.name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    downloadBlob(V.blob, V.name || 'catalog.pdf');
    notice('PDF saved', 'Open it from the Downloads folder in your PDF reader app (Adobe / Drive / Files)', '📂');
  };
  function pgW() { var b = $('tt14VBody'); return Math.max(200, ((b && b.clientWidth) || 360) - 16) * V.zoom; }
  function layoutPages() {
    var w = pgW(), body = $('tt14VBody'), inner = $('tt14VInner'); if (!body || !inner) return;
    inner.style.width = Math.max(body.clientWidth, Math.round(w) + 16) + 'px';
    Array.prototype.forEach.call(inner.children, function (d) {
      var ar = parseFloat(d.dataset.ar) || V.ar; d.style.width = Math.round(w) + 'px'; d.style.height = Math.round(w * ar) + 'px';
    });
    var z = $('tt14VZ'); if (z) z.textContent = Math.round(V.zoom * 100) + '%';
  }
  function observeAll() {
    var body = $('tt14VBody'), inner = $('tt14VInner'); if (!body || !inner) return;
    if (V.obs) V.obs.disconnect();
    V.vis.clear();
    V.obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var i = +e.target.dataset.i;
        if (e.isIntersecting) V.vis.add(i); else { V.vis.delete(i); freePage(e.target, i); }
      });
      updateCur(); pump();
    }, { root: body, rootMargin: '700px 0px' });
    Array.prototype.forEach.call(inner.children, function (d) { V.obs.observe(d); });
  }
  function freePage(d, i) {
    var c = d.querySelector('canvas'); if (c) { c.width = c.height = 0; c.remove(); }
    d.classList.remove('ready'); delete V.done[i];
  }
  function updateCur() {
    var body = $('tt14VBody'), inner = $('tt14VInner'); if (!body || !inner || !inner.children.length) return;
    var mid = body.scrollTop + body.clientHeight / 2, lo = 0, hi = inner.children.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (inner.children[m].offsetTop <= mid) lo = m; else hi = m - 1; }
    V.cur = lo; var pg = $('tt14VPg'); if (pg) pg.textContent = (lo + 1) + ' / ' + V.n;
  }
  function pickNext() {
    var key = Math.round(pgW()), best = -1, bd = 1e9;
    V.vis.forEach(function (i) {
      if (V.done[i] === key || V.busy.has(i)) return;
      var d = Math.abs(i - V.cur); if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function pump() {
    if (!V.pdf) return; var tok = V.tok;
    while (V.running < 2) {
      var i = pickNext(); if (i < 0) break;
      V.busy.add(i); V.running++;
      (function (i) {
        renderPage(i, tok).catch(function () {}).then(function () {
          if (tok !== V.tok) return; V.busy.delete(i); V.running--; pump();
        });
      })(i);
    }
  }
  async function renderPage(i, tok) {
    var w = pgW(), key = Math.round(w), inner = $('tt14VInner'); if (!inner || !V.pdf) return;
    var d = inner.children[i]; if (!d) return;
    var page = await V.pdf.getPage(i + 1); if (tok !== V.tok || !V.vis.has(i)) return;
    var vp0 = page.getViewport({ scale: 1 }), dpr = Math.min(window.devicePixelRatio || 1, 2), s = (w / vp0.width) * dpr;
    var area = vp0.width * s * vp0.height * s; if (area > PXCAP) s *= Math.sqrt(PXCAP / area);
    var vp = page.getViewport({ scale: s });
    var cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    cv.style.cssText = 'width:100%;height:100%;display:block;';
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp, canvas: cv }).promise;
    if (tok !== V.tok || !V.vis.has(i) || Math.round(pgW()) !== key) { cv.width = cv.height = 0; return; }
    var old = d.querySelector('canvas'); if (old) { old.width = old.height = 0; old.remove(); }
    d.dataset.ar = String(vp0.height / vp0.width); d.style.height = Math.round(w * vp0.height / vp0.width) + 'px';
    d.appendChild(cv); V.done[i] = key; d.classList.add('ready');
    try { page.cleanup(); } catch (e) {}
  }
  function commitZoom(nz, fx, fy, cx, cy) {
    nz = Math.max(ZMIN, Math.min(ZMAX, nz));
    var body = $('tt14VBody'), inner = $('tt14VInner'); if (!body || !inner) return;
    if (cx == null) { cx = body.scrollLeft + fx; cy = body.scrollTop + fy; }
    var k = nz / V.zoom;
    inner.style.transform = ''; inner.style.willChange = '';
    V.zoom = nz; V.done = {};
    layoutPages();
    body.scrollLeft = cx * k - fx; body.scrollTop = cy * k - fy;
    observeAll();
  }
  window.ttPdfZoom = function (dz) {
    var b = $('tt14VBody'); if (!b || !V.pdf) return;
    commitZoom(V.zoom + dz, b.clientWidth / 2, b.clientHeight / 2);
  };
  window.ttPdfFit = function () { var b = $('tt14VBody'); if (!b || !V.pdf) return; commitZoom(1, b.clientWidth / 2, b.clientHeight / 2); b.scrollLeft = 0; };
  window.ttPdfGoto = function () {
    if (!V.pdf) return;
    var r = prompt('Go to which page? (1 - ' + V.n + ')', String(V.cur + 1)); if (r == null) return;
    var n = Math.max(1, Math.min(V.n, parseInt(r, 10) || 1)), body = $('tt14VBody'), inner = $('tt14VInner');
    body.scrollTop = inner.children[n - 1].offsetTop - 4;
  };
  window.ttPdfStep = function (d) {
    if (!V.pdf) return; var body = $('tt14VBody'), inner = $('tt14VInner'), n = Math.max(0, Math.min(V.n - 1, V.cur + d));
    body.scrollTop = inner.children[n].offsetTop - 4;
  };
  function bindGestures() {
    var body = $('tt14VBody'), inner = $('tt14VInner');
    var G = { mode: null, d0: 1, r: 1, fx: 0, fy: 0, cx: 0, cy: 0, lastTap: 0, lx: 0, ly: 0, moved: false };
    var dist = function (t) { var a = t[0], b = t[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; };
    body.addEventListener('touchstart', function (e) {
      if (!V.pdf) return;
      if (e.touches.length === 2) {
        var rect = body.getBoundingClientRect(), t = e.touches;
        G.mode = 'pinch'; G.d0 = dist(t); G.r = 1;
        G.fx = (t[0].clientX + t[1].clientX) / 2 - rect.left; G.fy = (t[0].clientY + t[1].clientY) / 2 - rect.top;
        G.cx = body.scrollLeft + G.fx; G.cy = body.scrollTop + G.fy;
        inner.style.transformOrigin = G.cx + 'px ' + G.cy + 'px'; inner.style.willChange = 'transform';
      } else if (e.touches.length === 1) { G.lx = e.touches[0].clientX; G.ly = e.touches[0].clientY; G.moved = false; }
    }, { passive: true });
    body.addEventListener('touchmove', function (e) {
      if (G.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        G.r = Math.max(ZMIN / V.zoom, Math.min(ZMAX / V.zoom, dist(e.touches) / G.d0));
        inner.style.transform = 'scale(' + G.r + ')';
      } else if (e.touches.length === 1 && Math.hypot(e.touches[0].clientX - G.lx, e.touches[0].clientY - G.ly) > 10) G.moved = true;
    }, { passive: false });
    body.addEventListener('touchend', function (e) {
      if (G.mode === 'pinch') {
        if (e.touches.length < 2) { G.mode = null; commitZoom(V.zoom * G.r, G.fx, G.fy, G.cx, G.cy); G.lastTap = 0; }
        return;
      }
      if (!V.pdf || G.moved || e.touches.length || e.changedTouches.length !== 1) return;
      var now = Date.now();
      if (now - G.lastTap < 300) {
        var rect = body.getBoundingClientRect(), t = e.changedTouches[0];
        commitZoom(V.zoom < 1.5 ? 2.5 : 1, t.clientX - rect.left, t.clientY - rect.top); G.lastTap = 0;
      } else G.lastTap = now;
    }, { passive: true });
    var raf = 0;
    body.addEventListener('scroll', function () {
      if (raf) return; raf = requestAnimationFrame(function () { raf = 0; updateCur(); pump(); });
    }, { passive: true });
  }
  window.ttPdfOpen = async function (id) {
    var rec; try { rec = await pdfGet(id); } catch (e) {}
    if (!rec || !rec.blob) { notice('Catalog not found', '', '⚠️'); return; }
    var v = ensureViewer(); pdfCleanup();
    V.blob = rec.blob; V.name = rec.name; V.zoom = 1; V.cur = 0;
    $('tt14VTitle').textContent = rec.name; $('tt14VPg').textContent = '–'; $('tt14VZ').textContent = '100%';
    var inner = $('tt14VInner'); inner.style.width = ''; inner.innerHTML = '<div class="tt14-vmsg">⏳ Opening the PDF…</div>'; v.style.display = 'flex';
    var fallback = function (why) {
      inner.innerHTML = '<div class="tt14-vmsg">⚠️ The in-app viewer failed (' + H(why) + ').<br>Internet is needed the first time to load the viewer.<br><br>' +
        '<button class="btn btn-accent btn-sm" onclick="ttPdfOpenWith()">↗ Open with</button> <button class="btn btn-outline btn-sm" onclick="ttPdfSave()">⬇️ Download</button></div>';
    };
    try {
      var lib = await loadPdfJs(), tok = V.tok; V.url = URL.createObjectURL(rec.blob);
      var pdf = await lib.getDocument({ url: V.url, disableAutoFetch: true, isEvalSupported: false }).promise;
      if (tok !== V.tok) { try { pdf.destroy(); } catch (e) {} return; }
      V.pdf = pdf; V.n = pdf.numPages; var p1 = await pdf.getPage(1), vp = p1.getViewport({ scale: 1 }); V.ar = vp.height / vp.width;
      inner.innerHTML = ''; var frag = document.createDocumentFragment();
      for (var i = 0; i < V.n; i++) { var d = document.createElement('div'); d.className = 'tt14-pg'; d.dataset.i = i; d.dataset.n = String(i + 1); frag.appendChild(d); }
      inner.appendChild(frag); layoutPages(); observeAll(); $('tt14VBody').scrollTop = 0; updateCur();
    } catch (e) { console.warn('pdf viewer', e); fallback((e && e.message) || 'error'); }
  };
  window.ttPdfExternal = window.ttPdfOpenWith;

  /* ================= HOOK UP ================= */
  setInterval(function () { try { backupCheck(); } catch (e) {} }, 60000);
  setTimeout(function () { try { backupCheck(); fuBadge(); } catch (e) {} }, 6000);
  setTimeout(function () { try { fuDailyToast(); } catch (e) {} }, 9000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { backupCheck(); fuBadge(); } catch (e) {} } });
})();
