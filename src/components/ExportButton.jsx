import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  getStoredCompanyProfile,
  formatCompanyAddressLines,
  getContactLine,
  drawCompanyLogo
} from '../utils/companyProfile';

const ExportButton = ({ data, columns, filename, title }) => {
  const profile = getStoredCompanyProfile();

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    drawCompanyLogo(doc, 15, 8, profile);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(profile.companyName, 50, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    formatCompanyAddressLines(profile).forEach((line, i) => {
      doc.text(line, 50, 24 + i * 5);
    });
    const contact = getContactLine(profile);
    if (contact) doc.text(contact, 50, 24 + formatCompanyAddressLines(profile).length * 5);
    if (profile.gstNumber) {
      doc.setFont("helvetica", "bold");
      doc.text(`GSTIN: ${profile.gstNumber}`, 50, 34 + formatCompanyAddressLines(profile).length * 5);
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 45, pageWidth - 15, 45);

    doc.setFontSize(16);
    doc.text(title || filename, 15, 55);

    const tableCols = columns.map(col => ({ header: col.label, dataKey: col.key }));
    
    doc.autoTable({
      startY: 65,
      columns: tableCols,
      body: data,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`${filename}.pdf`);
  };

  const exportToWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><body>";
    const footer = "</body></html>";
    let tableHtml = `<h2 style="text-align: center;">${profile.companyName}</h2>`;
    tableHtml += `<p style="text-align: center;">${formatCompanyAddressLines(profile).join('<br/>')}</p>`;
    if (profile.gstNumber) tableHtml += `<p style="text-align: center;"><strong>GSTIN: ${profile.gstNumber}</strong></p>`;
    tableHtml += `<h3>${title || filename}</h3>`;
    tableHtml += "<table border='1' style='width:100%; border-collapse: collapse;'><tr>";
    columns.forEach(col => {
      tableHtml += `<th style="background-color:#f2f2f2;">${col.label}</th>`;
    });
    tableHtml += "</tr>";
    
    data.forEach(row => {
      tableHtml += "<tr>";
      columns.forEach(col => {
        tableHtml += `<td>${row[col.key] || ''}</td>`;
      });
      tableHtml += "</tr>";
    });
    tableHtml += "</table>";
    
    const sourceHTML = header + tableHtml + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${filename}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  return (
    <div className="export-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
      <button onClick={exportToExcel} className="btn-secondary" title="Export Excel">
        <Download size={16} /> Excel
      </button>
      <button onClick={exportToPDF} className="btn-secondary" title="Export PDF">
        <Download size={16} /> PDF
      </button>
      <button onClick={exportToWord} className="btn-secondary" title="Export Word">
        <Download size={16} /> Word
      </button>
    </div>
  );
};

export default ExportButton;
