import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to draw the logo
const drawLogo = (doc, x, y) => {
  doc.setDrawColor(0, 150, 0); // Green
  doc.setLineWidth(0.8);
  doc.ellipse(x + 10, y + 10, 8, 12);
  doc.setDrawColor(150, 0, 0); // Red
  doc.ellipse(x + 14, y + 10, 8, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(150, 0, 0);
  doc.text("U", x + 5, y + 15);
  doc.setTextColor(0, 150, 0);
  doc.text("M", x + 12, y + 15);
  doc.setTextColor(0, 0, 0); // Reset
};

const drawCompanyHeader = (doc, docType, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Draw Logo
  drawLogo(doc, 15, 10);
  
  // Header Text
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("UMA MICRON", pageWidth / 2, 16, { align: "center" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PLOT NO 1116 G.I.D.C. RANOLI, N.H.NO. 8,", pageWidth / 2, 22, { align: "center" });
  doc.text("VADODARA - 391350, GUJARAT INDIA", pageWidth / 2, 27, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Tel: +91 97120 00297, Email : info@umamicron.com", pageWidth / 2, 32, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("GSTIN: 24AGBPP8564D1ZE", pageWidth / 2, 37, { align: "center" });

  if (docType === 'TI') {
     doc.setFontSize(8);
     doc.setFont("helvetica", "normal");
     doc.text("Original\nDuplicate", pageWidth - 10, 15, { align: "right" });
  }

  // Draw title bar
  const titleMap = {
    'TI': 'Tax Invoice',
    'PI': 'Performa Invoice',
    'PO': 'Purchase Order'
  };
  
  const title = titleMap[docType] || docType.toUpperCase();
  
  autoTable(doc, {
    startY: 40,
    body: [[{ content: title, styles: { halign: 'center', fontStyle: 'bold', fontSize: 16, fillColor: [180, 200, 240] } }]],
    theme: 'plain',
    styles: { lineColor: 0, lineWidth: 0.2, textColor: 0 }
  });
  
  return doc.lastAutoTable.finalY;
};

const buildPO_PI_TI = (doc, docType, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = drawCompanyHeader(doc, docType, data);
  
  const docNo = data.invoiceNo || data.poNo || data.bprNo || 'N/A';
  const docDate = data.date || 'N/A';
  const refNo = data.partyDocNo || data.challanNo || '';
  const refDate = data.partyDocDate || '';

  let headerBody = [];
  if (docType === 'PO') {
    headerBody = [
      ['PO No:', docNo, 'Ref No.', refNo],
      ['PO Date:', docDate, 'Ref Date :', refDate],
      [{ content: 'State : GUJARAT', colSpan: 2, styles: { fillColor: [180,200,240] } }, { content: 'Code             24', colSpan: 2, styles: { fillColor: [180,200,240] } }]
    ];
  } else if (docType === 'PI') {
    headerBody = [
      ['PI No:', docNo, 'Delivery Challan No.', refNo],
      ['PI Date:', docDate, 'Date :', refDate],
      [{ content: 'State : GUJARAT', colSpan: 2 }, { content: 'Code             24', colSpan: 2 }]
    ];
  } else if (docType === 'TI') {
    headerBody = [
      ['Invoice No:', docNo, 'Invoice Date:', docDate],
      ['Delivery Challan No.', data.dcNo || '', 'Date :', data.dcDate || ''],
      ['State : GUJARAT', 'Code             24', 'PO No./Challan No.', `${refNo}`],
      [{ content: 'State : GUJARAT', colSpan: 2 }, { content: `Code             24  Date: ${refDate}`, colSpan: 2 }]
    ];
  }

  autoTable(doc, {
    startY: yPos,
    body: headerBody,
    theme: 'grid',
    styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 55 }, 2: { cellWidth: 35 } }
  });

  if (docType === 'PO') {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        ['Name :', data.partyName || ''],
        ['Address :', data.address || ''],
        ['State :', data.state || 'GUJARAT'],
        ['GSTIN:', data.gstin || '']
      ],
      theme: 'grid',
      styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 9, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold', halign: 'center' } }
    });
  } else {
    // PI or TI
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      head: [[{ content: 'Bill to Party', styles: { halign: 'center', fontStyle: 'bold' } }, { content: 'Ship to Party', styles: { halign: 'center', fontStyle: 'bold' } }]],
      body: [
        [`Name: ${data.partyName || ''}\nAddress:\n${data.billAddress || data.address || ''}\n\nState: GUJARAT                              Code: 24\nGSTIN: ${data.gstinBill || data.gstin || ''}`, 
         `Name: ${data.shipName || data.partyName || ''}\nAddress:\n${data.shipAddress || data.address || ''}\n\nState: GUJARAT                              Code: 24\nGSTIN: ${data.gstinShip || data.gstin || ''}`]
      ],
      theme: 'grid',
      styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 9, cellPadding: 1.5 }
    });
  }

  // Items Table
  const head = [
    [
      { content: 'S.\nNo.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [180, 200, 240] } },
      { content: 'Description', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [180, 200, 240] } },
      { content: 'Qty\nKg', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [180, 200, 240] } },
      { content: 'Rate', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [180, 200, 240] } },
      { content: 'Amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [180, 200, 240] } },
      { content: 'SGST', colSpan: 2, styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'CGST', colSpan: 2, styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'IGST', colSpan: 2, styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'Total', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [180, 200, 240] } }
    ],
    [
      { content: 'Rate', styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'Amount', styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'Rate', styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'Amount', styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'Rate', styles: { halign: 'center', fillColor: [180, 200, 240] } },
      { content: 'Amount', styles: { halign: 'center', fillColor: [180, 200, 240] } }
    ]
  ];

  const chargesList = [
    { key: 'cleaning', label: 'Cleaning Charges', isQty: true },
    { key: 'processing', label: 'Processing Charges', isQty: true },
    { key: 'filterBag', label: 'Filter Bag', isQty: false },
    { key: 'sieving', label: 'Sieving Charges', isQty: true },
    { key: 'psdReport', label: 'PSD Report Charges', isQty: false },
    { key: 'liner', label: 'Liner', isQty: false },
    { key: 'courier', label: 'Courier', isQty: false },
    { key: 'fiberDrum', label: 'Fiber Drum', isQty: false },
    { key: 'transportation', label: 'Transportation', isQty: false },
    { key: 'hdpeDrum', label: 'HDPE Drum', isQty: false },
    { key: 'batchChangeover', label: 'Batch Changeover', isQty: false }
  ];

  let itemsBody = [];
  let sno = 1;
  let totalAmt = 0, totalSgst = 0, totalCgst = 0, totalIgst = 0, totalAll = 0;
  
  const taxRate = parseFloat(data.taxRate) || 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const igstRate = 0;

  // For PO, sometimes product is listed directly
  if (docType === 'PO' && data.productName) {
      itemsBody.push([
        sno++,
        data.productName,
        data.qty || '-',
        '-',
        '-',
        '-', '-', '-', '-', '-', '-', '-'
      ]);
  }

  chargesList.forEach(c => {
     if (data.charges && data.charges[c.key]) {
        const qty = c.isQty ? (parseFloat(data.qty) || 1) : 1;
        const rate = parseFloat(data.rates?.[c.key] || 0);
        const amt = qty * rate;
        const sgstAmt = amt * (sgstRate / 100);
        const cgstAmt = amt * (cgstRate / 100);
        const igstAmt = amt * (igstRate / 100);
        const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;
        
        itemsBody.push([
          sno++,
          c.label,
          c.isQty ? qty.toFixed(2) : '1',
          rate.toFixed(2),
          amt.toFixed(2),
          sgstRate,
          sgstAmt.toFixed(2),
          cgstRate,
          cgstAmt.toFixed(2),
          igstRate,
          igstAmt.toFixed(2),
          rowTotal.toFixed(2)
        ]);

        totalAmt += amt;
        totalSgst += sgstAmt;
        totalCgst += cgstAmt;
        totalIgst += igstAmt;
        totalAll += rowTotal;
     }
  });

  // Pad table with empty rows
  for(let i = itemsBody.length; i < 9; i++) {
      itemsBody.push(['', '', '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']);
  }

  // Discount Row
  const discount = parseFloat(data.discount) || 0;
  if (discount > 0) {
      itemsBody.push([
          '',
          'Discount',
          '',
          '',
          `-${discount.toFixed(2)}`,
          '', '', '', '', '', '', `-${discount.toFixed(2)}`
      ]);
      totalAmt -= discount;
      totalAll -= discount;
      // Recalculate tax on discounted amount
      totalSgst = totalAmt * (sgstRate / 100);
      totalCgst = totalAmt * (cgstRate / 100);
      totalIgst = totalAmt * (igstRate / 100);
      totalAll = totalAmt + totalSgst + totalCgst + totalIgst;
  }

  itemsBody.push([
    { content: 'Total', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [180,200,240] } },
    data.qty || '-',
    '',
    totalAmt.toFixed(2),
    { content: totalSgst.toFixed(2), colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: totalCgst.toFixed(2), colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: totalIgst.toFixed(2), colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: totalAll.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    head: head,
    body: itemsBody,
    theme: 'grid',
    styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 8, cellPadding: 1.5, minCellHeight: 6 },
    columnStyles: { 
      0: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 15, halign: 'right' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 10, halign: 'right' },
      6: { cellWidth: 15, halign: 'right' },
      7: { cellWidth: 10, halign: 'right' },
      8: { cellWidth: 15, halign: 'right' },
      9: { cellWidth: 10, halign: 'right' },
      10: { cellWidth: 15, halign: 'right' },
      11: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    }
  });

  const tableY = doc.lastAutoTable.finalY;

  // Left Section (Bank/Terms)
  let leftBody = [];
  if (docType === 'PI' || docType === 'TI') {
    leftBody = [
      [{ content: 'OUR BANK DETAILS', styles: { fontStyle: 'bold' } }],
      [`Bank Name     : AXIS BANK LTD\nA/c Name      : UMA MICRON\nCurrent A/c No. : 916020061629671\nIFS CODE      : UTIB0000383\nBranch        : Nizampura`],
      [{ content: 'NOTE:\nPACKING MATERIALS AND TRANSPORTATION\nCHARGES WILL BE CHAGRE EXTRA AS ACTUAL', styles: { fontStyle: 'bold' } }],
      [{ content: 'Terms & conditions\n1) Subject to vadodara Juridiction.\n2) Payment 100% ADVANCE AGAINST PI\nthis is system generated PI so no need to sign', styles: { fontStyle: 'bold' } }]
    ];
  } else {
    leftBody = [
      [{ content: 'Terms & Conditions:', styles: { fontStyle: 'bold' } }],
      [`${data.terms || '1. Delivery 10 days from the date of Purchase Order.\n2. Transportation Extra As Actual.\n3. 10 Years Warranty'}`],
      [{ content: '\n\nthis is system generated PO so no need to sign', styles: { fontStyle: 'bold' } }]
    ];
  }

  autoTable(doc, {
    startY: tableY,
    tableWidth: (pageWidth - 28) * 0.55,
    margin: { left: 14, right: 0 },
    body: leftBody,
    theme: 'grid',
    styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 8, cellPadding: 2 }
  });

  // Right Section (Summary & Signatures)
  const summaryBody = [
    [{ content: 'Total Amount before Tax', styles: { fontStyle: 'bold' } }, { content: totalAmt.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
    ['CGST', { content: totalCgst.toFixed(2), styles: { halign: 'right' } }],
    ['SGST', { content: totalSgst.toFixed(2), styles: { halign: 'right' } }],
    ['IGST', { content: totalIgst.toFixed(2), styles: { halign: 'right' } }],
    [{ content: 'Total Tax Amount', styles: { fontStyle: 'bold' } }, { content: (totalCgst + totalSgst + totalIgst).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
    [{ content: 'Total Amount after Tax', styles: { fontStyle: 'bold', fontSize: 10 } }, { content: totalAll.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } }],
    [{ content: 'Certified that the particulars given above are true and correct\n\nFor UMA MICRON\n\n\n\n\nAuthorised signatory', colSpan: 2, styles: { halign: 'center', minCellHeight: 40 } }]
  ];

  autoTable(doc, {
    startY: tableY,
    tableWidth: (pageWidth - 28) * 0.45,
    margin: { left: 14 + (pageWidth - 28) * 0.55, right: 14 },
    body: summaryBody,
    theme: 'grid',
    styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 35 } }
  });
};

