import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  fmtMoney,
  buildPrintBrandHtml,
  applyPrintPrefsToHtml,
  renderHtmlToPdf
} from './printTheme';

const parseWeight = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  return parseFloat(value) || 0;
};

const padDrums = (n) => {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v) || v < 0) return '00';
  return String(v).padStart(2, '0');
};

const isSievingLumpBatch = (batch = {}) => {
  const text = `${batch.batchNo || ''} ${batch.drumNo || ''} ${batch.productName || ''}`.toLowerCase();
  return /sieving\s*lumps?/.test(text);
};

export const buildPackingListHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const rawBatches = (data.batches || []).filter((batch) => {
    const hasWeight = parseWeight(batch.gross) > 0 || parseWeight(batch.tare) > 0 || parseWeight(batch.net) > 0;
    const hasId = String(batch.batchNo || '').trim() || String(batch.drumNo ?? '').trim();
    return hasWeight || hasId;
  });

  let sievingLumps = parseWeight(
    data.sievingLumps ?? data.sievingLumpsNet ?? data.lumpsNet ?? data.lumpsNetWeight ?? ''
  );
  const batches = [];
  rawBatches.forEach((batch) => {
    if (isSievingLumpBatch(batch)) {
      const net = batch.net !== '' && batch.net != null
        ? parseWeight(batch.net)
        : Math.max(0, parseWeight(batch.gross) - parseWeight(batch.tare));
      if (net > 0 && sievingLumps <= 0) sievingLumps = net;
      return;
    }
    batches.push(batch);
  });

  const plNo = escHtml(data.plNo || '');
  const plDate = escHtml(formatPdfDateDmy(data.date) || '');
  const productName = escHtml(data.productName || '');
  const companyName = escHtml(profile.companyName || 'UMA MICRON');

  let grandGross = 0;
  let grandTare = 0;
  let grandNet = 0;
  let globalSr = 1;

  // Group consecutive / same batch numbers — each batch gets its own TOTAL
  const batchGroups = [];
  const groupMap = {};
  batches.forEach((batch) => {
    const key = String(batch.batchNo || '').trim() || '—';
    if (!groupMap[key]) {
      groupMap[key] = { batchNo: key, rows: [], gross: 0, tare: 0, net: 0 };
      batchGroups.push(groupMap[key]);
    }
    const gross = parseWeight(batch.gross);
    const tare = parseWeight(batch.tare);
    const net = batch.net !== '' && batch.net !== null && batch.net !== undefined
      ? parseWeight(batch.net)
      : Math.max(0, gross - tare);
    groupMap[key].rows.push({ batch, gross, tare, net });
    groupMap[key].gross += gross;
    groupMap[key].tare += tare;
    groupMap[key].net += net;
    grandGross += gross;
    grandTare += tare;
    grandNet += net;
  });

  const tableRowsHtml = batchGroups.map((group) => {
    const rowHtml = group.rows.map(({ batch, gross, tare, net }) => {
      const sr = globalSr++;
      return `
      <tr>
        <td>${sr}</td>
        <td>${escHtml(batch.batchNo || '')}</td>
        <td>${escHtml(batch.drumNo ?? '')}</td>
        <td class="num">${gross > 0 ? fmtMoney(gross) : ''}</td>
        <td class="num">${tare > 0 ? fmtMoney(tare) : ''}</td>
        <td class="num">${net > 0 ? fmtMoney(net) : ''}</td>
      </tr>`;
    }).join('');

    const batchTotalHtml = `
      <tr class="batch-total-row">
        <td></td>
        <td colspan="2" class="total-label">TOTAL — Batch ${escHtml(group.batchNo)}</td>
        <td class="num">${fmtMoney(group.gross)}</td>
        <td class="num">${fmtMoney(group.tare)}</td>
        <td class="num">${fmtMoney(group.net)}</td>
      </tr>`;

    return `${rowHtml}${batchTotalHtml}`;
  }).join('');

  // Sample layout: Sieving Lumps under Gross, value under Net
  const sievingLumpsHtml = sievingLumps > 0 ? `
      <tr class="special-row">
        <td></td>
        <td></td>
        <td></td>
        <td class="special-label">Sieving Lumps</td>
        <td></td>
        <td class="num">${fmtMoney(sievingLumps)}</td>
      </tr>` : '';

  const netWithLumps = grandNet + sievingLumps;
  const declaredNet = parseFloat(data.totalWeight);
  const finalNet = Number.isFinite(declaredNet) && declaredNet > 0 ? declaredNet : netWithLumps;

  // Always show overall total when there is data (align Gross / Tare / Net with batch totals)
  const overallTotalHtml = (batchGroups.length > 0 || sievingLumps > 0) ? `
      <tr class="total-row">
        <td></td>
        <td colspan="2" class="total-label">GRAND TOTAL</td>
        <td class="num">${fmtMoney(grandGross)}</td>
        <td class="num">${fmtMoney(grandTare)}</td>
        <td class="num">${fmtMoney(finalNet)}</td>
      </tr>` : '';

  const totalDrums = padDrums(parseInt(data.totalDrums, 10) || batches.length);
  const qtyText = finalNet > 0 ? `${fmtMoney(finalNet)} KGS` : '';

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
    --green:#2fa84f;
    --text:#231f20;
  }
  *{box-sizing:border-box;margin:0;padding:0;font-family:Cambria,Georgia,serif;}
  html,body{margin:0;padding:0;background:#fff;color:var(--text);}
  .page{
    width:794px;height:1123px;padding:8px;margin:0;background:#fff;
    display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;
  }
  .sheet{
    flex:1;border:2px solid var(--purple);padding:12px 14px 0;
    display:flex;flex-direction:column;box-sizing:border-box;min-height:0;
  }

  .header{
    display:flex;justify-content:space-between;align-items:center;gap:12px;
    margin:0 0 12px;padding:0 0 10px;
  }
  .brand{display:flex;align-items:center;gap:10px;min-width:0;}
  .logo{width:64px;height:64px;flex-shrink:0;}
  .logo img,.logo svg{width:100%;height:100%;object-fit:contain;display:block;}

  .brand-lockup{width:280px;height:70px;flex-shrink:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}

  .brand-text h1{
    margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;
    letter-spacing:.5px;color:var(--purple);line-height:1;text-transform:uppercase;
  }
  .brand-text .tagline{
    color:var(--green);font-weight:700;font-size:13px;margin-top:2px;line-height:1.15;
  }
  .tax-invoice-box{
    background:var(--purple);color:#fff;text-align:center;padding:10px 20px;
    min-width:200px;min-height:64px;border-radius:6px;box-sizing:border-box;
    display:flex;flex-direction:column;justify-content:center;align-items:center;
  }
  .tax-invoice-box .ti-title{
    font-size:22px;font-weight:800;letter-spacing:.5px;margin:0;line-height:1.1;white-space:nowrap;
  }
  .tax-invoice-box .ti-sub{
    margin-top:5px;background:#fff;color:var(--purple);font-size:10px;font-weight:700;
    letter-spacing:.4px;padding:2px 8px;border-radius:3px;
  }

  .pl-meta{
    display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;
    margin-bottom:14px;padding:10px 12px;
    border:1px solid var(--lav-border);border-radius:6px;background:var(--lav-bg);
  }
  .meta-field{display:flex;gap:8px;align-items:baseline;font-size:13px;line-height:1.5;}
  .meta-field .lbl{font-weight:700;color:var(--purple);white-space:nowrap;min-width:120px;}
  .meta-field .colon{font-weight:700;color:var(--purple);}
  .meta-field .val{font-weight:600;color:var(--text);}

  .table-wrap{flex:1 1 auto;min-height:0;margin-bottom:10px;}
  table.items{
    width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;background:#fff;
  }
  table.items thead th{
    background:var(--purple);color:#fff;font-weight:700;padding:8px 6px;
    text-align:center;vertical-align:middle;border:1px solid rgba(255,255,255,.55);
    line-height:1.25;font-size:12px;
  }
  table.items tbody td{
    border:1px solid var(--lav-border);padding:6px 4px;text-align:center;
    vertical-align:middle;background:#fff;color:var(--text);height:28px;font-weight:600;
  }
  table.items tbody td.num{text-align:center;}
  table.items tbody tr.special-row td,
  table.items tbody tr.batch-total-row td,
  table.items tbody tr.total-row td{
    background:var(--lav-bg);color:var(--purple-dark);font-weight:800;
    border-color:var(--purple);
  }
  table.items tbody tr.batch-total-row td{
    background:#f3eef9;
  }
  table.items td.special-label,
  table.items td.total-label{
    font-weight:800;text-align:center;white-space:nowrap;color:var(--purple);
  }

  .barfoot{
    background:var(--purple);color:#fff;margin:0 -14px 0 -14px;padding:8px 14px;
    display:flex;justify-content:space-between;align-items:center;
    font-size:12px;flex-shrink:0;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <div class="header">
        <div class="brand">
      ${buildPrintBrandHtml(profile, {
        companyName: profile.companyName || 'UMA MICRON',
        tagline: profile.tagline || "Micronization of API's"
      })}
    </div>
        <div class="tax-invoice-box">
          <div class="ti-title">PACKING LIST</div>
          <div class="ti-sub">${plNo || 'ORIGINAL'}</div>
        </div>
      </div>

      <div class="pl-meta">
        <div class="meta-field"><span class="lbl">Name of Product</span><span class="colon">:</span><span class="val">${productName || '&nbsp;'}</span></div>
        <div class="meta-field"><span class="lbl">Date</span><span class="colon">:</span><span class="val">${plDate || '&nbsp;'}</span></div>
        <div class="meta-field"><span class="lbl">Total Quantity</span><span class="colon">:</span><span class="val">${escHtml(qtyText) || '&nbsp;'}</span></div>
        <div class="meta-field"><span class="lbl">Total Drums</span><span class="colon">:</span><span class="val">${escHtml(totalDrums)}</span></div>
      </div>

      <div class="table-wrap">
        <table class="items">
          <thead>
            <tr>
              <th style="width:10%;">Sr. No.</th>
              <th style="width:18%;">Batch No.</th>
              <th style="width:12%;">Drum No.</th>
              <th style="width:20%;">Gross Wt. (kg)</th>
              <th style="width:20%;">Tare Wt. (kg)</th>
              <th style="width:20%;">Net Wt. (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            ${sievingLumpsHtml}
            ${overallTotalHtml}
          </tbody>
        </table>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

export const renderPackingListPdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const html = applyPrintPrefsToHtml(buildPackingListHtml(data, data.companyProfile), printPrefs);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'PL',
    docNo: data.plNo || 'N/A',
    fitPage: true,
    printPrefs
  });
};
