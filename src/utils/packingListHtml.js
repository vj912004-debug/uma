import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  fmtMoney,
  PRINT_PAGE_W,
  renderHtmlToPdf,
  getSharedPrintStyles,
  buildPrintHeader,
  buildMetaStrip,
  buildStatusBar
} from './printTheme';

const PL_MIN_ROWS = 18;

const parseWeight = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  return parseFloat(value) || 0;
};

const displayWeight = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  return fmtMoney(value);
};

export const buildPackingListHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const batches = data.batches || [];
  const companyState = escHtml(profile.state || 'Gujarat');
  const plNo = escHtml(data.plNo || 'N/A');
  const plDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  let totalGross = 0;
  let totalTare = 0;
  let totalNet = 0;

  const rows = batches.map((batch, index) => {
    const gross = parseWeight(batch.gross);
    const tare = parseWeight(batch.tare);
    const net = batch.net !== '' && batch.net !== null && batch.net !== undefined
      ? parseWeight(batch.net)
      : Math.max(0, gross - tare);
    totalGross += gross;
    totalTare += tare;
    totalNet += net;

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="left">${escHtml(batch.productName || data.productName || '')}</td>
        <td class="center">${escHtml(batch.batchNo || '')}</td>
        <td class="center">${escHtml(batch.drumNo ?? '')}</td>
        <td>${displayWeight(batch.gross)}</td>
        <td>${displayWeight(batch.tare)}</td>
        <td>${fmtMoney(net)}</td>
      </tr>`;
  });

  for (let i = batches.length; i < PL_MIN_ROWS; i += 1) {
    rows.push(`
      <tr class="filler-row">
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`);
  }

  const declaredNet = parseFloat(data.totalWeight);
  const finalNet = Number.isFinite(declaredNet) && declaredNet > 0 ? declaredNet : totalNet;
  const totalDrums = parseInt(data.totalDrums, 10) || batches.length;

  const rightColHtml = `
    <div class="data-row"><div class="data-label"><i class="bi bi-file-earmark-text"></i> PL No.</div><div class="data-value">: &nbsp;${plNo}</div></div>
    <div class="data-row"><div class="data-label"><i class="bi bi-calendar3"></i> PL Date</div><div class="data-value">: &nbsp;${plDate}</div></div>
    <div class="data-row" style="margin-top:5px;"><div class="data-label">Total Drums</div><div class="data-value">: &nbsp;${escHtml(totalDrums)}</div></div>
    <div class="data-row"><div class="data-label">Total Net Wt.</div><div class="data-value">: &nbsp;${fmtMoney(finalNet)} Kg</div></div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Packing List - ${escHtml(profile.companyName)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <style>
    ${getSharedPrintStyles()}
    .pl-product-box {
      border: 1.5px solid var(--border-purple);
      border-radius: 6px;
      margin-top: 10px;
      overflow: hidden;
    }
    .pl-product-title {
      background: var(--light-purple-bg);
      color: var(--primary-purple);
      border-bottom: 1.5px solid var(--border-purple);
      padding: 5px 8px;
      font-weight: bold;
    }
    .pl-product-body {
      padding: 8px;
      display: flex;
      justify-content: space-between;
      gap: 15px;
      font-size: 11px;
    }
    .pl-summary {
      display: flex;
      gap: 12px;
      margin-top: 10px;
    }
    .pl-summary-card {
      flex: 1;
      border: 1.5px solid var(--border-purple);
      border-radius: 6px;
      overflow: hidden;
    }
    .pl-summary-label {
      background: var(--light-purple-bg);
      color: var(--primary-purple);
      padding: 5px 8px;
      font-weight: bold;
      border-bottom: 1px solid var(--border-purple);
    }
    .pl-summary-value {
      padding: 8px;
      text-align: center;
      font-size: 14px;
      font-weight: bold;
    }
    .pl-signatures {
      display: flex;
      gap: 12px;
      margin-top: 10px;
    }
    .pl-sign-box {
      flex: 1;
      min-height: 90px;
      border: 1.5px solid var(--border-purple);
      border-radius: 6px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
    }
    .pl-sign-line {
      width: 75%;
      margin: 45px auto 0;
      border-top: 1px solid #777;
      padding-top: 4px;
    }
  </style>
</head>
<body>
<div class="print-host">
<div class="pdf-page">
<div class="invoice-box">
  ${buildPrintHeader(profile, 'PACKING LIST', '')}
  ${buildMetaStrip(profile, companyState, companyPan, rightColHtml)}

  <div class="pl-product-box">
    <div class="pl-product-title"><i class="bi bi-box-seam"></i> PRODUCT DETAILS</div>
    <div class="pl-product-body">
      <div><strong>Product Name:</strong> ${escHtml(data.productName || '')}</div>
      <div><strong>Total Drums:</strong> ${escHtml(totalDrums)}</div>
      <div><strong>Total Quantity:</strong> ${fmtMoney(finalNet)} Kg</div>
    </div>
  </div>

  <div class="table-container">
    <table class="invoice-table">
      <thead>
        <tr>
          <th style="width:6%;">Sr. No.</th>
          <th style="width:28%;">Product Name</th>
          <th style="width:15%;">Batch No.</th>
          <th style="width:10%;">Drum No.</th>
          <th style="width:14%;">Gross Wt. (Kg)</th>
          <th style="width:13%;">Tare Wt. (Kg)</th>
          <th style="width:14%;">Net Wt. (Kg)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
        <tr class="total-row">
          <td colspan="4" class="center">TOTAL</td>
          <td>${fmtMoney(totalGross)}</td>
          <td>${fmtMoney(totalTare)}</td>
          <td>${fmtMoney(finalNet)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="pl-summary">
    <div class="pl-summary-card">
      <div class="pl-summary-label">TOTAL DRUMS</div>
      <div class="pl-summary-value">${escHtml(totalDrums)}</div>
    </div>
    <div class="pl-summary-card">
      <div class="pl-summary-label">TOTAL NET WEIGHT</div>
      <div class="pl-summary-value">${fmtMoney(finalNet)} Kg</div>
    </div>
  </div>

  <div class="pl-signatures">
    <div class="pl-sign-box">
      <strong style="color:var(--primary-purple);">Prepared By</strong>
      <div class="pl-sign-line">Signature</div>
    </div>
    <div class="pl-sign-box">
      <strong style="color:var(--primary-purple);">Checked By</strong>
      <div class="pl-sign-line">Signature</div>
    </div>
    <div class="pl-sign-box">
      <strong style="color:var(--primary-purple);">For ${escHtml(profile.companyName || 'UMA MICRON')}</strong>
      <div class="pl-sign-line">Authorised Signatory</div>
    </div>
  </div>

  ${buildStatusBar('Page 1 of 1', 'This is a computer generated packing list.')}
</div>
</div>
</div>
</body>
</html>`;
};

export const renderPackingListPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPackingListHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'PL',
    docNo: data.plNo || 'N/A',
    width: PRINT_PAGE_W,
    fitPage: true
  });
};