const buildBPR = (doc, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // ----- Page 1: Batch Processing Record -----
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Uma Micron", pageWidth / 2, 20, { align: "center" });

  let yPos = 25;

  autoTable(doc, {
    startY: yPos,
    body: [
      [{ content: 'Batch Processing Record', colSpan: 6, styles: { halign: 'center', fontStyle: 'bold', fontSize: 11 } }],
      ['Customer Name :', { content: data.partyName || '', colSpan: 5 }],
      ['Product Name :', { content: data.productName || '', colSpan: 5 }],
      ['Total Quantity (kg) :', data.totalInputQty || '', 'Batch No. :', data.bprNo || '', 'Total No. Batch', data.totalNoBatch || ''],
      [{ content: 'Material Received', colSpan: 2, styles: { halign: 'center' } }, 'Committed', { content: 'Processing Start', colSpan: 2, styles: { halign: 'center' } }, 'Processing supervisor'],
      ['Date', '', '', 'Date', '', data.processingSupervisor || ''],
      ['Time', '', '', 'Time', '', ''],
      [{ content: 'Particle size require', colSpan: 2, styles: { halign: 'center' } }, { content: 'Sizing report require', colSpan: 2, styles: { halign: 'center' } }, { content: 'Particle size result', colSpan: 2, styles: { halign: 'center' } }],
      [{ content: data.psdRequirement || '', colSpan: 2 }, { content: data.sizingReportRequired || '', colSpan: 2 }, { content: data.particleSizeResult || '', colSpan: 2 }],
      [{ content: 'Is the Micronizar cleaned?', colSpan: 4 }, { content: data.cleaningChecklist?.equipmentCleaned ? 'Yes' : 'No', colSpan: 2 }],
      [{ content: 'Is the processesing Area Cleaned?', colSpan: 4 }, { content: data.cleaningChecklist?.areaCleaned ? 'Yes' : 'No', colSpan: 2 }],
      [{ content: 'Is the filter Bag before process packed and labeled in LDPE Bag ?', colSpan: 4 }, { content: data.cleaningChecklist?.lineClearance ? 'Yes' : 'No', colSpan: 2 }],
      [{ content: 'Is the bag is clean and black spot free?', colSpan: 4 }, { content: 'Yes', colSpan: 2 }],
      [{ content: 'Feeding pressure', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } }, { content: 'Milling Pressure', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } }],
      ['S.P.', 'D.P.', 'T.P.', 'F.P.', { content: 'Fi.P.', colSpan: 2 }],
      [data.pressureMetrics?.grindingPressure || '', '', '', data.pressureMetrics?.injectionPressure || '', { content: '', colSpan: 2 }],
      ['', '', '', '', { content: '', colSpan: 2 }],
      ['', '', '', '', { content: '', colSpan: 2 }],
      [{ content: 'Packing Materails Used', colSpan: 6, styles: { fontStyle: 'bold' } }],
      ['White LD Bags', 'Black LD Bags', 'Brow Tapes', 'Drum Used', { content: 'Other Details', colSpan: 2 }],
      [data.packingConsumables?.linersUsed || '', '', '', data.packingConsumables?.fiberDrumsUsed || '', { content: '', colSpan: 2 }],
      [{ content: 'Dispatch Material Quantity Details', colSpan: 6, styles: { fontStyle: 'bold' } }],
      ['Micronized Material net weight', 'Lumps Net weight', 'Floor Dust Net weight', { content: 'Net Process Loss', colSpan: 2 }, 'Remark'],
      [data.totalDispatchedNet?.toFixed(2) || '', '', '', { content: '', colSpan: 2 }, ''],
      ['Process completion', 'Date', '', 'Time', { content: '', colSpan: 2 }],
      [{ content: 'Is Filter Bag Packed in HDPE bag and lable & stored properly after processing ?', colSpan: 5 }, ''],
      [{ content: 'Remark\n\n\n\n\n', colSpan: 6 }],
      [{ content: 'Operatores Singnature', colSpan: 3, styles: { halign: 'center', minCellHeight: 15 } }, { content: "Plant Supervisor's Signature", colSpan: 3, styles: { halign: 'center', minCellHeight: 15 } }]
    ],
    theme: 'grid',
    styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 9, cellPadding: 2 }
  });

  // ----- Page 2: Batch Packing Record -----
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Uma Micron", pageWidth / 2, 20, { align: "center" });

  const received = data.receivedBatches || [];
  const dispatched = data.dispatchedBatches || [];
  const maxRows = Math.max(received.length, dispatched.length, 25);
  
  let packingBody = [];
  for (let i = 0; i < maxRows; i++) {
    const r = received[i] || {};
    const d = dispatched[i] || {};
    packingBody.push([
      r.batchNo || '', r.drumNo || '', r.gross !== undefined ? r.gross : '', r.tare !== undefined ? r.tare : '', r.net !== undefined ? r.net.toFixed(2) : '',
      d.batchNo || '', d.drumNo || '', d.gross !== undefined ? d.gross : '', d.tare !== undefined ? d.tare : '', d.net !== undefined ? d.net.toFixed(2) : ''
    ]);
  }

  // Footer rows
  packingBody.push(
    [{ content: 'Micronized Material Net Weight', colSpan: 3 }, { content: data.totalDispatchedNet?.toFixed(2) || '', colSpan: 2 }, { content: '', colSpan: 5, rowSpan: 4, styles: { halign: 'center', valign: 'bottom', minCellHeight: 30 } }],
    [{ content: 'Lumps Net Weight', colSpan: 3 }, { content: '', colSpan: 2 }],
    [{ content: 'Sample Net Weight', colSpan: 3 }, { content: '', colSpan: 2 }],
    [{ content: 'Irrecoverable Loss', colSpan: 3 }, { content: '', colSpan: 2 }]
  );
  
  // Actually, put the supervisor sign text in the empty space
  packingBody[packingBody.length - 4][2].content = "\n\n\n\nPlant Supervisor's Sign";

  autoTable(doc, {
    startY: 25,
    head: [
      [{ content: 'Batch Packing Record', colSpan: 5, styles: { halign: 'center' } }, { content: `Date : ${data.date || ''}`, colSpan: 5, styles: { halign: 'center' } }],
      [{ content: 'Received Materials Weight', colSpan: 5, styles: { halign: 'center' } }, { content: 'Dispached(micronized) Materials Weight', colSpan: 5, styles: { halign: 'center' } }],
      ['Batch No.', 'Drum No', 'Gross Weight (kg)', 'Tare Weight (kg)', 'Net Weight (kg)', 'Batch No.', 'Drum No', 'Gross Weight (kg)', 'Tare Weight (kg)', 'Net Weight (kg)']
    ],
    body: packingBody,
    theme: 'grid',
    styles: { lineColor: 0, lineWidth: 0.2, textColor: 0, fontSize: 8, cellPadding: 1.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 12 }, 5: { cellWidth: 15 }, 6: { cellWidth: 12 } }
  });
};

