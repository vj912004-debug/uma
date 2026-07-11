import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatTiHeaderAddressLines, getTiContactLine, mergeCompanyProfile, DEFAULT_COMPANY_PROFILE } from './companyProfile';
import {
  TI_CHARGES_LIST,
  calcTiTotals,
  formatPdfDateSlash,
  getPartyAddressRows,
  splitPartyAddressLines
} from './taxInvoiceLayout';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtMoney = (n) => (parseFloat(n) || 0).toFixed(2);

const fmtQty = (n) => {
  const v = parseFloat(n);
  if (!v) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

// SVG logo matching the circular UM design from the screenshot
const DEFAULT_TI_LOGO_HTML = `
<svg width="90" height="90" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
  <circle cx="45" cy="45" r="43" fill="none" stroke="#d61c1c" stroke-width="3"/>
  <ellipse cx="45" cy="45" rx="52" ry="18" fill="none" stroke="#00499c" stroke-width="2.5"
    transform="rotate(-22 45 45)" stroke-dasharray="115 45"/>
  <ellipse cx="45" cy="45" rx="52" ry="18" fill="none" stroke="#00499c" stroke-width="2.5"
    transform="rotate(22 45 45)" stroke-dasharray="45 115"/>
  <text x="45" y="58" font-family="Times New Roman, serif" font-size="30" font-weight="900"
    fill="#d61c1c" text-anchor="middle">UM</text>
</svg>`;

const TI_STYLES = `
  :root {
    --primary-blue: #00499c;
    --dark-blue: #003171;
    --light-bg: #f4f8fc;
    --border-color: #a3c7f5;
    --text-color: #000000;
  }

  * {
    box-sizing: border-box;
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: #e4e9f2;
    padding: 10px;
    color: var(--text-color);
  }

  .invoice-card {
    background-color: #ffffff;
    width: 760px;
    margin: 0 auto;
    padding: 18px;
    border: 2px solid var(--primary-blue);
    border-radius: 6px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  }

  /* --- HEADER --- */
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .company-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title-brand {
    font-size: 34px;
    font-weight: bold;
    color: var(--primary-blue);
    letter-spacing: 0.5px;
    line-height: 1.1;
  }

  .address-txt {
    font-size: 11px;
    font-weight: bold;
    line-height: 1.4;
    color: #111;
    margin-top: 2px;
  }

  .contact-row {
    display: flex;
    gap: 15px;
    font-size: 11px;
    font-weight: bold;
    margin-top: 4px;
    align-items: center;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .icon-circle {
    background-color: var(--primary-blue);
    color: white;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-style: normal;
  }

  .gst-pill {
    background-color: var(--primary-blue);
    color: white;
    padding: 4px 14px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 12px;
    display: inline-block;
    margin-top: 8px;
    width: fit-content;
  }

  /* ORIGINAL / DUPLICATE badge */
  .badge-box {
    border: 2px solid var(--primary-blue);
    background-color: var(--primary-blue);
    color: white;
    border-radius: 6px;
    overflow: hidden;
    width: 110px;
    text-align: center;
    font-size: 10px;
    font-weight: bold;
  }

  .badge-top {
    padding: 5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.4);
  }

  .badge-bottom {
    padding: 5px 0;
  }

  /* --- TAX INVOICE BANNER --- */
  .invoice-banner-container {
    position: relative;
    height: 46px;
    margin-bottom: 12px;
  }

  .invoice-banner-blue {
    position: absolute;
    right: 0;
    top: 0;
    width: 388px;
    height: 44px;
    background-color: var(--primary-blue);
    clip-path: polygon(35px 0%, 100% 0%, 100% 100%, 0% 100%);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 15px;
    color: white;
  }

  .banner-text-flex {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 26px;
    font-weight: bold;
    letter-spacing: 1px;
  }

  .banner-icon {
    font-size: 20px;
  }

  /* --- METADATA GRID --- */
  .meta-section-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-bottom: 12px;
  }

  .structured-table {
    width: 100%;
    border-collapse: collapse;
  }

  .structured-table td {
    border: 1px solid var(--border-color);
    padding: 6px 8px;
    font-size: 11.5px;
    height: 30px;
  }

  .structured-table td.lbl {
    color: var(--primary-blue);
    font-weight: bold;
    width: 38%;
  }

  .structured-table td.val {
    font-weight: normal;
    color: #000;
  }

  .split-cell-flex {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    margin: -6px -8px;
  }

  .split-left {
    padding: 6px 8px;
    flex-grow: 1;
  }

  .split-code-label {
    border-left: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    background-color: var(--light-bg);
    color: var(--primary-blue);
    font-weight: bold;
    padding: 6px 12px;
    text-align: center;
  }

  .split-code-val {
    padding: 6px 16px;
    font-weight: bold;
    text-align: center;
  }

  /* --- BILL TO / SHIP TO --- */
  .party-section-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-bottom: 12px;
  }

  .party-card-panel {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .party-card-header {
    background-color: var(--primary-blue);
    color: white;
    padding: 6px 10px;
    font-weight: bold;
    font-size: 12px;
    letter-spacing: 0.5px;
  }

  .party-card-body {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .form-row-item {
    display: flex;
    align-items: flex-end;
    font-size: 11.5px;
  }

  .form-lbl {
    width: 55px;
    font-weight: bold;
    color: #000;
    flex-shrink: 0;
  }

  .form-sep {
    width: 15px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .form-line-input {
    flex-grow: 1;
    border-bottom: 1px solid #c0d3eb;
    height: 15px;
    padding-bottom: 1px;
    font-weight: bold;
    color: #000;
    font-size: 11.5px;
  }

  .form-triple-row {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .state-container {
    display: flex;
    border: 1px solid var(--border-color);
    align-items: center;
    font-size: 11.5px;
    margin-left: auto;
    width: 110px;
    height: 24px;
    flex-shrink: 0;
  }

  .state-code-lbl {
    background-color: var(--light-bg);
    color: var(--primary-blue);
    font-weight: bold;
    padding: 0 8px;
    border-right: 1px solid var(--border-color);
    height: 100%;
    display: flex;
    align-items: center;
  }

  .state-code-val {
    flex-grow: 1;
    text-align: center;
    font-weight: bold;
  }

  /* --- ITEMS TABLE --- */
  .main-ledger-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    table-layout: fixed;
  }

  .main-ledger-table th, .main-ledger-table td {
    border: 1px solid var(--border-color);
    padding: 4px 2px;
    font-size: 10.5px;
    text-align: center;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .main-ledger-table th {
    background-color: var(--primary-blue);
    color: white;
    font-weight: bold;
  }

  .main-ledger-table th.sub-head {
    background-color: var(--primary-blue);
    border-top: 1px solid #ffffff44;
    font-size: 10px;
    font-weight: normal;
  }

  .main-ledger-table td.align-left {
    text-align: left;
    padding-left: 6px;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .main-ledger-table tr.data-row {
    height: 21px;
  }

  .main-ledger-table tr.summary-row {
    background-color: var(--light-bg);
    font-weight: bold;
    color: var(--primary-blue);
    height: 26px;
  }

  .main-ledger-table tr.summary-row td {
    font-size: 12px;
    color: var(--primary-blue);
  }

  /* --- BANK & TOTALS --- */
  .bottom-split-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 15px;
    margin-bottom: 15px;
  }

  .bank-info-panel {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
    background-color: #fff;
  }

  .bank-info-header {
    background-color: var(--primary-blue);
    color: white;
    padding: 6px 10px;
    font-weight: bold;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .bank-info-body {
    padding: 12px;
    display: grid;
    grid-template-columns: 115px 15px 1fr;
    row-gap: 8px;
    font-size: 11.5px;
  }

  .bank-row-lbl {
    color: var(--primary-blue);
    font-weight: bold;
  }

  .bank-row-val {
    font-weight: bold;
    color: #000;
  }

  .totals-summary-table {
    width: 100%;
    border-collapse: collapse;
  }

  .totals-summary-table td {
    border: 1px solid var(--border-color);
    padding: 6px 10px;
    font-size: 11.5px;
  }

  .totals-summary-table tr.blue-tint-row td {
    background-color: var(--light-bg);
    color: var(--primary-blue);
    font-weight: bold;
  }

  .totals-summary-table tr.grand-final-row td {
    background-color: var(--primary-blue);
    color: white;
    font-weight: bold;
    font-size: 13.5px;
    padding: 7px 10px;
  }

  /* --- FOOTER --- */
  .footer-declaration-grid {
    display: grid;
    grid-template-columns: 1.2fr 0.6fr 1.2fr;
    gap: 10px;
    border-top: 1px solid var(--border-color);
    padding-top: 15px;
    align-items: flex-end;
  }

  .terms-block {
    font-size: 10.5px;
  }

  .terms-block-heading {
    color: var(--primary-blue);
    font-weight: bold;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
  }

  .terms-block ol {
    padding-left: 14px;
    line-height: 1.45;
    font-weight: bold;
    color: #111;
  }

  .seal-block {
    text-align: center;
    font-size: 11px;
    font-weight: bold;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .seal-circle-placeholder {
    width: 58px;
    height: 58px;
    border: 2px dashed var(--primary-blue);
    border-radius: 50%;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary-blue);
    font-size: 26px;
  }

  .seal-line-decor {
    width: 80px;
    height: 1px;
    background-color: #b0cbe8;
    margin-bottom: 10px;
  }

  .sign-block {
    text-align: center;
  }

  .sign-certify-txt {
    font-size: 9.5px;
    font-weight: bold;
    margin-bottom: 15px;
    color: #222;
  }

  .sign-company-lbl {
    font-weight: bold;
    color: var(--primary-blue);
    font-size: 12px;
    margin-bottom: 45px;
  }

  .sign-hr-line {
    border-top: 1px solid #b0cbe8;
    width: 85%;
    margin: 0 auto 5px auto;
  }

  .sign-title-lbl {
    font-weight: bold;
    font-size: 11px;
    color: #000;
  }

  @media print {
    body { background-color: #ffffff; padding: 0; }
    .invoice-card { box-shadow: none; width: 100%; border: 2px solid var(--primary-blue); }
  }
`;

// Build address lines for the party section
const formatPartyAddressRows = (address, defaultLines = 3) => {
  const lines = splitPartyAddressLines(address, 48);
  const rows = [];
  for (let i = 0; i < Math.max(lines.length, defaultLines); i++) {
    rows.push(`
      <div class="form-row-item">
        <div class="form-lbl">${i === 0 ? 'Address' : ''}</div>
        <div class="form-sep">${i === 0 ? ':' : ''}</div>
        <div class="form-line-input">${esc(lines[i] || '')}</div>
      </div>`);
  }
  return rows.join('');
};

const buildItemRowsHtml = (data) => {
  const { chargeAmounts, totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty } = calcTiTotals(data);
  const rows = [];
  let sr = 0;

  const pushRow = (label, qty, rate, amt, sgstRate, cgstRate) => {
    const sgstAmt = amt * (sgstRate / 100);
    const cgstAmt = amt * (cgstRate / 100);
    const rowTotal = amt + sgstAmt + cgstAmt;
    sr += 1;
    rows.push(`
      <tr class="data-row">
        <td>${sr}</td>
        <td class="align-left">${esc(label)}</td>
        <td>${esc(fmtQty(qty))}</td>
        <td>${rate ? esc(parseFloat(rate).toFixed(2)) : '0.00'}</td>
        <td>${fmtMoney(amt)}</td>
        <td>${sgstRate}</td>
        <td>${fmtMoney(sgstAmt)}</td>
        <td>${cgstRate}</td>
        <td>${fmtMoney(cgstAmt)}</td>
        <td>0</td>
        <td>${fmtMoney(0)}</td>
        <td>${fmtMoney(rowTotal)}</td>
      </tr>`);
  };

  TI_CHARGES_LIST.forEach((charge) => {
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

  // Pad to minimum 10 rows
  const minRows = 10;
  while (sr < minRows) {
    sr += 1;
    rows.push(`
      <tr class="data-row">
        <td>${sr}</td>
        <td class="align-left"></td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`);
  }

  // Totals summary row
  rows.push(`
    <tr class="summary-row">
      <td colspan="2" style="text-align:right;padding-right:25px;">TOTAL</td>
      <td>${totalQty || 0}</td>
      <td style="color:#888;">-</td>
      <td>${fmtMoney(totalAmt)}</td>
      <td></td>
      <td>${fmtMoney(totalSgst)}</td>
      <td></td>
      <td>${fmtMoney(totalCgst)}</td>
      <td></td>
      <td>${fmtMoney(totalIgst)}</td>
      <td>${fmtMoney(totalAll)}</td>
    </tr>`);

  return { rowsHtml: rows.join(''), totals: { totalAmt, totalSgst, totalCgst, totalIgst, totalAll } };
};

export const buildTaxInvoiceHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const addressLines = formatTiHeaderAddressLines(profile);
  const logoSrc = profile.logo && profile.logo.startsWith('data:image') ? profile.logo : '';
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="Logo" style="width:90px;height:90px;object-fit:contain;">`
    : DEFAULT_TI_LOGO_HTML;

  const docNo   = esc(data.invoiceNo || 'N/A');
  const docDate = esc(formatPdfDateSlash(data.date) || 'N/A');
  const refNo   = esc(data.partyDocNo || data.challanNo || '');
  const refDate = esc(formatPdfDateSlash(data.partyDocDate) || '');
  const dcNo    = esc(data.dcNo || '');
  const dcDate  = esc(formatPdfDateSlash(data.dcDate) || data.dcDate || '');

  const companyState     = esc(profile.state || 'GUJARAT');
  const companyStateCode = esc('24');

  const { rowsHtml, totals } = buildItemRowsHtml(data);

  // Inline SVG icons (phone & email) — no CDN needed for html2canvas
  const IC_PHONE = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 512 512" style="fill:#fff;"><path d="M493.4 24.6l-104-24c-11.3-2.6-22.9 3.3-27.5 13.9l-48 112c-4.2 9.8-1.4 21.3 6.9 28l60.6 49.6c-36 76.7-98.9 140.5-177.2 177.2l-49.6-60.6c-6.8-8.3-18.2-11.1-28-6.9l-112 48C3.9 366.5-2 378.1.6 389.4l24 104C27.1 504.2 36.7 512 48 512c256.1 0 464-207.5 464-464 0-11.2-7.7-20.9-18.6-23.4z"/></svg>`;
  const IC_MAIL = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 512 512" style="fill:#fff;"><path d="M502.3 190.8c3.9-3.1 9.7-.2 9.7 4.7V400c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V195.6c0-5 5.7-7.8 9.7-4.7 22.4 17.4 52.1 39.5 154.1 113.6 21.1 15.4 56.7 47.8 92.2 47.6 35.7.3 72-32.8 92.3-47.6 102-74.1 131.6-96.3 154-113.7zM256 320c23.2.4 56.6-29.2 73.4-41.4 132.7-96.3 142.8-104.7 173.4-128.7 5.8-4.5 9.2-11.5 9.2-18.9v-19c0-26.5-21.5-48-48-48H48C21.5 64 0 85.5 0 112v19c0 7.4 3.4 14.3 9.2 18.9 30.6 23.9 40.7 32.4 173.4 128.7 16.8 12.2 50.2 41.8 73.4 41.4z"/></svg>`;
  const IC_BANK = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 512 512" style="fill:#fff;flex-shrink:0;"><path d="M496 128v16a8 8 0 0 1-8 8h-24v12c0 6.627-5.373 12-12 12H60c-6.627 0-12-5.373-12-12v-12H24a8 8 0 0 1-8-8v-16a8 8 0 0 1 4.941-7.392l232-88a7.996 7.996 0 0 1 6.118 0l232 88A8 8 0 0 1 496 128zm-24 304H40c-13.255 0-24 10.745-24 24v16a8 8 0 0 0 8 8h480a8 8 0 0 0 8-8v-16c0-13.255-10.745-24-24-24zM96 192v192H60c-6.627 0-12 5.373-12 12v20h416v-20c0-6.627-5.373-12-12-12h-36V192h-64v192h-64V192h-64v192h-64V192H96z"/></svg>`;
  const IC_FILE = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 384 512" style="fill:var(--primary-blue);flex-shrink:0;"><path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm64 236c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8zm0-64c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8zm0-72v8c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12zm96-153.1L305.1 32c-4.5-4.5-10.6-7-17-7H272v128h128v-17.1c0-6.3-2.5-12.4-7-16.9z"/></svg>`;
  const IC_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 512 512" style="fill:var(--primary-blue);"><path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/></svg>`;

  // Party address helper
  const partyAddrRows = (address) => formatPartyAddressRows(address, 3);

  return `
<style>${TI_STYLES}</style>
<div class="invoice-card">

  <!-- HEADER -->
  <div class="header-container">
    <div class="logo-area">
      ${logoHtml}
      <div class="company-info">
        <div class="title-brand">${esc(profile.companyName)}</div>
        <div class="address-txt">
          ${esc(addressLines[0] || '')},<br>
          ${esc(addressLines[1] || '')}
        </div>
        <div class="contact-row">
          <div class="contact-item">
            <span class="icon-circle">${IC_PHONE}</span>
            ${esc(profile.phone || DEFAULT_COMPANY_PROFILE.phone)}
          </div>
          <div class="contact-item">
            <span class="icon-circle">${IC_MAIL}</span>
            ${esc(profile.email || DEFAULT_COMPANY_PROFILE.email)}
          </div>
        </div>
        <div class="gst-pill">GSTIN: ${esc(profile.gstNumber)}</div>
      </div>
    </div>

    <div class="badge-box">
      <div class="badge-top">ORIGINAL</div>
      <div class="badge-bottom">DUPLICATE</div>
    </div>
  </div>

  <!-- TAX INVOICE BANNER -->
  <div class="invoice-banner-container">
    <div class="invoice-banner-blue">
      <div class="banner-text-flex">
        <span>TAX INVOICE</span>
        <span class="banner-icon">${IC_FILE}</span>
      </div>
    </div>
  </div>

  <!-- METADATA BLOCKS -->
  <div class="meta-section-grid">
    <table class="structured-table">
      <tr>
        <td class="lbl">Invoice No.</td>
        <td class="val">${docNo}</td>
      </tr>
      <tr>
        <td class="lbl">Delivery Challan No.</td>
        <td class="val">${dcNo}</td>
      </tr>
      <tr>
        <td class="lbl">State</td>
        <td class="val" style="padding:0;">
          <div class="split-cell-flex">
            <div class="split-left">${companyState}</div>
            <div class="split-code-label">Code</div>
            <div class="split-code-val">${companyStateCode}</div>
          </div>
        </td>
      </tr>
    </table>

    <table class="structured-table">
      <tr>
        <td class="lbl">Invoice Date</td>
        <td class="val">${docDate}</td>
      </tr>
      <tr>
        <td class="lbl">Date</td>
        <td class="val">${dcDate}</td>
      </tr>
      <tr>
        <td class="lbl">PO No./Challan No.</td>
        <td class="val">${refNo}</td>
      </tr>
      <tr>
        <td class="lbl">Date</td>
        <td class="val">${refDate}</td>
      </tr>
    </table>
  </div>

  <!-- BILL TO & SHIP TO -->
  <div class="party-section-grid">
    <!-- Bill To -->
    <div class="party-card-panel">
      <div class="party-card-header">BILL TO PARTY</div>
      <div class="party-card-body">
        <div class="form-row-item">
          <div class="form-lbl">Name</div>
          <div class="form-sep">:</div>
          <div class="form-line-input">${esc(data.partyName || '')}</div>
        </div>
        ${partyAddrRows(data.billAddress || data.address || '')}
        <div class="form-triple-row">
          <div class="form-row-item" style="flex-grow:1;">
            <div class="form-lbl">State</div>
            <div class="form-sep">:</div>
            <div class="form-line-input" style="margin-right:10px;">${esc(data.billState || data.state || '')}</div>
          </div>
          <div class="state-container">
            <div class="state-code-lbl">Code</div>
            <div class="state-code-val">${esc(data.billStateCode || data.stateCode || '')}</div>
          </div>
        </div>
        <div class="form-row-item">
          <div class="form-lbl">GSTIN</div>
          <div class="form-sep">:</div>
          <div class="form-line-input">${esc(data.gstinBill || data.gstin || '')}</div>
        </div>
      </div>
    </div>

    <!-- Ship To -->
    <div class="party-card-panel">
      <div class="party-card-header">SHIP TO PARTY</div>
      <div class="party-card-body">
        <div class="form-row-item">
          <div class="form-lbl">Name</div>
          <div class="form-sep">:</div>
          <div class="form-line-input">${esc(data.shipName || data.partyName || '')}</div>
        </div>
        ${partyAddrRows(data.shipAddress || data.address || '')}
        <div class="form-triple-row">
          <div class="form-row-item" style="flex-grow:1;">
            <div class="form-lbl">State</div>
            <div class="form-sep">:</div>
            <div class="form-line-input" style="margin-right:10px;">${esc(data.shipState || data.state || '')}</div>
          </div>
          <div class="state-container">
            <div class="state-code-lbl">Code</div>
            <div class="state-code-val">${esc(data.shipStateCode || data.stateCode || '')}</div>
          </div>
        </div>
        <div class="form-row-item">
          <div class="form-lbl">GSTIN</div>
          <div class="form-sep">:</div>
          <div class="form-line-input">${esc(data.gstinShip || data.gstin || '')}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table class="main-ledger-table">
    <thead>
      <tr>
        <th rowspan="2" style="width:4%;">Sr.<br>No.</th>
        <th rowspan="2" style="width:28%;">Description</th>
        <th rowspan="2" style="width:5%;">Qty</th>
        <th rowspan="2" style="width:7%;">Rate</th>
        <th rowspan="2" style="width:8%;">Amount</th>
        <th colspan="2" style="width:10%;">SGST</th>
        <th colspan="2" style="width:10%;">CGST</th>
        <th colspan="2" style="width:10%;">IGST</th>
        <th rowspan="2" style="width:8%;">Total</th>
      </tr>
      <tr>
        <th class="sub-head" style="width:4%;">Rate</th>
        <th class="sub-head" style="width:6%;">Amt</th>
        <th class="sub-head" style="width:4%;">Rate</th>
        <th class="sub-head" style="width:6%;">Amt</th>
        <th class="sub-head" style="width:4%;">Rate</th>
        <th class="sub-head" style="width:6%;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <!-- BANK & TOTALS -->
  <div class="bottom-split-grid">
    <div class="bank-info-panel">
      <div class="bank-info-header">
        ${IC_BANK} OUR BANK DETAILS
      </div>
      <div class="bank-info-body">
        <div class="bank-row-lbl">Bank Name</div><div>:</div><div class="bank-row-val">AXIS BANK LTD</div>
        <div class="bank-row-lbl">A/C Name</div><div>:</div><div class="bank-row-val">${esc(profile.companyName)}</div>
        <div class="bank-row-lbl">Current A/C No.</div><div>:</div><div class="bank-row-val">916020061829671</div>
        <div class="bank-row-lbl">IFS CODE</div><div>:</div><div class="bank-row-val">UTIB0002018</div>
        <div class="bank-row-lbl">Branch</div><div>:</div><div class="bank-row-val">Nizampura</div>
      </div>
    </div>

    <table class="totals-summary-table">
      <tr>
        <td style="font-weight:bold;width:65%;">Total Amount before Tax</td>
        <td style="text-align:right;font-weight:bold;">${fmtMoney(totals.totalAmt)}</td>
      </tr>
      <tr>
        <td>SGST</td>
        <td style="text-align:right;">${fmtMoney(totals.totalSgst)}</td>
      </tr>
      <tr>
        <td>CGST</td>
        <td style="text-align:right;">${fmtMoney(totals.totalCgst)}</td>
      </tr>
      <tr>
        <td>IGST</td>
        <td style="text-align:right;">${fmtMoney(totals.totalIgst)}</td>
      </tr>
      <tr class="blue-tint-row">
        <td>Total Tax Amount</td>
        <td style="text-align:right;">${fmtMoney(totals.totalSgst + totals.totalCgst + totals.totalIgst)}</td>
      </tr>
      <tr class="grand-final-row">
        <td>Total Amount after Tax</td>
        <td style="text-align:right;">${fmtMoney(totals.totalAll)}</td>
      </tr>
    </table>
  </div>

  <!-- FOOTER: TERMS / SEAL / SIGNATURE -->
  <div class="footer-declaration-grid">
    <div class="terms-block">
      <div class="terms-block-heading">${IC_FILE} TERMS &amp; CONDITIONS</div>
      <ol>
        <li>Subject to Vadodara Jurisdiction.</li>
        <li>Payment Terms as per our agreed terms.</li>
        <li>Interest will charged @ 24% per annum if amount remaining unpaid from due date.</li>
      </ol>
    </div>

    <div class="seal-block">
      <div class="seal-circle-placeholder">${IC_CHECK}</div>
      <div class="seal-line-decor"></div>
      <div>Seal</div>
    </div>

    <div class="sign-block">
      <div class="sign-certify-txt">Certified that the particulars given above are true and correct.</div>
      <div class="sign-company-lbl">For ${esc(profile.companyName.toUpperCase())}</div>
      <div class="sign-hr-line"></div>
      <div class="sign-title-lbl">Authorised Signatory</div>
    </div>
  </div>

</div>`;
};

export const renderTaxInvoicePdf = async (data, { mode = 'save' } = {}) => {
  const html = buildTaxInvoiceHtml(data, data.companyProfile);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const target = host.querySelector('.invoice-card');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fff',
      width: 760,
      windowWidth: 760
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH);
    } else {
      const scale = pageH / imgH;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW * scale, pageH);
    }

    const docNo = data.invoiceNo || 'N/A';
    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `TI_${docNo}`;
    } else {
      pdf.save(`TI_${docNo}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
