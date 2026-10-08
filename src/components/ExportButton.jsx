import { FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  getStoredCompanyProfile,
  formatCompanyAddressLines,
  getContactLine,
  drawCompanyLogo
} from '../utils/companyProfile';
import { promptPrintPrefs } from '../utils/promptPrintPrefs';
import { normalizePrintPrefs } from '../utils/printPrefs';
import { cellValue, downloadCompanyWiseExcel, flattenRowsForExcel } from '../utils/companyWiseExcel';

const displayRows = (data, columns) => data.map((row) => {
  const out = { ...row };
  columns.forEach((col) => {
    if (!col.type && !col.value) return;
    const v = cellValue(row, col);
    out[col.key] = typeof v === 'number' ? v.toFixed(2) : v;
  });
  return out;
});

/** Map CSS font stacks to jsPDF built-in faces. */
const toJsPdfFont = (fontFamily = '') => {
  const f = fontFamily.toLowerCase();
  if (f.includes('courier')) return 'courier';
  if (f.includes('times') || f.includes('georgia') || f.includes('cambria')) return 'times';
  return 'helvetica';
};

const ExportButton = ({ data, columns, filename, title, groupBy, docType, className = '', style = {} }) => {
  const profile = getStoredCompanyProfile();

  const exportToExcel = () => {
    const flatData = flattenRowsForExcel(data);
    if (groupBy || docType || (Array.isArray(data) && data.some((r) => r?.invoiceNo || r?.poNo || r?.noteNo || r?.dcNo || r?.quotationNo))) {
      downloadCompanyWiseExcel({ filename, title, columns, rows: data, groupBy: groupBy || 'partyName', docType })
        .catch((err) => alert(`Excel export failed: ${err?.message || err}`));
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const exportToPDF = async () => {
    const prefs = await promptPrintPrefs({ mode: 'save', docType: title || filename || 'Export' });
    if (!prefs) return;
    const { fontFamily, fontSize } = normalizePrintPrefs(prefs);
    const pdfFont = toJsPdfFont(fontFamily);
    const bodySize = Math.max(7, Math.min(14, fontSize - 2));
    const titleSize = Math.max(12, fontSize + 2);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    drawCompanyLogo(doc, 15, 8, profile);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(titleSize);
    doc.setFont(pdfFont, 'bold');
    doc.text(profile.companyName, 50, 18);

    doc.setFontSize(Math.max(8, fontSize - 2));
    doc.setFont(pdfFont, 'normal');
    formatCompanyAddressLines(profile).forEach((line, i) => {
      doc.text(line, 50, 24 + i * 5);
    });
    const contact = getContactLine(profile);
    if (contact) doc.text(contact, 50, 24 + formatCompanyAddressLines(profile).length * 5);
    if (profile.gstNumber) {
      doc.setFont(pdfFont, 'bold');
      doc.text(`GSTIN: ${profile.gstNumber}`, 50, 34 + formatCompanyAddressLines(profile).length * 5);
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 45, pageWidth - 15, 45);

    doc.setFontSize(titleSize);
    doc.setFont(pdfFont, 'bold');
    doc.text(title || filename, 15, 55);

    const tableCols = columns.map((col) => ({ header: col.label, dataKey: col.key }));

    const flatData = flattenRowsForExcel(data);

    doc.autoTable({
      startY: 65,
      columns: tableCols,
      body: displayRows(flatData, columns),
      theme: 'grid',
      styles: { font: pdfFont, fontSize: bodySize },
      headStyles: { fillColor: [16, 185, 129], font: pdfFont, fontStyle: 'bold' }
    });

    doc.save(`${filename}.pdf`);
  };

  const exportToWord = async () => {
    const prefs = await promptPrintPrefs({ mode: 'save', docType: title || filename || 'Export' });
    if (!prefs) return;
    const { fontFamily, fontSize } = normalizePrintPrefs(prefs);
    const flatData = flattenRowsForExcel(data);

    const header =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><body>";
    const footer = '</body></html>';
    let tableHtml = `<div style="font-family:${fontFamily};font-size:${fontSize}px;">`;
    tableHtml += `<h2 style="text-align:center;font-family:${fontFamily};font-size:${fontSize + 6}px;">${profile.companyName}</h2>`;
    tableHtml += `<p style="text-align:center;font-family:${fontFamily};font-size:${fontSize}px;">${formatCompanyAddressLines(profile).join('<br/>')}</p>`;
    if (profile.gstNumber) {
      tableHtml += `<p style="text-align:center;font-family:${fontFamily};font-size:${fontSize}px;"><strong>GSTIN: ${profile.gstNumber}</strong></p>`;
    }
    tableHtml += `<h3 style="font-family:${fontFamily};font-size:${fontSize + 2}px;">${title || filename}</h3>`;
    tableHtml += `<table border='1' style='width:100%;border-collapse:collapse;font-family:${fontFamily};font-size:${fontSize}px;'><tr>`;
    columns.forEach((col) => {
      tableHtml += `<th style="background-color:#f2f2f2;font-family:${fontFamily};font-size:${fontSize}px;">${col.label}</th>`;
    });
    tableHtml += '</tr>';

    displayRows(flatData, columns).forEach((row) => {
      tableHtml += '<tr>';
      columns.forEach((col) => {
        tableHtml += `<td style="font-family:${fontFamily};font-size:${fontSize}px;">${row[col.key] || ''}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</table></div>';

    const sourceHTML = header + tableHtml + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement('a');
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${filename}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  return (
    <div
      className={`export-buttons ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        maxWidth: '100%',
        boxSizing: 'border-box',
        ...style
      }}
    >
      <button
        type="button"
        onClick={exportToExcel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          background: '#fff',
          border: '1px solid var(--border-color)',
          padding: '0.45rem 0.75rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 500,
          color: '#334155',
          flex: '1 1 auto',
          minWidth: '0',
          maxWidth: '100%',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap'
        }}
        title="Export Excel"
      >
        <FileSpreadsheet size={16} color="#5b1c85" /> Export Excel
      </button>
      <button
        type="button"
        onClick={exportToPDF}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          background: '#fff',
          border: '1px solid var(--border-color)',
          padding: '0.45rem 0.75rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 500,
          color: '#334155',
          flex: '1 1 auto',
          minWidth: '0',
          maxWidth: '100%',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap'
        }}
        title="Export PDF"
      >
        <FileText size={16} color="#ef4444" /> Export PDF
      </button>
      <button
        type="button"
        onClick={exportToWord}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          background: '#fff',
          border: '1px solid var(--border-color)',
          padding: '0.45rem 0.75rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 500,
          color: '#334155',
          flex: '1 1 auto',
          minWidth: '0',
          maxWidth: '100%',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap'
        }}
        title="Export Word"
      >
        <FileDown size={16} color="#3b82f6" /> Export Word
      </button>
    </div>
  );
};

export default ExportButton;
