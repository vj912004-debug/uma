import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { exportToPDF } from './pdfExport';
import {
  getStoredCompanyProfile,
  formatCompanyAddressLines,
  getContactLine
} from './companyProfile';
import { promptPrintPrefs } from './promptPrintPrefs';
import { normalizePrintPrefs } from './printPrefs';
import { downloadInvoiceExcel } from './invoiceExcel';

const SKIP_KEYS = new Set([
  'id',
  'companyProfile',
  'appData',
  'isDeleted',
  'deletedAt',
  'passwordHash',
  'permissions',
  'moduleAccessConfigured'
]);

const KNOWN_PDF_TYPES = new Set(['TI', 'PI', 'PO', 'DN', 'CN', 'DC', 'BPR', 'PL', 'QUOTATION', 'PSD']);

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const labelOf = (key) => String(key || '')
  .replace(/([A-Z])/g, ' $1')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^./, (c) => c.toUpperCase());

const sheetName = (name, used) => {
  const base = String(name || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let next = base;
  let n = 2;
  while (used.has(next)) {
    const suffix = ` ${n++}`;
    next = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(next);
  return next;
};

const cellValue = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return '';
    return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  }
  return '';
};

const isScalar = (value) => value == null || ['string', 'number', 'boolean'].includes(typeof value);

