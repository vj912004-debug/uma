/** Shared purple print theme for TI / PI / DC / DN / CN / BPR HTML PDFs. */

export const PRINT_PAGE_W = 794;

export const escHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const fmtMoney = (n) => (parseFloat(n) || 0).toFixed(2);

export const fmtQty = (n) => {
  const v = parseFloat(n);
  if (!v) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export const getSharedPrintStyles = () => `
  :root {
      --primary-purple: #4C1D95;
      --brand-green: #15803D;
      --light-purple-bg: #F5EEFD;
      --border-purple: #C0A9E2;
      --grid-line-purple: #E2D7F3;
      --text-black: #000000;
      --text-muted: #333333;
  }

  * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
  }

  body {
      background-color: #fff;
      color: var(--text-black);
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
  }

  .print-host {
      width: ${PRINT_PAGE_W}px;
      margin: 0;
      padding: 0;
      background: #ffffff;
  }

  .pdf-page {
      width: ${PRINT_PAGE_W}px;
      min-height: 1123px;
      padding: 12px;
      box-sizing: border-box;
      background: #ffffff;
  }

  .invoice-box {
      width: 100%;
      height: 100%;
      min-height: 1099px;
      border: 2.5px solid var(--primary-purple);
      padding: 12px;
      display: flex;
      flex-direction: column;
      position: relative;
  }

  /* Top Header Logo section */
  .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid var(--primary-purple);
      padding-bottom: 6px;
  }

  .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
  }

  .logo-graphic {
      width: 65px;
      height: 65px;
      display: flex;
      align-items: center;
      justify-content: center;
  }
  .logo-graphic img, .logo-graphic svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
  }

  .logo-text h1 {
      font-size: 38px;
      font-weight: 900;
      color: var(--primary-purple);
      line-height: 1;
      letter-spacing: 0.5px;
      text-transform: uppercase;
  }
  .logo-text p {
      font-size: 18px;
      font-weight: bold;
      color: var(--brand-green);
      margin-top: 2px;
      letter-spacing: 0.2px;
  }

  .tax-invoice-badge {
      background-color: var(--primary-purple);
      color: #ffffff;
      text-align: center;
      padding: 6px 14px;
      border-radius: 6px;
      min-width: 210px;
  }
  .tax-invoice-badge h2 {
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 1px;
      margin: 0;
  }
  .tax-invoice-badge div {
      background-color: #ffffff;
      color: var(--primary-purple);
      font-size: 9px;
      font-weight: bold;
      padding: 2px 8px;
      border-radius: 3px;
      display: inline-block;
      margin-top: 4px;
  }

  /* Vendor and Document Info Metadata Strip */
  .meta-strip {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1.5px solid var(--primary-purple);
  }
  .meta-strip > .meta-col:nth-child(1) { flex: 1.15; }
  .meta-strip > .meta-col:nth-child(2) { flex: 0.85; }
  .meta-strip > .meta-col:nth-child(3) { flex: 1; }

  .meta-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
  }
  .meta-col.border-left {
      border-left: 1px solid var(--border-purple);
      padding-left: 12px;
  }

  .icon-line {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      line-height: 1.3;
  }
  .icon-line i {
      color: var(--primary-purple);
      font-size: 12px;
      margin-top: 1px;
  }

  .data-row {
      display: flex;
      font-size: 11px;
  }
  .data-label {
      font-weight: bold;
      width: 85px;
  }
  .data-label-short {
      font-weight: bold;
      width: 45px;
  }
  .data-value {
      flex: 1;
  }

  /* Bill To / Ship To Cards Layout */
  .billing-container {
      display: flex;
      gap: 12px;
      margin-top: 8px;
  }

  .bill-card {
      flex: 1;
      border: 1.5px solid var(--border-purple);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
  }

  .card-title {
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

  .card-body {
      padding: 8px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.35;
  }
  .client-title {
      font-weight: bold;
      color: var(--primary-purple);
      font-size: 11px;
      margin-bottom: 2px;
  }

  .card-footer-data {
      margin-top: auto;
      border-top: 1px solid var(--grid-line-purple);
      padding-top: 4px;
  }

  /* Items Ledger Table Design */
  .table-container {
      margin-top: 10px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
  }

  .invoice-table {
      width: 100%;
      border-collapse: collapse;
  }

  .invoice-table th {
      background-color: var(--primary-purple);
      color: #ffffff;
      font-weight: normal;
      font-size: 10px;
      padding: 6px 3px;
      border: 1px solid var(--border-purple);
      text-align: center;
  }

  .invoice-table td {
      border: 1px solid var(--grid-line-purple);
      border-left: 1px solid var(--border-purple);
      border-right: 1px solid var(--border-purple);
      padding: 5px 4px;
      font-size: 11px;
      text-align: right;
      height: 26px;
  }

  .invoice-table td.center { text-align: center; }
  .invoice-table td.left { text-align: left; }

  .invoice-table tr.filler-row td {
      height: 28px;
  }

  .invoice-table tr.total-row td {
      font-weight: bold;
      background-color: var(--light-purple-bg);
      border-top: 1.5px solid var(--primary-purple);
      border-bottom: 1.5px solid var(--primary-purple);
      height: 26px;
  }

  /* Bottom Financial Summary Breakdown blocks */
  .bottom-summary-grid {
      display: flex;
      gap: 12px;
      margin-top: 10px;
  }
  .bottom-summary-grid > div:nth-child(1) { flex: 1.15; }
  .bottom-summary-grid > div:nth-child(2) { flex: 0.85; }

  .bank-details-box {
      border: 1.5px solid var(--border-purple);
      border-radius: 6px;
      padding: 8px;
  }
  .box-heading {
      color: var(--primary-purple);
      font-weight: bold;
      font-size: 11px;
      border-bottom: 1px solid var(--border-purple);
      padding-bottom: 3px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
  }

  .totals-box {
      border: 1.5px solid var(--border-purple);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
  }

  .charge-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 8px;
      font-size: 11px;
  }
  .charge-row.bold {
      font-weight: bold;
  }

  .grand-total-banner {
      background-color: var(--primary-purple);
      color: #ffffff;
      font-weight: bold;
      font-size: 14px;
      padding: 6px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
  }

  /* Footer Conditions and Sign-off Area */
  .footer-terms-container {
      display: flex;
      gap: 12px;
      border: 1.5px solid var(--border-purple);
      border-radius: 6px;
      margin-top: 10px;
      padding: 8px;
  }
  .footer-terms-container > .terms-column:nth-child(1) { flex: 1.1; }
  .footer-terms-container > .terms-column:nth-child(2) { flex: 0.9; }
  .footer-terms-container > .terms-column:nth-child(3) { flex: 1; }

  .terms-column {
      font-size: 10px;
      line-height: 1.3;
  }
  .terms-column ol {
      padding-left: 14px;
      margin-top: 2px;
  }
  .terms-column ol li {
      margin-bottom: 2px;
  }

  .signature-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      height: 100%;
  }
  .signature-space {
      width: 80%;
      border-bottom: 1px solid #777777;
      margin-top: 45px;
      margin-bottom: 3px;
  }

  /* Sticky Bottom Disclaimer Bar */
  .bottom-status-bar {
      background-color: var(--primary-purple);
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      padding: 4px 8px;
      margin-top: 10px;
      font-size: 9.5px;
      border-radius: 3px;
  }
`;

export const buildPrintLogoHtml = (profile) => {
  const logoSrc = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  if (logoSrc) return `<img src="${logoSrc}" alt="Logo">`;
  return `
    <div style="border: 2px solid var(--brand-green); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; position: relative;">
        <div style="position: absolute; width: 40px; height: 40px; border: 2px solid var(--primary-purple); border-radius: 50%;"></div>
        <span style="font-size: 24px; font-weight: bold; color: var(--primary-purple); z-index: 1; font-family: 'Times New Roman', Times, serif;">M</span>
    </div>`;
};

export const buildPrintHeader = (profile, title, badgeText = 'ORIGINAL FOR RECIPIENT') => `
  <div class="header-top">
      <div class="logo-container">
          <div class="logo-graphic">
              ${buildPrintLogoHtml(profile)}
          </div>
          <div class="logo-text">
              <h1>${escHtml(profile.companyName || 'UMA MICRON')}</h1>
              <p>Micronization of API's</p>
          </div>
      </div>
      <div class="tax-invoice-badge">
          <h2>${escHtml(title)}</h2>
          ${badgeText ? `<div>${escHtml(badgeText)}</div>` : ''}
      </div>
  </div>`;

export const buildMetaStrip = (profile, companyState, companyPan, rightColHtml) => `
  <div class="meta-strip">
      <div class="meta-col">
          <div class="icon-line">
              <i class="bi bi-geo-alt-fill"></i>
              <div>
                  <strong>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')}</strong><br>
                  ${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')},<br>${escHtml(companyState)}, India
              </div>
          </div>
          <div class="icon-line"><i class="bi bi-telephone-fill"></i><div>${escHtml(profile.phone || '+91 97120 00297')}</div></div>
          <div class="icon-line"><i class="bi bi-envelope-fill"></i><div>${escHtml(profile.email || 'umamicron@gmail.com')}</div></div>
          <div class="icon-line"><i class="bi bi-globe"></i><div>${escHtml(profile.website || 'www.umamicron.com')}</div></div>
      </div>
      
      <div class="meta-col" style="padding-left: 5px;">
          <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${escHtml(profile.gstNumber || '')}</div></div>
          <div class="data-row"><div class="data-label-short">PAN</div><div class="data-value">: &nbsp;${escHtml(companyPan)}</div></div>
          <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${escHtml(companyState)}</div></div>
      </div>
      
      <div class="meta-col border-left">
          ${rightColHtml}
      </div>
  </div>`;

export const buildPartyCard = (title, iconClass, name, addressLines, gstin, state, stateCode) => `
  <div class="bill-card">
      <div class="card-title"><i class="${iconClass}"></i> ${escHtml(title)}</div>
      <div class="card-body">
          <div class="client-title">${escHtml(name)}</div>
          ${addressLines.map(line => `<div>${escHtml(line)}</div>`).join('')}
          <div class="card-footer-data">
              <div class="data-row"><div class="data-label-short">GSTIN</div><div class="data-value">: &nbsp;${escHtml(gstin)}</div></div>
              <div class="data-row"><div class="data-label-short">State</div><div class="data-value">: &nbsp;${escHtml(state)} ${stateCode ? `(${escHtml(stateCode)})` : ''}</div></div>
          </div>
      </div>
  </div>`;

export const buildBankDetailsBox = (profile) => `
  <div class="bank-details-box">
      <div class="box-heading"><i class="bi bi-bank"></i> OUR BANK DETAILS</div>
      <div class="data-row"><div class="data-label" style="width:100px;">Bank Name</div><div class="data-value">: &nbsp;${escHtml(profile.bankName || '')}</div></div>
      <div class="data-row"><div class="data-label" style="width:100px;">A/c Name</div><div class="data-value">: &nbsp;${escHtml(profile.accountName || profile.companyName || '')}</div></div>
      <div class="data-row"><div class="data-label" style="width:100px;">Current A/c No.</div><div class="data-value">: &nbsp;${escHtml(profile.accountNumber || '')}</div></div>
      <div class="data-row"><div class="data-label" style="width:100px;">IFS CODE</div><div class="data-value">: &nbsp;${escHtml(profile.ifscCode || '')}</div></div>
      <div class="data-row"><div class="data-label" style="width:100px;">Branch</div><div class="data-value">: &nbsp;${escHtml(profile.branch || '')}</div></div>
  </div>`;

export const buildFooterTerms = (companyName, termsHtml, declarationHtml) => `
  <div class="footer-terms-container">
      <div class="terms-column">
          <div class="box-heading" style="margin-bottom:4px; border:none; background:none; padding:0;"><i class="bi bi-card-checklist"></i> TERMS & CONDITIONS</div>
          ${termsHtml}
      </div>
      <div class="terms-column" style="border-left: 1px solid var(--border-purple); padding-left: 10px;">
          <div class="box-heading" style="margin-bottom:4px; border:none; background:none; padding:0;"><i class="bi bi-shield-check"></i> DECLARATION</div>
          ${declarationHtml}
      </div>
      <div class="terms-column">
          <div class="signature-column">
              <span style="font-weight: bold; color: var(--primary-purple); font-size: 11px;">For ${escHtml(companyName || 'UMA MICRON')}</span>
              <div class="signature-space"></div>
              <span style="font-size: 10px; color: #333;">Authorised Signatory</span>
          </div>
      </div>
  </div>`;

export const buildStatusBar = (pageText = 'Page 1 of 1', customText = 'This is a computer generated document.') => `
  <div class="bottom-status-bar">
      <span>Thank you for your business!</span>
      <span>E. & O.E.</span>
      <span>${escHtml(customText)}</span>
      <span>${escHtml(pageText)}</span>
  </div>`;

export const renderHtmlToPdf = async (html, {
  mode = 'save',
  filePrefix = 'DOC',
  docNo = 'N/A',
  width = PRINT_PAGE_W,
  fitPage = false
} = {}) => {
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

    const pageNodes = [...host.querySelectorAll('.pdf-page')];
    const targets = pageNodes.length
      ? pageNodes
      : [host.querySelector('.print-host') || host.firstElementChild].filter(Boolean);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      
      // Fix for html2canvas blank capture on subsequent pages
      const originalCss = target.style.cssText;
      target.style.cssText += '; position: absolute; top: 0; left: 0; z-index: 10;';

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width,
        windowWidth: width,
        scrollY: 0,
        logging: false
      });

      target.style.cssText = originalCss;

      const naturalW = usableW;
      const naturalH = (canvas.height * naturalW) / canvas.width;

      if (pageNodes.length || fitPage) {
        if (i > 0) pdf.addPage();
        const scale = Math.min(usableW / naturalW, usableH / naturalH, 1);
        const drawW = naturalW * scale;
        const drawH = naturalH * scale;
        const x = margin + (usableW - drawW) / 2;
        const y = margin;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH);
        continue;
      }

      const imgW = usableW;
      const pxPerMm = canvas.width / imgW;
      const pageHeightPx = usableH * pxPerMm;
      let yPx = 0;
      let pageIndex = 0;
      while (yPx < canvas.height - 1) {
        const sliceH = Math.min(pageHeightPx, canvas.height - yPx);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.ceil(sliceH);
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceHmm = sliceH / pxPerMm;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, sliceHmm);
        yPx += sliceH;
        pageIndex += 1;
      }
    }

    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `${filePrefix}_${docNo}`;
    } else {
      pdf.save(`${filePrefix}_${docNo}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
