import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateSlash } from './taxInvoiceLayout';
import { escHtml, buildPrintLogoHtml } from './printTheme';

const hasWeight = (row = {}) => {
  const vals = [row.gross, row.tare, row.net];
  return vals.some((v) => {
    if (v === '' || v === undefined || v === null) return false;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return !Number.isNaN(n) && n !== 0;
  });
};

/** Hide dispatch cells that are only a copy of received with no weights filled. */
const resolveDispatchRow = (received = {}, dispatched = {}) => {
  if (hasWeight(dispatched)) return dispatched;
  const sameBatch = String(dispatched.batchNo || '') === String(received.batchNo || '');
  const sameDrum = String(dispatched.drumNo || '') === String(received.drumNo || '');
  if (sameBatch && sameDrum && (dispatched.batchNo || dispatched.drumNo)) {
    return { batchNo: '', drumNo: '', gross: '', tare: '', net: '' };
  }
  return dispatched;
};

const bprMark = (val) => {
  if (val === true || val === 'Yes' || val === 'yes' || val === '✓') return '✓';
  return '';
};

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

const emptyMetrics = () => ({ volBefore: '', volAfter: '', bd: '', td: '', micron: '' });

const METRIC_ROWS = [
  { key: 'volBefore', label: 'Vol before tap' },
  { key: 'volAfter', label: 'Vol after Tap' },
  { key: 'bd', label: 'B.D.' },
  { key: 'td', label: 'T.D.' },
  { key: 'micron', label: 'Micron' }
];

const PREV_BD_COLS = [
  { key: 'asSuch', label: 'As Such' },
  { key: 'finalPass', label: 'Final pass' },
  { key: 'ap', label: 'A P' },
  { key: 'fp', label: 'F P' },
  { key: 'fr', label: 'F R' },
  { key: 'clearance', label: 'Clearance' },
  { key: 'totalPassNeed', label: 'Total pass need' }
];

const BD_COLS = [
  { key: 'asSuch', label: 'As Such' },
  { key: 'sp', label: 'S.P.' },
  { key: 'dp', label: 'D.P.' },
  { key: 'tp', label: 'T.P.' },
  { key: 'fp', label: 'F.P.' },
  { key: 'fip', label: 'Fi.P.' },
  { key: 'sip', label: 'Si.P.' },
  { key: 'sep', label: 'Se.P.' },
  { key: 'ep', label: 'E.P.' },
  { key: 'np', label: 'N.P.' }
];

const cell = (obj, colKey, metricKey) => escHtml((obj?.[colKey] || {})[metricKey] || '');

const penIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a0080" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

const emptyBatchRow = () => ({ batchNo: '', drumNo: '', gross: '', tare: '', net: '' });

/** Empty data rows on Batch Packing Record (Page 2) so the grid fills A4. */
export const BPR_PAGE2_ROW_COUNT = 35;

/** Blank BPR print payload — empty Page 1 (Processing) + Page 2 (Packing). */
export const buildBlankBprPayload = ({ partyName = '', productName = '', companyProfile } = {}) => {
  const rows = Array.from({ length: BPR_PAGE2_ROW_COUNT }, emptyBatchRow);
  return {
    bprNo: '',
    date: '',
    partyName: partyName || '',
    productName: productName || '',
    totalInputQty: '',
    batchNo: '',
    totalNoBatch: '',
    totalDrums: '',
    psdRequirement: '',
    sizingReportRequired: '',
    particleSizeResult: '',
    psdNote: '',
    materialReceivedDate: '',
    materialReceivedTime: '',
    committedDate: '',
    committedTime: '',
    processingStartDate: '',
    processingStartTime: '',
    processingSupervisor: '',
    processCompletionDate: '',
    processCompletionTime: '',
    lumpsNetWeight: '',
    floorDustNetWeight: '',
    sampleNetWeight: '',
    processLoss: '',
    irrecoverableLoss: '',
    remark: '',
    dispatchRemark: '',
    filterBagPacked: false,
    cleaningChecklist: {
      equipmentCleaned: false,
      areaCleaned: false,
      lineClearance: false,
      bagClean: false
    },
    pressureMetrics: {},
    packingConsumables: {},
    machineParams: {},
    previousBulkDensity: {},
    bulkDensity: {},
    receivedBatches: rows,
    dispatchedBatches: rows.map(emptyBatchRow),
    totalDispatchedNet: '',
    companyProfile,
    _blankSheet: true
  };
};

