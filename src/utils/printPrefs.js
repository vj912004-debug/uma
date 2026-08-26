/** Shared print font / size preferences for all HTML PDF formats. */

export const PRINT_BASE_FONT_SIZE = 12;

export const PRINT_FONTS = [
  { label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: "Calibri, 'Segoe UI', sans-serif" },
  { label: 'Segoe UI', value: "'Segoe UI', Tahoma, sans-serif" },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Courier New', value: "'Courier New', Courier, monospace" }
];

export const PRINT_FONT_SIZES = [9, 10, 11, 12, 13, 14, 16, 18];

export const DEFAULT_PRINT_PREFS = {
  fontFamily: 'Cambria, Georgia, serif',
  fontSize: PRINT_BASE_FONT_SIZE
};

const STORAGE_KEY = 'uma_print_prefs';

export const normalizePrintPrefs = (prefs) => {
  const fontFamily = PRINT_FONTS.some((f) => f.value === prefs?.fontFamily)
    ? prefs.fontFamily
    : DEFAULT_PRINT_PREFS.fontFamily;
  const rawSize = parseInt(prefs?.fontSize, 10);
  const fontSize = PRINT_FONT_SIZES.includes(rawSize) ? rawSize : DEFAULT_PRINT_PREFS.fontSize;
  return { fontFamily, fontSize };
};

export const getStoredPrintPrefs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINT_PREFS };
    return normalizePrintPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PRINT_PREFS };
  }
};

export const setStoredPrintPrefs = (prefs) => {
  const next = normalizePrintPrefs(prefs);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
};

export const getPrintScale = (prefs) =>
  normalizePrintPrefs(prefs).fontSize / PRINT_BASE_FONT_SIZE;

/** Density tier used to auto-tighten layout when font/size grows. */
export const getPrintDensity = (prefs) => {
  const { fontSize } = normalizePrintPrefs(prefs);
  if (fontSize >= 16) return 'xl';
  if (fontSize >= 14) return 'lg';
  if (fontSize >= 13) return 'md';
  if (fontSize <= 10) return 'sm';
  return 'base';
};

/** Minimum zoom allowed when auto-fitting a locked A4 page. */
export const getPrintMinFitScale = (prefs) => {
  const scale = getPrintScale(prefs);
  if (scale >= 1.4) return 0.68;
  if (scale >= 1.15) return 0.74;
  if (scale >= 1) return 0.8;
  return 0.85;
};

