import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateSlash } from './taxInvoiceLayout';
import {
  IC,
  escHtml,
  getSharedPrintStyles,
  buildPrintCompanyHeader,
  buildPrintTitle,
  buildDetailsGrid,
  renderHtmlToPdf
} from './printTheme';

const bprCheck = (val) => (val === true ? 'Yes' : val === false ? '' : (val || ''));

const fmtWt = (v) => {
  if (v === '' || v === undefined || v === null) return '';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (Number.isNaN(n) || n === 0) return '';
  return n.toFixed(2);
};

const calcNet = (row) => {
  if (row.net !== '' && row.net !== undefined && row.net !== null && row.net !== 0) {
    return typeof row.net === 'number' ? row.net.toFixed(2) : row.net;
  }
  const g = parseFloat(row.gross);
  const t = parseFloat(row.tare);
  if (!Number.isNaN(g) && !Number.isNaN(t) && row.gross !== '' && row.tare !== '') {
    return Math.max(0, g - t).toFixed(2);
  }
  return '';
};

export const buildBprHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const batchNos = [...new Set((data.receivedBatches || []).map((b) => b.batchNo).filter(Boolean))];
  const primaryBatchNo = batchNos.join(', ') || data.batchNo || '';
  const totalNoBatch = batchNos.length || data.totalNoBatch || '';
  const totalDrums = data.totalDrums || (data.receivedBatches || []).length || '';
  const pc = data.packingConsumables || {};
  const dispatchedNet = typeof data.totalDispatchedNet === 'number'
    ? data.totalDispatchedNet.toFixed(2)
    : (parseFloat(data.totalDispatchedNet) || 0).toFixed(2);

  const pressureRows = (data.pressureReadings && data.pressureReadings.length)
    ? data.pressureReadings.slice(0, 4)
    : [{
      sp: data.pressureMetrics?.feedingSP || '',
      dp: data.pressureMetrics?.feedingDP || '',
      tp: data.pressureMetrics?.feedingTP || '',
      fp: data.pressureMetrics?.millingFP || data.pressureMetrics?.grindingPressure || '',
      fip: data.pressureMetrics?.millingFiP || data.pressureMetrics?.injectionPressure || ''
    }];

  while (pressureRows.length < 4) pressureRows.push({ sp: '', dp: '', tp: '', fp: '', fip: '' });

  const received = data.receivedBatches || [];
  const dispatched = data.dispatchedBatches || [];
  const rowCount = Math.max(received.length, dispatched.length, 12);
  const packingRows = [];
  for (let i = 0; i < rowCount; i++) {
    const r = received[i] || {};
    const d = dispatched[i] || {};
    packingRows.push(`
      <tr>
        <td>${escHtml(r.batchNo || '')}</td>
        <td>${escHtml(r.drumNo || '')}</td>
        <td>${fmtWt(r.gross)}</td>
        <td>${fmtWt(r.tare)}</td>
        <td>${calcNet(r)}</td>
        <td>${escHtml(d.batchNo || '')}</td>
        <td>${escHtml(d.drumNo || '')}</td>
        <td>${fmtWt(d.gross)}</td>
        <td>${fmtWt(d.tare)}</td>
        <td>${calcNet(d)}</td>
      </tr>`);
  }

  const bprNo = escHtml(data.bprNo || 'N/A');
  const bprDate = escHtml(formatPdfDateSlash(data.date) || '');

  return `
<style>${getSharedPrintStyles()}
  .bpr-section { border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
  .bpr-section .party-header { font-size: 11.5px; }
  .bpr-body { padding: 8px 10px; }
  .bpr-grid { width: 100%; border-collapse: collapse; }
  .bpr-grid td { border: 1px solid var(--border-color); padding: 5px 6px; font-size: 11px; vertical-align: middle; }
  .bpr-grid td.lbl { color: var(--blue-dark); font-weight: bold; width: 28%; background: #f5f8fc; }
  .checklist-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; font-size: 11px; }
  .checklist-row:last-child { border-bottom: none; }
  .page-break { page-break-before: always; margin-top: 24px; }
</style>
<div class="print-host">
  <div class="invoice-container">
    ${buildPrintCompanyHeader(profile, { showCopyBadge: false })}
    ${buildPrintTitle('BATCH PROCESSING RECORD')}
    ${buildDetailsGrid([
      ['BPR No.', bprNo, 'Date', bprDate],
      ['Customer Name', escHtml(data.partyName || data.customerName || ''), 'Product Name', escHtml(data.productName || '')],
      ['Total Quantity (kg)', escHtml(data.totalInputQty ?? ''), 'Batch No.', escHtml(primaryBatchNo)],
      ['Total No. Batch', escHtml(totalNoBatch), 'Total Drum', escHtml(totalDrums)]
    ])}

    <div class="bpr-section">
      <div class="party-header">${IC.file} PROCESS SCHEDULE</div>
      <div class="bpr-body" style="padding:0;">
        <table class="bpr-grid">
          <tr>
            <td class="lbl">Material Received</td>
            <td>${escHtml(formatPdfDateSlash(data.materialReceivedDate) || '')} ${escHtml(data.materialReceivedTime || '')}</td>
            <td class="lbl">Committed</td>
            <td>${escHtml(formatPdfDateSlash(data.committedDate) || '')} ${escHtml(data.committedTime || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Processing Start</td>
            <td>${escHtml(formatPdfDateSlash(data.processingStartDate) || '')} ${escHtml(data.processingStartTime || '')}</td>
            <td class="lbl">Supervisor</td>
            <td>${escHtml(data.processingSupervisor || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Particle size require</td>
            <td>${escHtml(data.psdRequirement || '')}</td>
            <td class="lbl">Sizing report require</td>
            <td>${escHtml(data.sizingReportRequired || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Particle size result</td>
            <td>${escHtml(data.particleSizeResult || '')}</td>
            <td class="lbl">PSD Note</td>
            <td>${escHtml(data.psdNote || '')}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="bpr-section">
      <div class="party-header">${IC.file} CLEANING CHECKLIST</div>
      <div class="bpr-body">
        <div class="checklist-row"><span>Is the Micronizar cleaned?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.equipmentCleaned))}</b></div>
        <div class="checklist-row"><span>Is the processesing Area Cleaned?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.areaCleaned))}</b></div>
        <div class="checklist-row"><span>Is the filter Bag before process packed and labeled in LDPE Bag?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.lineClearance))}</b></div>
        <div class="checklist-row"><span>Is the bag is clean and black spot free?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.bagClean))}</b></div>
      </div>
    </div>

    <div class="bpr-section">
      <div class="party-header">${IC.file} PRESSURE READINGS</div>
      <div class="bpr-body" style="padding:0;">
        <table class="items-table" style="margin:0;border:none;">
          <thead>
            <tr>
              <th colspan="3">Feeding pressure</th>
              <th colspan="2">Milling Pressure</th>
            </tr>
            <tr>
              <th>S.P.</th><th>D.P.</th><th>T.P.</th><th>F.P.</th><th>Fi.P.</th>
            </tr>
          </thead>
          <tbody>
            ${pressureRows.map((r) => `
              <tr>
                <td>${escHtml(r.sp || '')}</td>
                <td>${escHtml(r.dp || '')}</td>
                <td>${escHtml(r.tp || '')}</td>
                <td>${escHtml(r.fp || '')}</td>
                <td>${escHtml(r.fip || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="bpr-section">
      <div class="party-header">${IC.file} PACKING MATERIALS &amp; DISPATCH</div>
      <div class="bpr-body" style="padding:0;">
        <table class="bpr-grid">
          <tr>
            <td class="lbl">White LD Bags</td><td>${escHtml(pc.whiteLdBags || pc.linersUsed || '')}</td>
            <td class="lbl">Black LD Bags</td><td>${escHtml(pc.blackLdBags || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Brown Tapes</td><td>${escHtml(pc.brownTapes || '')}</td>
            <td class="lbl">Drum Used</td><td>${escHtml(pc.drumUsed || pc.fiberDrumsUsed || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Micronized Net Wt</td><td>${dispatchedNet !== '0.00' ? dispatchedNet : ''}</td>
            <td class="lbl">Lumps Net Wt</td><td>${escHtml(data.lumpsNetWeight || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Floor Dust Net Wt</td><td>${escHtml(data.floorDustNetWeight || '')}</td>
            <td class="lbl">Process Loss</td><td>${escHtml(data.processLoss || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Process completion</td>
            <td colspan="3">${escHtml(formatPdfDateSlash(data.processCompletionDate) || '')} ${escHtml(data.processCompletionTime || '')}</td>
          </tr>
          <tr>
            <td class="lbl">Remark</td>
            <td colspan="3">${escHtml(data.remark || data.dispatchRemark || '')}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="sign-box" style="flex:1;">
        <div class="party-header">${IC.pen} OPERATOR SIGNATURE</div>
        <div class="sign-area"><div class="sign-text">Operator</div></div>
      </div>
      <div class="seal-box" style="flex:1;">${IC.stamp}<div>Seal</div></div>
      <div class="sign-box" style="flex:1;">
        <div class="party-header">${IC.pen} PLANT SUPERVISOR</div>
        <div class="sign-area"><div class="sign-text">Supervisor</div></div>
      </div>
    </div>
  </div>

  <div class="invoice-container page-break" style="margin-top:20px;">
    ${buildPrintCompanyHeader(profile, { showCopyBadge: false })}
    ${buildPrintTitle('BATCH PACKING RECORD')}
    ${buildDetailsGrid([
      ['BPR No.', bprNo, 'Date', bprDate],
      ['Product', escHtml(data.productName || ''), 'Customer', escHtml(data.partyName || data.customerName || '')]
    ])}
    <table class="items-table">
      <thead>
        <tr>
          <th colspan="5">Received Materials Weight</th>
          <th colspan="5">Dispatched (micronized) Materials Weight</th>
        </tr>
        <tr>
          <th>Batch No.</th><th>Drum No</th><th>Gross</th><th>Tare</th><th>Net</th>
          <th>Batch No.</th><th>Drum No</th><th>Gross</th><th>Tare</th><th>Net</th>
        </tr>
      </thead>
      <tbody>
        ${packingRows.join('')}
        <tr class="total-row">
          <td colspan="4" class="total-label">Micronized Material Net Weight</td>
          <td>${dispatchedNet !== '0.00' ? dispatchedNet : ''}</td>
          <td colspan="5"></td>
        </tr>
      </tbody>
    </table>
    <div class="footer-bottom">
      <div class="sign-box" style="flex:1;">
        <div class="party-header">${IC.pen} PLANT SUPERVISOR SIGN</div>
        <div class="sign-area"><div class="sign-text">Authorised Signatory</div></div>
      </div>
    </div>
  </div>
</div>`;
};

export const renderBprPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildBprHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'BPR',
    docNo: data.bprNo || 'N/A',
    width: 850
  });
};
