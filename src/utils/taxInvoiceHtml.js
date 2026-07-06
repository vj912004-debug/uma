import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatTiHeaderAddressLines, getTiContactLine, mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  calcTiTotals,
  formatPdfDateSlash
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 88" width="110" height="88" aria-label="UMA MICRON Logo">
  <ellipse cx="38" cy="44" rx="28" ry="34" fill="none" stroke="#009900" stroke-width="2.5"/>
  <ellipse cx="52" cy="44" rx="28" ry="34" fill="none" stroke="#cc0000" stroke-width="2.5"/>
  <text x="24" y="56" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="700" fill="#cc0000">U</text>
  <text x="48" y="56" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="700" fill="#009900">M</text>
</svg>`;

const TI_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .ti-host {
    font-family: Arial, Helvetica, sans-serif;
    background: #e5e5e5;
    padding: 20px;
    width: 850px;
    color: #000;
  }
  .invoice-wrapper {
    width: 100%;
    background: #fff;
    border: 2px solid #000;
    position: relative;
  }
  .top-right-tag {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 11px;
    text-align: right;
    line-height: 1.3;
    z-index: 2;
  }
  .header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 10px 6px;
    border-bottom: 2px solid #000;
    min-height: 100px;
  }
  .logo {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 110px;
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo img { width: 100%; height: 100%; object-fit: contain; }
  .company-info { text-align: center; }
  .company-info h1 { font-size: 24px; letter-spacing: 1px; margin: 0; }
  .company-info p { margin: 2px 0; font-size: 12.5px; font-weight: bold; }
  .invoice-title {
    text-align: center;
    font-size: 30px;
    font-weight: bold;
    letter-spacing: 4px;
    padding: 6px 0;
    border-bottom: 2px solid #000;
  }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.grid td, table.grid th {
    border: 1px solid #000;
    padding: 3px 6px;
    font-size: 12.5px;
    vertical-align: top;
  }
  .meta-table td { padding: 4px 6px; }
  .meta-table .label { font-weight: bold; white-space: nowrap; }
  .meta-table .value { }
  .meta-table .code-cell { font-weight: bold; white-space: nowrap; text-align: center; }
  .meta-table .code-value { text-align: center; }
  .party-header td { text-align: center; font-weight: bold; background: #fff; }
  .party-table td { height: 20px; }
  .party-table .field-label { font-weight: bold; white-space: nowrap; }
  .party-table .code-label { font-weight: bold; text-align: center; }
  .items-table th, .items-table td { text-align: center; font-size: 12px; }
  .items-table td.desc { text-align: left; }
  .items-table th { font-weight: bold; background: #fff; }
  .items-table td.num { text-align: right; }
  .items-table .total-row td { font-weight: bold; font-size: 14px; }
  .center { text-align: center; }
  .bottom-section { display: flex; width: 100%; }
  .bank-details {
    width: 55%;
    border: 1px solid #000;
    border-top: none;
    padding: 6px 8px;
    font-size: 12.5px;
  }
  .bank-details .title { font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
  .bank-details table { width: 100%; border-collapse: collapse; }
  .bank-details table td { border: none; padding: 1px 2px; font-size: 12.5px; }
  .bank-details .b-label { font-weight: bold; width: 42%; }
  .totals-box {
    width: 45%;
    border: 1px solid #000;
    border-top: none;
    border-left: none;
  }
  .totals-box table { width: 100%; height: 100%; border-collapse: collapse; }
  .totals-box td { font-size: 12.5px; padding: 3px 6px; border: 1px solid #000; }
  .totals-box .t-label { font-weight: bold; }
  .totals-box .t-value { text-align: right; width: 30%; }
  .totals-box .grand-total td { font-weight: bold; font-size: 13.5px; }
  .footer-section { display: flex; width: 100%; border: 1px solid #000; border-top: none; }
  .terms {
    width: 55%;
    padding: 6px 8px;
    border-right: 1px solid #000;
    font-size: 12px;
  }
  .terms .title { font-weight: bold; margin-bottom: 4px; }
  .terms ol { margin: 0; padding-left: 18px; }
  .terms li { margin-bottom: 2px; }
  .signatory { width: 45%; display: flex; flex-direction: column; }
  .signatory .cert {
    font-size: 11px;
    text-align: center;
    padding: 4px;
    border-bottom: 1px solid #000;
  }
  .signatory .for-company {
    font-weight: bold;
    text-align: center;
    padding: 4px;
    flex-grow: 1;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .signatory .seal-sign { display: flex; border-top: 1px solid #000; }
  .signatory .seal {
    width: 40%;
    text-align: center;
    font-size: 12px;
    padding: 6px;
    border-right: 1px solid #000;
    min-height: 36px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .signatory .auth {
    width: 60%;
    text-align: center;
    font-size: 12px;
    padding: 6px;
    min-height: 36px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
`;

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
        <td>${sr}</td>
        <td class="desc">${esc(label)}</td>
        <td>${esc(fmtQty(qty))}</td>
        <td>${rate ? esc(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="num">${fmtMoney(amt)}</td>
        <td>${sgstRate}</td>
        <td class="num">${fmtMoney(sgstAmt)}</td>
        <td>${cgstRate}</td>
        <td class="num">${fmtMoney(cgstAmt)}</td>
        <td></td>
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

  rows.push(`
    <tr class="total-row">
      <td colspan="2" class="center">Total</td>
      <td>${totalQty || 0}</td>
      <td></td>
      <td class="num">${fmtMoney(totalAmt)}</td>
      <td></td><td class="num">${fmtMoney(totalSgst)}</td>
      <td></td><td class="num">${fmtMoney(totalCgst)}</td>
      <td></td><td class="num">${fmtMoney(totalIgst)}</td>
      <td class="num">${fmtMoney(totalAll)}</td>
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
<style>${TI_STYLES}</style>
<div class="ti-host">
  <div class="invoice-wrapper">
    <div class="top-right-tag">Original<br>Duplicate</div>

    <div class="header">
      <div class="logo">${logoHtml}</div>
      <div class="company-info">
        <h1>${esc(profile.companyName)}</h1>
        <p>${esc(addressLines[0] || '')}</p>
        <p>${esc(addressLines[1] || '')}</p>
        <p>${esc(contact)}</p>
        <p>GSTIN: ${esc(profile.gstNumber)}</p>
      </div>
    </div>

    <div class="invoice-title">Tax Invoice</div>

    <table class="grid meta-table">
      <tr>
        <td class="label">Invoice No:</td>
        <td class="value">${docNo}</td>
        <td class="label">Invoice Date:</td>
        <td class="value">${docDate}</td>
      </tr>
      <tr>
        <td class="label">Delivery Challan No.</td>
        <td class="value">${dcNo}</td>
        <td class="label">Date :</td>
        <td class="value">${dcDate}</td>
      </tr>
      <tr>
        <td class="label"></td>
        <td class="value"></td>
        <td class="label">PO No./Challan No</td>
        <td class="value">${refNo}</td>
      </tr>
    </table>
    <table class="grid meta-table">
      <tr>
        <td class="label">State : ${companyState}</td>
        <td class="code-cell">Code</td>
        <td class="code-value">${companyStateCode}</td>
        <td class="label">Date :</td>
        <td class="value">${refDate}</td>
      </tr>
    </table>

    <table class="grid party-table">
      <tr class="party-header">
        <td colspan="2">Bill to Party</td>
        <td colspan="2">Ship to Party</td>
      </tr>
      <tr>
        <td class="field-label">Name :</td>
        <td>${esc(data.partyName || '')}</td>
        <td class="field-label">Name :</td>
        <td>${esc(data.shipName || data.partyName || '')}</td>
      </tr>
      <tr>
        <td class="field-label">Address :</td>
        <td>${esc(data.billAddress || data.address || '')}</td>
        <td class="field-label">Address :</td>
        <td>${esc(data.shipAddress || data.address || '')}</td>
      </tr>
      <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      <tr>
        <td class="field-label">State :</td>
        <td class="code-label">Code</td>
        <td class="field-label">State :</td>
        <td class="code-label">Code</td>
      </tr>
      <tr>
        <td>${esc(data.billState || data.state || '')}</td>
        <td class="center">${esc(data.billStateCode || data.stateCode || '')}</td>
        <td>${esc(data.shipState || data.state || '')}</td>
        <td class="center">${esc(data.shipStateCode || data.stateCode || '')}</td>
      </tr>
      <tr>
        <td class="field-label">GSTIN :</td>
        <td>${esc(data.gstinBill || data.gstin || '')}</td>
        <td class="field-label">GSTIN :</td>
        <td>${esc(data.gstinShip || data.gstin || '')}</td>
      </tr>
    </table>

    <table class="grid items-table">
      <tr>
        <th rowspan="2" style="width:4%">S.<br>No.</th>
        <th rowspan="2" style="width:24%">Description</th>
        <th rowspan="2" style="width:6%">Qty</th>
        <th rowspan="2" style="width:7%">Rate</th>
        <th rowspan="2" style="width:8%">Amount</th>
        <th colspan="2" style="width:12%">SGST</th>
        <th colspan="2" style="width:12%">CGST</th>
        <th colspan="2" style="width:12%">IGST</th>
        <th rowspan="2" style="width:9%">Total</th>
      </tr>
      <tr>
        <th>Rate</th><th>Amount</th>
        <th>Rate</th><th>Amount</th>
        <th>Rate</th><th>Amount</th>
      </tr>
      ${rowsHtml}
    </table>

    <div class="bottom-section">
      <div class="bank-details">
        <div class="title">OUR BANK DETAILS</div>
        <table>
          <tr><td class="b-label">Bank Name</td><td>: AXIS BANK LTD</td></tr>
          <tr><td class="b-label">A/c Name</td><td>: ${esc(profile.companyName)}</td></tr>
          <tr><td class="b-label">Current A/c No.</td><td>: 916020061629671</td></tr>
          <tr><td class="b-label">IFS CODE</td><td>: UTIB0000383</td></tr>
          <tr><td class="b-label">Branch</td><td>: Nizampura</td></tr>
        </table>
      </div>
      <div class="totals-box">
        <table>
          <tr><td class="t-label">Total Amount before Tax</td><td class="t-value">${fmtMoney(totals.totalAmt)}</td></tr>
          <tr><td class="t-label">SGST</td><td class="t-value">${fmtMoney(totals.totalSgst)}</td></tr>
          <tr><td class="t-label">CGST</td><td class="t-value">${fmtMoney(totals.totalCgst)}</td></tr>
          <tr><td class="t-label">IGST</td><td class="t-value">${fmtMoney(totals.totalIgst)}</td></tr>
          <tr><td class="t-label">Total Tax Amount</td><td class="t-value">${fmtMoney(totals.totalSgst + totals.totalCgst + totals.totalIgst)}</td></tr>
          <tr class="grand-total"><td class="t-label">Total Amount after Tax</td><td class="t-value">${fmtMoney(totals.totalAll)}</td></tr>
        </table>
      </div>
    </div>

    <div class="footer-section">
      <div class="terms">
        <div class="title">Terms &amp; conditions</div>
        <ol>
          <li>Subject to vadodara Juridiction.</li>
          <li>Payment Term as per our agree terms.</li>
          <li>Interest will charged @ 24% per annum if amount remaining unpaid from due date.</li>
        </ol>
      </div>
      <div class="signatory">
        <div class="cert">Certified that the particulars given above are true and correct</div>
        <div class="for-company">For ${esc(profile.companyName)}</div>
        <div class="seal-sign">
          <div class="seal">Seal</div>
          <div class="auth">Authorised signatory</div>
        </div>
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
    const target = host.querySelector('.ti-host');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#e5e5e5',
      width: 850,
      windowWidth: 850
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
