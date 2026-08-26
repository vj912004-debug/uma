/** Shared purple print theme for TI / PI / DC / DN / CN / BPR HTML PDFs. */

import { applyPrintPrefsToHtml, getStoredPrintPrefs, PRINT_ROOT_CLASS, getPrintDensity, getPrintMinFitScale, normalizePrintPrefs } from './printPrefs';
import { DEFAULT_PRINT_LOGO_SRC } from './defaultPrintLogo';

export { applyPrintPrefsToHtml } from './printPrefs';
export { DEFAULT_PRINT_LOGO_SRC } from './defaultPrintLogo';

export const PRINT_PAGE_W = 794;

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

const BLANK_PRINT_RE = /^(n\/?a|-|—|–|none|null|undefined)$/i;
const GST_STATE_NAMES = {
  '24': 'GUJARAT',
  '27': 'MAHARASHTRA',
  '07': 'DELHI',
  '33': 'TAMIL NADU',
  '29': 'KARNATAKA',
  '36': 'TELANGANA',
  '37': 'ANDHRA PRADESH',
  '08': 'RAJASTHAN',
  '09': 'UTTAR PRADESH',
  '23': 'MADHYA PRADESH',
  '06': 'HARYANA',
  '03': 'PUNJAB'
};

const firstPrintText = (...vals) => {
  for (const v of vals) {
    if (v == null || v === false) continue;
    const s = Array.isArray(v)
      ? v.filter((x) => x != null && String(x).trim()).join('\n').trim()
      : String(v).trim();
    if (!s || BLANK_PRINT_RE.test(s)) continue;
    return s;
  }
  return '';
};

const normGstin = (s) => String(s || '').replace(/[\s-]/g, '').toUpperCase();
const normPartyName = (s) => String(s || '')
  .toLowerCase()
  .replace(/[.,'"()]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const docHasAddress = (d) => Boolean(firstPrintText(
  d?.billAddress,
  d?.address,
  d?.shipAddress,
  d?.billingAddress,
  d?.partyAddress
));