/** CSS override injected into every print HTML document. */
export const buildPrintPrefsCss = (prefs) => {
  const { fontFamily, fontSize } = normalizePrintPrefs(prefs);
  const scale = fontSize / PRINT_BASE_FONT_SIZE;
  const density = getPrintDensity(prefs);
  const bodyFs = fontSize;
  const smallFs = Math.max(8, Math.round(fontSize * 0.88));
  const h1Fs = Math.round(bodyFs * 34 / 12);
  const badgeFs = Math.round(bodyFs * 22 / 12);
  const tagFs = Math.round(bodyFs * 13 / 12);
  const subFs = Math.max(8, Math.round(bodyFs * 10 / 12));
  const grandFs = Math.round(bodyFs * 17 / 12);
  const quoteFs = Math.round(bodyFs * 28 / 12);
  const quoteCompactFs = Math.round(bodyFs * 24 / 12);
  const companyTitleFs = Math.round(bodyFs * 26 / 12);
  const quoteSubFs = Math.max(8, Math.round(bodyFs * 9 / 12));
  // Tighten padding/gaps as font grows so pages stay balanced.
  const padScale = density === 'xl' ? 0.62 : density === 'lg' ? 0.72 : density === 'md' ? 0.85 : density === 'sm' ? 1.05 : 1;
  const gapScale = padScale;
  const lineH = density === 'xl' ? 1.2 : density === 'lg' ? 1.25 : 1.35;

  return `
  /* User print font / size — scale-aware across all formats */
  .uma-print-root {
    --print-fs: ${bodyFs}px;
    --print-fs-sm: ${smallFs}px;
    --print-scale: ${scale};
    --print-pad-scale: ${padScale};
    --print-gap-scale: ${gapScale};
    --print-lh: ${lineH};
    --print-density: ${density};
    font-family: ${fontFamily} !important;
    font-size: ${bodyFs}px !important;
  }
  .uma-print-root,
  .uma-print-root *:not(svg):not(svg *),
  .uma-print-root *::before,
  .uma-print-root *::after {
    font-family: ${fontFamily} !important;
  }

  /* Selected size applies to all print text (div/span labels were previously skipped) */
  .uma-print-root td,
  .uma-print-root th,
  .uma-print-root p,
  .uma-print-root li,
  .uma-print-root div,
  .uma-print-root span,
  .uma-print-root label,
  .uma-print-root .meta-table td,
  .uma-print-root .items-table td,
  .uma-print-root table.items td,
  .uma-print-root table.items th,
  .uma-print-root .party-card,
  .uma-print-root .party-body,
  .uma-print-root .party-foot,
  .uma-print-root .bank-box,
  .uma-print-root .bank-row,
  .uma-print-root .bank-body,
  .uma-print-root .totals-body,
  .uma-print-root .terms,
  .uma-print-root .company-info,
  .uma-print-root .reg-details,
  .uma-print-root .invoice-meta .block,
  .uma-print-root .meta-field,
  .uma-print-root .meta-field .lbl,
  .uma-print-root .meta-field .val,
  .uma-print-root .meta-field .colon,
  .uma-print-root .pl-meta,
  .uma-print-root .trow,
  .uma-print-root .dc-meta-row,
  .uma-print-root .dc-meta-card,
  .uma-print-root .dc-meta-card > div,
  .uma-print-root .dc-sign-title,
  .uma-print-root .reason-bar,
  .uma-print-root .note-title,
  .uma-print-root .amount-words,
  .uma-print-root .hsn-box,
  .uma-print-root .meta-item,
  .uma-print-root .sign,
  .uma-print-root .meta,
  .uma-print-root .meta .box,
  .uma-print-root .note,
  .uma-print-root .info-table,
  .uma-print-root .info-table td,
  .uma-print-root .letter-text,
  .uma-print-root .letter-text p,
  .uma-print-root .subject,
  .uma-print-root .card,
  .uma-print-root .card .co-name,
  .uma-print-root .card .addr,
  .uma-print-root table.dt td,
  .uma-print-root table.dt th,
  .uma-print-root .fr-note,
  .uma-print-root .fr-sign p,
  .uma-print-root .fr-sign .name,
  .uma-print-root .term,
  .uma-print-root .term h4,
  .uma-print-root .term p,
  .uma-print-root .bbox,
  .uma-print-root .bbox-head h4,
  .uma-print-root .bbox ol,
  .uma-print-root .bbox ol li,
  .uma-print-root .sign2 p,
  .uma-print-root .sign2 .name,
  .uma-print-root .page2-body {
    font-size: ${bodyFs}px !important;
    line-height: ${lineH} !important;
  }

  .uma-print-root .contact-bar,
  .uma-print-root .contact-bar .citem,
  .uma-print-root .contact-bar .citem span,
  .uma-print-root .footer-bar,
  .uma-print-root .status-bar,
  .uma-print-root .barfoot,
  .uma-print-root .barfoot span,
  .uma-print-root .bottom-banner,
  .uma-print-root .bottom-banner .thankyou,
  .uma-print-root .bottom-banner .items,
  .uma-print-root .pill-head,
  .uma-print-root .tbl-title,
  .uma-print-root .page2-header,
  .uma-print-root .feat p {
    font-size: ${smallFs}px !important;
    line-height: ${lineH} !important;
  }

  /* Quotation contact bar: never clip GSTIN / phone / email / website */
  .uma-print-root .contact-bar {
    display: grid !important;
    grid-template-columns: minmax(140px, 1fr) max-content max-content !important;
    overflow: visible !important;
  }
  .uma-print-root .contact-bar .citem.c-tight {
    min-width: max-content !important;
    overflow: visible !important;
    flex: 0 0 auto !important;
  }
  .uma-print-root .contact-bar .citem.c-tight span {
    white-space: nowrap !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    max-width: none !important;
  }
  .uma-print-root .letter-text,
  .uma-print-root .letter-text p,
  .uma-print-root .term p,
  .uma-print-root .bbox ol,
  .uma-print-root .bbox ol li,
  .uma-print-root td,
  .uma-print-root th,
  .uma-print-root p,
  .uma-print-root li {
    word-spacing: normal !important;
    letter-spacing: 0.01px !important;
  }
  .uma-print-root .sym {
    white-space: nowrap !important;
    word-spacing: 0 !important;
    letter-spacing: 0 !important;
    display: inline !important;
  }
  .uma-print-root .meta-row {
    display: grid !important;
    grid-template-columns: 16px 158px 12px minmax(0, 1fr) !important;
    column-gap: 4px !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
    font-size: ${bodyFs}px !important;
    font-weight: 700 !important;
    color: #231f20 !important;
    line-height: ${lineH} !important;
  }
  .uma-print-root .meta-row .m-icon {
    grid-column: 1 !important;
    width: 16px !important;
    flex: none !important;
  }
  .uma-print-root .meta-row .m-label,
  .uma-print-root .meta-row.sub .m-label,
  .uma-print-root .meta-row .m-colon,
  .uma-print-root .meta-row .m-value {
    font-size: ${bodyFs}px !important;
    font-weight: 700 !important;
    color: #231f20 !important;
    line-height: ${lineH} !important;
    white-space: nowrap !important;
  }
  .uma-print-root .meta-row .m-label,
  .uma-print-root .meta-row.sub .m-label {
    grid-column: 2 !important;
    width: auto !important;
    max-width: none !important;
    flex: none !important;
    padding-left: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .uma-print-root .meta-row .m-colon {
    grid-column: 3 !important;
    width: auto !important;
    flex: none !important;
    text-align: left !important;
  }
  .uma-print-root .meta-row .m-value {
    grid-column: 4 !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .uma-print-root .invoice-meta {
    min-width: 300px !important;
  }
  .uma-print-root .reg-row {
    display: grid !important;
    grid-template-columns: 52px 12px minmax(0, 1fr) !important;
    column-gap: 4px !important;
    align-items: center !important;
  }
  .uma-print-root .reg-row .label {
    width: auto !important;
    white-space: nowrap !important;
  }
  .uma-print-root .reg-row .colon {
    width: auto !important;
    text-align: left !important;
  }
  .uma-print-root .party-foot .frow,
  .uma-print-root .frow {
    display: grid !important;
    grid-template-columns: 50px 12px minmax(0, 1fr) !important;
    column-gap: 4px !important;
    align-items: center !important;
  }
  .uma-print-root .meta-field {
    display: grid !important;
    grid-template-columns: 120px 12px minmax(0, 1fr) !important;
    column-gap: 6px !important;
    align-items: center !important;
  }

  /* Kill top gap + lock header / badge layout across ALL print formats */
  .uma-print-root,
  .uma-print-root html,
  .uma-print-root body {
    margin: 0 !important;
    padding: 0 !important;
  }
  .uma-print-root .page,
  .uma-print-root .print-host,
  .uma-print-root .pdf-page {
    margin: 0 !important;
    padding: 0 !important;
  }
  .uma-print-root .content-wrapper > tbody > tr:first-child > td,
  .uma-print-root .content-wrapper > tr:first-child > td,
  .uma-print-root td[valign="top"],
  .uma-print-root .pad-top {
    padding-top: ${Math.max(2, Math.round(4 * padScale))}px !important;
    vertical-align: top !important;
  }
  .uma-print-root .header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: ${Math.round(12 * gapScale)}px !important;
    margin: 0 0 ${Math.round(8 * padScale)}px 0 !important;
    padding: 0 0 ${Math.round(8 * padScale)}px 0 !important;
    min-height: 0 !important;
    height: auto !important;
  }
  .uma-print-root .brand {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    min-width: 0 !important;
  }
  .uma-print-root .logo {
    width: 64px !important;
    height: 64px !important;
    flex-shrink: 0 !important;
  }
  .uma-print-root .logo img,
  .uma-print-root .logo svg {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    display: block !important;
  }
  .uma-print-root .brand-lockup {
    width: 280px !important;
    height: 70px !important;
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
  }
  .uma-print-root .brand-lockup img {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    object-position: left center !important;
    display: block !important;
  }
  .uma-print-root .brand-text {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: flex-start !important;
    gap: 2px !important;
  }
  /* Titles scale with the selected body size so font+size prefs are visible */
  .uma-print-root .brand-text h1,
  .uma-print-root .logo-text h1,
  .uma-print-root h1 {
    font-family: ${fontFamily} !important;
    font-size: ${h1Fs}px !important;
    line-height: 1 !important;
    margin: 0 !important;
    padding: 0 !important;
    letter-spacing: 0.5px !important;
    word-spacing: normal !important;
  }
  .uma-print-root .brand-text .tagline,
  .uma-print-root .logo-text p,
  .uma-print-root .tagline,
  .uma-print-root .company-subtitle {
    font-family: ${fontFamily} !important;
    font-size: ${tagFs}px !important;
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1.15 !important;
    letter-spacing: normal !important;
    word-spacing: 0 !important;
    white-space: nowrap !important;
  }
  .uma-print-root .tax-invoice-box,
  .uma-print-root .tax-invoice-badge,
  .uma-print-root .doc-badge {
    align-self: center !important;
    height: auto !important;
    min-height: 64px !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 8px 18px !important;
    box-sizing: border-box !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 0 !important;
  }
  .uma-print-root .tax-invoice-box .ti-title,
  .uma-print-root .tax-invoice-badge h2,
  .uma-print-root .doc-badge .ti-title {
    font-family: ${fontFamily} !important;
    font-size: ${badgeFs}px !important;
    line-height: 1.1 !important;
    margin: 0 !important;
    padding: 0 !important;
    font-weight: 800 !important;
    letter-spacing: 0.5px !important;
    white-space: nowrap !important;
  }
  .uma-print-root .tax-invoice-box .ti-sub {
    font-size: ${subFs}px !important;
    margin-top: 4px !important;
    padding: 2px 8px !important;
  }
  .uma-print-root .bpr-badge .title,
  .uma-print-root .bpr-badge .code {
    font-size: ${bodyFs}px !important;
  }
  .uma-print-root .company-title {
    font-family: ${fontFamily} !important;
    font-size: ${companyTitleFs}px !important;
  }
  .uma-print-root .grand,
  .uma-print-root .grand span,
  .uma-print-root .grand-total-banner {
    font-size: ${grandFs}px !important;
  }
  .uma-print-root .header:has(.quote-banner) {
    align-items: stretch !important;
    padding: 0 0 0 22px !important;
    margin: 0 !important;
    min-height: 96px !important;
    height: auto !important;
    overflow: hidden !important;
  }
  .uma-print-root .quote-banner {
    align-self: stretch !important;
    height: auto !important;
    min-height: 96px !important;
    margin: 0 !important;
    flex-shrink: 0 !important;
  }
  .uma-print-root .quote-banner .fill {
    min-width: 280px !important;
    min-height: 96px !important;
    height: 100% !important;
    padding: 0 24px 0 44px !important;
  }
  .uma-print-root .quote-banner h2 {
    font-family: ${fontFamily} !important;
    font-size: ${quoteFs}px !important;
    line-height: 1 !important;
    letter-spacing: 2px !important;
    margin: 0 !important;
    white-space: nowrap !important;
  }
  .uma-print-root .quote-banner .sub {
    font-size: ${quoteSubFs}px !important;
    margin-top: 6px !important;
    padding: 3px 10px !important;
  }
  .uma-print-root .sheet.quot-compact .header:has(.quote-banner),
  .uma-print-root .sheet.quot-compact .quote-banner,
  .uma-print-root .sheet.quot-compact .quote-banner .fill {
    min-height: 84px !important;
  }
  .uma-print-root .sheet.quot-compact .quote-banner h2 {
    font-size: ${quoteCompactFs}px !important;
  }
  .uma-print-root .party-body {
    min-height: 0 !important;
    white-space: normal !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }
  .uma-print-root .party-body .cname {
    margin: 0 0 2px !important;
  }
  .uma-print-root .party-body .addr,
  .uma-print-root .party-body > div:not(.cname) {
    margin: 0 !important;
    line-height: 1.4 !important;
    white-space: normal !important;
  }
  .uma-print-root .footer3,
  .uma-print-root .barfoot,
  .uma-print-root .bottom {
    flex-shrink: 0 !important;
    height: auto !important;
  }
  .uma-print-root table.footer3 {
    width: 100% !important;
    border-collapse: separate !important;
    border-spacing: 10px 0 !important;
    table-layout: fixed !important;
    display: table !important;
    height: auto !important;
  }
  .uma-print-root table.footer3 td.f3col {
    display: table-cell !important;
    width: 33.33% !important;
    height: 128px !important;
    max-height: none !important;
    min-height: 128px !important;
    overflow: visible !important;
    vertical-align: top !important;
    padding: 0 !important;
  }
  .uma-print-root table.footer3 .f3-body,
  .uma-print-root table.footer3 .sig-body {
    display: block !important;
    flex: none !important;
    height: auto !important;
    min-height: 0 !important;
  }
  .uma-print-root table.footer3 .sig-space {
    display: block !important;
    flex: none !important;
    height: 56px !important;
    min-height: 56px !important;
    max-height: 56px !important;
  }
  .uma-print-root .f3-body,
  .uma-print-root .f3-body ol,
  .uma-print-root .f3-body li,
  .uma-print-root .f3-body .term-line {
    font-size: ${bodyFs}px !important;
    white-space: normal !important;
    overflow: visible !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    line-height: 1.4 !important;
  }
  .uma-print-root .ti-page .content-wrapper,
  .uma-print-root .pi-page .content-wrapper,
  .uma-print-root .cn-page .content-wrapper,
  .uma-print-root .dn-page .content-wrapper,
  .uma-print-root .po-page .content-wrapper {
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    min-height: 0 !important;
  }
  .uma-print-root .ti-page .inv-top,
  .uma-print-root .pi-page .inv-top,
  .uma-print-root .cn-page .inv-top,
  .uma-print-root .dn-page .inv-top,
  .uma-print-root .po-page .inv-top {
    flex: 0 0 auto !important;
    padding: 4px 10px 0 !important;
  }
  .uma-print-root .ti-page .items-row,
  .uma-print-root .pi-page .items-row,
  .uma-print-root .cn-page .items-row,
  .uma-print-root .dn-page .items-row,
  .uma-print-root .po-page .items-row {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow: hidden !important;
    padding: 0 10px 4px !important;
  }
  .uma-print-root .ti-page .inv-bot,
  .uma-print-root .pi-page .inv-bot,
  .uma-print-root .cn-page .inv-bot,
  .uma-print-root .dn-page .inv-bot,
  .uma-print-root .po-page .inv-bot {
    flex: 0 0 auto !important;
    height: auto !important;
    padding: 8px 10px 0 !important;
    overflow: visible !important;
  }
  .uma-print-root .pi-page .content-wrapper tr.items-row,
  .uma-print-root .ti-page .content-wrapper tr.items-row,
  .uma-print-root .cn-page .content-wrapper tr.items-row,
  .uma-print-root .dn-page .content-wrapper tr.items-row,
  .uma-print-root .po-page .content-wrapper tr.items-row,
  .uma-print-root .pi-page .content-wrapper tr.items-row > td,
  .uma-print-root .ti-page .content-wrapper tr.items-row > td,
  .uma-print-root .cn-page .content-wrapper tr.items-row > td,
  .uma-print-root .dn-page .content-wrapper tr.items-row > td,
  .uma-print-root .po-page .content-wrapper tr.items-row > td,
  .uma-print-root .pi-page .table-container,
  .uma-print-root .ti-page .table-container,
  .uma-print-root .cn-page .table-container,
  .uma-print-root .dn-page .table-container,
  .uma-print-root .po-page .table-container,
  .uma-print-root .pi-page table.items,
  .uma-print-root .ti-page table.items,
  .uma-print-root .cn-page table.items,
  .uma-print-root .dn-page table.items,
  .uma-print-root .po-page table.items {
    height: auto !important;
    max-height: none !important;
  }
  .uma-print-root .pi-page .content-wrapper tr.inv-bot,
  .uma-print-root .ti-page .content-wrapper tr.inv-bot,
  .uma-print-root .cn-page .content-wrapper tr.inv-bot,
  .uma-print-root .dn-page .content-wrapper tr.inv-bot,
  .uma-print-root .po-page .content-wrapper tr.inv-bot {
    height: auto !important;
  }
  .uma-print-root .pi-page .content-wrapper tr.inv-bot > td,
  .uma-print-root .ti-page .content-wrapper tr.inv-bot > td,
  .uma-print-root .cn-page .content-wrapper tr.inv-bot > td,
  .uma-print-root .dn-page .content-wrapper tr.inv-bot > td,
  .uma-print-root .po-page .content-wrapper tr.inv-bot > td {
    height: auto !important;
    min-height: 280px !important;
    padding-bottom: 0 !important;
    vertical-align: bottom !important;
    overflow: visible !important;
  }
  .uma-print-root .barfoot {
    margin: 8px -10px 0 -10px !important;
    padding: ${Math.max(8, Math.round(bodyFs * 0.55))}px 14px ${Math.max(10, Math.round(bodyFs * 0.7))}px 14px !important;
    align-items: center !important;
    line-height: 1.35 !important;
    min-height: ${bodyFs + 18}px !important;
    overflow: visible !important;
    flex-shrink: 0 !important;
  }
  .uma-print-root .pi-page .barfoot,
  .uma-print-root .ti-page .barfoot,
  .uma-print-root .cn-page .barfoot,
  .uma-print-root .dn-page .barfoot,
  .uma-print-root .po-page .barfoot {
    margin: 4px -10px 0 -10px !important;
  }
  .uma-print-root .sig-col .sig-line,
  .uma-print-root .sig-line {
    margin: 0 !important;
    visibility: visible !important;
    display: block !important;
    color: #231f20 !important;
    -webkit-text-fill-color: #231f20 !important;
    text-align: center !important;
  }
  .uma-print-root .page-p2 .barfoot,
  .uma-print-root .page-p2 .sheet > .barfoot {
    margin: auto -10px -10px -10px !important;
    border-radius: 0 !important;
    width: auto !important;
  }
  .uma-print-root .barfoot span {
    white-space: nowrap !important;
    letter-spacing: 0.01px !important;
    word-spacing: 0.02em !important;
  }
  .uma-print-root table.items tbody tr.filler-row td {
    min-height: 18px !important;
    border-color: #c9bce8 !important;
    visibility: visible !important;
    opacity: 1 !important;
    background: #ffffff !important;
  }
  .uma-print-root table.items tbody tr.empty td {
    min-height: 18px !important;
    border: 1px solid #c9bce8 !important;
    visibility: visible !important;
    background: #ffffff !important;
  }
  .uma-print-root .page-p2 table.items tbody td {
    height: 18px !important;
    min-height: 18px !important;
    max-height: 18px !important;
    padding-top: 1px !important;
    padding-bottom: 1px !important;
    font-size: 10px !important;
    line-height: 1 !important;
    border-top: none !important;
    border-left: none !important;
    border-right: 1px solid #7c12bd !important;
    border-bottom: 1px solid #7c12bd !important;
    border-radius: 0 !important;
    margin: 0 !important;
  }
  .uma-print-root .page-p2 table.items tbody tr.filler-row td {
    height: 18px !important;
    min-height: 18px !important;
    max-height: 18px !important;
    padding-top: 1px !important;
    padding-bottom: 1px !important;
  }
  .uma-print-root .page-p2 .table-wrap {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    display: block !important;
  }
  .uma-print-root .page-p2 table.items {
    flex: 0 0 auto !important;
    height: auto !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border-top: 1px solid #7c12bd !important;
    border-left: 1px solid #7c12bd !important;
  }
  .uma-print-root .page-p2 table.items thead th {
    border-top: none !important;
    border-left: none !important;
    border-right: 1px solid #7c12bd !important;
    border-bottom: 1px solid #7c12bd !important;
    border-radius: 0 !important;
  }
  .uma-print-root table.items tbody tr.summary-row td {
    visibility: visible !important;
    opacity: 1 !important;
    color: #231f20 !important;
    -webkit-text-fill-color: #231f20 !important;
  }
  .uma-print-root .page-p2 table.items tbody tr.summary-row td {
    height: 18px !important;
    min-height: 18px !important;
    max-height: 18px !important;
    padding-top: 1px !important;
    padding-bottom: 1px !important;
    font-size: 10px !important;
    line-height: 1 !important;
  }
  .uma-print-root .footer3,
  .uma-print-root .f3col,
  .uma-print-root .sig-col {
    overflow: visible !important;
  }

  /* ---- Auto density: shrink spacing when larger fonts are chosen ---- */
  .uma-print-root.print-density-md .pad-x,
  .uma-print-root.print-density-lg .pad-x,
  .uma-print-root.print-density-xl .pad-x {
    padding-left: ${Math.round(12 * padScale)}px !important;
    padding-right: ${Math.round(12 * padScale)}px !important;
  }
  .uma-print-root.print-density-md .pad-mid,
  .uma-print-root.print-density-lg .pad-mid,
  .uma-print-root.print-density-xl .pad-mid {
    padding-top: ${Math.round(4 * padScale)}px !important;
    padding-bottom: ${Math.round(6 * padScale)}px !important;
  }
  .uma-print-root.print-density-md .parties,
  .uma-print-root.print-density-lg .parties,
  .uma-print-root.print-density-xl .parties,
  .uma-print-root.print-density-md .two-col,
  .uma-print-root.print-density-lg .two-col,
  .uma-print-root.print-density-xl .two-col,
  .uma-print-root.print-density-md .tables,
  .uma-print-root.print-density-lg .tables,
  .uma-print-root.print-density-xl .tables,
  .uma-print-root.print-density-md .features,
  .uma-print-root.print-density-lg .features,
  .uma-print-root.print-density-xl .features,
  .uma-print-root.print-density-md .terms-grid,
  .uma-print-root.print-density-lg .terms-grid,
  .uma-print-root.print-density-xl .terms-grid,
  .uma-print-root.print-density-md .dc-footer-grid,
  .uma-print-root.print-density-lg .dc-footer-grid,
  .uma-print-root.print-density-xl .dc-footer-grid {
    gap: ${Math.round(10 * gapScale)}px !important;
  }
  .uma-print-root.print-density-md table.items thead th,
  .uma-print-root.print-density-lg table.items thead th,
  .uma-print-root.print-density-xl table.items thead th,
  .uma-print-root.print-density-md table.items tbody tr:not(.filler-row):not(.empty) td,
  .uma-print-root.print-density-lg table.items tbody tr:not(.filler-row):not(.empty) td,
  .uma-print-root.print-density-xl table.items tbody tr:not(.filler-row):not(.empty) td,
  .uma-print-root.print-density-md table.dt th,
  .uma-print-root.print-density-lg table.dt th,
  .uma-print-root.print-density-xl table.dt th,
  .uma-print-root.print-density-md table.dt td,
  .uma-print-root.print-density-lg table.dt td,
  .uma-print-root.print-density-xl table.dt td {
    padding-top: ${Math.max(2, Math.round(6 * padScale))}px !important;
    padding-bottom: ${Math.max(2, Math.round(6 * padScale))}px !important;
  }
  .uma-print-root .page-p2 table.items tbody td,
  .uma-print-root.print-density-md .page-p2 table.items tbody td,
  .uma-print-root.print-density-lg .page-p2 table.items tbody td,
  .uma-print-root.print-density-xl .page-p2 table.items tbody td,
  .uma-print-root.print-density-md .page-p2 table.items thead th,
  .uma-print-root.print-density-lg .page-p2 table.items thead th,
  .uma-print-root.print-density-xl .page-p2 table.items thead th {
    padding-top: 1px !important;
    padding-bottom: 1px !important;
  }
  .uma-print-root .page-p2 table.items thead th,
  .uma-print-root.print-density-md .page-p2 table.items thead th,
  .uma-print-root.print-density-lg .page-p2 table.items thead th,
  .uma-print-root.print-density-xl .page-p2 table.items thead th {
    padding-top: 3px !important;
    padding-bottom: 3px !important;
    font-size: 10px !important;
  }
  .uma-print-root.print-density-lg .letter,
  .uma-print-root.print-density-xl .letter {
    margin-top: ${Math.round(6 * padScale)}px !important;
    gap: ${Math.round(8 * gapScale)}px !important;
  }
  .uma-print-root.print-density-lg .letter-text p,
  .uma-print-root.print-density-xl .letter-text p {
    margin-top: ${Math.round(4 * padScale)}px !important;
  }
  .uma-print-root.print-density-lg .feat,
  .uma-print-root.print-density-xl .feat {
    padding: ${Math.round(6 * padScale)}px !important;
    gap: ${Math.round(4 * gapScale)}px !important;
  }
  .uma-print-root.print-density-lg .feat .circ,
  .uma-print-root.print-density-xl .feat .circ {
    width: ${density === 'xl' ? 20 : 22}px !important;
    height: ${density === 'xl' ? 20 : 22}px !important;
  }
  .uma-print-root.print-density-lg .feat .circ svg,
  .uma-print-root.print-density-xl .feat .circ svg {
    width: ${density === 'xl' ? 10 : 11}px !important;
    height: ${density === 'xl' ? 10 : 11}px !important;
  }
  .uma-print-root.print-density-lg .page2-body,
  .uma-print-root.print-density-xl .page2-body {
    padding: ${Math.round(10 * padScale)}px ${Math.round(18 * padScale)}px ${Math.round(8 * padScale)}px !important;
    gap: ${Math.round(8 * gapScale)}px !important;
  }
  .uma-print-root.print-density-xl .fac-img {
    display: none !important;
  }
  .uma-print-root.print-density-md .body-pad,
  .uma-print-root.print-density-lg .body-pad,
  .uma-print-root.print-density-xl .body-pad {
    padding-left: ${Math.round(22 * padScale)}px !important;
    padding-right: ${Math.round(22 * padScale)}px !important;
  }

  /* BPR page-2 weight/drum table: never let print font prefs clip or hide cell text */
  .uma-print-root table.items tbody td,
  .uma-print-root table.items tbody td.wt {
    color: #231f20 !important;
    -webkit-text-fill-color: #231f20 !important;
    background: #ffffff !important;
    opacity: 1 !important;
    visibility: visible !important;
    overflow: visible !important;
    text-overflow: clip !important;
    line-height: 1.2 !important;
    font-size: ${bodyFs}px !important;
    white-space: nowrap !important;
  }
  .uma-print-root .ti-page table.items tbody td,
  .uma-print-root .pi-page table.items tbody td,
  .uma-print-root .cn-page table.items tbody td,
  .uma-print-root .dn-page table.items tbody td,
  .uma-print-root .po-page table.items tbody td {
    height: auto !important;
    min-height: 22px !important;
    max-height: none !important;
    padding-top: 4px !important;
    padding-bottom: 4px !important;
    overflow: visible !important;
    line-height: 1.25 !important;
  }
  .uma-print-root .ti-page table.items tbody td.left,
  .uma-print-root .pi-page table.items tbody td.left,
  .uma-print-root .cn-page table.items tbody td.left,
  .uma-print-root .dn-page table.items tbody td.left,
  .uma-print-root .po-page table.items tbody td.left {
    white-space: normal !important;
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    line-height: 1.25 !important;
  }
  .uma-print-root .ti-page table.items tbody tr.filler-row td,
  .uma-print-root .pi-page table.items tbody tr.filler-row td,
  .uma-print-root .cn-page table.items tbody tr.filler-row td,
  .uma-print-root .dn-page table.items tbody tr.filler-row td,
  .uma-print-root .po-page table.items tbody tr.filler-row td {
    height: 16px !important;
    min-height: 16px !important;
    max-height: 16px !important;
    padding-top: 1px !important;
    padding-bottom: 1px !important;
  }
  .uma-print-root table.items thead th {
    line-height: 1.15 !important;
    overflow: visible !important;
  }
  /* BPR page-1 grids: never break words mid-letter (supervisor, need, etc.) */
  .uma-print-root table.g th,
  .uma-print-root table.g td {
    word-break: normal !important;
    overflow-wrap: normal !important;
    hyphens: none !important;
    line-height: 1.2 !important;
    white-space: normal !important;
  }
  .uma-print-root table.g .light-purple-header td,
  .uma-print-root table.g tr.light-purple-header td {
    font-size: ${bodyFs}px !important;
    line-height: 1.25 !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    hyphens: none !important;
  }
  /* BPR page-2 weight/drum table: lock compact sample row size */
  .uma-print-root .page-p2 table.items tbody td,
  .uma-print-root .page-p2 table.items tbody td.wt {
    font-size: 10px !important;
    line-height: 1 !important;
    height: 18px !important;
    min-height: 18px !important;
    max-height: 18px !important;
  }
  .uma-print-root .page-p2 .signs {
    width: 250px !important;
    max-width: 34% !important;
    height: 32px !important;
    min-height: 32px !important;
    max-height: 32px !important;
    margin: 8px 0 0 0 !important;
    flex: 0 0 32px !important;
    align-self: flex-start !important;
    overflow: hidden !important;
  }
  .uma-print-root .page-p2 .sign {
    height: 32px !important;
    min-height: 0 !important;
    max-height: 32px !important;
    padding: 4px 10px !important;
    line-height: 1 !important;
    font-size: 12px !important;
    align-items: center !important;
  }
`;
};

