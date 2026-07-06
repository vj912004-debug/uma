import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatTiHeaderAddressLines, getTiContactLine, mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  calcTiTotals,
  formatPdfDateSlash,
  getPartyAddressRows
} from './taxInvoiceLayout';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtMoney = (n) => (parseFloat(n) || 0).toFixed(2);

const fmtQty = (n) => {
  const v = parseFloat(n);
  if (!v) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

const DEFAULT_PI_LOGO_HTML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 88" width="140" height="88" aria-label="UMA MICRON Logo">
  <ellipse cx="48" cy="44" rx="32" ry="34" fill="none" stroke="#009900" stroke-width="2.5"/>
  <ellipse cx="64" cy="44" rx="32" ry="34" fill="none" stroke="#cc0000" stroke-width="2.5"/>
  <text x="32" y="56" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="700" fill="#cc0000">U</text>
  <text x="58" y="56" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="700" fill="#009900">M</text>
</svg>`;

const PI_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .pi-host {
    font-family: Arial, Helvetica, sans-serif;
    background: #e9e9e9;
    padding: 20px;
    width: 950px;
    color: #000;
  }
  .invoice {
    width: 100%;
    background: #fff;
  }
  table.grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.grid td, table.grid th {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: middle;
    font-size: 12.5px;
  }
  .center { text-align: center; }
  .left { text-align: left; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .fill { background: #bdd7ee; }
  .logo-img { display: inline-block; width: 140px; height: auto; }
  .company-name {
    font-family: 'Times New Roman', Times, serif;
    font-size: 22px;
    font-weight: bold;
    margin: 0 0 3px 0;
    letter-spacing: 0.3px;
  }
  .company-sub {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12px;
    font-weight: bold;
    margin: 1px 0;
  }
  table.grid td.title-bar { font-size: 26px; font-weight: bold; padding: 8px 0; }
  .items-table th { font-size: 11.5px; background: #bdd7ee; }
  .items-table td { font-size: 11.5px; }
  .bank-label { width: 140px; }
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
      <tr class="items-table">
        <td class="center">${sr}</td>
        <td class="left">${esc(label)}</td>
        <td class="center">${esc(fmtQty(qty))}</td>
        <td class="center">${rate ? esc(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="right">${fmtMoney(amt)}</td>
        <td class="center">${sgstRate || ''}</td>
        <td class="right">${fmtMoney(sgstAmt)}</td>
        <td class="center">${cgstRate || ''}</td>
        <td class="right">${fmtMoney(cgstAmt)}</td>
        <td class="center"></td>
        <td class="right">${fmtMoney(0)}</td>
        <td class="right">${fmtMoney(rowTotal)}</td>
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

  return {
    rowsHtml: rows.join(''),
    totals: { totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty }
  };
};

export const buildPerformaInvoiceHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const addressLines = formatTiHeaderAddressLines(profile);
  const contact = getTiContactLine(profile);
  const logoSrc = profile.logo && profile.logo.startsWith('data:image') ? profile.logo : '';
  const logoHtml = logoSrc
    ? `<img class="logo-img" src="${logoSrc}" alt="UMA MICRON Logo">`
    : DEFAULT_PI_LOGO_HTML;

  const docNo = esc(data.invoiceNo || 'N/A');
  const docDate = esc(formatPdfDateSlash(data.date) || 'N/A');
  const dcNo = esc(data.dcNo || '');
  const dcDate = esc(formatPdfDateSlash(data.dcDate || data.date) || docDate);
  const companyState = esc(profile.state || 'GUJARAT');
  const companyStateCode = esc('24');

  const { rowsHtml, totals } = buildItemRowsHtml(data);
  const totalTax = totals.totalSgst + totals.totalCgst + totals.totalIgst;
  const partyAddressHtml = getPartyAddressRows(
    data.billAddress || data.address || '',
    data.shipAddress || data.address || ''
  ).map((row, i) => {
    if (i === 0) {
      return `
      <tr>
        <td colspan="2" class="left bold">Address :</td>
        <td colspan="4" class="left">${esc(row.bill)}</td>
        <td colspan="2" class="left bold">Address :</td>
        <td colspan="4" class="left">${esc(row.ship)}</td>
      </tr>`;
    }
    return `
      <tr>
        <td colspan="2"></td>
        <td colspan="4" class="left">${esc(row.bill)}</td>
        <td colspan="2"></td>
        <td colspan="4" class="left">${esc(row.ship)}</td>
      </tr>`;
  }).join('');

  return `
<style>${PI_STYLES}</style>
<div class="pi-host">
  <div class="invoice">
    <table class="grid">
      <colgroup>
        <col style="width:3%"><col style="width:21%"><col style="width:5%"><col style="width:6%">
        <col style="width:8%"><col style="width:5%"><col style="width:8%"><col style="width:5%">
        <col style="width:8%"><col style="width:5%"><col style="width:8%"><col style="width:9%">
      </colgroup>

      <tr>
        <td colspan="12" style="padding:8px 0; position:relative;">
          <div style="position:absolute; left:20px; top:50%; transform:translateY(-50%);">${logoHtml}</div>
          <div style="text-align:center;">
            <p class="company-name">${esc(profile.companyName)}</p>
            <p class="company-sub">${esc(addressLines[0] || '')}</p>
            <p class="company-sub">${esc(addressLines[1] || '')}</p>
            <p class="company-sub">${esc(contact)}</p>
            <p class="company-sub">GSTIN: ${esc(profile.gstNumber)}</p>
          </div>
        </td>
      </tr>

      <tr>
        <td colspan="12" class="center bold fill title-bar">Performa Invoice</td>
      </tr>

      <tr>
        <td colspan="2" class="left bold">PI No:</td>
        <td colspan="4" class="left">${docNo}</td>
        <td colspan="3" class="center bold">Delivery Challan No.</td>
        <td colspan="3" class="center">${dcNo}</td>
      </tr>
      <tr>
        <td colspan="2" class="left bold">PI Date:</td>
        <td colspan="4" class="left">${docDate}</td>
        <td colspan="3" class="center bold">Date :</td>
        <td colspan="3" class="center">${dcDate}</td>
      </tr>
      <tr>
        <td colspan="6" class="left bold">State : ${companyState}</td>
        <td colspan="3" class="center bold">Code</td>
        <td colspan="3" class="center">${companyStateCode}</td>
      </tr>

      <tr>
        <td colspan="6" class="center bold fill">Bill to Party</td>
        <td colspan="6" class="center bold fill">Ship to Party</td>
      </tr>
      <tr>
        <td colspan="2" class="left bold">Name :</td>
        <td colspan="4" class="left">${esc(data.partyName || '')}</td>
        <td colspan="2" class="left bold">Name :</td>
        <td colspan="4" class="left">${esc(data.shipName || data.partyName || '')}</td>
      </tr>
      ${partyAddressHtml}
      <tr>
        <td colspan="2" class="left bold">State :</td>
        <td colspan="2" class="left">${esc(data.billState || data.state || '')}</td>
        <td class="center bold">Code</td>
        <td class="center">${esc(data.billStateCode || data.stateCode || '')}</td>
        <td colspan="2" class="left bold">State :</td>
        <td colspan="2" class="left">${esc(data.shipState || data.state || '')}</td>
        <td class="center bold">Code</td>
        <td class="center">${esc(data.shipStateCode || data.stateCode || '')}</td>
      </tr>
      <tr>
        <td colspan="2" class="left bold">GSTIN :</td>
        <td colspan="4" class="left">${esc(data.gstinBill || data.gstin || '')}</td>
        <td colspan="2" class="left bold">GSTIN :</td>
        <td colspan="4" class="left">${esc(data.gstinShip || data.gstin || '')}</td>
      </tr>

      <tr class="items-table">
        <th rowspan="2">S.<br>No.</th>
        <th rowspan="2">Description</th>
        <th rowspan="2">Qty</th>
        <th rowspan="2">Rate</th>
        <th rowspan="2">Amount</th>
        <th colspan="2">SGST</th>
        <th colspan="2">CGST</th>
        <th colspan="2">IGST</th>
        <th rowspan="2">Total</th>
      </tr>
      <tr class="items-table">
        <th>Rate</th><th>Amount</th>
        <th>Rate</th><th>Amount</th>
        <th>Rate</th><th>Amount</th>
      </tr>

      ${rowsHtml}

      <tr class="fill bold">
        <td colspan="2" class="center">Total</td>
        <td class="center">${totals.totalQty || 0}</td>
        <td></td>
        <td class="right">${fmtMoney(totals.totalAmt)}</td>
        <td></td>
        <td class="right">${fmtMoney(totals.totalSgst)}</td>
        <td></td>
        <td class="right">${fmtMoney(totals.totalCgst)}</td>
        <td></td>
        <td class="right">${fmtMoney(totals.totalIgst)}</td>
        <td class="right">${fmtMoney(totals.totalAll)}</td>
      </tr>

      <tr>
        <td colspan="6" rowspan="6" class="left" style="vertical-align:top;">
          <div class="bold" style="margin-bottom:4px;">OUR BANK DETAILS</div>
          <div style="display:flex;"><div class="bank-label bold">Bank Name</div><div>: AXIS BANK LTD</div></div>
          <div style="display:flex;"><div class="bank-label bold">A/c Name</div><div>: ${esc(profile.companyName)}</div></div>
          <div style="display:flex;"><div class="bank-label bold">Current A/c No.</div><div>: 916020061629671</div></div>
          <div style="display:flex;"><div class="bank-label bold">IFS CODE</div><div>: UTIB0000383</div></div>
          <div style="display:flex;"><div class="bank-label bold">Branch</div><div>: Nizampura</div></div>
        </td>
        <td colspan="4" class="left bold">Total Amount before Tax</td>
        <td colspan="2" class="right">${fmtMoney(totals.totalAmt)}</td>
      </tr>
      <tr>
        <td colspan="4" class="left bold">CGST</td>
        <td colspan="2" class="right">${fmtMoney(totals.totalCgst)}</td>
      </tr>
      <tr>
        <td colspan="4" class="left bold">SGST</td>
        <td colspan="2" class="right">${fmtMoney(totals.totalSgst)}</td>
      </tr>
      <tr>
        <td colspan="4" class="left bold">IGST</td>
        <td colspan="2" class="right">${fmtMoney(totals.totalIgst)}</td>
      </tr>
      <tr>
        <td colspan="4" class="left bold">Total Tax Amount</td>
        <td colspan="2" class="right">${fmtMoney(totalTax)}</td>
      </tr>
      <tr>
        <td colspan="4" class="left bold fill">Total Amount after Tax</td>
        <td colspan="2" class="right bold fill">${fmtMoney(totals.totalAll)}</td>
      </tr>

      <tr>
        <td colspan="5" rowspan="6" class="left" style="font-size:11px; vertical-align:top;">
          <b>NOTE:</b><br><br>
          <b>PACKING MATERIALS AND TRANSPORTATION<br>CHARGES WILL BE CHAGRE EXTRA AS ACTUAL</b><br><br>
          <b>Terms &amp; conditions</b><br>
          1) Subject to vadodara Juridiction.<br>
          2) Payment 100% ADVANCE AGAINST PI
        </td>
        <td colspan="7" class="left" style="font-size:11px; vertical-align:top;">
          Ceritified that the particulars given above are true and correct
        </td>
      </tr>
      <tr>
        <td colspan="7" class="center bold" style="font-size:12.5px;">For ${esc(profile.companyName)}</td>
      </tr>
      <tr>
        <td colspan="3" rowspan="4">&nbsp;</td>
        <td colspan="4" rowspan="4">&nbsp;</td>
      </tr>
      <tr></tr>
      <tr></tr>
      <tr></tr>

      <tr>
        <td colspan="5" class="left bold" style="font-size:11px;">this is system generated PI so no need to sign</td>
        <td colspan="3" class="center bold">Seal</td>
        <td colspan="4" class="center bold">Authorised signatory</td>
      </tr>
    </table>
  </div>
</div>`;
};

export const renderPerformaInvoicePdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPerformaInvoiceHtml(data, data.companyProfile);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const target = host.querySelector('.pi-host');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#e9e9e9',
      width: 950,
      windowWidth: 950
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
      if (win) win.document.title = `PI_${docNo}`;
    } else {
      pdf.save(`PI_${docNo}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
