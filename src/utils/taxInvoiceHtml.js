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

  .gstin {
      font-weight: bold;
      color: var(--blue-dark);
      margin-top: 6px;
      font-size: 12px;
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

  /* --- TITLE --- */
  .title-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin: 15px 0;
  }

  .title-line {
      height: 2px;
      width: 35px;
      background-color: var(--green-main);
  }

  .invoice-title {
      color: var(--blue-dark);
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 1px;
  }

  /* --- DETAILS GRID --- */
  .details-grid {
      display: grid;
      grid-template-columns: 18% 32% 18% 32%;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 15px;
  }

  .grid-item {
      padding: 6px 10px;
      border-right: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
  }

  .grid-item.label {
      color: var(--blue-dark);
      font-weight: bold;
  }

  .details-grid .grid-item:nth-child(4n) {
      border-right: none;
  }

  .details-grid .grid-item:nth-last-child(-n+4) {
      border-bottom: none;
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
      background-color: var(--green-main);
      color: #fff;
      font-weight: bold;
      text-align: left !important;
      padding-left: 15px !important;
      border-color: var(--green-main) !important;
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
      background-color: var(--green-main);
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
  const contact = getTiContactLine(profile);
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

  return `
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>${TI_STYLES}</style>
<div class="invoice-container">
    <!-- Header -->
    <div class="header">
        <div class="logo-section">${logoHtml}</div>
        
        <div class="company-info">
            <div class="company-name">${esc(profile.companyName)}</div>
            <div class="info-line">
                <i class="fas fa-map-marker-alt"></i>
                <div>${esc(addressLines[0] || '')},<br>${esc(addressLines[1] || '')}</div>
            </div>
            <div class="info-line-multiple">
                <div class="info-line">
                    <i class="fas fa-phone-alt"></i>
                    <span>${esc(profile.phone || DEFAULT_COMPANY_PROFILE.phone)}</span>
                </div>
                <div class="info-line">
                    <i class="fas fa-envelope"></i>
                    <span>${esc(profile.email || DEFAULT_COMPANY_PROFILE.email)}</span>
                </div>
            </div>
            <div class="gstin">GSTIN: ${esc(profile.gstNumber)}</div>
        </div>

        <div class="copy-type">
            ORIGINAL<br>DUPLICATE
        </div>
    </div>

    <div class="header-border"></div>

    <!-- Title -->
    <div class="title-wrapper">
        <div class="title-line"></div>
        <div class="invoice-title">TAX INVOICE</div>
        <div class="title-line"></div>
    </div>

    <!-- Details Grid -->
    <div class="details-grid">
        <div class="grid-item label">Invoice No.</div>
        <div class="grid-item">${docNo}</div>
        <div class="grid-item label">Invoice Date</div>
        <div class="grid-item">${docDate}</div>
        
        <div class="grid-item label">Delivery Challan No.</div>
        <div class="grid-item">${dcNo}</div>
        <div class="grid-item label">Date</div>
        <div class="grid-item">${dcDate}</div>
        
        <div class="grid-item label">State</div>
        <div class="grid-item">${companyState}</div>
        <div class="grid-item label">PO No./Challan No.</div>
        <div class="grid-item">${refNo}</div>
        
        <div class="grid-item label">Code</div>
        <div class="grid-item">${companyStateCode}</div>
        <div class="grid-item label">Date</div>
        <div class="grid-item">${refDate}</div>
    </div>

    <!-- Parties Section -->
    <div class="parties-wrapper">
        <!-- Bill To -->
        <div class="party-box">
            <div class="party-header">
                <i class="fas fa-users"></i> BILL TO PARTY
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
                <i class="fas fa-truck"></i> SHIP TO PARTY
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
                <i class="fas fa-university"></i> OUR BANK DETAILS
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
                <i class="fas fa-file-alt"></i> TERMS & CONDITIONS
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
            <i class="fas fa-stamp"></i>
            <div>Seal</div>
        </div>

        <div class="sign-box">
            <div class="party-header">
                <i class="fas fa-pen-nib"></i> FOR ${esc(profile.companyName.toUpperCase())}
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
