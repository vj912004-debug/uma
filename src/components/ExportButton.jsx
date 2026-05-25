import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const ExportButton = ({ data, columns, filename, title }) => {

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("UMA MICRON", 15, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("PLOT NO 1116 G.I.D.C. RANOLI, N.H.NO. 8,", 15, 26);
    doc.text("VADODARA - 391350, GUJARAT INDIA", 15, 31);
    doc.text("Tel: +91 97120 00297, Email : umamicron@gmail.com", 15, 36);
    doc.setFont("helvetica", "bold");
    doc.text("GSTIN: 24AGBPP8564D1ZE", 15, 41);

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
    // Simple HTML to Word export
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><body>";
    const footer = "</body></html>";
    let tableHtml = `<h2 style="text-align: center;">UMA MICRON</h2>`;
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
