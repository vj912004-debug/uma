import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateSlash } from './taxInvoiceLayout';
import {
  STANDARD_CHARGES_LIST,
  OTHER_CHARGE_ITEM
} from './documentCharges';
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
  buildBankDetailsBox,
  buildSummaryTable,
  buildTermsSealSign,
  renderHtmlToPdf
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

  // Fallback: particulars + amount when no charge lines
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
  const docDate = escHtml(formatPdfDateSlash(data.date) || 'N/A');
  const refInvoice = escHtml(data.refInvoice || '');
  const { rows, totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty } = calcNoteLines(data);

  const bodyRows = rows.map((r) => `
    <tr>
      <td><b>${r.sr}</b></td>
      <td class="desc">${escHtml(r.label)}</td>
      <td>${escHtml(fmtQty(r.qty))}</td>
      <td>${fmtMoney(r.rate)}</td>
      <td class="num">${fmtMoney(r.amt)}</td>
      <td>${r.sgstRate}%</td>
      <td class="num">${fmtMoney(r.sgstAmt)}</td>
      <td>${r.cgstRate}%</td>
      <td class="num">${fmtMoney(r.cgstAmt)}</td>
      <td>0%</td>
      <td class="num">0.00</td>
      <td class="num">${fmtMoney(r.rowTotal)}</td>
    </tr>`).join('');

  const blanks = Array.from({ length: Math.max(0, NOTE_MIN_ROWS - rows.length) }, () => `
    <tr class="blank-row">
      <td></td><td class="desc"></td><td></td><td></td><td></td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>`).join('');

  const terms = `
    <ol>
      <li>Subject to Vadodara Jurisdiction.</li>
      <li>This ${escHtml(title.toLowerCase())} is issued against the reference invoice mentioned above.</li>
      <li>Interest will charged @ 24% per annum if amount remaining unpaid from due date.</li>
    </ol>
    ${data.particulars ? `<div class="note-block" style="margin-top:8px;">Particulars: ${escHtml(data.particulars)}</div>` : ''}`;

  return {
    html: `
<style>${getSharedPrintStyles()}</style>
<div class="print-host">
  <div class="pdf-page">
    <div class="invoice-container">
      ${buildPrintCompanyHeader(profile, { showCopyBadge: true, copyBadgeHtml: 'ORIGINAL<br>DUPLICATE' })}
      ${buildPrintTitle(title)}
      ${buildDetailsGrid([
        [`${filePrefix} No.`, docNo, 'Date', docDate],
        ['Party Name', escHtml(data.partyName || ''), 'Ref. Invoice', refInvoice],
        ['State', escHtml(profile.state || 'GUJARAT'), 'Code', '24'],
        ['Tax Rate', `${parseFloat(data.taxRate) || 18}%`, 'Discount', fmtMoney(data.discount || 0)]
      ])}
      <div class="parties-wrapper">
        <div class="party-box" style="flex:1;">
          <div class="party-header">${IC.users} BILL TO PARTY</div>
          <div class="party-body">
            <div class="party-row"><div class="party-label">Name :</div><div class="dotted-line">${escHtml(data.partyName || '')}</div></div>
            <div class="party-row"><div class="party-label">Address :</div><div class="dotted-line">&nbsp;</div></div>
            <div class="party-row"><div class="party-label">GSTIN :</div><div class="dotted-line">&nbsp;</div></div>
          </div>
        </div>
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
        <tbody>
          ${bodyRows}${blanks}
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
          </tr>
        </tbody>
      </table>
      <div class="footer-top">
        ${buildBankDetailsBox(profile.companyName)}
        ${buildSummaryTable({ totalAmt, totalSgst, totalCgst, totalIgst, totalAll })}
      </div>
      ${buildTermsSealSign(profile.companyName, terms)}
    </div>
  </div>
</div>`,
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
