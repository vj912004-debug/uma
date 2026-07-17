import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy, splitPartyAddressLines } from './taxInvoiceLayout';
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
const NOTE_MIN_ROWS = 10;

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

  const extractDescAndHsn = (label) => {
    const match = label.match(/(.*?)\s*\((\d+)\)$/);
    if (match) {
      return { desc: match[1].trim(), hsn: match[2] };
    }
    return { desc: label, hsn: '' };
  };

  const bodyRows = rows.map((r) => {
    const { desc, hsn } = extractDescAndHsn(r.label);
    return `
    <tr>
      <td class="center">${r.sr}</td>
      <td class="left">${escHtml(desc)}</td>
      <td class="center">${escHtml(hsn)}</td>
      <td class="center">${escHtml(fmtQty(r.qty))}</td>
      <td>${fmtMoney(r.rate)}</td>
      <td>${fmtMoney(r.amt)}</td>
      <td>${fmtMoney(r.cgstAmt)}</td>
      <td>${fmtMoney(r.sgstAmt)}</td>
      <td class="center">-</td>
      <td>${fmtMoney(r.rowTotal)}</td>
    </tr>`;
  }).join('');

  const blanksCount = Math.max(0, NOTE_MIN_ROWS - rows.length);
  const blanks = Array.from({ length: blanksCount }, (_, i) => `
    <tr class="filler-row"${i === blanksCount - 1 ? ' style="height: 100%;"' : ''}>
      <td></td><td></td><td></td><td></td><td></td>
      <td></td><td></td><td></td><td class="center">-</td><td>-</td>
    </tr>`).join('');

  const rightColHtml = `
    <div style="background-color: #fff; border-radius: 6px; border: 1.5px solid var(--border-purple); box-sizing: border-box; overflow: hidden;">
        <div style="background-color: var(--light-purple-bg); color: var(--primary-purple); font-weight: bold; font-size: 11px; text-align: center; border-bottom: 1.5px solid var(--border-purple); padding: 5px 8px;">REFERENCE DETAILS</div>
        <div style="padding: 5px 7px;">
            <table class="reference-table">
                <tr><td class="reference-icon"><i class="bi bi-file-earmark-text"></i></td><td class="reference-label">${title === 'CREDIT NOTE' ? 'Credit Note' : 'Debit Note'} No.</td><td class="reference-value">: ${docNo}</td></tr>
                <tr><td class="reference-icon"><i class="bi bi-calendar3"></i></td><td class="reference-label">${title === 'CREDIT NOTE' ? 'Credit Note' : 'Debit Note'} Date</td><td class="reference-value">: ${docDate}</td></tr>
                <tr><td class="reference-icon"><i class="bi bi-file-earmark-text"></i></td><td class="reference-label">Original Invoice No.</td><td class="reference-value">: ${refInvoice}</td></tr>
                <tr><td class="reference-icon"><i class="bi bi-calendar3"></i></td><td class="reference-label">Original Invoice Date</td><td class="reference-value">: ${escHtml(formatPdfDateDmy(data.refInvoiceDate) || '')}</td></tr>
                <tr><td class="reference-icon"><i class="bi bi-person-badge"></i></td><td class="reference-label">Customer PO No.</td><td class="reference-value">: ${escHtml(data.poNo || 'Verbal')}</td></tr>
                <tr><td class="reference-icon"><i class="bi bi-tag"></i></td><td class="reference-label">Reference</td><td class="reference-value">: ${escHtml(data.reference || '')}</td></tr>
            </table>
        </div>
    </div>
  `;

  const termsHtml = `
    <ol>
        <li>Subject to Vadodara Jurisdiction.</li>
        <li>Payment terms as per our agreed terms.</li>
        <li>Interest will be charged @ 24% p.a. if the amount remains unpaid from the due date.</li>
    </ol>
    ${data.particulars ? `<div style="font-size: 9.5px; font-weight: bold; margin-top: 4px; color: var(--primary-purple);">Particulars: ${escHtml(data.particulars)}</div>` : ''}
  `;
  const declarationHtml = filePrefix === 'DN'
    ? `<p>This Debit Note is issued against the above Tax Invoice for the additional amount recoverable.</p>`
    : `<p>This ${escHtml(title)} is issued against the above Tax Invoice and forms an integral part of the original transaction.</p>`;

  const roundedTotal = Math.round(totalAll);
  const roundOff = roundedTotal - totalAll;

  const reasonHtml = filePrefix === 'DN' ? `
    <div style="display: flex; border: 1.5px solid var(--border-purple); border-radius: 6px; margin-top: 8px; overflow: hidden;">
        <div style="background-color: var(--light-purple-bg); color: var(--primary-purple); font-weight: bold; padding: 6px 10px; display: flex; align-items: center; gap: 6px; border-right: 1.5px solid var(--border-purple); font-size: 11px; white-space: nowrap;">
            <i class="bi bi-card-text"></i> REASON FOR DEBIT NOTE
        </div>
        <div style="display: flex; gap: 12px; align-items: center; padding: 6px 10px; flex: 1; font-size: 10.5px; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Additional Charges' ? 'checked="checked"' : ''}> Additional Charges</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Rate Revision' ? 'checked="checked"' : ''}> Rate Revision</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Packing Charges' ? 'checked="checked"' : ''}> Packing Charges</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Freight Charges' ? 'checked="checked"' : ''}> Freight Charges</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Material Shortage' ? 'checked="checked"' : ''}> Material Shortage</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${!['Additional Charges', 'Rate Revision', 'Packing Charges', 'Freight Charges', 'Material Shortage'].includes(data.reason) && data.reason ? 'checked="checked"' : ''}> Others <span style="border-bottom: 1px solid #000; display: inline-block; width: 60px;">${!['Additional Charges', 'Rate Revision', 'Packing Charges', 'Freight Charges', 'Material Shortage'].includes(data.reason) && data.reason ? escHtml(data.reason) : ''}</span></label>
        </div>
    </div>
  ` : `
    <div style="display: flex; border: 1.5px solid var(--border-purple); border-radius: 6px; margin-top: 8px; overflow: hidden;">
        <div style="background-color: var(--light-purple-bg); color: var(--primary-purple); font-weight: bold; padding: 6px 10px; display: flex; align-items: center; gap: 6px; border-right: 1.5px solid var(--border-purple); font-size: 11px; white-space: nowrap;">
            <i class="bi bi-card-text"></i> REASON FOR CREDIT NOTE
        </div>
        <div style="display: flex; gap: 12px; align-items: center; padding: 6px 10px; flex: 1; font-size: 10.5px; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Sales Return' ? 'checked="checked"' : ''}> Sales Return</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Rate Difference' ? 'checked="checked"' : ''}> Rate Difference</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Discount' ? 'checked="checked"' : ''}> Discount</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Excess Billing' ? 'checked="checked"' : ''}> Excess Billing</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${data.reason === 'Material Rejection' ? 'checked="checked"' : ''}> Material Rejection</label>
            <label style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" ${!['Sales Return', 'Rate Difference', 'Discount', 'Excess Billing', 'Material Rejection'].includes(data.reason) && data.reason ? 'checked="checked"' : ''}> Others <span style="border-bottom: 1px solid #000; display: inline-block; width: 60px;">${!['Sales Return', 'Rate Difference', 'Discount', 'Excess Billing', 'Material Rejection'].includes(data.reason) && data.reason ? escHtml(data.reason) : ''}</span></label>
        </div>
    </div>
  `;

  return {
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(title)} - ${escHtml(profile.companyName)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        ${getSharedPrintStyles()}
        .meta-col.border-left { border-left: none !important; padding-left: 0 !important; }
        .meta-strip { align-items: flex-start; gap: 12px; }
        .meta-strip > .meta-col:nth-child(1) {
            flex: 1.3;
            min-width: 0;
            gap: 5px;
            font-size: 11.5px;
        }
        .meta-strip > .meta-col:nth-child(2) {
            flex: 0.7;
            min-width: 0;
            gap: 6px;
            padding-top: 2px;
        }
        .meta-strip > .meta-col:nth-child(3) { flex: 1.5; min-width: 0; }
        .meta-strip > .meta-col:nth-child(1) .icon-line {
            font-size: 11.5px;
            line-height: 1.35;
            gap: 7px;
        }
        .meta-strip > .meta-col:nth-child(1) .icon-line i {
            font-size: 12.5px;
        }
        .meta-strip > .meta-col:nth-child(2) .data-row {
            font-size: 11px;
            line-height: 1.35;
        }
        .meta-strip > .meta-col:nth-child(2) .data-label-short {
            width: 46px;
        }
        .reference-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 9.5px;
            line-height: 1.25;
        }
        .reference-table td { padding: 2px 1px; vertical-align: top; }
        .reference-icon { width: 17px; color: var(--primary-purple); }
        .reference-label { width: 110px; font-weight: bold; }
        .reference-value { overflow-wrap: anywhere; }
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-20deg);
            opacity: 0.06;
            font-size: 70px;
            font-weight: bold;
            color: var(--primary-purple);
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
            letter-spacing: 4px;
        }
        .invoice-table tbody tr {
            position: relative;
            z-index: 1;
        }
    </style>