export const documentFileName = (docType, data) => {
  const raw = data?.invoiceNo || data?.poNo || data?.dcNo || data?.bprNo || data?.plNo
    || data?.psdNo || data?.noteNo || data?.quotationNo || data?.receiptNo || docType || 'Document';
  return String(raw).replace(/[\\/:*?"<>|]+/g, '-');
};

export const splitDocumentSheets = (data) => {
  const details = [];
  const tables = [];
  Object.entries(data || {}).forEach(([key, value]) => {
    if (SKIP_KEYS.has(key) || typeof value === 'function') return;
    if (Array.isArray(value)) {
      const objects = value.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
      if (!objects.length) {
        const text = value.map(cellValue).filter((v) => v !== '').join(', ');
        if (text) details.push({ Field: labelOf(key), Value: text });
        return;
      }
      const keys = [...new Set(objects.flatMap((row) => Object.keys(row).filter((k) => !SKIP_KEYS.has(k) && isScalar(row[k]))))];
      tables.push({
        name: labelOf(key),
        rows: objects.map((row) => {
          const out = {};
          keys.forEach((k) => { out[labelOf(k)] = cellValue(row[k]); });
          return out;
        })
      });
      return;
    }
    if (!isScalar(value)) return;
    const text = cellValue(value);
    if (text === '') return;
    details.push({ Field: labelOf(key), Value: text });
  });
  return { details, tables };
};

export const downloadTablesExcel = (filename, sheets) => {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  const list = sheets?.length ? sheets : [{ name: 'Details', rows: [{ Field: 'Note', Value: '' }] }];
  list.forEach((sheet) => {
    const rows = sheet.rows?.length ? sheet.rows : [{ Field: 'Note', Value: '' }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName(sheet.name, used));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

const tablesHtml = (sheets, fontFamily, fontSize) => sheets.map((sheet) => {
  const rows = sheet.rows || [];
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!headers.length) return '';
  const head = headers.map((h) => `<th style="background:#f3e8ff;font-family:${fontFamily};font-size:${fontSize}px;padding:4px 8px;">${esc(h)}</th>`).join('');
  const body = rows.map((row) => (
    `<tr>${headers.map((h) => `<td style="font-family:${fontFamily};font-size:${fontSize}px;padding:4px 8px;">${esc(row[h])}</td>`).join('')}</tr>`
  )).join('');
  return `<h3 style="font-family:${fontFamily};font-size:${fontSize + 2}px;">${esc(sheet.name)}</h3><table border="1" style="width:100%;border-collapse:collapse;font-family:${fontFamily};font-size:${fontSize}px;"><tr>${head}</tr>${body}</table>`;
}).join('');

export const downloadTablesWord = async (filename, title, sheets) => {
  const prefs = await promptPrintPrefs({ mode: 'save', docType: title || filename || 'Document' });
  if (!prefs) return;
  const { fontFamily, fontSize } = normalizePrintPrefs(prefs);
  const profile = getStoredCompanyProfile();
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"></head><body>
    <div style="font-family:${fontFamily};font-size:${fontSize}px;">
      <h2 style="text-align:center;font-family:${fontFamily};font-size:${fontSize + 6}px;">${esc(profile.companyName)}</h2>
      <p style="text-align:center;font-family:${fontFamily};font-size:${fontSize}px;">${formatCompanyAddressLines(profile).map(esc).join('<br/>')}</p>
      ${profile.gstNumber ? `<p style="text-align:center;"><strong>GSTIN: ${esc(profile.gstNumber)}</strong></p>` : ''}
      <h3 style="font-family:${fontFamily};font-size:${fontSize + 2}px;">${esc(title || filename)}</h3>
      ${tablesHtml(sheets, fontFamily, fontSize)}
    </div>
  </body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const sheetsForDocument = (docType, data) => {
  const { details, tables } = splitDocumentSheets(data);
  return [
    { name: 'Details', rows: details.length ? details : [{ Field: 'Document', Value: docType || 'Document' }] },
    ...tables
  ];
};

export const downloadDocumentExcel = (docType, data) => {
  if (!data) return;
  const type = String(docType || '').toUpperCase();
  if (type === 'PI' || type === 'TI') return downloadInvoiceExcel(type, data);
  downloadTablesExcel(documentFileName(docType, data), sheetsForDocument(docType, data));
};

export const downloadDocumentWord = (docType, data, title) => {
  if (!data) return;
  return downloadTablesWord(documentFileName(docType, data), title || docType || 'Document', sheetsForDocument(docType, data));
};

const toJsPdfFont = (fontFamily = '') => {
  const f = fontFamily.toLowerCase();
  if (f.includes('courier')) return 'courier';
  if (f.includes('times') || f.includes('georgia') || f.includes('cambria')) return 'times';
  return 'helvetica';
};

const downloadFieldPdf = async (docType, data, title) => {
  const prefs = await promptPrintPrefs({ mode: 'save', docType: title || docType || 'Document' });
  if (!prefs) return;
  const { fontFamily, fontSize } = normalizePrintPrefs(prefs);
  const pdfFont = toJsPdfFont(fontFamily);
  const bodySize = Math.max(7, Math.min(14, fontSize - 2));
  const profile = data?.companyProfile || getStoredCompanyProfile();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(Math.max(12, fontSize + 2));
  doc.text(profile.companyName || 'UMA MICRON', 14, 16);
  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(Math.max(8, fontSize - 2));
  formatCompanyAddressLines(profile).forEach((line, i) => doc.text(line, 14, 22 + i * 4));
  const contact = getContactLine(profile);
  let y = 22 + formatCompanyAddressLines(profile).length * 4;
  if (contact) {
    doc.text(contact, 14, y);
    y += 4;
  }
  if (profile.gstNumber) {
    doc.text(`GSTIN: ${profile.gstNumber}`, 14, y);
    y += 6;
  }
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(Math.max(12, fontSize + 1));
  doc.text(title || docType || 'Document', 14, y);

  const { details, tables } = splitDocumentSheets(data);
  doc.autoTable({
    startY: y + 4,
    head: [['Field', 'Value']],
    body: (details.length ? details : [{ Field: 'Document', Value: docType }]).map((row) => [row.Field, String(row.Value ?? '')]),
    theme: 'grid',
    styles: { font: pdfFont, fontSize: bodySize },
    headStyles: { fillColor: [91, 28, 133], font: pdfFont, fontStyle: 'bold' }
  });
  tables.forEach((table) => {
    const headers = [...new Set((table.rows || []).flatMap((row) => Object.keys(row)))];
    if (!headers.length) return;
    doc.autoTable({
      startY: (doc.lastAutoTable?.finalY || y) + 8,
      head: [[table.name]],
      body: [],
      theme: 'plain',
      styles: { font: pdfFont, fontSize: bodySize + 1, fontStyle: 'bold' }
    });
    doc.autoTable({
      startY: (doc.lastAutoTable?.finalY || y) + 2,
      head: [headers],
      body: table.rows.map((row) => headers.map((h) => String(row[h] ?? ''))),
      theme: 'grid',
      styles: { font: pdfFont, fontSize: bodySize },
      headStyles: { fillColor: [91, 28, 133], font: pdfFont, fontStyle: 'bold' }
    });
  });
  doc.save(`${documentFileName(docType, data)}.pdf`);
};

export const downloadDocumentPdf = (docType, data, title) => {
  if (!data) return;
  if (KNOWN_PDF_TYPES.has(docType)) {
    exportToPDF(docType, data);
    return;
  }
  downloadFieldPdf(docType, data, title);
};
