import { mergeCompanyProfile } from './companyProfile';
import {
  buildDcPrintLines,
  formatDcDateSlash,
  getDcAppData
} from './deliveryChallanLayout';
import {
  IC,
  escHtml,
  fmtQty,
  getSharedPrintStyles,
  PRINT_PAGE_W,
  buildPrintCompanyHeader,
  buildPrintTitle,
  buildDetailsGrid,
  renderHtmlToPdf
} from './printTheme';

const DC_MIN_ROWS = 10;

export const buildDeliveryChallanHtml = (data, profileInput, appDataInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const appData = appDataInput || getDcAppData();
  const { lines, totalDrums, totalQty } = buildDcPrintLines(data, appData);

  const dcNo = escHtml(data.dcNo || 'N/A');
  const dcDate = escHtml(formatDcDateSlash(data.date) || 'N/A');
  const poNo = escHtml(data.partyDocNo || '');
  const poDate = escHtml(formatDcDateSlash(data.partyDocDate) || '');
  const shipState = escHtml(data.shipState || data.billState || data.state || profile.state || 'GUJARAT');
  const stateCode = escHtml(data.shipStateCode || data.billStateCode || data.stateCode || '24');
  const partyGstin = escHtml(data.gstinShip || data.gstinBill || data.gstin || '');
  const partyName = escHtml(data.partyName || '');
  const address = escHtml(data.shipAddress || data.billAddress || data.address || '');

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
        <td>${sr}</td>
        <td class="desc">${escHtml(line.text)}</td>
        <td>${cellDrums(line.drums)}</td>
        <td class="num">${cellQty(line.qty)}</td>
      </tr>`);
  });
  while (bodyRows.length < DC_MIN_ROWS) {
    bodyRows.push(`
      <tr class="blank-row">
        <td></td><td class="desc"></td><td></td><td class="num"></td>
      </tr>`);
  }

  const drumsTotal = parseInt(totalDrums, 10) > 0 ? String(parseInt(totalDrums, 10)) : '';
  const qtyTotal = parseFloat(totalQty) > 0 ? fmtQty(totalQty) : '';

  return `
<style>${getSharedPrintStyles()}
  .dc-footer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: auto;
    margin-bottom: 0;
  }
  .dc-meta-card {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .dc-meta-body { padding: 12px; flex: 1; }
  .dc-meta-row { display: flex; margin-bottom: 8px; font-size: 12.5px; }
  .dc-meta-label { color: var(--blue-dark); font-weight: bold; width: 150px; flex-shrink: 0; }
  .dc-sign-stack { display: flex; flex-direction: column; gap: 12px; }
  .dc-sign-card {
    flex: 1;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    min-height: 110px;
    display: flex;
    flex-direction: column;
  }
  .dc-sign-space { flex: 1; min-height: 56px; }
  .dc-sign-label {
    text-align: center;
    font-weight: bold;
    color: var(--blue-dark);
    padding: 8px 10px 12px;
    border-top: 1px solid var(--blue-dark);
    margin: 0 14px 10px;
    font-size: 12.5px;
  }
</style>
<div class="print-host">
  <div class="pdf-page">
    <div class="invoice-container">
      ${buildPrintCompanyHeader(profile, { showCopyBadge: false })}
      ${buildPrintTitle('DELIVERY CHALLAN')}
      ${buildDetailsGrid([
        ['Delivery Challan No.', dcNo, 'Date', dcDate],
        ['PO / DC NO.', poNo, 'Date', poDate],
        ['State', shipState, 'Code', stateCode],
        ['GSTIN', partyGstin, '', '']
      ])}

      <div class="parties-wrapper" style="margin-bottom:12px;">
        <div class="party-box" style="flex:1;">
          <div class="party-header">${IC.truck} CONSIGNEE / TO</div>
          <div class="party-body">
            <div class="party-row"><div class="party-label">Name :</div><div class="dotted-line">${partyName}</div></div>
            <div class="party-row"><div class="party-label">Address :</div><div class="dotted-line">${address}</div></div>
            <div class="party-row"><div class="party-label"></div><div class="dotted-line">&nbsp;</div></div>
            <div class="party-row"><div class="party-label">GSTIN :</div><div class="dotted-line">${partyGstin}</div></div>
          </div>
        </div>
      </div>

      <table class="items-table dc-items">
        <thead>
          <tr>
            <th style="width:8%">Sr. No.</th>
            <th style="width:52%">DESCRIPTION</th>
            <th style="width:20%">TOTAL NO. OF DRUMS</th>
            <th style="width:20%">QUANTITY (kg)</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows.join('')}
          <tr class="total-row">
            <td colspan="2" class="total-label">TOTAL</td>
            <td>${drumsTotal}</td>
            <td class="num">${qtyTotal}</td>
          </tr>
        </tbody>
      </table>

      <div class="dc-footer-grid">
        <div class="dc-meta-card">
          <div class="party-header">${IC.truck} TRANSPORT DETAILS</div>
          <div class="dc-meta-body">
            <div class="dc-meta-row"><div class="dc-meta-label">Vehicle No.</div><div>: ${escHtml(data.vehicleNo || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">Drivers name</div><div>: ${escHtml(data.driverName || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">Driver's Contact</div><div>: ${escHtml(data.driverContact || data.driverPhone || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">Transporter's Name</div><div>: ${escHtml(data.transporterName || data.transporter || '')}</div></div>
            <div class="dc-meta-row"><div class="dc-meta-label">GSTIN</div><div>: ${escHtml(profile.gstNumber || '')}</div></div>
          </div>
        </div>
        <div class="dc-sign-stack">
          <div class="dc-sign-card">
            <div class="party-header">${IC.pen} FOR ${escHtml(profile.companyName)}</div>
            <div class="dc-sign-space"></div>
            <div class="dc-sign-label">Authorised Signatory</div>
          </div>
          <div class="dc-sign-card">
            <div class="party-header">${IC.users} RECEIVED BY</div>
            <div class="dc-sign-space"></div>
            <div class="dc-sign-label">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
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
