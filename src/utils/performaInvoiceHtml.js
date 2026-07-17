import { mergeCompanyProfile } from './companyProfile';
import {
  PI_CHARGES_LIST,
  PI_EMPTY_ROWS,
  splitPartyAddressLines,
  formatPdfDateDmy,
  buildTiChargeAmounts
} from './taxInvoiceLayout';

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

export const buildPerformaInvoiceHtml = (data, profileInput) => {
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

  const pushRow = (desc, qty, rate, amt, sgstPercent, cgstPercent) => {
    const sgstAmt = amt * (sgstPercent / 100);
    const cgstAmt = amt * (cgstPercent / 100);
    const rowTotal = amt + sgstAmt + cgstAmt;
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalAll += rowTotal;
    totalQty += parseFloat(qty) || 0;

    // Extract HSN from description if present e.g. "Minimum Cleaning Charges(998842)"
    let hsn = '';
    let cleanDesc = desc;
    const match = desc.match(/(.*?)\((\d+)\)$/);
    if (match) {
      cleanDesc = match[1].trim();
      hsn = match[2];
    }

    rows.push(`
      <tr>
        <td class="center">${sr++}</td>
        <td class="left">${escHtml(cleanDesc)}</td>
        <td class="center">${escHtml(hsn)}</td>
        <td>${fmtQty(qty)}</td>
        <td>${rate ? escHtml(parseFloat(rate).toFixed(2)) : ''}</td>
        <td>${fmtMoney(amt)}</td>
        <td>${fmtMoney(cgstAmt)}</td>
        <td>${fmtMoney(sgstAmt)}</td>
        <td>${fmtMoney(0)}</td>
        <td>${fmtMoney(rowTotal)}</td>
      </tr>`);
  };

  PI_CHARGES_LIST.forEach((charge) => {
    const line = chargeAmounts[charge.key];
    if (!line) return;
    pushRow(charge.label, line.qty, line.rate, line.amt || 0, charge.sgst, charge.cgst);
  });

  (data.customCharges || []).forEach((cc) => {
    if (!cc.checked) return;
    const ccQty = parseFloat(cc.qty) || 1;
    const rate = parseFloat(cc.rate) || 0;
    const amt = ccQty * rate;
    if (amt <= 0) return;
    pushRow(cc.name || '', ccQty, rate, amt, 9, 9);
  });

  const MIN_ROWS = 15;
  const blanksCount = Math.max(0, MIN_ROWS - (sr - 1));
  for (let i = 0; i < blanksCount; i++) {
    rows.push(`
      <tr class="filler-row">
        <td></td><td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td><td></td>
      </tr>`);
  }

  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;

  rows.push(`
    <tr class="total-row">
      <td colspan="2" class="center">TOTAL</td>
      <td></td>
      <td>${fmtQty(totalQty) || '0.00'}</td>
      <td></td>
      <td>${fmtMoney(totalAmt)}</td>
      <td>${fmtMoney(totalCgst)}</td>
      <td>${fmtMoney(totalSgst)}</td>
      <td>${fmtMoney(totalIgst)}</td>
      <td>${fmtMoney(totalAll)}</td>
    </tr>`);

  const docNo = escHtml(data.invoiceNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const poNo = escHtml(data.partyDocNo || 'Verbal');
  const poDate = escHtml(formatPdfDateDmy(data.partyDocDate) || '');
  const dcNo = escHtml(data.dcNo || '');
  const dcDate = escHtml(formatPdfDateDmy(data.dcDate) || '');
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

  return \`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UMA MICRON - Tax Invoice</title>
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
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#fff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:var(--text);}
  
  /* A4 scaling */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 10mm;
    margin: 0 auto;
    background: #fff;
    border: none;
  }

  /* Outline for the whole content */
  .content-wrapper {
    border: 2px solid var(--purple);
    padding: 18px;
    height: 100%;
  }

  /* ===== HEADER ===== */
  .header{
    display:flex;
    justify-content:space-between;
    align-items:stretch;
    gap:14px;
    margin-bottom:14px;
  }
  .brand{
    display:flex;
    align-items:center;
    gap:14px;
  }
  .logo{
    width:78px;
    height:78px;
    position:relative;
    flex-shrink:0;
  }
  .logo svg{width:100%;height:100%;}
  .brand-text h1{
    margin:0;
    font-family:Georgia,'Times New Roman',serif;
    font-size:38px;
    letter-spacing:1px;
    color:var(--purple);
    line-height:1;
  }
  .brand-text .tagline{
    color:var(--green);
    font-weight:700;
    font-size:16px;
    margin-top:2px;
  }
  .tax-invoice-box{
    background:var(--purple);
    color:#fff;
    text-align:center;
    padding:10px 22px;
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
    min-width:230px;
  }
  .tax-invoice-box .ti-title{
    font-size:30px;
    font-weight:800;
    letter-spacing:1px;
    margin-bottom:6px;
  }
  .tax-invoice-box .ti-sub{
    background:#fff;
    color:var(--purple);
    font-size:11px;
    font-weight:700;
    letter-spacing:.5px;
    padding:3px 10px;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .info-row{
    display:flex;
    gap:14px;
    margin-bottom:14px;
  }
  .company-info{
    flex:1.15;
    font-size:12.5px;
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
    font-size:12.5px;
    line-height:1.7;
  }
  .reg-details b{color:var(--purple);}
  .reg-row{display:flex;}
  .reg-row .label{width:62px;font-weight:700;color:var(--purple);}
  .reg-row .colon{width:14px;}

  .invoice-meta{
    flex:1;
    border:1px solid var(--purple);
  }
  .invoice-meta .block{
    padding:8px 12px;
    font-size:12.5px;
  }
  .invoice-meta .block + .block{
    border-top:1px solid var(--purple);
  }
  .meta-row{
    display:flex;
    margin-bottom:3px;
  }
  .meta-row .m-icon{color:var(--purple);width:18px;flex-shrink:0;display:flex;align-items:center;}
  .meta-row .m-label{width:110px;flex-shrink:0;color:#333;}
  .meta-row .m-colon{width:12px;flex-shrink:0;}
  .meta-row .m-value{font-weight:600;}
  .meta-row.sub .m-label{width:110px;padding-left:18px;box-sizing:border-box;}

  /* ===== BILL TO / SHIP TO ===== */
  .parties{
    display:flex;
    gap:14px;
    margin-bottom:14px;
  }
  .party{
    flex:1;
    border:1px solid var(--lav-border);
  }
  .party-head{
    background:var(--lav-bg);
    color:var(--purple);
    font-weight:800;
    font-size:13px;
    letter-spacing:.5px;
    padding:7px 12px;
    display:flex;
    align-items:center;
    gap:8px;
    border-bottom:1px solid var(--lav-border);
  }
  .party-head svg, .box-head svg{flex-shrink:0;}
  .party-body{
    padding:10px 12px;
    font-size:12.5px;
    line-height:1.55;
    min-height: 80px;
  }
  .party-body .cname{
    color:var(--purple);
    font-weight:800;
    font-size:14px;
    margin-bottom:4px;
  }
  .party-foot{
    border-top:1px solid var(--lav-border);
    padding:8px 12px;
    font-size:12.5px;
  }
  .party-foot .frow{display:flex;margin-bottom:2px;}
  .party-foot .flabel{width:50px;font-weight:700;}
  .party-foot .fcolon{width:12px;}

  /* ===== TABLE ===== */
  table.items{
    width:100%;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:12px;
  }
  table.items thead th{
    background:var(--purple);
    color:#fff;
    font-weight:700;
    padding:8px 6px;
    text-align:left;
    border:1px solid var(--purple);
  }
  table.items thead th.num{text-align:right;padding-right:10px;}
  table.items tbody td{
    border:1px solid var(--lav-border);
    padding:6px 6px;
    height:20px;
  }
  table.items tbody td.num{text-align:right;padding-right:10px;}
  table.items tbody tr.empty td{height:22px;}
  table.items tfoot td{
    border:1px solid var(--purple);
    background:var(--lav-bg);
    font-weight:800;
    padding:8px 6px;
    color:var(--purple-dark);
  }
  table.items tfoot td.num{text-align:right;padding-right:10px;}

  /* ===== BOTTOM SECTION: bank + totals ===== */
  .bottom{
    display:flex;
    gap:14px;
    margin-bottom:14px;
    align-items:stretch;
  }
  .bank{
    flex:1;
    border:1px solid var(--lav-border);
  }
  .box-head{
    background:var(--lav-bg);
    color:var(--purple);
    font-weight:800;
    font-size:13px;
    padding:7px 12px;
    display:flex;
    align-items:center;
    gap:8px;
    border-bottom:1px solid var(--lav-border);
  }
  .bank-body{
    padding:10px 12px;
    font-size:12.5px;
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
    border:1px solid var(--lav-border);
    border-bottom:none;
    padding:10px 14px;
    font-size:12.5px;
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
    padding:10px 14px;
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
    padding:10px 12px;
    font-size:11.5px;
    line-height:1.6;
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
    padding:10px 12px 0;
    font-size:12.5px;
  }
  .sig-col .sig-line{
    margin:30px 12px 10px;
    border-top:1px solid #333;
    text-align:center;
    padding-top:4px;
    font-size:11.5px;
  }

  /* ===== BAR FOOTER ===== */
  .barfoot{
    background:var(--purple);
    color:#fff;
    margin-top:14px;
    padding:8px 16px;
    display:flex;
    justify-content:space-between;
    font-size:11.5px;
  }

  @media print{
    body{background:#fff;}
    .page{margin:0;padding:0;width:100%;height:100%;}
    .content-wrapper{border:none;padding:0;}
  }
</style>
</head>
<body>
<div class="page">
<div class="content-wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 8 C74 8 90 26 88 46 C86 63 72 78 55 80" fill="none" stroke="#2fa84f" stroke-width="6" stroke-linecap="round"/>
          <path d="M50 92 C26 92 10 74 12 54 C14 37 28 22 45 20" fill="none" stroke="#f47920" stroke-width="6" stroke-linecap="round"/>
          <polygon points="86,40 96,46 88,54" fill="#2fa84f"/>
          <polygon points="14,60 4,54 12,46" fill="#f47920"/>
          <text x="50" y="45" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="26" fill="#f47920">U</text>
          <text x="50" y="70" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="26" fill="#3d2b7d">M</text>
        </svg>
      </div>
      <div class="brand-text">
        <h1>UMA MICRON</h1>
        <div class="tagline">Micronization of API&rsquo;s</div>
      </div>
    </div>
    <div class="tax-invoice-box">
      <div class="ti-title">PROFORMA INVOICE</div>
      <div class="ti-sub">ORIGINAL FOR RECIPIENT</div>
    </div>
  </div>

  <!-- COMPANY INFO + INVOICE META -->
  <div class="info-row">
    <div class="company-info">
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>Plot No. 1116, G.I.D.C., Ranoli,<br>N.H. No. 8, Vadodara - 391350,<br>Gujarat, India</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span>+91 97120 00297</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span><span>umamicron@gmail.com</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span><span>www.umamicron.com</span></div>

      <div class="reg-details">
        <div class="reg-row"><span class="label">GSTIN</span><span class="colon">:</span><span>24AABCA7339N1ZB</span></div>
        <div class="reg-row"><span class="label">PAN</span><span class="colon">:</span><span>AABCA7339N</span></div>
        <div class="reg-row"><span class="label">State</span><span class="colon">:</span><span>Gujarat (24)</span></div>
      </div>
    </div>

    <div class="invoice-meta">
      <div class="block">
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">PI No.</span><span class="m-colon">:</span><span class="m-value">\${docNo}</span></div>
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg></span><span class="m-label">PI Date</span><span class="m-colon">:</span><span class="m-value">\${docDate}</span></div>
      </div>
      <div class="block">
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></span><span class="m-label">PO No.</span><span class="m-colon">:</span><span class="m-value">\${poNo}</span></div>
        <div class="meta-row sub"><span class="m-label">PO Date</span><span class="m-colon">:</span><span class="m-value">\${poDate}</span></div>
        <div class="meta-row sub"><span class="m-label">Delivery Challan No.</span><span class="m-colon">:</span><span class="m-value">\${dcNo}</span></div>
        <div class="meta-row sub"><span class="m-label">DC Date</span><span class="m-colon">:</span><span class="m-value">\${dcDate}</span></div>
      </div>
    </div>
  </div>

  <!-- BILL TO / SHIP TO -->
  <div class="parties">
    <div class="party">
      <div class="party-head"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg> BILL TO</div>
      <div class="party-body">
        <div class="cname">\${billName}</div>
        \${billAddr.map(line => '<div>' + escHtml(line) + '</div>').join('')}
      </div>
      <div class="party-foot">
        <div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>\${billGstin}</span></div>
        <div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>\${billState} \${billStateCode ? '(' + escHtml(billStateCode) + ')' : ''}</span></div>
      </div>
    </div>
    <div class="party">
      <div class="party-head"><svg viewBox="0 0 24 24"><path d="M3 16V7h9v9"/><path d="M12 10h5l3 3v3h-8z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg> SHIP TO</div>
      <div class="party-body">
        <div class="cname">\${shipName}</div>
        \${shipAddr.map(line => '<div>' + escHtml(line) + '</div>').join('')}
      </div>
      <div class="party-foot">
        <div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>\${shipGstin}</span></div>
        <div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>\${shipState} \${shipStateCode ? '(' + escHtml(shipStateCode) + ')' : ''}</span></div>
      </div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:5%;">Sr. No.</th>
        <th style="width:22%;">Description</th>
        <th style="width:9%;">HSN / SAC</th>
        <th class="num" style="width:6%;">Qty.</th>
        <th class="num" style="width:9%;">Rate (&#8377;)</th>
        <th class="num" style="width:10%;">Amount (&#8377;)</th>
        <th class="num" style="width:8%;">CGST (&#8377;)</th>
        <th class="num" style="width:8%;">SGST (&#8377;)</th>
        <th class="num" style="width:8%;">IGST (&#8377;)</th>
        <th class="num" style="width:11%;">Total Amount (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      \${rows.join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:center;">TOTAL</td>
        <td class="num">\${fmtQty(totalQty) || '0.00'}</td>
        <td></td>
        <td class="num">\${fmtMoney(totalAmt)}</td>
        <td class="num">\${fmtMoney(totalCgst)}</td>
        <td class="num">\${fmtMoney(totalSgst)}</td>
        <td class="num">\${fmtMoney(totalIgst)}</td>
        <td class="num">\${fmtMoney(totalAll)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- BANK DETAILS + TOTALS -->
  <div class="bottom">
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

    <div class="totals">
      <div class="totals-body">
        <div class="trow"><span class="tlabel">Total Amount Before Tax</span><span class="tval">&#8377; \${fmtMoney(totalAmt)}</span></div>
        <div class="trow"><span class="tlabel">Add&nbsp; : &nbsp;CGST @ 9%</span><span class="tval">&#8377; \${fmtMoney(totalCgst)}</span></div>
        <div class="trow"><span class="tlabel">Add&nbsp; : &nbsp;SGST @ 9%</span><span class="tval">&#8377; \${fmtMoney(totalSgst)}</span></div>
        <div class="trow"><span class="tlabel">Add&nbsp; : &nbsp;IGST @ 18%</span><span class="tval">&#8377; \${fmtMoney(totalIgst)}</span></div>
        <div class="trow rule"><span class="tlabel">Total Tax Amount</span><span class="tval">&#8377; \${fmtMoney(totalCgst + totalSgst + totalIgst)}</span></div>
        <div class="trow"><span class="tlabel">Round Off</span><span class="tval">&#8377; \${fmtMoney(roundOff)}</span></div>
      </div>
      <div class="grand">
        <span>GRAND TOTAL</span>
        <span>&#8377; \${fmtMoney(roundedTotal)}</span>
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
        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
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
    <span>This is a computer generated invoice.</span>
    <span>Page 1 of 1</span>
  </div>

</div>
</div>
</body>
</html>\`;
};

export const renderPerformaInvoicePdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPerformaInvoiceHtml(data, data.companyProfile);
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;background:#fff;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 4;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const target = host.querySelector('.print-host') || host.firstElementChild;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      logging: false
    });

    const naturalW = usableW;
    const naturalH = (canvas.height * naturalW) / canvas.width;
    const scale = Math.min(usableW / naturalW, usableH / naturalH, 1);
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;
    const x = margin + (usableW - drawW) / 2;
    const y = margin;
    
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH);

    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `PI_${data.invoiceNo || 'N/A'}`;
    } else {
      pdf.save(`PI_${data.invoiceNo || 'N/A'}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
