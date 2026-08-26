import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateSlash } from './taxInvoiceLayout';
import { escHtml, buildPrintBrandHtml, applyPrintPrefsToHtml } from './printTheme';
import { PRINT_ROOT_CLASS } from './printPrefs';

const hasWeight = (row = {}) => {
  const vals = [row.gross, row.tare, row.net];
  return vals.some((v) => {
    if (v === '' || v === undefined || v === null) return false;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return !Number.isNaN(n) && n !== 0;
  });
};

/** Hide dispatch weight cells that are only an empty mirror of received. Keep drum labels. */
const resolveDispatchRow = (received = {}, dispatched = {}) => {
  if (!dispatched || (!dispatched.batchNo && !dispatched.drumNo && !hasWeight(dispatched))) {
    return dispatched;
  }
  if (hasWeight(dispatched)) return dispatched;
  const sameBatch = String(dispatched.batchNo || '') === String(received.batchNo || '');
  const sameDrum = String(dispatched.drumNo || '') === String(received.drumNo || '');
  if (sameBatch && sameDrum && (dispatched.batchNo || dispatched.drumNo)) {
    // Keep batch/drum identity so auto-added drums print; clear only mirrored empty weights
    return { ...dispatched, gross: '', tare: '', net: '' };
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
  { key: 'totalPassNeed', label: 'Total pass<br>need' }
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

/**
 * Blank grid rows on Batch Packing Record page 2. CSS stretches them to fill
 * leftover A4 space so the sheet does not look empty.
 */
export const BPR_PAGE2_BLANK_ROWS = 18;
/** Form pad target for received/dispatched editors (not the print blank count). */
export const BPR_PAGE2_ROW_COUNT = 14;

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
  const pc = {
    ...(data.packingMaterials || {}),
    ...(data.packingConsumables || {})
  };
  const drumCount = Math.max(
    (data.dispatchedBatches || []).filter((r) => r.batchNo || r.drumNo).length,
    (data.receivedBatches || []).filter((r) => r.batchNo || r.drumNo).length,
    parseInt(data.totalDrums, 10) || 0
  );
  pc.drumUsed = String(
    pc.drumUsed || pc.fiberDrumsUsed || pc.hdpeDrumsUsed || (drumCount ? drumCount : '') || ''
  ).trim();
  const prevBd = data.previousBulkDensity || {};
  const bd = data.bulkDensity || {};

  const customerName = data.partyName || data.customerName || data.party || '';
  const productName = data.productName || data.product || '';
  const bprNo = escHtml(data.bprNo || 'N/A');

  const isSievingLumpRow = (r = {}) => {
    const batch = String(r.batchNo || '').trim().toLowerCase();
    const drum = String(r.drumNo || '').trim().toLowerCase();
    return /sieving\s*lumps?/.test(batch) || /sieving\s*lumps?/.test(drum);
  };

  const lumpWeightFromRow = (r = {}) => {
    const candidates = [r.net, r.tare, r.gross];
    for (const v of candidates) {
      if (v === '' || v == null) continue;
      const n = parseFloat(v);
      if (!Number.isNaN(n) && n !== 0) return n;
    }
    return 0;
  };

  // Pull sieving lumps from BPR field, PL, or a special batch row
  let sievingLumps = parseFloat(
    data.lumpsNetWeight ?? data.sievingLumps ?? data.sievingLumpsNet ?? data.lumpsNet ?? ''
  );
  if (!Number.isFinite(sievingLumps) || sievingLumps <= 0) sievingLumps = 0;

  const stripLumpRows = (rows) => {
    const kept = [];
    (rows || []).forEach((row) => {
      if (isSievingLumpRow(row)) {
        const w = lumpWeightFromRow(row);
        if (w > 0 && sievingLumps <= 0) sievingLumps = w;
        return;
      }
      kept.push(row);
    });
    return kept;
  };

  let receivedRaw = stripLumpRows(data.receivedBatches || []);
  let dispatchedRaw = stripLumpRows(data.dispatchedBatches || []);
  const isLiveRow = (r) => !!(r && (r.batchNo || r.drumNo || hasWeight(r)));
  const rowKey = (r = {}) => `${String(r.batchNo || '').trim().toLowerCase()}||${String(r.drumNo ?? '').trim().toLowerCase()}`;
  const pairKey = (r = {}, d = {}) => {
    const batch = String(r.batchNo || d.batchNo || '').trim().toLowerCase();
    const drum = String(
      (r.drumNo != null && r.drumNo !== '') ? r.drumNo : (d.drumNo ?? '')
    ).trim().toLowerCase();
    return `${batch}||${drum}`;
  };
  const pairScore = ({ r = {}, d = {} }) =>
    (hasWeight(r) ? 2 : 0) + (hasWeight(d) ? 2 : 0) + ((r.batchNo || d.batchNo) ? 1 : 0) + ((r.drumNo != null && r.drumNo !== '') || (d.drumNo != null && d.drumNo !== '') ? 1 : 0);

  // Drop trailing empty pad rows so pairing stays aligned with real drums.
  const trimTrailingEmpty = (rows) => {
    const copy = [...(rows || [])];
    while (copy.length && !isLiveRow(copy[copy.length - 1])) copy.pop();
    return copy;
  };
  // Collapse duplicate batch+drum rows in source arrays (keeps first weighted row).
  const dedupeBatchRows = (rows) => {
    const seen = new Map();
    const out = [];
    (rows || []).forEach((row) => {
      if (!isLiveRow(row)) return;
      const key = rowKey(row);
      if (key === '||') {
        out.push(row);
        return;
      }
      if (!seen.has(key)) {
        seen.set(key, out.length);
        out.push(row);
        return;
      }
      const idx = seen.get(key);
      const prev = out[idx];
      // Prefer the row that actually has weights
      if (!hasWeight(prev) && hasWeight(row)) out[idx] = row;
    });
    return out;
  };
  receivedRaw = dedupeBatchRows(trimTrailingEmpty(receivedRaw));
  dispatchedRaw = dedupeBatchRows(trimTrailingEmpty(dispatchedRaw));

  // If received has drum labels but no weights, mirror matching dispatched / fill from pair
  const fillEmptyReceived = (received, dispatched) => {
    if (hasWeight(received)) return received;
    if (!hasWeight(dispatched)) return received;
    return {
      ...received,
      batchNo: received.batchNo || dispatched.batchNo || '',
      drumNo: received.drumNo != null && received.drumNo !== '' ? received.drumNo : (dispatched.drumNo ?? ''),
      gross: dispatched.gross ?? '',
      tare: dispatched.tare ?? '',
      net: dispatched.net ?? ''
    };
  };

  // Pair by batch+drum identity — never emit the same drum twice.
  const dispatchPool = dispatchedRaw.map((d, i) => ({ d: d || {}, i, used: false }));
  let paired = [];
  const usedPairKeys = new Set();

  receivedRaw.forEach((r) => {
    const row = r || {};
    const key = rowKey(row);
    if (key !== '||' && usedPairKeys.has(key)) return;

    let match = key !== '||'
      ? dispatchPool.find((x) => !x.used && rowKey(x.d) === key)
      : null;
    // Only greedily take an unlabeled dispatch row when received itself has no identity
    if (!match && key === '||') {
      match = dispatchPool.find((x) => !x.used && isLiveRow(x.d) && rowKey(x.d) === '||');
    }
    if (match) match.used = true;
    const d = match?.d || {};
    const pk = pairKey(row, d);
    if (pk !== '||') usedPairKeys.add(pk);
    paired.push({ r: fillEmptyReceived(row, d), d });
  });

  dispatchPool.filter((x) => !x.used && isLiveRow(x.d)).forEach((x) => {
    const key = rowKey(x.d);
    if (key !== '||' && usedPairKeys.has(key)) return;
    if (key !== '||') usedPairKeys.add(key);
    paired.push({ r: fillEmptyReceived({}, x.d), d: x.d });
  });

  // Final safety: one printed line per batch+drum (prefer fuller weight data).
  const livePairs = (() => {
    const best = new Map();
    const anonymous = [];
    paired.filter(({ r, d }) => isLiveRow(r) || isLiveRow(d)).forEach((pair) => {
      const key = pairKey(pair.r, pair.d);
      if (key === '||') {
        anonymous.push(pair);
        return;
      }
      const prev = best.get(key);
      if (!prev || pairScore(pair) >= pairScore(prev)) best.set(key, pair);
    });
    return [...best.values(), ...anonymous];
  })();

  // Group by batch so each Batch No gets its own TOTAL on the print
  const batchGroups = [];
  const groupMap = {};
  livePairs.forEach((pair) => {
    const r = pair.r || {};
    const d = pair.d || {};
    const key = String(r.batchNo || d.batchNo || '').trim() || '—';
    if (!groupMap[key]) {
      groupMap[key] = { batchNo: key, pairs: [] };
      batchGroups.push(groupMap[key]);
    }
    groupMap[key].pairs.push(pair);
  });

  const parseWtNum = (v) => {
    if (v === '' || v == null) return 0;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const netNum = (row) => {
    const s = calcNet(row);
    const n = parseFloat(s);
    return (!s || Number.isNaN(n)) ? 0 : n;
  };

  const packingRows = [];
  let printedDispatchNet = 0;
  batchGroups.forEach((group) => {
    let gRGross = 0;
    let gRTare = 0;
    let gRNet = 0;
    let gDGross = 0;
    let gDTare = 0;
    let gDNet = 0;
    group.pairs.forEach(({ r: rawR, d: rawD }) => {
      const r = rawR || {};
      const d = resolveDispatchRow(r, rawD || {});
      const dNetStr = calcNet(d);
      const dNet = parseFloat(dNetStr);
      if (!Number.isNaN(dNet) && dNetStr) printedDispatchNet += dNet;
      gRGross += parseWtNum(r.gross);
      gRTare += parseWtNum(r.tare);
      gRNet += netNum(r);
      gDGross += parseWtNum(d.gross);
      gDTare += parseWtNum(d.tare);
      gDNet += (!Number.isNaN(dNet) && dNetStr) ? dNet : 0;
      // Always surface batch/drum from either side so page-2 never looks blank.
      const rBatch = r.batchNo || d.batchNo || '';
      const rDrum = (r.drumNo != null && r.drumNo !== '') ? r.drumNo : (d.drumNo ?? '');
      const dBatch = d.batchNo || r.batchNo || '';
      const dDrum = (d.drumNo != null && d.drumNo !== '') ? d.drumNo : (r.drumNo ?? '');
      packingRows.push(`
      <tr>
        <td>${escHtml(rBatch)}</td>
        <td>${escHtml(rDrum)}</td>
        <td class="wt">${fmtWt(r.gross)}</td>
        <td class="wt">${fmtWt(r.tare)}</td>
        <td class="wt">${calcNet(r)}</td>
        <td>${escHtml(dBatch)}</td>
        <td>${escHtml(dDrum)}</td>
        <td class="wt">${fmtWt(d.gross)}</td>
        <td class="wt">${fmtWt(d.tare)}</td>
        <td class="wt">${dNetStr}</td>
      </tr>`);
    });
    packingRows.push(`
      <tr class="batch-total-row">
        <td colspan="2" class="batch-total-label">TOTAL — Batch ${escHtml(group.batchNo)}</td>
        <td class="wt">${gRGross > 0 ? gRGross.toFixed(2) : ''}</td>
        <td class="wt">${gRTare > 0 ? gRTare.toFixed(2) : ''}</td>
        <td class="wt">${gRNet > 0 ? gRNet.toFixed(2) : ''}</td>
        <td colspan="2" class="batch-total-label">TOTAL — Batch ${escHtml(group.batchNo)}</td>
        <td class="wt">${gDGross > 0 ? gDGross.toFixed(2) : ''}</td>
        <td class="wt">${gDTare > 0 ? gDTare.toFixed(2) : ''}</td>
        <td class="wt">${gDNet > 0 ? gDNet.toFixed(2) : ''}</td>
      </tr>`);
  });

  if (sievingLumps > 0) {
    printedDispatchNet += sievingLumps;
    packingRows.push(`
      <tr class="lump-row">
        <td></td><td></td><td></td><td></td><td></td>
        <td></td>
        <td></td>
        <td class="lump-label">Sieving Lumps</td>
        <td></td>
        <td class="wt">${sievingLumps.toFixed(2)}</td>
      </tr>`);
  }

  const fillerRowsHtml = Array.from({ length: BPR_PAGE2_BLANK_ROWS }, () => `
            <tr class="filler-row">
              <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
              <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
            </tr>`).join('');

  const savedDispatchNet = typeof data.totalDispatchedNet === 'number'
    ? data.totalDispatchedNet
    : (parseFloat(data.totalDispatchedNet) || 0);
  const finalDispatchNet = printedDispatchNet > 0 ? printedDispatchNet : savedDispatchNet;
  const dq = data.dispatchQty || {};
  const micronizedPrint = (
    finalDispatchNet > 0
      ? finalDispatchNet.toFixed(2)
      : (dq.micronizedNet || data.micronizedNetWeight || '')
  );
  const lumpsPrint = String(
    data.lumpsNetWeight
      || dq.lumpsNet
      || (sievingLumps > 0 ? sievingLumps.toFixed(2) : '')
      || ''
  );
  const samplePrint = String(data.sampleNetWeight || dq.sampleNet || '');
  const irrecoverablePrint = String(
    data.irrecoverableLoss || data.processLoss || dq.netProcessLoss || ''
  );
  const dispatchedNet = micronizedPrint && String(micronizedPrint) !== '0.00' ? String(micronizedPrint) : '';

  const summaryRowsHtml = `
            <tr class="summary-row">
              <td colspan="4" class="summary-label">Micronized Material Net Weight</td>
              <td class="wt">${escHtml(dispatchedNet)}</td>
              <td colspan="5"></td>
            </tr>
            <tr class="summary-row">
              <td colspan="4" class="summary-label">Lumps Net Weight</td>
              <td class="wt">${escHtml(lumpsPrint)}</td>
              <td colspan="5"></td>
            </tr>
            <tr class="summary-row">
              <td colspan="4" class="summary-label">Sample Net Weight</td>
              <td class="wt">${escHtml(samplePrint)}</td>
              <td colspan="5"></td>
            </tr>
            <tr class="summary-row">
              <td colspan="4" class="summary-label">Irrecoverable loss</td>
              <td class="wt">${escHtml(irrecoverablePrint)}</td>
              <td colspan="5"></td>
            </tr>`;

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
          <td style="width:70%;" colspan="2" class="left-align">
            ${buildPrintBrandHtml(profile, {
              companyName: profile.companyName || 'UMA MICRON',
              tagline: profile.tagline || "Micronization of API's"
            })}
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
          <td style="width:16%;"></td>
          <td style="width:22%;">Material<br>Received</td>
          <td style="width:18%;">Committed</td>
          <td style="width:22%;">Processing<br>Start</td>
          <td style="width:22%;">Processing<br>Supervisor</td>
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
          <td style="width:40%;">PARTICLE SIZE REQUIRED</td>
          <td style="width:30%;">Sizing report<br>require</td>
          <td style="width:30%;">Particle size<br>result</td>
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

      <div class="section-badge"><span class="pill-badge">Previous Record Of Bulk Density for reference</span></div>
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

      <div class="section-badge"><span class="pill-badge">Packing Materials Used</span></div>
      <table class="g">
        <tr class="light-purple-header">
          <td style="width:22%;">White LD<br>Bags</td>
          <td style="width:20%;">Black LD<br>Bags</td>
          <td style="width:18%;">Brown<br>Tapes</td>
          <td style="width:18%;">Drum<br>Used</td>
          <td style="width:22%;">Other<br>Details</td>
        </tr>
        <tr style="height:25px;">
          <td>${escHtml(pc.whiteLdBags || pc.linersUsed || '')}</td>
          <td>${escHtml(pc.blackLdBags || '')}</td>
          <td>${escHtml(pc.brownTapes || '')}</td>
          <td>${escHtml(pc.drumUsed || pc.fiberDrumsUsed || pc.hdpeDrumsUsed || '')}</td>
          <td>${escHtml(pc.otherDetails || '')}</td>
        </tr>
      </table>

      <div class="section-badge"><span class="pill-badge">Dispatch Material Quantity Details</span></div>
      <table class="g">
        <tr class="light-purple-header">
          <td style="width:25%;">Micronized Material<br>Net Weight</td>
          <td style="width:25%;">Lumps Net<br>Weight</td>
          <td style="width:25%;">Sample Net<br>Weight</td>
          <td style="width:25%;">Irrecoverable<br>loss</td>
        </tr>
        <tr style="height:25px;">
          <td>${escHtml(dispatchedNet)}</td>
          <td>${escHtml(lumpsPrint)}</td>
          <td>${escHtml(samplePrint)}</td>
          <td>${escHtml(irrecoverablePrint)}</td>
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
  *{box-sizing:border-box;margin:0;padding:0;font-family:Cambria,Georgia,serif;}
  html,body{margin:0;padding:0;background:#fff;}
  .page{
    width:794px;height:1123px;min-height:1123px;max-height:1123px;padding:8px;margin:0;background:#fff;
    display:flex;flex-direction:column;page-break-after:always;box-sizing:border-box;overflow:hidden;
  }
  .sheet{
    flex:1 1 auto;height:100%;min-height:0;border:2px solid #5a009d;padding:10px;
    display:flex;flex-direction:column;box-sizing:border-box;position:relative;
  }
  table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:-1px;}
  table.g th,table.g td{
    border:1px solid #7c12bd;text-align:center;vertical-align:middle;
    font-size:11px;font-weight:700;color:#231f20 !important;padding:4px 3px;
    word-break:normal;overflow-wrap:normal;white-space:normal;hyphens:none;
    line-height:1.2;
    background:#ffffff;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  table.g .light-purple-header td,
  table.g tr.light-purple-header td{
    font-size:10.5px;line-height:1.25;padding:5px 3px;
    word-break:normal;overflow-wrap:normal;white-space:normal;hyphens:none;
  }
  table.g td.left-align{
    word-break:normal;overflow-wrap:anywhere;white-space:normal;
  }
  table.g td.nowrap{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .purple-header{background:#5a009d !important;color:#fff !important;}
  .light-purple-header td,.light-purple-header th{background:#e2d3f3 !important;color:#4a0080 !important;}
  .left-align{text-align:left !important;padding-left:6px !important;}
  .header-table{border:none;margin-bottom:8px;}
  .header-table td{border:none !important;padding:2px;}
  .logo-box{display:flex;align-items:center;justify-content:center;}
  .logo-wrap{width:56px;height:44px;display:flex;align-items:center;justify-content:center;}
  .logo-wrap img{width:100%;height:100%;object-fit:contain;display:block;}
  .brand-lockup{width:280px;height:70px;flex-shrink:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}
  .company-title{font-size:26px;font-weight:900;color:#4a0080;letter-spacing:1px;line-height:1.1;}
  .company-subtitle{font-size:12px;font-weight:700;color:#008822;margin-top:2px;}
  .bpr-badge{
    background:#5a009d;color:#fff;border-radius:12px;padding:8px 10px;text-align:center;
  }
  .bpr-badge .title{font-size:12px;font-weight:700;letter-spacing:.4px;}
  .bpr-badge .code{font-size:12px;font-weight:700;margin-top:3px;}
  .badge-row td{border:none !important;text-align:left;padding:4px 0 2px !important;height:auto;}
  .section-badge{
    display:block;
    width:100%;
    margin:6px 0 0 0;
    padding:0;
    position:relative;
    z-index:2;
    line-height:1.2;
  }
  .pill-badge{
    background:#5a009d;color:#fff;border-radius:10px;padding:4px 14px;
    display:inline-block;font-size:12px;font-weight:700;line-height:1.25;
    position:relative;z-index:2;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .section-badge + table.g{
    margin-top:2px;
    position:relative;
    z-index:1;
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
    font-size:12px;
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
    font-size:12px;
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
    font-size:12px;
    font-weight: 700;
    padding: 6px;
  }
  .remark-content {
    width: 80%;
    color: #4a0080;
    font-size:12px;
    font-weight: 700;
    padding: 6px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .page-p1 .sheet{height:100%;}
  .signature-container{
    display:flex;justify-content:space-between;margin-top:auto;border:1px solid #7c12bd;flex-shrink:0;
  }
  .signature-box{
    width:50%;min-height:72px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;
  }
  .signature-box:first-child{border-right:1px solid #7c12bd;}
  .signature-label{
    font-size:12px;font-weight:700;color:#4a0080;display:flex;align-items:center;gap:6px;
  }

  .p2-header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #5a009d;}
  .p2-brand{display:flex;align-items:center;gap:10px;}
  .p2-logo{width:50px;height:50px;}
  .p2-logo img,.p2-logo > div,.p2-logo .logo-wrap{width:100%;height:100%;object-fit:contain;}
  .meta{display:flex;flex-wrap:wrap;border:1.5px solid #5a009d;margin-bottom:6px;border-radius:4px;overflow:hidden;}
  .meta-item{padding:4px 8px;border-right:1px solid #e2d3f3;border-bottom:1px solid #e2d3f3;font-size:12px;width:32%;box-sizing:border-box;color:#4a0080;font-weight:600;}
  .meta-item.label{color:#5a009d;font-weight:700;background:#e2d3f3;width:18%;}
  table.items{
    width:100%;border-collapse:collapse;margin:0;font-size:12px;
    flex:0 0 auto;height:auto;table-layout:fixed;background:#fff;
  }
  .page-p2 .table-wrap{
    flex:1 1 auto;min-height:0;display:flex;flex-direction:column;margin-bottom:6px;
  }
  .page-p2 table.items{
    flex:1 1 auto;height:100%;width:100%;
  }
  .page-p2 .barfoot{
    margin:6px -10px -10px -10px !important;
  }
  table.items col.c-batch{width:16%;}
  table.items col.c-drum{width:8%;}
  table.items col.c-wt{width:8%;}
  table.items thead th{
    background:#5a009d !important;color:#fff !important;font-weight:700;
    padding:5px 3px;text-align:center;vertical-align:middle;
    border:1px solid rgba(255,255,255,0.55);
    font-size:11px;line-height:1.2;height:auto;max-height:none;
    white-space:normal;word-break:break-word;
  }
  table.items thead th .eg{
    display:block;font-size:7.5px;font-weight:500;letter-spacing:0;margin-top:1px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  table.items tbody td{
    border:1px solid #7c12bd;padding:4px 3px;height:28px;min-height:28px;
    text-align:center;vertical-align:middle;color:#231f20 !important;font-weight:700;
    font-size:11px;line-height:1.15 !important;white-space:nowrap;
    overflow:visible !important;text-overflow:clip !important;
    background:#ffffff !important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
    -webkit-text-fill-color:#231f20 !important;
  }
  table.items tbody td.wt{
    color:#231f20 !important;
    -webkit-text-fill-color:#231f20 !important;
    font-weight:700;
    overflow:visible !important;
  }
  table.items tbody td.lump-label{
    font-weight:700;font-size:11px;white-space:nowrap;overflow:visible;
  }
  table.items tbody tr.total-hl td{
    background:#e2d3f3 !important;color:#4a0080 !important;font-weight:700;height:36px;min-height:36px;
  }
  table.items tbody tr.filler-row{
    height:1%;
  }
  table.items tbody tr.filler-row td{
    height:auto;min-height:16px;max-height:none;padding:2px 3px;
    line-height:1 !important;font-size:10px;color:transparent !important;
    -webkit-text-fill-color:transparent !important;
  }
  table.items tbody tr.summary-row td{
    background:#fff !important;color:#231f20 !important;font-weight:700;height:28px;min-height:28px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  table.items tbody td.summary-label{
    text-align:left !important;padding-left:8px !important;font-weight:700;
    white-space:nowrap;overflow:visible;
  }
  table.items tbody tr.batch-total-row td{
    background:#f3eef9 !important;color:#4a0080 !important;font-weight:700;height:32px;min-height:32px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  table.items tbody td.batch-total-label{
    text-align:right;font-size:10px;font-weight:800;white-space:nowrap;
  }
  .table-wrap{
    flex:0 0 auto;min-height:0;display:flex;flex-direction:column;margin-bottom:8px;
  }
  .page-p2 .table-wrap{
    flex:1 1 auto;min-height:0;
  }
  .barfoot{
    background:#5a009d;color:#fff;padding:7px 14px;display:flex;justify-content:space-between;align-items:center;
    font-size:12px;margin:auto -10px -10px -10px;border-radius:0;flex-shrink:0;width:auto;box-sizing:border-box;
    letter-spacing:0.01px;word-spacing:normal;
  }
  .page-p2 .barfoot{
    margin:6px -10px -10px -10px !important;
  }
  .barfoot span{white-space:nowrap;letter-spacing:0.01px;word-spacing:0.02em;}
  .signs{display:flex;border:1px solid #7c12bd;margin-top:4px;margin-bottom:0;border-radius:4px;overflow:hidden;flex-shrink:0;}
  .sign{flex:1;padding:10px 14px;min-height:52px;display:flex;align-items:flex-end;gap:6px;font-size:12px;font-weight:700;color:#4a0080;}
  .sign + .sign{border-left:1px solid #7c12bd;}
  .sign .line{flex:1;border-bottom:1px solid #777;margin-left:6px;min-height:16px;}
  .page-p2 .sheet{height:100%;}
</style>
</head>
<body>

  ${page1Html}

  <div class="page page-p2">
    <div class="sheet">
      <div class="p2-header">
        <div class="p2-brand">
          ${buildPrintBrandHtml(profile, {
            companyName: profile.companyName || 'UMA MICRON',
            tagline: profile.tagline || "Micronization of API's"
          })}
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

      <div class="table-wrap">
        <table class="items">
          <colgroup>
            <col class="c-batch" /><col class="c-drum" /><col class="c-wt" /><col class="c-wt" /><col class="c-wt" />
            <col class="c-batch" /><col class="c-drum" /><col class="c-wt" /><col class="c-wt" /><col class="c-wt" />
          </colgroup>
          <thead>
            <tr>
              <th colspan="5">RECEIVED MATERIALS WEIGHT</th>
              <th colspan="5">DISPATCHED (MICRONIZED) MATERIALS WEIGHT</th>
            </tr>
            <tr>
              <th>BATCH NO.<span class="eg">(e.g. UMA/BPR/26-27/0001)</span></th>
              <th>DRUM NO</th><th>GROSS</th><th>TARE</th><th>NET</th>
              <th>BATCH NO.<span class="eg">(e.g. UMA/BPR/26-27/0001)</span></th>
              <th>DRUM NO</th><th>GROSS</th><th>TARE</th><th>NET</th>
            </tr>
          </thead>
          <tbody>
            ${packingRows.join('')}
            ${fillerRowsHtml}
            ${summaryRowsHtml}
          </tbody>
        </table>
      </div>

      <div class="signs" style="width:40%;">
        <div class="sign">${penIcon} Plant Supervisor Sign<span class="line"></span></div>
      </div>

      <div class="barfoot">
        <span>Thank&nbsp;you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>Page 2 of 2</span>
      </div>
    </div>
  </div>

</body>
</html>`;
};

export const renderBprPdf = async (data, { mode = 'save', printPrefs } = {}) => {
  let printData = data;
  try {
    const raw = localStorage.getItem('uma_erp_data');
    const appData = raw ? JSON.parse(raw) : {};
    const { enrichBPRForPrint } = await import('./receiptProducts');
    printData = enrichBPRForPrint(data, appData) || data;
  } catch {
    printData = data;
  }

  const html = applyPrintPrefsToHtml(buildBprHtml(printData, printData.companyProfile || data.companyProfile), printPrefs);
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  // iframe isolates BPR styles from ERP dark-theme table CSS (which was hiding weights)
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'bpr-pdf-render');
  iframe.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument || iframe.contentWindow.document;
  idoc.open();
  idoc.write(html);
  idoc.close();
  if (idoc.documentElement) idoc.documentElement.classList.add(PRINT_ROOT_CLASS);
  if (idoc.body) idoc.body.classList.add(PRINT_ROOT_CLASS);

  const fileBase = printData._blankSheet
    ? `BPR_Blank`
    : `BPR_${printData.bprNo || data.bprNo || 'N/A'}`;
  try {
    await new Promise((r) => {
      if (idoc.readyState === 'complete') {
        requestAnimationFrame(() => requestAnimationFrame(r));
      } else {
        iframe.onload = () => requestAnimationFrame(() => requestAnimationFrame(r));
      }
    });
    await new Promise((r) => setTimeout(r, 50));

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageNodes = [...idoc.querySelectorAll('.page')];
    for (let i = 0; i < pageNodes.length; i++) {
      if (i > 0) pdf.addPage();
      const target = pageNodes[i];
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        height: 1123,
        windowHeight: 1123,
        logging: false,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('.page').forEach((el) => {
            el.style.height = '1123px';
            el.style.minHeight = '1123px';
            el.style.maxHeight = '1123px';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.overflow = 'hidden';
            el.style.boxSizing = 'border-box';
          });
          clonedDoc.querySelectorAll('.sheet').forEach((el) => {
            el.style.flex = '1 1 auto';
            el.style.height = '100%';
            el.style.minHeight = '0';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.boxSizing = 'border-box';
          });
          clonedDoc.querySelectorAll('.page.page-p2 .table-wrap').forEach((el) => {
            el.style.flex = '1 1 auto';
            el.style.minHeight = '0';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.marginBottom = '6px';
            el.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('.page.page-p2 table.items').forEach((el) => {
            el.style.flex = '1 1 auto';
            el.style.height = '100%';
            el.style.margin = '0';
            el.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('.page:not(.page-p2) .table-wrap').forEach((el) => {
            el.style.flex = '0 0 auto';
            el.style.minHeight = '0';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.marginBottom = '10px';
            el.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('.page:not(.page-p2) table.items').forEach((el) => {
            el.style.flex = '0 0 auto';
            el.style.height = 'auto';
            el.style.margin = '0';
            el.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('table.items thead th').forEach((el) => {
            el.style.height = 'auto';
            el.style.padding = '4px 3px';
            el.style.verticalAlign = 'middle';
            el.style.whiteSpace = 'normal';
            el.style.fontSize = '11px';
            el.style.lineHeight = '1.15';
          });
          clonedDoc.querySelectorAll('table.g th, table.g td').forEach((el) => {
            el.style.wordBreak = 'normal';
            el.style.overflowWrap = 'normal';
            el.style.hyphens = 'none';
            el.style.whiteSpace = 'normal';
            el.style.lineHeight = '1.2';
          });
          clonedDoc.querySelectorAll('table.g .light-purple-header td, table.g tr.light-purple-header td').forEach((el) => {
            el.style.fontSize = '10.5px';
            el.style.lineHeight = '1.25';
            el.style.padding = '5px 3px';
          });
          clonedDoc.querySelectorAll('table.items tbody td').forEach((el) => {
            const isFiller = el.closest('tr.filler-row');
            const isSummary = el.closest('tr.summary-row');
            if (isFiller) {
              el.style.height = 'auto';
              el.style.minHeight = '16px';
              el.style.maxHeight = 'none';
              el.style.padding = '2px';
              el.style.verticalAlign = 'middle';
              el.style.visibility = 'visible';
              el.style.setProperty('background', '#ffffff', 'important');
              el.style.setProperty('color', 'transparent', 'important');
              el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
              return;
            }
            el.style.height = '26px';
            el.style.minHeight = '26px';
            el.style.maxHeight = '';
            el.style.padding = '3px 2px';
            el.style.verticalAlign = 'middle';
            el.style.overflow = 'visible';
            el.style.textOverflow = 'clip';
            el.style.whiteSpace = 'nowrap';
            el.style.lineHeight = '1.1';
            el.style.fontSize = '11px';
            el.style.setProperty('background', el.classList.contains('purple-header') ? '#5a009d' : '#ffffff', 'important');
            el.style.setProperty('color', el.classList.contains('purple-header') ? '#ffffff' : '#231f20', 'important');
            el.style.setProperty('-webkit-text-fill-color', el.classList.contains('purple-header') ? '#ffffff' : '#231f20', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            if (isSummary) {
              el.style.height = '26px';
              el.style.minHeight = '26px';
            }
          });
          // Do NOT re-run fill here — html2canvas clone layout is unreliable and
          // would wipe blank rows added on the live iframe.
          clonedDoc.querySelectorAll('table.items tbody td.wt').forEach((el) => {
            el.style.setProperty('color', '#231f20', 'important');
            el.style.setProperty('-webkit-text-fill-color', '#231f20', 'important');
            el.style.fontWeight = '700';
            el.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('table.items tbody td.lump-label').forEach((el) => {
            el.style.overflow = 'visible';
            el.style.whiteSpace = 'nowrap';
          });
          clonedDoc.querySelectorAll('.signs').forEach((el) => {
            el.style.marginTop = '4px';
            el.style.marginBottom = '0';
            el.style.flexShrink = '0';
          });
          clonedDoc.querySelectorAll('.page.page-p2 .barfoot').forEach((el) => {
            el.style.margin = '6px -10px -10px -10px';
            el.style.borderRadius = '0';
            el.style.flexShrink = '0';
            el.style.width = 'auto';
            el.style.boxSizing = 'border-box';
          });
          clonedDoc.querySelectorAll('.page:not(.page-p2) .barfoot').forEach((el) => {
            el.style.margin = 'auto -10px -10px -10px';
            el.style.borderRadius = '0';
            el.style.flexShrink = '0';
            el.style.width = 'auto';
            el.style.boxSizing = 'border-box';
          });
          clonedDoc.querySelectorAll('table.g td').forEach((el) => {
            el.style.setProperty('background', el.classList.contains('purple-header') ? '#5a009d' : '#ffffff', 'important');
            el.style.setProperty('color', el.classList.contains('purple-header') ? '#ffffff' : '#231f20', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
          });
          clonedDoc.querySelectorAll('table.items thead th, table.g .light-purple-header td').forEach((el) => {
            if (el.closest('thead')) {
              el.style.setProperty('background', '#5a009d', 'important');
              el.style.setProperty('color', '#ffffff', 'important');
            }
          });
        }
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
    iframe.remove();
  }
};

export { emptyMetrics };
