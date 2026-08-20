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

/** Map CSS font stacks to jsPDF built-in faces. */
const toJsPdfFont = (fontFamily = '') => {
  const f = fontFamily.toLowerCase();
  if (f.includes('courier')) return 'courier';
  if (f.includes('times') || f.includes('georgia') || f.includes('cambria')) return 'times';
  return 'helvetica';
};

const ExportButton = ({ data, columns, filename, title }) => {
  const profile = getStoredCompanyProfile();

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
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

    doc.autoTable({
      startY: 65,
      columns: tableCols,
      body: data,
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

    data.forEach((row) => {
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
    <div className="export-buttons" style={{ display: 'flex', gap: '1rem' }}>
      <button
        type="button"
        onClick={exportToExcel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#fff',
          border: '1px solid var(--border-color)',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: '#334155'
        }}
        title="Export Excel"
      >
        <FileSpreadsheet size={18} color="#5b1c85" /> Export Excel
      </button>
      <button
        type="button"
        onClick={exportToPDF}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#fff',
          border: '1px solid var(--border-color)',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: '#334155'
        }}
        title="Export PDF"
      >
        <FileText size={18} color="#ef4444" /> Export PDF
      </button>
      <button
        type="button"
        onClick={exportToWord}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#fff',
          border: '1px solid var(--border-color)',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: '#334155'
        }}
        title="Export Word"
      >
        <FileDown size={18} color="#3b82f6" /> Export Word
      </button>
    </div>
  );
};

export default ExportButton;
