/**
 * PDF download names: `{serial}-{DOC}-{Party Name}.pdf`
 * Example: `01-TI-Acme Pharma.pdf`
 */

const INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Last numeric segment of a doc no (e.g. UMA/IN/25-26/0001 → 1). */
export const extractDocSerial = (docNo) => {
  const raw = String(docNo || '').trim();
  if (!raw || raw === 'N/A') return '01';
  const parts = raw.split(/[/\\-_.\s]+/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const digits = String(parts[i]).replace(/\D/g, '');
    if (digits) {
      const n = parseInt(digits, 10);
      if (Number.isFinite(n) && n >= 0) return String(n).padStart(2, '0');
    }
  }
  const allDigits = raw.replace(/\D/g, '');
  if (allDigits) {
    const n = parseInt(allDigits.slice(-6), 10);
    if (Number.isFinite(n)) return String(n).padStart(2, '0');
  }
  return '01';
};

export const sanitizePdfPartyName = (name) => {
  const cleaned = String(name || 'Party')
    .replace(INVALID_FILE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Party';
};

/** Normalize internal codes so Tax Invoice downloads as TI (not IN). */
export const normalizePdfDocType = (docType) => {
  const t = String(docType || 'DOC').trim().toUpperCase();
  if (t === 'IN' || t === 'TAX INVOICE' || t === 'TAX_INVOICE') return 'TI';
  if (t === 'PERFORMA' || t === 'PROFORMA' || t === 'PROFORMA INVOICE') return 'PI';
  if (t === 'QUOT' || t === 'QUOTE' || t === 'QUOTATION') return 'QT';
  if (t === 'PACKING' || t === 'PACKING LIST') return 'PL';
  if (t === 'DELIVERY' || t === 'DELIVERY CHALLAN') return 'DC';
  return t || 'DOC';
};

/**
 * @param {{ docType?: string, filePrefix?: string, docNo?: string, partyName?: string, data?: object }} opts
 * @returns {string} filename including .pdf
 */
export const buildPdfDownloadFileName = (opts = {}) => {
  const {
    docType,
    filePrefix,
    docNo,
    partyName,
    data
  } = opts;
  const type = normalizePdfDocType(filePrefix || docType);
  const serial = extractDocSerial(
    docNo
    || data?.invoiceNo
    || data?.poNo
    || data?.bprNo
    || data?.plNo
    || data?.dcNo
    || data?.psdNo
    || data?.receiptNo
    || data?.noteNo
    || data?.quotationNo
    || data?.ewayBillNo
  );
  const party = sanitizePdfPartyName(
    partyName
    || data?.partyName
    || data?.customerName
    || data?.supplierName
    || data?.billToName
  );
  return `${serial}-${type}-${party}.pdf`;
};
