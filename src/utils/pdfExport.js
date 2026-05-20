import { jsPDF } from 'jspdf';

export const exportToPDF = (docType, data) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header banner
  doc.setFillColor(16, 185, 129); // Beautiful UMA Emerald
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("UMA MICRON", 15, 20);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Process Tracking, Milling & Job Work ERP", 15, 28);
  
  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const title = docType === 'TI' ? 'TAX INVOICE' : 
                docType === 'PI' ? 'PROFORMA INVOICE' : 
                docType === 'BPR' ? 'BATCH PROCESSING RECORD' : 
                docType === 'PL' ? 'PACKING LIST' : 
                docType === 'DC' ? 'DELIVERY CHALLAN' : docType.toUpperCase();
  
  doc.text(title, 15, 48);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 52, pageWidth - 15, 52);
  
  // Primary Info grid
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const docNo = data.invoiceNo || data.bprNo || data.plNo || data.dcNo || data.psdNo || data.receiptNo || 'N/A';
  const docDate = data.date || 'N/A';
  
  doc.setFont("helvetica", "bold");
  doc.text(`Document No:`, 15, 62);
  doc.setFont("helvetica", "normal");
  doc.text(`${docNo}`, 45, 62);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Date:`, 15, 68);
  doc.setFont("helvetica", "normal");
  doc.text(`${docDate}`, 45, 68);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Customer Party:`, 15, 74);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.partyName || 'UMA MICRON CORP'}`, 45, 74);

  doc.setFont("helvetica", "bold");
  doc.text(`Product Chemical:`, 15, 80);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.productName || 'N/A'}`, 45, 80);
  
  let yPos = 95;
  
  if (docType === 'PI' || docType === 'TI' || data.charges) {
    // Render standard invoice charges checklist table
    doc.setFillColor(245, 245, 245);
    doc.rect(15, yPos - 5, pageWidth - 30, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Line Item Description", 18, yPos);
    doc.text("HSN", 110, yPos);
    doc.text("Rate Details", 140, yPos);
    doc.text("Amount (₹)", 175, yPos);
    
    yPos += 10;
    doc.setFont("helvetica", "normal");

    const chargesList = [
      { key: 'cleaning', label: 'Cleaning Charges', hsn: '998842', isQty: true },
      { key: 'filterBag', label: 'Filter Bag Charges', hsn: '591190', isQty: false },
      { key: 'processing', label: 'Processing Charges', hsn: '998842', isQty: true },
      { key: 'sieving', label: 'Sieving Charges', hsn: '998842', isQty: true },
      { key: 'psdReport', label: 'PSD Report Charges', hsn: '998346', isQty: false },
      { key: 'liner', label: 'Liner', hsn: '39233090', isQty: false },
      { key: 'courier', label: 'Courier', hsn: '996812', isQty: false },
      { key: 'fiberDrum', label: 'Fiber Drum', hsn: '7310', isQty: false },
      { key: 'transportation', label: 'Transportation', hsn: '996511', isQty: false },
      { key: 'hdpeDrum', label: 'HDPE Drum', hsn: '39233090', isQty: false },
      { key: 'batchChangeover', label: 'Batch Changeover', hsn: '998842', isQty: false }
    ];

    chargesList.forEach(c => {
      if (data.charges?.[c.key]) {
        const rate = data.rates?.[c.key] || 0;
        const lineAmt = c.isQty ? (parseFloat(data.qty) || 0) * rate : rate;
        
        doc.text(c.label, 18, yPos);
        doc.text(c.hsn, 110, yPos);
        doc.text(c.isQty ? `${rate}/Kg` : `${rate} Flat`, 140, yPos);
        doc.text(`₹${lineAmt.toFixed(2)}`, 175, yPos);
        yPos += 8;
      }
    });

    yPos += 4;
    doc.line(110, yPos, pageWidth - 15, yPos);
    yPos += 8;

    doc.text("Subtotal:", 120, yPos);
    doc.text(`₹${(data.subtotal || 0).toFixed(2)}`, 175, yPos);
    yPos += 6;

    if (data.discount > 0) {
      doc.text("Discount Credit:", 120, yPos);
      doc.text(`- ₹${(data.discount || 0).toFixed(2)}`, 175, yPos);
      yPos += 6;
    }

    doc.text(`GST Tax (${data.taxRate}%):`, 120, yPos);
    doc.text(`₹${(data.taxAmount || 0).toFixed(2)}`, 175, yPos);
    yPos += 8;
    
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", 120, yPos);
    doc.text(`₹${(data.total || 0).toFixed(2)}`, 175, yPos);

  } else if (docType === 'BPR' && data.receivedBatches) {
    // Twin weight tables
    doc.text("Raw Material Received weights", 15, yPos - 5);
    doc.setFillColor(245, 245, 245);
    doc.rect(15, yPos, 85, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Batch", 18, yPos + 5);
    doc.text("Drum", 38, yPos + 5);
    doc.text("Gross", 53, yPos + 5);
    doc.text("Tare", 68, yPos + 5);
    doc.text("Net", 83, yPos + 5);

    // Dispatched headers
    doc.text("Dispatched micronised weights", 110, yPos - 5);
    doc.rect(110, yPos, 85, 8, 'F');
    doc.text("Batch", 113, yPos + 5);
    doc.text("Drum", 133, yPos + 5);
    doc.text("Gross", 148, yPos + 5);
    doc.text("Tare", 163, yPos + 5);
    doc.text("Net", 178, yPos + 5);

    yPos += 12;
    doc.setFont("helvetica", "normal");

    const maxRows = Math.max(data.receivedBatches.length, data.dispatchedBatches.length);
    for (let i = 0; i < maxRows; i++) {
      const rec = data.receivedBatches[i];
      const disp = data.dispatchedBatches[i];

      if (rec) {
        doc.text(`${rec.batchNo}`, 18, yPos);
        doc.text(`${rec.drumNo}`, 38, yPos);
        doc.text(`${rec.gross}`, 53, yPos);
        doc.text(`${rec.tare}`, 68, yPos);
        doc.text(`${rec.net.toFixed(1)}`, 83, yPos);
      }

      if (disp) {
        doc.text(`${disp.batchNo}`, 113, yPos);
        doc.text(`${disp.drumNo}`, 133, yPos);
        doc.text(`${disp.gross}`, 148, yPos);
        doc.text(`${disp.tare}`, 163, yPos);
        doc.text(`${disp.net.toFixed(1)}`, 178, yPos);
      }

      yPos += 7;
    }

  } else if (docType === 'PL' && data.batches) {
    // Packing lists weight sums
    doc.setFillColor(245, 245, 245);
    doc.rect(15, yPos - 5, pageWidth - 30, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Sr No", 18, yPos);
    doc.text("Batch No", 40, yPos);
    doc.text("Drum No", 80, yPos);
    doc.text("Gross Weight", 110, yPos);
    doc.text("Tare Weight", 140, yPos);
    doc.text("Net Weight", 170, yPos);

    yPos += 10;
    doc.setFont("helvetica", "normal");
    
    data.batches.forEach((b, idx) => {
      doc.text(`${idx + 1}`, 18, yPos);
      doc.text(`${b.batchNo}`, 40, yPos);
      doc.text(`${b.drumNo}`, 80, yPos);
      doc.text(`${b.gross} Kg`, 110, yPos);
      doc.text(`${b.tare} Kg`, 140, yPos);
      doc.text(`${b.net.toFixed(2)} Kg`, 170, yPos);
      yPos += 8;
    });

  } else if (docType === 'DC') {
    // Delivery challan logistics
    doc.setFont("helvetica", "bold");
    doc.text("LOGISTICS & DISPATCH PARTICULARS", 15, yPos);
    doc.setFont("helvetica", "normal");
    
    yPos += 8;
    doc.text(`Dispatched Material: ${data.productName}`, 15, yPos);
    yPos += 6;
    doc.text(`Quantity Sent: ${data.qty} Kg (${data.totalDrums} Drums)`, 15, yPos);
    yPos += 6;
    doc.text(`Vehicle Number: ${data.vehicleNo}`, 15, yPos);
    yPos += 6;
    doc.text(`Driver Name: ${data.driverName || 'N/A'}`, 15, yPos);
    yPos += 6;
    doc.text(`Declared Value: ₹${(data.value || 0).toLocaleString()}`, 15, yPos);
    
    yPos += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions:", 15, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 6;
    doc.text(data.termsAndConditions || 'None', 15, yPos, { maxWidth: pageWidth - 30 });
  }

  // Footer stamp
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("This is an official, computer-generated record authorized by UMA MICRON CORP.", pageWidth / 2, 285, { align: "center" });
  
  doc.save(`${docType}_${docNo}.pdf`);
};

export const downloadPDF = (docType, data) => {
  exportToPDF(docType, data);
};

export const downloadAllDocs = (transactionId, data) => {
  exportToPDF("Material Receipt", { ...data, receiptNo: data.receiptNo || "N/A" });
  
  setTimeout(() => {
    if (data.bprNo && data.bprNo !== '-') exportToPDF("BPR", { ...data, bprNo: data.bprNo });
  }, 500);

  setTimeout(() => {
    if (data.plNo && data.plNo !== '-') exportToPDF("PL", { ...data, plNo: data.plNo });
  }, 1000);

  setTimeout(() => {
    if (data.invNo && data.invNo !== '-') exportToPDF("TI", { ...data, invoiceNo: data.invNo });
  }, 1500);
};