export const buildBprHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const batchNos = [...new Set((data.receivedBatches || []).map((b) => b.batchNo).filter(Boolean))];
  const primaryBatchNo = batchNos.join(', ') || data.batchNo || '';
  const totalNoBatch = batchNos.length || data.totalNoBatch || '';
  const pc = data.packingConsumables || {};
  const prevBd = data.previousBulkDensity || {};
  const bd = data.bulkDensity || {};

  const dispatchedNet = typeof data.totalDispatchedNet === 'number'
    ? data.totalDispatchedNet.toFixed(2)
    : (parseFloat(data.totalDispatchedNet) || 0).toFixed(2);

  const customerName = data.partyName || data.customerName || data.party || '';
  const productName = data.productName || data.product || '';
  const bprNo = escHtml(data.bprNo || 'N/A');

  const received = data.receivedBatches || [];
  const dispatched = data.dispatchedBatches || [];
  const rowCount = Math.max(received.length, dispatched.length, BPR_PAGE2_ROW_COUNT);
  const packingRows = [];
  for (let i = 0; i < rowCount; i++) {
    const r = received[i] || {};
    const d = resolveDispatchRow(r, dispatched[i] || {});
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

  const logoHtml = `<div class="logo-wrap">${buildPrintLogoHtml(profile)}</div>`;

  const prevBdRows = METRIC_ROWS.map((m) => `
    <tr>
      <td class="left-align">${m.label}</td>
      ${PREV_BD_COLS.map((c) => `<td>${cell(prevBd, c.key, m.key)}</td>`).join('')}
    </tr>`).join('');

  const bdRows = METRIC_ROWS.map((m) => `
    <tr>
      <td class="left-align">${m.label}</td>
      ${BD_COLS.map((c) => `<td>${cell(bd, c.key, m.key)}</td>`).join('')}
    </tr>`).join('');

  const docNoLabel = data._blankSheet
    ? (bprNo && bprNo !== 'N/A' ? bprNo : '________')
    : bprNo;

  const page1Html = `
  <div class="page page-p1">
    <div class="sheet">
      <table class="header-table">
        <tr>
          <td style="width:15%;"><div class="logo-box">${logoHtml}</div></td>
          <td style="width:55%;text-align:center;">
            <div class="company-title">${escHtml(profile.companyName || 'UMA MICRON')}</div>
            <div class="company-subtitle">Micronization of API's</div>
          </td>
          <td style="width:30%;">
            <div class="bpr-badge">
              <div class="title">BATCH PROCESSING RECORD</div>
              <div class="code">${docNoLabel}</div>
            </div>
          </td>
        </tr>
      </table>

      <table class="g">
        <tr>
          <td style="width:20%;" class="purple-header left-align">Customer Name :</td>
          <td colspan="5" class="left-align">${escHtml(customerName)}</td>
        </tr>
        <tr>
          <td class="purple-header left-align">Product Name :</td>
          <td colspan="5" class="left-align">${escHtml(productName)}</td>
        </tr>
        <tr>
          <td style="width:20%;" class="left-align">Total Quantity (kg) :</td>
          <td style="width:20%;">${escHtml(data.totalInputQty ?? '')}</td>
          <td style="width:15%;" class="left-align">Batch No. :</td>
          <td style="width:15%;">${escHtml(primaryBatchNo)}</td>
          <td style="width:15%;" class="left-align">Total No. Batch :</td>
          <td style="width:15%;">${escHtml(totalNoBatch)}</td>
        </tr>
      </table>

      <table class="g">
        <tr class="light-purple-header">
          <td style="width:20%;"></td>
          <td style="width:25%;">Material Received</td>
          <td style="width:20%;">Committed</td>
          <td style="width:20%;">Processing Start</td>
          <td style="width:15%;">Processing supervisor</td>
        </tr>
        <tr>
          <td class="left-align">Date</td>
          <td>${escHtml(formatPdfDateSlash(data.materialReceivedDate) || '')}</td>
          <td>${escHtml(formatPdfDateSlash(data.committedDate) || '')}</td>
          <td>${escHtml(formatPdfDateSlash(data.processingStartDate) || '')}</td>
          <td rowspan="2">${escHtml(data.processingSupervisor || '')}</td>
        </tr>
        <tr>
          <td class="left-align">Time</td>
          <td>${escHtml(data.materialReceivedTime || '')}</td>
          <td>${escHtml(data.committedTime || '')}</td>
          <td>${escHtml(data.processingStartTime || '')}</td>
        </tr>
      </table>

      <table class="g">
        <tr class="light-purple-header">
          <td style="width:40%;">PARTICAL SIZE REQUIRED</td>
          <td style="width:35%;">Sizing report require</td>
          <td style="width:25%;">Particle size result</td>
        </tr>
        <tr style="height:30px;">
          <td>${escHtml(data.psdRequirement || '')}</td>
          <td>${escHtml(data.sizingReportRequired || '')}</td>
          <td>${escHtml(data.particleSizeResult || '')}</td>
        </tr>
      </table>

      <div class="psd-note-box">
        <div class="psd-note-head">PSD Note</div>
        <div class="psd-note-body">${escHtml(data.psdNote || '')}</div>
      </div>

      <table class="g">
        <tr>
          <td class="left-align" style="width:80%;">Is the processing Area Cleaned?</td>
          <td style="width:20%;">${bprMark(data.cleaningChecklist?.areaCleaned)}</td>
        </tr>
        <tr>
          <td class="left-align">Is the filter Bag before process packed and labeled in LDPE Bag ?</td>
          <td>${bprMark(data.cleaningChecklist?.lineClearance)}</td>
        </tr>
        <tr>
          <td class="left-align">Is the bag is clean and black spot free?</td>
          <td>${bprMark(data.cleaningChecklist?.bagClean)}</td>
        </tr>
      </table>

      <table class="badge-row"><tr><td><span class="pill-badge">Previous Record Of Bulk Density for reference</span></td></tr></table>
      <table class="g">
        <tr class="light-purple-header">
          <td style="width:18%;"></td>
          ${PREV_BD_COLS.map((c) => `<td>${c.label}</td>`).join('')}
        </tr>
        ${prevBdRows}
      </table>

      <table class="g">
        <tr class="light-purple-header">
          <td style="width:15%;">Bulk Density</td>
          ${BD_COLS.map((c) => `<td>${c.label}</td>`).join('')}
        </tr>
        ${bdRows}
      </table>

      <table class="badge-row"><tr><td><span class="pill-badge">Packing Materials Used</span></td></tr></table>
      <table class="g">
        <tr class="light-purple-header">
          <td style="width:22%;">White LD Bags</td>
          <td style="width:20%;">Black LD Bags</td>
          <td style="width:18%;">Brow Tapes</td>
          <td style="width:18%;">Drum Used</td>
          <td style="width:22%;">Other Details</td>
        </tr>
        <tr style="height:25px;">
          <td>${escHtml(pc.whiteLdBags || pc.linersUsed || '')}</td>
          <td>${escHtml(pc.blackLdBags || '')}</td>
          <td>${escHtml(pc.brownTapes || '')}</td>
          <td>${escHtml(pc.drumUsed || pc.fiberDrumsUsed || pc.hdpeDrumsUsed || '')}</td>
          <td>${escHtml(pc.otherDetails || '')}</td>
        </tr>
      </table>

      <table class="badge-row"><tr><td><span class="pill-badge">Dispatch Material Quantity Details</span></td></tr></table>
      <table class="g">
        <tr class="light-purple-header">
          <td style="width:22%;">Micronized Material net weight</td>
          <td style="width:18%;">Lumps Net weight</td>
          <td style="width:20%;">Floor Dust Net weight</td>
          <td style="width:20%;">Net Process Loss</td>
          <td style="width:20%;">Remark</td>
        </tr>
        <tr style="height:25px;">
          <td>${dispatchedNet !== '0.00' ? dispatchedNet : ''}</td>
          <td>${escHtml(data.lumpsNetWeight || '')}</td>
          <td>${escHtml(data.floorDustNetWeight || '')}</td>
          <td>${escHtml(data.processLoss || data.irrecoverableLoss || '')}</td>
          <td>${escHtml(data.remark || data.dispatchRemark || '')}</td>
        </tr>
      </table>

      <table class="g">
        <tr>
          <td style="width:20%;" class="left-align">Process completion</td>
          <td style="width:8%;" class="left-align">Date</td>
          <td style="width:25%;">${escHtml(formatPdfDateSlash(data.processCompletionDate) || '')}</td>
          <td style="width:8%;" class="left-align">Time</td>
          <td style="width:20%;">${escHtml(data.processCompletionTime || '')}</td>
          <td style="width:19%;"></td>
        </tr>
        <tr>
          <td colspan="5" class="left-align">Is Filter Bag Packed in HDPE bag and lable &amp; stored properly after processing ?</td>
          <td>${bprMark(data.filterBagPacked)}</td>
        </tr>
      </table>
      <div class="remark-box">
        <div class="remark-label">Remark</div>
        <div class="remark-content">${escHtml(data.remark || data.dispatchRemark || '')}</div>
      </div>

      <div class="signature-container">
        <div class="signature-box">
          <div class="signature-label">${penIcon} Operator's Signature</div>
        </div>
        <div class="signature-box">
          <div class="signature-label">${penIcon} Plant Supervisor's Signature</div>
        </div>
      </div>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BPR - ${escHtml(profile.companyName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;}
  html,body{margin:0;padding:0;background:#fff;}
  .page{
    width:794px;min-height:1123px;padding:8px;margin:0;background:#fff;
    display:flex;flex-direction:column;page-break-after:always;
  }
  .sheet{
    flex:1;border:2px solid #5a009d;padding:10px;display:flex;flex-direction:column;
  }
  table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:-1px;}
  table.g th,table.g td{
    border:1px solid #7c12bd;text-align:center;vertical-align:middle;
    font-size:10px;font-weight:700;color:#4a0080;padding:3px 2px;
    word-break:break-all;overflow-wrap:break-word;white-space:pre-wrap;
  }
  .purple-header{background:#5a009d;color:#fff !important;}
  .light-purple-header td,.light-purple-header th{background:#e2d3f3;color:#4a0080;}
  .left-align{text-align:left !important;padding-left:6px !important;}
  .header-table{border:none;margin-bottom:8px;}
  .header-table td{border:none !important;padding:2px;}
  .logo-box{display:flex;align-items:center;justify-content:center;}
  .logo-wrap{width:56px;height:44px;display:flex;align-items:center;justify-content:center;}
  .logo-wrap img{width:100%;height:100%;object-fit:contain;display:block;}
  .company-title{font-size:26px;font-weight:900;color:#4a0080;letter-spacing:1px;line-height:1.1;}
  .company-subtitle{font-size:13px;font-weight:700;color:#008822;margin-top:2px;}
  .bpr-badge{
    background:#5a009d;color:#fff;border-radius:12px;padding:8px 10px;text-align:center;
  }
  .bpr-badge .title{font-size:11px;font-weight:700;letter-spacing:.4px;}
  .bpr-badge .code{font-size:12px;font-weight:700;margin-top:3px;}
  .badge-row td{border:none !important;text-align:left;padding:4px 0 2px !important;height:auto;}
  .pill-badge{
    background:#5a009d;color:#fff;border-radius:10px;padding:3px 12px;
    display:inline-block;font-size:10px;font-weight:700;
  }
  .psd-note-box{
    flex:1;
    min-height:48px;
    display:flex;
    flex-direction:column;
    border:1px solid #7c12bd;
    margin-bottom:-1px;
  }
  .psd-note-head{
    background:#e2d3f3;
    color:#4a0080;
    font-size:10px;
    font-weight:700;
    padding:3px 8px;
    text-align:left;
    border-bottom:1px solid #7c12bd;
    flex-shrink:0;
  }
  .psd-note-body{
    flex:1;
    padding:4px 8px;
    text-align:left;
    font-size:10px;
    font-weight:700;
    color:#4a0080;
    white-space:pre-wrap;
    word-break:break-word;
    line-height:1.3;
    overflow:hidden;
  }
  .remark-box {
    flex: 1;
    display: flex;
    border: 1px solid #7c12bd;
    margin-bottom: -1px;
    min-height: 48px;
  }
  .remark-label {
    width: 20%;
    border-right: 1px solid #7c12bd;
    color: #4a0080;
    font-size: 10px;
    font-weight: 700;
    padding: 6px;
  }
  .remark-content {
    width: 80%;
    color: #4a0080;
    font-size: 10px;
    font-weight: 700;
    padding: 6px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .page-p1 .sheet{min-height:calc(1123px - 16px);}
  .signature-container{
    display:flex;justify-content:space-between;margin-top:auto;border:1px solid #7c12bd;flex-shrink:0;
  }
  .signature-box{
    width:50%;min-height:72px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;
  }
  .signature-box:first-child{border-right:1px solid #7c12bd;}
  .signature-label{
    font-size:11px;font-weight:700;color:#4a0080;display:flex;align-items:center;gap:6px;
  }

  .p2-header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #5a009d;}
  .p2-brand{display:flex;align-items:center;gap:10px;}
  .p2-logo{width:50px;height:50px;}
  .p2-logo img,.p2-logo > div,.p2-logo .logo-wrap{width:100%;height:100%;object-fit:contain;}
  .meta{display:flex;flex-wrap:wrap;border:1.5px solid #5a009d;margin-bottom:6px;border-radius:4px;overflow:hidden;}
  .meta-item{padding:4px 8px;border-right:1px solid #e2d3f3;border-bottom:1px solid #e2d3f3;font-size:10px;width:32%;box-sizing:border-box;color:#4a0080;font-weight:600;}
  .meta-item.label{color:#5a009d;font-weight:700;background:#e2d3f3;width:18%;}
  table.items{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:8.5px;flex:1;table-layout:auto;}
  table.items thead th{background:#5a009d;color:#fff;font-weight:700;padding:4px 3px;text-align:center;border:1px solid #5a009d;font-size:8.5px;white-space:nowrap;}
  table.items tbody td{border:1px solid #7c12bd;padding:2px 3px;text-align:center;color:#4a0080;font-weight:600;font-size:8.5px;white-space:nowrap;}
  table.items tbody tr.total-hl td{background:#e2d3f3;color:#4a0080;font-weight:700;height:24px;}
  .barfoot{background:#5a009d;color:#fff;padding:6px 12px;display:flex;justify-content:space-between;font-size:10px;margin-top:auto;border-radius:4px;}
  .signs{display:flex;border:1px solid #7c12bd;margin-top:4px;margin-bottom:6px;border-radius:4px;overflow:hidden;}
  .sign{flex:1;padding:6px 10px;min-height:40px;display:flex;align-items:flex-end;gap:6px;font-size:10px;font-weight:700;color:#4a0080;}
  .sign + .sign{border-left:1px solid #7c12bd;}
  .sign .line{flex:1;border-bottom:1px solid #777;margin-left:6px;min-height:16px;}
  .page-p2 .sheet{min-height:calc(1123px - 16px);}
</style>
</head>
<body>

  ${page1Html}

  <div class="page page-p2">
    <div class="sheet">
      <div class="p2-header">
        <div class="p2-brand">
          <div class="p2-logo">${logoHtml}</div>
          <div>
            <div class="company-title" style="font-size:22px;">${escHtml(profile.companyName || 'UMA MICRON')}</div>
            <div class="company-subtitle">Micronization of API's</div>
          </div>
        </div>
        <div class="bpr-badge">
          <div class="title">BATCH PACKING RECORD</div>
          <div class="code">${docNoLabel}</div>
        </div>
      </div>

      <div class="meta">
        <div class="meta-item label">BPR No.</div><div class="meta-item">${docNoLabel}</div>
        <div class="meta-item label">Date</div><div class="meta-item">${escHtml(formatPdfDateSlash(data.date) || '')}</div>
        <div class="meta-item label">Product</div><div class="meta-item">${escHtml(productName)}</div>
        <div class="meta-item label">Customer</div><div class="meta-item">${escHtml(customerName)}</div>
      </div>

      <table class="items">
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
          <tr class="total-hl">
            <td colspan="4" style="text-align:center;">Micronized Material Net Weight</td>
            <td>${dispatchedNet !== '0.00' ? dispatchedNet : ''}</td>
            <td colspan="5"></td>
          </tr>
        </tbody>
      </table>

      <div class="signs" style="width:40%;">
        <div class="sign">${penIcon} Plant Supervisor Sign<span class="line"></span></div>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>Page 2 of 2</span>
      </div>
    </div>
  </div>

</body>
</html>`;
};

export const renderBprPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildBprHtml(data, data.companyProfile);
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-12000px;top:0;z-index:-1;background:#fff;';
  host.innerHTML = html;
  document.body.appendChild(host);
  const fileBase = data._blankSheet
    ? `BPR_Blank`
    : `BPR_${data.bprNo || 'N/A'}`;
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageNodes = [...host.querySelectorAll('.page')];
    for (let i = 0; i < pageNodes.length; i++) {
      if (i > 0) pdf.addPage();
      const target = pageNodes[i];
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        height: target.scrollHeight,
        windowHeight: target.scrollHeight,
        logging: false
      });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }

    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = fileBase;
    } else {
      pdf.save(`${fileBase}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};

export { emptyMetrics };
