import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateSlash } from './taxInvoiceLayout';
import { escHtml, fmtQty, PRINT_PAGE_W } from './printTheme';

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

  const logoSrc = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  const logoHtml = logoSrc ? `<img src="${logoSrc}" alt="Logo">` : `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 8 C74 8 90 26 88 46 C86 63 72 78 55 80" fill="none" stroke="#2fa84f" stroke-width="6" stroke-linecap="round"/>
          <path d="M50 92 C26 92 10 74 12 54 C14 37 28 22 45 20" fill="none" stroke="#f47920" stroke-width="6" stroke-linecap="round"/>
          <polygon points="86,40 96,46 88,54" fill="#2fa84f"/>
          <polygon points="14,60 4,54 12,46" fill="#f47920"/>
          <text x="50" y="45" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="26" fill="#f47920">U</text>
          <text x="50" y="70" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="26" fill="#3d2b7d">M</text>
        </svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BPR - ${escHtml(profile.companyName)}</title>
<style>
  :root{
    --purple:#3d2b7d;
    --purple-dark:#2f2263;
    --lav-bg:#efeaf7;
    --lav-border:#c9bce8;
    --orange:#f47920;
    --green:#2fa84f;
    --text:#231f20;
    --grey-line:#d9d9d9;
    --primary-purple:#3d2b7d;
    --border-purple:#c9bce8;
    --light-purple-bg:#efeaf7;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#fff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:var(--text);}
  
  /* A4 scaling */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 10mm;
    margin: 0 auto;
    background: #fff;
    border: none;
    page-break-after: always;
  }

  /* Outline for the whole content */
  .content-wrapper {
    border: 2px solid var(--purple);
    padding: 18px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* ===== HEADER ===== */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 14px;
    margin-bottom: 14px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    width: 78px;
    height: 78px;
    position: relative;
    flex-shrink: 0;
  }
  .logo svg, .logo img { width: 100%; height: 100%; object-fit: contain; }
  .brand-text h1 {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 38px;
    letter-spacing: 1px;
    color: var(--purple);
    line-height: 1;
  }
  .brand-text .tagline {
    color: var(--green);
    font-weight: 700;
    font-size: 16px;
    margin-top: 2px;
  }
  .tax-invoice-box {
    background: var(--purple);
    color: #fff;
    text-align: center;
    padding: 10px 22px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 230px;
  }
  .tax-invoice-box .ti-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 1px;
    margin-bottom: 0px;
  }

  /* ===== BPR SECTIONS ===== */
  .bpr-meta-grid {
      display: flex; flex-wrap: wrap;
      border: 1.5px solid var(--border-purple); margin-bottom: 12px;
  }
  .bpr-meta-item { padding: 6px 10px; border-right: 1px solid var(--border-purple); border-bottom: 1px solid var(--border-purple); display: flex; align-items: center; font-size: 11.5px; width: 32%; box-sizing: border-box; }
  .bpr-meta-item.label { color: var(--purple); font-weight: bold; background: var(--lav-bg); width: 18%; }
  .bpr-meta-grid .bpr-meta-item:nth-child(4n) { border-right: none; }
  .bpr-meta-grid .bpr-meta-item:nth-last-child(-n+4) { border-bottom: none; }

  .bpr-section { border: 1.5px solid var(--border-purple); margin-bottom: 12px; }
  .bpr-header {
      background-color: var(--lav-bg);
      color: var(--purple);
      font-weight: 800;
      font-size: 13px;
      padding: 7px 12px;
      border-bottom: 1px solid var(--border-purple);
  }
  .bpr-body { padding: 8px 10px; font-size: 11.5px; }
  .bpr-grid { width: 100%; border-collapse: collapse; }
  .bpr-grid td { border: 1px solid var(--grey-line); padding: 5px 6px; font-size: 11.5px; vertical-align: middle; }
  .bpr-grid td.lbl { color: var(--purple); font-weight: bold; width: 28%; background: var(--lav-bg); }
  
  .checklist-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted var(--border-purple); font-size: 11.5px; }
  .checklist-row:last-child { border-bottom: none; }

  /* ===== TABLE ===== */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size: 11.5px;
  }
  table.items thead th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 8px 6px;
    text-align: center;
    border: 1px solid var(--purple);
  }
  table.items tbody td {
    border: 1px solid var(--lav-border);
    padding: 6px 6px;
    height: 20px;
  }
  table.items tbody td.center { text-align: center; }

  /* ===== FOOTER ===== */
  .footer-bottom { display: flex; gap: 14px; margin-top: auto; margin-bottom: 14px; }
  .sign-box { flex: 1; border: 1px solid var(--lav-border); display: flex; flex-direction: column; min-height: 100px; }
  .sign-area { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 10px; text-align: center; }
  .sign-text { border-top: 1px solid #777777; padding-top: 5px; color: var(--text); font-weight: bold; width: 90%; margin: 0 auto; font-size: 11.5px; }
  .seal-box {
      flex: 1; border: 1px dashed var(--purple); 
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: var(--purple); font-weight: bold; gap: 5px; min-height: 100px; font-size: 11.5px;
  }

  .barfoot {
    background: var(--purple);
    color: #fff;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    margin-top: auto;
  }
</style>
</head>
<body>

  <!-- PAGE 1: PROCESS SCHEDULE -->
  <div class="page">
    <div class="content-wrapper">
      
      <div class="header">
        <div class="brand">
          <div class="logo">
            ${logoHtml}
          </div>
          <div class="brand-text">
            <h1>${escHtml(profile.companyName || 'UMA MICRON')}</h1>
            <div class="tagline">Micronization of API's</div>
          </div>
        </div>
        <div class="tax-invoice-box">
          <div class="ti-title">BATCH PROCESSING RECORD</div>
        </div>
      </div>

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
        <div class="bpr-header">PROCESS SCHEDULE</div>
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
        <div class="bpr-header">CLEANING CHECKLIST</div>
        <div class="bpr-body">
          <div class="checklist-row"><span>Is the Micronizar cleaned?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.equipmentCleaned))}</b></div>
          <div class="checklist-row"><span>Is the processesing Area Cleaned?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.areaCleaned))}</b></div>
          <div class="checklist-row"><span>Is the filter Bag before process packed and labeled in LDPE Bag?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.lineClearance))}</b></div>
          <div class="checklist-row"><span>Is the bag is clean and black spot free?</span><b>${escHtml(bprCheck(data.cleaningChecklist?.bagClean))}</b></div>
        </div>
      </div>

      <div class="bpr-section">
        <div class="bpr-header">PRESSURE READINGS</div>
        <div class="bpr-body" style="padding:0;">
          <table class="items" style="margin-bottom:0; border:none;">
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
        <div class="bpr-header">PACKING MATERIALS &amp; DISPATCH</div>
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
          <div class="bpr-header">OPERATOR SIGNATURE</div>
          <div class="sign-area"><div class="sign-text">Operator</div></div>
        </div>
        <div class="seal-box"><div>Seal</div></div>
        <div class="sign-box">
          <div class="bpr-header">PLANT SUPERVISOR</div>
          <div class="sign-area"><div class="sign-text">Supervisor</div></div>
        </div>
      </div>
      
      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>This is a computer generated document.</span>
        <span>Page 1 of 2</span>
      </div>

    </div>
  </div>

  <!-- PAGE 2: BATCH PACKING RECORD -->
  <div class="page">
    <div class="content-wrapper">
      
      <div class="header">
        <div class="brand">
          <div class="logo">
            ${logoHtml}
          </div>
          <div class="brand-text">
            <h1>${escHtml(profile.companyName || 'UMA MICRON')}</h1>
            <div class="tagline">Micronization of API's</div>
          </div>
        </div>
        <div class="tax-invoice-box">
          <div class="ti-title">BATCH PACKING RECORD</div>
        </div>
      </div>
      
      <div class="bpr-meta-grid">
        <div class="bpr-meta-item label">BPR No.</div><div class="bpr-meta-item">${bprNo}</div>
        <div class="bpr-meta-item label">Date</div><div class="bpr-meta-item">${bprDate}</div>
        <div class="bpr-meta-item label">Product</div><div class="bpr-meta-item">${escHtml(productName)}</div>
        <div class="bpr-meta-item label">Customer</div><div class="bpr-meta-item">${escHtml(customerName)}</div>
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
          <tr style="background: var(--lav-bg);">
            <td colspan="4" class="center" style="font-weight:bold; color:var(--purple);">Micronized Material Net Weight</td>
            <td style="font-weight:bold; color:var(--purple);">${dispatchedNet !== '0.00' ? dispatchedNet : ''}</td>
            <td colspan="5"></td>
          </tr>
        </tbody>
      </table>

      <div class="footer-bottom">
        <div class="sign-box" style="flex: 0 0 33%;">
          <div class="bpr-header">PLANT SUPERVISOR SIGN</div>
          <div class="sign-area"><div class="sign-text">Authorised Signatory</div></div>
        </div>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>This is a computer generated document.</span>
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
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;background:#fff;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 4;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

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
        logging: false
      });

      const naturalW = usableW;
      const naturalH = (canvas.height * naturalW) / canvas.width;
      const scale = Math.min(usableW / naturalW, usableH / naturalH, 1);
      const drawW = naturalW * scale;
      const drawH = naturalH * scale;
      const x = margin + (usableW - drawW) / 2;
      const y = margin;
      
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH);
    }

    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `BPR_${data.bprNo || 'N/A'}`;
    } else {
      pdf.save(`BPR_${data.bprNo || 'N/A'}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
