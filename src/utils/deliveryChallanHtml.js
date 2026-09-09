import { mergeCompanyProfile } from './companyProfile';
import { buildDcPrintLines, getDcAppData, resolveLinkedMr } from './deliveryChallanLayout';
import { formatPdfDateDmy, splitPartyAddressLines } from './taxInvoiceLayout';
import { escHtml, fmtQty, buildPrintBrandHtml, renderHtmlToPdf, hasPrintVal, fillPrintPartyFields, buildStatusBar, PRINT_FOOTER_MESSAGES } from './printTheme';

const DEFAULT_DC_DELIVERY_NOTE =
  'Material sent for Micronisation on Job Work basis. Goods to be returned after processing.';

const cleanNote = (s) => String(s || '').trim();
const isStockDeliveryNote = (s) => {
  const t = cleanNote(s).replace(/\s+/g, ' ');
  return !t || t.toLowerCase() === DEFAULT_DC_DELIVERY_NOTE.toLowerCase();
};

const resolveDeliveryNote = (data, linkedMr) => {
  const dcTerms = cleanNote(data.termsAndConditions);
  const dcNotes = cleanNote(data.deliveryNotes);
  const mrNotes = cleanNote(linkedMr?.deliveryNotes);
  if (dcTerms && !isStockDeliveryNote(dcTerms)) return dcTerms;
  if (dcNotes && !isStockDeliveryNote(dcNotes)) return dcNotes;
  if (mrNotes) return mrNotes;
  return dcTerms || dcNotes || '';
};

const toTitleCase = (s) => String(s || '')
  .toLowerCase()
  .replace(/\b([a-z])/g, (ch) => ch.toUpperCase());

/** Always return street + city lines for DC company strip (never one long line). */
const buildDcCompanyAddressLines = (profile) => {
  const p = mergeCompanyProfile(profile);
  const city = String(p.city || 'Vadodara').trim();
  const pin = String(p.pincode || '391350').trim();
  const state = String(p.state || 'Gujarat').trim();
  const country = String(p.country || 'India').trim();
  let street = String(p.addressLine1 || '').trim();
  const extra = String(p.addressLine2 || '').trim();

  if (city && street) {
    const lower = street.toLowerCase();
    const cityAt = lower.indexOf(city.toLowerCase());
    if (cityAt > 0) {
      street = street.slice(0, cityAt).replace(/[,\s]+$/g, '').trim();
    }
  }
  if (extra) street = street ? `${street.replace(/,\s*$/, '')}, ${extra}` : extra;
  if (street && !/,\s*$/.test(street)) street = `${street},`;
  if (!street) street = 'Plot No. 1116, G.I.D.C., Ranoli, N.H.No. 8,';

  const line2 = `${city} - ${pin}, ${state}, ${country}`;
  return [toTitleCase(street), toTitleCase(line2)];
};

