import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  STANDARD_CHARGES_LIST,
  OTHER_CHARGE_ITEM
} from './documentCharges';
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

const NOTE_CHARGES = [...STANDARD_CHARGES_LIST, OTHER_CHARGE_ITEM];
const NOTE_MIN_ROWS = 15;

const calcNoteLines = (data) => {
  const taxRate = parseFloat(data.taxRate) || 18;
  const half = taxRate / 2;
  const rows = [];
  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalQty = 0;
  let sr = 0;

  NOTE_CHARGES.forEach((c) => {
    if (!data.charges?.[c.key]) return;
    const qty = parseFloat(data.qtys?.[c.key]) || 1;
    const rate = parseFloat(data.rates?.[c.key]) || 0;
    const amt = qty * rate;
    if (amt <= 0 && !rate) return;
    const sgstAmt = amt * (half / 100);
    const cgstAmt = amt * (half / 100);
    sr += 1;
    rows.push({
      sr,
      label: c.label || c.key,
      qty,
      rate,
      amt,
      sgstRate: half,
      cgstRate: half,
      sgstAmt,
      cgstAmt,
      rowTotal: amt + sgstAmt + cgstAmt
    });
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalQty += qty;
  });

  if (!rows.length && (data.particulars || data.amount)) {
    const amt = parseFloat(data.subtotal) || parseFloat(data.amount) || 0;
    const sgstAmt = amt * (half / 100);
    const cgstAmt = amt * (half / 100);
    rows.push({
      sr: 1,
      label: data.particulars || 'Adjustment',
      qty: 1,
      rate: amt,
      amt,
      sgstRate: half,
      cgstRate: half,
      sgstAmt,
      cgstAmt,
      rowTotal: amt + sgstAmt + cgstAmt
    });
    totalAmt = amt;
    totalSgst = sgstAmt;
    totalCgst = cgstAmt;
    totalQty = 1;
  }

  const discount = parseFloat(data.discount) || 0;
  if (discount > 0 && totalAmt > 0) {
    const ratio = Math.max(0, totalAmt - discount) / totalAmt;
    totalAmt = Math.max(0, totalAmt - discount);
    totalSgst *= ratio;
    totalCgst *= ratio;
  }

  const totalAll = totalAmt + totalSgst + totalCgst;
  return { rows, totalAmt, totalSgst, totalCgst, totalIgst: 0, totalAll, totalQty };
};

const buildNoteHtml = (data, profileInput, { title, filePrefix }) => {
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.noteNo || 'N/A');
  const docDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const refInvoice = escHtml(data.refInvoice || '');
  const companyState = escHtml(profile.state || 'Gujarat');
  
  const { rows, totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty } = calcNoteLines(data);

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  const bodyRows = rows.map((r) => `
    <tr>
      <td class="center">${r.sr}</td>
      <td class="left">${escHtml(r.label)}</td>
      <td class="center"></td>
      <td>${escHtml(fmtQty(r.qty))}</td>
      <td>${fmtMoney(r.rate)}</td>
      <td>${fmtMoney(r.amt)}</td>
      <td>${fmtMoney(r.cgstAmt)}</td>
      <td>${fmtMoney(r.sgstAmt)}</td>
      <td>0.00</td>
      <td>${fmtMoney(r.rowTotal)}</td>
    </tr>`).join('');

  const blanks = Array.from({ length: Math.max(0, NOTE_MIN_ROWS - rows.length) }, () => `
    <tr class="filler-row">
      <td></td><td></td><td></td><td></td><td></td>
      <td></td><td></td><td></td><td></td><td></td>
    </tr>`).join('');

  const rightColHtml = `
    <div class="data-row"><div class="data-label"><i class="bi bi-file-earmark-text"></i> ${filePrefix} No.</div><div class="data-value">: &nbsp;${docNo}</div></div>
    <div class="data-row"><div class="data-label"><i class="bi bi-calendar3"></i> Date</div><div class="data-value">: &nbsp;${docDate}</div></div>
    <div class="data-row" style="margin-top: 5px;"><div class="data-label"><i class="bi bi-file-earmark-text"></i> Ref. Invoice</div><div class="data-value">: &nbsp;${refInvoice}</div></div>
    <div class="data-row"><div class="data-label" style="padding-left: 16px;">Tax Rate</div><div class="data-value">: &nbsp;${parseFloat(data.taxRate) || 18}%</div></div>
    <div class="data-row"><div class="data-label" style="padding-left: 16px;">Discount</div><div class="data-value">: &nbsp;₹ ${fmtMoney(data.discount || 0)}</div></div>
  `;

  const termsHtml = `
    <ol>
        <li>Subject to Vadodara Jurisdiction.</li>
        <li>This ${escHtml(title.toLowerCase())} is issued against the reference invoice mentioned above.</li>
        <li>Interest will be charged @ 24% p.a. if the amount remains unpaid from the due date.</li>
    </ol>
    ${data.particulars ? `<div style="font-size: 9.5px; font-weight: bold; margin-top: 4px; color: var(--primary-purple);">Particulars: ${escHtml(data.particulars)}</div>` : ''}
  `;
  const declarationHtml = `<p>We declare that this document shows the actual price of the goods described and that all particulars are true and correct.</p>`;

  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;

  return {
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(title)} - ${escHtml(profile.companyName)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>${getSharedPrintStyles()}</style>
</head>
<body>
<div class="print-host">
<div class="pdf-page">
<div class="invoice-box">
    
    ${buildPrintHeader(profile, title, 'ORIGINAL FOR RECIPIENT')}
    ${buildMetaStrip(profile, companyState, companyPan, rightColHtml)}

    <div class="billing-container" style="display: block;">
        ${buildPartyCard('BILL TO PARTY', 'bi bi-person-circle', data.partyName || '', [], '', '', '')}
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
                ${bodyRows}${blanks}
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
                </tr>
            </tbody>
        </table>
    </div>

    <div class="bottom-summary-grid">
        ${buildBankDetailsBox(profile)}
        <div class="totals-box">
            <div>
                <div class="charge-row"><span>Total Amount Before Tax</span><span>₹ &nbsp;${fmtMoney(totalAmt)}</span></div>
                <div class="charge-row"><span>Add : CGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</span><span>₹ &nbsp;${fmtMoney(totalCgst)}</span></div>
                <div class="charge-row"><span>Add : SGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</span><span>₹ &nbsp;${fmtMoney(totalSgst)}</span></div>
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

    ${buildFooterTerms(profile.companyName, termsHtml, declarationHtml)}
    ${buildStatusBar('Page 1 of 1')}

</div>
</div>
</div>
</body>
</html>`,
    docNo: data.noteNo || 'N/A'
  };
};

export const renderDebitNotePdf = async (data, { mode = 'save' } = {}) => {
  const { html, docNo } = buildNoteHtml(data, data.companyProfile, { title: 'DEBIT NOTE', filePrefix: 'DN' });
  await renderHtmlToPdf(html, { mode, filePrefix: 'DN', docNo, width: PRINT_PAGE_W, fitPage: true });
};

export const renderCreditNotePdf = async (data, { mode = 'save' } = {}) => {
  const { html, docNo } = buildNoteHtml(data, data.companyProfile, { title: 'CREDIT NOTE', filePrefix: 'CN' });
  await renderHtmlToPdf(html, { mode, filePrefix: 'CN', docNo, width: PRINT_PAGE_W, fitPage: true });
};
