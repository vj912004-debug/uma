import { mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  TI_EMPTY_ROWS,
  splitPartyAddressLines,
  formatPdfDateDmy,
  buildTiChargeAmounts
} from './taxInvoiceLayout';
import { renderHtmlToPdf, buildPrintBrandHtml, hasPrintVal, buildPartyFootHtml, buildOptionalMetaRowHtml, buildFillerRowsHtml, ITEMS_TABLE_FILL_CSS, FIT_FOOTER_CSS, fillPrintPartyFields, loadUmaAppData, buildFooterTerms, formatPrintTermsHtml, DEFAULT_PO_TERMS, DEFAULT_INVOICE_DECLARATION } from './printTheme';

export const escHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const fmtMoney = (n) => (parseFloat(n) || 0).toFixed(2);

export const fmtQty = (n) => {
  const v = parseFloat(n);
  if (!v) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export const buildPurchaseOrderHtml = (raw, profileInput) => {
  const data = fillPrintPartyFields(raw, raw?.appData || loadUmaAppData());
  const profile = mergeCompanyProfile(profileInput);

  const chargeAmounts = buildTiChargeAmounts(data);

  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalAll = 0;
  let totalQty = 0;

  const rows = [];
  let sr = 1;

  const pushRow = (desc, qty, rate, amt, sgstPercent, cgstPercent, igstPercent = 0) => {
    // Never emit a body "TOTAL" line — footer already has the summary row
    if (/^\s*total\s*$/i.test(String(desc || ''))) return;
    const sgstAmt = amt * (sgstPercent / 100);
    const cgstAmt = amt * (cgstPercent / 100);
    const igstAmt = 0; // Purchase orders in pdfExport default to 0 IGST for now, or calculate if out of state
    const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalIgst += igstAmt;
    totalAll += rowTotal;
    totalQty += parseFloat(qty) || 0;

    let cleanDesc = desc;
    const match = desc.match(/(.*?)\(\d+\)$/);
    if (match) {
      cleanDesc = match[1].trim();
    }

    rows.push(`
      <tr>
        <td class="center">${sr++}</td>
        <td class="left">${escHtml(cleanDesc)}</td>
        <td class="center">${fmtQty(qty)}</td>
        <td class="num">${rate ? escHtml(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="num">${fmtMoney(amt)}</td>
        <td class="num">${sgstPercent || ''}</td>
        <td class="num">${fmtMoney(sgstAmt)}</td>
        <td class="num">${cgstPercent || ''}</td>
        <td class="num">${fmtMoney(cgstAmt)}</td>
        <td class="num">${igstPercent || ''}</td>
        <td class="num">${fmtMoney(igstAmt)}</td>
        <td class="num">${fmtMoney(rowTotal)}</td>
      </tr>`);
  };

  const taxRate = parseFloat(data.taxRate) || 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;

  if (data.productName) {
    const qty = parseFloat(data.qty) || 0;
    const rate = parseFloat(data.rate) || 0;
    const amt = qty * rate > 0 ? (qty * rate) : (data.amount || 0);
    const specs = (data.productDescription || '').trim();
    const desc = specs ? `${data.productName} - ${specs}` : data.productName;
    
    pushRow(desc, qty, rate, amt, sgstRate, cgstRate);
  }

  TI_CHARGES_LIST.forEach((charge) => {
    const line = chargeAmounts[charge.key];
    if (!line || !(line.amt > 0)) return;
    pushRow(charge.label, line.qty, line.rate, line.amt || 0, sgstRate, cgstRate);
  });

  (data.customCharges || []).forEach((cc) => {
    if (!cc.checked) return;
    const ccQty = parseFloat(cc.qty) || 1;
    const rate = parseFloat(cc.rate) || 0;
    const amt = ccQty * rate;
    if (amt <= 0) return;
    pushRow(cc.name || '', ccQty, rate, amt, sgstRate, cgstRate);
  });

  rows.push(buildFillerRowsHtml(12, 12));

  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;

  const docNo = escHtml(data.poNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const poNoRaw = data.partyDocNo || '';
  const poDateRaw = formatPdfDateDmy(data.partyDocDate) || '';
  const dcNoRaw = data.dcNo || '';
  const dcDateRaw = formatPdfDateDmy(data.dcDate) || '';
  const companyState = escHtml(profile.state || 'Gujarat');
  
  const billName = escHtml(data.partyName || '');
  const shipName = escHtml(data.shipName || data.partyName || '');
  
  const billAddr = splitPartyAddressLines(data.billAddress || data.address || '', 42);
  const shipAddr = splitPartyAddressLines(data.shipAddress || data.address || '', 42);
  
  const billState = escHtml(data.billState || data.state || '');
  const billStateCode = escHtml(data.billStateCode || data.stateCode || '');
  const shipState = escHtml(data.shipState || data.state || '');
  const shipStateCode = escHtml(data.shipStateCode || data.stateCode || '');
  
  const billGstin = escHtml(data.gstinBill || data.gstin || '');
  const shipGstin = escHtml(data.gstinShip || data.gstin || '');

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(profile.companyName || 'UMA MICRON')} - Purchase Order</title>
<style>
  :root{
    --purple:#3d2b7d;
    --purple-dark:#2f2263;
    --lav-bg:#efeaf7;
    --lav-border:#c9bce8;
    --orange:#f47920;
    --green:#2fa84f;
    --text:#231f20;
    --grey-line:#d9d9d9;
  }
  *{box-sizing:border-box;font-family:Cambria,Georgia,serif;}
  html,body{margin:0;padding:0;background:#fff;font-family:Cambria,Georgia,serif;color:var(--text);}
  
  .page {
    width: 794px;
    height: 1123px;
    max-height: 1123px;
    min-height: 1123px;
    padding: 0;
    margin: 0;
    background: #fff;
    border: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    border: 2px solid var(--purple);
    box-sizing: border-box;
  }
  .inv-top { flex: 0 0 auto; padding: 4px 10px 0; }
  .items-row { flex: 1 1 auto; min-height: 0; overflow: hidden; padding: 0 10px 4px; }
  .inv-bot { flex: 0 0 auto; padding: 8px 10px 0; }

  /* ===== HEADER ===== */
  .header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:14px;
    margin:0 0 8px;padding:0 0 8px;
    border-bottom:1px solid var(--purple);
  }
  .brand{
    display:flex;
    align-items:center;
    gap:12px;
    min-width:0;
  }
  .logo{
    width:64px;
    height:64px;
    position:relative;
    flex-shrink:0;
  }
  .logo svg,.logo img{width:100%;height:100%;object-fit:contain;display:block;}

  .brand-lockup{width:280px;height:70px;flex-shrink:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}

  .brand-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap:2px;
  }
  .brand-text h1{
    margin:0;
    font-family:'Times New Roman',Times,serif;
    font-size:34px;
    white-space: nowrap;
    letter-spacing:0.5px;
    word-spacing:normal;
    color:#123282;
    line-height:1;
  }
  .brand-text .tagline{
    color:#1d9444;
    font-family:Cambria,Georgia,serif;
    font-weight:700;
    font-size:13px;
    margin:0;
    padding:0;
    line-height:1.15;
    letter-spacing:normal;
    word-spacing:0;
    white-space:nowrap;
  }
  .tax-invoice-box{
    background:var(--purple);
    color:#fff;
    text-align:center;
    padding:8px 18px;
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
    align-self:center;
    min-width:200px;
    min-height:64px;
    border-radius:6px;
    overflow:visible;
    height:auto;
    box-sizing:border-box;
  }
  .tax-invoice-box .ti-title{
    font-size:22px;
    font-weight:800;
    letter-spacing:0.5px;
    margin:0;
    padding:0;
    line-height:1.1;
    white-space:nowrap;
  }
  .tax-invoice-box .ti-sub{
    background:#fff;
    color:var(--purple);
    font-size:10px;
    font-weight:700;
    letter-spacing:.5px;
    padding:2px 8px;
    margin-top:4px;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .info-row{
    display:flex;
    gap:14px;
    margin-bottom:14px;
  }
  .company-info{
    flex:1.15;
    font-size:12px;
    line-height:1.55;
  }
  .company-info .line{
    display:flex;
    gap:8px;
    align-items:flex-start;
    margin-bottom:4px;
  }
  .icon{
    color:var(--purple);
    flex-shrink:0;
    width:16px;
    height:16px;
    text-align:center;
    margin-top:1px;
  }
  .icon svg{width:16px;height:16px;display:block;fill:none;stroke:var(--purple);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}
  .m-icon svg{width:15px;height:15px;display:block;fill:none;stroke:var(--purple);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}
  .party-head svg, .box-head svg{width:16px;height:16px;display:block;fill:none;stroke:var(--purple);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}
  .reg-details{
    margin-top:10px;
    font-size:12px;
    line-height:1.7;
  }
  .reg-details b{color:var(--purple);}
  .reg-row{
    display:grid;
    grid-template-columns:52px 12px minmax(0,1fr);
    column-gap:4px;
    align-items:center;
  }
  .reg-row .label{font-weight:700;color:var(--purple);white-space:nowrap;}
  .reg-row .colon{white-space:nowrap;}

  .invoice-meta{
    flex:1.15;
    min-width:300px;
    border:1px solid var(--purple); border-radius:6px; overflow:hidden;
  }
  .invoice-meta .block{
    padding:8px 10px;
    font-size:12px;
  }
  .invoice-meta .block + .block{
    border-top:1px solid var(--purple);
  }
  .meta-row{
    display:grid;
    grid-template-columns:16px 158px 12px minmax(0,1fr);
    column-gap:4px;
    align-items:center;
    margin-bottom:4px;
    font-size:12px;
    line-height:1.3;
    color:var(--text);
    white-space:nowrap;
  }
  .meta-row .m-icon{
    grid-column:1;
    color:var(--purple);
    width:16px;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .meta-row .m-label{
    grid-column:2;
    box-sizing:border-box;
    color:var(--text);
    font-size:12px;
    font-weight:700;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    padding-left:0;
  }
  .meta-row .m-colon{
    grid-column:3;
    font-size:12px;
    font-weight:700;
    white-space:nowrap;
    text-align:left;
  }
  .meta-row .m-value{
    grid-column:4;
    min-width:0;
    font-size:12px;
    font-weight:700;
    color:var(--text);
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  /* ===== BILL TO / SHIP TO ===== */
  .parties{
    display:flex;
    gap:14px;
    margin-bottom:14px;
  }
  .party{
    flex:1;
    border:1px solid var(--purple); border-radius:6px; overflow:hidden;
  }
  .party-head{
    background:var(--lav-bg);
    color:var(--purple);
    font-weight:800;
    font-size:12px;
    letter-spacing:.5px;
    padding:7px 12px;
    display:flex;
    align-items:center;
    gap:8px; border-bottom:1px solid var(--purple);
    border-bottom:1px solid var(--lav-border);
  }
  .party-head svg, .box-head svg{flex-shrink:0;}
  .party-body{
    padding:8px 12px;
    font-size:12px;
    line-height:1.4;
    min-height:0;
    white-space:normal;
  }
  .party-body .cname{
    color:var(--purple);
    font-weight:800;
    font-size:12px;
    margin:0 0 2px;
  }
  .party-body .addr{
    margin:0;
    line-height:1.4;
    white-space:normal;
  }
  .party-foot{
    border-top:1px solid var(--lav-border);
    padding:8px 12px;
    font-size:12px;
  }
  .party-foot .frow{display:flex;margin-bottom:2px;}
  .party-foot .flabel{width:50px;font-weight:700;}
  .party-foot .fcolon{width:12px;}

  /* ===== TABLE ===== */
  ${ITEMS_TABLE_FILL_CSS}
  ${FIT_FOOTER_CSS}
  .table-container { }
  table.items{
    width:100%;
    table-layout:fixed;
    border-collapse:collapse;
    margin-bottom:8px;
    font-size:12px;
    color: var(--text);
  }
  table.items thead th{
    background:var(--purple);
    color:#fff;
    font-weight:700;
    padding:3px 2px;
    text-align:center;
    vertical-align:middle;
    border:1px solid rgba(255,255,255,0.55);
  }
  table.items tbody td{
    border:1px solid var(--lav-border);
    padding:3px 3px;
    height:18px;
    vertical-align:middle;
  }
  table.items tbody td.num{text-align:right;padding-right:3px;}
  table.items tbody td.center{text-align:center;}
  table.items tbody td.left{text-align:left;padding-left:3px;}
  table.items tfoot td{
    border:1px solid var(--purple);
    background:var(--lav-bg);
    font-weight:800;
    padding:3px 2px;
    color:var(--purple-dark);
  }
  table.items tfoot td.num{text-align:right;padding-right:3px;}

  /* ===== BOTTOM SECTION: bank + totals ===== */
  .bottom{
    display:flex;
    gap:14px;
    margin-bottom:14px;
    align-items:stretch;
  }
  .bank{
    flex:1;
    border:1px solid var(--purple); border-radius:6px; overflow:hidden;
  }
  .box-head{
    background:var(--lav-bg);
    color:var(--purple);
    font-weight:800;
    font-size:12px;
    padding:7px 12px;
    display:flex;
    align-items:center;
    gap:8px;
    border-bottom:1px solid var(--purple);
  }
  .bank-body{
    padding:10px 12px;
    font-size:12px;
  }
  .bank-row{display:flex;margin-bottom:5px;}
  .bank-row .blabel{width:120px;font-weight:700;}
  .bank-row .bcolon{width:12px;}

  .totals{
    flex:1;
    display:flex;
    flex-direction:column;
  }
  .totals-body{
    border:1px solid var(--purple);
    border-bottom:none; border-radius:6px 6px 0 0;
    padding:10px 14px;
    font-size:12px;
    flex:1;
  }
  .trow{display:flex;justify-content:space-between;padding:2px 0;}
  .trow .tlabel{}
  .trow .tval{font-variant-numeric:tabular-nums;min-width:90px;text-align:right;}
  .trow.rule{border-top:1px solid var(--grey-line);margin-top:4px;padding-top:5px;}
  .grand{
    background:var(--purple);
    color:#fff;
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:10px 14px; border-radius:0 0 6px 6px;
    font-size:17px;
    font-weight:800;
  }

  /* ===== TERMS / DECLARATION / SIGNATORY ===== */
  table.footer3{
    width:100%;
    border-collapse:separate;
    border-spacing:10px 0;
    margin:8px 0 0;
    table-layout:fixed;
  }
  table.footer3 td.f3col{
    width:33.33%;
    height:128px;
    border:1px solid var(--lav-border);
    vertical-align:top;
    padding:0;
  }
  .f3-body{
    padding:8px 10px;
    font-size:11px;
    line-height:1.4;
    white-space:normal;
    overflow:visible;
    overflow-wrap:break-word;
    display:block;
  }
  .f3-body ol{margin:0;padding-left:18px;list-style-position:outside;}
  .f3-body li{white-space:normal;margin:0 0 4px;padding-left:4px;}
  .f3-body .term-line{margin:0 0 4px;white-space:normal;}
  .sig-col .sig-body{
    display:block;
    padding-top:8px;
  }
  .sig-col .sig-space{
    display:block;
    height:56px;
    min-height:56px;
    max-height:56px;
  }
  .sig-col .sig-line{
    margin:0;
    border-top:1px solid #333;
    text-align:center;
    padding-top:4px;
    font-size:11px;
    color:#231f20;
    visibility:visible;
  }

  /* ===== BAR FOOTER ===== */
  .barfoot{
    background:var(--purple);
    color:#fff;
    margin:8px -10px 0 -10px;
    padding:8px 14px 10px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    font-size:12px;
    line-height:1.35;
    min-height:32px;
    overflow:visible;
    flex-shrink:0;
  }

  @media print{
    body{background:#fff;}
    .page {margin:0;padding: 0;width:794px;height: 1123px;max-height:1123px;overflow:hidden;display:flex;flex-direction:column;}
    .content-wrapper { display:flex; flex-direction:column; width:100%; height:100%; min-height:0; border:2px solid var(--purple); box-sizing:border-box; }
  }
</style>
</head>
<body>
<div class="page po-page">
<div class="content-wrapper">
  <div class="inv-top">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      ${buildPrintBrandHtml(profile, {
        companyName: profile.companyName || 'UMA MICRON',
        tagline: profile.tagline || "Micronization of API's"
      })}
    </div>
    <div class="tax-invoice-box">
      <div class="ti-title">PURCHASE ORDER</div>
    </div>
  </div>

  <!-- COMPANY INFO + INVOICE META -->
  <div class="info-row">
    <div class="company-info" style="display:flex; justify-content:space-between; align-items:center;">
      <div class="address-col" style="flex:1; padding-right:14px;">
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>Plot No. 1116, G.I.D.C., Ranoli,<br>N.H. No. 8, Vadodara - 391350,<br>Gujarat, India</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span>+91 97120 00297</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span><span>umamicron@gmail.com</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span><span>www.umamicron.com</span></div>

            </div>
      <div class="reg-details" style="margin-top:0;">
        <div class="reg-row"><span class="label">GSTIN</span><span class="colon">:</span><span>24AABCA7339N1ZB</span></div>
        <div class="reg-row"><span class="label">PAN</span><span class="colon">:</span><span>AABCA7339N</span></div>
        <div class="reg-row"><span class="label">State</span><span class="colon">:</span><span>Gujarat (24)</span></div>
      </div>
    </div>

    <div class="invoice-meta">
      <div class="block">
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">PO No.</span><span class="m-colon">:</span><span class="m-value">${docNo}</span></div>
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg></span><span class="m-label">PO Date</span><span class="m-colon">:</span><span class="m-value">${docDate}</span></div>
      </div>
      <div class="block">
        ${buildOptionalMetaRowHtml('Ref No.', poNoRaw, { iconHtml: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>' })}
        ${buildOptionalMetaRowHtml('Ref Date', poDateRaw, { sub: true })}
        ${buildOptionalMetaRowHtml('Delivery Challan No.', dcNoRaw, { sub: true })}
        ${buildOptionalMetaRowHtml('DC Date', dcDateRaw, { sub: true })}
      </div>
    </div>
  </div>

  <!-- BILL TO / SHIP TO -->
  <div class="parties">
    <div class="party">
      <div class="party-head"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg> BILL TO</div>
      <div class="party-body"><div class="cname">${billName}</div>${billAddr.map((line) => `<div class="addr">${escHtml(line)}</div>`).join('')}</div>
      ${buildPartyFootHtml(data.gstinBill || data.gstin || '', data.billState || data.state || '', data.billStateCode || data.stateCode || '')}
    </div>
    <div class="party">
      <div class="party-head"><svg viewBox="0 0 24 24"><path d="M3 16V7h9v9"/><path d="M12 10h5l3 3v3h-8z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg> SHIP TO</div>
      <div class="party-body"><div class="cname">${shipName}</div>${shipAddr.map((line) => `<div class="addr">${escHtml(line)}</div>`).join('')}</div>
      ${buildPartyFootHtml(data.gstinShip || data.gstin || '', data.shipState || data.state || '', data.shipStateCode || data.stateCode || '')}
    </div>
  </div>

  </div>
  <div class="items-row">

  <!-- ITEMS TABLE -->
  <div class="table-container">
    <table class="items">
    <colgroup>
        <col style="width: 3%;">
        <col style="width: 22%;">
        <col style="width: 8%;">
        <col style="width: 8%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 11%;">
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2" style="text-align:center;">S.<br>No.</th>
          <th rowspan="2" style="text-align:center;">Description</th>
          <th rowspan="2" style="text-align:center;">Qty</th>
          <th rowspan="2" style="text-align:center;">Rate</th>
          <th rowspan="2" style="text-align:center;">Amount</th>
          <th colspan="2" style="text-align:center;">SGST</th>
          <th colspan="2" style="text-align:center;">CGST</th>
          <th colspan="2" style="text-align:center;">IGST</th>
          <th rowspan="2" style="text-align:center;">Total</th>
        </tr>
        <tr>
          <th style="text-align:center;">Rate</th>
          <th style="text-align:center;">Amount</th>
          <th style="text-align:center;">Rate</th>
          <th style="text-align:center;">Amount</th>
          <th style="text-align:center;">Rate</th>
          <th style="text-align:center;">Amount</th>
        </tr>
      </thead>
    <tbody>
      ${rows.join('')}
    </tbody>
    <tfoot>
        <tr>
          <td colspan="2" style="text-align:center;">TOTAL</td>
          <td class="center">${fmtQty(totalQty) || '0.00'}</td>
          <td></td>
          <td class="num">${fmtMoney(totalAmt)}</td>
          <td></td>
          <td class="num">${fmtMoney(totalSgst)}</td>
          <td></td>
          <td class="num">${fmtMoney(totalCgst)}</td>
          <td></td>
          <td class="num">${fmtMoney(totalIgst)}</td>
          <td class="num">${fmtMoney(totalAll)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  </div>
  <div class="inv-bot">
  <!-- BANK DETAILS + TOTALS -->
  <div class="bottom">
    <div class="bank">
      <div class="box-head"><svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6"/><path d="M4 10h16v9H4z"/><path d="M4 19h16M8 10v9M12 10v9M16 10v9"/></svg> OUR BANK DETAILS</div>
      <div class="bank-body">
        <div class="bank-row"><span class="blabel">Bank Name</span><span class="bcolon">:</span><span>AXIS BANK LTD</span></div>
        <div class="bank-row"><span class="blabel">A/c Name</span><span class="bcolon">:</span><span>${escHtml(profile.companyName || 'UMA MICRON')}</span></div>
        <div class="bank-row"><span class="blabel">Current A/c No.</span><span class="bcolon">:</span><span>916020061629671</span></div>
        <div class="bank-row"><span class="blabel">IFS CODE</span><span class="bcolon">:</span><span>UTIB0000383</span></div>
        <div class="bank-row"><span class="blabel">Branch</span><span class="bcolon">:</span><span>Nizampura, Vadodara - 390002</span></div>
      </div>
    </div>

    <div class="totals">
      <div class="totals-body">
        <div class="trow"><span class="tlabel">Total Amount Before Tax</span><span class="tval">&#8377; ${fmtMoney(totalAmt)}</span></div>
        <div class="trow"><span class="tlabel">CGST @ ${cgstRate}%</span><span class="tval">&#8377; ${fmtMoney(totalCgst)}</span></div>
        <div class="trow"><span class="tlabel">SGST @ ${sgstRate}%</span><span class="tval">&#8377; ${fmtMoney(totalSgst)}</span></div>
        <div class="trow"><span class="tlabel">IGST @ 18%</span><span class="tval">&#8377; ${fmtMoney(totalIgst)}</span></div>
        <div class="trow rule"><span class="tlabel">Total Tax Amount</span><span class="tval">&#8377; ${fmtMoney(totalCgst + totalSgst + totalIgst)}</span></div>
        <div class="trow"><span class="tlabel">Round Off</span><span class="tval">&#8377; ${fmtMoney(roundOff)}</span></div>
      </div>
      <div class="grand">
        <span>GRAND TOTAL</span>
        <span>&#8377; ${fmtMoney(roundedTotal)}</span>
      </div>
    </div>
  </div>

  <!-- TERMS / DECLARATION / SIGNATORY -->
  ${buildFooterTerms(profile.companyName || 'UMA MICRON', formatPrintTermsHtml(data.terms, DEFAULT_PO_TERMS), DEFAULT_INVOICE_DECLARATION)}

  <!-- BAR FOOTER -->
  <div class="barfoot">
    <span>Thank you for your business!</span>
    <span>E. &amp; O.E.</span>
    <span>This is a computer-generated purchase order.</span>
    <span>Page 1 of 1</span>
  </div>

  </div>
</div>
</div>
</body>
</html>`;
};

export const renderPurchaseOrderPdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const html = buildPurchaseOrderHtml(data, data.companyProfile);
  const { renderHtmlToPdf } = await import('./printTheme');
  await renderHtmlToPdf(html, {
    mode,
    printPrefs,
    filePrefix: 'PO',
    docNo: data.poNo || 'N/A',
    width: 794,
    fitPage: true
  });
};
