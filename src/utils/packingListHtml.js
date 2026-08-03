import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import { escHtml, fmtMoney, buildPrintLogoHtml } from './printTheme';

const parseWeight = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  return parseFloat(value) || 0;
};

export const buildPackingListHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  // Drop blank filler rows (no weights and no identifiers) so Grand Total sits under real data
  const batches = (data.batches || []).filter((batch) => {
    const hasWeight = parseWeight(batch.gross) > 0 || parseWeight(batch.tare) > 0 || parseWeight(batch.net) > 0;
    const hasId = String(batch.batchNo || '').trim() || String(batch.drumNo ?? '').trim();
    return hasWeight || hasId;
  });
  const plNo = escHtml(data.plNo || '');
  const plDate = escHtml(formatPdfDateDmy(data.date) || '');

  // ── Group batches by batchNo ──
  const batchGroups = [];
  const batchGroupMap = {};
  let globalSr = 1;

  batches.forEach((batch) => {
    const key = batch.batchNo || 'Unknown';
    if (!batchGroupMap[key]) {
      batchGroupMap[key] = { batchNo: key, rows: [], totalGross: 0, totalTare: 0, totalNet: 0 };
      batchGroups.push(batchGroupMap[key]);
    }
    const gross = parseWeight(batch.gross);
    const tare = parseWeight(batch.tare);
    const net = batch.net !== '' && batch.net !== null && batch.net !== undefined
      ? parseWeight(batch.net)
      : Math.max(0, gross - tare);

    batchGroupMap[key].rows.push({ ...batch, gross, tare, net, sr: globalSr++ });
    batchGroupMap[key].totalGross += gross;
    batchGroupMap[key].totalTare += tare;
    batchGroupMap[key].totalNet += net;
  });

  // ── Build table rows (data only — no empty spacer rows) ──
  let grandGross = 0;
  let grandTare = 0;
  let grandNet = 0;

  const tableRowsHtml = batchGroups.map((group) => {
    grandGross += group.totalGross;
    grandTare += group.totalTare;
    grandNet += group.totalNet;

    return group.rows.map((r) => `
      <tr>
        <td class="num">${r.sr}</td>
        <td class="num">${escHtml(r.batchNo || '')}</td>
        <td class="num">${escHtml(r.drumNo ?? '')}</td>
        <td class="num">${r.gross > 0 ? fmtMoney(r.gross) : ''}</td>
        <td class="num">${r.tare > 0 ? fmtMoney(r.tare) : ''}</td>
        <td class="num">${r.net > 0 ? fmtMoney(r.net) : ''}</td>
      </tr>`).join('');
  }).join('');

  const TARGET_ROW_COUNT = 33;
  const actualRowsCount = batchGroups.reduce((acc, g) => acc + g.rows.length, 0);
  const emptyRowsCount = Math.max(0, TARGET_ROW_COUNT - actualRowsCount);
  const emptyRowsHtml = Array.from({ length: emptyRowsCount }).map(() => `
      <tr class="empty">
        <td class="num">&nbsp;</td>
        <td class="num">&nbsp;</td>
        <td class="num">&nbsp;</td>
        <td class="num">&nbsp;</td>
        <td class="num">&nbsp;</td>
        <td class="num">&nbsp;</td>
      </tr>`).join('');

  const declaredNet = parseFloat(data.totalWeight);
  const finalNet = Number.isFinite(declaredNet) && declaredNet > 0 ? declaredNet : grandNet;
  const totalDrums = parseInt(data.totalDrums, 10) || batches.length;

  const logoHtml = buildPrintLogoHtml(profile);

  // Determine product name from batches or form data
  const productName = escHtml(data.productName || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UMA MICRON - Packing List</title>
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
  }
  *{box-sizing:border-box;font-family:Cambria,Georgia,serif;}
  html,body{margin:0;padding:0;background:#fff;font-family:Cambria,Georgia,serif;color:var(--text);}
  
  .page {
    width: 794px;
    height: 1123px;
    padding: 4px;
    margin: 0;
    background: #fff;
    display: flex;
    flex-direction: column;
  }

  .content-wrapper {
    width: 100%;
    flex: 1;
    border-collapse: collapse;
    border: 2px solid var(--purple);
    box-sizing: border-box;
  }
  .content-wrapper td { padding: 0; vertical-align: top; }

  /* ===== HEADER ===== */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 14px;
    margin-bottom: 10px;
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
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  /* ===== PL META INFO ROW ===== */
  .pl-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
    gap: 20px;
  }
  .pl-meta-left {
    font-size:12px;
    line-height: 2;
  }
  .pl-meta-right {
    font-size:12px;
    line-height: 2;
  }
  .meta-field {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .meta-field .lbl {
    font-weight: 700;
    color: var(--purple);
    white-space: nowrap;
  }
  .meta-field .colon {
    font-weight: 700;
    color: var(--purple);
  }
  .meta-field .val {
    font-weight: 600;
    min-width: 120px;
  }
  .meta-field .val-line {
    font-weight: 400;
    border-bottom: 1px solid #999;
    min-width: 160px;
    display: inline-block;
    padding-bottom: 1px;
  }

  /* ===== TABLE ===== */
  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size:12px;
  }
  table.items thead th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 7px 6px;
    text-align: center;
    border: 1px solid var(--purple);
  }
  table.items tbody td {
    border: 1px solid var(--lav-border);
    padding: 4px 6px;
    text-align: center;
    height: 22px;
  }
  table.items tbody tr.empty td { height: 22px; }

  /* Batch subtotal row */
  table.items tbody tr.batch-subtotal td {
    border: 1px solid var(--lav-border);
    border-top: 2px solid var(--purple);
    padding: 5px 6px;
    background: var(--lav-bg);
    color: var(--purple-dark);
  }

  /* Grand total row */
  table.items tfoot td {
    border: 2px solid var(--purple);
    background: var(--purple);
    color: #fff;
    font-weight: 800;
    padding: 7px 6px;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="page">
    <table class="content-wrapper">
      <tr>
        <td style="padding: 16px;">
      
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
              <div class="ti-title">PACKING LIST</div>
            </div>
          </div>

          <div class="pl-meta-row">
            <div class="pl-meta-left">
              <div class="meta-field"><span class="lbl">PL No.</span><span class="colon">:</span><span class="val-line">${plNo || '&nbsp;'}</span></div>
              <div class="meta-field"><span class="lbl">Date</span><span class="colon">:</span><span class="val-line">${plDate || '&nbsp;'}</span></div>
            </div>
            <div class="pl-meta-right">
              <div class="meta-field"><span class="lbl">Name of Product</span><span class="colon">:</span><span class="val">${productName || '&nbsp;'}</span></div>
              <div class="meta-field"><span class="lbl">Total Drum</span><span class="colon">:</span><span class="val">${escHtml(totalDrums)}</span></div>
              <div class="meta-field"><span class="lbl">Total Quantity</span><span class="colon">:</span><span class="val">${fmtMoney(finalNet)} KGS</span></div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th style="width:8%;">Sr. No.</th>
                <th style="width:18%;">Batch No.</th>
                <th style="width:10%;">Drum No.</th>
                <th style="width:18%;">Gross Wt. (kg)</th>
                <th style="width:16%;">Tare Wt. (kg)</th>
                <th style="width:18%;">Net Wt. (kg)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
              ${emptyRowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">GRAND TOTAL</td>
                <td>${grandGross > 0 ? fmtMoney(grandGross) : ''}</td>
                <td>${grandTare > 0 ? fmtMoney(grandTare) : ''}</td>
                <td>${fmtMoney(finalNet)}</td>
              </tr>
            </tfoot>
          </table>

        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
};

export const renderPackingListPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPackingListHtml(data, data.companyProfile);
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-12000px;top:0;z-index:-1;background:#fff;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const target = host.querySelector('.page') || host.firstElementChild;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      height: 1123,
      windowheight: 1123,
      logging: false
    });

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);

    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `PL_${data.plNo || 'N/A'}`;
    } else {
      pdf.save(`PL_${data.plNo || 'N/A'}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
