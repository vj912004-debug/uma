import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy, splitPartyAddressLines, getSplitGstRates } from './taxInvoiceLayout';
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
  buildPartyFootHtml,
  buildFillerRowsHtml,
  ITEMS_TABLE_FILL_CSS,
  FIT_FOOTER_CSS,
  fillPrintPartyFields,
  loadUmaAppData,
  buildFooterTerms,
  formatPrintTermsHtml,
  DEFAULT_INVOICE_TERMS,
  buildOptionalMetaRowHtml
} from './printTheme';

const NOTE_CHARGES = [...STANDARD_CHARGES_LIST, OTHER_CHARGE_ITEM];

/** Line items + GST totals for Debit/Credit Notes (shared by form + print). */
export const calcNoteLines = (data) => {
  const { taxRate, displayRate, sgst: sgstCalc, cgst: cgstCalc, igst: igstCalc } = getSplitGstRates(data);
  const rows = [];
  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalQty = 0;
  let sr = 0;

  const pushLine = (label, qty, rate) => {
    if (/^\s*total\s*$/i.test(String(label || ''))) return;
    const q = parseFloat(qty) || 0;
    const r = parseFloat(rate) || 0;
    const amt = q * r;
    if (amt <= 0) return;
    const sgstAmt = amt * (sgstCalc / 100);
    const cgstAmt = amt * (cgstCalc / 100);
    const igstAmt = amt * (igstCalc / 100);
    sr += 1;
    rows.push({
      sr,
      label: label || 'Description',
      qty: q,
      rate: r,
      amt,
      sgstRate: sgstCalc,
      cgstRate: cgstCalc,
      igstRate: igstCalc,
      sgstAmt,
      cgstAmt,
      igstAmt,
      rowTotal: amt + sgstAmt + cgstAmt + igstAmt
    });
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalIgst += igstAmt;
    totalQty += q;
  };

  (data.customCharges || []).forEach((c) => {
    const desc = String(c.description || c.name || '').trim();
    const qty = parseFloat(c.qty) || 0;
    const rate = parseFloat(c.rate) || 0;
    if (!desc && qty * rate <= 0) return;
    pushLine(desc, qty, rate);
  });

  if (!rows.length) {
    NOTE_CHARGES.forEach((c) => {
      if (!data.charges?.[c.key]) return;
      pushLine(c.label || c.key, parseFloat(data.qtys?.[c.key]) || 0, parseFloat(data.rates?.[c.key]) || 0);
    });
  }

  // Legacy notes: use saved ex-GST subtotal only (never GST-inclusive amount).
  if (!rows.length) {
    const taxable = parseFloat(data.subtotal);
    if (Number.isFinite(taxable) && taxable > 0) {
      pushLine(data.particulars || 'Adjustment', 1, taxable);
    }
  }

  const discount = parseFloat(data.discount) || 0;
  const grossAmt = totalAmt;
  if (discount > 0 && totalAmt > 0) {
    totalAmt = Math.max(0, grossAmt - discount);
    const ratio = grossAmt > 0 ? totalAmt / grossAmt : 0;
    totalSgst *= ratio;
    totalCgst *= ratio;
    totalIgst *= ratio;
  }

  const totalAll = totalAmt + totalSgst + totalCgst + totalIgst;
  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;
  return {
    rows,
    grossAmt,
    discount,
    totalAmt,
    totalSgst,
    totalCgst,
    totalIgst,
    totalAll,
    totalQty,
    taxRate,
    displayRate,
    roundedTotal,
    roundOff
  };
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
    gap:10px;
    margin-bottom:8px;
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
    margin-bottom:8px;
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
  ${ITEMS_TABLE_FILL_CSS}
  ${FIT_FOOTER_CSS}
  .cn-page .content-wrapper tr.inv-bot,
  .dn-page .content-wrapper tr.inv-bot { height: auto; }
  .cn-page .content-wrapper tr.inv-bot > td,
  .dn-page .content-wrapper tr.inv-bot > td { height: auto; min-height: 280px; overflow: visible; }
  .content-wrapper tr.items-row > td { padding: 0 10px 4px; }
  .table-container { }
  table.items tbody tr.filler-row { height: 18px; }
  table.items tbody tr.filler-row td {
    height: 18px !important;
    min-height: 18px !important;
    max-height: 18px !important;
  }
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
    padding:4px 3px;
    height:auto;
    min-height:22px;
    vertical-align:middle;
    overflow:visible;
  }
  table.items tbody td.num{text-align:right;padding-right:3px;white-space:nowrap;}
  table.items tbody td.center{text-align:center;white-space:nowrap;}
  table.items tbody td.left{
    text-align:left;
    padding-left:3px;
    white-space:normal;
    overflow-wrap:break-word;
    word-break:break-word;
    line-height:1.25;
  }
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
    gap:10px;
    margin-bottom:8px;
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
    margin:6px 0 0;
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
    padding:7px 14px;
    display:flex;
    justify-content:space-between;
    font-size:12px;
  }

  @media print{
    body{background:#fff;}
    .page {margin:0;padding: 0;width:794px;height: 1123px;max-height:1123px;overflow:hidden;display:flex;flex-direction:column;}
    .content-wrapper { display:flex; flex-direction:column; width:100%; height:100%; min-height:0; border:2px solid var(--purple); box-sizing:border-box; }
  }
`;

const buildNoteHtmlCommon = (raw, profileInput, noteType, reasonsArray) => {
  const data = fillPrintPartyFields(raw, raw?.appData || loadUmaAppData());
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.noteNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const refInvoiceRaw = data.refInvoice || '';
  const refDateRaw = formatPdfDateDmy(data.refInvoiceDate) || '';
  const poNoRaw = data.poNo || '';
  const refRaw = data.reference || '';

  const {
    rows,
    grossAmt,
    discount,
    totalAmt,
    totalSgst,
    totalCgst,
    totalIgst,
    totalAll,
    totalQty,
    taxRate,
    displayRate,
    roundedTotal,
    roundOff
  } = calcNoteLines(data);

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

  const bodyRows = rows.map((r) => {
    let desc = r.label;
    const match = r.label.match(/(.*?)\s*\(\d+\)$/);
    if (match) {
      desc = match[1].trim();
    }
    const sgstRate = r.sgstRate || 0;
    const cgstRate = r.cgstRate || 0;
    const igstRate = r.igstRate || 0;
    
    return `
      <tr>
        <td class="center">${r.sr}</td>
        <td class="left">${escHtml(desc)}</td>
        <td class="center">${fmtQty(r.qty)}</td>
        <td class="num">${fmtMoney(r.rate)}</td>
        <td class="num">${fmtMoney(r.amt)}</td>
        <td class="num">${sgstRate ? sgstRate : ''}</td>
        <td class="num">${fmtMoney(r.sgstAmt)}</td>
        <td class="num">${cgstRate ? cgstRate : ''}</td>
        <td class="num">${fmtMoney(r.cgstAmt)}</td>
        <td class="num">${igstRate ? igstRate : ''}</td>
        <td class="num">${fmtMoney(r.igstAmt)}</td>
        <td class="num">${fmtMoney(r.rowTotal)}</td>
      </tr>`;
  }).join('');

  const blanks = buildFillerRowsHtml(12, 10);
  const totalTaxAmount = totalSgst + totalCgst + totalIgst;
  
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
<div class="page ${noteType === 'Debit Note' ? 'dn-page' : 'cn-page'}">
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
      <div class="block">
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg></span><span class="m-label">${noteType} No.</span><span class="m-colon">:</span><span class="m-value">${docNo}</span></div>
        <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg></span><span class="m-label">${noteType} Date</span><span class="m-colon">:</span><span class="m-value">${docDate}</span></div>
      </div>
      <div class="block">
        ${buildOptionalMetaRowHtml('Original Invoice No.', refInvoiceRaw, { iconHtml: '<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>' })}
        ${buildOptionalMetaRowHtml('Original Invoice Date', refDateRaw, { sub: true })}
        ${buildOptionalMetaRowHtml('Customer PO No.', poNoRaw, { sub: true })}
        ${buildOptionalMetaRowHtml('Reference', refRaw, { sub: true })}
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

  ${reasonBar}

  </div>
  <div class="items-row">

  <!-- ITEMS TABLE -->
  <div class="table-container">
    <table class="items">
    <colgroup>
        <col style="width: 3%;">
        <col style="width: 26%;">
        <col style="width: 6%;">
        <col style="width: 6%;">
        <col style="width: 8%;">
        <col style="width: 5%;">
        <col style="width: 8%;">
        <col style="width: 5%;">
        <col style="width: 8%;">
        <col style="width: 5%;">
        <col style="width: 8%;">
        <col style="width: 12%;">
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
        <div class="trow"><span class="tlabel">Total Amount Before Tax</span><span class="tval">&#8377; ${fmtMoney(grossAmt)}</span></div>
        ${discount > 0 ? `<div class="trow"><span class="tlabel">Discount</span><span class="tval">&#8377; ${fmtMoney(discount)}</span></div>
        <div class="trow"><span class="tlabel">Taxable Amount</span><span class="tval">&#8377; ${fmtMoney(totalAmt)}</span></div>` : ''}
        <div class="trow"><span class="tlabel">CGST @ ${displayRate}%</span><span class="tval">&#8377; ${fmtMoney(totalCgst)}</span></div>
        <div class="trow"><span class="tlabel">SGST @ ${displayRate}%</span><span class="tval">&#8377; ${fmtMoney(totalSgst)}</span></div>
        <div class="trow"><span class="tlabel">IGST @ ${taxRate}%</span><span class="tval">&#8377; ${fmtMoney(totalIgst)}</span></div>
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
  ${buildFooterTerms(
    profile.companyName || 'UMA MICRON',
    formatPrintTermsHtml(data.terms, DEFAULT_INVOICE_TERMS),
    `This ${noteType} is issued against the above tax invoice and forms an integral part of the original transaction.`
  )}

  <!-- BAR FOOTER -->
  <div class="barfoot">
    <span>Thank you for your business!</span>
    <span>E. &amp; O.E.</span>
    <span>This is a computer-generated ${noteType.toLowerCase()}.</span>
    <span>Page 1 of 1</span>
  </div>

  </div>
</div>
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
