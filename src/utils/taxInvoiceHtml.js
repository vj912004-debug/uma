import { mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  TI_EMPTY_ROWS,
  splitPartyAddressLines,
  formatPdfDateDmy,
  buildTiChargeAmounts,
  getSplitGstRates
} from './taxInvoiceLayout';
import { renderHtmlToPdf } from './printTheme';
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

export const buildTaxInvoiceHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);

  const chargeAmounts = buildTiChargeAmounts(data);
  const { taxRate, displayRate, sgst: sgstCalc, cgst: cgstCalc, igst: igstCalc } = getSplitGstRates(data);
  // Print RATE + tax amounts both use full form GST (e.g. 18).
  const printGstRate = displayRate;

  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalAll = 0;
  let totalQty = 0;

  const rows = [];
  let sr = 1;

  const pushRow = (desc, qty, rate, amt) => {
    const sgstAmt = amt * (sgstCalc / 100);
    const cgstAmt = amt * (cgstCalc / 100);
    const igstAmt = amt * (igstCalc / 100);
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

    const rateCell = amt > 0 ? printGstRate : '';
    const igstRateCell = amt > 0 && igstCalc ? printGstRate : '';

    rows.push(`
      <tr>
        <td class="center">${sr++}</td>
        <td class="left">${escHtml(cleanDesc)}</td>
        <td class="center">${fmtQty(qty)}</td>
        <td class="num">${rate ? escHtml(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="num">${fmtMoney(amt)}</td>
        <td class="num">${rateCell}</td>
        <td class="num">${fmtMoney(sgstAmt)}</td>
        <td class="num">${rateCell}</td>
        <td class="num">${fmtMoney(cgstAmt)}</td>
        <td class="num">${igstRateCell}</td>
        <td class="num">${fmtMoney(igstAmt)}</td>
        <td class="num">${fmtMoney(rowTotal)}</td>
      </tr>`);
  };

  TI_CHARGES_LIST.forEach((charge) => {
    const line = chargeAmounts[charge.key];
    if (!line) return;
    pushRow(charge.label, line.qty, line.rate, line.amt || 0);
  });

  (data.customCharges || []).forEach((cc) => {
    if (!cc.checked) return;
    const ccQty = parseFloat(cc.qty) || 1;
    const rate = parseFloat(cc.rate) || 0;
    const amt = ccQty * rate;
    if (amt <= 0) return;
    pushRow(cc.name || '', ccQty, rate, amt);
  });

  const BLANK_ROWS = 4;
  for (let i = 0; i < BLANK_ROWS; i++) {
    rows.push(`
      <tr class="filler-row">
        <td></td><td></td><td></td><td></td>
        <td class="num">0.00</td><td></td><td class="num">0.00</td>
        <td></td><td class="num">0.00</td><td></td><td class="num">0.00</td>
        <td class="num">0.00</td>
      </tr>`);
  }

  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;


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

  return `<!DOCTYPE html>
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
    padding:6px 3px;
    text-align:center;
    vertical-align:middle;
    border:1px solid rgba(255,255,255,0.55);
    line-height:1.15;
    white-space:normal;
    word-break:break-word;
    overflow:visible;
    font-size:12px;
    letter-spacing:0;
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
</style>
</head>
<body>
<div class="page">
<table class="content-wrapper">
  <tr>
    <td valign="top" style="padding: 4px 10px 0;">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <div class="logo">
        <img src="data:image/png;base64,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" style="width:100%;height:100%;object-fit:contain;" alt="Logo" />
      </div>
      <div class="brand-text">
        <h1>UMA MICRON</h1>
        <div class="tagline">Micronization of API's</div>
      </div>
    </div>
    <div class="tax-invoice-box">
      <div class="ti-title">TAX INVOICE</div>
      <div class="ti-sub">ORIGINAL FOR RECIPIENT</div>
    </div>
  </div>

  <!-- COMPANY INFO + INVOICE META -->
  <div class="info-row">
    <div class="company-info" style="display:flex; justify-content:space-between; align-items:center;">
      <div class="address-col" style="flex:1; padding-right:14px;">
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')} <br> ${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')},<br> ${escHtml(profile.state || 'Gujarat')}, India</span></div>
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
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">Invoice No.</span><span class="m-colon">:</span><span class="m-value">${docNo}</span></div>
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg></span><span class="m-label">Invoice Date</span><span class="m-colon">:</span><span class="m-value">${docDate}</span></div>
      </div>
      <div class="block">
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></span><span class="m-label">PO No.</span><span class="m-colon">:</span><span class="m-value">${poNo}</span></div>
        <div class="meta-row sub"><span class="m-icon"></span><span class="m-label">PO Date</span><span class="m-colon">:</span><span class="m-value">${poDate}</span></div>
        <div class="meta-row sub"><span class="m-icon"></span><span class="m-label">Delivery Challan No.</span><span class="m-colon">:</span><span class="m-value">${dcNo}</span></div>
        <div class="meta-row sub"><span class="m-icon"></span><span class="m-label">DC Date</span><span class="m-colon">:</span><span class="m-value">${dcDate}</span></div>
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
      <div class="party-foot">
        <div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>${billGstin}</span></div>
        <div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>${billState} ${billStateCode ? '(' + escHtml(billStateCode) + ')' : ''}</span></div>
      </div>
    </div>
    <div class="party">
      <div class="party-head"><svg viewBox="0 0 24 24"><path d="M3 16V7h9v9"/><path d="M12 10h5l3 3v3h-8z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg> SHIP TO</div>
      <div class="party-body">
        <div class="cname">${shipName}</div>
        ${shipAddr.map(line => '<div>' + escHtml(line) + '</div>').join('')}
      </div>
      <div class="party-foot">
        <div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>${shipGstin}</span></div>
        <div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>${shipState} ${shipStateCode ? '(' + escHtml(shipStateCode) + ')' : ''}</span></div>
      </div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <div class="table-container">
    <table class="items">
      <colgroup>
        <col style="width: 3%;">
        <col style="width: 20%;">
        <col style="width: 7%;">
        <col style="width: 7%;">
        <col style="width: 8%;">
        <col style="width: 6%;">
        <col style="width: 8%;">
        <col style="width: 6%;">
        <col style="width: 8%;">
        <col style="width: 6%;">
        <col style="width: 8%;">
        <col style="width: 13%;">
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

      </td>
  </tr>
  <tr>
    <td valign="bottom" style="padding: 8px 10px 0; height: 1px;">
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
        <div class="trow"><span class="tlabel">Total Amount Before Tax</span><span class="tval">&#8377; ${fmtMoney(totalAmt)}</span></div>
        <div class="trow"><span class="tlabel">CGST @ ${displayRate}%</span><span class="tval">&#8377; ${fmtMoney(totalCgst)}</span></div>
        <div class="trow"><span class="tlabel">SGST @ ${displayRate}%</span><span class="tval">&#8377; ${fmtMoney(totalSgst)}</span></div>
        <div class="trow"><span class="tlabel">IGST @ ${taxRate}%</span><span class="tval">&#8377; ${fmtMoney(totalIgst)}</span></div>
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
    <span>This is a computer-generated invoice.</span>
    <span>Page 1 of 1</span>
  </div>

    </td>
  </tr>
</table>
</div>
</body>
</html>`;
};

export const renderTaxInvoicePdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const html = buildTaxInvoiceHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'TI',
    docNo: data.invoiceNo || 'N/A',
    fitPage: true,
    printPrefs
  });
};
