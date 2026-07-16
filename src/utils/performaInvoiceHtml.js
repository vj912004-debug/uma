import { mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  calcTiTotals,
  formatPdfDateSlash,
  splitPartyAddressLines
} from './taxInvoiceLayout';
import {
  IC,
  escHtml,
  fmtMoney,
  fmtQty,
  getSharedPrintStyles,
  PRINT_PAGE_W,
  buildPrintCompanyHeader,
  buildPrintTitle,
  buildDetailsGrid,
  buildPartyBox,
  buildBankDetailsBox,
  buildSummaryTable,
  buildTermsSealSign,
  renderHtmlToPdf
} from './printTheme';

const PI_MIN_ROWS = 10;

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
        <td class="desc">${escHtml(label)}</td>
        <td>${escHtml(fmtQty(qty))}</td>
        <td>${rate ? escHtml(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="num">${fmtMoney(amt)}</td>
        <td>${sgstRate}%</td>
        <td class="num">${fmtMoney(sgstAmt)}</td>
        <td>${cgstRate}%</td>
        <td class="num">${fmtMoney(cgstAmt)}</td>
        <td>0%</td>
        <td class="num">${fmtMoney(0)}</td>
        <td class="num">${fmtMoney(rowTotal)}</td>
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

  for (let i = sr; i < PI_MIN_ROWS; i++) {
    rows.push(`
      <tr class="blank-row">
        <td></td><td class="desc"></td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`);
  }

  rows.push(`
    <tr class="total-row">
      <td colspan="2" class="total-label">TOTAL</td>
      <td>${totalQty || 0}</td>
      <td></td>
      <td class="num">${fmtMoney(totalAmt)}</td>
      <td></td>
      <td class="num">${fmtMoney(totalSgst)}</td>
      <td></td>
      <td class="num">${fmtMoney(totalCgst)}</td>
      <td></td>
      <td class="num">${fmtMoney(totalIgst)}</td>
      <td class="num">${fmtMoney(totalAll)}</td>
    </tr>`);

  return { rowsHtml: rows.join(''), totals: { totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty } };
};

export const buildPerformaInvoiceHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const docNo = escHtml(data.invoiceNo || 'N/A');
  const docDate = escHtml(formatPdfDateSlash(data.date) || 'N/A');
  const dcNo = escHtml(data.dcNo || '');
  const dcDate = escHtml(formatPdfDateSlash(data.dcDate || data.date) || docDate);
  const companyState = escHtml(profile.state || 'GUJARAT');
  const { rowsHtml, totals } = buildItemRowsHtml(data);

  const billAddr = splitPartyAddressLines(data.billAddress || data.address || '', 42);
  const shipAddr = splitPartyAddressLines(data.shipAddress || data.address || '', 42);
  while (billAddr.length < 3) billAddr.push('');
  while (shipAddr.length < 3) shipAddr.push('');

  const terms = `
    <div class="note-block">NOTE: PACKING MATERIALS AND TRANSPORTATION CHARGES WILL BE CHAGRE EXTRA AS ACTUAL</div>
    <ol>
      <li>Subject to Vadodara Jurisdiction.</li>
      <li>Payment 100% ADVANCE AGAINST PI.</li>
    </ol>
    <div style="margin-top:8px;font-size:10.5px;font-weight:bold;">this is system generated PI so no need to sign</div>`;

  return `
<style>${getSharedPrintStyles()}</style>
<div class="print-host">
  <div class="pdf-page">
    <div class="invoice-container">
      ${buildPrintCompanyHeader(profile, { showCopyBadge: false })}
      ${buildPrintTitle('PERFORMA INVOICE')}
      ${buildDetailsGrid([
        ['PI No.', docNo, 'Delivery Challan No.', dcNo],
        ['PI Date', docDate, 'Date', dcDate],
        ['State', companyState, 'Code', '24']
      ])}
      <div class="parties-wrapper">
        ${buildPartyBox('BILL TO PARTY', IC.users, {
          name: data.partyName,
          addressLines: billAddr.slice(0, 3),
          state: data.billState || data.state,
          stateCode: data.billStateCode || data.stateCode,
          gstin: data.gstinBill || data.gstin
        })}
        ${buildPartyBox('SHIP TO PARTY', IC.truck, {
          name: data.shipName || data.partyName,
          addressLines: shipAddr.slice(0, 3),
          state: data.shipState || data.state,
          stateCode: data.shipStateCode || data.stateCode,
          gstin: data.gstinShip || data.gstin
        })}
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th rowspan="2" style="width:4%">S.<br>No.</th>
            <th rowspan="2" style="width:26%">Description</th>
            <th rowspan="2" style="width:5%">Qty</th>
            <th rowspan="2" style="width:7%">Rate</th>
            <th rowspan="2" style="width:8%">Amount</th>
            <th colspan="2">SGST</th>
            <th colspan="2">CGST</th>
            <th colspan="2">IGST</th>
            <th rowspan="2" style="width:8%">Total</th>
          </tr>
          <tr>
            <th style="width:5%">Rate</th><th style="width:7%">Amount</th>
            <th style="width:5%">Rate</th><th style="width:7%">Amount</th>
            <th style="width:5%">Rate</th><th style="width:7%">Amount</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer-top">
        ${buildBankDetailsBox(profile.companyName)}
        ${buildSummaryTable(totals)}
      </div>
      ${buildTermsSealSign(profile.companyName, terms)}
    </div>
  </div>
</div>`;
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
