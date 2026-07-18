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
  PRINT_PAGE_W,
  renderHtmlToPdf
} from './printTheme';

const NOTE_CHARGES = [...STANDARD_CHARGES_LIST, OTHER_CHARGE_ITEM];
const NOTE_MIN_ROWS = 10;

const calcNoteLines = (data) => {
  const taxRate = parseFloat(data.taxRate) || 18;
  const half = taxRate / 2;
  const rows = [];
  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalQty = 0;
  let sr = 0;

  NOTE_CHARGES.forEach((c) => {
    if (!data.charges?.[c.key]) return;
    const qty = parseFloat(data.qtys?.[c.key]) || 1;
    const rate = parseFloat(data.rates?.[c.key]) || 0;
    const amt = qty * rate;
    if (amt <= 0 && !rate) return;
    const sgstAmt = amt * (half / 100);
    const cgstAmt = amt * (half / 100);
    sr += 1;
    rows.push({
      sr,
      label: c.label || c.key,
      qty,
      rate,
      amt,
      sgstRate: half,
      cgstRate: half,
      sgstAmt,
      cgstAmt,
      rowTotal: amt + sgstAmt + cgstAmt
    });
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalQty += qty;
  });

  if (!rows.length && (data.particulars || data.amount)) {
    const amt = parseFloat(data.subtotal) || parseFloat(data.amount) || 0;
    const sgstAmt = amt * (half / 100);
    const cgstAmt = amt * (half / 100);
    rows.push({
      sr: 1,
      label: data.particulars || 'Adjustment',
      qty: 1,
      rate: amt,
      amt,
      sgstRate: half,
      cgstRate: half,
      sgstAmt,
      cgstAmt,
      rowTotal: amt + sgstAmt + cgstAmt
    });
    totalAmt = amt;
    totalSgst = sgstAmt;
    totalCgst = cgstAmt;
    totalQty = 1;
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

const buildDebitNoteHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.noteNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const refInvoice = escHtml(data.refInvoice || '-');
  const refDate = escHtml(formatPdfDateDmy(data.refInvoiceDate) || '-');
  const poNo = escHtml(data.poNo || '-');
  const ref = escHtml(data.reference || '-');

  const { rows, totalAmt, totalSgst, totalCgst, totalAll, totalQty } = calcNoteLines(data);

  // Bill To
  const billName = escHtml(data.partyName || '');
  const billAddrHtml = splitPartyAddressLines(data.billAddress || data.address || '', 42).map(escHtml).join('<br>');
  const billState = escHtml(data.billState || data.state || '');
  const billStateCode = escHtml(data.billStateCode || data.stateCode || '');
  const billGstin = escHtml(data.gstinBill || data.gstin || '');

  // Ship To
  const shipName = escHtml(data.shipName || data.partyName || '');
  const shipAddrHtml = splitPartyAddressLines(data.shipAddress || data.address || '', 42).map(escHtml).join('<br>');
  const shipState = escHtml(data.shipState || data.state || '');
  const shipStateCode = escHtml(data.shipStateCode || data.stateCode || '');
  const shipGstin = escHtml(data.gstinShip || data.gstin || '');

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }
  const companyState = escHtml(profile.state || 'Gujarat');
  const companyGstin = escHtml(profile.gstNumber || '24AABCA7339N1Z8');
  
  const extractDescAndHsn = (label) => {
    const match = label.match(/(.*?)\s*\((\d+)\)$/);
    if (match) {
      return { desc: match[1].trim(), hsn: match[2] };
    }
    return { desc: label, hsn: '' };
  };

  const isIgst = (billState.toLowerCase() !== companyState.toLowerCase()) && billState !== '';

  const bodyRows = rows.map((r) => {
    const { desc, hsn } = extractDescAndHsn(r.label);
    const sgstAmt = isIgst ? 0 : r.sgstAmt;
    const cgstAmt = isIgst ? 0 : r.cgstAmt;
    
    return `
      <tr>
        <td>${r.sr}</td><td class="desc">${escHtml(desc)}</td><td>${escHtml(hsn)}</td><td>${fmtQty(r.qty)}</td>
        <td>${fmtMoney(r.rate)}</td><td>${fmtMoney(r.amt)}</td><td>${isIgst ? '-' : fmtMoney(cgstAmt)}</td><td>${isIgst ? '-' : fmtMoney(sgstAmt)}</td><td>${fmtMoney(r.rowTotal)}</td>
      </tr>`;
  }).join('');

  const blanksCount = Math.max(0, NOTE_MIN_ROWS - rows.length);
  const blanks = Array.from({ length: blanksCount }, () => `
      <tr class="filler-row"><td colspan="9"></td></tr>
  `).join('');

  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;
  
  const totalTaxAmount = isIgst ? (totalSgst + totalCgst) : (totalCgst + totalSgst);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Debit Note - ${escHtml(profile.companyName)}</title>
<style>
  :root{
    --purple: #6C4FA1;
    --purple-dark: #5B3E92;
    --purple-light: #F1EDF9;
    --purple-border: #C9BEE0;
    --grey-border: #B8B8B8;
    --text-dark: #2b2b2b;
  }
  *{box-sizing:border-box;}
  html,body{
    margin:0;
    padding:0;
    background:#e9e9ec;
    font-family: Arial, Helvetica, sans-serif;
    color: var(--text-dark);
  }

  /* ===== A4 PAGE ===== */
  .sheet{
    width:210mm;
    min-height:297mm;
    margin:10px auto;
    background:#fff;
    border:1px solid var(--grey-border);
    padding:10mm 10mm 6mm 10mm;
    position:relative;
    display:flex;
    flex-direction:column;
  }
  @media print{
    body{background:#fff;}
    .sheet{margin:0;border:none;box-shadow:none;}
    @page{ size:A4; margin:0; }
  }

  svg.ic{ vertical-align:middle; flex-shrink:0; }

  /* ===== HEADER ===== */
  .header{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    border-bottom:2px solid var(--purple);
    padding-bottom:10px;
  }
  .logo-block{
    display:flex;
    align-items:center;
    gap:10px;
  }
  .logo-icon{
    width:56px;height:56px;
  }
  .company-name{
    font-size:24px;font-weight:800;letter-spacing:0.5px;
  }
  .company-name .um{color:#1a9e8f;}
  .company-name .icron{color:#2d3a8c;}
  .company-tagline{
    font-size:10.5px;color:#555;letter-spacing:2px;font-weight:600;
  }
  .debit-badge{
    background:var(--purple);
    color:#fff;
    text-align:center;
    padding:9px 28px;
    border-radius:4px;
    font-weight:800;
    font-size:16px;
    letter-spacing:0.5px;
  }
  .debit-badge .sub{
    font-size:9.5px;font-weight:600;letter-spacing:1px;display:block;margin-top:3px;
  }

  /* ===== COMPANY INFO + REFERENCE ===== */
  .info-row{
    display:flex;
    justify-content:space-between;
    gap:16px;
    padding:10px 0;
    border-bottom:1px solid var(--purple-border);
  }
  .company-info{
    font-size:10.5px;
    line-height:1.65;
    width:52%;
  }
  .info-line{
    display:flex;
    align-items:flex-start;
    gap:7px;
    margin-bottom:2px;
  }
  .info-line svg{ margin-top:2px; }
  .gst-line{ margin-top:5px; }
  .ref-table{
    width:46%;
    border:1px solid var(--purple-border);
    border-collapse:collapse;
    font-size:10.5px;
    height:fit-content;
  }
  .ref-table th{
    background:var(--purple);
    color:#fff;
    text-align:left;
    padding:5px 8px;
    font-size:10.5px;
    letter-spacing:0.5px;
  }
  .ref-table td{
    padding:4px 8px;
    border-top:1px solid var(--purple-border);
  }
  .ref-table td.label{
    width:58%;color:#444;
  }
  .ref-table td.label .lbl-inner{
    display:flex; align-items:center; gap:6px;
  }
  .ref-table td.value{
    font-weight:700;text-align:right;
  }

  /* ===== BILL TO / SHIP TO ===== */
  .parties{
    display:flex;
    border:1px solid var(--purple-border);
    margin-top:10px;
  }
  .party{
    width:50%;
    font-size:10.5px;
  }
  .party:first-child{
    border-right:1px solid var(--purple-border);
  }
  .party-header{
    background:var(--purple-light);
    color:var(--purple-dark);
    font-weight:700;
    padding:5px 10px;
    font-size:11px;
    display:flex;
    align-items:center;
    gap:7px;
  }
  .party-body{
    padding:7px 10px;
    line-height:1.7;
  }
  .party-body .name{
    font-weight:700;
    color:var(--purple-dark);
  }

  /* ===== REASON BAR ===== */
  .reason-bar{
    border:1px solid var(--purple-border);
    border-top:none;
    padding:7px 10px;
    font-size:10.5px;
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    gap:14px;
    background:#fbfbfb;
  }
  .reason-bar .label{
    font-weight:700;
    color:var(--purple-dark);
    margin-right:2px;
    display:flex;
    align-items:center;
    gap:6px;
  }
  .reason-bar .opt{
    display:flex;align-items:center;gap:4px;
  }
  .checkbox{
    width:11px;height:11px;
    border:1.4px solid #333;
    display:inline-block;
    position:relative;
  }
  .checkbox.checked::after{
    content:"✓";
    position:absolute;
    top:-4px;left:0.5px;
    font-size:10px;
    font-weight:900;
    color:#1a1a1a;
  }

  /* ===== ITEMS TABLE ===== */
  table.items{
    width:100%;
    border-collapse:collapse;
    margin-top:8px;
    font-size:10px;
  }
  table.items th{
    background:var(--purple-light);
    border:1px solid var(--purple-border);
    padding:6px 4px;
    text-align:center;
    font-size:9.5px;
    font-weight:700;
    color:var(--purple-dark);
  }
  table.items td{
    border:1px solid var(--purple-border);
    padding:6px 4px;
    text-align:center;
  }
  table.items td.desc{
    text-align:left;
  }
  table.items tbody tr:nth-child(even){ background:#fbfaff; }
  table.items tr.total-row td{
    font-weight:800;
    background:#fff;
    border-top:2px solid var(--purple);
  }

  .filler-row td{ height:20px; }

  /* ===== BANK DETAILS + TAX SUMMARY ===== */
  .bottom-row{
    display:flex;
    gap:0;
    margin-top:8px;
    border:1px solid var(--purple-border);
  }
  .bank-box{
    width:55%;
    border-right:1px solid var(--purple-border);
    font-size:10px;
  }
  .box-header{
    background:var(--purple);
    color:#fff;
    font-weight:700;
    padding:5px 10px;
    font-size:10.5px;
    display:flex;
    align-items:center;
    gap:7px;
  }
  .box-body{
    padding:9px 10px;
    line-height:1.9;
  }
  .bank-table{
    width:100%;
    font-size:10px;
    border-collapse:collapse;
  }
  .bank-table td{
    padding:2px 0;
  }
  .bank-table td.blabel{
    width:38%;color:#444;
  }
  .bank-table td.bvalue{
    font-weight:700;
  }
  .tax-summary{
    width:45%;
    font-size:10px;
  }
  .tax-table{
    width:100%;
    border-collapse:collapse;
  }
  .tax-table td{
    padding:4px 10px;
  }
  .tax-table tr.line td{
    border-top:1px solid var(--purple-border);
  }
  .tax-table td.val{
    text-align:right;
    font-weight:600;
  }
  .tax-table tr.roundoff td{
    font-style:italic;
    color:#555;
  }

  /* ===== TERMS + DECLARATION ===== */
  .terms-row{
    display:flex;
    border:1px solid var(--purple-border);
    border-top:none;
    flex:1;
  }
  .terms-box, .decl-box{
    width:50%;
    font-size:9.5px;
  }
  .terms-box{
    border-right:1px solid var(--purple-border);
  }
  .decl-box .box-body{
    padding-top:11px;
    padding-bottom:26px;
  }
  .terms-box ol{
    margin:7px 10px;
    padding-left:15px;
    line-height:1.75;
  }

  /* ===== DEBIT AMOUNT ===== */
  .debit-amount{
    background:var(--purple);
    color:#fff;
    font-weight:800;
    font-size:14px;
    padding:9px 12px;
    display:flex;
    justify-content:space-between;
    margin-top:8px;
  }
  .signature{
    text-align:right;
    font-size:10px;
    padding:22px 12px 4px 0;
  }
  .sig-line{
    border-top:1px solid #999;
    width:150px;
    margin-left:auto;
    margin-bottom:4px;
  }

  .footer{
    display:flex;
    justify-content:space-between;
    font-size:8.5px;
    color:#777;
    margin-top:auto;
    padding-top:8px;
  }
</style>
</head>
<body>
<div class="sheet">

  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <svg class="logo-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 30 A35 20 0 1 1 19 71" fill="none" stroke="#1a9e6a" stroke-width="4" stroke-linecap="round"/>
        <path d="M80 70 A35 20 0 1 1 81 29" fill="none" stroke="#1a9e6a" stroke-width="4" stroke-linecap="round"/>
        <polygon points="18,66 12,78 26,76" fill="#1a9e6a"/>
        <polygon points="82,34 88,22 74,24" fill="#1a9e6a"/>
        <text x="28" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#e8781e">U</text>
        <text x="46" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#2d3a8c">M</text>
        <text x="66" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#7a2f8c">J</text>
      </svg>
      <div>
        <div class="company-name"><span class="um">UMA </span><span class="icron">MICRON</span></div>
        <div class="company-tagline">Micronization of API's</div>
      </div>
    </div>
    <div class="debit-badge">DEBIT NOTE<span class="sub">AGAINST TAX INVOICE</span></div>
  </div>

  <!-- COMPANY INFO + REFERENCE -->
  <div class="info-row">
    <div class="company-info">
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z" fill="#6C4FA1"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>
        <span>Plot No. 118, G.I.D.C., Ranoli,<br>N.H. No. 8, Vadodara – 391350,<br>Gujarat, India</span>
      </div>
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2 2.2z" fill="#6C4FA1"/></svg>
        <span>+91 97120 00297</span>
      </div>
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" fill="#6C4FA1"/><path d="M2 6l10 7 10-7" stroke="#fff" stroke-width="1.6" fill="none"/></svg>
        <span>umamicron@gmail.com</span>
      </div>
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#6C4FA1"/><path d="M2 12h20M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10z" stroke="#fff" stroke-width="1.2" fill="none"/></svg>
        <span>www.umamicron.com</span>
      </div>
      <div class="gst-line">
        <b>GSTIN</b> : ${companyGstin} &nbsp;&nbsp; <b>PAN</b> : ${companyPan}<br>
        <b>State</b> : ${companyState}
      </div>
    </div>
    <table class="ref-table">
      <tr><th colspan="2">REFERENCE DETAILS</th></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#6C4FA1"/><path d="M15 2v5h5" fill="#9a82c9"/></svg>
        Debit Note No.</span></td><td class="value">${docNo}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#6C4FA1"/><rect x="3" y="4" width="18" height="4" fill="#4a3577"/><rect x="6" y="2" width="2" height="4" fill="#4a3577"/><rect x="16" y="2" width="2" height="4" fill="#4a3577"/></svg>
        Debit Note Date</span></td><td class="value">${docDate}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#6C4FA1"/><path d="M15 2v5h5" fill="#9a82c9"/></svg>
        Original Invoice No.</span></td><td class="value">${refInvoice}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#6C4FA1"/><rect x="3" y="4" width="18" height="4" fill="#4a3577"/><rect x="6" y="2" width="2" height="4" fill="#4a3577"/><rect x="16" y="2" width="2" height="4" fill="#4a3577"/></svg>
        Original Invoice Date</span></td><td class="value">${refDate}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M21 15.5c-1.2 0-2.4-.2-3.5-.6-.3-.1-.7 0-1 .3l-2.2 2.2c-2.8-1.4-5.2-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.4-1.1-.6-2.3-.6-3.5 0-.6-.4-1-1-1H4.5c-.6 0-1 .4-1 1C3.5 12.5 11.5 20.5 20.5 20.5c.6 0 1-.4 1-1V16.5c0-.6-.4-1-1-1z" fill="#6C4FA1"/></svg>
        Customer PO No.</span></td><td class="value">${poNo}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#6C4FA1"/><path d="M15 2v5h5" fill="#9a82c9"/></svg>
        Reference</span></td><td class="value">${ref}</td></tr>
    </table>
  </div>

  <!-- BILL TO / SHIP TO -->
  <div class="parties">
    <div class="party">
      <div class="party-header">
        <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#6C4FA1"/><circle cx="12" cy="9" r="3.4" fill="#fff"/><path d="M5 19c1.2-3.2 4-5 7-5s5.8 1.8 7 5c-1.9 1.6-4.4 2.6-7 2.6s-5.1-1-7-2.6z" fill="#fff"/></svg>
        BILL TO
      </div>
      <div class="party-body">
        <div class="name">${billName}</div>
        ${billAddrHtml}<br>
        GSTIN : ${billGstin} &nbsp; State : ${billState} ${billStateCode ? '(' + billStateCode + ')' : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-header">
        <svg width="16" height="14" viewBox="0 0 24 24"><rect x="1" y="6" width="13" height="9" fill="#6C4FA1"/><path d="M14 9h5l4 4v2h-9z" fill="#6C4FA1"/><circle cx="6" cy="18" r="2.3" fill="#4a3577"/><circle cx="18" cy="18" r="2.3" fill="#4a3577"/></svg>
        SHIP TO
      </div>
      <div class="party-body">
        <div class="name">${shipName}</div>
        ${shipAddrHtml}<br>
        GSTIN : ${shipGstin} &nbsp; State : ${shipState} ${shipStateCode ? '(' + shipStateCode + ')' : ''}
      </div>
    </div>
  </div>

  <!-- REASON BAR -->
  <div class="reason-bar">
    <span class="label">
      <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#6C4FA1"/><path d="M8 3.5h6l4 4v11.5H8z" fill="#fff" transform="translate(1,1) scale(0.7)"/></svg>
      REASON FOR DEBIT NOTE
    </span>
    <span class="opt"><span class="checkbox ${data.reason === 'Additional Charges' ? 'checked' : ''}"></span> Additional Charges</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Rate Revision' ? 'checked' : ''}"></span> Rate Revision</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Packing Charges' ? 'checked' : ''}"></span> Packing Charges</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Freight Charges' ? 'checked' : ''}"></span> Freight Charges</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Material Shortage' ? 'checked' : ''}"></span> Material Shortage</span>
    <span class="opt"><span class="checkbox ${!['Additional Charges', 'Rate Revision', 'Packing Charges', 'Freight Charges', 'Material Shortage'].includes(data.reason) && data.reason ? 'checked' : ''}"></span> Other ${!['Additional Charges', 'Rate Revision', 'Packing Charges', 'Freight Charges', 'Material Shortage'].includes(data.reason) && data.reason ? escHtml(data.reason) : '_______'}</span>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:5%;">Sr. No.</th>
        <th style="width:24%;">Description</th>
        <th style="width:9%;">HSN / SAC</th>
        <th style="width:6%;">Qty.</th>
        <th style="width:10%;">Rate (₹)</th>
        <th style="width:11%;">Amount (₹)</th>
        <th style="width:9%;">CGST (₹)</th>
        <th style="width:9%;">SGST (₹)</th>
        <th style="width:11%;">Total Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      ${blanks}
      <tr class="total-row">
        <td colspan="3">TOTAL</td><td>${fmtQty(totalQty) || '0.00'}</td><td></td><td>${fmtMoney(totalAmt)}</td><td>${isIgst ? '-' : fmtMoney(totalCgst)}</td><td>${isIgst ? '-' : fmtMoney(totalSgst)}</td><td>${fmtMoney(totalAll)}</td>
      </tr>
    </tbody>
  </table>

  <!-- BOTTOM: BANK DETAILS + TAX SUMMARY -->
  <div class="bottom-row">
    <div class="bank-box">
      <div class="box-header">
        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 2l10 6H2z" fill="#fff"/><rect x="4" y="10" width="2" height="8" fill="#fff"/><rect x="8" y="10" width="2" height="8" fill="#fff"/><rect x="14" y="10" width="2" height="8" fill="#fff"/><rect x="18" y="10" width="2" height="8" fill="#fff"/><rect x="2" y="19" width="20" height="2" fill="#fff"/></svg>
        OUR BANK DETAILS
      </div>
      <div class="box-body">
        <table class="bank-table">
          <tr><td class="blabel">Bank Name</td><td>:</td><td class="bvalue">${escHtml(profile.bankName || 'AXIS BANK LTD')}</td></tr>
          <tr><td class="blabel">A/c Name</td><td>:</td><td class="bvalue">${escHtml(profile.bankAccountName || profile.companyName || 'UMA MICRON')}</td></tr>
          <tr><td class="blabel">Current A/c No.</td><td>:</td><td class="bvalue">${escHtml(profile.bankAccountNumber || '916020016060821')}</td></tr>
          <tr><td class="blabel">IFS Code</td><td>:</td><td class="bvalue">${escHtml(profile.bankIfsc || 'UTIB0000383')}</td></tr>
          <tr><td class="blabel">Branch</td><td>:</td><td class="bvalue">${escHtml(profile.bankBranch || 'Nizampura, Vadodara - 390002')}</td></tr>
        </table>
      </div>
    </div>
    <div class="tax-summary">
      <table class="tax-table">
        <tr><td>Taxable Amount Before Tax</td><td class="val">${fmtMoney(totalAmt)}</td></tr>
        <tr class="line"><td>Add : CGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</td><td class="val">${isIgst ? '-' : fmtMoney(totalCgst)}</td></tr>
        <tr><td>Add : SGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</td><td class="val">${isIgst ? '-' : fmtMoney(totalSgst)}</td></tr>
        <tr class="line"><td>Add : IGST @ 18%</td><td class="val">${isIgst ? fmtMoney(totalCgst + totalSgst) : '-'}</td></tr>
        <tr class="line"><td><b>Total Tax Amount</b></td><td class="val"><b>${fmtMoney(totalTaxAmount)}</b></td></tr>
        <tr class="roundoff"><td>Round Off</td><td class="val">${fmtMoney(roundOff)}</td></tr>
      </table>
    </div>
  </div>

  <!-- TERMS + DECLARATION -->
  <div class="terms-row">
    <div class="terms-box">
      <div class="box-header">
        <svg width="13" height="13" viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="12" rx="2" fill="#fff"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" fill="none" stroke="#fff" stroke-width="1.8"/></svg>
        TERMS &amp; CONDITIONS
      </div>
      <div class="box-body">
        <ol>
          <li>Subject to Vadodara Jurisdiction.</li>
          <li>Payment terms as per our agreed terms.</li>
          <li>Interest will be charged @ 24% p.a. if the amount remains unpaid from the due date.</li>
        </ol>
      </div>
    </div>
    <div class="decl-box">
      <div class="box-header">
        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="#fff"/><path d="M9 12l2 2 4-4" stroke="#6C4FA1" stroke-width="1.8" fill="none"/></svg>
        DECLARATION
      </div>
      <div class="box-body">
        This Debit Note is issued against the above tax invoice for the additional amount receivable.
        <div class="signature">
          <div>For ${escHtml(profile.companyName)}</div>
          <div style="height:38px;"></div>
          <div class="sig-line"></div>
          Authorised Signatory
        </div>
      </div>
    </div>
  </div>

  <!-- DEBIT AMOUNT -->
  <div class="debit-amount">
    <span>DEBIT AMOUNT</span>
    <span>₹ ${fmtMoney(roundedTotal)}</span>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>Thank you for your business!</span>
    <span>E.&amp;O.E.</span>
    <span>This is a computer generated debit note</span>
    <span>Page 1 of 1</span>
  </div>

</div>
</body>
</html>`;

  return { html, docNo };
};

const buildCreditNoteHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.noteNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const refInvoice = escHtml(data.refInvoice || '-');
  const refDate = escHtml(formatPdfDateDmy(data.refInvoiceDate) || '-');
  const poNo = escHtml(data.poNo || '-');
  const ref = escHtml(data.reference || '-');

  const { rows, totalAmt, totalSgst, totalCgst, totalAll, totalQty } = calcNoteLines(data);

  // Bill To
  const billName = escHtml(data.partyName || '');
  const billAddrHtml = splitPartyAddressLines(data.billAddress || data.address || '', 42).map(escHtml).join('<br>');
  const billState = escHtml(data.billState || data.state || '');
  const billStateCode = escHtml(data.billStateCode || data.stateCode || '');
  const billGstin = escHtml(data.gstinBill || data.gstin || '');

  // Ship To
  const shipName = escHtml(data.shipName || data.partyName || '');
  const shipAddrHtml = splitPartyAddressLines(data.shipAddress || data.address || '', 42).map(escHtml).join('<br>');
  const shipState = escHtml(data.shipState || data.state || '');
  const shipStateCode = escHtml(data.shipStateCode || data.stateCode || '');
  const shipGstin = escHtml(data.gstinShip || data.gstin || '');

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }
  const companyState = escHtml(profile.state || 'Gujarat');
  const companyGstin = escHtml(profile.gstNumber || '24AABCA7339N1Z8');
  
  const extractDescAndHsn = (label) => {
    const match = label.match(/(.*?)\s*\((\d+)\)$/);
    if (match) {
      return { desc: match[1].trim(), hsn: match[2] };
    }
    return { desc: label, hsn: '' };
  };

  const isIgst = (billState.toLowerCase() !== companyState.toLowerCase()) && billState !== '';

  const bodyRows = rows.map((r) => {
    const { desc, hsn } = extractDescAndHsn(r.label);
    const sgstAmt = isIgst ? 0 : r.sgstAmt;
    const cgstAmt = isIgst ? 0 : r.cgstAmt;
    
    return `
      <tr>
        <td>${r.sr}</td><td class="desc">${escHtml(desc)}</td><td>${escHtml(hsn)}</td><td>${fmtQty(r.qty)}</td>
        <td>${fmtMoney(r.rate)}</td><td>${fmtMoney(r.amt)}</td><td>${isIgst ? '-' : fmtMoney(cgstAmt)}</td><td>${isIgst ? '-' : fmtMoney(sgstAmt)}</td><td>${fmtMoney(r.rowTotal)}</td>
      </tr>`;
  }).join('');

  const blanksCount = Math.max(0, NOTE_MIN_ROWS - rows.length);
  const blanks = Array.from({ length: blanksCount }, () => `
      <tr class="filler-row"><td colspan="9"></td></tr>
  `).join('');

  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;
  
  const totalTaxAmount = isIgst ? (totalSgst + totalCgst) : (totalCgst + totalSgst);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Credit Note - ${escHtml(profile.companyName)}</title>
<style>
  :root{
    --purple: #6C4FA1;
    --purple-dark: #5B3E92;
    --purple-light: #F1EDF9;
    --purple-border: #C9BEE0;
    --grey-border: #B8B8B8;
    --text-dark: #2b2b2b;
  }
  *{box-sizing:border-box;}
  html,body{
    margin:0;
    padding:0;
    background:#e9e9ec;
    font-family: Arial, Helvetica, sans-serif;
    color: var(--text-dark);
  }

  /* ===== A4 PAGE ===== */
  .sheet{
    width:210mm;
    min-height:297mm;
    margin:10px auto;
    background:#fff;
    border:1px solid var(--grey-border);
    padding:10mm 10mm 6mm 10mm;
    position:relative;
    display:flex;
    flex-direction:column;
  }
  @media print{
    body{background:#fff;}
    .sheet{margin:0;border:none;box-shadow:none;}
    @page{ size:A4; margin:0; }
  }

  svg.ic{ vertical-align:middle; flex-shrink:0; }

  /* ===== HEADER ===== */
  .header{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    border-bottom:2px solid var(--purple);
    padding-bottom:10px;
  }
  .logo-block{
    display:flex;
    align-items:center;
    gap:10px;
  }
  .logo-icon{
    width:56px;height:56px;
  }
  .company-name{
    font-size:24px;font-weight:800;letter-spacing:0.5px;
  }
  .company-name .um{color:#1a9e8f;}
  .company-name .icron{color:#2d3a8c;}
  .company-tagline{
    font-size:10.5px;color:#555;letter-spacing:2px;font-weight:600;
  }
  .credit-badge{
    background:var(--purple);
    color:#fff;
    text-align:center;
    padding:9px 28px;
    border-radius:4px;
    font-weight:800;
    font-size:16px;
    letter-spacing:0.5px;
  }
  .credit-badge .sub{
    font-size:9.5px;font-weight:600;letter-spacing:1px;display:block;margin-top:3px;
  }

  /* ===== COMPANY INFO + REFERENCE ===== */
  .info-row{
    display:flex;
    justify-content:space-between;
    gap:16px;
    padding:10px 0;
    border-bottom:1px solid var(--purple-border);
  }
  .company-info{
    font-size:10.5px;
    line-height:1.65;
    width:52%;
  }
  .info-line{
    display:flex;
    align-items:flex-start;
    gap:7px;
    margin-bottom:2px;
  }
  .info-line svg{ margin-top:2px; }
  .gst-line{ margin-top:5px; }
  .ref-table{
    width:46%;
    border:1px solid var(--purple-border);
    border-collapse:collapse;
    font-size:10.5px;
    height:fit-content;
  }
  .ref-table th{
    background:var(--purple);
    color:#fff;
    text-align:left;
    padding:5px 8px;
    font-size:10.5px;
    letter-spacing:0.5px;
  }
  .ref-table td{
    padding:4px 8px;
    border-top:1px solid var(--purple-border);
  }
  .ref-table td.label{
    width:58%;color:#444;
  }
  .ref-table td.label .lbl-inner{
    display:flex; align-items:center; gap:6px;
  }
  .ref-table td.value{
    font-weight:700;text-align:right;
  }

  /* ===== BILL TO / SHIP TO ===== */
  .parties{
    display:flex;
    border:1px solid var(--purple-border);
    margin-top:10px;
  }
  .party{
    width:50%;
    font-size:10.5px;
  }
  .party:first-child{
    border-right:1px solid var(--purple-border);
  }
  .party-header{
    background:var(--purple-light);
    color:var(--purple-dark);
    font-weight:700;
    padding:5px 10px;
    font-size:11px;
    display:flex;
    align-items:center;
    gap:7px;
  }
  .party-body{
    padding:7px 10px;
    line-height:1.7;
  }
  .party-body .name{
    font-weight:700;
    color:var(--purple-dark);
  }

  /* ===== REASON BAR ===== */
  .reason-bar{
    border:1px solid var(--purple-border);
    border-top:none;
    padding:7px 10px;
    font-size:10.5px;
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    gap:14px;
    background:#fbfbfb;
  }
  .reason-bar .label{
    font-weight:700;
    color:var(--purple-dark);
    margin-right:2px;
    display:flex;
    align-items:center;
    gap:6px;
  }
  .reason-bar .opt{
    display:flex;align-items:center;gap:4px;
  }
  .checkbox{
    width:11px;height:11px;
    border:1.4px solid #333;
    display:inline-block;
    position:relative;
  }
  .checkbox.checked::after{
    content:"✓";
    position:absolute;
    top:-4px;left:0.5px;
    font-size:10px;
    font-weight:900;
    color:#1a1a1a;
  }

  /* ===== ITEMS TABLE ===== */
  table.items{
    width:100%;
    border-collapse:collapse;
    margin-top:8px;
    font-size:10px;
  }
  table.items th{
    background:var(--purple-light);
    border:1px solid var(--purple-border);
    padding:6px 4px;
    text-align:center;
    font-size:9.5px;
    font-weight:700;
    color:var(--purple-dark);
  }
  table.items td{
    border:1px solid var(--purple-border);
    padding:6px 4px;
    text-align:center;
  }
  table.items td.desc{
    text-align:left;
  }
  table.items tbody tr:nth-child(even){ background:#fbfaff; }
  table.items tr.total-row td{
    font-weight:800;
    background:#fff;
    border-top:2px solid var(--purple);
  }

  .filler-row td{ height:20px; }

  /* ===== NOTES + TAX SUMMARY ===== */
  .bottom-row{
    display:flex;
    gap:0;
    margin-top:8px;
    border:1px solid var(--purple-border);
  }
  .notes-box{
    width:55%;
    border-right:1px solid var(--purple-border);
    font-size:10px;
  }
  .box-header{
    background:var(--purple);
    color:#fff;
    font-weight:700;
    padding:5px 10px;
    font-size:10.5px;
    display:flex;
    align-items:center;
    gap:7px;
  }
  .box-body{
    padding:9px 10px;
    line-height:1.9;
  }
  .tax-summary{
    width:45%;
    font-size:10px;
  }
  .tax-table{
    width:100%;
    border-collapse:collapse;
  }
  .tax-table td{
    padding:4px 10px;
  }
  .tax-table tr.line td{
    border-top:1px solid var(--purple-border);
  }
  .tax-table td.val{
    text-align:right;
    font-weight:600;
  }
  .tax-table tr.roundoff td{
    font-style:italic;
    color:#555;
  }

  /* ===== TERMS + DECLARATION ===== */
  .terms-row{
    display:flex;
    border:1px solid var(--purple-border);
    border-top:none;
    flex:1;
  }
  .terms-box, .decl-box{
    width:50%;
    font-size:9.5px;
  }
  .terms-box{
    border-right:1px solid var(--purple-border);
  }
  .decl-box .box-body{
    padding-top:11px;
    padding-bottom:26px;
  }
  .terms-box ol{
    margin:7px 10px;
    padding-left:15px;
    line-height:1.75;
  }

  /* ===== CREDIT AMOUNT ===== */
  .credit-amount{
    background:var(--purple);
    color:#fff;
    font-weight:800;
    font-size:14px;
    padding:9px 12px;
    display:flex;
    justify-content:space-between;
    margin-top:8px;
  }
  .signature{
    text-align:right;
    font-size:10px;
    padding:22px 12px 4px 0;
  }
  .sig-line{
    border-top:1px solid #999;
    width:150px;
    margin-left:auto;
    margin-bottom:4px;
  }

  .footer{
    display:flex;
    justify-content:space-between;
    font-size:8.5px;
    color:#777;
    margin-top:auto;
    padding-top:8px;
  }
</style>
</head>
<body>
<div class="sheet">

  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <svg class="logo-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 30 A35 20 0 1 1 19 71" fill="none" stroke="#1a9e6a" stroke-width="4" stroke-linecap="round"/>
        <path d="M80 70 A35 20 0 1 1 81 29" fill="none" stroke="#1a9e6a" stroke-width="4" stroke-linecap="round"/>
        <polygon points="18,66 12,78 26,76" fill="#1a9e6a"/>
        <polygon points="82,34 88,22 74,24" fill="#1a9e6a"/>
        <text x="28" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#e8781e">U</text>
        <text x="46" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#2d3a8c">M</text>
        <text x="66" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#7a2f8c">J</text>
      </svg>
      <div>
        <div class="company-name"><span class="um">UMA </span><span class="icron">MICRON</span></div>
        <div class="company-tagline">Micronization of API's</div>
      </div>
    </div>
    <div class="credit-badge">CREDIT NOTE<span class="sub">AGAINST TAX INVOICE</span></div>
  </div>

  <!-- COMPANY INFO + REFERENCE -->
  <div class="info-row">
    <div class="company-info">
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z" fill="#6C4FA1"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>
        <span>Plot No. 118, G.I.D.C., Ranoli,<br>N.H. No. 8, Vadodara – 391350,<br>Gujarat, India</span>
      </div>
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2 2.2z" fill="#6C4FA1"/></svg>
        <span>+91 97120 00297</span>
      </div>
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" fill="#6C4FA1"/><path d="M2 6l10 7 10-7" stroke="#fff" stroke-width="1.6" fill="none"/></svg>
        <span>umamicron@gmail.com</span>
      </div>
      <div class="info-line">
        <svg class="ic" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#6C4FA1"/><path d="M2 12h20M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10z" stroke="#fff" stroke-width="1.2" fill="none"/></svg>
        <span>www.umamicron.com</span>
      </div>
      <div class="gst-line">
        <b>GSTIN</b> : ${companyGstin} &nbsp;&nbsp; <b>PAN</b> : ${companyPan}<br>
        <b>State</b> : ${companyState}
      </div>
    </div>
    <table class="ref-table">
      <tr><th colspan="2">REFERENCE DETAILS</th></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#6C4FA1"/><path d="M15 2v5h5" fill="#9a82c9"/></svg>
        Credit Note No.</span></td><td class="value">${docNo}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#6C4FA1"/><rect x="3" y="4" width="18" height="4" fill="#4a3577"/><rect x="6" y="2" width="2" height="4" fill="#4a3577"/><rect x="16" y="2" width="2" height="4" fill="#4a3577"/></svg>
        Credit Note Date</span></td><td class="value">${docDate}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#6C4FA1"/><path d="M15 2v5h5" fill="#9a82c9"/></svg>
        Original Invoice No.</span></td><td class="value">${refInvoice}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#6C4FA1"/><rect x="3" y="4" width="18" height="4" fill="#4a3577"/><rect x="6" y="2" width="2" height="4" fill="#4a3577"/><rect x="16" y="2" width="2" height="4" fill="#4a3577"/></svg>
        Original Invoice Date</span></td><td class="value">${refDate}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M21 15.5c-1.2 0-2.4-.2-3.5-.6-.3-.1-.7 0-1 .3l-2.2 2.2c-2.8-1.4-5.2-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.4-1.1-.6-2.3-.6-3.5 0-.6-.4-1-1-1H4.5c-.6 0-1 .4-1 1C3.5 12.5 11.5 20.5 20.5 20.5c.6 0 1-.4 1-1V16.5c0-.6-.4-1-1-1z" fill="#6C4FA1"/></svg>
        Customer PO No.</span></td><td class="value">${poNo}</td></tr>
      <tr><td class="label"><span class="lbl-inner">
        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#6C4FA1"/><path d="M15 2v5h5" fill="#9a82c9"/></svg>
        Reference</span></td><td class="value">${ref}</td></tr>
    </table>
  </div>

  <!-- BILL TO / SHIP TO -->
  <div class="parties">
    <div class="party">
      <div class="party-header">
        <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#6C4FA1"/><circle cx="12" cy="9" r="3.4" fill="#fff"/><path d="M5 19c1.2-3.2 4-5 7-5s5.8 1.8 7 5c-1.9 1.6-4.4 2.6-7 2.6s-5.1-1-7-2.6z" fill="#fff"/></svg>
        BILL TO
      </div>
      <div class="party-body">
        <div class="name">${billName}</div>
        ${billAddrHtml}<br>
        GSTIN : ${billGstin} &nbsp; State : ${billState} ${billStateCode ? '(' + billStateCode + ')' : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-header">
        <svg width="16" height="14" viewBox="0 0 24 24"><rect x="1" y="6" width="13" height="9" fill="#6C4FA1"/><path d="M14 9h5l4 4v2h-9z" fill="#6C4FA1"/><circle cx="6" cy="18" r="2.3" fill="#4a3577"/><circle cx="18" cy="18" r="2.3" fill="#4a3577"/></svg>
        SHIP TO
      </div>
      <div class="party-body">
        <div class="name">${shipName}</div>
        ${shipAddrHtml}<br>
        GSTIN : ${shipGstin} &nbsp; State : ${shipState} ${shipStateCode ? '(' + shipStateCode + ')' : ''}
      </div>
    </div>
  </div>

  <!-- REASON BAR -->
  <div class="reason-bar">
    <span class="label">
      <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#6C4FA1"/><path d="M8 3.5h6l4 4v11.5H8z" fill="#fff" transform="translate(1,1) scale(0.7)"/></svg>
      REASON FOR CREDIT NOTE
    </span>
    <span class="opt"><span class="checkbox ${data.reason === 'Sales Return' ? 'checked' : ''}"></span> Sales Return</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Rate Difference' ? 'checked' : ''}"></span> Rate Difference</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Discount' ? 'checked' : ''}"></span> Discount</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Excess Billing' ? 'checked' : ''}"></span> Excess Billing</span>
    <span class="opt"><span class="checkbox ${data.reason === 'Material Rejection' ? 'checked' : ''}"></span> Material Rejection</span>
    <span class="opt"><span class="checkbox ${!['Sales Return', 'Rate Difference', 'Discount', 'Excess Billing', 'Material Rejection'].includes(data.reason) && data.reason ? 'checked' : ''}"></span> Other ${!['Sales Return', 'Rate Difference', 'Discount', 'Excess Billing', 'Material Rejection'].includes(data.reason) && data.reason ? escHtml(data.reason) : '_______'}</span>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:5%;">Sr. No.</th>
        <th style="width:24%;">Description</th>
        <th style="width:9%;">HSN / SAC</th>
        <th style="width:6%;">Qty.</th>
        <th style="width:10%;">Rate (₹)</th>
        <th style="width:11%;">Amount (₹)</th>
        <th style="width:9%;">CGST (₹)</th>
        <th style="width:9%;">SGST (₹)</th>
        <th style="width:11%;">Total Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      ${blanks}
      <tr class="total-row">
        <td colspan="3">TOTAL</td><td>${fmtQty(totalQty) || '0.00'}</td><td></td><td>${fmtMoney(totalAmt)}</td><td>${isIgst ? '-' : fmtMoney(totalCgst)}</td><td>${isIgst ? '-' : fmtMoney(totalSgst)}</td><td>${fmtMoney(totalAll)}</td>
      </tr>
    </tbody>
  </table>

  <!-- BOTTOM: NOTES + TAX SUMMARY -->
  <div class="bottom-row">
    <div class="notes-box">
      <div class="box-header">
        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#fff"/><path d="M15 2v5h5" fill="#c9bee0"/></svg>
        NOTES
      </div>
      <div class="box-body">
        • Amount will be adjusted against the next invoice.<br>
        • Please quote the Credit Note Number for future reference.
        ${data.particulars ? '<br><br><b>Particulars:</b> ' + escHtml(data.particulars) : ''}
      </div>
    </div>
    <div class="tax-summary">
      <table class="tax-table">
        <tr><td>Taxable Amount Before Tax</td><td class="val">${fmtMoney(totalAmt)}</td></tr>
        <tr class="line"><td>Add : CGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</td><td class="val">${isIgst ? '-' : fmtMoney(totalCgst)}</td></tr>
        <tr><td>Add : SGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</td><td class="val">${isIgst ? '-' : fmtMoney(totalSgst)}</td></tr>
        <tr class="line"><td>Add : IGST @ 18%</td><td class="val">${isIgst ? fmtMoney(totalCgst + totalSgst) : '-'}</td></tr>
        <tr class="line"><td><b>Total Tax Amount</b></td><td class="val"><b>${fmtMoney(totalTaxAmount)}</b></td></tr>
        <tr class="roundoff"><td>Round Off</td><td class="val">${fmtMoney(roundOff)}</td></tr>
      </table>
    </div>
  </div>

  <!-- TERMS + DECLARATION -->
  <div class="terms-row">
    <div class="terms-box">
      <div class="box-header">
        <svg width="13" height="13" viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="12" rx="2" fill="#fff"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" fill="none" stroke="#fff" stroke-width="1.8"/><rect x="2" y="8" width="20" height="12" rx="2" fill="none" stroke="#fff" stroke-width="0"/></svg>
        TERMS &amp; CONDITIONS
      </div>
      <div class="box-body">
        <ol>
          <li>Subject to Vadodara Jurisdiction.</li>
          <li>Payment terms as per our agreed terms.</li>
          <li>Interest will be charged @ 24% p.a. if the amount remains unpaid from the due date.</li>
        </ol>
      </div>
    </div>
    <div class="decl-box">
      <div class="box-header">
        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="#fff"/><path d="M9 12l2 2 4-4" stroke="#6C4FA1" stroke-width="1.8" fill="none"/></svg>
        DECLARATION
      </div>
      <div class="box-body">
        This Credit Note is issued against the above tax invoice and forms an integral part of the original transaction.
        <div class="signature">
          <div>For ${escHtml(profile.companyName)}</div>
          <div style="height:38px;"></div>
          <div class="sig-line"></div>
          Authorised Signatory
        </div>
      </div>
    </div>
  </div>

  <!-- CREDIT AMOUNT -->
  <div class="credit-amount">
    <span>CREDIT AMOUNT</span>
    <span>₹ ${fmtMoney(roundedTotal)}</span>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>Thank you for your business!</span>
    <span>E.&amp;O.E.</span>
    <span>This is a computer generated credit note</span>
    <span>Page 1 of 1</span>
  </div>

</div>
</body>
</html>`;

  return { html, docNo };
};


export const renderDebitNotePdf = async (data, { mode = 'save' } = {}) => {
  const { html, docNo } = buildDebitNoteHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, { mode, filePrefix: 'DN', docNo, width: PRINT_PAGE_W, fitPage: true });
};

export const renderCreditNotePdf = async (data, { mode = 'save' } = {}) => {
  const { html, docNo } = buildCreditNoteHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, { mode, filePrefix: 'CN', docNo, width: PRINT_PAGE_W, fitPage: true });
};
