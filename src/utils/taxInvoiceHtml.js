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

const DEFAULT_TI_LOGO_HTML = `
<svg width="80" height="80" viewBox="0 0 100 100">
    <ellipse cx="50" cy="50" rx="45" ry="30" fill="none" stroke="#28a745" stroke-width="3" transform="rotate(-30 50 50)"></ellipse>
    <ellipse cx="50" cy="50" rx="45" ry="30" fill="none" stroke="#28a745" stroke-width="3" transform="rotate(30 50 50)"></ellipse>
    <text x="50%" y="62%" font-family="Times New Roman, serif" font-size="45" font-weight="bold" fill="#dc3545" text-anchor="middle" letter-spacing="-2">UM</text>
</svg>`;

const TI_STYLES = `
  :root {
      --blue-dark: #002d6b;
      --blue-light: #e6ebf5;
      --green-main: #5ea830;
      --border-color: #b0c0d0;
      --text-dark: #333;
  }

  * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
  }

  body {
      background-color: #e0e0e0;
      display: flex;
      justify-content: center;
      padding: 20px;
  }

  .invoice-container {
      background-color: #fff;
      width: 800px;
      padding: 25px;
      box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
      border: 2px solid var(--text-dark);
      color: var(--text-dark);
      font-size: 11.5px;
      position: relative;
  }

  /* --- HEADER SECTION --- */
  .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 5px;
  }

  .logo-section {
      width: 15%;
      display: flex;
      justify-content: center;
      align-items: center;
  }

  .logo-section img {
      max-width: 80px;
      max-height: 80px;
      object-fit: contain;
  }

  .company-info {
      width: 65%;
  }

  .company-name {
      color: var(--blue-dark);
      font-size: 26px;
      font-weight: bold;
      margin-bottom: 6px;
  }

  .info-line {
      display: flex;
      align-items: flex-start;
      margin-bottom: 4px;
      gap: 8px;
  }
  
  .info-line-multiple {
      display: flex;
      gap: 20px;
      margin-bottom: 4px;
  }

  .info-line i {
      color: var(--blue-dark);
      margin-top: 2px;
      width: 12px;
  }

  .gstin-badge {
      display: inline-block;
      background-color: var(--blue-dark);
      color: #fff;
      font-weight: bold;
      font-size: 11.5px;
      padding: 4px 10px;
      border-radius: 4px;
      margin-top: 6px;
      letter-spacing: 0.5px;
  }

  .copy-type {
      background-color: var(--blue-dark);
      color: #fff;
      padding: 10px 15px;
      font-weight: bold;
      text-align: center;
      line-height: 1.4;
      clip-path: polygon(15% 0, 100% 0, 100% 100%, 0% 100%);
      width: 130px;
      font-size: 11px;
      margin-top: -25px;
      margin-right: -25px;
  }

  .header-border {
      border-top: 2px solid var(--blue-dark);
      margin: 10px 0;
  }

  /* --- TITLE BANNER --- */
  .title-banner {
      background-color: var(--blue-dark);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      margin-bottom: 14px;
      border-radius: 0;
  }

  .title-banner-text {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 2px;
  }

  .title-banner-icon {
      display: flex;
      align-items: center;
      gap: 6px;
  }

  /* --- DETAILS GRID --- */
  .details-grid {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 15px;
      width: 100%;
      border-collapse: collapse;
  }

  .details-grid td {
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      vertical-align: middle;
  }

  .details-grid .label {
      color: var(--blue-dark);
      font-weight: bold;
      white-space: nowrap;
  }

  .details-grid .state-row td {
      padding: 6px 10px;
  }

  /* --- PARTIES SECTION --- */
  .parties-wrapper {
      display: flex;
      gap: 12px;
      margin-bottom: 15px;
  }

  .party-box {
      flex: 1;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
  }

  .party-header {
      background-color: var(--blue-dark);
      color: #fff;
      padding: 7px 10px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 8px;
  }

  .party-body {
      padding: 10px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
  }

  .party-row {
      display: flex;
      align-items: flex-end;
  }

  .party-label {
      color: var(--blue-dark);
      font-weight: bold;
      min-width: 65px;
      margin-bottom: -2px;
  }

  .dotted-line {
      flex: 1;
      border-bottom: 1px dotted #999;
      height: 15px;
  }

  .code-box {
      border: 1px solid var(--border-color);
      width: 45px;
      height: 18px;
      border-radius: 3px;
  }

  /* --- MAIN TABLE --- */
  .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border-color);
      margin-bottom: 15px;
      border-radius: 6px;
      overflow: hidden;
      table-layout: fixed;
  }

  .items-table th, .items-table td {
      border: 1px solid var(--border-color);
      padding: 6px 5px;
      text-align: center;
  }

  .items-table th {
      background-color: var(--blue-dark);
      color: #fff;
      font-weight: normal;
      font-size: 11px;
  }
  
  .items-table .bold-th {
      font-weight: bold;
  }

  .items-table td {
      color: var(--text-dark);
  }

  .items-table td:nth-child(2) {
      text-align: left; /* Description left aligned */
  }
  
  .items-table tr.total-row td {
      font-weight: bold;
  }

  .total-label {
      background-color: var(--blue-dark);
      color: #fff;
      font-weight: bold;
      text-align: right !important;
      padding-right: 10px !important;
      border-color: var(--blue-dark) !important;
  }

  /* --- FOOTER SECTIONS --- */
  .footer-top {
      display: flex;
      gap: 12px;
      margin-bottom: 15px;
  }

  .bank-details {
      flex: 6;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
  }

  .bank-body {
      padding: 8px 10px;
  }

  .bank-row {
      display: flex;
      margin-bottom: 4px;
  }

  .bank-label {
      color: var(--blue-dark);
      font-weight: bold;
      width: 110px;
  }

  .bank-value {
      color: var(--text-dark);
  }

  .summary-table-wrapper {
      flex: 4;
  }

  .summary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      border-style: hidden; /* Hide outer border to use wrapper's */
      box-shadow: 0 0 0 1px var(--border-color);
  }

  .summary-table td {
      border: 1px solid var(--border-color);
      padding: 6px 10px;
  }

  .summary-label {
      color: var(--blue-dark);
      font-weight: bold;
      width: 70%;
  }

  .summary-value {
      text-align: right;
      width: 30%;
  }

  .summary-tax-amount {
      color: var(--blue-dark);
      font-weight: bold;
  }

  .summary-total-final {
      background-color: var(--blue-dark);
      color: #fff !important;
      font-weight: bold;
  }
  .summary-total-final td {
      color: #fff;
  }

  .footer-bottom {
      display: flex;
      gap: 12px;
  }

  .terms-box {
      flex: 5;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
  }

  .terms-body {
      padding: 10px 10px 10px 25px;
  }

  .terms-body ol {
      margin: 0;
      padding: 0;
      color: var(--text-dark);
  }

  .terms-body li {
      margin-bottom: 4px;
  }

  .seal-box {
      flex: 2;
      border: 1px dashed var(--border-color);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--blue-dark);
      font-weight: bold;
      gap: 5px;
  }

  .seal-box i {
      color: var(--green-main);
      font-size: 24px;
  }

  .sign-box {
      flex: 4;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
  }

  .sign-top-text {
      padding: 8px 10px 4px 10px;
      color: var(--text-dark);
      font-size: 10.5px;
      text-align: center;
  }

  .sign-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 10px;
      text-align: center;
  }

  .sign-text {
      border-top: 1px solid var(--blue-dark);
      padding-top: 5px;
      color: var(--blue-dark);
      font-weight: bold;
      width: 90%;
      margin: 0 auto;
  }
`;

