import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy, splitPartyAddressLines } from './taxInvoiceLayout';
import {
  STANDARD_CHARGES_LIST,
  OTHER_CHARGE_ITEM
} from './documentCharges';
import {
  escHtml,
  fmtMoney,
  fmtQty,
  renderHtmlToPdf,
  buildPrintBrandHtml,
  hasPrintVal,
  buildPartyFootHtml
} from './printTheme';

const NOTE_CHARGES = [...STANDARD_CHARGES_LIST, OTHER_CHARGE_ITEM];
const NOTE_BLANK_ROWS = 4;
const CREDIT_NOTE_BLANK_ROWS = 6;

const calcNoteLines = (data) => {
  const taxRate = parseFloat(data.taxRate) || 18;
  const halfRate = taxRate / 2;
  const rows = [];
  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalQty = 0;
  let sr = 0;

  const pushLine = (label, qty, rate) => {
    // Never emit a body "TOTAL" line — footer already has the summary row
    if (/^\s*total\s*$/i.test(String(label || ''))) return;
    const amt = qty * rate;
    if (amt <= 0 && !rate && !(label || '').trim()) return;
    const sgstAmt = amt * (halfRate / 100);
    const cgstAmt = amt * (halfRate / 100);
    sr += 1;
    rows.push({
      sr,
      label: label || 'Description',
      qty,
      rate,
      amt,
      sgstRate: halfRate,
      cgstRate: halfRate,
      sgstAmt,
      cgstAmt,
      rowTotal: amt + sgstAmt + cgstAmt
    });
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalQty += qty;
  };

  // Prefer manual description lines (only what user entered)
  (data.customCharges || []).forEach((c) => {
    const desc = String(c.description || '').trim();
    const qty = parseFloat(c.qty) || 0;
    const rate = parseFloat(c.rate) || 0;
    const amt = qty * rate;
    if (!desc && amt <= 0) return;
    pushLine(desc, qty || 1, rate);
  });

  // Legacy checklist charges (older saved notes only)
  if (!rows.length) {
    NOTE_CHARGES.forEach((c) => {
      if (!data.charges?.[c.key]) return;
      pushLine(c.label || c.key, parseFloat(data.qtys?.[c.key]) || 1, parseFloat(data.rates?.[c.key]) || 0);
    });
  }

  if (!rows.length && (data.particulars || data.amount)) {
    const amt = parseFloat(data.subtotal) || parseFloat(data.amount) || 0;
    pushLine(data.particulars || 'Adjustment', 1, amt);
  }

  const discount = parseFloat(data.discount) || 0;
  if (discount > 0 && totalAmt > 0) {
    const ratio = Math.max(0, totalAmt - discount) / totalAmt;
    totalAmt = Math.max(0, totalAmt - discount);
    totalSgst *= ratio;
    totalCgst *= ratio;
  }

  const totalAll = totalAmt + totalSgst + totalCgst;
  return { rows, totalAmt, totalSgst, totalCgst, totalIgst: 0, totalAll, totalQty };
};

