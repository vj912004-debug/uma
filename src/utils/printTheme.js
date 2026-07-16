/** Shared navy print theme for TI / PI / DC / DN / CN / BPR HTML PDFs. */

export const PRINT_NAVY = '#002d6b';
export const PRINT_GREEN = '#5ea830';
export const PRINT_BORDER = '#b0c0d0';
export const PRINT_TEXT = '#333';

/** A4 @ 96dpi — keeps PDF scale aligned with printable area. */
export const PRINT_PAGE_W = 794;
export const PRINT_PAGE_H = 1123;

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

export const DEFAULT_PRINT_LOGO_SVG = `
<svg width="88" height="88" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="50" cy="50" rx="45" ry="30" fill="none" stroke="#28a745" stroke-width="3" transform="rotate(-30 50 50)"></ellipse>
  <ellipse cx="50" cy="50" rx="45" ry="30" fill="none" stroke="#28a745" stroke-width="3" transform="rotate(30 50 50)"></ellipse>
  <text x="50%" y="62%" font-family="Times New Roman, serif" font-size="45" font-weight="bold" fill="#dc3545" text-anchor="middle" letter-spacing="-2">UM</text>
</svg>`;

const ic = (path, size = 13) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path fill="${PRINT_NAVY}" d="${path}"/></svg>`;

export const IC = {
  pin: ic('M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z'),
  phone: ic('M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .7-.3 1L6.6 10.8z'),
  mail: ic('M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'),
  users: ic('M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zM8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.9 2 2.1 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z', 14),
  truck: ic('M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.7 1.3 3 3 3s3-1.3 3-3h6c0 1.7 1.3 3 3 3s3-1.3 3-3h2v-5l-3-4zM6 18.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zM18 18.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z', 14),
  bank: ic('M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z', 14),
  file: ic('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z', 14),
  pen: ic('M3 17.25V21h3.75L17.8 9.9l-3.75-3.75L3 17.25zM20.7 7c.4-.4.4-1 0-1.4l-2.3-2.3c-.4-.4-1-.4-1.4 0l-1.8 1.8 3.75 3.75L20.7 7z', 14),
  stamp: ic('M12 3c-1.7 0-3 1.3-3 3 0 1.2.7 2.2 1.7 2.7L9.5 12H6c-1.1 0-2 .9-2 2v2h16v-2c0-1.1-.9-2-2-2h-3.5l-1.2-3.3c1-.5 1.7-1.5 1.7-2.7 0-1.7-1.3-3-3-3zM4 18v2h16v-2H4z', 24)
};

/** Shared CSS for all navy print documents (A4-sized). */
export const getSharedPrintStyles = () => `
  :root {
    --blue-dark: ${PRINT_NAVY};
    --blue-light: #e6ebf5;
    --green-main: ${PRINT_GREEN};
    --border-color: ${PRINT_BORDER};
    --text-dark: ${PRINT_TEXT};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
  .print-host {
    background: #fff;
    width: ${PRINT_PAGE_W}px;
    padding: 0;
    color: var(--text-dark);
    font-size: 13px;
  }
  .pdf-page {
    background: #fff;
    width: ${PRINT_PAGE_W}px;
    min-height: ${PRINT_PAGE_H}px;
    padding: 14px;
    box-sizing: border-box;
  }
  .invoice-container {
    background: #fff;
    width: 100%;
    min-height: ${PRINT_PAGE_H - 28}px;
    border: 2px solid var(--text-dark);
    padding: 16px 18px;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .logo-section { width: 15%; display: flex; justify-content: center; align-items: center; }
  .logo-section img, .logo-section svg { width: 88px; height: 88px; object-fit: contain; }
  .company-info { width: 62%; }
  .company-name { color: var(--blue-dark); font-size: 28px; font-weight: bold; margin-bottom: 6px; }
  .info-line { display: flex; align-items: flex-start; margin-bottom: 4px; gap: 8px; font-size: 12.5px; font-weight: bold; }
  .info-line-multiple { display: flex; gap: 20px; margin-bottom: 4px; }
  .gstin { font-weight: bold; color: var(--blue-dark); margin-top: 6px; font-size: 13px; }
  .copy-type {
    background: var(--blue-dark); color: #fff; padding: 10px 15px; font-weight: bold;
    text-align: center; line-height: 1.4; clip-path: polygon(15% 0, 100% 0, 100% 100%, 0% 100%);
    width: 120px; font-size: 12px; margin-top: -16px; margin-right: -18px;
  }
  .header-border { border-top: 2px solid var(--blue-dark); margin: 10px 0; }
  .title-wrapper { display: flex; align-items: center; justify-content: center; gap: 15px; margin: 12px 0 14px; }
  .title-line { height: 2px; width: 35px; background: var(--green-main); }
  .invoice-title { color: var(--blue-dark); font-size: 22px; font-weight: bold; letter-spacing: 1px; }
  .details-grid {
    display: grid; grid-template-columns: 18% 32% 18% 32%;
    border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 12px;
  }
  .grid-item { padding: 8px 10px; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; font-size: 12.5px; }
  .grid-item.label { color: var(--blue-dark); font-weight: bold; }
  .details-grid .grid-item:nth-child(4n) { border-right: none; }
  .details-grid .grid-item:nth-last-child(-n+4) { border-bottom: none; }
  .parties-wrapper { display: flex; gap: 12px; margin-bottom: 12px; }
  .party-box { flex: 1; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
  .party-header {
    background: var(--blue-dark); color: #fff; padding: 8px 12px; font-weight: bold;
    display: flex; align-items: center; gap: 8px; font-size: 13px; letter-spacing: 0.4px;
  }
  .party-header svg path { fill: #fff !important; }
  .party-body { padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .party-row { display: flex; align-items: flex-end; }
  .party-label { color: var(--blue-dark); font-weight: bold; min-width: 72px; margin-bottom: -2px; font-size: 12.5px; }
  .dotted-line {
    flex: 1; border-bottom: 1px dotted #999; min-height: 18px; font-size: 12.5px;
    padding: 0 2px 1px; font-weight: bold; color: #222;
  }
  .code-box {
    border: 1px solid var(--border-color); min-width: 45px; height: 20px; border-radius: 3px;
    text-align: center; font-weight: bold; font-size: 12px; line-height: 18px; padding: 0 4px;
  }
  .items-table { width: 100%; border-collapse: collapse; border: 1px solid var(--border-color); margin-bottom: 12px; }
  .items-table th, .items-table td { border: 1px solid var(--border-color); padding: 8px 6px; text-align: center; font-size: 12.5px; }
  .items-table th { background: var(--blue-dark); color: #fff; font-weight: bold; }
  .items-table td.desc { text-align: left; }
  .items-table td.num { text-align: right; }
  .items-table tr.blank-row td { height: 30px; }
  .items-table tr.total-row td { font-weight: bold; font-size: 13px; padding: 9px 6px; }
  .total-label {
    background: var(--green-main) !important; color: #fff !important; font-weight: bold;
    text-align: left !important; padding-left: 12px !important; border-color: var(--green-main) !important;
  }
  .footer-top { display: flex; gap: 12px; margin-bottom: 12px; margin-top: auto; }
  .bank-details { flex: 6; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; }
  .bank-body { padding: 10px 12px; }
  .bank-row { display: flex; margin-bottom: 6px; font-size: 12.5px; }
  .bank-label { color: var(--blue-dark); font-weight: bold; width: 120px; }
  .summary-table-wrapper { flex: 4; }
  .summary-table { width: 100%; border-collapse: collapse; box-shadow: 0 0 0 1px var(--border-color); border-radius: 6px; overflow: hidden; }
  .summary-table td { border: 1px solid var(--border-color); padding: 8px 10px; font-size: 12.5px; }
  .summary-label { color: var(--blue-dark); font-weight: bold; width: 70%; }
  .summary-value { text-align: right; width: 30%; }
  .summary-tax-amount { color: var(--blue-dark); font-weight: bold; }
  .summary-total-final td { background: var(--green-main); color: #fff !important; font-weight: bold; }
  .footer-bottom { display: flex; gap: 12px; }
  .terms-box { flex: 5; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; }
  .terms-body { padding: 12px 12px 12px 24px; font-size: 12px; line-height: 1.55; }
  .terms-body ol { margin: 0; padding: 0 0 0 4px; }
  .terms-body li { margin-bottom: 5px; }
  .seal-box {
    flex: 2; border: 1px dashed var(--border-color); border-radius: 6px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: var(--blue-dark); font-weight: bold; gap: 5px; min-height: 100px; font-size: 13px;
  }
  .sign-box { flex: 4; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; min-height: 100px; }
  .sign-area { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; text-align: center; }
  .sign-text { border-top: 1px solid var(--blue-dark); padding-top: 6px; color: var(--blue-dark); font-weight: bold; width: 90%; margin: 0 auto; font-size: 12.5px; }
  .note-block { font-size: 12px; font-weight: bold; margin-bottom: 8px; line-height: 1.45; }
`;

export const buildPrintLogoHtml = (profile) => {
  const logoSrc = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  return logoSrc ? `<img src="${logoSrc}" alt="Logo">` : DEFAULT_PRINT_LOGO_SVG;
};

export const buildPrintCompanyHeader = (profile, { showCopyBadge = false, copyBadgeHtml = 'ORIGINAL<br>DUPLICATE' } = {}) => {
  const name = escHtml(profile.companyName || 'UMA MICRON');
  const addr1 = escHtml((profile.addressLine1 || '').replace(/,\s*$/, ''));
  const cityLine = [profile.city, profile.pincode].filter(Boolean).join(' - ');
  const addr2 = escHtml([cityLine, profile.state, profile.country].filter(Boolean).join(', '));
  const phone = escHtml(profile.phone || '');
  const email = escHtml(profile.email || '');
  return `
    <div class="header">
      <div class="logo-section">${buildPrintLogoHtml(profile)}</div>
      <div class="company-info" style="width:${showCopyBadge ? '62%' : '80%'};">
        <div class="company-name">${name}</div>
        <div class="info-line">${IC.pin}<div>${addr1}${addr2 ? `<br>${addr2}` : ''}</div></div>
        <div class="info-line-multiple">
          ${phone ? `<div class="info-line">${IC.phone}<span>${phone}</span></div>` : ''}
          ${email ? `<div class="info-line">${IC.mail}<span>${email}</span></div>` : ''}
        </div>
        <div class="gstin">GSTIN: ${escHtml(profile.gstNumber || '')}</div>
      </div>
      ${showCopyBadge ? `<div class="copy-type">${copyBadgeHtml}</div>` : ''}
    </div>
    <div class="header-border"></div>`;
};

export const buildPrintTitle = (title) => `
  <div class="title-wrapper">
    <div class="title-line"></div>
    <div class="invoice-title">${escHtml(title)}</div>
    <div class="title-line"></div>
  </div>`;

export const buildDetailsGrid = (rows) => {
  // rows: array of [label, value, label2, value2]
  const cells = rows.flatMap(([l1, v1, l2, v2]) => [
    `<div class="grid-item label">${escHtml(l1)}</div>`,
    `<div class="grid-item">${v1 || '&nbsp;'}</div>`,
    `<div class="grid-item label">${escHtml(l2)}</div>`,
    `<div class="grid-item">${v2 || '&nbsp;'}</div>`
  ]).join('');
  return `<div class="details-grid">${cells}</div>`;
};

export const buildPartyBox = (title, iconSvg, fields) => {
  const { name, addressLines = [''], state, stateCode, gstin } = fields;
  const addr = (addressLines.length ? addressLines : ['']).map((line, i) => `
    <div class="party-row">
      <div class="party-label">${i === 0 ? 'Address :' : ''}</div>
      <div class="dotted-line">${escHtml(line)}</div>
    </div>`).join('');
  return `
    <div class="party-box">
      <div class="party-header">${iconSvg} ${escHtml(title)}</div>
      <div class="party-body">
        <div class="party-row"><div class="party-label">Name :</div><div class="dotted-line">${escHtml(name || '')}</div></div>
        ${addr}
        <div class="party-row" style="margin-top:5px;">
          <div class="party-label">State :</div>
          <div class="dotted-line">${escHtml(state || '')}</div>
          <div class="party-label" style="min-width:40px;margin-left:10px;">Code</div>
          <div class="code-box">${escHtml(stateCode || '')}</div>
        </div>
        <div class="party-row" style="margin-top:5px;">
          <div class="party-label">GSTIN :</div>
          <div class="dotted-line">${escHtml(gstin || '')}</div>
        </div>
      </div>
    </div>`;
};

export const buildBankDetailsBox = (companyName) => `
  <div class="bank-details">
    <div class="party-header">${IC.bank} OUR BANK DETAILS</div>
    <div class="bank-body">
      <div class="bank-row"><div class="bank-label">Bank Name</div><div class="bank-value">: AXIS BANK LTD</div></div>
      <div class="bank-row"><div class="bank-label">A/c Name</div><div class="bank-value">: ${escHtml(companyName || 'UMA MICRON')}</div></div>
      <div class="bank-row"><div class="bank-label">Current A/c No.</div><div class="bank-value">: 916020061629671</div></div>
      <div class="bank-row"><div class="bank-label">IFS CODE</div><div class="bank-value">: UTIB0000383</div></div>
      <div class="bank-row"><div class="bank-label">Branch</div><div class="bank-value">: Nizampura</div></div>
    </div>
  </div>`;

export const buildSummaryTable = ({ totalAmt, totalSgst, totalCgst, totalIgst, totalAll }) => {
  const tax = (parseFloat(totalSgst) || 0) + (parseFloat(totalCgst) || 0) + (parseFloat(totalIgst) || 0);
  return `
    <div class="summary-table-wrapper">
      <table class="summary-table">
        <tr><td class="summary-label">Total Amount Before Tax</td><td class="summary-value">${fmtMoney(totalAmt)}</td></tr>
        <tr><td class="summary-label">SGST</td><td class="summary-value">${fmtMoney(totalSgst)}</td></tr>
        <tr><td class="summary-label">CGST</td><td class="summary-value">${fmtMoney(totalCgst)}</td></tr>
        <tr><td class="summary-label">IGST</td><td class="summary-value">${fmtMoney(totalIgst)}</td></tr>
        <tr><td class="summary-label summary-tax-amount">Total Tax Amount</td><td class="summary-value summary-tax-amount">${fmtMoney(tax)}</td></tr>
        <tr class="summary-total-final"><td>Total Amount after Tax</td><td class="summary-value">${fmtMoney(totalAll)}</td></tr>
      </table>
    </div>`;
};

export const buildTermsSealSign = (companyName, termsHtml) => `
  <div class="footer-bottom">
    <div class="terms-box">
      <div class="party-header">${IC.file} TERMS &amp; CONDITIONS</div>
      <div class="terms-body">${termsHtml}</div>
    </div>
    <div class="seal-box">${IC.stamp}<div>Seal</div></div>
    <div class="sign-box">
      <div class="party-header">${IC.pen} FOR ${escHtml(companyName || 'UMA MICRON')}</div>
      <div class="sign-area"><div class="sign-text">Authorised Signatory</div></div>
    </div>
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
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width,
        windowWidth: width,
        logging: false
      });

      const naturalW = usableW;
      const naturalH = (canvas.height * naturalW) / canvas.width;

      if (pageNodes.length || fitPage) {
        // One canvas → one PDF page; scale to fit A4 printable area
        if (i > 0) pdf.addPage();
        const scale = Math.min(usableW / naturalW, usableH / naturalH, 1);
        const drawW = naturalW * scale;
        const drawH = naturalH * scale;
        const x = margin + (usableW - drawW) / 2;
        const y = margin;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH);
        continue;
      }

      // Single tall document: paginate by canvas slices
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
