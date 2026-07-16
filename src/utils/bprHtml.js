import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateSlash } from './taxInvoiceLayout';
import {
  escHtml,
  fmtQty,
  getSharedPrintStyles,
  PRINT_PAGE_W,
  buildPrintHeader,
  buildStatusBar,
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
    return typeof row.net === 'number' ? row.net.toFixed(2) : String(row.net);
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

  const customerName = data.partyName || data.customerName || data.party || '';
  const productName = data.productName || data.product || '';

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
  const rowCount = Math.max(received.length, dispatched.length, 15);
  const packingRows = [];
  for (let i = 0; i < rowCount; i++) {
    const r = received[i] || {};
    const d = dispatched[i] || {};
    packingRows.push(`
      <tr>
        <td class="center">${escHtml(r.batchNo || '')}</td>
        <td class="center">${escHtml(r.drumNo || '')}</td>
        <td>${fmtWt(r.gross)}</td>
        <td>${fmtWt(r.tare)}</td>
        <td>${calcNet(r)}</td>
        <td class="center">${escHtml(d.batchNo || '')}</td>
        <td class="center">${escHtml(d.drumNo || '')}</td>
        <td>${fmtWt(d.gross)}</td>
        <td>${fmtWt(d.tare)}</td>
        <td>${calcNet(d)}</td>
      </tr>`);
  }

  const bprNo = escHtml(data.bprNo || 'N/A');
  const bprDate = escHtml(formatPdfDateSlash(data.date) || '');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BPR - ${escHtml(profile.companyName)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        ${getSharedPrintStyles()}
        .bpr-section { border: 1.5px solid var(--border-purple); border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
        .bpr-header {
            background-color: var(--light-purple-bg);
            color: var(--primary-purple);
            font-weight: bold;
            font-size: 11px;
            padding: 5px 8px;
            border-bottom: 1.5px solid var(--border-purple);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .bpr-body { padding: 8px 10px; }
        .bpr-grid { width: 100%; border-collapse: collapse; }
        .bpr-grid td { border: 1px solid var(--grid-line-purple); padding: 5px 6px; font-size: 11px; vertical-align: middle; }
        .bpr-grid td.lbl { color: var(--text-black); font-weight: bold; width: 28%; background: var(--light-purple-bg); }
        .checklist-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted var(--border-purple); font-size: 11px; }
        .checklist-row:last-child { border-bottom: none; }
        .bpr-meta-grid {
            display: flex; flex-wrap: wrap;
            border: 1.5px solid var(--border-purple); border-radius: 6px; overflow: hidden; margin-bottom: 12px;
        }
        .bpr-meta-item { padding: 6px 10px; border-right: 1px solid var(--border-purple); border-bottom: 1px solid var(--border-purple); display: flex; align-items: center; font-size: 11px; width: 32%; box-sizing: border-box; }
        .bpr-meta-item.label { color: var(--primary-purple); font-weight: bold; background: var(--light-purple-bg); width: 18%; }
        .bpr-meta-grid .bpr-meta-item:nth-child(4n) { border-right: none; }
        .bpr-meta-grid .bpr-meta-item:nth-last-child(-n+4) { border-bottom: none; }
        .footer-bottom { display: flex; gap: 12px; margin-top: auto; }
        .sign-box { flex: 1; border: 1.5px solid var(--border-purple); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; min-height: 90px; }
        .sign-area { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 10px; text-align: center; }
        .sign-text { border-top: 1px solid #777777; padding-top: 5px; color: var(--text-black); font-weight: bold; width: 90%; margin: 0 auto; font-size: 10px; }
        .seal-box {
            flex: 1; border: 1.5px dashed var(--border-purple); border-radius: 6px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: var(--primary-purple); font-weight: bold; gap: 5px; min-height: 90px; font-size: 11px;
        }
    </style>
</head>
<body>
<div class="print-host">
  
  <!-- PAGE 1: PROCESS SCHEDULE -->
  <div class="pdf-page">
    <div class="invoice-box">
      ${buildPrintHeader(profile, 'BATCH PROCESSING RECORD', '')}
      
      <div class="bpr-meta-grid">
        <div class="bpr-meta-item label">BPR No.</div><div class="bpr-meta-item">${bprNo}</div>
        <div class="bpr-meta-item label">Date</div><div class="bpr-meta-item">${bprDate}</div>
        <div class="bpr-meta-item label">Customer Name</div><div class="bpr-meta-item">${escHtml(customerName)}</div>
        <div class="bpr-meta-item label">Product Name</div><div class="bpr-meta-item">${escHtml(productName)}</div>
        <div class="bpr-meta-item label">Total Quantity (kg)</div><div class="bpr-meta-item">${escHtml(data.totalInputQty ?? '')}</div>
        <div class="bpr-meta-item label">Batch No.</div><div class="bpr-meta-item">${escHtml(primaryBatchNo)}</div>
        <div class="bpr-meta-item label">Total No. Batch</div><div class="bpr-meta-item">${escHtml(totalNoBatch)}</div>
        <div class="bpr-meta-item label">Total Drum</div><div class="bpr-meta-item">${escHtml(totalDrums)}</div>
      </div>

      <div class="bpr-section">
        <div class="bpr-header"><i class="bi bi-file-earmark-text"></i> PROCESS SCHEDULE</div>
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
        <div class="bpr-header"><i class="bi bi-card-checklist"></i> CLEANING CHECKLIST</div>
        <div class="bpr-body">
          <div class="checklist-row"><span>Is the Micronizar cleaned?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.equipmentCleaned))}</b></div>
          <div class="checklist-row"><span>Is the processesing Area Cleaned?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.areaCleaned))}</b></div>
          <div class="checklist-row"><span>Is the filter Bag before process packed and labeled in LDPE Bag?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.lineClearance))}</b></div>
          <div class="checklist-row"><span>Is the bag is clean and black spot free?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.bagClean))}</b></div>
        </div>
      </div>

      <div class="bpr-section">
        <div class="bpr-header"><i class="bi bi-speedometer2"></i> PRESSURE READINGS</div>
        <div class="bpr-body" style="padding:0;">
          <table class="invoice-table" style="border:none;">
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
                  <td class="center">${escHtml(r.sp || '')}</td>
                  <td class="center">${escHtml(r.dp || '')}</td>
                  <td class="center">${escHtml(r.tp || '')}</td>
                  <td class="center">${escHtml(r.fp || '')}</td>
                  <td class="center">${escHtml(r.fip || '')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bpr-section">
        <div class="bpr-header"><i class="bi bi-box-seam"></i> PACKING MATERIALS &amp; DISPATCH</div>
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
        <div class="sign-box">
          <div class="bpr-header"><i class="bi bi-pen"></i> OPERATOR SIGNATURE</div>
          <div class="sign-area"><div class="sign-text">Operator</div></div>
        </div>
        <div class="seal-box"><i class="bi bi-patch-check" style="font-size: 24px;"></i><div>Seal</div></div>
        <div class="sign-box">
          <div class="bpr-header"><i class="bi bi-pen"></i> PLANT SUPERVISOR</div>
          <div class="sign-area"><div class="sign-text">Supervisor</div></div>
        </div>
      </div>
      
      ${buildStatusBar('Page 1 of 2')}
    </div>
  </div>

  <!-- PAGE 2: BATCH PACKING RECORD -->
  <div class="pdf-page">
    <div class="invoice-box">
      ${buildPrintHeader(profile, 'BATCH PACKING RECORD', '')}
      
      <div class="bpr-meta-grid">
        <div class="bpr-meta-item label">BPR No.</div><div class="bpr-meta-item">${bprNo}</div>
        <div class="bpr-meta-item label">Date</div><div class="bpr-meta-item">${bprDate}</div>
        <div class="bpr-meta-item label">Product</div><div class="bpr-meta-item">${escHtml(productName)}</div>
        <div class="bpr-meta-item label">Customer</div><div class="bpr-meta-item">${escHtml(customerName)}</div>
      </div>

      <div class="table-container">
        <table class="invoice-table">
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
              <td colspan="4" class="center">Micronized Material Net Weight</td>
              <td>${dispatchedNet !== '0.00' ? dispatchedNet : ''}</td>
              <td colspan="5"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer-bottom">
        <div class="sign-box" style="flex: 0 0 33%;">
          <div class="bpr-header"><i class="bi bi-pen"></i> PLANT SUPERVISOR SIGN</div>
          <div class="sign-area"><div class="sign-text">Authorised Signatory</div></div>
        </div>
      </div>

      ${buildStatusBar('Page 2 of 2')}
    </div>
  </div>

</div>
</body>
</html>`;
};

export const renderBprPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildBprHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'BPR',
    docNo: data.bprNo || 'N/A',
    width: PRINT_PAGE_W,
    fitPage: true
  });
};