const formatPartyAddressDivs = (address, defaultLines = 3) => {
  const lines = splitPartyAddressLines(address, 45);
  const divs = [];
  for (let i = 0; i < Math.max(lines.length, defaultLines); i++) {
    divs.push(`
      <div class="party-row">
        <div class="party-label">${i === 0 ? 'Address :' : ''}</div>
        <div class="dotted-line" style="padding-left: 5px; font-weight: bold; color: var(--text-dark);">${esc(lines[i] || '')}</div>
      </div>`);
  }
  return divs.join('');
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
      <tr>
        <td><b>${sr}</b></td>
        <td>${esc(label)}</td>
        <td>${esc(fmtQty(qty))}</td>
        <td>${rate ? esc(parseFloat(rate).toFixed(2)) : '0.00'}</td>
        <td>${fmtMoney(amt)}</td>
        <td>${sgstRate}%</td>
        <td>${fmtMoney(sgstAmt)}</td>
        <td>${cgstRate}%</td>
        <td>${fmtMoney(cgstAmt)}</td>
        <td>0%</td>
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

  // Pad empty rows to have at least 10 rows total
  const minRows = 10;
  while (sr < minRows) {
    sr += 1;
    rows.push(`
      <tr>
        <td><b>${sr}</b></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`);
  }

  // Totals Row
  rows.push(`
    <tr class="total-row">
      <td colspan="2" class="total-label">TOTAL</td>
      <td>${totalQty || 0}</td>
      <td></td>
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
    ? `<img src="${logoSrc}" alt="UMA MICRON Logo">`
    : DEFAULT_TI_LOGO_HTML;

  const docNo = esc(data.invoiceNo || 'N/A');
  const docDate = esc(formatPdfDateSlash(data.date) || 'N/A');
  const refNo = esc(data.partyDocNo || data.challanNo || '');
  const refDate = esc(formatPdfDateSlash(data.partyDocDate) || '');
  const dcNo = esc(data.dcNo || '');
  const dcDate = esc(formatPdfDateSlash(data.dcDate) || data.dcDate || '');

  const companyState = esc(profile.state || 'GUJARAT');
  const companyStateCode = esc('24');

  const { rowsHtml, totals } = buildItemRowsHtml(data);

  // Inline SVG icons — identical appearance to Font Awesome, but render in html2canvas without CDN
  const IC_MAP_MARKER = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 384 512" style="fill:#002d6b;flex-shrink:0;margin-top:2px;"><path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/></svg>`;
  const IC_PHONE = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 512 512" style="fill:#002d6b;flex-shrink:0;margin-top:2px;"><path d="M493.4 24.6l-104-24c-11.3-2.6-22.9 3.3-27.5 13.9l-48 112c-4.2 9.8-1.4 21.3 6.9 28l60.6 49.6c-36 76.7-98.9 140.5-177.2 177.2l-49.6-60.6c-6.8-8.3-18.2-11.1-28-6.9l-112 48C3.9 366.5-2 378.1.6 389.4l24 104C27.1 504.2 36.7 512 48 512c256.1 0 464-207.5 464-464 0-11.2-7.7-20.9-18.6-23.4z"/></svg>`;
  const IC_ENVELOPE = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 512 512" style="fill:#002d6b;flex-shrink:0;margin-top:2px;"><path d="M502.3 190.8c3.9-3.1 9.7-.2 9.7 4.7V400c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V195.6c0-5 5.7-7.8 9.7-4.7 22.4 17.4 52.1 39.5 154.1 113.6 21.1 15.4 56.7 47.8 92.2 47.6 35.7.3 72-32.8 92.3-47.6 102-74.1 131.6-96.3 154-113.7zM256 320c23.2.4 56.6-29.2 73.4-41.4 132.7-96.3 142.8-104.7 173.4-128.7 5.8-4.5 9.2-11.5 9.2-18.9v-19c0-26.5-21.5-48-48-48H48C21.5 64 0 85.5 0 112v19c0 7.4 3.4 14.3 9.2 18.9 30.6 23.9 40.7 32.4 173.4 128.7 16.8 12.2 50.2 41.8 73.4 41.4z"/></svg>`;
  const IC_USERS = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 640 512" style="fill:#fff;flex-shrink:0;"><path d="M96 224c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm448 0c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm32 32h-64c-17.6 0-33.5 7.1-45.1 18.6 40.3 22.1 68.9 62 75.1 109.4h66c17.7 0 32-14.3 32-32v-32c0-35.3-28.7-64-64-64zm-256 0c61.9 0 112-50.1 112-112S381.9 32 320 32 208 82.1 208 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C179.6 288 128 339.6 128 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zm-223.7-13.4C161.5 263.1 145.6 256 128 256H64c-35.3 0-64 28.7-64 64v32c0 17.7 14.3 32 32 32h65.9c6.3-47.4 34.9-87.3 75.2-109.4z"/></svg>`;
  const IC_TRUCK = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 640 512" style="fill:#fff;flex-shrink:0;"><path d="M624 352h-16V243.9c0-12.7-5.1-24.9-14.1-33.9L494 110.1c-9-9-21.2-14.1-33.9-14.1H416V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48v320c0 26.5 21.5 48 48 48h16c0 53 43 96 96 96s96-43 96-96h128c0 53 43 96 96 96s96-43 96-96h48c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16zM160 464c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm320 0c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm80-208H416V144h44.1l99.9 99.9V256z"/></svg>`;
  const IC_UNIVERSITY = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 512 512" style="fill:#fff;flex-shrink:0;"><path d="M496 128v16a8 8 0 0 1-8 8h-24v12c0 6.627-5.373 12-12 12H60c-6.627 0-12-5.373-12-12v-12H24a8 8 0 0 1-8-8v-16a8 8 0 0 1 4.941-7.392l232-88a7.996 7.996 0 0 1 6.118 0l232 88A8 8 0 0 1 496 128zm-24 304H40c-13.255 0-24 10.745-24 24v16a8 8 0 0 0 8 8h480a8 8 0 0 0 8-8v-16c0-13.255-10.745-24-24-24zM96 192v192H60c-6.627 0-12 5.373-12 12v20h416v-20c0-6.627-5.373-12-12-12h-36V192h-64v192h-64V192h-64v192h-64V192H96z"/></svg>`;
  const IC_FILE_ALT = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 384 512" style="fill:#fff;flex-shrink:0;"><path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm64 236c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8zm0-64c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8zm0-72v8c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12zm96-153.1L305.1 32c-4.5-4.5-10.6-7-17-7H272v128h128v-17.1c0-6.3-2.5-12.4-7-16.9z"/></svg>`;
  const IC_STAMP = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" style="fill:#5ea830;"><path d="M497.941 395.716l-75.313-75.313A64 64 0 0 0 377.373 304H264V248c39.776 0 72-32.224 72-72v-24c0-12.853-10.675-24-24-24H200c-13.325 0-24 11.147-24 24v24c0 39.776 32.224 72 72 72v56H211.98c-20.937 0-40.01 7.914-54.612 22.515l-75.26 75.26C51.98 421.808 32 459.671 32 496c0 8.837 7.163 16 16 16h416c8.837 0 16-7.163 16-16 0-36.329-19.98-74.192-48.059-100.284zM48.013 208H24c-13.255 0-24 10.745-24 24v40c0 13.255 10.745 24 24 24h24.013C64 282.507 80 256 80 256s-16-26.507-31.987-48zm415.974 0H440c-16 21.493-32 48-32 48s16 26.507 32 48h23.987c13.255 0 24-10.745 24-24v-40c0-13.255-10.745-24-24-24zM256 0c-61.856 0-112 50.144-112 112h224C368 50.144 317.856 0 256 0z"/></svg>`;
  const IC_PEN_NIB = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 512 512" style="fill:#fff;flex-shrink:0;"><path d="M373.888 168.112c-7.493-7.493-17.443-11.718-28.028-11.718H320V96c0-17.673-14.327-32-32-32h-64c-17.673 0-32 14.327-32 32v64h-25.86c-10.585 0-20.535 4.225-28.028 11.718L16 320h480L373.888 168.112zM256 336c-8.837 0-16-7.163-16-16s7.163-16 16-16 16 7.163 16 16-7.163 16-16 16zM0 384v48c0 8.837 7.163 16 16 16h480c8.837 0 16-7.163 16-16v-48H0z"/></svg>`;

  // Rupee/invoice SVG icon for the title banner
  const IC_RUPEE_INVOICE = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 64" style="fill:#fff;flex-shrink:0;"><rect x="2" y="2" width="60" height="60" rx="6" ry="6" fill="none" stroke="#fff" stroke-width="2"/><text x="32" y="44" font-family="Arial, sans-serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#fff">&#8377;</text></svg>`;

  return `
<style>${TI_STYLES}</style>
<div class="invoice-container">
    <!-- Header -->
    <div class="header">
        <div class="logo-section">${logoHtml}</div>
        
        <div class="company-info">
            <div class="company-name">${esc(profile.companyName)}</div>
            <div class="info-line">
                ${IC_MAP_MARKER}
                <div>${esc(addressLines[0] || '')},<br>${esc(addressLines[1] || '')}</div>
            </div>
            <div class="info-line-multiple">
                <div class="info-line">
                    ${IC_PHONE}
                    <span>${esc(profile.phone || DEFAULT_COMPANY_PROFILE.phone)}</span>
                </div>
                <div class="info-line">
                    ${IC_ENVELOPE}
                    <span>${esc(profile.email || DEFAULT_COMPANY_PROFILE.email)}</span>
                </div>
            </div>
            <div class="gstin-badge">GSTIN: ${esc(profile.gstNumber)}</div>
        </div>

        <div class="copy-type">
            ORIGINAL<br>DUPLICATE
        </div>
    </div>

    <div class="header-border"></div>

    <!-- Title Banner -->
    <div class="title-banner">
        <div class="title-banner-text">TAX INVOICE</div>
        <div class="title-banner-icon">
            ${IC_RUPEE_INVOICE}
        </div>
    </div>

    <!-- Details Grid -->
    <table class="details-grid">
        <tr>
            <td class="label" style="width:17%;">Invoice No.</td>
            <td style="width:33%;">${docNo}</td>
            <td class="label" style="width:17%;">Invoice Date</td>
            <td style="width:33%;">${docDate}</td>
        </tr>
        <tr>
            <td class="label">Delivery Challan No.</td>
            <td>${dcNo}</td>
            <td class="label">Date</td>
            <td>${dcDate}</td>
        </tr>
        <tr>
            <td class="label">State</td>
            <td style="display:flex;align-items:center;gap:0;">
                <span style="flex:1;">${companyState}</span>
                <span style="font-weight:bold;color:var(--blue-dark);padding:0 8px;">Code</span>
                <span style="border:1px solid var(--border-color);padding:2px 8px;min-width:28px;text-align:center;font-weight:bold;color:var(--blue-dark);">${companyStateCode}</span>
            </td>
            <td class="label">PO No./Challan No.</td>
            <td>${refNo}</td>
        </tr>
        <tr>
            <td class="label" style="border-bottom:none;"></td>
            <td style="border-bottom:none;"></td>
            <td class="label" style="border-bottom:none;">Date</td>
            <td style="border-bottom:none;">${refDate}</td>
        </tr>
    </table>

    <!-- Parties Section -->
    <div class="parties-wrapper">
        <!-- Bill To -->
        <div class="party-box">
            <div class="party-header">
                ${IC_USERS} BILL TO PARTY
            </div>
            <div class="party-body">
                <div class="party-row">
                    <div class="party-label">Name :</div>
                    <div class="dotted-line" style="padding-left: 5px; font-weight: bold; color: var(--text-dark);">${esc(data.partyName || '')}</div>
                </div>
                ${formatPartyAddressDivs(data.billAddress || data.address || '', 3)}
                <div class="party-row" style="margin-top: 5px;">
                    <div class="party-label">State :</div>
                    <div class="dotted-line" style="padding-left: 5px; font-weight: bold; color: var(--text-dark);">${esc(data.billState || data.state || '')}</div>
                    <div class="party-label" style="min-width: 40px; margin-left: 10px;">Code</div>
                    <div class="code-box" style="display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--blue-dark);">${esc(data.billStateCode || data.stateCode || '')}</div>
                </div>
                <div class="party-row" style="margin-top: 5px;">
                    <div class="party-label">GSTIN :</div>
                    <div class="dotted-line" style="padding-left: 5px; font-weight: bold; color: var(--text-dark);">${esc(data.gstinBill || data.gstin || '')}</div>
                </div>
            </div>
        </div>

        <!-- Ship To -->
        <div class="party-box">
            <div class="party-header">
                ${IC_TRUCK} SHIP TO PARTY
            </div>
            <div class="party-body">
                <div class="party-row">
                    <div class="party-label">Name :</div>
                    <div class="dotted-line" style="padding-left: 5px; font-weight: bold; color: var(--text-dark);">${esc(data.shipName || data.partyName || '')}</div>
                </div>
                ${formatPartyAddressDivs(data.shipAddress || data.address || '', 3)}
                <div class="party-row" style="margin-top: 5px;">
                    <div class="party-label">State :</div>
                    <div class="dotted-line" style="padding-left: 5px; font-weight: bold; color: var(--text-dark);">${esc(data.shipState || data.state || '')}</div>
                    <div class="party-label" style="min-width: 40px; margin-left: 10px;">Code</div>
                    <div class="code-box" style="display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--blue-dark);">${esc(data.shipStateCode || data.stateCode || '')}</div>
                </div>
                <div class="party-row" style="margin-top: 5px;">
                    <div class="party-label">GSTIN :</div>
                    <div class="dotted-line" style="padding-left: 5px; font-weight: bold; color: var(--text-dark);">${esc(data.gstinShip || data.gstin || '')}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Items Table -->
    <table class="items-table">
        <thead>
            <tr>
                <th rowspan="2" class="bold-th" style="width: 4%;">S.<br>No.</th>
                <th rowspan="2" class="bold-th" style="width: 28%;">Description</th>
                <th rowspan="2" class="bold-th" style="width: 5%;">Qty</th>
                <th rowspan="2" class="bold-th" style="width: 7%;">Rate</th>
                <th rowspan="2" class="bold-th" style="width: 8%;">Amount</th>
                <th colspan="2" class="bold-th">SGST</th>
                <th colspan="2" class="bold-th">CGST</th>
                <th colspan="2" class="bold-th">IGST</th>
                <th rowspan="2" class="bold-th" style="width: 8%;">Total</th>
            </tr>
            <tr>
                <th style="width: 5%;">Rate</th>
                <th style="width: 7%;">Amount</th>
                <th style="width: 5%;">Rate</th>
                <th style="width: 7%;">Amount</th>
                <th style="width: 5%;">Rate</th>
                <th style="width: 7%;">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <!-- Footer Top (Bank & Summary) -->
    <div class="footer-top">
        <!-- Bank Details -->
        <div class="bank-details">
            <div class="party-header">
                ${IC_UNIVERSITY} OUR BANK DETAILS
            </div>
            <div class="bank-body">
                <div class="bank-row">
                    <div class="bank-label">Bank Name</div>
                    <div class="bank-value">: AXIS BANK LTD</div>
                </div>
                <div class="bank-row">
                    <div class="bank-label">A/c Name</div>
                    <div class="bank-value">: ${esc(profile.companyName)}</div>
                </div>
                <div class="bank-row">
                    <div class="bank-label">Current A/c No.</div>
                    <div class="bank-value">: 9160200616152671</div>
                </div>
                <div class="bank-row">
                    <div class="bank-label">IFS CODE</div>
                    <div class="bank-value">: UTIB0003083</div>
                </div>
                <div class="bank-row">
                    <div class="bank-label">Branch</div>
                    <div class="bank-value">: Nizampura</div>
                </div>
            </div>
        </div>
        
        <!-- Summary Table -->
        <div class="summary-table-wrapper">
            <table class="summary-table">
                <tr>
                    <td class="summary-label">Total Amount Before Tax</td>
                    <td class="summary-value">${fmtMoney(totals.totalAmt)}</td>
                </tr>
                <tr>
                    <td class="summary-label">SGST</td>
                    <td class="summary-value">${fmtMoney(totals.totalSgst)}</td>
                </tr>
                <tr>
                    <td class="summary-label">CGST</td>
                    <td class="summary-value">${fmtMoney(totals.totalCgst)}</td>
                </tr>
                <tr>
                    <td class="summary-label">IGST</td>
                    <td class="summary-value">${fmtMoney(totals.totalIgst)}</td>
                </tr>
                <tr>
                    <td class="summary-label summary-tax-amount">Total Tax Amount</td>
                    <td class="summary-value summary-tax-amount">${fmtMoney(totals.totalSgst + totals.totalCgst + totals.totalIgst)}</td>
                </tr>
                <tr class="summary-total-final">
                    <td>Total Amount after Tax</td>
                    <td class="summary-value">${fmtMoney(totals.totalAll)}</td>
                </tr>
            </table>
        </div>
    </div>

    <!-- Footer Bottom (Terms, Seal, Signature) -->
    <div class="footer-bottom">
        <div class="terms-box">
            <div class="party-header">
                ${IC_FILE_ALT} TERMS &amp; CONDITIONS
            </div>
            <div class="terms-body">
                <ol>
                    <li>Subject to Vadodara Jurisdiction.</li>
                    <li>Payment Terms as per our agreed terms.</li>
                    <li>Interest will charged @ 24% per annum if amount remaining unpaid from due date.</li>
                </ol>
            </div>
        </div>

        <div class="seal-box">
            ${IC_STAMP}
            <div>Seal</div>
        </div>

        <div class="sign-box">
            <div class="sign-top-text">Certified that the particulars given above are true and correct.</div>
            <div class="party-header" style="justify-content:center;">
                FOR ${esc(profile.companyName.toUpperCase())}
            </div>
            <div class="sign-area">
                <div class="sign-text">Authorised Signatory</div>
            </div>
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
    const target = host.querySelector('.invoice-container');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fff',
      width: 800,
      windowWidth: 800
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
