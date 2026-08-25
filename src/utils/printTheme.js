/** Shared purple print theme for TI / PI / DC / DN / CN / BPR HTML PDFs. */

import { applyPrintPrefsToHtml, getStoredPrintPrefs, PRINT_ROOT_CLASS } from './printPrefs';
import { DEFAULT_PRINT_LOGO_SRC } from './defaultPrintLogo';

export { applyPrintPrefsToHtml } from './printPrefs';
export { DEFAULT_PRINT_LOGO_SRC } from './defaultPrintLogo';

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
    --purple: #3d2b7d;
    --purple-dark: #2f2263;
    --lav-bg: #efeaf7;
    --lav-border: #c9bce8;
    --orange: #f47920;
    --green: #2fa84f;
    --text: #231f20;
    --grey-line: #d9d9d9;
    --primary-purple: #3d2b7d;
    --brand-green: #2fa84f;
    --light-purple-bg: #efeaf7;
    --border-purple: #c9bce8;
    --grid-line-purple: #d9d9d9;
    --text-black: #231f20;
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: Cambria, Georgia, serif;
  }
  
  body {
    background-color: #fff;
    color: var(--text);
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
    padding: 2mm;
    box-sizing: border-box;
    background: #ffffff;
  }
  
  .invoice-box {
    border: 2px solid var(--purple);
    padding: 18px;
    height: 100%;
    min-height: 1050px;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* ===== HEADER ===== */
  .header, .header-top {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 14px;
    margin-bottom: 14px;
    border-bottom: none;
    padding-bottom: 0;
  }
  .brand, .logo-container {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo, .logo-graphic {
    width: 78px;
    height: 78px;
    position: relative;
    flex-shrink: 0;
  }
  .logo svg, .logo img, .logo-graphic svg, .logo-graphic img { width: 100%; height: 100%; object-fit: contain; }
  .brand-lockup {
    width: 280px;
    height: 72px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .brand-lockup img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: left center;
    display: block;
  }
  .brand-text h1, .logo-text h1 {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 38px;
    letter-spacing: 1px;
    color: var(--purple);
    line-height: 1;
    text-transform: uppercase;
  }
  .brand-text .tagline, .logo-text p {
    color: var(--green);
    font-weight: 700;
    font-size: 16px;
    margin-top: 2px;
  }
  .tax-invoice-box, .tax-invoice-badge {
    background: var(--purple);
    color: #fff;
    text-align: center;
    padding: 10px 22px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 230px;
    border-radius: 0;
  }
  .tax-invoice-box .ti-title, .tax-invoice-badge h2 {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 1px;
    margin-bottom: 6px;
    margin-top: 0;
  }
  .tax-invoice-box .ti-sub, .tax-invoice-badge div {
    background: #fff;
    color: var(--purple);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .5px;
    padding: 3px 10px;
    border-radius: 0;
    margin-top: 0;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .info-row, .meta-strip {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    padding: 0;
    border-bottom: none;
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
  .m-icon svg { width: 15px; height: 15px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .party-head svg, .box-head svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .reg-details {
    margin-top: 10px;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .reg-details b { color: var(--purple); }
  .reg-row { display: flex; }
  .reg-row .label { width: 62px; font-weight: 700; color: var(--purple); }
  .reg-row .colon { width: 14px; }

  .invoice-meta, .meta-col.border-left {
    flex: 1;
    border: 1px solid var(--purple);
    border-left: 1px solid var(--purple);
    padding: 0;
  }
  .invoice-meta .block, .meta-col.border-left > div {
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .invoice-meta .block + .block, .meta-col.border-left > div + div {
    border-top: 1px solid var(--purple);
  }
  .meta-row, .data-row {
    display: flex;
    margin-bottom: 3px;
    font-size: 11px;
  }
  .meta-row .m-icon { color: var(--purple); width: 18px; flex-shrink: 0; display: flex; align-items: center; }
  .meta-row .m-label, .data-label { width: 110px; flex-shrink: 0; color: #333; font-weight: normal; }
  .meta-row .m-colon, .data-value { flex-shrink: 0; font-weight: 600; }
  .meta-row.sub .m-label { width: 110px; padding-left: 18px; box-sizing: border-box; }
  .data-label i { margin-right: 6px; color: var(--purple); }

  /* ===== BILL TO / SHIP TO ===== */
  .parties, .billing-container {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    margin-top: 0;
  }
  .party, .bill-card {
    flex: 1;
    border: 1px solid var(--lav-border);
    border-radius: 0;
  }
  .party-head, .card-title {
    background: var(--lav-bg);
    color: var(--purple);
    font-weight: 800;
    font-size: 13px;
    letter-spacing: .5px;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--lav-border);
  }
  .party-head svg, .box-head svg, .card-title i { flex-shrink: 0; }
  .party-body, .card-body {
    padding: 10px 12px;
    font-size: 12.5px;
    line-height: 1.55;
    min-height: 80px;
  }
  .party-body .cname, .client-title {
    color: var(--purple);
    font-weight: 800;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .party-foot, .card-footer-data {
    border-top: 1px solid var(--lav-border);
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .party-foot .frow, .card-footer-data .data-row { display: flex; margin-bottom: 2px; font-size: 12.5px; }
  .party-foot .flabel, .card-footer-data .data-label-short { width: 50px; font-weight: 700; color: var(--text); }
  .party-foot .fcolon { width: 12px; }

  /* ===== TABLE ===== */
  .table-container { flex: 1; display: flex; flex-direction: column; margin-top: 0; }
  table.items, table.invoice-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size: 12px;
  }
  table.items thead th, table.invoice-table th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 8px 6px;
    text-align: left;
    border: 1px solid rgba(255,255,255,0.55);
  }
  table.items thead th.num, table.invoice-table th.center { text-align: center; }
  table.items tbody td, table.invoice-table td {
    border: 1px solid var(--lav-border);
    padding: 6px 6px;
    height: 20px;
    text-align: right;
  }
  table.items tbody td.num, table.invoice-table td.center { text-align: center; }
  table.items tbody td.left, table.invoice-table td.left { text-align: left; }
  table.items tbody tr.empty td, table.invoice-table tr.filler-row td { height: 22px; }
  table.items tfoot td, table.invoice-table tr.total-row td {
    border: 1px solid var(--purple);
    background: var(--lav-bg);
    font-weight: 800;
    padding: 8px 6px;
    color: var(--purple-dark);
  }
  table.items tfoot td.num, table.invoice-table tr.total-row td.center { text-align: center; }

  /* ===== BOTTOM SECTION: bank + totals ===== */
  .bottom, .bottom-summary-grid {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    align-items: stretch;
    margin-top: 0;
  }
  .bottom > div:nth-child(1), .bottom-summary-grid > div:nth-child(1) { flex: 1.15; }
  .bottom > div:nth-child(2), .bottom-summary-grid > div:nth-child(2) { flex: 0.85; }

  .bank, .bank-details-box {
    flex: 1;
    border: 1px solid var(--lav-border);
    padding: 0;
    border-radius: 0;
  }
  .box-head, .box-heading {
    background: var(--lav-bg);
    color: var(--purple);
    font-weight: 800;
    font-size: 13px;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--lav-border);
    margin-bottom: 0;
  }
  .bank-body {
    padding: 10px 12px;
    font-size: 12.5px;
  }
  .bank-row, .bank-details-box .data-row { display: flex; margin-bottom: 5px; font-size: 12.5px; }
  .bank-row .blabel, .bank-details-box .data-label { width: 120px; font-weight: 700; color: var(--text); }
  .bank-row .bcolon, .bank-details-box .data-value { width: 12px; }

  .totals, .totals-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: 0;
    border: none;
  }
  .totals-body, .totals-box > div:first-child {
    border: 1px solid var(--lav-border);
    border-bottom: none;
    padding: 10px 14px;
    font-size: 12.5px;
    flex: 1;
  }
  .trow, .charge-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
  .tval, .charge-row span:last-child { font-variant-numeric: tabular-nums; min-width: 90px; text-align: right; }
  .trow.rule, .charge-row.bold { border-top: 1px solid var(--grey-line); margin-top: 4px; padding-top: 5px; font-weight: bold; }
  
  .grand, .grand-total-banner {
    background: var(--purple);
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    font-size: 17px;
    font-weight: 800;
  }

  /* ===== TERMS / DECLARATION / SIGNATORY ===== */
  .footer3, .footer-terms-container {
    display: flex;
    gap: 14px;
    margin-bottom: 0;
    border: none;
    padding: 0;
    margin-top: 0;
  }
  .f3col, .terms-column {
    flex: 1;
    border: 1px solid var(--lav-border);
    padding: 0;
  }
  .f3-body {
    padding: 10px 12px;
    font-size: 11.5px;
    line-height: 1.6;
  }
  .f3-body ol, .terms-column ol { margin: 0; padding-left: 16px; margin-top: 6px; font-size: 11.5px; line-height: 1.6; }
  
  .sig-col, .signature-column {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .sig-col .for-company {
    font-weight: 800;
    color: var(--purple);
    padding: 8px 12px 0;
    font-size: 12.5px;
  }
  .sig-col .sig-line, .signature-space {
    margin: 14px 12px 8px;
    border-top: 1px solid #333;
    text-align: center;
    padding-top: 4px;
    font-size: 11.5px;
    width: auto;
  }
  
  /* Additional overrides for DC custom grid bottom */
  .dc-footer-grid {
      display: flex;
      gap: 14px;
      margin-top: 0;
  }
  .dc-footer-grid > div:nth-child(1) { flex: 1.15; }
  .dc-footer-grid > div:nth-child(2) { flex: 0.85; }
  .dc-meta-card {
      border: 1px solid var(--lav-border);
      border-radius: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
  }
  .dc-meta-card > div:not(.box-heading) { padding: 2px 12px; }
  .dc-meta-row { display: flex; margin-bottom: 6px; font-size: 11px; }
  .dc-meta-label { color: var(--text-black); font-weight: bold; width: 130px; flex-shrink: 0; }
  .dc-sign-stack { display: flex; flex-direction: column; gap: 14px; }
  .dc-sign-card {
      flex: 1;
      border: 1px solid var(--lav-border);
      border-radius: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      text-align: center;
  }
  .dc-sign-space { width: 80%; border-bottom: 1px solid #333; margin-top: 30px; margin-bottom: 3px; }

  /* ===== BAR FOOTER ===== */
  .barfoot, .bottom-status-bar {
    background: var(--purple);
    color: #fff;
    margin: 8px -10px 0 -10px;
    padding: 7px 14px;
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    border-radius: 0;
  }
`;

export const getPrintLogoSrc = (profile) => {
  const custom = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  return custom || DEFAULT_PRINT_LOGO_SRC;
};

/** Icon/image only — used inside .logo boxes */
export const buildPrintLogoHtml = (profile) => {
  const src = getPrintLogoSrc(profile);
  return `<img src="${src}" alt="UMA MICRON" style="width:100%;height:100%;object-fit:contain;display:block;" />`;
};

/**
 * Exact UMA MICRON brand lockup for print headers.
 * Default logo already includes name + tagline, so no duplicate text is rendered.
 * Custom uploaded logos keep the classic logo + name + tagline layout.
 */
export const buildPrintBrandHtml = (profile, {
  companyName = 'UMA MICRON',
  tagline = "Micronization of API's"
} = {}) => {
  const custom = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  if (custom) {
    return `
      <div class="logo"><img src="${custom}" alt="Logo" style="width:100%;height:100%;object-fit:contain;display:block;" /></div>
      <div class="brand-text">
        <h1>${escHtml(companyName)}</h1>
        <div class="tagline">${escHtml(tagline)}</div>
      </div>`;
  }
  return `
    <div class="brand-lockup">
      <img src="${DEFAULT_PRINT_LOGO_SRC}" alt="UMA MICRON" />
    </div>`;
};

export const buildPrintHeader = (profile, title, badgeText = 'ORIGINAL FOR RECIPIENT') => `
  <div class="header">
    <div class="brand">
      ${buildPrintBrandHtml(profile, {
        companyName: profile.companyName || 'UMA MICRON',
        tagline: profile.tagline || "Micronization of API's"
      })}
    </div>
    <div class="tax-invoice-box">
      <div class="ti-title">${escHtml(title)}</div>
      ${badgeText ? `<div class="ti-sub">${escHtml(badgeText)}</div>` : ''}
    </div>
  </div>`;

export const buildMetaStrip = (profile, companyState, companyPan, rightColHtml) => `
  <div class="info-row">
    <div class="company-info">
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')} ${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')}, ${escHtml(companyState)}, India</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span>${escHtml(profile.phone || '+91 97120 00297')}</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span><span>${escHtml(profile.email || 'umamicron@gmail.com')}</span></div>
      <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span><span>${escHtml(profile.website || 'www.umamicron.com')}</span></div>

      <div class="reg-details">
        <div class="reg-row"><span class="label">GSTIN</span><span class="colon">:</span><span>${escHtml(profile.gstNumber || '')}</span></div>
        <div class="reg-row"><span class="label">PAN</span><span class="colon">:</span><span>${escHtml(companyPan)}</span></div>
        <div class="reg-row"><span class="label">State</span><span class="colon">:</span><span>${escHtml(companyState)}</span></div>
      </div>
    </div>

    <div class="invoice-meta">
      <div class="block" style="padding-top: 10px;">
        ${rightColHtml}
      </div>
    </div>
  </div>`;

export const hasPrintVal = (v) => {
  const s = String(v ?? '').trim();
  return s !== '' && s !== '-' && s !== '—' && s !== 'N/A';
};

export const buildPartyFootHtml = (gstin, state, stateCode) => {
  const rows = [];
  if (hasPrintVal(gstin)) {
    rows.push(`<div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>${escHtml(gstin)}</span></div>`);
  }
  if (hasPrintVal(state) || hasPrintVal(stateCode)) {
    const stateText = hasPrintVal(stateCode)
      ? `${escHtml(state)}${hasPrintVal(state) ? ' ' : ''}(${escHtml(stateCode)})`
      : escHtml(state);
    rows.push(`<div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>${stateText}</span></div>`);
  }
  return rows.length ? `<div class="party-foot">${rows.join('')}</div>` : '';
};

export const buildOptionalMetaRowHtml = (label, value, { iconHtml = '', sub = false } = {}) => {
  if (!hasPrintVal(value)) return '';
  return `<div class="meta-row${sub ? ' sub' : ''}"><span class="m-icon">${iconHtml || ''}</span><span class="m-label">${escHtml(label)}</span><span class="m-colon">:</span><span class="m-value">${escHtml(value)}</span></div>`;
};

export const buildPartyCard = (title, iconClass, name, addressLines, gstin, state, stateCode) => {
  const iconHtml = iconClass.includes('bi-') 
    ? `<i class="${iconClass}" style="margin-right: 6px;"></i>` 
    : `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>`;
  const lines = (addressLines || []).filter((l) => hasPrintVal(l));
    
  return `
  <div class="party">
    <div class="party-head">${iconHtml} ${escHtml(title)}</div>
    <div class="party-body">
      ${hasPrintVal(name) ? `<div class="cname">${escHtml(name)}</div>` : ''}
      ${lines.map(line => `<div>${escHtml(line)}</div>`).join('')}
    </div>
    ${buildPartyFootHtml(gstin, state, stateCode)}
  </div>`;
};

export const buildBankDetailsBox = (profile) => {
  const rows = [
    ['Bank Name', profile.bankName || 'AXIS BANK LTD'],
    ['A/c Name', profile.accountName || profile.companyName || 'UMA MICRON'],
    ['Current A/c No.', profile.accountNumber || ''],
    ['IFS CODE', profile.ifscCode || ''],
    ['Branch', profile.branch || '']
  ].filter(([, v]) => hasPrintVal(v));

  return `
  <div class="bank">
    <div class="box-head"><svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6"/><path d="M4 10h16v9H4z"/><path d="M4 19h16M8 10v9M12 10v9M16 10v9"/></svg> OUR BANK DETAILS</div>
    <div class="bank-body">
      ${rows.map(([label, value]) =>
        `<div class="bank-row"><span class="blabel">${escHtml(label)}</span><span class="bcolon">:</span><span>${escHtml(value)}</span></div>`
      ).join('')}
    </div>
  </div>`;
};

export const buildFooterTerms = (companyName, termsHtml, declarationHtml) => `
  <div class="footer3">
    <div class="f3col">
      <div class="box-head"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg> TERMS &amp; CONDITIONS</div>
      <div class="f3-body">
        ${termsHtml}
      </div>
    </div>
    <div class="f3col">
      <div class="box-head"><svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg> DECLARATION</div>
      <div class="f3-body">
        ${declarationHtml}
      </div>
    </div>
    <div class="f3col sig-col">
      <div class="for-company">For ${escHtml(companyName || 'UMA MICRON')}</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>`;

export const buildStatusBar = (pageText = 'Page 1 of 1', customText = 'This is a computer-generated document.') => `
  <div class="barfoot">
    <span>Thank you for your business!</span>
    <span>E. &amp; O.E.</span>
    <span>${escHtml(customText)}</span>
    <span>${escHtml(pageText)}</span>
  </div>`;

export const renderHtmlToPdf = async (html, {
  mode = 'save',
  filePrefix = 'DOC',
  docNo = 'N/A',
  width = PRINT_PAGE_W,
  fitPage = false,
  printPrefs,
  skipPrintPrefs = false,
  prepareDoc = null,
  splitOverflowPages = false
} = {}) => {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const htmlWithPrefs = skipPrintPrefs
    ? html
    : applyPrintPrefsToHtml(html, printPrefs || getStoredPrintPrefs());

  // Render inside an iframe so document <style> (e.g. * { font-size })
  // cannot leak into the live ERP UI and shrink app fonts on Preview.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'pdf-render-host');
  iframe.style.cssText = `position:fixed;left:-12000px;top:0;width:${width}px;height:1400px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument || iframe.contentWindow.document;
  idoc.open();
  idoc.write(htmlWithPrefs);
  idoc.close();
  if (idoc.documentElement) {
    if (!skipPrintPrefs) idoc.documentElement.classList.add(PRINT_ROOT_CLASS);
  }
  if (idoc.body) {
    if (!skipPrintPrefs) idoc.body.classList.add(PRINT_ROOT_CLASS);
  }

  try {
    await new Promise((r) => {
      if (idoc.readyState === 'complete') {
        requestAnimationFrame(() => requestAnimationFrame(r));
      } else {
        iframe.onload = () => requestAnimationFrame(() => requestAnimationFrame(r));
      }
    });
    // Allow images/fonts inside iframe to settle
    await new Promise((r) => setTimeout(r, 50));

    const a4Ratio = 297 / 210;
    const singlePageHeight = Math.round(width * a4Ratio);
    if (typeof prepareDoc === 'function') {
      prepareDoc(idoc, { width, singlePageHeight });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 0;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const pageNodes = [...idoc.querySelectorAll('.pdf-page')];
    const targets = pageNodes.length
      ? pageNodes
      : [idoc.querySelector('.print-host') || idoc.body?.firstElementChild].filter(Boolean);

    const captureScale = 2;
    const clipCanvasToA4 = (sourceCanvas) => {
      // Exact A4 pixel box at capture scale — keeps right/bottom borders visible
      const expectedW = Math.round(width * captureScale);
      const expectedH = Math.round(expectedW * a4Ratio);
      if (
        Math.abs(sourceCanvas.width - expectedW) <= 1 &&
        Math.abs(sourceCanvas.height - expectedH) <= 1
      ) {
        return sourceCanvas;
      }
      const clipped = document.createElement('canvas');
      clipped.width = expectedW;
      clipped.height = expectedH;
      const ctx = clipped.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, expectedW, expectedH);
      ctx.drawImage(sourceCanvas, 0, 0);
      return clipped;
    };

    let pdfHasPage = false;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const originalCss = target.style.cssText;
      let fitScale = 1;

      target.style.width = `${width}px`;
      target.style.height = 'auto';
      target.style.minHeight = '0';
      target.style.maxHeight = 'none';
      target.style.overflow = 'visible';
      target.style.boxSizing = 'border-box';
      target.style.margin = '0';
      target.style.zoom = '1';
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const naturalH = Math.max(target.scrollHeight, target.offsetHeight || 0);
      const overflows = naturalH > singlePageHeight + 4;
      // Lock designed pages to A4 unless this sheet still overflows and splitting is allowed
      const lockThisPage = (fitPage || pageNodes.length > 0) && !(splitOverflowPages && overflows);

      if (lockThisPage) {
        // Only zoom when fitPage is requested — CSS zoom shrinks content and leaves
        // a white strip on the right of full-bleed bars (quotation header, etc.).
        fitScale = (fitPage && overflows)
          ? Math.max(0.82, Math.min(1, singlePageHeight / naturalH))
          : 1;
        target.style.height = `${singlePageHeight}px`;
        target.style.minHeight = `${singlePageHeight}px`;
        target.style.maxHeight = `${singlePageHeight}px`;
        target.style.overflow = 'hidden';
        if (fitScale < 1) {
          // Widen layout so after zoom the visual width still fills the page
          target.style.width = `${Math.round(width / fitScale)}px`;
          target.style.zoom = String(fitScale);
        }
      } else if (overflows) {
        const pages = Math.max(1, Math.ceil(naturalH / singlePageHeight));
        target.style.minHeight = `${pages * singlePageHeight}px`;
        target.style.height = 'auto';
        target.style.maxHeight = 'none';
        target.style.overflow = 'visible';
      } else if (pageNodes.length > 0) {
        target.style.height = `${singlePageHeight}px`;
        target.style.minHeight = `${singlePageHeight}px`;
        target.style.maxHeight = `${singlePageHeight}px`;
        target.style.overflow = 'hidden';
      }

      const captureH = (lockThisPage || (!overflows && pageNodes.length > 0))
        ? singlePageHeight
        : Math.max(naturalH, target.scrollHeight, singlePageHeight);

      const canvasRaw = await html2canvas(target, {
        scale: captureScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        width,
        windowWidth: width,
        height: captureH,
        windowHeight: captureH,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        logging: false,
        onclone: (clonedDoc) => {
          if (!lockThisPage && !(pageNodes.length > 0 && !overflows)) return;
          const htmlEl = clonedDoc.documentElement;
          const bodyEl = clonedDoc.body;
          if (htmlEl) {
            htmlEl.style.width = `${width}px`;
            htmlEl.style.margin = '0';
            htmlEl.style.padding = '0';
            htmlEl.style.overflow = 'hidden';
          }
          if (bodyEl) {
            bodyEl.style.width = `${width}px`;
            bodyEl.style.margin = '0';
            bodyEl.style.padding = '0';
            bodyEl.style.overflow = 'hidden';
          }
          clonedDoc.querySelectorAll('.pdf-page, .print-host, .page').forEach((el) => {
            el.style.width = fitScale < 1 ? `${Math.round(width / fitScale)}px` : `${width}px`;
            el.style.height = `${singlePageHeight}px`;
            el.style.minHeight = `${singlePageHeight}px`;
            el.style.maxHeight = `${singlePageHeight}px`;
            el.style.overflow = 'hidden';
            el.style.transform = 'none';
            el.style.zoom = fitScale < 1 ? String(fitScale) : '1';
            el.style.margin = '0';
            el.style.padding = '0';
            el.style.boxSizing = 'border-box';
          });
          clonedDoc.querySelectorAll('.header').forEach((el) => {
            el.style.marginTop = '0';
            el.style.paddingTop = '0';
            el.style.width = '100%';
            if (el.querySelector('.quote-banner')) {
              el.style.minHeight = '96px';
              el.style.height = 'auto';
              el.style.alignItems = 'stretch';
              el.style.padding = '0 0 0 22px';
              el.style.overflow = 'hidden';
            } else {
              el.style.minHeight = '0';
              el.style.height = 'auto';
            }
          });
          clonedDoc.querySelectorAll('.quote-banner').forEach((el) => {
            el.style.margin = '0';
            el.style.marginLeft = 'auto';
            el.style.minHeight = '96px';
            el.style.alignSelf = 'stretch';
            el.style.flex = '1 1 300px';
            el.style.width = 'auto';
            el.style.maxWidth = 'none';
          });
          clonedDoc.querySelectorAll('.quote-banner .fill').forEach((el) => {
            el.style.minWidth = '0';
            el.style.width = '100%';
            el.style.minHeight = '96px';
            el.style.height = '100%';
            el.style.padding = '0 24px 0 44px';
          });
          clonedDoc.querySelectorAll('.contact-bar').forEach((el) => {
            el.style.width = '100%';
            el.style.boxSizing = 'border-box';
            el.style.margin = '0';
          });
          clonedDoc.querySelectorAll('.quote-banner h2').forEach((el) => {
            el.style.fontSize = '28px';
            el.style.lineHeight = '1';
            el.style.margin = '0';
          });
          clonedDoc.querySelectorAll('.content-wrapper td[valign="top"], .content-wrapper .pad-top').forEach((el) => {
            el.style.paddingTop = '4px';
            el.style.verticalAlign = 'top';
          });
          clonedDoc.querySelectorAll('.sig-col .sig-line').forEach((el) => {
            el.style.margin = '28px 12px 8px';
            el.style.visibility = 'visible';
          });
          clonedDoc.querySelectorAll('.footer3, .sig-col, .f3col, .barfoot').forEach((el) => {
            el.style.overflow = 'visible';
            el.style.flexShrink = '0';
          });
        }
      });

      target.style.cssText = originalCss;

      if (lockThisPage || (!overflows && pageNodes.length > 0)) {
        if (pdfHasPage) pdf.addPage();
        const canvas = clipCanvasToA4(canvasRaw);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH);
        pdfHasPage = true;
        continue;
      }

      // Overflowing sheet: slice full-bleed A4 pages so nothing is clipped
      if (splitOverflowPages && overflows) {
        const expectedW = Math.round(width * captureScale);
        const pageHpx = Math.round(expectedW * a4Ratio);
        let yPx = 0;
        let pageIndex = 0;
        while (yPx < canvasRaw.height - 1) {
          const sliceH = Math.min(pageHpx, canvasRaw.height - yPx);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = expectedW;
          pageCanvas.height = pageHpx;
          const ctx = pageCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, expectedW, pageHpx);
          ctx.drawImage(
            canvasRaw,
            0, yPx, Math.min(canvasRaw.width, expectedW), sliceH,
            0, 0, Math.min(canvasRaw.width, expectedW), sliceH
          );
          if (pdfHasPage || pageIndex > 0) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH);
          pdfHasPage = true;
          yPx += sliceH;
          pageIndex += 1;
        }
        continue;
      }

      const canvas = canvasRaw;
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
        if (pdfHasPage || pageIndex > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, sliceHmm);
        pdfHasPage = true;
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
    iframe.remove();
  }
};