const buildGeneric = (doc, docType, data) => {
   // Fallback for other document types if needed, though most are covered
   doc.text(docType, 15, 20);
   doc.text(JSON.stringify(data, null, 2), 15, 30);
};

const buildPDF = (docType, data) => {
  const doc = new jsPDF();
  let docNo = data.invoiceNo || data.bprNo || data.plNo || data.dcNo || data.psdNo || data.receiptNo || data.noteNo || 'N/A';
  
  if (['PO', 'PI', 'TI'].includes(docType)) {
    buildPO_PI_TI(doc, docType, data);
    docNo = data.poNo || data.invoiceNo || 'N/A';
  } else if (docType === 'BPR') {
    buildBPR(doc, data);
    docNo = data.bprNo || 'N/A';
  } else {
    // Other documents (PL, DC, Quotations etc.) - simple generic for now or we can restore old logic.
    // Restoring old logic for PL, DC, PSD, QUOTATION
    buildOldLogic(doc, docType, data);
  }

  return { doc, docNo };
};

// Paste back the old logic for remaining doc types
const buildOldLogic = (doc, docType, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("UMA MICRON", 15, 20);
  
  let yPos = 55;
  doc.text(docType, 15, yPos);
  yPos += 15;

  if (docType === 'PL' && data.batches) {
    const plBody = data.batches.map((b, idx) => [idx + 1, b.batchNo, b.drumNo, `${b.gross} Kg`, `${b.tare} Kg`, `${b.net.toFixed(2)} Kg`]);
    autoTable(doc, {
      startY: yPos,
      head: [["Sr No", "Batch No", "Drum No", "Gross Weight", "Tare Weight", "Net Weight"]],
      body: plBody,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 }
    });
  } else if (docType === 'PSD') {
    const reports = data.reports || [{
      batchNo: data.batchNo || '', method: data.method || '', requirement: data.requirement || '', result: data.result || '', fileName: data.fileName || ''
    }];
    autoTable(doc, {
      startY: yPos,
      head: [["Batch No", "Method", "PSD Requirement", "PSD Result", "File"]],
      body: reports.map(r => [r.batchNo || '', r.method || '', r.requirement || '', r.result || '', r.fileName || '']),
      theme: 'grid'
    });
  } else if (docType === 'DC') {
    const dcBody = [
      ["Party Name", data.partyName || 'N/A'],
      ["Ship To Address", data.shipAddress || 'N/A'],
      ["Dispatched Material", data.productName || 'N/A'],
      ["Quantity Sent", `${data.qty} Kg (${data.totalDrums} Drums)`],
      ["Vehicle Number", data.vehicleNo || 'N/A']
    ];
    autoTable(doc, {
      startY: yPos,
      body: dcBody,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 }
    });
  }
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
  setTimeout(() => { if (data.bprNo && data.bprNo !== '-') exportToPDF("BPR", { ...data, bprNo: data.bprNo }); }, 500);
  setTimeout(() => { if (data.plNo && data.plNo !== '-') exportToPDF("PL", { ...data, plNo: data.plNo }); }, 1000);
  setTimeout(() => { if (data.invNo && data.invNo !== '-') exportToPDF("TI", { ...data, invoiceNo: data.invNo }); }, 1500);
};
