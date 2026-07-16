import { mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  calcTiTotals,
  formatPdfDateSlash,
  formatPdfDateDmy,
  splitPartyAddressLines
} from './taxInvoiceLayout';
import {
  escHtml,
  fmtMoney,
  fmtQty,
  PRINT_PAGE_W,
  renderHtmlToPdf
} from './printTheme';

const TI_MIN_ROWS = 7; // Adjusted for the new layout

const extractDescAndHsn = (label) => {
  const match = label.match(/(.*?)\s*\((\d+)\)$/);
  if (match) {
    return { desc: match[1].trim(), hsn: match[2] };
  }
  return { desc: label, hsn: '' };
};

const buildItemRowsHtml = (data) => {
  const { chargeAmounts, totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty } = calcTiTotals(data);
  const rows = [];
  let sr = 0;

  const pushRow = (label, qty, rate, amt, sgstRate, cgstRate) => {
    const { desc, hsn } = extractDescAndHsn(label);
    const sgstAmt = amt * (sgstRate / 100);
    const cgstAmt = amt * (cgstRate / 100);
    const rowTotal = amt + sgstAmt + cgstAmt;
    sr += 1;
    rows.push(`
      <tr>
        <td class="center">${sr}</td>
        <td class="left">${escHtml(desc)}</td>
        <td class="center">${escHtml(hsn)}</td>
        <td>${escHtml(fmtQty(qty))}</td>
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

  for (let i = sr; i < TI_MIN_ROWS; i++) {
    rows.push(`
      <tr class="filler-row">
        <td></td><td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td><td></td>
      </tr>`);
  }

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

  return { rowsHtml: rows.join(''), totals: { totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty } };
};

export const buildTaxInvoiceHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.invoiceNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const poNo = escHtml(data.partyDocNo || 'Verbal');
  const poDate = escHtml(formatPdfDateDmy(data.partyDocDate) || '');
  const dcNo = escHtml(data.dcNo || '');
  const dcDate = escHtml(formatPdfDateDmy(data.dcDate) || '');
  const companyState = escHtml(profile.state || 'Gujarat');
  
  const { rowsHtml, totals } = buildItemRowsHtml(data);

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

  // Extract PAN from GSTIN if available (characters 3 to 12)
  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  const roundedTotal = Math.round(totals.totalAll);
  const roundOff = roundedTotal - totals.totalAll;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tax Invoice - ${escHtml(profile.companyName)}</title>
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
            background-color: #fff;
            color: var(--text-black);
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
            margin: 0;
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
            display: grid;
            grid-template-columns: 1.15fr 0.85fr 1fr;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1.5px solid var(--primary-purple);
        }

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
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 8px;
        }

        .bill-card {
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
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 12px;
            margin-top: 10px;
        }

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
            display: grid;
            grid-template-columns: 1.1fr 0.9fr 1fr;
            gap: 12px;
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            margin-top: 10px;
            padding: 8px;
        }

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
                    ${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')},<br>${companyState}, India
                </div>
            </div>
            <div class="icon-line"><i class="bi bi-telephone-fill"></i><div>${escHtml(profile.phone || '+91 97120 00297')}</div></div>
            <div class="icon-line"><i class="bi bi-envelope-fill"></i><div>${escHtml(profile.email || 'umamicron@gmail.com')}</div></div>
            <div class="icon-line"><i class="bi bi-globe"></i><div>${escHtml(profile.website || 'www.umamicron.com')}</div></div>
        </div>
        
        <div class="meta-col" style="padding-left: 5px;">
            <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${escHtml(profile.gstNumber || '')}</div></div>
            <div class="data-row"><div class="data-label-short">PAN</div><div class="data-value">: &nbsp;${companyPan}</div></div>
            <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${companyState}</div></div>
        </div>
        
        <div class="meta-col border-left">
            <div class="data-row"><div class="data-label">📋 Invoice No.</div><div class="data-value">: &nbsp;${docNo}</div></div>
            <div class="data-row"><div class="data-label">📅 Invoice Date</div><div class="data-value">: &nbsp;${docDate}</div></div>
            <div class="data-row" style="margin-top: 5px;"><div class="data-label">📋 PO No.</div><div class="data-value">: &nbsp;${poNo}</div></div>
            <div class="data-row"><div class="data-label">&nbsp; &nbsp; PO Date</div><div class="data-value">: &nbsp;${poDate}</div></div>
            <div class="data-row"><div class="data-label">&nbsp; &nbsp; Delivery Challan No.</div><div class="data-value">: &nbsp;${dcNo}</div></div>
            <div class="data-row"><div class="data-label">&nbsp; &nbsp; DC Date</div><div class="data-value">: &nbsp;${dcDate}</div></div>
        </div>
    </div>

    <!-- Bill To / Ship To Container -->
    <div class="billing-container">
        <!-- Bill To Section -->
        <div class="bill-card">
            <div class="card-title"><i class="bi bi-person-circle"></i> BILL TO</div>
            <div class="card-body">
                <div class="client-title">${billName}</div>
                ${billAddr.map(line => `<div>${escHtml(line)}</div>`).join('')}
                <div class="card-footer-data">
                    <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${billGstin}</div></div>
                    <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${billState} ${billStateCode ? `(${billStateCode})` : ''}</div></div>
                </div>
            </div>
        </div>
        
        <!-- Ship To Section -->
        <div class="bill-card">
            <div class="card-title"><i class="bi bi-truck"></i> SHIP TO</div>
            <div class="card-body">
                <div class="client-title">${shipName}</div>
                ${shipAddr.map(line => `<div>${escHtml(line)}</div>`).join('')}
                <div class="card-footer-data">
                    <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${shipGstin}</div></div>
                    <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${shipState} ${shipStateCode ? `(${shipStateCode})` : ''}</div></div>
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
                ${rowsHtml}
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
                <div class="charge-row"><span>Total Amount Before Tax</span><span>₹ &nbsp;${fmtMoney(totals.totalAmt)}</span></div>
                <div class="charge-row"><span>Add : CGST @ 9%</span><span>₹ &nbsp;${fmtMoney(totals.totalCgst)}</span></div>
                <div class="charge-row"><span>Add : SGST @ 9%</span><span>₹ &nbsp;${fmtMoney(totals.totalSgst)}</span></div>
                <div class="charge-row"><span>Add : IGST @ 18%</span><span>₹ &nbsp;${fmtMoney(totals.totalIgst)}</span></div>
                <div class="charge-row bold" style="border-top: 1px solid #ddd; padding-top:4px;"><span>Total Tax Amount</span><span>₹ &nbsp;${fmtMoney(totals.totalCgst + totals.totalSgst + totals.totalIgst)}</span></div>
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
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'TI',
    docNo: data.invoiceNo || 'N/A',
    width: PRINT_PAGE_W,
    fitPage: true
  });
};
