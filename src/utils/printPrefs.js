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

/** CSS override injected into every print HTML document. */
export const buildPrintPrefsCss = (prefs) => {
  const { fontFamily, fontSize } = normalizePrintPrefs(prefs);
  // Scoped to .uma-print-root so offscreen div hosts cannot restyle the live ERP UI.
  // Only body/table text scales — header brand + purple doc badge keep design sizes
  // so they never clip or create large empty gaps.
  return `
  /* User print font / size overrides */
  .uma-print-root,
  .uma-print-root *:not(svg):not(svg *),
  .uma-print-root *::before,
  .uma-print-root *::after {
    font-family: ${fontFamily} !important;
  }
  .uma-print-root td,
  .uma-print-root th,
  .uma-print-root p,
  .uma-print-root li,
  .uma-print-root label,
  .uma-print-root .meta-table td,
  .uma-print-root .items-table td,
  .uma-print-root .party-card,
  .uma-print-root .party-body,
  .uma-print-root .party-foot,
  .uma-print-root .bank-box,
  .uma-print-root .terms,
  .uma-print-root .footer-bar,
  .uma-print-root .status-bar,
  .uma-print-root .company-info,
  .uma-print-root .reg-details,
  .uma-print-root .invoice-meta .block {
    font-size: ${fontSize}px !important;
  }
  .uma-print-root .meta-row {
    display: grid !important;
    grid-template-columns: 16px 158px 12px minmax(0, 1fr) !important;
    column-gap: 4px !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
    font-size: ${fontSize}px !important;
    font-weight: 700 !important;
    color: #231f20 !important;
    line-height: 1.3 !important;
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
    font-size: ${fontSize}px !important;
    font-weight: 700 !important;
    color: #231f20 !important;
    line-height: 1.3 !important;
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
    padding-top: 4px !important;
    vertical-align: top !important;
  }
  .uma-print-root .header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 12px !important;
    margin: 0 0 8px 0 !important;
    padding: 0 0 8px 0 !important;
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
  .uma-print-root .brand-text {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: flex-start !important;
    gap: 2px !important;
  }
  .uma-print-root .brand-text h1,
  .uma-print-root .logo-text h1,
  .uma-print-root h1 {
    font-size: 34px !important;
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
    font-size: 13px !important;
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
    font-size: 22px !important;
    line-height: 1.1 !important;
    margin: 0 !important;
    padding: 0 !important;
    font-weight: 800 !important;
    letter-spacing: 0.5px !important;
    white-space: nowrap !important;
  }
  .uma-print-root .tax-invoice-box .ti-sub {
    font-size: 10px !important;
    margin-top: 4px !important;
    padding: 2px 8px !important;
  }
`;
};

export const PRINT_ROOT_CLASS = 'uma-print-root';

export const applyPrintPrefsToHtml = (html, prefs) => {
  const resolved = prefs ? normalizePrintPrefs(prefs) : getStoredPrintPrefs();
  const css = `<style id="uma-print-prefs">${buildPrintPrefsCss(resolved)}</style>`;
  if (!html || typeof html !== 'string') return html;
  if (/id=["']uma-print-prefs["']/.test(html)) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${css}</head>`);
  if (/<style[\s>]/i.test(html)) return html.replace(/<style[\s>]/i, (m) => `${css}${m}`);
  return `${css}${html}`;
};
