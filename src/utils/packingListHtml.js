import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import { escHtml, fmtMoney, PRINT_PAGE_W } from './printTheme';

const PL_MIN_ROWS = 18;

const parseWeight = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  return parseFloat(value) || 0;
};

const displayWeight = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  return fmtMoney(value);
};

export const buildPackingListHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const batches = data.batches || [];
  const companyState = escHtml(profile.state || 'Gujarat');
  const plNo = escHtml(data.plNo || 'N/A');
  const plDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  let totalGross = 0;
  let totalTare = 0;
  let totalNet = 0;

  const rows = batches.map((batch, index) => {
    const gross = parseWeight(batch.gross);
    const tare = parseWeight(batch.tare);
    const net = batch.net !== '' && batch.net !== null && batch.net !== undefined
      ? parseWeight(batch.net)
      : Math.max(0, gross - tare);
    totalGross += gross;
    totalTare += tare;
    totalNet += net;

    return `
      <tr>
        <td class="num">${index + 1}</td>
        <td class="left">${escHtml(batch.productName || data.productName || '')}</td>
        <td class="num">${escHtml(batch.batchNo || '')}</td>
        <td class="num">${escHtml(batch.drumNo ?? '')}</td>
        <td class="num">${displayWeight(batch.gross)}</td>
        <td class="num">${displayWeight(batch.tare)}</td>
        <td class="num">${fmtMoney(net)}</td>
      </tr>`;
  });

  for (let i = batches.length; i < PL_MIN_ROWS; i += 1) {
    rows.push(`
      <tr class="empty">
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`);
  }

  const declaredNet = parseFloat(data.totalWeight);
  const finalNet = Number.isFinite(declaredNet) && declaredNet > 0 ? declaredNet : totalNet;
  const totalDrums = parseInt(data.totalDrums, 10) || batches.length;

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
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .info-row {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
  }
  .company-info {
    flex: 1.15;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .company-info .line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 4px;
  }
  .icon {
    color: var(--purple);
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    text-align: center;
    margin-top: 1px;
  }
  .icon svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .reg-details {
    margin-top: 10px;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .reg-details b { color: var(--purple); }
  .reg-row { display: flex; }
  .reg-row .label { width: 62px; font-weight: 700; color: var(--purple); }
  .reg-row .colon { width: 14px; }

  .invoice-meta {
    flex: 1;
    border: 1px solid var(--purple);
  }
  .invoice-meta .block {
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .meta-row {
    display: flex;
    margin-bottom: 3px;
  }
  .meta-row .m-icon { color: var(--purple); width: 18px; flex-shrink: 0; display: flex; align-items: center; }
  .meta-row .m-icon svg { width: 15px; height: 15px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .meta-row .m-label { width: 110px; flex-shrink: 0; color: #333; font-weight: normal; }
  .meta-row .m-colon { flex-shrink: 0; font-weight: 600; }
  .meta-row .m-value { flex-shrink: 0; font-weight: 600; }

  /* ===== PL PRODUCT BOX ===== */
  .pl-product-box {
    border: 1px solid var(--purple);
    margin-bottom: 14px;
  }
  .pl-product-title {
    background: var(--lav-bg);
    color: var(--purple);
    border-bottom: 1px solid var(--purple);
    padding: 7px 12px;
    font-weight: 800;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pl-product-title svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .pl-product-body {
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    gap: 15px;
    font-size: 12.5px;
  }

  /* ===== TABLE ===== */
  .table-container { flex: 1; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size: 12px;
  }
  table.items thead th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 8px 6px;
    text-align: left;
    border: 1px solid var(--purple);
  }
  table.items thead th.num { text-align: center; }
  table.items tbody td {
    border: 1px solid var(--lav-border);
    padding: 6px 6px;
    height: 20px;
  }
  table.items tbody td.num { text-align: center; }
  table.items tbody td.left { text-align: left; }
  table.items tbody tr.empty td { height: 22px; }
  table.items tfoot td {
    border: 1px solid var(--purple);
    background: var(--lav-bg);
    font-weight: 800;
    padding: 8px 6px;
    color: var(--purple-dark);
  }
  table.items tfoot td.num { text-align: center; }

  /* ===== SUMMARY ===== */
  .pl-summary {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
  }
  .pl-summary-card {
    flex: 1;
    border: 1px solid var(--purple);
    display: flex;
    flex-direction: column;
  }
  .pl-summary-label {
    background: var(--purple);
    color: #fff;
    padding: 8px 12px;
    font-weight: 800;
    font-size: 13px;
    text-align: center;
  }
  .pl-summary-value {
    padding: 12px;
    text-align: center;
    font-size: 17px;
    font-weight: 800;
    color: var(--text);
  }

  /* ===== SIGNATURES ===== */
  .pl-signatures {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
  }
  .pl-sign-box {
    flex: 1;
    border: 1px solid var(--lav-border);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: center;
    min-height: 110px;
  }
  .pl-sign-box strong { color: var(--purple); font-weight: 800; font-size: 13px; }
  .pl-sign-line {
    width: 80%;
    margin: 40px auto 0;
    border-top: 1px solid #333;
    padding-top: 5px;
    font-size: 11.5px;
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
          <div class="ti-title">PACKING LIST</div>
        </div>
      </div>

      <div class="info-row">
        <div class="company-info">
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')}<br>${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')},<br>${companyState}, India</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span>${escHtml(profile.phone || '+91 97120 00297')}</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span><span>${escHtml(profile.email || 'umamicron@gmail.com')}</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span><span>${escHtml(profile.website || 'www.umamicron.com')}</span></div>
          
          <div class="reg-details">
            <div class="reg-row"><span class="label">GSTIN</span><span class="colon">:</span><span><b>${escHtml(profile.gstNumber || '')}</b></span></div>
            <div class="reg-row"><span class="label">PAN</span><span class="colon">:</span><span>${companyPan}</span></div>
            <div class="reg-row"><span class="label">State</span><span class="colon">:</span><span>${companyState}</span></div>
          </div>
        </div>

        <div class="invoice-meta">
          <div class="block">
            <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span><span class="m-label">PL No.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${plNo}</span></div>
            <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span><span class="m-label">PL Date</span><span class="m-colon">:</span><span class="m-value">&nbsp;${plDate}</span></div>
            <div class="meta-row" style="margin-top:6px;"><span class="m-label">Total Drums</span><span class="m-colon">:</span><span class="m-value">&nbsp;${escHtml(totalDrums)}</span></div>
            <div class="meta-row"><span class="m-label">Total Net Wt.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${fmtMoney(finalNet)} Kg</span></div>
          </div>
        </div>
      </div>

      <div class="pl-product-box">
        <div class="pl-product-title"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg> PRODUCT DETAILS</div>
        <div class="pl-product-body">
          <div><strong>Product Name:</strong> ${escHtml(data.productName || '')}</div>
          <div><strong>Total Drums:</strong> ${escHtml(totalDrums)}</div>
          <div><strong>Total Quantity:</strong> ${fmtMoney(finalNet)} Kg</div>
        </div>
      </div>

      <div class="table-container">
        <table class="items">
          <thead>
            <tr>
              <th class="num" style="width:6%;">Sr. No.</th>
              <th style="width:28%;">Product Name</th>
              <th class="num" style="width:15%;">Batch No.</th>
              <th class="num" style="width:10%;">Drum No.</th>
              <th class="num" style="width:14%;">Gross Wt. (Kg)</th>
              <th class="num" style="width:13%;">Tare Wt. (Kg)</th>
              <th class="num" style="width:14%;">Net Wt. (Kg)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="num">TOTAL</td>
              <td class="num">${fmtMoney(totalGross)}</td>
              <td class="num">${fmtMoney(totalTare)}</td>
              <td class="num">${fmtMoney(finalNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="pl-summary">
        <div class="pl-summary-card">
          <div class="pl-summary-label">TOTAL DRUMS</div>
          <div class="pl-summary-value">${escHtml(totalDrums)}</div>
        </div>
        <div class="pl-summary-card">
          <div class="pl-summary-label">TOTAL NET WEIGHT</div>
          <div class="pl-summary-value">${fmtMoney(finalNet)} Kg</div>
        </div>
      </div>

      <div class="pl-signatures">
        <div class="pl-sign-box">
          <strong>Prepared By</strong>
          <div class="pl-sign-line">Signature</div>
        </div>
        <div class="pl-sign-box">
          <strong>Checked By</strong>
          <div class="pl-sign-line">Signature</div>
        </div>
        <div class="pl-sign-box">
          <strong>For ${escHtml(profile.companyName || 'UMA MICRON')}</strong>
          <div class="pl-sign-line">Authorised Signatory</div>
        </div>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>This is a computer generated packing list.</span>
        <span>Page 1 of 1</span>
      </div>

    </div>
  </div>
</body>
</html>`;
};

export const renderPackingListPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPackingListHtml(data, data.companyProfile);
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

    const target = host.querySelector('.page') || host.firstElementChild;
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
