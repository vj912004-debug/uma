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
  const logoHtml = logoSrc ? `<img src="${logoSrc}" alt="Logo">` : `<img src="data:image/png;base64,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" style="width:100%;height:100%;object-fit:contain;" alt="Logo" />`;

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
  html,body{margin:0;padding: 4px;background:#fff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:var(--text);}
  
  /* A4 scaling */
  .page {
    width: 794px;
    min-height: 1123px;
    padding: 4px;
    margin: 0;
    background: #fff;
    border: none;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }

  /* Outline for the whole content */
  .content-wrapper { width: 100%; min-height: 1115px; height: 1115px; border-collapse: collapse; border: 2px solid var(--purple); box-sizing: border-box; }
  .content-wrapper td { padding: 0; }

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
    display: block;
    position: relative;
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
  .table-container { }
  table.items{
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
  .footer-bottom { display: flex; gap: 14px;  margin-bottom: 14px; }
  .sign-box { flex: 1; border: 1px solid var(--lav-border); display: flex; flex-direction: column; min-height: 100px; }
  .sign-area { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 10px; text-align: center; }
  .sign-text { border-top: 1px solid #777777; padding-top: 5px; color: var(--text); font-weight: bold; width: 90%; margin: 0; font-size: 11.5px; }
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
    }
</style>
</head>
<body>

  <!-- PAGE 1: PROCESS SCHEDULE -->
  <div class="page">
    <table class="content-wrapper">
  <tr>
    <td valign="top" style="padding: 18px; padding-bottom: 0;">
      
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
        <div class="bpr-body" style="padding: 4px;">
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
        <div class="bpr-body" style="padding: 4px;">
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
        <div class="bpr-body" style="padding: 4px;">
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
        <span>This is a computer-generated document and does not require a physical signature.</span>
        <span>Page 1 of 2</span>
      </div>

    </div>
  </div>

  <!-- PAGE 2: BATCH PACKING RECORD -->
  <div class="page">
    <table class="content-wrapper">
  <tr>
    <td valign="top" style="padding: 18px; padding-bottom: 0;">
      
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

      <div class="table-container">
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
  </div>

      <div class="footer-bottom">
        <div class="sign-box" style="flex: 0 0 33%;">
          <div class="bpr-header">PLANT SUPERVISOR SIGN</div>
          <div class="sign-area"><div class="sign-text">Authorised Signatory</div></div>
        </div>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>This is a computer-generated document and does not require a physical signature.</span>
        <span>Page 2 of 2</span>
          </td>
  </tr>
</table>
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
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 0;
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
        height: target.scrollHeight,
        windowheight: target.scrollHeight,
        logging: false
      });

      const naturalW = usableW;
      const naturalH = (canvas.height * naturalW) / canvas.width;
      const scale = Math.min(usableW / naturalW, usableH / naturalH, 1);
      const drawW = naturalW * scale;
      const drawH = naturalH * scale;
      const x = margin + (usableW - drawW) / 2;
      const y = margin;
      
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
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