export const buildDeliveryChallanHtml = (raw, profileInput, appDataInput) => {
  const appData = appDataInput || raw?.appData || getDcAppData();
  const data = fillPrintPartyFields(raw, appData);
  const profile = mergeCompanyProfile(profileInput);
  const { lines, totalDrums, totalQty, goodsValueText } = buildDcPrintLines(data, appData);
  const linkedMr = resolveLinkedMr(data, appData);
  const deliveryNote = resolveDeliveryNote(data, linkedMr);

  const dcNo = escHtml(data.dcNo || 'N/A');
  const dcDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const poNo = escHtml(data.partyDocNo || '');
  const poDate = escHtml(formatPdfDateDmy(data.partyDocDate) || '');
  const companyState = escHtml(toTitleCase(profile.state || 'Gujarat'));
  const [addrLine1, addrLine2] = buildDcCompanyAddressLines(profile).map(escHtml);
  const shipState = escHtml(data.shipState || data.billState || data.state || companyState);
  const stateCode = escHtml(data.shipStateCode || data.billStateCode || data.stateCode || '24');
  const partyGstin = escHtml(data.gstinShip || data.gstinBill || data.gstin || '');
  const partyName = escHtml(data.partyName || '');
  const addressLines = splitPartyAddressLines(data.shipAddress || data.billAddress || data.address || '', 42);

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  const bodyRows = [];
  let globalSr = 1;
  const groups = [];
  let curGroup = null;

  lines.forEach((line) => {
    if (line.kind === 'product') {
       curGroup = {
         isProduct: true,
         sr: globalSr++,
         productName: line.text,
         batches: [],
         totalDrums: 0,
         totalQty: 0
       };
       groups.push(curGroup);
    } else if (line.kind === 'batch') {
       if (!curGroup) {
         curGroup = { isProduct: true, sr: globalSr++, productName: '', batches: [], totalDrums: 0, totalQty: 0 };
         groups.push(curGroup);
       }
      const batchText = line.text.replace(/^BATCH NO:?\s*/i, '');
      curGroup.batches.push({
        text: batchText,
        drums: parseInt(line.drums, 10) || 0,
        qty: line.qty
      });
      curGroup.totalDrums += parseInt(line.drums, 10) || 0;
      curGroup.totalQty += parseFloat(line.qty) || 0;
    } else if (line.kind === 'empty-drums') {
      groups.push({
        isEmptyDrums: true,
        text: line.text || 'Empty Drums',
        drums: parseInt(line.drums, 10) || 0
      });
      curGroup = null;
    } else if (line.kind === 'value') {
      // Goods value is pinned near TOTAL — skip here.
      curGroup = null;
    } else {
       groups.push({
         isProduct: false,
         text: line.text,
         drums: parseInt(line.drums, 10) || 0,
         qty: parseFloat(line.qty) || 0
       });
       curGroup = null; // break group
    }
  });

  groups.forEach((g) => {
    if (g.isProduct) {
      const q = fmtQty(g.totalQty);
      const numBatches = g.batches.length;
      const batchLabel = (b) => (typeof b === 'string' ? b : (b?.text || ''));
      const batchDrums = (b) => {
        const n = typeof b === 'string' ? (g.totalDrums || 0) : (parseInt(b?.drums, 10) || 0);
        return n > 0 ? n : '';
      };
      const batchQtyCell = (b, isFirst) => {
        const raw = typeof b === 'string' ? '' : b?.qty;
        const n = parseFloat(raw);
        if (Number.isFinite(n) && n !== 0) return fmtQty(n);
        return isFirst ? q : '';
      };

      if (numBatches <= 1) {
        const batchText = numBatches === 1 ? batchLabel(g.batches[0]) : '';
        const d = numBatches === 1 ? batchDrums(g.batches[0]) : (g.totalDrums > 0 ? g.totalDrums : '');
        bodyRows.push(`
          <tr>
            <td class="num">${g.sr}</td>
            <td class="left"><strong>${escHtml(String(g.productName || '').trim())}</strong></td>
            <td class="num">${escHtml(batchText)}</td>
            <td class="num">${d}</td>
            <td class="num">${numBatches === 1 ? batchQtyCell(g.batches[0], true) : q}</td>
          </tr>`);
      } else {
        // No rowspan — each batch keeps its own bordered Sr. No. cell so grid lines fill the column.
        bodyRows.push(`
          <tr>
            <td class="num">${g.sr}</td>
            <td class="left"><strong>${escHtml(String(g.productName || '').trim())}</strong></td>
            <td class="num">${escHtml(batchLabel(g.batches[0]))}</td>
            <td class="num">${batchDrums(g.batches[0])}</td>
            <td class="num">${batchQtyCell(g.batches[0], true)}</td>
          </tr>`);
        for (let i = 1; i < numBatches; i++) {
          bodyRows.push(`
          <tr>
            <td class="num">&nbsp;</td>
            <td class="left">&nbsp;</td>
            <td class="num">${escHtml(batchLabel(g.batches[i]))}</td>
            <td class="num">${batchDrums(g.batches[i])}</td>
            <td class="num">${batchQtyCell(g.batches[i], false)}</td>
          </tr>`);
        }
      }
    } else if (g.isEmptyDrums) {
      bodyRows.push(`
        <tr>
          <td class="num"></td>
          <td class="left"></td>
          <td class="num">${escHtml(g.text)}</td>
          <td class="num">${g.drums > 0 ? g.drums : ''}</td>
          <td class="num"></td>
        </tr>`);
    } else {
      bodyRows.push(`
        <tr>
          <td class="num"></td>
          <td class="left">${escHtml(g.text)}</td>
          <td class="num"></td>
          <td class="num">${g.drums > 0 ? g.drums : ''}</td>
          <td class="num">${fmtQty(g.qty)}</td>
        </tr>`);
    }
  });

  const blankRow = `
      <tr class="empty filler-row">
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      </tr>`;
  const pinBlankRow = `
      <tr class="empty dc-pin-gap">
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      </tr>`;

  // Seed blank rows above the pinned bottom block (layout may add/remove fillers).
  for (let i = 0; i < 6; i++) bodyRows.push(blankRow);

  // Pinned rows above TOTAL (TOTAL = last):
  // 6th-last = DC notes, 3rd-last = total goods value.
  // Order: notes, blank, blank, goods value, blank → TOTAL
  bodyRows.push(`
      <tr class="dc-delivery-note dc-pin-start">
        <td></td>
        <td class="left" colspan="4">${deliveryNote ? `<strong>${escHtml(deliveryNote)}</strong>` : '&nbsp;'}</td>
      </tr>`);
  bodyRows.push(pinBlankRow);
  bodyRows.push(pinBlankRow);
  bodyRows.push(`
      <tr class="dc-goods-value">
        <td></td>
        <td class="left" colspan="4">${goodsValueText ? `<strong>${escHtml(goodsValueText)}</strong>` : '&nbsp;'}</td>
      </tr>`);
  bodyRows.push(pinBlankRow);

  const drumsTotal = parseInt(totalDrums, 10) > 0 ? String(parseInt(totalDrums, 10)) : '';
  const qtyTotal = fmtQty(totalQty);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UMA MICRON - Delivery Challan</title>
<style>
  :root{
    --purple:#3d2b7d;
    --purple-dark:#2f2263;
    --purple-border:#c9bce8;
    --lav-bg:#efeaf7;
    --lav-border:#c9bce8;
    --orange:#f47920;
    --green:#2fa84f;
    --text:#231f20;
    --grey-line:#d9d9d9;
  }
  *{box-sizing:border-box;font-family:Cambria,Georgia,serif;}
  html,body{margin:0;padding:0;background:#fff;width:794px;overflow:hidden;font-family:Cambria,Georgia,serif;color:var(--text);}
  
  /* Outer border lives on .content-wrapper so right edge is never clipped */
  .page {
    width: 794px;
    height: 1123px;
    padding: 4px;
    margin: 0;
    background: #fff;
    display: flex;
    flex-direction: column;
  }

  .content-wrapper {
    width: 100%;
    height: 100%;
    flex: 1;
    border-collapse: collapse;
    border: 2px solid var(--purple);
    box-sizing: border-box;
    table-layout: fixed;
  }
  .content-wrapper td { padding: 0; vertical-align: top; }
  /* Header + footer content-sized; items band fills leftover page height */
  .content-wrapper tr.dc-top,
  .content-wrapper tr.dc-bot {
    height: 1px;
  }
  .content-wrapper tr.items-row {
    height: 100%;
  }
  .content-wrapper td.pad-bot { vertical-align: bottom; }
  .content-wrapper td.pad-mid {
    vertical-align: top;
    padding-bottom: 8px;
    height: 100%;
  }

  /* ===== HEADER ===== */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 0 0 10px;
    padding: 0 0 10px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    width: 64px;
    height: 64px;
    position: relative;
    flex-shrink: 0;
  }
  .logo svg, .logo img { width: 100%; height: 100%; object-fit: contain; display: block; }

  .brand-lockup{width:280px;height:70px;flex-shrink:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}

  .brand-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 2px;
  }
  .brand-text h1 {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 34px;
    letter-spacing: 0.5px;
    word-spacing: normal;
    color: var(--purple);
    line-height: 1;
  }
  .brand-text .tagline {
    color: var(--green);
    font-weight: 700;
    font-size: 13px;
    margin: 0;
    line-height: 1.15;
    letter-spacing: normal;
    word-spacing: 0;
    white-space: nowrap;
  }
  .tax-invoice-box {
    background: var(--purple);
    color: #fff;
    text-align: center;
    padding: 8px 18px;
    display: flex;
    flex-direction: column;
    gap: 0;
    justify-content: center;
    align-items: center;
    align-self: center;
    min-width: 200px;
    min-height: 64px;
    border-radius: 6px;
    box-sizing: border-box;
  }
  .tax-invoice-box .ti-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin: 0;
    line-height: 1.1;
    white-space: nowrap;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .company-strip {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    align-items: stretch;
    column-gap: 14px;
    row-gap: 0;
    border-bottom: 2px solid var(--purple);
    padding-bottom: 8px;
    margin-bottom: 14px;
    font-size: 12px;
  }
  .company-strip .dc-strip-left,
  .company-strip .dc-strip-right {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
  }
  .company-strip .line {
    display: flex;
    align-items: flex-start;
    gap: 5px;
  }
  .company-strip .line.nowrap {
    white-space: nowrap;
    align-items: center;
  }
  .company-strip .dc-contact-row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }
  .company-strip .dc-contact-row .line {
    flex: 0 1 auto;
    min-width: 0;
  }
  .company-strip .dc-addr-block {
    align-items: flex-start;
  }
  .company-strip .dc-addr-text {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start;
    gap: 1px;
    line-height: 1.35;
    white-space: normal !important;
    min-width: 0;
    flex: 1 1 auto;
  }
  .company-strip .dc-addr-text .dc-addr-l1,
  .company-strip .dc-addr-text .dc-addr-l2 {
    display: block !important;
    white-space: normal !important;
    width: 100%;
    max-width: 100%;
  }
  .company-strip .icon {
    color: var(--purple);
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    margin-top: 1px;
  }
  .company-strip .line.nowrap .icon { margin-top: 0; }
  .company-strip .icon svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

  /* ===== BILL TO / SHIP TO & META DETAILS ===== */
  .parties {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    width: 100%;
    max-width: 100%;
  }
  .party {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--lav-border);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  .party-head {
    background: var(--lav-bg);
    color: var(--purple);
    font-weight: 800;
    font-size:12px;
    letter-spacing: .5px;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--lav-border);
  }
  .party-head svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .party-body {
    padding: 8px 12px;
    font-size:12px;
    line-height: 1.4;
    flex: 1;
    white-space: normal;
    min-height: 0;
  }
  .party-body .cname {
    color: var(--purple);
    font-weight: 800;
    font-size:12px;
    margin: 0 0 2px;
  }
  .party-body .addr {
    margin: 0;
    line-height: 1.4;
    white-space: normal;
  }
  .party-foot {
    border-top: 1px solid var(--lav-border);
    padding: 8px 12px;
    font-size:12px;
  }
  .party-foot .frow { display: flex; margin-bottom: 2px; }
  .party-foot .flabel { width: 50px; font-weight: 700; color: var(--text); }
  .party-foot .fcolon { width: 12px; }

  /* Invoice Meta inside right party box */
  .invoice-meta {
    padding: 10px 12px;
    font-size:12px;
    flex: 1;
  }
  .meta-row {
    display: grid;
    grid-template-columns: 16px 110px 12px minmax(0, 1fr);
    column-gap: 4px;
    margin-bottom: 6px;
    align-items: center;
    white-space: nowrap;
  }
  .meta-row .m-icon { color: var(--purple); width: 16px; display: flex; align-items: center; justify-content: center; }
  .meta-row .m-icon svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .meta-row .m-label { color: #333; font-weight: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta-row .m-colon { font-weight: 600; white-space: nowrap; }
  .meta-row .m-value { min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ===== Items table fills middle; blank rows share leftover height evenly ===== */
  .pad-x { padding-left: 12px; padding-right: 12px; }
  .pad-top { padding-top: 4px; }
  .pad-mid { padding-top: 0; padding-bottom: 8px; vertical-align: top; }
  .pad-bot { padding-bottom: 0; vertical-align: bottom; }

  table.items {
    width: 100%;
    max-width: 100%;
    height: auto;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0;
    font-size:12px;
  }
  table.items thead {
    height: 1px;
  }
  table.items thead th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 8px 6px;
    text-align: center;
    border:1px solid rgba(255,255,255,0.55);
  }
  table.items tbody td {
    border: 1px solid var(--lav-border);
    padding: 4px 6px;
    vertical-align: top;
    font-size:12px;
    font-weight: 500;
    word-break: break-word;
    overflow-wrap: anywhere;
    background: #fff;
    color: #231f20;
  }
  /* Data / note / value rows stay compact — blank rows share leftover evenly at equal height */
  table.items tbody tr:not(.empty):not(.dc-delivery-note):not(.dc-goods-value):not(.filler-row):not(.dc-pin-gap) {
    height: 24px;
  }
  table.items tbody tr:not(.empty):not(.filler-row):not(.dc-pin-gap) td {
    height: 24px;
    min-height: 24px;
    max-height: 28px;
    white-space: nowrap;
    vertical-align: top;
  }
  table.items tbody tr:not(.empty):not(.filler-row):not(.dc-pin-gap) td.left {
    white-space: pre-wrap;
    vertical-align: top;
    text-align: left;
  }
  table.items tbody td.num { text-align: center; }
  table.items tbody td.left { text-align: left; }
  table.items tbody tr.dc-delivery-note td,
  table.items tbody tr.dc-goods-value td {
    height: auto;
    max-height: none;
    padding: 6px 8px;
    font-size: 12px;
    line-height: 1.35;
    vertical-align: top;
    white-space: pre-wrap;
  }
  table.items tbody tr.dc-delivery-note td.left,
  table.items tbody tr.dc-goods-value td.left {
    text-align: left;
    font-weight: 700;
  }
  table.items tbody tr.dc-delivery-note strong,
  table.items tbody tr.dc-goods-value strong {
    font-weight: 700;
  }
  /* Blank handwriting rows — full grid lines in every column (incl. Sr. No.) */
  table.items tbody tr.empty,
  table.items tbody tr.filler-row,
  table.items tbody tr.dc-pin-gap {
    height: 22px;
  }
  table.items tbody tr.empty td,
  table.items tbody tr.filler-row td,
  table.items tbody tr.dc-pin-gap td {
    height: 22px;
    min-height: 22px;
    max-height: 22px;
    padding: 0;
    border: 1px solid var(--lav-border) !important;
    background: #fff;
    line-height: 22px;
    font-size: 10px;
    color: transparent;
    -webkit-text-fill-color: transparent;
    vertical-align: middle;
  }
  table.items tfoot {
    height: 1px;
  }
  table.items tfoot td {
    border: 1px solid var(--purple);
    background: var(--lav-bg);
    font-weight: 800;
    padding: 7px 6px;
    height: 28px;
    color: var(--purple-dark);
    text-align: center;
  }

  .dc-footer-grid {
      display: flex;
      gap: 14px;
      margin-top: 0;
      width: 100%;
      max-width: 100%;
  }
  .dc-footer-grid > div:nth-child(1) { flex: 1.15; min-width: 0; }
  .dc-footer-grid > div:nth-child(2) { flex: 0.85; min-width: 0; }
  .dc-meta-card {
      border: 1px solid var(--lav-border);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
  }
  .box-head {
      background: var(--lav-bg);
      color: var(--purple);
      font-weight: 800;
      font-size:12px;
      letter-spacing: .5px;
      padding: 7px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--lav-border);
  }
  .box-head svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .dc-meta-card > div:not(.box-head) { padding: 4px 12px; font-size:12px; }
  .dc-meta-row { display: flex; margin-bottom: 2px; }
  .dc-meta-label { color: var(--text-black); font-weight: bold; width: 130px; flex-shrink: 0; }
  .dc-sign-stack { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; }
  .dc-sign-card {
      flex: 1;
      border: 1px solid var(--lav-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      box-sizing: border-box;
      width: 100%;
      padding-bottom: 6px;
  }
  .dc-sign-space { width: 80%; border-bottom: 1px solid #333; margin-top: 28px; margin-bottom: 5px; }
  .dc-sign-title { background: var(--lav-bg); color: var(--purple); font-weight: 800; font-size:12px; padding: 7px 12px; width: 100%; border-bottom: 1px solid var(--lav-border); display: flex; align-items: center; justify-content: center; gap: 8px; box-sizing: border-box; }

  .barfoot {
    background: var(--purple);
    color: #fff;
    margin: 12px 0 6px 0;
    padding: 8px 14px;
    display: flex;
    justify-content: space-between;
    font-size:12px;
    box-sizing: border-box;
    border-radius: 6px;
  }
  .dc-meta-card .dc-meta-row:first-of-type { margin-top: 8px; }
  .dc-meta-card .dc-meta-row:last-child { margin-bottom: 8px; }
</style>
</head>
<body>

  <div class="page pdf-page print-host">
    <table class="content-wrapper">
  <tr class="dc-top">
    <td class="pad-x pad-top" valign="top">
      <div class="header">
        <div class="brand">
      ${buildPrintBrandHtml(profile, {
        companyName: profile.companyName || 'UMA MICRON',
        tagline: profile.tagline || "Micronization of API's"
      })}
    </div>
        <div class="tax-invoice-box">
          <div class="ti-title">DELIVERY CHALLAN</div>
          <svg style="width:36px; height:36px; fill:#fff;" viewBox="0 0 24 24">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </div>
      </div>

      <div class="company-strip">
        <div class="dc-strip-left">
          <div class="line dc-addr-block">
            <span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span>
            <div class="dc-addr-text">
              <div class="dc-addr-l1">${addrLine1}</div>
              <div class="dc-addr-l2">${addrLine2}</div>
            </div>
          </div>
          <div class="line nowrap">
            <span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span>
            <span>${escHtml(profile.website || 'www.umamicron.com')}</span>
          </div>
        </div>
        <div class="dc-strip-right">
          <div class="line nowrap">
            <span class="icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
            <span><strong>GSTIN:</strong> ${escHtml(profile.gstNumber || '')}</span>
          </div>
          <div class="dc-contact-row">
            <div class="line nowrap">
              <span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span>
              <span>${escHtml(profile.phone || '+91 97120 00297')}</span>
            </div>
            <div class="line nowrap">
              <span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span>
              <span>${escHtml(profile.email || 'umamicron@gmail.com')}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <div class="party-head"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> SHIP TO</div>
          <div class="party-body"><div class="cname">${partyName}</div>${addressLines.map((line) => `<div class="addr">${escHtml(line)}</div>`).join('')}</div>
          <div class="party-foot">
            <div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>${partyGstin}</span></div>
            <div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>${shipState} (${stateCode})</span></div>
          </div>
        </div>

        <div class="party">
          <div class="party-head"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> DELIVERY CHALLAN DETAILS</div>
          <div class="invoice-meta">
            <div class="meta-row">
              <span class="m-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
              <span class="m-label">Challan No.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${dcNo}</span>
            </div>
            <div class="meta-row">
              <span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
              <span class="m-label">Challan Date</span><span class="m-colon">:</span><span class="m-value">&nbsp;${dcDate}</span>
            </div>
            ${hasPrintVal(poNo) ? `<div class="meta-row" style="margin-top:8px;">
              <span class="m-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
              <span class="m-label">PO No.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${poNo}</span>
            </div>` : ''}
            ${hasPrintVal(poDate) ? `<div class="meta-row">
              <span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
              <span class="m-label">PO Date</span><span class="m-colon">:</span><span class="m-value">&nbsp;${poDate}</span>
            </div>` : ''}
          </div>
        </div>
      </div>
    </td>
  </tr>
  <tr class="items-row">
    <td class="pad-x pad-mid">
        <table class="items">
          <thead>
            <tr>
              <th class="num" style="width:8%">Sr. No.</th>
              <th class="num" style="width:34%">DESCRIPTION WITH<br>BATCH DETAILS</th>
              <th class="num" style="width:28%">BATCH NO.</th>
              <th class="num" style="width:15%">UNIT<br>(No. of Drums)</th>
              <th class="num" style="width:15%">QTY.</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows.join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="num">TOTAL</td>
              <td class="num">${drumsTotal}</td>
              <td class="num">${qtyTotal}</td>
            </tr>
          </tfoot>
        </table>
    </td>
  </tr>
  <tr class="dc-bot">
    <td class="pad-x pad-bot">
      <div class="dc-footer-grid">
        <div class="dc-meta-card">
          <div class="box-head"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> TRANSPORT DETAILS</div>
          <div class="dc-meta-row"><div class="dc-meta-label">Vehicle No.</div><div class="data-value">: &nbsp;${escHtml(data.vehicleNo || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Drivers name</div><div class="data-value">: &nbsp;${escHtml(data.driverName || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Driver's Contact</div><div class="data-value">: &nbsp;${escHtml(data.driverContact || data.driverPhone || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Transporter's Name</div><div class="data-value">: &nbsp;${escHtml(data.transporterName || data.transporter || '')}</div></div>
        </div>
        <div class="dc-sign-stack">
          <div class="dc-sign-card">
            <div class="dc-sign-title">For ${escHtml(profile.companyName || 'UMA MICRON')}</div>
            <div class="dc-sign-space"></div>
            <span style="font-size:12px; color: #333;">Authorised Signatory</span>
          </div>
          <div class="dc-sign-card">
            <div class="dc-sign-title">RECEIVED BY</div>
            <div class="dc-sign-space"></div>
            <span style="font-size:12px; color: #333;">Authorised Signatory</span>
          </div>
        </div>
      </div>

      ${buildStatusBar('Page 1 of 1', PRINT_FOOTER_MESSAGES.DC)}
    </td>
  </tr>
</table>
</div>
</body>
</html>`;
};

export const renderDeliveryChallanPdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const appData = data.appData || getDcAppData();
  const html = buildDeliveryChallanHtml(data, data.companyProfile, appData);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'DC',
    docNo: data.dcNo || 'N/A',
    width: 794,
    fitPage: true,
    splitOverflowPages: true,
    printPrefs
  });
};
