import { mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  TI_EMPTY_ROWS,
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

export const buildTaxInvoiceHtml = (data, profileInput) => {
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

  const MIN_ROWS = 7;
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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tax Invoice - ${escHtml(profile.companyName)}</title>
    <!-- Importing Bootstrap Icons for the exact icon matches -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        :root {
            --primary-purple: #4C1D95;
            --brand-green: #15803D;
            --light-purple-bg: #F5EEFD;
            --border-purple: #C0A9E2;
            --grid-line-purple: #E2D7F3;
            --text-black: #000000;
            --text-muted: #333333;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
        }

        body {
            background-color: #ffffff;
            color: var(--text-black);
            font-size: 11px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .print-host {
            width: 794px;
            margin: 0;
            padding: 0;
            background: #ffffff;
        }

        .pdf-page {
            width: 794px;
            min-height: 1123px;
            padding: 12px;
            box-sizing: border-box;
            background: #ffffff;
        }

        .invoice-box {
            width: 100%;
            height: 100%;
            min-height: 1099px;
            border: 2.5px solid var(--primary-purple);
            padding: 12px;
            display: flex;
            flex-direction: column;
        }

        /* Top Header Logo section */
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2.5px solid var(--primary-purple);
            padding-bottom: 6px;
        }

        .logo-container {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        /* Recreating the stylized U-M brand identity look */
        .logo-graphic {
            border: 2px solid var(--brand-green);
            border-radius: 50%;
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .logo-graphic::before {
            content: '';
            position: absolute;
            width: 40px;
            height: 40px;
            border: 2px solid var(--primary-purple);
            border-radius: 50%;
        }
        .logo-graphic span {
            font-size: 24px;
            font-weight: bold;
            color: var(--primary-purple);
            z-index: 1;
            font-family: 'Times New Roman', Times, serif;
        }

        .logo-text h1 {
            font-size: 38px;
            font-weight: 900;
            color: var(--primary-purple);
            line-height: 1;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .logo-text p {
            font-size: 18px;
            font-weight: bold;
            color: var(--brand-green);
            margin-top: 2px;
            letter-spacing: 0.2px;
        }

        .tax-invoice-badge {
            background-color: var(--primary-purple);
            color: #ffffff;
            text-align: center;
            padding: 6px 14px;
            border-radius: 6px;
            min-width: 210px;
        }
        .tax-invoice-badge h2 {
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .tax-invoice-badge div {
            background-color: #ffffff;
            color: var(--primary-purple);
            font-size: 9px;
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 3px;
            display: inline-block;
            margin-top: 4px;
        }

        /* Vendor and Document Info Metadata Strip */
        .meta-strip {
            display: flex;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1.5px solid var(--primary-purple);
        }
        .meta-strip > .meta-col:nth-child(1) { flex: 1.15; }
        .meta-strip > .meta-col:nth-child(2) { flex: 0.85; }
        .meta-strip > .meta-col:nth-child(3) { flex: 1; }

        .meta-col {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .meta-col.border-left {
            border-left: 1px solid var(--border-purple);
            padding-left: 12px;
        }

        .icon-line {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            line-height: 1.3;
        }
        .icon-line i {
            color: var(--primary-purple);
            font-size: 12px;
            margin-top: 1px;
        }

        .data-row {
            display: flex;
            font-size: 11px;
        }
        .data-label {
            font-weight: bold;
            width: 85px;
        }
        .data-label-short {
            font-weight: bold;
            width: 45px;
        }
        .data-value {
            flex: 1;
        }

        /* Bill To / Ship To Cards Layout */
        .billing-container {
            display: flex;
            gap: 12px;
            margin-top: 8px;
        }

        .bill-card {
            flex: 1;
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .card-title {
            background-color: var(--light-purple-bg);
            color: var(--primary-purple);
            font-weight: bold;
            font-size: 11px;
            padding: 5px 8px;
            border-bottom: 1.5px solid var(--border-purple);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .card-body {
            padding: 8px;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
            line-height: 1.35;
        }
        .client-title {
            font-weight: bold;
            color: var(--primary-purple);
            font-size: 11px;
            margin-bottom: 2px;
        }

        .card-footer-data {
            margin-top: auto;
            border-top: 1px solid var(--grid-line-purple);
            padding-top: 4px;
        }

        /* Items Ledger Table Design */
        .table-container {
            margin-top: 10px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }

        .invoice-table {
            width: 100%;
            border-collapse: collapse;
        }

        .invoice-table th {
            background-color: var(--primary-purple);
            color: #ffffff;
            font-weight: normal;
            font-size: 10px;
            padding: 6px 3px;
            border: 1px solid var(--border-purple);
            text-align: center;
        }

        .invoice-table td {
            border: 1px solid var(--grid-line-purple);
            border-left: 1px solid var(--border-purple);
            border-right: 1px solid var(--border-purple);
            padding: 5px 4px;
            font-size: 11px;
            text-align: right;
            height: 26px;
        }

        .invoice-table td.center { text-align: center; }
        .invoice-table td.left { text-align: left; }

        /* Creates empty table height space to match template style */
        .invoice-table tr.filler-row td {
            height: 28px;
        }

        .invoice-table tr.total-row td {
            font-weight: bold;
            background-color: var(--light-purple-bg);
            border-top: 1.5px solid var(--primary-purple);
            border-bottom: 1.5px solid var(--primary-purple);
            height: 26px;
        }

        /* Bottom Financial Summary Breakdown blocks */
        .bottom-summary-grid {
            display: flex;
            gap: 12px;
            margin-top: 10px;
        }
        .bottom-summary-grid > div:nth-child(1) { flex: 1.15; }
        .bottom-summary-grid > div:nth-child(2) { flex: 0.85; }

        .bank-details-box {
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            padding: 8px;
        }
        .box-heading {
            color: var(--primary-purple);
            font-weight: bold;
            font-size: 11px;
            border-bottom: 1px solid var(--border-purple);
            padding-bottom: 3px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .totals-box {
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .charge-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 8px;
            font-size: 11px;
        }
        .charge-row.bold {
            font-weight: bold;
        }

        .grand-total-banner {
            background-color: var(--primary-purple);
            color: #ffffff;
            font-weight: bold;
            font-size: 14px;
            padding: 6px 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* Footer Conditions and Sign-off Area */
        .footer-terms-container {
            display: flex;
            gap: 12px;
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            margin-top: 10px;
            padding: 8px;
        }
        .footer-terms-container > .terms-column:nth-child(1) { flex: 1.1; }
        .footer-terms-container > .terms-column:nth-child(2) { flex: 0.9; }
        .footer-terms-container > .terms-column:nth-child(3) { flex: 1; }

        .terms-column {
            font-size: 10px;
            line-height: 1.3;
        }
        .terms-column ol {
            padding-left: 14px;
            margin-top: 2px;
        }
        .terms-column ol li {
            margin-bottom: 2px;
        }

        .signature-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            height: 100%;
        }
        .signature-space {
            width: 80%;
            border-bottom: 1px solid #777777;
            margin-top: 45px;
            margin-bottom: 3px;
        }

        /* Sticky Bottom Disclaimer Bar */
        .bottom-status-bar {
            background-color: var(--primary-purple);
            color: #ffffff;
            display: flex;
            justify-content: space-between;
            padding: 4px 8px;
            margin-top: 10px;
            font-size: 9.5px;
            border-radius: 3px;
        }
    </style>
</head>
<body>

<div class="print-host">
<div class="pdf-page">
<div class="invoice-box">
    
    <!-- Top Header Area -->
    <div class="header-top">
        <div class="logo-container">
            <div class="logo-graphic">
                <span>M</span>
            </div>
            <div class="logo-text">
                <h1>${escHtml(profile.companyName || 'UMA MICRON')}</h1>
                <p>Micronization of API's</p>
            </div>
        </div>
        <div class="tax-invoice-badge">
            <h2>TAX INVOICE</h2>
            <div>ORIGINAL FOR RECIPIENT</div>
        </div>
    </div>

    <!-- Info Metadata Strip -->
    <div class="meta-strip">
        <div class="meta-col">
            <div class="icon-line">
                <i class="bi bi-geo-alt-fill"></i>
                <div>
                    <strong>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')}</strong><br>
                    ${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')},<br>${escHtml(companyState)}, India
                </div>
            </div>
            <div class="icon-line"><i class="bi bi-telephone-fill"></i><div>${escHtml(profile.phone || '+91 97120 00297')}</div></div>
            <div class="icon-line"><i class="bi bi-envelope-fill"></i><div>${escHtml(profile.email || 'umamicron@gmail.com')}</div></div>
            <div class="icon-line"><i class="bi bi-globe"></i><div>${escHtml(profile.website || 'www.umamicron.com')}</div></div>
        </div>
        
        <div class="meta-col" style="padding-left: 5px;">
            <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${escHtml(profile.gstNumber || '')}</div></div>
            <div class="data-row"><div class="data-label-short">PAN</div><div class="data-value">: &nbsp;${escHtml(companyPan)}</div></div>
            <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${escHtml(companyState)}</div></div>
        </div>
        
        <div class="meta-col border-left">
            <div class="data-row"><div class="data-label"><i class="bi bi-file-earmark-text"></i> Invoice No.</div><div class="data-value">: &nbsp;${docNo}</div></div>
            <div class="data-row"><div class="data-label"><i class="bi bi-calendar3"></i> Invoice Date</div><div class="data-value">: &nbsp;${docDate}</div></div>
            <div class="data-row" style="margin-top: 5px;"><div class="data-label"><i class="bi bi-file-earmark-text"></i> PO No.</div><div class="data-value">: &nbsp;${poNo}</div></div>
            <div class="data-row"><div class="data-label" style="padding-left: 16px;">PO Date</div><div class="data-value">: &nbsp;${poDate}</div></div>
            <div class="data-row"><div class="data-label" style="padding-left: 16px;">Delivery Challan No.</div><div class="data-value">: &nbsp;${dcNo}</div></div>
            <div class="data-row"><div class="data-label" style="padding-left: 16px;">DC Date</div><div class="data-value">: &nbsp;${dcDate}</div></div>
        </div>
    </div>

    <!-- Bill To / Ship To Container -->
    <div class="billing-container">
        <!-- Bill To Section -->
        <div class="bill-card">
            <div class="card-title"><i class="bi bi-person-circle"></i> BILL TO</div>
            <div class="card-body">
                <div class="client-title">${escHtml(billName)}</div>
                ${billAddr.map(line => \`<div>\${escHtml(line)}</div>\`).join('')}
                <div class="card-footer-data">
                    <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${escHtml(billGstin)}</div></div>
                    <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${escHtml(billState)} ${billStateCode ? \`(\${escHtml(billStateCode)})\` : ''}</div></div>
                </div>
            </div>
        </div>
        
        <!-- Ship To Section -->
        <div class="bill-card">
            <div class="card-title"><i class="bi bi-truck"></i> SHIP TO</div>
            <div class="card-body">
                <div class="client-title">${escHtml(shipName)}</div>
                ${shipAddr.map(line => \`<div>\${escHtml(line)}</div>\`).join('')}
                <div class="card-footer-data">
                    <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${escHtml(shipGstin)}</div></div>
                    <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${escHtml(shipState)} ${shipStateCode ? \`(\${escHtml(shipStateCode)})\` : ''}</div></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Items Grid Table Ledger -->
    <div class="table-container">
        <table class="invoice-table">
            <thead>
                <tr>
                    <th style="width: 5%;">Sr. No.</th>
                    <th style="width: 27%;">Description</th>
                    <th style="width: 10%;">HSN / SAC</th>
                    <th style="width: 6%;">Qty.</th>
                    <th style="width: 10%;">Rate (₹)</th>
                    <th style="width: 10%;">Amount (₹)</th>
                    <th style="width: 7%;">CGST (₹)</th>
                    <th style="width: 7%;">SGST (₹)</th>
                    <th style="width: 6%;">IGST (₹)</th>
                    <th style="width: 12%;">Total Amount (₹)</th>
                </tr>
            </thead>
            <tbody>
                ${rows.join('')}
            </tbody>
        </table>
    </div>

    <!-- Bottom Financial Block Summary Box Grid -->
    <div class="bottom-summary-grid">
        <!-- Bank Accounts Card -->
        <div class="bank-details-box">
            <div class="box-heading"><i class="bi bi-bank"></i> OUR BANK DETAILS</div>
            <div class="data-row"><div class="data-label" style="width:100px;">Bank Name</div><div class="data-value">: &nbsp;${escHtml(profile.bankName || '')}</div></div>
            <div class="data-row"><div class="data-label" style="width:100px;">A/c Name</div><div class="data-value">: &nbsp;${escHtml(profile.accountName || profile.companyName || '')}</div></div>
            <div class="data-row"><div class="data-label" style="width:100px;">Current A/c No.</div><div class="data-value">: &nbsp;${escHtml(profile.accountNumber || '')}</div></div>
            <div class="data-row"><div class="data-label" style="width:100px;">IFS CODE</div><div class="data-value">: &nbsp;${escHtml(profile.ifscCode || '')}</div></div>
            <div class="data-row"><div class="data-label" style="width:100px;">Branch</div><div class="data-value">: &nbsp;${escHtml(profile.branch || '')}</div></div>
        </div>
        
        <!-- Totals & Taxes Accounting Calculations Box -->
        <div class="totals-box">
            <div>
                <div class="charge-row"><span>Total Amount Before Tax</span><span>₹ &nbsp;${fmtMoney(totalAmt)}</span></div>
                <div class="charge-row"><span>Add : CGST @ 9%</span><span>₹ &nbsp;${fmtMoney(totalCgst)}</span></div>
                <div class="charge-row"><span>Add : SGST @ 9%</span><span>₹ &nbsp;${fmtMoney(totalSgst)}</span></div>
                <div class="charge-row"><span>Add : IGST @ 18%</span><span>₹ &nbsp;${fmtMoney(totalIgst)}</span></div>
                <div class="charge-row bold" style="border-top: 1px solid #ddd; padding-top:4px;"><span>Total Tax Amount</span><span>₹ &nbsp;${fmtMoney(totalCgst + totalSgst + totalIgst)}</span></div>
                <div class="charge-row"><span>Round Off</span><span>₹ &nbsp;${fmtMoney(roundOff)}</span></div>
            </div>
            <div class="grand-total-banner">
                <span>GRAND TOTAL</span>
                <span>₹ ${fmtMoney(roundedTotal)}</span>
            </div>
        </div>
    </div>

    <!-- Footnotes Legal Terms & Sign-off Layout Box -->
    <div class="footer-terms-container">
        <div class="terms-column">
            <div class="box-heading" style="margin-bottom:4px;"><i class="bi bi-card-checklist"></i> TERMS & CONDITIONS</div>
            <ol>
                <li>Subject to Vadodara Jurisdiction.</li>
                <li>Payment terms as per our agreed terms.</li>
                <li>Interest will be charged @ 24% p.a. if the amount remains unpaid from the due date.</li>
            </ol>
        </div>
        <div class="terms-column" style="border-left: 1px solid var(--border-purple); padding-left: 10px;">
            <div class="box-heading" style="margin-bottom:4px;"><i class="bi bi-shield-check"></i> DECLARATION</div>
            <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
        </div>
        <div class="terms-column">
            <div class="signature-column">
                <span style="font-weight: bold; color: var(--primary-purple); font-size: 11px;">For ${escHtml(profile.companyName || 'UMA MICRON')}</span>
                <div class="signature-space"></div>
                <span style="font-size: 10px; color: #333;">Authorised Signatory</span>
            </div>
        </div>
    </div>

    <!-- System Generated Footer Notification Strip Bar -->
    <div class="bottom-status-bar">
        <span>Thank you for your business!</span>
        <span>E. & O.E.</span>
        <span>This is a computer generated invoice.</span>
        <span>Page 1 of 1</span>
    </div>

</div>
</div>
</div>

</body>
</html>`;
};

export const renderTaxInvoicePdf = async (data, { mode = 'save' } = {}) => {
  const html = buildTaxInvoiceHtml(data, data.companyProfile);
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
      if (win) win.document.title = \`TI_\${data.invoiceNo || 'N/A'}\`;
    } else {
      pdf.save(\`TI_\${data.invoiceNo || 'N/A'}.pdf\`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
