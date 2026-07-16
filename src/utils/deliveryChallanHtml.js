import { mergeCompanyProfile } from './companyProfile';
import {
  buildDcPrintLines,
  getDcAppData
} from './deliveryChallanLayout';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  fmtQty,
  PRINT_PAGE_W,
  renderHtmlToPdf,
  getSharedPrintStyles,
  buildPrintHeader,
  buildMetaStrip,
  buildPartyCard,
  buildStatusBar
} from './printTheme';

const DC_MIN_ROWS = 15;

export const buildDeliveryChallanHtml = (data, profileInput, appDataInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const appData = appDataInput || getDcAppData();
  const { lines, totalDrums, totalQty } = buildDcPrintLines(data, appData);

  const dcNo = escHtml(data.dcNo || 'N/A');
  const dcDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const poNo = escHtml(data.partyDocNo || '');
  const poDate = escHtml(formatPdfDateDmy(data.partyDocDate) || '');
  const companyState = escHtml(profile.state || 'Gujarat');
  
  const shipState = escHtml(data.shipState || data.billState || data.state || companyState);
  const stateCode = escHtml(data.shipStateCode || data.billStateCode || data.stateCode || '24');
  const partyGstin = escHtml(data.gstinShip || data.gstinBill || data.gstin || '');
  const partyName = escHtml(data.partyName || '');
  const address = escHtml(data.shipAddress || data.billAddress || data.address || '');
  const addressLines = address.split(/\r?\n/).filter(Boolean);

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  const cellDrums = (v) => (parseInt(v, 10) > 0 ? escHtml(String(parseInt(v, 10))) : '');
  const cellQty = (v) => (v !== '' && v != null && parseFloat(v) > 0 ? escHtml(v) : '');

  const bodyRows = [];
  let shownSr = false;
  lines.forEach((line) => {
    const isContent = line.kind === 'product' || line.kind === 'batch' || line.kind === 'empty';
    let sr = '';
    if (isContent && !shownSr) {
      sr = '1';
      shownSr = true;
    }
    bodyRows.push(`
      <tr>
        <td class="center">${sr}</td>
        <td class="left">${escHtml(line.text)}</td>
        <td class="center">${cellDrums(line.drums)}</td>
        <td class="center">${cellQty(line.qty)}</td>
      </tr>`);
  });
  const blanksCount = Math.max(0, DC_MIN_ROWS - bodyRows.length);
  for (let i = 0; i < blanksCount; i++) {
    bodyRows.push(`
      <tr class="filler-row"${i === blanksCount - 1 ? ' style="height: 100%;"' : ''}>
        <td></td><td></td><td></td><td></td>
      </tr>`);
  }

  const drumsTotal = parseInt(totalDrums, 10) > 0 ? String(parseInt(totalDrums, 10)) : '';
  const qtyTotal = parseFloat(totalQty) > 0 ? fmtQty(totalQty) : '';

  const rightColHtml = `
    <div class="data-row"><div class="data-label"><i class="bi bi-file-earmark-text"></i> Delivery Challan No.</div><div class="data-value">: &nbsp;${dcNo}</div></div>
    <div class="data-row"><div class="data-label"><i class="bi bi-calendar3"></i> Date</div><div class="data-value">: &nbsp;${dcDate}</div></div>
    <div class="data-row" style="margin-top: 5px;"><div class="data-label"><i class="bi bi-file-earmark-text"></i> PO / DC NO.</div><div class="data-value">: &nbsp;${poNo}</div></div>
    <div class="data-row"><div class="data-label" style="padding-left: 16px;">Date</div><div class="data-value">: &nbsp;${poDate}</div></div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delivery Challan - ${escHtml(profile.companyName)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        ${getSharedPrintStyles()}
        .dc-footer-grid {
            display: flex;
            gap: 12px;
            margin-top: 10px;
        }
        .dc-footer-grid > div:nth-child(1) { flex: 1.15; }
        .dc-footer-grid > div:nth-child(2) { flex: 0.85; }
        .dc-meta-card {
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            padding: 8px;
            display: flex;
            flex-direction: column;
        }
        .dc-meta-row { display: flex; margin-bottom: 6px; font-size: 11px; }
        .dc-meta-label { color: var(--text-black); font-weight: bold; width: 130px; flex-shrink: 0; }
        .dc-sign-stack { display: flex; flex-direction: column; gap: 12px; }
        .dc-sign-card {
            flex: 1;
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 8px;
            text-align: center;
        }
        .dc-sign-space { width: 80%; border-bottom: 1px solid #777777; margin-top: 40px; margin-bottom: 3px; }
    </style>
</head>
<body>
<div class="print-host">
<div class="pdf-page">
<div class="invoice-box">
    
    ${buildPrintHeader(profile, 'DELIVERY CHALLAN', '')}
    ${buildMetaStrip(profile, companyState, companyPan, rightColHtml)}

    <div class="billing-container" style="display: block;">
        ${buildPartyCard('CONSIGNEE / TO', 'bi bi-truck', partyName, addressLines, partyGstin, shipState, stateCode)}
    </div>

    <div class="table-container">
        <table class="invoice-table">
            <thead>
                <tr>
                    <th style="width: 8%;">Sr. No.</th>
                    <th style="width: 52%;">DESCRIPTION</th>
                    <th style="width: 20%;">TOTAL NO. OF DRUMS</th>
                    <th style="width: 20%;">QUANTITY (kg)</th>
                </tr>
            </thead>
            <tbody>
                ${bodyRows.join('')}
                <tr class="total-row">
                    <td colspan="2" class="center">TOTAL</td>
                    <td class="center">${drumsTotal}</td>
                    <td class="center">${qtyTotal}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="dc-footer-grid">
        <div class="dc-meta-card">
            <div class="box-heading"><i class="bi bi-truck"></i> TRANSPORT DETAILS</div>
            <div class="dc-meta-row"><div class="dc-meta-label">Vehicle No.</div><div class="data-value">: &nbsp;${escHtml(data.vehicleNo || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">Drivers name</div><div class="data-value">: &nbsp;${escHtml(data.driverName || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">Driver's Contact</div><div class="data-value">: &nbsp;${escHtml(data.driverContact || data.driverPhone || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">Transporter's Name</div><div class="data-value">: &nbsp;${escHtml(data.transporterName || data.transporter || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">GSTIN</div><div class="data-value">: &nbsp;${escHtml(profile.gstNumber || '')}</div></div>
        </div>
        <div class="dc-sign-stack">
            <div class="dc-sign-card">
                <span style="font-weight: bold; color: var(--primary-purple); font-size: 11px;">For ${escHtml(profile.companyName || 'UMA MICRON')}</span>
                <div class="dc-sign-space"></div>
                <span style="font-size: 10px; color: #333;">Authorised Signatory</span>
            </div>
            <div class="dc-sign-card">
                <span style="font-weight: bold; color: var(--primary-purple); font-size: 11px;">RECEIVED BY</span>
                <div class="dc-sign-space"></div>
                <span style="font-size: 10px; color: #333;">Authorised Signatory</span>
            </div>
        </div>
    </div>

    ${buildStatusBar('Page 1 of 1')}

</div>
</div>
</div>
</body>
</html>`;
};

export const renderDeliveryChallanPdf = async (data, { mode = 'save' } = {}) => {
  const appData = data.appData || getDcAppData();
  const html = buildDeliveryChallanHtml(data, data.companyProfile, appData);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'DC',
    docNo: data.dcNo || 'N/A',
    width: PRINT_PAGE_W,
    fitPage: true
  });
};
