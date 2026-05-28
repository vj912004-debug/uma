import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const buildPDF = (docType, data) => {
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
  
  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const title = docType === 'TI' ? 'TAX INVOICE' : 
                docType === 'PI' ? 'PROFORMA INVOICE' : 
                docType === 'BPR' ? 'BATCH PROCESSING RECORD' : 
                docType === 'PL' ? 'PACKING LIST' : 
                docType === 'DC' ? 'DELIVERY CHALLAN' :
                docType === 'DN' ? 'DEBIT NOTE' :
                docType === 'CN' ? 'CREDIT NOTE' :
                docType.toUpperCase();
  
  doc.text(title, 15, 55);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 59, pageWidth - 15, 59);
  
  // Primary Info grid
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const docNo = data.invoiceNo || data.bprNo || data.plNo || data.dcNo || data.psdNo || data.receiptNo || data.noteNo || 'N/A';
  const docDate = data.date || 'N/A';
  
  doc.setFont("helvetica", "bold");
  doc.text(`Document No:`, 15, 69);
  doc.setFont("helvetica", "normal");
  doc.text(`${docNo}`, 45, 69);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Date:`, 15, 75);
  doc.setFont("helvetica", "normal");
  doc.text(`${docDate}`, 45, 75);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Customer Party:`, 15, 81);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.partyName || data.customerName || 'UMA MICRON'}`, 45, 81);

  if (docType === 'TI' || docType === 'PI' || docType === 'DN' || docType === 'CN') {
    const billLines = doc.splitTextToSize(data.billAddress || '', 70);
    const shipLines = doc.splitTextToSize(data.shipAddress || '', 70);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 15, 93);
    doc.setFont("helvetica", "normal");
    doc.text(billLines, 15, 98);
    doc.setFont("helvetica", "bold");
    doc.text(`GST:`, 15, 98 + billLines.length * 5 + 2);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.gstinBill || ''}`, 28, 98 + billLines.length * 5 + 2);

    doc.setFont("helvetica", "bold");
    doc.text("Ship To:", 110, 93);
    doc.setFont("helvetica", "normal");
    doc.text(shipLines, 110, 98);
    doc.setFont("helvetica", "bold");
    doc.text(`GST:`, 110, 98 + shipLines.length * 5 + 2);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.gstinShip || ''}`, 123, 98 + shipLines.length * 5 + 2);
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Product Chemical:`, 15, 87);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.productName || 'N/A'}`, 45, 87);
  
  let yPos = (docType === 'TI' || docType === 'PI' || docType === 'DN' || docType === 'CN') ? 125 : 102;
  
  if (docType === 'QUOTATION') {
    // Header fields
    doc.setFont("helvetica", "bold");
    doc.text(`Quotation No: ${data.quotationNo || 'N/A'}`, 15, yPos);
    yPos += 6;
    doc.text(`Quotation Date: ${data.date || 'N/A'}`, 15, yPos);
    yPos += 6;
    doc.text(`Party Name: ${data.partyName || 'N/A'}`, 15, yPos);
    yPos += 10;

    // Letter body (as provided)
    doc.setFont("helvetica", "normal");
    const letterLines = [
      'Dear Sir/Madam,',
      `Sub: ${data.subject || 'Quotation for Micronization Services.'}`,
      '',
      'With reference to the above mentioned subject, Please find attached our offer along with relevant terms and condition for your ready reference.',
      '',
      'Uma Micron, Vadodara is a Gujarat based company that offers CONTRACT MICRONIZATION SERVICES dedicated to comply the needs of the pharmaceutical industry. The facility is at Ranoli-Vadodara, operates according to cGMP standards with more than 500 sq.ft processing area and big warehouse facility.',
      '',
      'Micronization: Jet micronization is used to mill particles below 10-20 microns. Particle to particle impact facilitated by air flow allows for producing particles less than 10-20 microns in size.',
      '',
      'We trust our offer will be in line with your requirement and if you have any techno-commercial queries, please feel free to contact us.',
      'Thanking You,',
      '',
      'For Uma Micron',
      data.signatoryName || 'Amit Patel'
    ];
    const wrapped = doc.splitTextToSize(letterLines.join('\n'), pageWidth - 30);
    doc.text(wrapped, 15, yPos);
    yPos += wrapped.length * 5 + 8;

    doc.setFont("helvetica", "bold");
    doc.text('QUOTATION: MICRONIZATION CHARGE', 15, yPos);
    yPos += 6;

    const mainBody = (data.mainCharges || [])
      .filter(c => c.description)
      .map((c, idx) => [String(idx + 1), c.description, c.psdRequirement || '', c.rate || '']);

    autoTable(doc, {
      startY: yPos,
      head: [['Sr. No.', 'Description', 'PSD Requirement', 'Rate']],
      body: mainBody.length ? mainBody : [['', '—', '—', '—']],
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 9.5, cellPadding: 3 }
    });

    yPos = doc.lastAutoTable.finalY + 8;

    // Optional items
    const optBody = (data.optionalCharges || [])
      .filter(c => c.description)
      .map((c, idx) => [String(idx + 1), c.description, c.rate || '']);

    if (optBody.length) {
      doc.setFont("helvetica", "bold");
      doc.text('BELOW ITEMS IF REQUIRED:', 15, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['Sr. No.', 'Description', 'Rate']],
        body: optBody,
        theme: 'grid',
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
        styles: { fontSize: 9.5, cellPadding: 3 }
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // Terms & Notes
    doc.setFont("helvetica", "bold");
    doc.text('Terms and Condition:', 15, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    const termsLines = doc.splitTextToSize(data.terms || '', pageWidth - 30);
    doc.text(termsLines, 15, yPos);
    yPos += termsLines.length * 5 + 6;

    if (data.validityDate) {
      doc.setFont("helvetica", "bold");
      doc.text(`Validity:`, 15, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(`${data.validityDate}`, 35, yPos);
      yPos += 8;
    }

    if (data.notes) {
      doc.setFont("helvetica", "bold");
      doc.text('Note:', 15, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(data.notes, pageWidth - 30);
      doc.text(noteLines, 15, yPos);
      yPos += noteLines.length * 5 + 10;
    }

    doc.setFont("helvetica", "bold");
    doc.text('For Uma Micron', 15, Math.min(yPos, 270));
    doc.text(data.signatoryName || 'Amit Patel', 15, Math.min(yPos + 18, 285));

  } else if (docType === 'PI' || docType === 'TI' || docType === 'DN' || docType === 'CN' || data.charges) {
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
      { key: 'batchChangeover', label: 'Batch Changeover', hsn: '998842', isQty: false },
      { key: 'other', label: 'Other Particulars', hsn: '', isQty: true }
    ];

    const body = [];
    chargesList.forEach(c => {
      if (data.charges?.[c.key]) {
        const rate = data.rates?.[c.key] || 0;
        const lineAmt = c.isQty ? (parseFloat(data.qty) || 0) * rate : rate;
        body.push([c.label, c.hsn, c.isQty ? `${rate}/Kg` : `${rate} Flat`, `Rs. ${lineAmt.toFixed(2)}`]);
      }
    });

    autoTable(doc, {
      startY: yPos,
      head: [["Line Item Description", "HSN", "Rate Details", "Amount (Rs.)"]],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 10, cellPadding: 3 }
    });

    yPos = doc.lastAutoTable.finalY + 10;
    
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", 120, yPos);
    doc.text(`Rs. ${(data.subtotal || 0).toFixed(2)}`, 175, yPos);
    yPos += 6;

    if (data.discount > 0) {
      doc.text("Discount Credit:", 120, yPos);
      doc.text(`- Rs. ${(data.discount || 0).toFixed(2)}`, 175, yPos);
      yPos += 6;
    }

    doc.text(`GST Tax (${data.taxRate}%):`, 120, yPos);
    doc.text(`Rs. ${(data.taxAmount || 0).toFixed(2)}`, 175, yPos);
    yPos += 8;
    
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", 120, yPos);
    doc.text(`Rs. ${(data.total || 0).toFixed(2)}`, 175, yPos);

  } else if (docType === 'BPR' && data.receivedBatches) {
    // Summary header
    doc.setFont("helvetica", "bold");
    doc.text("Batch Processing Record", 15, yPos - 5);
    yPos += 2;

    const headerRows = [
      ["Customer Name", data.customerName || data.partyName || ""],
      ["Product Name", data.productName || ""],
      ["Total Quantity (kg)", String(data.totalInputQty ?? "")],
      ["Batch No.", data.batchNo || ""],
      ["Total No. Batch", String(data.totalNoBatch ?? "")],
      ["Total Drum", String(data.totalDrums ?? "")],
      ["Particle size require", data.psdRequirement || ""],
      ["Sizing report require", data.sizingReportRequired || ""],
      ["Particle size result", data.particleSizeResult || ""],
      ["Processing Start", `${data.processingStartDate || ""} ${data.processingStartTime || ""}`.trim()],
      ["Processing supervisor", data.processingSupervisor || ""]
    ];

    autoTable(doc, {
      startY: yPos,
      body: headerRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } }
    });

    yPos = doc.lastAutoTable.finalY + 6;

    const checklistRows = [
      ["Is the Micronizar cleaned?", data.isMicronizerCleaned ? "Yes" : "No"],
      ["Is the processing Area Cleaned?", data.isAreaCleaned ? "Yes" : "No"],
      ["Is the filter Bag before process packed and labeled in LDPE Bag ?", data.isFilterBagPackedLabeled ? "Yes" : "No"],
      ["Is the bag is clean and black spot free?", data.isBagCleanBlackSpotFree ? "Yes" : "No"]
    ];
    autoTable(doc, {
      startY: yPos,
      head: [["Checklist Item", "Answer"]],
      body: checklistRows,
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 9, cellPadding: 2 }
    });
    yPos = doc.lastAutoTable.finalY + 6;

    if (Array.isArray(data.pressures) && data.pressures.length) {
      const pressureBody = data.pressures.map(r => [r.sp || "", r.dp || "", r.tp || "", r.fp || "", r.fip || ""]);
      autoTable(doc, {
        startY: yPos,
        head: [["S.P.", "D.P.", "T.P.", "F.P.", "Fi.P."]],
        body: pressureBody,
        theme: 'grid',
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
        styles: { fontSize: 9, cellPadding: 2 }
      });
      yPos = doc.lastAutoTable.finalY + 6;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Raw Material Received", 15, yPos - 2);
    
    const recBody = (data.receivedBatches || []).map(r => [r.batchNo, r.drumNo, r.gross, r.tare, (r.net ?? 0).toFixed(2)]);
    
    autoTable(doc, {
      startY: yPos,
      head: [["Batch No", "Drum No", "Gross", "Tare", "Net"]],
      body: recBody,
      theme: 'grid',
      tableWidth: 85,
      margin: { left: 15 },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 8, cellPadding: 2 }
    });

    doc.setFont("helvetica", "bold");
    doc.text("Dispatched (Micronized)", 110, yPos - 2);
    
    const dispBody = (data.dispatchedBatches || []).map(r => [r.batchNo, r.drumNo, r.gross, r.tare, (r.net ?? 0).toFixed(2)]);
    
    autoTable(doc, {
      startY: yPos,
      head: [["Batch No", "Drum No", "Gross", "Tare", "Net"]],
      body: dispBody,
      theme: 'grid',
      tableWidth: 85,
      margin: { left: 110 },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 8, cellPadding: 2 }
    });

    yPos = doc.lastAutoTable.finalY + 6;

    const pm = data.packingMaterials || {};
    autoTable(doc, {
      startY: yPos,
      head: [["Packing Materials Used", "Details"]],
      body: [
        ["White LD Bags", pm.whiteLdBags || ""],
        ["Black LD Bags", pm.blackLdBags || ""],
        ["Brow Tapes", pm.brownTapes || ""],
        ["Drum Used", pm.drumUsed || ""],
        ["Other Details", pm.otherDetails || ""]
      ],
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 9, cellPadding: 2 }
    });
    yPos = doc.lastAutoTable.finalY + 6;

    const dq = data.dispatchQty || {};
    autoTable(doc, {
      startY: yPos,
      head: [["Dispatch Material Quantity Details", "Value"]],
      body: [
        ["Micronized Material net weight", dq.micronizedNet || ""],
        ["Lumps Net weight", dq.lumpsNet || ""],
        ["Floor Dust Net weight", dq.floorDustNet || ""],
        ["Net Process Loss", dq.netProcessLoss || ""],
        ["Remark", dq.remark || ""]
      ],
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 9, cellPadding: 2 }
    });
    yPos = doc.lastAutoTable.finalY + 6;

    const completionRows = [
      ["Process completion", `${data.processCompletionDate || ""} ${data.processCompletionTime || ""}`.trim()],
      ["Filter Bag Packed & Stored", data.isFilterBagPackedStoredAfter ? "Yes" : "No"],
      ["Remark", data.remarks || ""],
      ["Operator's Signature", data.operatorSignature || ""],
      ["Plant Supervisor's Signature", data.plantSupervisorSignature || ""]
    ];
    autoTable(doc, {
      startY: yPos,
      body: completionRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' } }
    });

  } else if (docType === 'PL' && data.batches) {
    const plBody = data.batches.map((b, idx) => [idx + 1, b.batchNo, b.drumNo, `${b.gross} Kg`, `${b.tare} Kg`, `${b.net.toFixed(2)} Kg`]);
    
    autoTable(doc, {
      startY: yPos,
      head: [["Sr No", "Batch No", "Drum No", "Gross Weight", "Tare Weight", "Net Weight"]],
      body: plBody,
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 10, cellPadding: 3 }
    });

  } else if (docType === 'PSD' && (data.reports || data.requirement)) {
    doc.setFont("helvetica", "bold");
    doc.text("Particle Size Distribution (PSD) Report", 15, yPos);
    yPos += 6;

    const reports = data.reports || [{
      batchNo: data.batchNo || '',
      method: data.method || '',
      requirement: data.requirement || '',
      result: data.result || '',
      fileName: data.fileName || ''
    }];

    autoTable(doc, {
      startY: yPos,
      head: [["Batch No", "Method", "PSD Requirement", "PSD Result", "File"]],
      body: reports.map(r => [r.batchNo || '', r.method || '', r.requirement || '', r.result || '', r.fileName || '']),
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
      styles: { fontSize: 9, cellPadding: 2 }
    });

    yPos = doc.lastAutoTable.finalY + 8;

    if (data.notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Note:", 15, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(data.notes, pageWidth - 30);
      doc.text(noteLines, 15, yPos);
    }

  } else if (docType === 'DC') {
    doc.setFont("helvetica", "bold");
    doc.text("LOGISTICS & DISPATCH PARTICULARS", 15, yPos);
    doc.setFont("helvetica", "normal");
    
    const dcBody = [
      ["Party Name", data.partyName || 'N/A'],
      ["Ship To Address", data.shipAddress || 'N/A'],
      ["GST No", data.gstinShip || data.gstinBill || 'N/A'],
      ["Dispatched Material", data.productName || 'N/A'],
      ["Quantity Sent", `${data.qty} Kg (${data.totalDrums} Drums)`],
      ["Vehicle Number", data.vehicleNo || 'N/A'],
      ["Driver Name", data.driverName || 'N/A'],
      ["Declared Value", `Rs. ${(data.value || 0).toLocaleString()}`]
    ];
    
    autoTable(doc, {
      startY: yPos + 5,
      body: dcBody,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions:", 15, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 6;
    doc.text(data.termsAndConditions || 'None', 15, yPos, { maxWidth: pageWidth - 30 });

    // Signature footer (as requested)
    const sigY = 275;
    doc.setFont("helvetica", "bold");
    doc.text("For Uma Microns", 15, sigY);
    doc.text("Authorised Signatory", 15, sigY + 8);

    doc.text("Received By", pageWidth / 2 - 20, sigY);
    doc.text("Authorised Signatory", pageWidth / 2 - 20, sigY + 8);
  }

  // Footer stamp
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("This is an official, computer-generated record authorized by UMA MICRON CORP.", pageWidth / 2, 285, { align: "center" });
  
  return { doc, docNo };
};

export const exportToPDF = (docType, data) => {
  const { doc, docNo } = buildPDF(docType, data);
  doc.save(`${docType}_${docNo}.pdf`);
};

export const viewPDF = (docType, data) => {
  const { doc, docNo } = buildPDF(docType, data);
  const url = doc.output('bloburl');
  const win = window.open(url, '_blank');
  if (win) {
    win.document.title = `${docType}_${docNo}`;
  }
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
