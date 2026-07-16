import { mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  calcTiTotals,
  formatPdfDateDmy,
  splitPartyAddressLines
} from './taxInvoiceLayout';
import {
  escHtml,
  fmtMoney,
  fmtQty,
  PRINT_PAGE_W,
  renderHtmlToPdf,
  getSharedPrintStyles,
  buildPrintHeader,
  buildMetaStrip,
  buildPartyCard,
  buildBankDetailsBox,
  buildFooterTerms,
  buildStatusBar
} from './printTheme';

const PI_MIN_ROWS = 15;

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

  const blanksCount = Math.max(0, PI_MIN_ROWS - sr);
  for (let i = 0; i < blanksCount; i++) {
    rows.push(`
      <tr class="filler-row"${i === blanksCount - 1 ? ' style="height: 100%;"' : ''}>
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

export const buildPerformaInvoiceHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.invoiceNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const dcNo = escHtml(data.dcNo || '');
  const dcDate = escHtml(formatPdfDateDmy(data.dcDate || data.date) || docDate);
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

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  const roundedTotal = Math.round(totals.totalAll);
  const roundOff = roundedTotal - totals.totalAll;

  const rightColHtml = `
    <div class="data-row"><div class="data-label"><i class="bi bi-file-earmark-text"></i> PI No.</div><div class="data-value">: &nbsp;${docNo}</div></div>
    <div class="data-row"><div class="data-label"><i class="bi bi-calendar3"></i> PI Date</div><div class="data-value">: &nbsp;${docDate}</div></div>
    <div class="data-row" style="margin-top: 5px;"><div class="data-label"><i class="bi bi-file-earmark-text"></i> Delivery Challan No.</div><div class="data-value">: &nbsp;${dcNo}</div></div>
    <div class="data-row"><div class="data-label" style="padding-left: 16px;">DC Date</div><div class="data-value">: &nbsp;${dcDate}</div></div>
  `;

  const termsHtml = `
    <div style="font-size: 9.5px; font-weight: bold; margin-bottom: 4px; color: var(--primary-purple);">NOTE: PACKING MATERIALS AND TRANSPORTATION CHARGES WILL BE CHARGED EXTRA AS ACTUAL</div>
    <ol>
        <li>Subject to Vadodara Jurisdiction.</li>
        <li>Payment 100% ADVANCE AGAINST PI.</li>
    </ol>
  `;
  const declarationHtml = `<p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performa Invoice - ${escHtml(profile.companyName)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>${getSharedPrintStyles()}</style>
</head>
<body>
<div class="print-host">
<div class="pdf-page">
<div class="invoice-box">
    
    ${buildPrintHeader(profile, 'PERFORMA INVOICE', '')}
    ${buildMetaStrip(profile, companyState, companyPan, rightColHtml)}

    <div class="billing-container">
        ${buildPartyCard('BILL TO', 'bi bi-person-circle', billName, billAddr, billGstin, billState, billStateCode)}
        ${buildPartyCard('SHIP TO', 'bi bi-truck', shipName, shipAddr, shipGstin, shipState, shipStateCode)}
    </div>

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

    <div class="bottom-summary-grid">
        ${buildBankDetailsBox(profile)}
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

    ${buildFooterTerms(profile.companyName, termsHtml, declarationHtml)}
    ${buildStatusBar('Page 1 of 1')}

</div>
</div>
</div>
</body>
</html>`;
};

export const renderPerformaInvoicePdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPerformaInvoiceHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'PI',
    docNo: data.invoiceNo || 'N/A',
    width: PRINT_PAGE_W,
    fitPage: true
  });
};
