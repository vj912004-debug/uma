import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  fmtMoney,
  buildPrintBrandHtml,
  applyPrintPrefsToHtml,
  renderHtmlToPdf,
  loadUmaAppData,
  buildStatusBar,
  PRINT_FOOTER_MESSAGES
} from './printTheme';
import {
  alignDrumRowsToProducts,
  getReceiptProductNames,
  receiptProductOptions
} from './receiptProducts';

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

const normKey = (s) => String(s || '').trim().toLowerCase();

const rowNet = (batch) => {
  const gross = parseWeight(batch.gross);
  const tare = parseWeight(batch.tare);
  if (batch.net !== '' && batch.net !== null && batch.net !== undefined) {
    return parseWeight(batch.net);
  }
  return Math.max(0, gross - tare);
};

const rowMatchesProduct = (batch, name) => {
  const want = normKey(name);
  if (!want) return false;
  const raw = String(batch?.productName || '').trim();
  if (!raw) return false;
  if (normKey(raw) === want) return true;
  return raw.split(',').map((part) => normKey(part)).filter(Boolean).includes(want);
};

const expectedGroupRows = (data, name) => {
  const sum = (data.productSummaries || []).find((p) => normKey(p.prodName) === normKey(name));
  if (!sum) return 0;
  const drums = parseInt(sum.drums, 10);
  if (Number.isFinite(drums) && drums > 0) return drums;
  const count = parseInt(sum.batchCount, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const buildProductGroups = (batches, data, extraNames = []) => {
  const names = [];
  const addName = (name) => {
    String(name || '').split(',').forEach((part) => {
      const t = String(part || '').trim();
      if (!t || /^empty\s*drums?$/i.test(t)) return;
      if (names.some((n) => normKey(n) === normKey(t))) return;
      names.push(t);
    });
  };

  extraNames.forEach(addName);
  (data.productSummaries || []).forEach((p) => addName(p.prodName));
  batches.forEach((b) => addName(b.productName));
  addName(data.productName);

  const used = new Set();
  const take = (pred) => {
    const rows = [];
    batches.forEach((b, i) => {
      if (used.has(i) || !pred(b)) return;
      used.add(i);
      rows.push(b);
    });
    return rows;
  };

  const groups = names.map((name) => ({
    name,
    rows: take((b) => rowMatchesProduct(b, name))
  }));

  const leftover = take(() => true);
  if (leftover.length) {
    if (!groups.length) {
      groups.push({
        name: String(data.productName || 'Product').split(',')[0].trim() || 'Product',
        rows: leftover
      });
    } else {
      let li = 0;
      groups.forEach((group) => {
        const need = Math.max(0, expectedGroupRows(data, group.name) - group.rows.length);
        if (need > 0 && li < leftover.length) {
          group.rows.push(...leftover.slice(li, li + need));
          li += need;
        }
      });
      leftover.slice(li).forEach((row) => {
        const empty = groups.find((g) => !g.rows.length);
        (empty || groups[groups.length - 1]).rows.push(row);
      });
    }
  }

  const filled = groups.filter((g) => g.rows.length);
  return filled.length
    ? filled
    : [{ name: names[0] || String(data.productName || '').split(',')[0].trim() || 'Product', rows: [] }];
};

export const buildPackingListHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const appData = data.appData || loadUmaAppData();
  const mr = (appData.materialReceipts || []).find((r) => r.id && r.id === data.receiptId) || null;
  const prodOpts = mr ? receiptProductOptions(mr, appData) : {};
  const mrProductNames = mr ? getReceiptProductNames(mr, prodOpts) : [];
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
      const net = rowNet(batch);
      if (net > 0 && sievingLumps <= 0) sievingLumps = net;
      return;
    }
    batches.push(batch);
  });

  const plNo = escHtml(data.plNo || '');
  const plDate = escHtml(formatPdfDateDmy(data.date) || '');
  const taggedBatches = mr ? alignDrumRowsToProducts(batches, mr, prodOpts) : batches;
  const productGroups = buildProductGroups(taggedBatches, data, mrProductNames);

  const colgroup = `
          <colgroup>
            <col style="width:10%">
            <col style="width:28%">
            <col style="width:12%">
            <col style="width:16.67%">
            <col style="width:16.67%">
            <col style="width:16.66%">
          </colgroup>`;

  const thead = `
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Batch No.</th>
              <th>Drum No.</th>
              <th>Gross Wt. (kg)</th>
              <th>Tare Wt. (kg)</th>
              <th>Net Wt. (kg)</th>
            </tr>
          </thead>`;

  const productBlocksHtml = productGroups.map((group) => {
    let productNet = 0;
    const bodyRows = group.rows.map((batch, idx) => {
      const gross = parseWeight(batch.gross);
      const tare = parseWeight(batch.tare);
      const net = rowNet(batch);
      productNet += net;
      return `
            <tr>
              <td>${idx + 1}</td>
              <td class="batch">${escHtml(batch.batchNo || '')}</td>
              <td>${escHtml(batch.drumNo ?? '')}</td>
              <td class="num">${gross > 0 ? fmtMoney(gross) : ''}</td>
              <td class="num">${tare > 0 ? fmtMoney(tare) : ''}</td>
              <td class="num">${net > 0 ? fmtMoney(net) : ''}</td>
            </tr>`;
    }).join('');

    const qtyText = `${fmtMoney(productNet)} KGS`;
    const drumsText = padDrums(group.rows.length);

    return `
      <section class="product-block">
        <div class="pl-meta">
          <div class="meta-field"><span class="lbl">Name of Product</span><span class="colon">:</span><span class="val">${escHtml(group.name) || '&nbsp;'}</span></div>
          <div class="meta-field"><span class="lbl">Date</span><span class="colon">:</span><span class="val">${plDate || '&nbsp;'}</span></div>
          <div class="meta-field"><span class="lbl">Total Quantity</span><span class="colon">:</span><span class="val">${escHtml(qtyText) || '&nbsp;'}</span></div>
          <div class="meta-field"><span class="lbl">Total Drums</span><span class="colon">:</span><span class="val">${escHtml(drumsText)}</span></div>
        </div>
        <div class="table-wrap">
          <table class="items">
            ${colgroup}
            ${thead}
            <tbody>
              ${bodyRows || `
            <tr>
              <td>&nbsp;</td><td class="batch"></td><td></td><td class="num"></td><td class="num"></td><td class="num"></td>
            </tr>`}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td class="total-label">TOTAL</td>
                <td class="num">${fmtMoney(productNet)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>`;
  }).join('');

  const sievingLumpsHtml = sievingLumps > 0 ? `
      <section class="product-block lumps-block">
        <div class="table-wrap">
          <table class="items">
            ${colgroup}
            <tbody>
              <tr class="special-row">
                <td colspan="5" class="special-label">Sieving Lumps</td>
                <td class="num">${fmtMoney(sievingLumps)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>` : '';

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
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{margin:0;padding:0;background:#fff;color:var(--text);}
  .page{
    width:794px;min-height:1123px;padding:8px;margin:0;background:#fff;
    display:flex;flex-direction:column;box-sizing:border-box;overflow:visible;
  }
  .sheet{
    flex:1;border:2px solid var(--purple);padding:12px 14px 0;
    display:flex;flex-direction:column;box-sizing:border-box;min-height:0;overflow:visible;
  }

  .header{
    display:flex;justify-content:space-between;align-items:center;gap:16px;
    margin:0 0 10px;padding:0;flex:0 0 auto;min-width:0;
  }
  .brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;}
  .logo{width:64px;height:64px;flex-shrink:0;}
  .logo img,.logo svg{width:100%;height:100%;object-fit:contain;display:block;}
  .brand-lockup{width:100%;max-width:280px;height:70px;flex-shrink:1;min-width:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}
  .brand-text{min-width:0;}
  .brand-text h1{
    margin:0;font-size:30px;letter-spacing:.4px;color:var(--purple);
    line-height:1.1;text-transform:uppercase;
  }
  .brand-text .tagline{
    color:var(--green);font-weight:700;font-size:13px;margin-top:2px;line-height:1.2;
  }
  .tax-invoice-box{
    background:var(--purple);color:#fff;text-align:center;padding:10px 18px 12px;
    flex:0 0 auto;width:210px;border-radius:8px;box-sizing:border-box;
    display:flex;flex-direction:column;align-items:center;gap:8px;
  }
  .tax-invoice-box .ti-title{
    font-size:22px;font-weight:800;margin:0;padding:0;line-height:1.2;
    letter-spacing:.5px;white-space:nowrap;
  }
  .tax-invoice-box .ti-sub{
    margin:0;background:#fff;color:#111;font-size:11px;font-weight:700;
    padding:4px 12px;border-radius:999px;line-height:1.3;white-space:nowrap;
    border:1px solid #111;
  }

  .products{flex:0 0 auto;min-height:0;overflow:visible;display:flex;flex-direction:column;}
  .product-block{flex:0 0 auto;margin:0 0 16px;}
  .product-block:last-child{margin-bottom:8px;}

  .pl-meta{
    display:grid;grid-template-columns:1.2fr 1fr;gap:2px 28px;
    margin:0 0 8px;padding:0;flex:0 0 auto;
    border:none;background:transparent;
  }
  .meta-field{
    display:flex;align-items:baseline;min-width:0;font-size:13px;line-height:1.4;
  }
  .meta-field .lbl{
    font-weight:700;color:var(--purple);white-space:nowrap;flex:0 0 118px;
  }
  .meta-field .colon{
    font-weight:700;color:var(--purple);flex:0 0 auto;padding:0 8px 0 0;
  }
  .meta-field .val{
    font-weight:600;color:var(--text);flex:1 1 auto;min-width:0;
    overflow-wrap:break-word;word-break:break-word;
  }

  .table-wrap{
    flex:0 0 auto;min-height:0;margin:0;overflow:visible;
  }
  table.items{
    width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;
    background:#fff;height:auto;
  }
  table.items thead,
  table.items tfoot{height:1px;}
  table.items thead th{
    background:var(--purple);color:#fff;font-weight:700;padding:7px 8px;
    text-align:center;vertical-align:middle;border:1px solid rgba(255,255,255,.55);
    line-height:1.25;white-space:nowrap;
  }
  table.items tbody td,
  table.items tfoot td{
    border:1px solid var(--lav-border);padding:5px 8px;text-align:center;
    vertical-align:middle;background:#fff;color:var(--text);
    height:auto;min-height:22px;font-weight:600;line-height:1.3;
    overflow-wrap:break-word;word-break:break-word;white-space:normal;
  }
  table.items tbody td.batch{padding:5px 10px;}
  table.items tbody td.num,
  table.items tfoot td.num{text-align:center;font-variant-numeric:tabular-nums;}
  table.items tbody tr.special-row td,
  table.items tfoot tr.total-row td{
    background:var(--lav-bg);color:var(--purple-dark);font-weight:800;
    border-color:var(--purple);padding:6px 8px;
  }
  table.items td.special-label,
  table.items td.total-label{
    font-weight:800;text-align:center;white-space:nowrap;color:var(--purple);
  }

  .barfoot{
    background:var(--purple);color:#fff;margin:auto -14px 0 -14px;padding:8px 14px;
    display:flex;justify-content:space-between;align-items:center;gap:8px;
    font-size:12px;flex-shrink:0;min-width:0;
  }
  .barfoot span{min-width:0;overflow-wrap:anywhere;}
</style>
</head>
<body>
  <div class="page pdf-page pl-page">
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

      <div class="products">
        ${productBlocksHtml}
        ${sievingLumpsHtml}
      </div>

      ${buildStatusBar('Page 1 of 1', PRINT_FOOTER_MESSAGES.PL)}
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
    splitOverflowPages: true,
    printPrefs
  });
};