const getCommonStyle = () => `
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
  
  /* A4 scaling */
  .page {
    width: 794px;
    height: 1123px;
    max-height: 1123px;
    min-height: 1123px;
    padding: 0;
    margin: 0;
    background: #fff;
    border: none;
    display: block;
    overflow: hidden;
    box-sizing: border-box;
  }

  /* Outline for the whole content */
  .content-wrapper { width: 100%; height: 100%; min-height: 0; border-collapse: collapse; border: 2px solid var(--purple); box-sizing: border-box; table-layout: fixed; }
  .content-wrapper td { padding: 0; }

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
    border-top:1px solid var(--lav-border);
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
    padding:10px 12px;
    font-size:12px;
    line-height:1.55;
    min-height: 80px;
  }
  .party-body .cname{
    color:var(--purple);
    font-weight:800;
    font-size:12px;
    margin-bottom:4px;
  }
  .party-foot{
    border-top:1px solid var(--lav-border);
    padding:8px 12px;
    font-size:12px;
  }
  .party-foot .frow{display:flex;margin-bottom:2px;}
  .party-foot .flabel{width:50px;font-weight:700;}
  .party-foot .fcolon{width:12px;}

  /* ===== REASON BAR ===== */
  .reason-bar{
    border:1px solid var(--lav-border);
    padding:7px 12px;
    font-size:12px;
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    gap:14px;
    background:var(--lav-bg);
    margin-bottom:14px;
  }
  .reason-bar .label{
    font-weight:800;
    color:var(--purple);
    margin-right:2px;
    display:flex;
    align-items:center;
    gap:6px;
  }
  .reason-bar .opt{
    display:flex;align-items:center;gap:4px;
  }
  .checkbox{
    width:12px;height:12px;
    border:1px solid var(--purple);
    background:#fff;
    display:inline-block;
    position:relative;
  }
  .checkbox.checked::after{
    content:"✓";
    position:absolute;
    top:-2px;left:1px;
    font-size:12px;
    font-weight:900;
    color:var(--purple);
  }

  /* ===== TABLE ===== */
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
  table.items tbody tr.filler-row td{height:14px;}
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
  .footer3{
    display:flex;
    gap:14px;
    margin-bottom:0;
  }
  .f3col{
    flex:1;
    border:1px solid var(--lav-border);
  }
  .f3-body{
    padding:8px 10px;
    font-size:12px;
    line-height:1.45;
  }
  .f3-body ol{margin:0;padding-left:16px;}
  .sig-col{
    display:flex;
    flex-direction:column;
    justify-content:space-between;
  }
  .sig-col .for-company{
    font-weight:800;
    color:var(--purple);
    padding:8px 12px 0;
    font-size:12px;
      text-align:center;
  }
  .sig-col .sig-line{
    margin:14px 12px 8px;
    border-top:1px solid #333;
    text-align:center;
    padding-top:4px;
    font-size:12px;
  }

  /* ===== BAR FOOTER ===== */
  .barfoot{
    background:var(--purple);
    color:#fff;
    margin:8px -10px 0 -10px;
    padding:7px 14px;
    display:flex;
    justify-content:space-between;
    font-size:12px;
  }

  @media print{
    body{background:#fff;}
    .page {margin:0;padding: 0;width:794px;height: 1123px;max-height:1123px;overflow:hidden;}
    .content-wrapper { width: 100%; height: 100%; min-height: 0; border-collapse: collapse; border: 2px solid var(--purple); box-sizing: border-box; table-layout: fixed; }
  .content-wrapper td { padding: 0; }
  }
`;