</head>
<body>
<div class="print-host">
<div class="pdf-page">
<div class="invoice-box" style="position: relative;">
    
    ${buildPrintHeader(profile, title, 'AGAINST TAX INVOICE')}
    ${buildMetaStrip(profile, companyState, companyPan, rightColHtml)}

    <div class="billing-container">
        ${buildPartyCard('BILL TO', 'bi bi-person-circle', billName, billAddr, billGstin, billState, billStateCode)}
        ${buildPartyCard('SHIP TO', 'bi bi-truck', shipName, shipAddr, shipGstin, shipState, shipStateCode)}
    </div>

    ${reasonHtml}

    <div class="table-container" style="position: relative;">
        <div class="watermark">${escHtml(title)}</div>
        <table class="invoice-table">
            <thead>
                <tr>
                    <th style="width: 5%;">Sr. No.</th>
                    <th style="width: 25%; text-align: left; padding-left: 8px;">Description</th>
                    <th style="width: 10%;">HSN / SAC</th>
                    <th style="width: 6%;">Qty.</th>
                    <th style="width: 10%;">Rate (₹)</th>
                    <th style="width: 10%;">Amount (₹)</th>
                    <th style="width: 8%;">CGST (₹)</th>
                    <th style="width: 8%;">SGST (₹)</th>
                    <th style="width: 6%;">IGST (₹)</th>
                    <th style="width: 12%;">Total Amount (₹)</th>
                </tr>
            </thead>
            <tbody>
                ${bodyRows}${blanks}
                <tr class="total-row">
                    <td colspan="3" class="center" style="text-align: center;">TOTAL</td>
                    <td class="center">${fmtQty(totalQty) || '0.00'}</td>
                    <td></td>
                    <td>${fmtMoney(totalAmt)}</td>
                    <td>${fmtMoney(totalCgst)}</td>
                    <td>${fmtMoney(totalSgst)}</td>
                    <td class="center">-</td>
                    <td>${fmtMoney(totalAll)}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="bottom-summary-grid">
        ${filePrefix === 'DN' ? buildBankDetailsBox(profile) : `
        <div class="bank-details-box">
            <div class="box-heading"><i class="bi bi-journal-text"></i> NOTES</div>
            <ul style="padding-left: 20px; font-size: 11px; line-height: 1.5; margin-top: 8px;">
                <li>Amount will be adjusted against the next invoice.</li>
                <li>Please quote the ${escHtml(title)} Number for future reference.</li>
            </ul>
        </div>
        `}
        <div class="totals-box">
            <div style="padding: 4px 0;">
                <div class="charge-row"><span>Total Amount Before Tax</span><span>₹ &nbsp;${fmtMoney(totalAmt)}</span></div>
                <div class="charge-row"><span>Add : CGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</span><span>₹ &nbsp;${fmtMoney(totalCgst)}</span></div>
                <div class="charge-row"><span>Add : SGST @ ${(parseFloat(data.taxRate) || 18) / 2}%</span><span>₹ &nbsp;${fmtMoney(totalSgst)}</span></div>
                <div class="charge-row"><span>Add : IGST @ 18%</span><span>${totalIgst > 0 ? `₹ &nbsp;${fmtMoney(totalIgst)}` : '-'}</span></div>
                <div class="charge-row" style="border-top: 1px solid var(--grid-line-purple); padding-top:6px; margin-top: 2px;"><span>Total Tax Amount</span><span>₹ &nbsp;${fmtMoney(totalCgst + totalSgst + totalIgst)}</span></div>
                <div class="charge-row"><span>Round Off</span><span>₹ &nbsp;${fmtMoney(roundOff)}</span></div>
            </div>
            <div class="grand-total-banner">
                <span>${filePrefix === 'CN' ? 'CREDIT' : 'DEBIT'} AMOUNT</span>
                <span>₹ ${fmtMoney(roundedTotal)}</span>
            </div>
        </div>
    </div>

    ${buildFooterTerms(profile.companyName, termsHtml, declarationHtml)}
    ${buildStatusBar('Page 1 of 1', `This is a computer generated ${title.toLowerCase()}.`)}

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