export const loadUmaAppData = () => {
  try {
    const raw = localStorage.getItem('uma_erp_data');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/** Fill blank print addresses/GSTIN from Material Receipt or Parties master. */
export const fillPrintPartyFields = (data, appData = {}) => {
  if (!data) return data;
  const parties = appData.parties || [];
  const mrs = appData.materialReceipts || [];
  const extraDocs = [
    ...mrs,
    ...(appData.invoices || []),
    ...(appData.purchaseOrders || []),
    ...(appData.deliveryChallans || []),
    ...(appData.debitNotes || []),
    ...(appData.creditNotes || [])
  ];
  const partyName = data.partyName || data.customerName || data.shipName || '';
  const gstinHint = normGstin(data.gstinBill || data.gstin || data.gstinShip || '');

  const matchParty = (p) => {
    if (!p) return false;
    if (data.partyId && p.id === data.partyId) return true;
    if (partyName && normPartyName(p.name) === normPartyName(partyName)) return true;
    if (gstinHint && (
      normGstin(p.gstinBill) === gstinHint
      || normGstin(p.gstinShip) === gstinHint
      || normGstin(p.gstin) === gstinHint
    )) return true;
    return false;
  };

  let party = parties.find((p) => data.partyId && p.id === data.partyId)
    || parties.find((p) => partyName && normPartyName(p.name) === normPartyName(partyName))
    || parties.find((p) => gstinHint && (
      normGstin(p.gstinBill) === gstinHint
      || normGstin(p.gstinShip) === gstinHint
      || normGstin(p.gstin) === gstinHint
    ))
    || null;

  let mr = mrs.find((r) => data.receiptId && r.id === data.receiptId)
    || extraDocs.find((r) => data.receiptId && r.receiptId === data.receiptId && docHasAddress(r))
    || mrs.find((r) => partyName && normPartyName(r.partyName) === normPartyName(partyName) && docHasAddress(r))
    || extraDocs.find((r) => gstinHint && normGstin(r.gstinBill || r.gstin || r.gstinShip) === gstinHint && docHasAddress(r))
    || extraDocs.find((r) => partyName && normPartyName(r.partyName) === normPartyName(partyName) && docHasAddress(r))
    || mrs.find((r) => partyName && normPartyName(r.partyName) === normPartyName(partyName))
    || null;

  if (!party && mr) {
    party = parties.find((p) => p.id === mr.partyId)
      || parties.find((p) => matchParty(p) || normPartyName(p.name) === normPartyName(mr.partyName))
      || null;
  }

  const billAddress = firstPrintText(
    data.billAddress,
    data.address,
    data.billingAddress,
    data.partyAddress,
    mr?.billAddress,
    mr?.address,
    mr?.shipAddress,
    party?.billAddress,
    party?.address
  );
  const shipAddress = firstPrintText(
    data.shipAddress,
    data.shippingAddress,
    mr?.shipAddress,
    party?.shipAddress,
    billAddress
  );
  const gstinBill = firstPrintText(data.gstinBill, data.gstin, mr?.gstinBill, party?.gstinBill, party?.gstin);
  const gstinShip = firstPrintText(data.gstinShip, mr?.gstinShip, party?.gstinShip, gstinBill);
  const gstState = GST_STATE_NAMES[gstinBill.slice(0, 2)] || '';

  return {
    ...data,
    billAddress,
    shipAddress,
    address: firstPrintText(data.address, billAddress),
    partyAddress: firstPrintText(data.partyAddress, billAddress),
    gstinBill,
    gstinShip,
    gstin: firstPrintText(data.gstin, gstinBill),
    billState: firstPrintText(data.billState, data.state, mr?.billState, party?.billState, party?.state, gstState),
    shipState: firstPrintText(data.shipState, mr?.shipState, party?.shipState, data.billState, data.state, gstState)
  };
};

/** Empty grid rows that stretch to fill leftover table height. */
export const buildFillerRowsHtml = (colCount, rowCount = 12) => {
  const cells = Array.from({ length: colCount }, () => '<td>&nbsp;</td>').join('');
  return Array.from({ length: rowCount }, () => `<tr class="filler-row">${cells}</tr>`).join('');
};

/** Pages that pin Terms/Declaration/Signatory inside A4 without html2canvas flex clipping. */
export const FIT_FOOTER_PAGE_SEL = '.ti-page, .pi-page, .cn-page, .dn-page, .po-page';

export const FIT_FOOTER_CSS = `
  .ti-page .content-wrapper,
  .pi-page .content-wrapper,
  .cn-page .content-wrapper,
  .dn-page .content-wrapper,
  .po-page .content-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    border: 2px solid var(--purple);
    box-sizing: border-box;
  }
  .ti-page .inv-top,
  .pi-page .inv-top,
  .cn-page .inv-top,
  .dn-page .inv-top,
  .po-page .inv-top {
    flex: 0 0 auto;
    padding: 4px 10px 0;
  }
  .ti-page .items-row,
  .pi-page .items-row,
  .cn-page .items-row,
  .dn-page .items-row,
  .po-page .items-row {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    padding: 0 10px 4px;
  }
  .ti-page .inv-bot,
  .pi-page .inv-bot,
  .cn-page .inv-bot,
  .dn-page .inv-bot,
  .po-page .inv-bot {
    flex: 0 0 auto;
    padding: 8px 10px 0;
  }
  .ti-page .table-container,
  .pi-page .table-container,
  .cn-page .table-container,
  .dn-page .table-container,
  .po-page .table-container,
  .ti-page table.items,
  .pi-page table.items,
  .cn-page table.items,
  .dn-page table.items,
  .po-page table.items { height: auto; max-height: 100%; }
  table.footer3 {
    width: 100%;
    border-collapse: separate;
    border-spacing: 10px 0;
    margin: 6px 0 0;
    table-layout: fixed;
  }
  table.footer3 td.f3col {
    width: 33.33%;
    height: 128px;
    border: 1px solid var(--lav-border);
    vertical-align: top;
    padding: 0;
  }
  table.footer3 .f3-body {
    display: block;
    height: auto;
    min-height: 0;
    padding: 8px 10px;
  }
  table.footer3 .sig-body {
    display: block;
    height: auto;
    min-height: 0;
    padding-top: 8px;
  }
  table.footer3 .sig-space {
    display: block;
    height: 56px;
    min-height: 56px;
    max-height: 56px;
  }
`;

export const layoutFitFooterPages = (doc, pageHeight) => {
  if (!doc) return;
  doc.querySelectorAll(FIT_FOOTER_PAGE_SEL).forEach((page) => {
    const wrap = page.querySelector('.content-wrapper') || page;
    const topRow = page.querySelector('.inv-top');
    const itemsRow = page.querySelector('.items-row');
    const botRow = page.querySelector('.inv-bot');
    if (!itemsRow || !botRow) return;

    page.style.setProperty('overflow', 'visible', 'important');
    wrap.style.setProperty('display', 'flex', 'important');
    wrap.style.setProperty('flex-direction', 'column', 'important');
    wrap.style.setProperty('height', 'auto', 'important');
    wrap.style.setProperty('max-height', 'none', 'important');

    itemsRow.style.setProperty('height', 'auto', 'important');
    itemsRow.style.setProperty('max-height', 'none', 'important');
    itemsRow.style.setProperty('flex', '0 0 auto', 'important');
    itemsRow.style.setProperty('overflow', 'visible', 'important');
    botRow.style.setProperty('height', 'auto', 'important');
    botRow.style.setProperty('max-height', 'none', 'important');
    botRow.style.setProperty('flex', '0 0 auto', 'important');
    botRow.style.setProperty('overflow', 'visible', 'important');
    page.querySelectorAll('.table-container, table.items').forEach((el) => {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
    });
    page.querySelectorAll('tr.filler-row').forEach((tr) => {
      tr.style.height = '16px';
      [...tr.children].forEach((td) => {
        td.style.height = '16px';
        td.style.minHeight = '16px';
        td.style.maxHeight = '16px';
      });
    });
    page.querySelectorAll('table.items tbody tr:not(.filler-row) td').forEach((td) => {
      td.style.height = 'auto';
      td.style.minHeight = '22px';
      td.style.maxHeight = 'none';
      td.style.overflow = 'visible';
    });
    page.querySelectorAll('table.items tbody td.left').forEach((td) => {
      td.style.whiteSpace = 'normal';
      td.style.overflowWrap = 'break-word';
      td.style.wordBreak = 'break-word';
    });

    void page.offsetHeight;

    const topH = topRow ? Math.ceil(topRow.offsetHeight) : 0;
    let botH = Math.ceil(Math.max(botRow.offsetHeight, botRow.scrollHeight, 0));
    if (botH < 80) botH = 320;
    const itemsH = Math.max(80, pageHeight - topH - botH - 4);

    wrap.style.setProperty('height', `${pageHeight}px`, 'important');
    wrap.style.setProperty('max-height', `${pageHeight}px`, 'important');
    itemsRow.style.setProperty('height', `${itemsH}px`, 'important');
    itemsRow.style.setProperty('max-height', `${itemsH}px`, 'important');
    itemsRow.style.setProperty('flex', `0 0 ${itemsH}px`, 'important');
    itemsRow.style.setProperty('overflow', 'hidden', 'important');
    botRow.style.setProperty('flex', '0 0 auto', 'important');
    page.querySelectorAll('.table-container').forEach((el) => {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', '100%', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    });
    page.querySelectorAll('table.items').forEach((el) => {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', '100%', 'important');
    });

    page.style.setProperty('height', `${pageHeight}px`, 'important');
    page.style.setProperty('max-height', `${pageHeight}px`, 'important');
    page.style.setProperty('overflow', 'hidden', 'important');

    void page.offsetHeight;
    const pageBottom = page.getBoundingClientRect().bottom;
    const footEl = page.querySelector('.barfoot') || botRow;
    const extra = Math.ceil(footEl.getBoundingClientRect().bottom - pageBottom);
    if (extra > 0) {
      const nextH = Math.max(60, itemsH - extra - 10);
      itemsRow.style.setProperty('height', `${nextH}px`, 'important');
      itemsRow.style.setProperty('max-height', `${nextH}px`, 'important');
      itemsRow.style.setProperty('flex', `0 0 ${nextH}px`, 'important');
    }
  });
};


export const ITEMS_TABLE_FILL_CSS = `
  .content-wrapper tr.inv-top,
  .content-wrapper tr.inv-bot { height: 1px; }
  .content-wrapper tr.inv-bot > td { height: 1px; vertical-align: bottom; }
  .pi-page .content-wrapper tr.inv-bot,
  .ti-page .content-wrapper tr.inv-bot,
  .cn-page .content-wrapper tr.inv-bot,
  .dn-page .content-wrapper tr.inv-bot,
  .po-page .content-wrapper tr.inv-bot { height: auto; }
  .pi-page .content-wrapper tr.inv-bot > td,
  .ti-page .content-wrapper tr.inv-bot > td,
  .cn-page .content-wrapper tr.inv-bot > td,
  .dn-page .content-wrapper tr.inv-bot > td,
  .po-page .content-wrapper tr.inv-bot > td {
    height: auto;
    min-height: 280px;
    vertical-align: bottom;
  }
  .content-wrapper tr.items-row { height: 100%; }
  .content-wrapper tr.items-row > td {
    height: 100%;
    vertical-align: top;
    padding: 0 10px 6px;
  }
  .table-container { height: 100%; }
  table.items { height: 100%; }
  table.items thead,
  table.items tfoot { height: 1px; }
  table.items tbody tr.filler-row { height: 1%; }
  table.items tbody tr.filler-row td {
    height: auto !important;
    min-height: 18px;
    padding: 2px 3px !important;
    border: 1px solid var(--lav-border) !important;
    line-height: 1;
    background: #fff;
    vertical-align: middle;
  }
`;


export const getSharedPrintStyles = () => `
  :root {
    --purple: #3d2b7d;
    --purple-dark: #2f2263;
    --lav-bg: #efeaf7;
    --lav-border: #c9bce8;
    --orange: #f47920;
    --green: #2fa84f;
    --text: #231f20;
    --grey-line: #d9d9d9;
    --primary-purple: #3d2b7d;
    --brand-green: #2fa84f;
    --light-purple-bg: #efeaf7;
    --border-purple: #c9bce8;
    --grid-line-purple: #d9d9d9;
    --text-black: #231f20;
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: Cambria, Georgia, serif;
  }
  
  body {
    background-color: #fff;
    color: var(--text);
    font-size: 11px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .print-host {
    width: ${PRINT_PAGE_W}px;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  
  .pdf-page {
    width: ${PRINT_PAGE_W}px;
    min-height: 1123px;
    padding: 2mm;
    box-sizing: border-box;
    background: #ffffff;
  }
  
  .invoice-box {
    border: 2px solid var(--purple);
    padding: 18px;
    height: 100%;
    min-height: 1050px;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* ===== HEADER ===== */
  .header, .header-top {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 14px;
    margin-bottom: 14px;
    border-bottom: none;
    padding-bottom: 0;
  }
  .brand, .logo-container {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo, .logo-graphic {
    width: 78px;
    height: 78px;
    position: relative;
    flex-shrink: 0;
  }
  .logo svg, .logo img, .logo-graphic svg, .logo-graphic img { width: 100%; height: 100%; object-fit: contain; }
  .brand-lockup {
    width: 280px;
    height: 72px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .brand-lockup img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: left center;
    display: block;
  }
  .brand-text h1, .logo-text h1 {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 38px;
    letter-spacing: 1px;
    color: var(--purple);
    line-height: 1;
    text-transform: uppercase;
  }
  .brand-text .tagline, .logo-text p {
    color: var(--green);
    font-weight: 700;
    font-size: 16px;
    margin-top: 2px;
  }
  .tax-invoice-box, .tax-invoice-badge {
    background: var(--purple);
    color: #fff;
    text-align: center;
    padding: 10px 22px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 230px;
    border-radius: 0;
  }
  .tax-invoice-box .ti-title, .tax-invoice-badge h2 {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 1px;
    margin-bottom: 6px;
    margin-top: 0;
  }
  .tax-invoice-box .ti-sub, .tax-invoice-badge div {
    background: #fff;
    color: var(--purple);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .5px;
    padding: 3px 10px;
    border-radius: 0;
    margin-top: 0;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .info-row, .meta-strip {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    padding: 0;
    border-bottom: none;
  }
  .company-info {
    flex: 1.15;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .company-info .line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 4px;
  }
  .icon {
    color: var(--purple);
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    text-align: center;
    margin-top: 1px;
  }
  .icon svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .m-icon svg { width: 15px; height: 15px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .party-head svg, .box-head svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .reg-details {
    margin-top: 10px;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .reg-details b { color: var(--purple); }
  .reg-row { display: flex; }
  .reg-row .label { width: 62px; font-weight: 700; color: var(--purple); }
  .reg-row .colon { width: 14px; }

  .invoice-meta, .meta-col.border-left {
    flex: 1;
    border: 1px solid var(--purple);
    border-left: 1px solid var(--purple);
    padding: 0;
  }
  .invoice-meta .block, .meta-col.border-left > div {
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .invoice-meta .block + .block, .meta-col.border-left > div + div {
    border-top: 1px solid var(--purple);
  }
  .meta-row, .data-row {
    display: flex;
    margin-bottom: 3px;
    font-size: 11px;
  }
  .meta-row .m-icon { color: var(--purple); width: 18px; flex-shrink: 0; display: flex; align-items: center; }
  .meta-row .m-label, .data-label { width: 110px; flex-shrink: 0; color: #333; font-weight: normal; }
  .meta-row .m-colon, .data-value { flex-shrink: 0; font-weight: 600; }
  .meta-row.sub .m-label { width: 110px; padding-left: 18px; box-sizing: border-box; }
  .data-label i { margin-right: 6px; color: var(--purple); }

  /* ===== BILL TO / SHIP TO ===== */
  .parties, .billing-container {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    margin-top: 0;
  }
  .party, .bill-card {
    flex: 1;
    border: 1px solid var(--lav-border);
    border-radius: 0;
  }
  .party-head, .card-title {
    background: var(--lav-bg);
    color: var(--purple);
    font-weight: 800;
    font-size: 13px;
    letter-spacing: .5px;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--lav-border);
  }
  .party-head svg, .box-head svg, .card-title i { flex-shrink: 0; }
  .party-body, .card-body {
    padding: 8px 12px;
    font-size: 12.5px;
    line-height: 1.4;
    min-height: 0;
    white-space: normal;
  }
  .party-body .cname, .client-title {
    color: var(--purple);
    font-weight: 800;
    font-size: 14px;
    margin: 0 0 2px;
  }
  .party-body .addr {
    margin: 0;
    line-height: 1.4;
    white-space: normal;
  }
  .party-foot, .card-footer-data {
    border-top: 1px solid var(--lav-border);
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .party-foot .frow, .card-footer-data .data-row { display: flex; margin-bottom: 2px; font-size: 12.5px; }
  .party-foot .flabel, .card-footer-data .data-label-short { width: 50px; font-weight: 700; color: var(--text); }
  .party-foot .fcolon { width: 12px; }

  /* ===== TABLE ===== */
  .table-container { flex: 1; display: flex; flex-direction: column; margin-top: 0; }
  table.items, table.invoice-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size: 12px;
  }
  table.items thead th, table.invoice-table th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 8px 6px;
    text-align: left;
    border: 1px solid rgba(255,255,255,0.55);
  }
  table.items thead th.num, table.invoice-table th.center { text-align: center; }
  table.items tbody td, table.invoice-table td {
    border: 1px solid var(--lav-border);
    padding: 6px 6px;
    height: 20px;
    text-align: right;
  }
  table.items tbody td.num, table.invoice-table td.center { text-align: center; }
  table.items tbody td.left, table.invoice-table td.left { text-align: left; }
  table.items tbody tr.empty td, table.invoice-table tr.filler-row td { height: 22px; }
  table.items tfoot td, table.invoice-table tr.total-row td {
    border: 1px solid var(--purple);
    background: var(--lav-bg);
    font-weight: 800;
    padding: 8px 6px;
    color: var(--purple-dark);
  }
  table.items tfoot td.num, table.invoice-table tr.total-row td.center { text-align: center; }

  /* ===== BOTTOM SECTION: bank + totals ===== */
  .bottom, .bottom-summary-grid {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    align-items: stretch;
    margin-top: 0;
  }
  .bottom > div:nth-child(1), .bottom-summary-grid > div:nth-child(1) { flex: 1.15; }
  .bottom > div:nth-child(2), .bottom-summary-grid > div:nth-child(2) { flex: 0.85; }

  .bank, .bank-details-box {
    flex: 1;
    border: 1px solid var(--lav-border);
    padding: 0;
    border-radius: 0;
  }
  .box-head, .box-heading {
    background: var(--lav-bg);
    color: var(--purple);
    font-weight: 800;
    font-size: 13px;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--lav-border);
    margin-bottom: 0;
  }
  .bank-body {
    padding: 10px 12px;
    font-size: 12.5px;
  }
  .bank-row, .bank-details-box .data-row { display: flex; margin-bottom: 5px; font-size: 12.5px; }
  .bank-row .blabel, .bank-details-box .data-label { width: 120px; font-weight: 700; color: var(--text); }
  .bank-row .bcolon, .bank-details-box .data-value { width: 12px; }

  .totals, .totals-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: 0;
    border: none;
  }
  .totals-body, .totals-box > div:first-child {
    border: 1px solid var(--lav-border);
    border-bottom: none;
    padding: 10px 14px;
    font-size: 12.5px;
    flex: 1;
  }
  .trow, .charge-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
  .tval, .charge-row span:last-child { font-variant-numeric: tabular-nums; min-width: 90px; text-align: right; }
  .trow.rule, .charge-row.bold { border-top: 1px solid var(--grey-line); margin-top: 4px; padding-top: 5px; font-weight: bold; }
  
  .grand, .grand-total-banner {
    background: var(--purple);
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    font-size: 17px;
    font-weight: 800;
  }

  /* ===== TERMS / DECLARATION / SIGNATORY ===== */
  table.footer3, .footer-terms-container {
    width: 100%;
    border-collapse: separate;
    border-spacing: 10px 0;
    margin: 8px 0 0;
    table-layout: fixed;
    border: none;
    padding: 0;
  }
  table.footer3 td.f3col, .terms-column {
    width: 33.33%;
    height: 128px;
    min-width: 0;
    border: 1px solid var(--lav-border);
    padding: 0;
    vertical-align: top;
    overflow: visible;
  }
  .f3-body {
    padding: 6px 10px;
    font-size: 11px;
    line-height: 1.4;
    white-space: normal;
    overflow: visible;
    overflow-wrap: break-word;
    word-break: normal;
    display: block;
  }
  .f3-body ol, .terms-column ol {
    margin: 0;
    padding-left: 18px;
    font-size: inherit;
    line-height: 1.4;
    list-style-position: outside;
  }
  .f3-body li {
    white-space: normal;
    margin: 0 0 4px;
    padding-left: 4px;
  }
  .f3-body .term-line {
    margin: 0 0 4px;
    white-space: normal;
    overflow-wrap: break-word;
  }
  .sig-col .for-company {
    font-weight: 800;
    color: var(--purple);
    padding: 8px 12px 0;
    font-size: 12.5px;
    text-align: center;
  }
  .sig-col .sig-body {
    display: block;
    padding-top: 4px;
  }
  .sig-col .sig-space {
    display: block;
    height: 56px;
    min-height: 56px;
    max-height: 56px;
  }
  .sig-col .sig-line, .signature-space {
    margin: 0;
    border-top: 1px solid #333;
    text-align: center;
    padding-top: 4px;
    font-size: 11px;
    width: auto;
    color: #231f20;
    visibility: visible;
    flex-shrink: 0;
  }
  
  /* Additional overrides for DC custom grid bottom */
  .dc-footer-grid {
      display: flex;
      gap: 14px;
      margin-top: 0;
  }
  .dc-footer-grid > div:nth-child(1) { flex: 1.15; }
  .dc-footer-grid > div:nth-child(2) { flex: 0.85; }
  .dc-meta-card {
      border: 1px solid var(--lav-border);
      border-radius: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
  }
  .dc-meta-card > div:not(.box-heading) { padding: 2px 12px; }
  .dc-meta-row { display: flex; margin-bottom: 6px; font-size: 11px; }
  .dc-meta-label { color: var(--text-black); font-weight: bold; width: 130px; flex-shrink: 0; }
  .dc-sign-stack { display: flex; flex-direction: column; gap: 14px; }
  .dc-sign-card {
      flex: 1;
      border: 1px solid var(--lav-border);
      border-radius: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      text-align: center;
  }
  .dc-sign-space { width: 80%; border-bottom: 1px solid #333; margin-top: 30px; margin-bottom: 3px; }

  /* ===== BAR FOOTER ===== */
  .barfoot, .bottom-status-bar {
    background: var(--purple);
    color: #fff;
    margin: 8px -10px 0 -10px;
    padding: 7px 14px;
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    border-radius: 0;
  }
`;

export const getPrintLogoSrc = (profile) => {
  const custom = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  return custom || DEFAULT_PRINT_LOGO_SRC;
};

/** Icon/image only — used inside .logo boxes */
export const buildPrintLogoHtml = (profile) => {
  const src = getPrintLogoSrc(profile);
  return `<img src="${src}" alt="UMA MICRON" style="width:100%;height:100%;object-fit:contain;display:block;" />`;
};

/**
 * Exact UMA MICRON brand lockup for print headers.
 * Default logo already includes name + tagline, so no duplicate text is rendered.
 * Custom uploaded logos keep the classic logo + name + tagline layout.
 */
export const buildPrintBrandHtml = (profile, {
  companyName = 'UMA MICRON',
  tagline = "Micronization of API's"
} = {}) => {
  const custom = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  if (custom) {
    return `
      <div class="logo"><img src="${custom}" alt="Logo" style="width:100%;height:100%;object-fit:contain;display:block;" /></div>
      <div class="brand-text">
        <h1>${escHtml(companyName)}</h1>
        <div class="tagline">${escHtml(tagline)}</div>
      </div>`;
  }
  return `
    <div class="brand-lockup">
      <img src="${DEFAULT_PRINT_LOGO_SRC}" alt="UMA MICRON" />
    </div>`;
};

export const buildPrintHeader = (profile, title, badgeText = 'ORIGINAL FOR RECIPIENT') => `
  <div class="header">
    <div class="brand">
      ${buildPrintBrandHtml(profile, {
        companyName: profile.companyName || 'UMA MICRON',
        tagline: profile.tagline || "Micronization of API's"
      })}
    </div>
    <div class="tax-invoice-box">
      <div class="ti-title">${escHtml(title)}</div>
      ${badgeText ? `<div class="ti-sub">${escHtml(badgeText)}</div>` : ''}
    </div>
  </div>`;

export const buildMetaStrip = (profile, companyState, companyPan, rightColHtml) => `
  <div class="info-row">
    <div class="company-info">
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')} ${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')}, ${escHtml(companyState)}, India</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span>${escHtml(profile.phone || '+91 97120 00297')}</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span><span>${escHtml(profile.email || 'umamicron@gmail.com')}</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span><span>${escHtml(profile.website || 'www.umamicron.com')}</span></div>

      <div class="reg-details">
        <div class="reg-row"><span class="label">GSTIN</span><span class="colon">:</span><span>${escHtml(profile.gstNumber || '')}</span></div>
        <div class="reg-row"><span class="label">PAN</span><span class="colon">:</span><span>${escHtml(companyPan)}</span></div>
        <div class="reg-row"><span class="label">State</span><span class="colon">:</span><span>${escHtml(companyState)}</span></div>
      </div>
    </div>

    <div class="invoice-meta">
      <div class="block" style="padding-top: 10px;">
        ${rightColHtml}
      </div>
    </div>
  </div>`;

export const hasPrintVal = (v) => {
  const s = String(v ?? '').trim();
  return s !== '' && s !== '-' && s !== '—' && s !== 'N/A';
};

export const buildPartyFootHtml = (gstin, state, stateCode) => {
  const rows = [];
  if (hasPrintVal(gstin)) {
    rows.push(`<div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>${escHtml(gstin)}</span></div>`);
  }
  if (hasPrintVal(state) || hasPrintVal(stateCode)) {
    const stateText = hasPrintVal(stateCode)
      ? `${escHtml(state)}${hasPrintVal(state) ? ' ' : ''}(${escHtml(stateCode)})`
      : escHtml(state);
    rows.push(`<div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>${stateText}</span></div>`);
  }
  return rows.length ? `<div class="party-foot">${rows.join('')}</div>` : '';
};

export const buildOptionalMetaRowHtml = (label, value, { iconHtml = '', sub = false } = {}) => {
  if (!hasPrintVal(value)) return '';
  return `<div class="meta-row${sub ? ' sub' : ''}"><span class="m-icon">${iconHtml || ''}</span><span class="m-label">${escHtml(label)}</span><span class="m-colon">:</span><span class="m-value">${escHtml(value)}</span></div>`;
};

export const buildPartyCard = (title, iconClass, name, addressLines, gstin, state, stateCode) => {
  const iconHtml = iconClass.includes('bi-') 
    ? `<i class="${iconClass}" style="margin-right: 6px;"></i>` 
    : `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>`;
  const lines = (addressLines || []).filter((l) => hasPrintVal(l));
    
  return `
  <div class="party">
    <div class="party-head">${iconHtml} ${escHtml(title)}</div>
    <div class="party-body">
      ${hasPrintVal(name) ? `<div class="cname">${escHtml(name)}</div>` : ''}${lines.map((line) => `<div class="addr">${escHtml(line)}</div>`).join('')}
    </div>
    ${buildPartyFootHtml(gstin, state, stateCode)}
  </div>`;
};

export const buildBankDetailsBox = (profile) => {
  const rows = [
    ['Bank Name', profile.bankName || 'AXIS BANK LTD'],
    ['A/c Name', profile.accountName || profile.companyName || 'UMA MICRON'],
    ['Current A/c No.', profile.accountNumber || ''],
    ['IFS CODE', profile.ifscCode || ''],
    ['Branch', profile.branch || '']
  ].filter(([, v]) => hasPrintVal(v));

  return `
  <div class="bank">
    <div class="box-head"><svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6"/><path d="M4 10h16v9H4z"/><path d="M4 19h16M8 10v9M12 10v9M16 10v9"/></svg> OUR BANK DETAILS</div>
    <div class="bank-body">
      ${rows.map(([label, value]) =>
        `<div class="bank-row"><span class="blabel">${escHtml(label)}</span><span class="bcolon">:</span><span>${escHtml(value)}</span></div>`
      ).join('')}
    </div>
  </div>`;
};

export const DEFAULT_INVOICE_TERMS = [
  'Subject to Vadodara Jurisdiction.',
  'Payment terms as per our agreed terms.',
  'Interest will be charged @ 24% p.a. if the amount remains unpaid from the due date.'
];

export const DEFAULT_PO_TERMS = [
  'Delivery 10 days from the date of Purchase Order.',
  'Transportation Extra As Actual.',
  '10 Years Warranty'
];

export const DEFAULT_INVOICE_DECLARATION =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

/** Split stored terms into numbered lines (real newlines; no CSS list markers). */
export const formatPrintTermsHtml = (terms, fallbackLines = DEFAULT_INVOICE_TERMS) => {
  const raw = String(terms || '').trim();
  const source = raw ? raw.split(/\r?\n/) : fallbackLines;
  const stripNum = (line) => String(line || '')
    .replace(/^\s*\d{1,2}[.)]\s*/, '')
    .replace(/^\s*\d{1,2}(?=[A-Za-z])/, '')
    .trim();
  const lines = source.map(stripNum).filter(Boolean);
  const items = lines.length ? lines : fallbackLines;
  return items.map((line, i) => (
    `<div class="term-line">${i + 1}. ${escHtml(line)}</div>`
  )).join('');
};

export const buildFooterTerms = (companyName, termsHtml, declarationHtml) => {
  const rawTerms = String(termsHtml || '');
  const termsBlock = /<[^>]+>/.test(rawTerms)
    ? rawTerms
    : formatPrintTermsHtml(rawTerms, DEFAULT_INVOICE_TERMS);
  const declarationRaw = String(declarationHtml || DEFAULT_INVOICE_DECLARATION).trim();
  const declaration = /</.test(declarationRaw) ? declarationRaw : escHtml(declarationRaw);
  return `
  <table class="footer3">
    <tr>
      <td class="f3col">
        <div class="box-head"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg> TERMS &amp; CONDITIONS</div>
        <div class="f3-body">${termsBlock}</div>
      </td>
      <td class="f3col">
        <div class="box-head"><svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg> DECLARATION</div>
        <div class="f3-body">${declaration}</div>
      </td>
      <td class="f3col sig-col">
        <div class="box-head" style="justify-content:center;">For ${escHtml(companyName || 'UMA MICRON')}</div>
        <div class="f3-body sig-body">
          <div class="sig-space"></div>
          <div class="sig-line">Authorised Signatory</div>
        </div>
      </td>
    </tr>
  </table>`;
};

export const buildStatusBar = (pageText = 'Page 1 of 1', customText = 'This is a computer-generated document.') => `
  <div class="barfoot">
    <span>Thank you for your business!</span>
    <span>E. &amp; O.E.</span>
    <span>${escHtml(customText)}</span>
    <span>${escHtml(pageText)}</span>
  </div>`;

export const renderHtmlToPdf = async (html, {
  mode = 'save',
  filePrefix = 'DOC',
  docNo = 'N/A',
  width = PRINT_PAGE_W,
  fitPage = false,
  printPrefs,
  skipPrintPrefs = false,
  prepareDoc = null,
  splitOverflowPages = false
} = {}) => {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const resolvedPrefs = skipPrintPrefs
    ? null
    : normalizePrintPrefs(printPrefs || getStoredPrintPrefs());
  const htmlWithPrefs = skipPrintPrefs
    ? html
    : applyPrintPrefsToHtml(html, resolvedPrefs);
  const minFitScale = resolvedPrefs ? getPrintMinFitScale(resolvedPrefs) : 0.82;
  const density = resolvedPrefs ? getPrintDensity(resolvedPrefs) : 'base';

  // Render inside an iframe so document <style> (e.g. * { font-size })
  // cannot leak into the live ERP UI and shrink app fonts on Preview.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'pdf-render-host');
  iframe.style.cssText = `position:fixed;left:-12000px;top:0;width:${width}px;height:1400px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument || iframe.contentWindow.document;
  idoc.open();
  idoc.write(htmlWithPrefs);
  idoc.close();
  const stampRoot = (el) => {
    if (!el || skipPrintPrefs) return;
    el.classList.add(PRINT_ROOT_CLASS, `print-density-${density}`);
  };
  stampRoot(idoc.documentElement);
  stampRoot(idoc.body);

  try {
    await new Promise((r) => {
      if (idoc.readyState === 'complete') {
        requestAnimationFrame(() => requestAnimationFrame(r));
      } else {
        iframe.onload = () => requestAnimationFrame(() => requestAnimationFrame(r));
      }
    });
    // Allow images/fonts inside iframe to settle
    await new Promise((r) => setTimeout(r, 50));

    const a4Ratio = 297 / 210;
    const singlePageHeight = Math.round(width * a4Ratio);
    if (typeof prepareDoc === 'function') {
      prepareDoc(idoc, { width, singlePageHeight, printPrefs: resolvedPrefs, density });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    // If large font still overflows designed pages, escalate density before capture.
    if (!skipPrintPrefs && resolvedPrefs) {
      const escalate = ['md', 'lg', 'xl'];
      let tierIdx = Math.max(0, escalate.indexOf(density));
      for (let step = 0; step < 3; step++) {
        const pages = [...idoc.querySelectorAll('.pdf-page')];
        if (!pages.length) break;
        let needsMore = false;
        pages.forEach((page) => {
          page.style.height = 'auto';
          page.style.maxHeight = 'none';
          page.style.minHeight = '0';
          page.style.overflow = 'visible';
          const h = Math.max(page.scrollHeight, page.offsetHeight || 0);
          if (h > singlePageHeight + 8) needsMore = true;
        });
        if (!needsMore) break;
        tierIdx = Math.min(escalate.length - 1, tierIdx + 1);
        const nextDensity = escalate[tierIdx];
        [idoc.documentElement, idoc.body].forEach((el) => {
          if (!el) return;
          el.classList.remove('print-density-base', 'print-density-sm', 'print-density-md', 'print-density-lg', 'print-density-xl');
          el.classList.add(PRINT_ROOT_CLASS, `print-density-${nextDensity}`);
        });
        // Quotation-style compact helpers if present
        pages.forEach((page) => {
          if (page.classList.contains('sheet')) {
            page.classList.add(nextDensity === 'xl' ? 'quot-compact-more' : 'quot-compact');
            if (nextDensity === 'xl') page.classList.add('quot-compact-more');
          }
        });
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 0;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const pageNodes = [...idoc.querySelectorAll('.pdf-page')];
    const targets = pageNodes.length
      ? pageNodes
      : [idoc.querySelector('.print-host') || idoc.body?.firstElementChild].filter(Boolean);

    const captureScale = 2;
    const clipCanvasToA4 = (sourceCanvas) => {
      // Exact A4 pixel box at capture scale — keeps right/bottom borders visible
      const expectedW = Math.round(width * captureScale);
      const expectedH = Math.round(expectedW * a4Ratio);
      if (
        Math.abs(sourceCanvas.width - expectedW) <= 1 &&
        Math.abs(sourceCanvas.height - expectedH) <= 1
      ) {
        return sourceCanvas;
      }
      const clipped = document.createElement('canvas');
      clipped.width = expectedW;
      clipped.height = expectedH;
      const ctx = clipped.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, expectedW, expectedH);
      ctx.drawImage(sourceCanvas, 0, 0);
      return clipped;
    };

    let pdfHasPage = false;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const originalCss = target.style.cssText;
      let fitScale = 1;

      target.style.width = `${width}px`;
      target.style.height = 'auto';
      target.style.minHeight = '0';
      target.style.maxHeight = 'none';
      target.style.overflow = 'visible';
      target.style.boxSizing = 'border-box';
      target.style.margin = '0';
      target.style.zoom = '1';
      layoutFitFooterPages(idoc, singlePageHeight);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const naturalH = Math.max(target.scrollHeight, target.offsetHeight || 0);
      const overflows = naturalH > singlePageHeight + 4;
      // Lock designed pages to A4 unless this sheet still overflows and splitting is allowed
      const lockThisPage = (fitPage || pageNodes.length > 0) && !(splitOverflowPages && overflows);

      if (lockThisPage) {
        // Auto-fit any locked page that overflows (font/size changes included).
        fitScale = overflows
          ? Math.max(minFitScale, Math.min(1, singlePageHeight / naturalH))
          : 1;
        target.style.height = `${singlePageHeight}px`;
        target.style.minHeight = `${singlePageHeight}px`;
        target.style.maxHeight = `${singlePageHeight}px`;
        target.style.overflow = 'hidden';
        if (fitScale < 1) {
          // Widen layout so after zoom the visual width still fills the page
          target.style.width = `${Math.round(width / fitScale)}px`;
          target.style.zoom = String(fitScale);
        }
      } else if (overflows) {
        const pages = Math.max(1, Math.ceil(naturalH / singlePageHeight));
        target.style.minHeight = `${pages * singlePageHeight}px`;
        target.style.height = 'auto';
        target.style.maxHeight = 'none';
        target.style.overflow = 'visible';
      } else if (pageNodes.length > 0) {
        target.style.height = `${singlePageHeight}px`;
        target.style.minHeight = `${singlePageHeight}px`;
        target.style.maxHeight = `${singlePageHeight}px`;
        target.style.overflow = 'hidden';
      }

      layoutFitFooterPages(idoc, singlePageHeight);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const captureH = (lockThisPage || (!overflows && pageNodes.length > 0))
        ? singlePageHeight
        : Math.max(naturalH, target.scrollHeight, singlePageHeight);

      const canvasRaw = await html2canvas(target, {
        scale: captureScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        width,
        windowWidth: width,
        height: captureH,
        windowHeight: captureH,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        logging: false,
        onclone: (clonedDoc) => {
          if (!lockThisPage && !(pageNodes.length > 0 && !overflows)) return;
          const htmlEl = clonedDoc.documentElement;
          const bodyEl = clonedDoc.body;
          if (htmlEl) {
            htmlEl.style.width = `${width}px`;
            htmlEl.style.margin = '0';
            htmlEl.style.padding = '0';
            htmlEl.style.overflow = 'hidden';
          }
          if (bodyEl) {
            bodyEl.style.width = `${width}px`;
            bodyEl.style.margin = '0';
            bodyEl.style.padding = '0';
            bodyEl.style.overflow = 'hidden';
          }
          clonedDoc.querySelectorAll('.pdf-page, .print-host, .page').forEach((el) => {
            el.style.width = fitScale < 1 ? `${Math.round(width / fitScale)}px` : `${width}px`;
            el.style.height = `${singlePageHeight}px`;
            el.style.minHeight = `${singlePageHeight}px`;
            el.style.maxHeight = `${singlePageHeight}px`;
            el.style.overflow = 'hidden';
            el.style.transform = 'none';
            el.style.zoom = fitScale < 1 ? String(fitScale) : '1';
            el.style.margin = '0';
            el.style.padding = '0';
            el.style.boxSizing = 'border-box';
          });
          clonedDoc.querySelectorAll('.header').forEach((el) => {
            el.style.marginTop = '0';
            el.style.paddingTop = '0';
            el.style.width = '100%';
            if (el.querySelector('.quote-banner')) {
              el.style.minHeight = '96px';
              el.style.height = 'auto';
              el.style.alignItems = 'stretch';
              el.style.padding = '0 0 0 22px';
              el.style.overflow = 'hidden';
            } else {
              el.style.minHeight = '0';
              el.style.height = 'auto';
            }
          });
          clonedDoc.querySelectorAll('.quote-banner').forEach((el) => {
            el.style.margin = '0';
            el.style.marginLeft = 'auto';
            el.style.minHeight = '96px';
            el.style.alignSelf = 'stretch';
            el.style.flex = '1 1 300px';
            el.style.width = 'auto';
            el.style.maxWidth = 'none';
          });
          clonedDoc.querySelectorAll('.quote-banner .fill').forEach((el) => {
            el.style.minWidth = '0';
            el.style.width = '100%';
            el.style.minHeight = '96px';
            el.style.height = '100%';
            el.style.padding = '0 24px 0 44px';
          });
          clonedDoc.querySelectorAll('.contact-bar').forEach((el) => {
            el.style.width = '100%';
            el.style.boxSizing = 'border-box';
            el.style.margin = '0';
            el.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('.contact-bar .citem, .contact-bar .citem span').forEach((el) => {
            el.style.overflow = 'visible';
            el.style.maxWidth = 'none';
            el.style.textOverflow = 'clip';
          });
          clonedDoc.querySelectorAll('.contact-bar .citem.c-tight').forEach((el) => {
            el.style.minWidth = 'max-content';
            el.style.flex = '0 0 auto';
          });
          clonedDoc.querySelectorAll('.contact-bar .citem.c-tight span').forEach((el) => {
            el.style.whiteSpace = 'nowrap';
          });
          clonedDoc.querySelectorAll('.quote-banner h2').forEach((el) => {
            const scaleRaw = getComputedStyle(clonedDoc.documentElement).getPropertyValue('--print-scale');
            const printScale = parseFloat(scaleRaw) || 1;
            el.style.fontSize = `${Math.round(28 * printScale)}px`;
            el.style.lineHeight = '1';
            el.style.margin = '0';
          });
          clonedDoc.querySelectorAll('.content-wrapper td[valign="top"], .content-wrapper .pad-top').forEach((el) => {
            el.style.paddingTop = '4px';
            el.style.verticalAlign = 'top';
          });
          clonedDoc.querySelectorAll('.f3-body, .f3-body ol, .f3-body li, .f3-body .term-line').forEach((el) => {
            el.style.whiteSpace = 'normal';
            el.style.overflow = 'visible';
            el.style.wordBreak = 'normal';
            el.style.overflowWrap = 'break-word';
          });
          clonedDoc.querySelectorAll('table.footer3 td.f3col').forEach((el) => {
            el.style.display = 'table-cell';
            el.style.height = '128px';
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
            el.style.verticalAlign = 'top';
          });
          clonedDoc.querySelectorAll('table.footer3 .f3-body, table.footer3 .sig-body').forEach((el) => {
            el.style.display = 'block';
            el.style.flex = 'none';
            el.style.height = 'auto';
            el.style.minHeight = '0';
            el.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('table.footer3 .sig-space').forEach((el) => {
            el.style.display = 'block';
            el.style.flex = 'none';
            el.style.height = '56px';
            el.style.minHeight = '56px';
            el.style.maxHeight = '56px';
          });
          clonedDoc.querySelectorAll('.sig-col .sig-line, .sig-line').forEach((el) => {
            el.style.margin = '0';
            el.style.visibility = 'visible';
            el.style.display = 'block';
            el.style.color = '#231f20';
            el.style.webkitTextFillColor = '#231f20';
          });
          clonedDoc.querySelectorAll('.footer3, .barfoot').forEach((el) => {
            el.style.overflow = 'visible';
            el.style.flexShrink = '0';
          });
          clonedDoc.querySelectorAll('.barfoot').forEach((el) => {
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.lineHeight = '1.35';
            el.style.minHeight = '32px';
            el.style.paddingTop = el.style.paddingTop || '8px';
            el.style.paddingBottom = '10px';
          });
          layoutFitFooterPages(clonedDoc, singlePageHeight);
        }
      });

      target.style.cssText = originalCss;

      if (lockThisPage || (!overflows && pageNodes.length > 0)) {
        if (pdfHasPage) pdf.addPage();
        const canvas = clipCanvasToA4(canvasRaw);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH);
        pdfHasPage = true;
        continue;
      }

      // Overflowing sheet: slice full-bleed A4 pages so nothing is clipped
      if (splitOverflowPages && overflows) {
        const expectedW = Math.round(width * captureScale);
        const pageHpx = Math.round(expectedW * a4Ratio);
        let yPx = 0;
        let pageIndex = 0;
        while (yPx < canvasRaw.height - 1) {
          const sliceH = Math.min(pageHpx, canvasRaw.height - yPx);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = expectedW;
          pageCanvas.height = pageHpx;
          const ctx = pageCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, expectedW, pageHpx);
          ctx.drawImage(
            canvasRaw,
            0, yPx, Math.min(canvasRaw.width, expectedW), sliceH,
            0, 0, Math.min(canvasRaw.width, expectedW), sliceH
          );
          if (pdfHasPage || pageIndex > 0) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH);
          pdfHasPage = true;
          yPx += sliceH;
          pageIndex += 1;
        }
        continue;
      }

      const canvas = canvasRaw;
      const imgW = usableW;
      const pxPerMm = canvas.width / imgW;
      const pageHeightPx = usableH * pxPerMm;
      let yPx = 0;
      let pageIndex = 0;
      while (yPx < canvas.height - 1) {
        const sliceH = Math.min(pageHeightPx, canvas.height - yPx);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.ceil(sliceH);
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceHmm = sliceH / pxPerMm;
        if (pdfHasPage || pageIndex > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, sliceHmm);
        pdfHasPage = true;
        yPx += sliceH;
        pageIndex += 1;
      }
    }

    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `${filePrefix}_${docNo}`;
    } else {
      pdf.save(`${filePrefix}_${docNo}.pdf`);
    }
  } finally {
    iframe.remove();
  }
};