const buildNoteHtmlCommon = (data, profileInput, noteType, reasonsArray) => {
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.noteNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const refInvoiceRaw = data.refInvoice || '';
  const refDateRaw = formatPdfDateDmy(data.refInvoiceDate) || '';
  const poNoRaw = data.poNo || '';
  const refRaw = data.reference || '';

  const { rows, totalAmt, totalSgst, totalCgst, totalIgst, totalQty } = calcNoteLines(data);

  // Bill To
  const billName = escHtml(data.partyName || '');
  const billAddr = splitPartyAddressLines(data.billAddress || data.address || '', 42);
  const billState = escHtml(data.billState || data.state || '');
  const billStateCode = escHtml(data.billStateCode || data.stateCode || '');
  const billGstin = escHtml(data.gstinBill || data.gstin || '');

  // Ship To
  const shipName = escHtml(data.shipName || data.partyName || '');
  const shipAddr = splitPartyAddressLines(data.shipAddress || data.address || '', 42);
  const shipState = escHtml(data.shipState || data.state || '');
  const shipStateCode = escHtml(data.shipStateCode || data.stateCode || '');
  const shipGstin = escHtml(data.gstinShip || data.gstin || '');

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }
  const companyState = escHtml(profile.state || 'Gujarat');
  
  const isIgst = (billState.toLowerCase() !== companyState.toLowerCase()) && billState !== '';
  const displayIgst = isIgst ? (totalSgst + totalCgst) : (totalIgst || 0);
  const displaySgst = isIgst ? 0 : totalSgst;
  const displayCgst = isIgst ? 0 : totalCgst;
  const displayTotalAll = totalAmt + displaySgst + displayCgst + displayIgst;

  const bodyRows = rows.map((r) => {
    let desc = r.label;
    const match = r.label.match(/(.*?)\s*\(\d+\)$/);
    if (match) {
      desc = match[1].trim();
    }
    const sgstAmt = isIgst ? 0 : r.sgstAmt;
    const cgstAmt = isIgst ? 0 : r.cgstAmt;
    const igstAmt = isIgst ? (r.sgstAmt + r.cgstAmt) : 0;
    const sgstRate = r.sgstRate || 0;
    const cgstRate = r.cgstRate || 0;
    const igstRate = sgstRate + cgstRate;
    
    return `
      <tr>
        <td class="center">${r.sr}</td>
        <td class="left">${escHtml(desc)}</td>
        <td class="center">${fmtQty(r.qty)}</td>
        <td class="num">${fmtMoney(r.rate)}</td>
        <td class="num">${fmtMoney(r.amt)}</td>
        <td class="num">${isIgst ? '' : sgstRate}</td>
        <td class="num">${isIgst ? '0.00' : fmtMoney(sgstAmt)}</td>
        <td class="num">${isIgst ? '' : cgstRate}</td>
        <td class="num">${isIgst ? '0.00' : fmtMoney(cgstAmt)}</td>
        <td class="num">${!isIgst ? '' : igstRate}</td>
        <td class="num">${!isIgst ? '0.00' : fmtMoney(igstAmt)}</td>
        <td class="num">${fmtMoney(r.rowTotal)}</td>
      </tr>`;
  }).join('');

  const blankCount = noteType === 'Credit Note' ? CREDIT_NOTE_BLANK_ROWS : NOTE_BLANK_ROWS;
  const blanks = Array.from({ length: blankCount }, () => `
      <tr class="filler-row">
        <td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td>
        <td></td>
      </tr>
  `).join('');

  const roundedTotal = Math.round(displayTotalAll);
  const roundOff = roundedTotal - displayTotalAll;
  const totalTaxAmount = displaySgst + displayCgst + displayIgst;
  const taxHalf = (parseFloat(data.taxRate) || 18) / 2;
  const taxFull = parseFloat(data.taxRate) || 18;
  
  let reasonBar = '';
  if (reasonsArray && reasonsArray.length) {
    const otherMatched = !reasonsArray.includes(data.reason) && data.reason;
    const optsHtml = reasonsArray.map(r => `
      <span class="opt"><span class="checkbox ${data.reason === r ? 'checked' : ''}"></span> ${r}</span>
    `).join('');
    
    reasonBar = `
    <div class="reason-bar">
      <span class="label">
        <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        REASON FOR ${noteType.toUpperCase()}
      </span>
      ${optsHtml}
      <span class="opt"><span class="checkbox ${otherMatched ? 'checked' : ''}"></span> Other ${otherMatched ? escHtml(data.reason) : '_______'}</span>
    </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${noteType} - ${escHtml(profile.companyName)}</title>
<style>${getCommonStyle()}</style>
</head>
<body>
<div class="page">
<table class="content-wrapper">
  <tr>
    <td valign="top" style="padding: 4px 10px 0;">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      ${buildPrintBrandHtml(profile, {
        companyName: profile.companyName || 'UMA MICRON',
        tagline: profile.tagline || "Micronization of API's"
      })}
    </div>
    <div class="tax-invoice-box">
      <div class="ti-title">${noteType.toUpperCase()}</div>
      <div class="ti-sub">AGAINST TAX INVOICE</div>
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
      <div style="text-align:center; padding:6px 0 2px; font-weight:800; color:var(--purple); font-size:12px; letter-spacing:0.5px;">REFERENCE DETAILS</div>
      <div class="block" style="padding-top:4px;">
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">${noteType} No.</span><span class="m-colon">:</span><span class="m-value">${docNo}</span></div>
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg></span><span class="m-label">${noteType} Date</span><span class="m-colon">:</span><span class="m-value">${docDate}</span></div>
      </div>
      <div class="block">
        ${hasPrintVal(refInvoiceRaw) ? `<div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">Original Invoice No.</span><span class="m-colon">:</span><span class="m-value">${escHtml(refInvoiceRaw)}</span></div>` : ''}
        ${hasPrintVal(refDateRaw) ? `<div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">Original Invoice Date</span><span class="m-colon">:</span><span class="m-value">${escHtml(refDateRaw)}</span></div>` : ''}
        ${hasPrintVal(poNoRaw) ? `<div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span class="m-label">Customer PO No.</span><span class="m-colon">:</span><span class="m-value">${escHtml(poNoRaw)}</span></div>` : ''}
        ${hasPrintVal(refRaw) ? `<div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">Reference</span><span class="m-colon">:</span><span class="m-value">${escHtml(refRaw)}</span></div>` : ''}
      </div>
    </div>
  </div>

  <!-- BILL TO / SHIP TO -->
  <div class="parties">
    <div class="party">
      <div class="party-head"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg> BILL TO</div>
      <div class="party-body">
        <div class="cname">${billName}</div>
        ${billAddr.map(line => '<div>' + escHtml(line) + '</div>').join('')}
      </div>
      ${buildPartyFootHtml(data.gstinBill || data.gstin || '', data.billState || data.state || '', data.billStateCode || data.stateCode || '')}
    </div>
    <div class="party">
      <div class="party-head"><svg viewBox="0 0 24 24"><path d="M3 16V7h9v9"/><path d="M12 10h5l3 3v3h-8z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg> SHIP TO</div>
      <div class="party-body">
        <div class="cname">${shipName}</div>
        ${shipAddr.map(line => '<div>' + escHtml(line) + '</div>').join('')}
      </div>
      ${buildPartyFootHtml(data.gstinShip || data.gstin || '', data.shipState || data.state || '', data.shipStateCode || data.stateCode || '')}
    </div>
  </div>

  ${reasonBar}

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
      ${bodyRows}
      ${blanks}
    </tbody>
    <tfoot>
        <tr>
          <td colspan="2" style="text-align:center;">TOTAL</td>
          <td class="center">${fmtQty(totalQty) || '0.00'}</td>
          <td></td>
          <td class="num">${fmtMoney(totalAmt)}</td>
          <td></td>
          <td class="num">${fmtMoney(displaySgst)}</td>
          <td></td>
          <td class="num">${fmtMoney(displayCgst)}</td>
          <td></td>
          <td class="num">${fmtMoney(displayIgst)}</td>
          <td class="num">${fmtMoney(displayTotalAll)}</td>
        </tr>
      </tfoot>
  </table>
  </div>

      </td>
  </tr>
  <tr>
    <td valign="bottom" style="padding: 8px 10px 0; height: 1px;">
  <!-- BANK DETAILS + TOTALS -->
  <div class="bottom">
    ${noteType === 'Debit Note' ? `
    <div class="bank">
      <div class="box-head"><svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6"/><path d="M4 10h16v9H4z"/><path d="M4 19h16M8 10v9M12 10v9M16 10v9"/></svg> OUR BANK DETAILS</div>
      <div class="bank-body">
        <div class="bank-row"><span class="blabel">Bank Name</span><span class="bcolon">:</span><span>AXIS BANK LTD</span></div>
        <div class="bank-row"><span class="blabel">A/c Name</span><span class="bcolon">:</span><span>UMA MICRON</span></div>
        <div class="bank-row"><span class="blabel">Current A/c No.</span><span class="bcolon">:</span><span>916020061629671</span></div>
        <div class="bank-row"><span class="blabel">IFS CODE</span><span class="bcolon">:</span><span>UTIB0000383</span></div>
        <div class="bank-row"><span class="blabel">Branch</span><span class="bcolon">:</span><span>Nizampura, Vadodara - 390002</span></div>
      </div>
    </div>
    ` : `
    <div class="bank">
      <div class="box-head"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> NOTES</div>
      <div class="bank-body" style="min-height: 80px; font-size:12px; line-height: 1.5;">
        <ol style="margin-top: 0; padding-left: 20px; margin-bottom: 8px;">
          <li>Please quote the credit note number for future reference.</li>
        </ol>
        <div>${data.notes ? escHtml(data.notes).replace(/\n/g, '<br>') : ''}</div>
      </div>
    </div>
    `}

    <div class="totals">
      <div class="totals-body">
        <div class="trow"><span class="tlabel">Taxable Amount Before Tax</span><span class="tval">&#8377; ${fmtMoney(totalAmt)}</span></div>
        <div class="trow"><span class="tlabel">CGST @ ${taxHalf}%</span><span class="tval">${isIgst ? '-' : '&#8377; ' + fmtMoney(displayCgst)}</span></div>
        <div class="trow"><span class="tlabel">SGST @ ${taxHalf}%</span><span class="tval">${isIgst ? '-' : '&#8377; ' + fmtMoney(displaySgst)}</span></div>
        <div class="trow"><span class="tlabel">IGST @ ${taxFull}%</span><span class="tval">${isIgst ? '&#8377; ' + fmtMoney(displayIgst) : '-'}</span></div>
        <div class="trow rule"><span class="tlabel">Total Tax Amount</span><span class="tval">&#8377; ${fmtMoney(totalTaxAmount)}</span></div>
        <div class="trow"><span class="tlabel">Round Off</span><span class="tval">&#8377; ${fmtMoney(roundOff)}</span></div>
      </div>
      <div class="grand">
        <span>${noteType.toUpperCase()} AMOUNT</span>
        <span>&#8377; ${fmtMoney(roundedTotal)}</span>
      </div>
    </div>
  </div>

  <!-- TERMS / DECLARATION / SIGNATORY -->
  <div class="footer3">
    <div class="f3col">
      <div class="box-head"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg> TERMS &amp; CONDITIONS</div>
      <div class="f3-body">
        <ol>
          <li>Subject to Vadodara Jurisdiction.</li>
          <li>Payment terms as per our agreed terms.</li>
          <li>Interest will be charged @ 24% p.a. if the amount remains unpaid from the due date.</li>
        </ol>
      </div>
    </div>
    <div class="f3col">
      <div class="box-head"><svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg> DECLARATION</div>
      <div class="f3-body">
        This ${noteType} is issued against the above tax invoice and forms an integral part of the original transaction.
      </div>
    </div>
    <div class="f3col sig-col">
      <div class="for-company">For UMA MICRON</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>

  <!-- BAR FOOTER -->
  <div class="barfoot">
    <span>Thank you for your business!</span>
    <span>E. &amp; O.E.</span>
    <span>This is a computer-generated ${noteType.toLowerCase()}.</span>
    <span>Page 1 of 1</span>
  </div>

    </td>
  </tr>
</table>
</div>
</body>
</html>`;

  return { html, docNo };
};

const buildDebitNoteHtml = (data, profileInput) => {
  return buildNoteHtmlCommon(data, profileInput, 'Debit Note', ['Additional Charges', 'Rate Revision', 'Packing Charges', 'Freight Charges', 'Material Shortage']);
};

const buildCreditNoteHtml = (data, profileInput) => {
  return buildNoteHtmlCommon(data, profileInput, 'Credit Note', ['Sales Return', 'Rate Difference', 'Discount', 'Excess Billing', 'Material Rejection']);
};

const renderPdfCommon = async (html, docNo, prefix, mode, printPrefs) => {
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: prefix,
    docNo,
    fitPage: true,
    printPrefs
  });
};

export const renderDebitNotePdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const { html, docNo } = buildDebitNoteHtml(data, data.companyProfile);
  await renderPdfCommon(html, docNo, 'DN', mode, printPrefs);
};

export const renderCreditNotePdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const { html, docNo } = buildCreditNoteHtml(data, data.companyProfile);
  await renderPdfCommon(html, docNo, 'CN', mode, printPrefs);
};