export const PRINT_ROOT_CLASS = 'uma-print-root';

export const applyPrintPrefsToHtml = (html, prefs) => {
  const resolved = prefs ? normalizePrintPrefs(prefs) : getStoredPrintPrefs();
  const density = getPrintDensity(resolved);
  const css = `<style id="uma-print-prefs">${buildPrintPrefsCss(resolved)}</style>`;
  if (!html || typeof html !== 'string') return html;
  let next = html;
  if (!/id=["']uma-print-prefs["']/.test(next)) {
    if (/<\/head>/i.test(next)) next = next.replace(/<\/head>/i, `${css}</head>`);
    else if (/<style[\s>]/i.test(next)) next = next.replace(/<style[\s>]/i, (m) => `${css}${m}`);
    else next = `${css}${next}`;
  }
  // Stamp density on <html> / <body> so layout CSS can react before capture.
  if (/<html\b[^>]*>/i.test(next)) {
    next = next.replace(/<html\b([^>]*)>/i, (full, attrs) => {
      if (/\bclass\s*=/.test(attrs)) {
        return full.replace(/class=(["'])(.*?)\1/i, (_, q, cls) => {
          const parts = `${cls} ${PRINT_ROOT_CLASS} print-density-${density}`.trim().replace(/\s+/g, ' ');
          return `class=${q}${parts}${q}`;
        });
      }
      return `<html${attrs} class="${PRINT_ROOT_CLASS} print-density-${density}">`;
    });
  }
  if (/<body\b[^>]*>/i.test(next)) {
    next = next.replace(/<body\b([^>]*)>/i, (full, attrs) => {
      if (/\bclass\s*=/.test(attrs)) {
        return full.replace(/class=(["'])(.*?)\1/i, (_, q, cls) => {
          const parts = `${cls} ${PRINT_ROOT_CLASS} print-density-${density}`.trim().replace(/\s+/g, ' ');
          return `class=${q}${parts}${q}`;
        });
      }
      return `<body${attrs} class="${PRINT_ROOT_CLASS} print-density-${density}">`;
    });
  }
  return next;
};
