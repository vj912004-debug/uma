import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getStoredCompanyProfile,
  mergeCompanyProfile,
  drawCompanyLogo,
  drawPdfCompanyHeader,
  drawPdfCompanyHeaderBoxed,
  formatCompanyAddressLines,
  getContactLine
} from './companyProfile';

const getProfile = (data) => mergeCompanyProfile(data?.companyProfile || getStoredCompanyProfile());

const buildPO_PI_TI = (doc, docType, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const profile = getProfile(data);
  drawPdfCompanyHeader(doc, { profile, startY: 10 });

  if (docType === 'TI') {
     doc.setFontSize(8);
     doc.setFont("helvetica", "normal");
     doc.text("Original\nDuplicate", pageWidth - 10, 15, { align: "right" });
  }

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

  let yPos = doc.lastAutoTable.finalY;
  
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
      [`Bank Name     : AXIS BANK LTD\nA/c Name      : ${profile.companyName}\nCurrent A/c No. : 916020061629671\nIFS CODE      : UTIB0000383\nBranch        : Nizampura`],
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
    [{ content: `Certified that the particulars given above are true and correct\n\nFor ${getProfile(data).companyName}\n\n\n\n\nAuthorised signatory`, colSpan: 2, styles: { halign: 'center', minCellHeight: 40 } }]
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

const BPR_PAGE2_ROWS = 35;
const BPR_GRID = { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, cellPadding: 2 };

const bprFmtWt = (v) => {
  if (v === '' || v === undefined || v === null) return '';
  if (v === 0) return '';
  return typeof v === 'number' ? v.toFixed(2) : v;
};

const bprFmtNet = (row) => {
  if (row.net !== '' && row.net !== undefined && row.net !== null && row.net !== 0) {
    return typeof row.net === 'number' ? row.net.toFixed(2) : row.net;
  }
  const g = parseFloat(row.gross);
  const t = parseFloat(row.tare);
  if (!Number.isNaN(g) && !Number.isNaN(t) && row.gross !== '' && row.tare !== '') {
    return Math.max(0, g - t).toFixed(2);
  }
  return '';
};

const bprCheck = (val) => (val === true ? 'Yes' : val === false ? '' : (val || ''));

const buildBPR = (doc, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const profile = getProfile(data);
  const companyTitle = profile.companyName || 'Uma Micron';
  const margin = { left: 14, right: 14 };

  const batchNos = [...new Set((data.receivedBatches || []).map((b) => b.batchNo).filter(Boolean))];
  const primaryBatchNo = batchNos.join(', ') || data.batchNo || '';
  const totalNoBatch = batchNos.length || data.totalNoBatch || '';
  const totalDrums = data.totalDrums || (data.receivedBatches || []).length || '';
  const pc = data.packingConsumables || {};
  const fmtDate = (d) => {
    if (!d) return '';
    try {
      const str = String(d);
      const date = str.length === 10 && str[4] === '-' ? new Date(`${str}T00:00:00`) : new Date(d);
      if (Number.isNaN(date.getTime())) return str;
      return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
    } catch {
      return String(d);
    }
  };
  const dispatchedNet = typeof data.totalDispatchedNet === 'number'
    ? data.totalDispatchedNet.toFixed(2)
    : (parseFloat(data.totalDispatchedNet) || 0).toFixed(2);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyTitle, pageWidth / 2, 18, { align: 'center' });

  const pressureRows = (data.pressureReadings && data.pressureReadings.length >= 4)
    ? data.pressureReadings.slice(0, 4).map((r) => [r.sp || '', r.dp || '', r.tp || '', r.fp || '', r.fip || '', ''])
    : [
      [data.pressureMetrics?.feedingSP || '', data.pressureMetrics?.feedingDP || '', data.pressureMetrics?.feedingTP || '', data.pressureMetrics?.millingFP || data.pressureMetrics?.grindingPressure || '', data.pressureMetrics?.millingFiP || data.pressureMetrics?.injectionPressure || '', ''],
      ['', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['', '', '', '', '', '']
    ];

  autoTable(doc, {
    startY: 22,
    margin,
    body: [
      [{ content: 'Batch Processing Record', colSpan: 6, styles: { halign: 'center', fontStyle: 'bold', fontSize: 11 } }],
      ['Customer Name :', { content: data.partyName || '', colSpan: 5 }],
      ['Product Name :', { content: data.productName || '', colSpan: 5 }],
      ['Total Quantity (kg) :', data.totalInputQty ?? '', 'Batch No. :', primaryBatchNo, `Total No. Batch : ${totalNoBatch}`, `Total Drum : ${totalDrums}`],
      [{ content: 'Material Received', colSpan: 2, styles: { halign: 'center' } }, { content: 'Committed', styles: { halign: 'center' } }, { content: 'Processing Start', colSpan: 2, styles: { halign: 'center' } }, { content: 'Processing supervisor', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }],
      ['Date', data.materialReceivedDate ? fmtDate(data.materialReceivedDate) : '', data.committedDate ? fmtDate(data.committedDate) : '', data.processingStartDate ? fmtDate(data.processingStartDate) : '', ''],
      ['Time', data.materialReceivedTime || '', data.committedTime || '', data.processingStartTime || '', data.processingSupervisor || ''],
      [{ content: 'Particle size require', colSpan: 2, styles: { halign: 'center' } }, { content: 'Sizing report require', colSpan: 2, styles: { halign: 'center' } }, { content: 'Particle size result', colSpan: 2, styles: { halign: 'center' } }],
      [{ content: data.psdRequirement || '', colSpan: 2 }, { content: data.sizingReportRequired || '', colSpan: 2 }, { content: data.particleSizeResult || '', colSpan: 2 }],
      [{ content: 'Is the Micronizar cleaned?', colSpan: 5 }, bprCheck(data.cleaningChecklist?.equipmentCleaned)],
      [{ content: 'Is the processesing Area Cleaned?', colSpan: 5 }, bprCheck(data.cleaningChecklist?.areaCleaned)],
      [{ content: 'Is the filter Bag before process packed and labeled in LDPE Bag ?', colSpan: 5 }, bprCheck(data.cleaningChecklist?.lineClearance)],
      [{ content: 'Is the bag is clean and black spot free?', colSpan: 5 }, bprCheck(data.cleaningChecklist?.bagClean)],
      [{ content: 'Feeding pressure', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } }, { content: 'Milling Pressure', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } }],
      ['S.P.', 'D.P.', 'T.P.', 'F.P.', { content: 'Fi.P.', colSpan: 2 }],
      ...pressureRows.map((row) => [row[0], row[1], row[2], row[3], { content: row[4], colSpan: 2 }]),
      [{ content: 'Packing Materails Used', colSpan: 6, styles: { fontStyle: 'bold' } }],
      ['White LD Bags', 'Black LD Bags', 'Brow Tapes', 'Drum Used', { content: 'Other Details', colSpan: 2 }],
      [pc.whiteLdBags || pc.linersUsed || '', pc.blackLdBags || '', pc.brownTapes || '', pc.drumUsed || pc.fiberDrumsUsed || '', { content: pc.otherDetails || pc.hdpeDrumsUsed || '', colSpan: 2 }],
      [{ content: 'Dispatch Material Quantity Details', colSpan: 6, styles: { fontStyle: 'bold' } }],
      ['Micronized Material net weight', 'Lumps Net weight', 'Floor Dust Net weight', { content: 'Net Process Loss', colSpan: 2 }, 'Remark'],
      [dispatchedNet !== '0.00' ? dispatchedNet : '', data.lumpsNetWeight || '', data.floorDustNetWeight || '', { content: data.processLoss || '', colSpan: 2 }, data.dispatchRemark || ''],
      ['Process completion', 'Date', data.processCompletionDate ? fmtDate(data.processCompletionDate) : '', 'Time', data.processCompletionTime || '', ''],
      [{ content: 'Is Filter Bag Packed in HDPE bag and lable & stored properly after processing ?', colSpan: 5 }, bprCheck(data.filterBagPacked)],
      [{ content: 'Remark', colSpan: 6, styles: { fontStyle: 'bold' } }],
      [{ content: data.remark || '\n\n\n\n', colSpan: 6, styles: { minCellHeight: 28, valign: 'top' } }],
      [{ content: 'Operatores Singnature', colSpan: 3, styles: { halign: 'center', minCellHeight: 18, valign: 'bottom' } }, { content: "Plant Supervisor's Signature", colSpan: 3, styles: { halign: 'center', minCellHeight: 18, valign: 'bottom' } }]
    ],
    theme: 'grid',
    styles: BPR_GRID
  });

  // ----- Page 2: Batch Packing Record -----
  doc.addPage();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyTitle, pageWidth / 2, 18, { align: 'center' });

  const received = data.receivedBatches || [];
  const dispatched = data.dispatchedBatches || [];
  const rowCount = Math.max(received.length, dispatched.length, BPR_PAGE2_ROWS);

  const packingBody = [];
  for (let i = 0; i < rowCount; i++) {
    const r = received[i] || {};
    const d = dispatched[i] || {};
    packingBody.push([
      r.batchNo || '', r.drumNo || '', bprFmtWt(r.gross), bprFmtWt(r.tare), bprFmtNet(r),
      d.batchNo || '', d.drumNo || '', bprFmtWt(d.gross), bprFmtWt(d.tare), bprFmtNet(d)
    ]);
  }

  packingBody.push(
    [{ content: 'Micronized Material Net Weight', colSpan: 4, styles: { halign: 'left' } }, dispatchedNet !== '0.00' ? dispatchedNet : '', '', '', '', '', '', '', ''],
    [{ content: 'Lumps Net Weight', colSpan: 4, styles: { halign: 'left' } }, data.lumpsNetWeight || '', '', '', '', '', '', '', ''],
    [{ content: 'Sample Net Weight', colSpan: 4, styles: { halign: 'left' } }, data.sampleNetWeight || '', '', '', '', '', '', '', ''],
    [{ content: 'Irrecoverable Loss', colSpan: 4, styles: { halign: 'left' } }, data.irrecoverableLoss || data.processLoss || '', '', '', '', '', '', '', ''],
    [{ content: '', colSpan: 5, styles: { minCellHeight: 10 } }, { content: "Plant Supervisor's Sign", colSpan: 5, styles: { halign: 'center', valign: 'bottom', minCellHeight: 18 } }]
  );

  autoTable(doc, {
    startY: 22,
    margin,
    head: [
      [{ content: 'Batch Packing Record', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } }, { content: `Date : ${fmtDate(data.date)}`, colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } }],
      [{ content: 'Received Materials Weight', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } }, { content: 'Dispatched (micronized) Materials Weight', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } }],
      ['Batch No.', 'Drum No', 'Gross Weight (kg)', 'Tare Weight (kg)', 'Net Weight (kg)', 'Batch No.', 'Drum No', 'Gross Weight (kg)', 'Tare Weight (kg)', 'Net Weight (kg)']
    ],
    body: packingBody,
    theme: 'grid',
    styles: { ...BPR_GRID, fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 14 }, 1: { cellWidth: 10 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 }, 4: { cellWidth: 20 },
      5: { cellWidth: 14 }, 6: { cellWidth: 10 }, 7: { cellWidth: 20 }, 8: { cellWidth: 20 }, 9: { cellWidth: 20 }
    }
  });
};

const buildGeneric = (doc, docType, data) => {
   // Fallback for other document types if needed, though most are covered
   doc.text(docType, 15, 20);
   doc.text(JSON.stringify(data, null, 2), 15, 30);
};

const PDF_MARGIN = 14;
const TI_CHARGE_ROWS = 11;

const formatPdfDateDmy = (d) => {
  if (!d || d === 'N/A') return d === 'N/A' ? 'N/A' : '';
  try {
    const str = String(d);
    const date = str.length === 10 && str[4] === '-'
      ? new Date(`${str}T00:00:00`)
      : new Date(d);
    if (Number.isNaN(date.getTime())) return str;
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  } catch {
    return String(d);
  }
};

const TI_CHARGES_LIST = [
  { key: 'cleaning', label: 'Minimum Cleaning Charges' },
  { key: 'processing', label: 'Processing Charges' },
  { key: 'psdReport', label: 'Particle size report charges' },
  { key: 'filterBag', label: 'Filter Bag' },
  { key: 'sieving', label: 'Sieving Charges' },
  { key: 'liner', label: 'Liner' },
  { key: 'courier', label: 'Courier' },
  { key: 'fiberDrum', label: 'Fiber Drum' },
  { key: 'transportation', label: 'Transportation' },
  { key: 'hdpeDrum', label: 'HDPE Drum' },
  { key: 'batchChangeover', label: 'Batch Changeover' }
];

const MATERIAL_QTY_CHARGE_KEYS = ['cleaning', 'processing', 'sieving', 'other'];

const getPdfChargeLineQty = (data, key, materialQty) => {
  const saved = data.qtys?.[key];
  if (saved != null && saved !== '') return parseFloat(saved) || 0;
  if (MATERIAL_QTY_CHARGE_KEYS.includes(key)) return materialQty || 1;
  return 1;
};

const drawOuterPageBorder = (doc) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setLineWidth(0.8);
  doc.setDrawColor(0, 0, 0);
  doc.rect(10, 10, w - 20, h - 20);
};

const buildTaxInvoicePDF = (doc, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const profile = getProfile(data);
  const gridMargin = { left: PDF_MARGIN, right: PDF_MARGIN };
  const gridStyles = {
    lineColor: [0, 0, 0],
    lineWidth: 0.5,
    textColor: 0,
    fontSize: 9,
    fontStyle: 'bold',
    cellPadding: 1.5
  };

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Original\nDuplicate', pageWidth - PDF_MARGIN, 12, { align: 'right' });

  const headerEndY = drawPdfCompanyHeaderBoxed(doc, { profile, variant: 'ti' });

  autoTable(doc, {
    startY: headerEndY,
    body: [[{ content: 'Tax Invoice', styles: { halign: 'center', fontStyle: 'bold', fontSize: 16 } }]],
    theme: 'grid',
    styles: { ...gridStyles, fontStyle: 'bold', cellPadding: 2 },
    margin: gridMargin
  });

  const docNo = data.invoiceNo || 'N/A';
  const docDate = formatPdfDateDmy(data.date) || 'N/A';
  const refNo = data.partyDocNo || data.challanNo || '';
  const refDate = formatPdfDateDmy(data.partyDocDate) || '';
  const dcNo = data.dcNo || '';
  const dcDate = formatPdfDateDmy(data.dcDate) || data.dcDate || '';

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      ['Invoice No:', { content: docNo, styles: { fontStyle: 'bold' } }, 'Invoice Date:', { content: docDate, styles: { fontStyle: 'bold' } }],
      ['Delivery Challan No.', dcNo, 'Date :', dcDate],
      [{ content: '', styles: { lineWidth: { top: 0, bottom: 0, left: 0.5, right: 0.5 } } }, { content: '', styles: { lineWidth: { top: 0, bottom: 0, left: 0, right: 0.5 } } }, 'PO No./Challan No.', refNo]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 56 }, 2: { cellWidth: 35 }, 3: { cellWidth: 56 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      ['State : GUJARAT', 'Code', '24', 'Date :', { content: refDate, colSpan: 2 }]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: {
      0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
      3: { cellWidth: 35 }, 4: { cellWidth: 28 }, 5: { cellWidth: 28 }
    },
    margin: gridMargin
  });

  const billState = data.billState || data.state || 'GUJARAT';
  const shipState = data.shipState || data.state || 'GUJARAT';
  const billCode = data.billStateCode || data.stateCode || '24';
  const shipCode = data.shipStateCode || data.stateCode || '24';

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [{ content: 'Bill to Party', styles: { halign: 'center' } }, { content: 'Ship to Party', styles: { halign: 'center' } }]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`Name :          ${data.partyName || ''}`, `Name :          ${data.shipName || data.partyName || ''}`]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`Address :\n${data.billAddress || data.address || ''}`, `Address :\n${data.shipAddress || data.address || ''}`]
    ],
    theme: 'grid',
    styles: { ...gridStyles, fontStyle: 'normal' },
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`State : ${billState}`, 'Code', billCode, `State : ${shipState}`, 'Code', shipCode]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: {
      0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
      3: { cellWidth: 60 }, 4: { cellWidth: 15 }, 5: { cellWidth: 16 }
    },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`GSTIN : ${data.gstinBill || data.gstin || ''}`, `GSTIN : ${data.gstinShip || data.gstin || ''}`]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  const head = [
    [
      { content: 'S.\nNo.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Description', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Qty', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Rate', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'SGST', colSpan: 2, styles: { halign: 'center' } },
      { content: 'CGST', colSpan: 2, styles: { halign: 'center' } },
      { content: 'IGST', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Total', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ],
    [
      { content: 'Rate', styles: { halign: 'center' } },
      { content: 'Amount', styles: { halign: 'center' } },
      { content: 'Rate', styles: { halign: 'center' } },
      { content: 'Amount', styles: { halign: 'center' } },
      { content: 'Rate', styles: { halign: 'center' } },
      { content: 'Amount', styles: { halign: 'center' } }
    ]
  ];

  const taxRate = parseFloat(data.taxRate) || 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const igstRate = 0;
  const qty = parseFloat(data.qty) || 0;
  const hsnCode = data.hsnCode || data.hsn || '';
  let itemsBody = [];
  let sno = 1;
  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalAll = 0;
  let totalQty = 0;

  const emptyTaxCells = ['', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00'];

  const addItemRow = (desc, rowQty, rate, amt, countQty = true) => {
    const sgstAmt = amt * (sgstRate / 100);
    const cgstAmt = amt * (cgstRate / 100);
    const igstAmt = amt * (igstRate / 100);
    const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;
    const qtyDisplay = typeof rowQty === 'number'
      ? (Number.isInteger(rowQty) ? rowQty : rowQty.toFixed(2))
      : rowQty;
    itemsBody.push([
      sno++, desc, qtyDisplay,
      typeof rate === 'number' ? rate.toFixed(2) : rate,
      amt.toFixed(2),
      sgstRate, sgstAmt.toFixed(2), cgstRate, cgstAmt.toFixed(2), igstRate, igstAmt.toFixed(2), rowTotal.toFixed(2)
    ]);
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalIgst += igstAmt;
    totalAll += rowTotal;
    if (countQty && typeof rowQty === 'number') totalQty += rowQty;
  };

  const TI_PROCESSING_LABEL = 'Processing Charges';
  const materialQty = qty;
  const productLines = getPdfProductLines(data);
  const normName = (s) => (s || '').trim().toLowerCase();

  const mergePdfLineItems = (lines) => {
    const merged = new Map();
    lines.forEach((line) => {
      const rate = parseFloat(line.rate) || 0;
      const descKey = (line.desc || '').trim().toLowerCase();
      const key = line.mergeKey
        ? `${descKey}|${rate.toFixed(2)}|${line.mergeKey}`
        : `${descKey}|${rate.toFixed(2)}`;
      const lineQty = parseFloat(line.rowQty) || 0;
      const lineAmt = parseFloat(line.amt) || 0;
      if (merged.has(key)) {
        const prev = merged.get(key);
        prev.rowQty += lineQty;
        prev.amt += lineAmt;
      } else {
        merged.set(key, { desc: line.desc, rowQty: lineQty, rate, amt: lineAmt, countQty: line.countQty });
      }
    });
    return Array.from(merged.values());
  };

  const pendingLines = [];
  const queueLine = (desc, rowQty, rate, amt, mergeKey = '', countQty = true) => {
    const lineQty = parseFloat(rowQty) || 0;
    const lineRate = parseFloat(rate) || 0;
    const lineAmt = parseFloat(amt) || 0;
    if (lineAmt <= 0 && lineQty <= 0) return;
    pendingLines.push({ desc, rowQty: lineQty, rate: lineRate, amt: lineAmt, mergeKey, countQty });
  };

  const getOrderedProductChargeEntries = () => {
    const pcMap = data.productCharges || {};
    const chargeKeys = Object.keys(pcMap);
    const orderedNames = [];
    const seen = new Set();
    const addName = (name) => {
      if (!name) return;
      const nk = normName(name);
      if (seen.has(nk)) return;
      seen.add(nk);
      orderedNames.push(name);
    };
    productLines.forEach(p => addName(p.name));
    chargeKeys.forEach(k => addName(k));
    return orderedNames.map(name => {
      const chargeKey = chargeKeys.find(k => normName(k) === normName(name)) || name;
      return {
        prodName: chargeKey,
        pc: pcMap[chargeKey],
        summary: productLines.find(p => normName(p.name) === normName(name))
      };
    }).filter(entry => entry.pc);
  };

  let hsnShown = false;
  const showHsnOnce = () => {
    if (hsnShown || !hsnCode) return;
    itemsBody.push(['', `HSN CODE : ${hsnCode}`, '', '', '0.00', ...emptyTaxCells]);
    hsnShown = true;
  };

  if (data.productCharges && Object.keys(data.productCharges).length > 0) {
    getOrderedProductChargeEntries().forEach(({ prodName, pc, summary }) => {
      const prodQty = summary?.qty || 0;
      if (pc.charges?.processing) {
        const rate = parseFloat(pc.rates?.processing || 0);
        const lineQty = prodQty || parseFloat(pc.qtys?.processing) || 0;
        const amt = lineQty * rate;
        if (amt > 0 || lineQty > 0) {
          queueLine(TI_PROCESSING_LABEL, lineQty, rate, amt, normName(prodName));
          showHsnOnce();
        }
      }
      TI_CHARGES_LIST.filter(c => c.key !== 'processing').forEach((c) => {
        if (pc.charges?.[c.key]) {
          const rowQty = pc.qtys?.[c.key] != null && pc.qtys?.[c.key] !== ''
            ? (parseFloat(pc.qtys[c.key]) || 0)
            : 1;
          const rate = parseFloat(pc.rates?.[c.key] || 0);
          const amt = rowQty * rate;
          if (amt > 0) {
            queueLine(c.label, rowQty, rate, amt, '', false);
          }
        }
      });
    });
  } else {
    if (data.charges?.processing && productLines.length) {
      productLines.forEach(({ name, qty: lineQtyVal }) => {
        const procRate = parseFloat(data.rates?.processing || 0);
        const lineQty = lineQtyVal || materialQty;
        const amt = lineQty * procRate;
        if (amt > 0 || lineQty > 0) {
          queueLine(TI_PROCESSING_LABEL, lineQty, procRate, amt, normName(name));
          showHsnOnce();
        }
      });
    } else if (data.charges?.processing) {
      const procRate = parseFloat(data.rates?.processing || 0);
      const procQty = getPdfChargeLineQty(data, 'processing', materialQty);
      const procAmt = procQty * procRate;
      if (procAmt > 0 || procQty > 0) {
        queueLine(TI_PROCESSING_LABEL, procQty, procRate, procAmt);
        showHsnOnce();
      }
    } else if (data.productName) {
      const prodName = data.productName.toUpperCase().includes('MICRONIZED')
        ? data.productName.toUpperCase()
        : `${data.productName.toUpperCase()} MICRONIZED`;
      queueLine(prodName, qty, 0, 0, '', false);
      showHsnOnce();
    }

    TI_CHARGES_LIST.filter((c) => c.key !== 'processing').forEach((c) => {
      if (data.charges?.[c.key]) {
        const rowQty = getPdfChargeLineQty(data, c.key, materialQty);
        const rate = parseFloat(data.rates?.[c.key] || 0);
        const amt = rowQty * rate;
        if (amt > 0) {
          queueLine(c.label, rowQty, rate, amt, '', false);
        }
      }
    });
  }

  mergePdfLineItems(pendingLines).forEach((line) => {
    addItemRow(line.desc, line.rowQty, line.rate, line.amt, line.countQty !== false);
  });

  if (data.customCharges?.length) {
    data.customCharges.forEach((cc) => {
      if (cc.checked) {
        const ccQty = parseFloat(cc.qty) || 1;
        const rate = parseFloat(cc.rate) || 0;
        const amt = ccQty * rate;
        if (amt > 0) {
          addItemRow(cc.name, ccQty, rate, amt, false);
          if (cc.hsn) {
            itemsBody.push(['', `HSN CODE : ${cc.hsn}`, '', '', '0.00', ...emptyTaxCells]);
          }
        }
      }
    });
  }

  const discount = parseFloat(data.discount) || 0;
  if (discount > 0) {
    itemsBody.push(['', 'Discount', '', '', `-${discount.toFixed(2)}`, '', '', '', '', '', '', `-${discount.toFixed(2)}`]);
    totalAmt -= discount;
    totalAll -= discount;
    totalSgst = totalAmt * (sgstRate / 100);
    totalCgst = totalAmt * (cgstRate / 100);
    totalIgst = totalAmt * (igstRate / 100);
    totalAll = totalAmt + totalSgst + totalCgst + totalIgst;
  }

  for (let i = itemsBody.length; i < TI_CHARGE_ROWS; i++) {
    itemsBody.push(['', '', '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']);
  }

  itemsBody.push([
    { content: 'Total', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
    totalQty || '',
    '',
    totalAmt.toFixed(2),
    '', totalSgst.toFixed(2),
    '', totalCgst.toFixed(2),
    '', totalIgst.toFixed(2),
    totalAll.toFixed(2)
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    head,
    body: itemsBody,
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: 0,
      fontSize: 8,
      cellPadding: 1.5,
      minCellHeight: 6,
      valign: 'top'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 17, halign: 'right' },
      5: { cellWidth: 8, halign: 'right' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 8, halign: 'right' },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 8, halign: 'right' },
      10: { cellWidth: 14, halign: 'right' },
      11: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    },
    margin: gridMargin
  });

  const tableY = doc.lastAutoTable.finalY;
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  const leftWidth = contentWidth * 0.58;
  const rightWidth = contentWidth * 0.42;

  autoTable(doc, {
    startY: tableY,
    tableWidth: leftWidth,
    margin: { left: PDF_MARGIN, right: 0 },
    body: [
      [{ content: 'OUR BANK DETAILS', styles: { fontStyle: 'bold', lineWidth: { top: 0.5, bottom: 0, left: 0.5, right: 0.5 } } }],
      [{
        content: `Bank Name     : AXIS BANK LTD\nA/c Name      : ${profile.companyName}\nCurrent A/c No. : 916020061629671\nIFS CODE      : UTIB0000383\nBranch        : Nizampura`,
        styles: { lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 }, minCellHeight: 25, fontStyle: 'normal' }
      }],
      [{
        content: 'Terms & conditions\n1) Subject to vadodara Juridiction.\n2) Payment Term as per our agree terms.\n3) Interest will charged @ 24% per annum if\namount remaining unpaid from due date.',
        styles: { minCellHeight: 35, fontStyle: 'bold', lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 } }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 8, cellPadding: 2 }
  });
  const leftFooterY = doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY: tableY,
    tableWidth: rightWidth,
    margin: { left: PDF_MARGIN + leftWidth, right: PDF_MARGIN },
    body: [
      ['Total Amount before Tax', { content: totalAmt.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
      ['SGST', { content: totalSgst.toFixed(2), styles: { halign: 'right' } }],
      ['CGST', { content: totalCgst.toFixed(2), styles: { halign: 'right' } }],
      ['IGST', { content: totalIgst.toFixed(2), styles: { halign: 'right' } }],
      ['Total Tax Amount', { content: (totalCgst + totalSgst + totalIgst).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
      [{ content: 'Total Amount after Tax', styles: { fontStyle: 'bold', fontSize: 10 } }, { content: totalAll.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } }],
      [{
        content: `Certified that the particulars given above are true and correct\n\nFor ${profile.companyName}\n\n\nAuthorised signatory`,
        colSpan: 2,
        styles: { halign: 'left', minCellHeight: 38, valign: 'top', fontStyle: 'normal' }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: { top: 0.5, bottom: 0.5, left: 0, right: 0.5 }, textColor: 0, fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: rightWidth * 0.65 }, 1: { cellWidth: rightWidth * 0.35 } }
  });
  const rightFooterY = doc.lastAutoTable.finalY;

  const sealY = Math.max(leftFooterY, rightFooterY) - 14;
  doc.setLineWidth(0.5);
  doc.rect(PDF_MARGIN + leftWidth * 0.3, sealY, 28, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Seal', PDF_MARGIN + leftWidth * 0.3 + 14, sealY + 9, { align: 'center' });

  drawOuterPageBorder(doc);
};

const PO_HEADER_FILL = [180, 200, 240];
const PO_ITEM_ROWS = 10;
const DEFAULT_PO_TERMS = '1. Delivery 10 days from the date of Purchase Order.\n2. Transportation Extra As Actual.\n3. 10 Years Warranty';

const calcPoSubtotal = (data) => {
  const saved = parseFloat(data.subtotal);
  if (!Number.isNaN(saved) && saved >= 0 && data.subtotal != null) return saved;
  const materialQty = parseFloat(data.qty) || 0;
  return Object.keys(data.charges || {}).reduce((sum, key) => {
    if (data.charges[key]) {
      const rowQty = getPdfChargeLineQty(data, key, materialQty);
      const rate = parseFloat(data.rates?.[key] || 0);
      return sum + rowQty * rate;
    }
    return sum;
  }, 0);
};

const buildPoItemDescription = (data) => {
  const name = (data.productName || '').toUpperCase();
  const specs = (data.productDescription || '').trim();
  return specs ? `${name}\n${specs}` : name;
};

const buildPurchaseOrderPDF = (doc, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const profile = getProfile(data);
  const gridMargin = { left: PDF_MARGIN, right: PDF_MARGIN };
  const gridStyles = {
    lineColor: [0, 0, 0],
    lineWidth: 0.5,
    textColor: 0,
    fontSize: 9,
    fontStyle: 'bold',
    cellPadding: 1.5
  };

  const headerEndY = drawPdfCompanyHeaderBoxed(doc, { profile, variant: 'po' });

  autoTable(doc, {
    startY: headerEndY,
    body: [[{ content: 'Purchase Order', styles: { halign: 'center', fontStyle: 'bold', fontSize: 16, fillColor: PO_HEADER_FILL } }]],
    theme: 'grid',
    styles: { ...gridStyles, cellPadding: 2 },
    margin: gridMargin
  });

  const docNo = data.poNo || 'N/A';
  const docDate = formatPdfDateDmy(data.date) || 'N/A';
  const refNo = data.partyDocNo || '';
  const refDate = formatPdfDateDmy(data.partyDocDate) || '';

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      ['PO No:', { content: docNo, styles: { fontStyle: 'bold' } }, 'Ref No.', { content: refNo, styles: { fontStyle: 'normal' } }],
      ['PO Date:', { content: docDate, styles: { fontStyle: 'bold' } }, 'Ref Date :', { content: refDate, styles: { fontStyle: 'normal' } }]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 56 }, 2: { cellWidth: 35 }, 3: { cellWidth: 56 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      ['State : GUJARAT', 'Code', '24', { content: '', styles: { lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 } } }, { content: '', colSpan: 2, styles: { lineWidth: { top: 0, bottom: 0.5, left: 0, right: 0.5 } } }]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: {
      0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
      3: { cellWidth: 35 }, 4: { cellWidth: 28 }, 5: { cellWidth: 28 }
    },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [[{ content: '', styles: { fillColor: PO_HEADER_FILL, minCellHeight: 6 } }]],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      ['Name :', data.partyName || ''],
      ['Address :', data.address || data.billAddress || ''],
      ['State:', data.state || 'GUJARAT'],
      ['GSTIN:', data.gstin || data.gstinBill || ''],
      ['', `Mo: ${data.mobile || ''} E: ${data.email || ''}`]
    ],
    theme: 'grid',
    styles: { ...gridStyles, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 45, halign: 'center' }, 1: { cellWidth: 'auto', fontStyle: 'normal' } },
    margin: gridMargin
  });

  const head = [
    [
      { content: 'S.\nNo.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PO_HEADER_FILL } },
      { content: 'Description', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PO_HEADER_FILL } },
      { content: 'Qty\nKg', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PO_HEADER_FILL } },
      { content: 'Rate', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PO_HEADER_FILL } },
      { content: 'Amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PO_HEADER_FILL } },
      { content: 'SGST', colSpan: 2, styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'CGST', colSpan: 2, styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'IGST', colSpan: 2, styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'Total', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PO_HEADER_FILL } }
    ],
    [
      { content: 'Rate', styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'Amount', styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'Rate', styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'Amount', styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'Rate', styles: { halign: 'center', fillColor: PO_HEADER_FILL } },
      { content: 'Amount', styles: { halign: 'center', fillColor: PO_HEADER_FILL } }
    ]
  ];

  const taxRate = parseFloat(data.taxRate) || 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const igstRate = 0;
  const qty = parseFloat(data.qty) || 0;
  let subtotal = calcPoSubtotal(data);
  const discount = parseFloat(data.discount) || 0;
  subtotal = Math.max(0, subtotal - discount);
  const rate = qty > 0 ? subtotal / qty : (parseFloat(data.rate) || 0);

  const sgstAmt = subtotal * (sgstRate / 100);
  const cgstAmt = subtotal * (cgstRate / 100);
  const igstAmt = subtotal * (igstRate / 100);
  const rowTotal = subtotal + sgstAmt + cgstAmt + igstAmt;

  let itemsBody = [];
  if (data.productName) {
    itemsBody.push([
      1,
      buildPoItemDescription(data),
      qty || '-',
      rate.toFixed(2),
      subtotal.toFixed(2),
      sgstRate, sgstAmt.toFixed(2),
      cgstRate, cgstAmt.toFixed(2),
      igstRate, igstAmt.toFixed(2),
      rowTotal.toFixed(2)
    ]);
  }

  for (let i = itemsBody.length; i < PO_ITEM_ROWS; i++) {
    itemsBody.push(['', '', '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']);
  }

  itemsBody.push([
    { content: 'Total', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: PO_HEADER_FILL } },
    qty || '',
    '',
    subtotal.toFixed(2),
    '', sgstAmt.toFixed(2),
    '', cgstAmt.toFixed(2),
    '', igstAmt.toFixed(2),
    rowTotal.toFixed(2)
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    head,
    body: itemsBody,
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: 0,
      fontSize: 8,
      cellPadding: 1.5,
      minCellHeight: 6,
      valign: 'top'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 17, halign: 'right' },
      5: { cellWidth: 8, halign: 'right' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 8, halign: 'right' },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 8, halign: 'right' },
      10: { cellWidth: 14, halign: 'right' },
      11: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    },
    margin: gridMargin
  });

  const tableY = doc.lastAutoTable.finalY;
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  const leftWidth = contentWidth * 0.58;
  const rightWidth = contentWidth * 0.42;

  const termsText = data.terms?.trim() && !['Standard PO Terms.', 'Standard PO Terms'].includes(data.terms.trim())
    ? data.terms
    : DEFAULT_PO_TERMS;

  autoTable(doc, {
    startY: tableY,
    tableWidth: leftWidth,
    margin: { left: PDF_MARGIN, right: 0 },
    body: [
      [{ content: 'Terms & Conditions:', styles: { fontStyle: 'bold', lineWidth: { top: 0.5, bottom: 0, left: 0.5, right: 0.5 } } }],
      [{ content: termsText, styles: { lineWidth: { top: 0, bottom: 0, left: 0.5, right: 0.5 }, minCellHeight: 52, valign: 'top', fontStyle: 'normal' } }],
      [{ content: 'this is system generated PO so no need to sign', styles: { fontStyle: 'bold', lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 } } }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 8, cellPadding: 2 }
  });
  const leftFooterY = doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY: tableY,
    tableWidth: rightWidth,
    margin: { left: PDF_MARGIN + leftWidth, right: PDF_MARGIN },
    body: [
      ['Total Amount before Tax', { content: subtotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
      ['CGST', { content: cgstAmt.toFixed(2), styles: { halign: 'right' } }],
      ['SGST', { content: sgstAmt.toFixed(2), styles: { halign: 'right' } }],
      ['IGST', { content: igstAmt.toFixed(2), styles: { halign: 'right' } }],
      ['Total Tax Amount', { content: (cgstAmt + sgstAmt + igstAmt).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
      [{ content: 'Total Amount after Tax', styles: { fontStyle: 'bold', fontSize: 10 } }, { content: rowTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } }],
      [{
        content: `Certified that the particulars given above are true and correct\n\nFor ${profile.companyName}\n\n\nAuthorised signatory`,
        colSpan: 2,
        styles: { halign: 'left', minCellHeight: 38, valign: 'top', fontStyle: 'normal' }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: { top: 0.5, bottom: 0.5, left: 0, right: 0.5 }, textColor: 0, fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: rightWidth * 0.65 }, 1: { cellWidth: rightWidth * 0.35 } }
  });
  const rightFooterY = doc.lastAutoTable.finalY;

  const sealY = Math.max(leftFooterY, rightFooterY) - 14;
  doc.setLineWidth(0.5);
  doc.rect(PDF_MARGIN + leftWidth * 0.3, sealY, 28, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Seal', PDF_MARGIN + leftWidth * 0.3 + 14, sealY + 9, { align: 'center' });

  drawOuterPageBorder(doc);
};

const getPdfProductLines = (data) => {
  if (data.productSummaries?.length) {
    return data.productSummaries.map(p => ({
      name: p.prodName || '',
      qty: parseFloat(p.qty) || 0
    })).filter(p => p.name);
  }
  if (data.productName?.includes(',')) {
    return data.productName.split(',').map(name => ({
      name: name.trim(),
      qty: 0
    })).filter(p => p.name);
  }
  if (data.productName) {
    return [{ name: data.productName, qty: parseFloat(data.qty) || 0 }];
  }
  return [];
};

const PI_PROCESSING_LABEL = 'Processing Charges';

const PI_HEADER_FILL = [180, 200, 240];
const PI_ITEM_ROWS = 11;
const PI_CHARGES_LIST = TI_CHARGES_LIST;

const buildPerformaInvoicePDF = (doc, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const profile = getProfile(data);
  const gridMargin = { left: PDF_MARGIN, right: PDF_MARGIN };
  const gridStyles = {
    lineColor: [0, 0, 0],
    lineWidth: 0.5,
    textColor: 0,
    fontSize: 9,
    fontStyle: 'bold',
    cellPadding: 1.5
  };

  const headerEndY = drawPdfCompanyHeaderBoxed(doc, { profile, variant: 'po' });

  autoTable(doc, {
    startY: headerEndY,
    body: [[{ content: 'Performa Invoice', styles: { halign: 'center', fontStyle: 'bold', fontSize: 16, fillColor: PI_HEADER_FILL } }]],
    theme: 'grid',
    styles: { ...gridStyles, cellPadding: 2 },
    margin: gridMargin
  });

  const docNo = data.invoiceNo || 'N/A';
  const docDate = formatPdfDateDmy(data.date) || 'N/A';
  const dcNo = data.dcNo || 'Verbal';
  const dcDate = formatPdfDateDmy(data.dcDate || data.date) || docDate;

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      ['PI No:', { content: docNo, styles: { fontStyle: 'bold' } }, 'Delivery Challan No.', { content: dcNo, styles: { fontStyle: 'normal' } }],
      ['PI Date:', { content: docDate, styles: { fontStyle: 'bold' } }, 'Date :', { content: dcDate, styles: { fontStyle: 'normal' } }]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 56 }, 2: { cellWidth: 35 }, 3: { cellWidth: 56 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      ['State : GUJARAT', 'Code', '24', { content: '', styles: { lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 } } }, { content: '', colSpan: 2, styles: { lineWidth: { top: 0, bottom: 0.5, left: 0, right: 0.5 } } }]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: {
      0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
      3: { cellWidth: 35 }, 4: { cellWidth: 28 }, 5: { cellWidth: 28 }
    },
    margin: gridMargin
  });

  const billState = data.billState || data.state || 'GUJARAT';
  const shipState = data.shipState || data.state || 'GUJARAT';
  const billCode = data.billStateCode || data.stateCode || '24';
  const shipCode = data.shipStateCode || data.stateCode || '24';

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [{ content: 'Bill to Party', styles: { halign: 'center', fillColor: PI_HEADER_FILL } }, { content: 'Ship to Party', styles: { halign: 'center', fillColor: PI_HEADER_FILL } }]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`Name :          ${data.partyName || ''}`, `Name :          ${data.shipName || data.partyName || ''}`]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`Address :\n${data.billAddress || data.address || ''}`, `Address :\n${data.shipAddress || data.address || ''}`]
    ],
    theme: 'grid',
    styles: { ...gridStyles, fontStyle: 'normal' },
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`State : ${billState}`, 'Code', billCode, `State : ${shipState}`, 'Code', shipCode]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: {
      0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
      3: { cellWidth: 60 }, 4: { cellWidth: 15 }, 5: { cellWidth: 16 }
    },
    margin: gridMargin
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    body: [
      [`GSTIN : ${data.gstinBill || data.gstin || ''}`, `GSTIN : ${data.gstinShip || data.gstin || ''}`]
    ],
    theme: 'grid',
    styles: gridStyles,
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    margin: gridMargin
  });

  const head = [
    [
      { content: 'S.\nNo.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PI_HEADER_FILL } },
      { content: 'Description', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PI_HEADER_FILL } },
      { content: 'Qty', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PI_HEADER_FILL } },
      { content: 'Rate', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PI_HEADER_FILL } },
      { content: 'Amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PI_HEADER_FILL } },
      { content: 'SGST', colSpan: 2, styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'CGST', colSpan: 2, styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'IGST', colSpan: 2, styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'Total', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: PI_HEADER_FILL } }
    ],
    [
      { content: 'Rate', styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'Amount', styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'Rate', styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'Amount', styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'Rate', styles: { halign: 'center', fillColor: PI_HEADER_FILL } },
      { content: 'Amount', styles: { halign: 'center', fillColor: PI_HEADER_FILL } }
    ]
  ];

  const taxRate = parseFloat(data.taxRate) || 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const igstRate = 0;
  const materialQty = parseFloat(data.qty) || 0;
  let itemsBody = [];
  let sno = 1;
  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalAll = 0;
  let totalQty = 0;

  const addItemRow = (desc, rowQty, rate, amt) => {
    const sgstAmt = amt * (sgstRate / 100);
    const cgstAmt = amt * (cgstRate / 100);
    const igstAmt = amt * (igstRate / 100);
    const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;
    const qtyDisplay = typeof rowQty === 'number'
      ? (Number.isInteger(rowQty) ? rowQty : rowQty.toFixed(2))
      : rowQty;
    itemsBody.push([
      sno++, desc, qtyDisplay,
      typeof rate === 'number' ? rate.toFixed(2) : rate,
      amt.toFixed(2),
      sgstRate, sgstAmt.toFixed(2), cgstRate, cgstAmt.toFixed(2), igstRate, igstAmt.toFixed(2), rowTotal.toFixed(2)
    ]);
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalIgst += igstAmt;
    totalAll += rowTotal;
    totalQty += typeof rowQty === 'number' ? rowQty : (parseFloat(rowQty) || 0);
  };

  const mergePdfLineItems = (lines) => {
    const merged = new Map();
    lines.forEach((line) => {
      const rate = parseFloat(line.rate) || 0;
      const descKey = (line.desc || '').trim().toLowerCase();
      const key = line.mergeKey
        ? `${descKey}|${rate.toFixed(2)}|${line.mergeKey}`
        : `${descKey}|${rate.toFixed(2)}`;
      const qty = parseFloat(line.rowQty) || 0;
      const amt = parseFloat(line.amt) || 0;
      if (merged.has(key)) {
        const prev = merged.get(key);
        prev.rowQty += qty;
        prev.amt += amt;
      } else {
        merged.set(key, { desc: line.desc, rowQty: qty, rate, amt });
      }
    });
    return Array.from(merged.values());
  };

  const pendingLines = [];
  const queueLine = (desc, rowQty, rate, amt, mergeKey = '') => {
    const qty = parseFloat(rowQty) || 0;
    const lineRate = parseFloat(rate) || 0;
    const lineAmt = parseFloat(amt) || 0;
    if (lineAmt <= 0 && qty <= 0) return;
    pendingLines.push({ desc, rowQty: qty, rate: lineRate, amt: lineAmt, mergeKey });
  };

  const productLines = getPdfProductLines(data);
  const normName = (s) => (s || '').trim().toLowerCase();

  const getOrderedProductChargeEntries = () => {
    const pcMap = data.productCharges || {};
    const chargeKeys = Object.keys(pcMap);
    const orderedNames = [];
    const seen = new Set();

    const addName = (name) => {
      if (!name) return;
      const nk = normName(name);
      if (seen.has(nk)) return;
      seen.add(nk);
      orderedNames.push(name);
    };

    productLines.forEach(p => addName(p.name));
    chargeKeys.forEach(k => addName(k));

    return orderedNames.map(name => {
      const chargeKey = chargeKeys.find(k => normName(k) === normName(name)) || name;
      return {
        prodName: chargeKey,
        pc: pcMap[chargeKey],
        summary: productLines.find(p => normName(p.name) === normName(name))
      };
    }).filter(entry => entry.pc);
  };

  if (data.productCharges && Object.keys(data.productCharges).length > 0) {
    getOrderedProductChargeEntries().forEach(({ prodName, pc, summary }) => {
      const prodQty = summary?.qty || 0;

      if (pc.charges?.processing) {
        const rate = parseFloat(pc.rates?.processing || 0);
        const lineQty = prodQty || parseFloat(pc.qtys?.processing) || 0;
        const amt = lineQty * rate;
        if (amt > 0 || lineQty > 0) {
          queueLine(PI_PROCESSING_LABEL, lineQty, rate, amt, normName(prodName));
        }
      }

      PI_CHARGES_LIST.filter(c => c.key !== 'processing').forEach((c) => {
        if (pc.charges?.[c.key]) {
          const rowQty = pc.qtys?.[c.key] != null && pc.qtys?.[c.key] !== ''
            ? (parseFloat(pc.qtys[c.key]) || 0)
            : 1;
          const rate = parseFloat(pc.rates?.[c.key] || 0);
          const amt = rowQty * rate;
          if (amt > 0) {
            queueLine(c.label, rowQty, rate, amt);
          }
        }
      });
    });
  } else {
  const procRate = parseFloat(data.rates?.processing || 0);
  if (data.charges?.processing && productLines.length) {
    productLines.forEach(({ name, qty }) => {
      const lineQty = qty || materialQty;
      const amt = lineQty * procRate;
      if (amt > 0 || lineQty > 0) {
        queueLine(PI_PROCESSING_LABEL, lineQty, procRate, amt, normName(name));
      }
    });
  } else if (data.charges?.processing) {
    const rowQty = getPdfChargeLineQty(data, 'processing', materialQty);
    const amt = rowQty * procRate;
    if (amt > 0) {
      queueLine(PI_PROCESSING_LABEL, rowQty, procRate, amt);
    }
  }

  PI_CHARGES_LIST.filter(c => c.key !== 'processing').forEach((c) => {
    if (data.charges?.[c.key]) {
      const rowQty = getPdfChargeLineQty(data, c.key, materialQty);
      const rate = parseFloat(data.rates?.[c.key] || 0);
      const amt = rowQty * rate;
      if (amt > 0) {
        queueLine(c.label, rowQty, rate, amt);
      }
    }
  });
  }

  if (data.customCharges?.length) {
    data.customCharges.forEach((cc) => {
      if (cc.checked) {
        const ccQty = parseFloat(cc.qty) || 1;
        const rate = parseFloat(cc.rate) || 0;
        const amt = ccQty * rate;
        if (amt > 0) {
          queueLine(cc.name || 'Custom Charge', ccQty, rate, amt);
        }
      }
    });
  }

  mergePdfLineItems(pendingLines).forEach((line) => {
    addItemRow(line.desc, line.rowQty, line.rate, line.amt);
  });

  const discount = parseFloat(data.discount) || 0;
  if (discount > 0) {
    itemsBody.push(['', 'Discount', '', '', `-${discount.toFixed(2)}`, '', '', '', '', '', '', `-${discount.toFixed(2)}`]);
    totalAmt -= discount;
    totalAll -= discount;
    totalSgst = totalAmt * (sgstRate / 100);
    totalCgst = totalAmt * (cgstRate / 100);
    totalIgst = totalAmt * (igstRate / 100);
    totalAll = totalAmt + totalSgst + totalCgst + totalIgst;
  }

  for (let i = itemsBody.length; i < PI_ITEM_ROWS; i++) {
    itemsBody.push(['', '', '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']);
  }

  itemsBody.push([
    { content: 'Total', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: PI_HEADER_FILL } },
    totalQty || '',
    '',
    totalAmt.toFixed(2),
    '', totalSgst.toFixed(2),
    '', totalCgst.toFixed(2),
    '', totalIgst.toFixed(2),
    totalAll.toFixed(2)
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    head,
    body: itemsBody,
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: 0,
      fontSize: 8,
      cellPadding: 1.5,
      minCellHeight: 6,
      valign: 'top'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 17, halign: 'right' },
      5: { cellWidth: 8, halign: 'right' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 8, halign: 'right' },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 8, halign: 'right' },
      10: { cellWidth: 14, halign: 'right' },
      11: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    },
    margin: gridMargin
  });

  const tableY = doc.lastAutoTable.finalY;
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  const leftWidth = contentWidth * 0.58;
  const rightWidth = contentWidth * 0.42;

  autoTable(doc, {
    startY: tableY,
    tableWidth: leftWidth,
    margin: { left: PDF_MARGIN, right: 0 },
    body: [
      [{ content: 'OUR BANK DETAILS', styles: { fontStyle: 'bold', lineWidth: { top: 0.5, bottom: 0, left: 0.5, right: 0.5 } } }],
      [{
        content: `Bank Name     : AXIS BANK LTD\nA/c Name      : ${profile.companyName}\nCurrent A/c No. : 916020061629671\nIFS CODE      : UTIB0000383\nBranch        : Nizampura`,
        styles: { lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 }, minCellHeight: 25, fontStyle: 'normal' }
      }],
      [{
        content: 'NOTE:\nPACKING MATERIALS AND TRANSPORTATION\nCHARGES WILL BE CHAGRE EXTRA AS ACTUAL',
        styles: { fontStyle: 'bold', minCellHeight: 15, lineWidth: { top: 0, bottom: 0, left: 0.5, right: 0.5 } }
      }],
      [{
        content: 'Terms & conditions\n1) Subject to vadodara Juridiction.\n2) Payment 100% ADVANCE AGAINST PI',
        styles: { fontStyle: 'bold', minCellHeight: 20, lineWidth: { top: 0, bottom: 0, left: 0.5, right: 0.5 } }
      }],
      [{
        content: 'this is system generated PI so no need to sign',
        styles: { fontStyle: 'bold', lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 } }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 8, cellPadding: 2 }
  });
  const leftFooterY = doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY: tableY,
    tableWidth: rightWidth,
    margin: { left: PDF_MARGIN + leftWidth, right: PDF_MARGIN },
    body: [
      ['Total Amount before Tax', { content: totalAmt.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
      ['CGST', { content: totalCgst.toFixed(2), styles: { halign: 'right' } }],
      ['SGST', { content: totalSgst.toFixed(2), styles: { halign: 'right' } }],
      ['IGST', { content: totalIgst.toFixed(2), styles: { halign: 'right' } }],
      ['Total Tax Amount', { content: (totalCgst + totalSgst + totalIgst).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
      [{ content: 'Total Amount after Tax', styles: { fontStyle: 'bold', fontSize: 10 } }, { content: totalAll.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } }],
      [{
        content: `Certified that the particulars given above are true and correct\n\nFor ${profile.companyName}\n\n\nAuthorised signatory`,
        colSpan: 2,
        styles: { halign: 'left', minCellHeight: 38, valign: 'top', fontStyle: 'normal' }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: { top: 0.5, bottom: 0.5, left: 0, right: 0.5 }, textColor: 0, fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: rightWidth * 0.65 }, 1: { cellWidth: rightWidth * 0.35 } }
  });
  const rightFooterY = doc.lastAutoTable.finalY;

  const sealY = Math.max(leftFooterY, rightFooterY) - 14;
  doc.setLineWidth(0.5);
  doc.rect(PDF_MARGIN + leftWidth * 0.3, sealY, 28, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Seal', PDF_MARGIN + leftWidth * 0.3 + 14, sealY + 9, { align: 'center' });

  drawOuterPageBorder(doc);
};

const buildFormattedInvoice = (doc, docType, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const isPI = docType === 'PI';
  const isPO = docType === 'PO';
  const profile = getProfile(data);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (!isPI && !isPO) {
    doc.text("Original\nDuplicate", pageWidth - 14, 12, { align: "right" });
  }

  drawPdfCompanyHeaderBoxed(doc, { profile });

  const titleText = isPO ? 'Purchase Order' : (isPI ? 'Performa Invoice' : 'Tax Invoice');
  const headerFill = (isPI || isPO) ? [180, 200, 240] : false;

  autoTable(doc, {
    startY: 45,
    body: [[{ content: titleText, styles: { halign: 'center', fontStyle: 'bold', fontSize: 16, fillColor: headerFill } }]],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, cellPadding: 2 },
    margin: { left: 14, right: 14 }
  });
  
  const docNo = data.invoiceNo || data.poNo || 'N/A';
  const docDate = data.date || 'N/A';
  const refNo = data.partyDocNo || data.challanNo || '';
  const refDate = data.partyDocDate || '';

  if (isPI || isPO) {
    const noLabel = isPO ? 'PO No:' : 'PI No:';
    const dateLabel = isPO ? 'PO Date:' : 'PI Date:';
    const refLabel = isPO ? 'Ref No.' : 'Delivery Challan No.';
    const rDateLabel = isPO ? 'Ref Date :' : 'Date :';
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        [noLabel, { content: docNo, styles: { fontStyle: 'bold' } }, refLabel, { content: isPO ? refNo : (data.dcNo || 'Verbal'), styles: { fontStyle: 'normal' } }],
        [dateLabel, { content: docDate, styles: { fontStyle: 'bold' } }, rDateLabel, { content: isPO ? refDate : (data.dcNo ? (data.dcDate || docDate) : ''), styles: { fontStyle: 'normal' } }]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 56 }, 2: { cellWidth: 35 }, 3: { cellWidth: 56 } },
      margin: { left: 14, right: 14 }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        ['State : GUJARAT', 'Code', '24', { content: '', styles: { lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 } } }, { content: '', colSpan: 2, styles: { lineWidth: { top: 0, bottom: 0.5, left: 0, right: 0.5 } } }]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 
        0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
        3: { cellWidth: 35 }, 4: { cellWidth: 28 }, 5: { cellWidth: 28 } 
      },
      margin: { left: 14, right: 14 }
    });
  } else {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        ['Invoice No:', { content: docNo, styles: { fontStyle: 'bold' } }, 'Invoice Date:', { content: docDate, styles: { fontStyle: 'bold' } }],
        ['Delivery Challan No.', data.dcNo || '', 'Date :', data.dcDate || ''],
        [{ content: '', styles: { lineWidth: { top: 0, bottom: 0, left: 0.5, right: 0.5 } } }, { content: '', styles: { lineWidth: { top: 0, bottom: 0, left: 0, right: 0.5 } } }, 'PO No./Challan No.', `${refNo}`]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 56 }, 2: { cellWidth: 35 }, 3: { cellWidth: 56 } },
      margin: { left: 14, right: 14 }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        ['State : GUJARAT', 'Code', '24', 'Date :', { content: refDate || '', colSpan: 2 }]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 
        0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
        3: { cellWidth: 35 }, 4: { cellWidth: 28 }, 5: { cellWidth: 28 } 
      },
      margin: { left: 14, right: 14 }
    });
  }

  if (isPO) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [[{ content: '', styles: { fillColor: headerFill, minCellHeight: 6 } }]],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
      margin: { left: 14, right: 14 }
    });
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        ['Name :', data.partyName || ''],
        ['Address :', data.address || data.billAddress || ''],
        ['State:', data.state || 'GUJARAT'],
        ['GSTIN:', data.gstin || ''],
        ['', `Mo: ${data.mobile || ''} E: ${data.email || ''}`]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, cellPadding: 1.5, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 45, halign: 'center' }, 1: { cellWidth: 'auto', fontStyle: 'normal' } },
      margin: { left: 14, right: 14 }
    });
  } else {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        [{ content: 'Bill to Party', styles: { halign: 'center', fillColor: headerFill } }, { content: 'Ship to Party', styles: { halign: 'center', fillColor: headerFill } }]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
      margin: { left: 14, right: 14 }
    });
  }

  if (!isPO) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        [`Name :          ${data.partyName || ''}`, `Name :          ${data.shipName || data.partyName || ''}`]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
      margin: { left: 14, right: 14 }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        [`Address :\n${data.billAddress || data.address || ''}`, `Address :\n${data.shipAddress || data.address || ''}`]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'normal', cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
      margin: { left: 14, right: 14 }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        ['State : GUJARAT', 'Code', '24', 'State : GUJARAT', 'Code', '24']
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 
        0: { cellWidth: 60 }, 1: { cellWidth: 15 }, 2: { cellWidth: 16 },
        3: { cellWidth: 60 }, 4: { cellWidth: 15 }, 5: { cellWidth: 16 }
      },
      margin: { left: 14, right: 14 }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [
        [`GSTIN : ${data.gstinBill || data.gstin || ''}`, `GSTIN : ${data.gstinShip || data.gstin || ''}`]
      ],
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
      margin: { left: 14, right: 14 }
    });
  }

  const head = [
    [
      { content: 'S.\nNo.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: headerFill } },
      { content: 'Description', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: headerFill } },
      { content: (isPO || isPI) ? 'Qty\nKg' : 'Qty', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: headerFill } },
      { content: 'Rate', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: headerFill } },
      { content: 'Amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: headerFill } },
      { content: 'SGST', colSpan: 2, styles: { halign: 'center', fillColor: headerFill } },
      { content: 'CGST', colSpan: 2, styles: { halign: 'center', fillColor: headerFill } },
      { content: 'IGST', colSpan: 2, styles: { halign: 'center', fillColor: headerFill } },
      { content: 'Total', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: headerFill } }
    ],
    [
      { content: 'Rate', styles: { halign: 'center', fillColor: headerFill } },
      { content: 'Amount', styles: { halign: 'center', fillColor: headerFill } },
      { content: 'Rate', styles: { halign: 'center', fillColor: headerFill } },
      { content: 'Amount', styles: { halign: 'center', fillColor: headerFill } },
      { content: 'Rate', styles: { halign: 'center', fillColor: headerFill } },
      { content: 'Amount', styles: { halign: 'center', fillColor: headerFill } }
    ]
  ];

  let itemsBody = [];
  let sno = 1;
  let totalAmt = 0, totalSgst = 0, totalCgst = 0, totalIgst = 0, totalAll = 0;
  
  const taxRate = parseFloat(data.taxRate) || 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const igstRate = 0;
  let totalQty = 0;

  if (isPO && data.productName) {
      const qty = parseFloat(data.qty) || 0;
      const rate = parseFloat(data.rate) || 0;
      const amt = qty * rate > 0 ? (qty * rate) : (data.amount || 0);
      const isTaxable = amt > 0;
      
      const sgstAmt = isTaxable ? amt * (sgstRate / 100) : 0;
      const cgstAmt = isTaxable ? amt * (cgstRate / 100) : 0;
      const igstAmt = isTaxable ? amt * (igstRate / 100) : 0;
      const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;

      itemsBody.push([
        sno++, data.productName, qty || '-', rate > 0 ? rate.toFixed(2) : '0.00', amt.toFixed(2),
        sgstRate, sgstAmt.toFixed(2), cgstRate, cgstAmt.toFixed(2), igstRate, igstAmt.toFixed(2), rowTotal.toFixed(2)
      ]);
      totalAmt += amt;
      totalSgst += sgstAmt;
      totalCgst += cgstAmt;
      totalIgst += igstAmt;
      totalAll += rowTotal;
      totalQty += qty;
  }

  if (data.customCharges && data.customCharges.length > 0) {
    data.customCharges.forEach(cc => {
       if (cc.checked) {
          const qty = parseFloat(cc.qty) || 1;
          const rate = parseFloat(cc.rate) || 0;
          const amt = qty * rate;
          const sgstAmt = amt * (sgstRate / 100);
          const cgstAmt = amt * (cgstRate / 100);
          const igstAmt = amt * (igstRate / 100);
          const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;

          itemsBody.push([
            sno++, cc.name, qty.toFixed(0), rate.toFixed(2), amt.toFixed(2),
            sgstRate, sgstAmt.toFixed(2), cgstRate, cgstAmt.toFixed(2),
            igstRate, igstAmt.toFixed(2), rowTotal.toFixed(2)
          ]);
          if (cc.hsn) {
            itemsBody.push(['', `HSN CODE : ${cc.hsn}`, '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']);
          }
          totalAmt += amt;
          totalSgst += sgstAmt;
          totalCgst += cgstAmt;
          totalIgst += igstAmt;
          totalAll += rowTotal;
          totalQty += qty;
       }
    });
  }

  const chargesList = [
    { key: 'cleaning', label: 'Minimum Cleaning Charges' },
    { key: 'processing', label: 'Processing Charges' },
    { key: 'psdReport', label: 'Particle size report charges' },
    { key: 'filterBag', label: 'Filter Bag' },
    { key: 'sieving', label: 'Sieving Charges' },
    { key: 'liner', label: 'Liner' },
    { key: 'courier', label: 'Courier' },
    { key: 'fiberDrum', label: 'Fiber Drum' },
    { key: 'transportation', label: 'Transportation' },
    { key: 'hdpeDrum', label: 'HDPE Drum' },
    { key: 'batchChangeover', label: 'Batch Changeover' }
  ];

  chargesList.forEach(c => {
     if (data.charges && data.charges[c.key]) {
        const isQty = ['cleaning', 'processing', 'sieving'].includes(c.key);
        const qty = isQty ? (parseFloat(data.qty) || 1) : 1;
        const rate = parseFloat(data.rates?.[c.key] || 0);
        const amt = qty * rate;
        if (amt > 0) {
          const sgstAmt = amt * (sgstRate / 100);
          const cgstAmt = amt * (cgstRate / 100);
          const igstAmt = amt * (igstRate / 100);
          const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;
          
          itemsBody.push([
            sno++, c.label, isQty ? qty.toFixed(0) : '1', rate.toFixed(2), amt.toFixed(2),
            sgstRate, sgstAmt.toFixed(2), cgstRate, cgstAmt.toFixed(2),
            igstRate, igstAmt.toFixed(2), rowTotal.toFixed(2)
          ]);
          
          totalAmt += amt;
          totalSgst += sgstAmt;
          totalCgst += cgstAmt;
          totalIgst += igstAmt;
          totalAll += rowTotal;
          totalQty += (isQty ? qty : 1);
        }
     }
  });

  const discount = parseFloat(data.discount) || 0;
  if (discount > 0) {
      itemsBody.push([ '', 'Discount', '', '', `-${discount.toFixed(2)}`, '', '', '', '', '', '', `-${discount.toFixed(2)}` ]);
      totalAmt -= discount;
      totalAll -= discount;
      totalSgst = totalAmt * (sgstRate / 100);
      totalCgst = totalAmt * (cgstRate / 100);
      totalIgst = totalAmt * (igstRate / 100);
      totalAll = totalAmt + totalSgst + totalCgst + totalIgst;
  }

  for(let i = itemsBody.length; i < 11; i++) {
      itemsBody.push(['', '', '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']);
  }

  itemsBody.push([
    { content: 'Total', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: headerFill } },
    totalQty,
    '',
    totalAmt.toFixed(2),
    '', totalSgst.toFixed(2),
    '', totalCgst.toFixed(2),
    '', totalIgst.toFixed(2),
    totalAll.toFixed(2)
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY,
    head: head,
    body: itemsBody,
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 8, cellPadding: 1.5, minCellHeight: 6, valign: 'top' },
    columnStyles: { 
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 17, halign: 'right' },
      5: { cellWidth: 8, halign: 'right' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 8, halign: 'right' },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 8, halign: 'right' },
      10: { cellWidth: 14, halign: 'right' },
      11: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  const tableY = doc.lastAutoTable.finalY;
  const leftWidth = (pageWidth - 28) * 0.58;
  const rightWidth = (pageWidth - 28) * 0.42;

  let leftBody = [];
  if (isPI) {
    leftBody = [
      [{ content: 'OUR BANK DETAILS', styles: { fontStyle: 'bold', lineWidth: { top: 0.5, bottom: 0, left: 0.5, right: 0.5 } } }],
      [{ content: `Bank Name     : AXIS BANK LTD\nA/c Name      : ${profile.companyName}\nCurrent A/c No. : 916020061629671\nIFS CODE      : UTIB0000383\nBranch        : Nizampura`, styles: { lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 }, minCellHeight: 25 } }],
      [{ content: 'NOTE:\nPACKING MATERIALS AND TRANSPORTATION\nCHARGES WILL BE CHAGRE EXTRA AS ACTUAL', styles: { fontStyle: 'bold', minCellHeight: 15 } }],
      [{ content: 'Terms & conditions\n1) Subject to vadodara Juridiction.\n2) Payment 100% ADVANCE AGAINST PI\nthis is system generated PI so no need to sign', styles: { fontStyle: 'bold', minCellHeight: 20 } }]
    ];
  } else if (isPO) {
    leftBody = [
      [{ content: 'Terms & Conditions:', styles: { fontStyle: 'bold', lineWidth: { top: 0.5, bottom: 0, left: 0.5, right: 0.5 } } }],
      [{ content: `${data.terms || '1. Delivery 10 days from the date of Purchase Order.\n2. Transportation Extra As Actual.\n3. 10 Years Warranty'}`, styles: { lineWidth: { top: 0, bottom: 0, left: 0.5, right: 0.5 }, minCellHeight: 52, valign: 'top' } }],
      [{ content: 'this is system generated PO so no need to sign', styles: { fontStyle: 'bold', lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 } } }]
    ];
  } else {
    leftBody = [
      [{ content: 'OUR BANK DETAILS', styles: { fontStyle: 'bold', lineWidth: { top: 0.5, bottom: 0, left: 0.5, right: 0.5 } } }],
      [{ content: `Bank Name     : AXIS BANK LTD\nA/c Name      : ${profile.companyName}\nCurrent A/c No. : 916020061629671\nIFS CODE      : UTIB0000383\nBranch        : Nizampura`, styles: { lineWidth: { top: 0, bottom: 0.5, left: 0.5, right: 0.5 }, minCellHeight: 25 } }],
      [{ content: 'Terms & conditions\n1) Subject to vadodara Juridiction.\n2) Payment Term as per our agree terms.\n3) Interest will charged @ 24% per annum if\namount remaining unpaid from due date.', styles: { minCellHeight: 35 } }]
    ];
  }

  autoTable(doc, {
    startY: tableY,
    tableWidth: leftWidth,
    margin: { left: 14, right: 0 },
    body: leftBody,
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: 0, fontSize: 8, cellPadding: 2 }
  });

  const summaryBody = [
    ['Total Amount before Tax', { content: totalAmt.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
    ['CGST', { content: totalCgst.toFixed(2), styles: { halign: 'right' } }],
    ['SGST', { content: totalSgst.toFixed(2), styles: { halign: 'right' } }],
    ['IGST', { content: totalIgst.toFixed(2), styles: { halign: 'right' } }],
    ['Total Tax Amount', { content: (totalCgst + totalSgst + totalIgst).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }],
    [{ content: 'Total Amount after Tax', styles: { fontStyle: 'bold', fontSize: 10 } }, { content: totalAll.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } }],
    [{ content: `Certified that the particulars given above are true and correct\n\n                       For ${profile.companyName}\n\n\n\n\nSeal                                 Authorised signatory`, colSpan: 2, styles: { halign: 'left', minCellHeight: 38 } }]
  ];

  autoTable(doc, {
    startY: tableY,
    tableWidth: rightWidth,
    margin: { left: 14 + leftWidth, right: 14 },
    body: summaryBody,
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: { top: 0.5, bottom: 0.5, left: 0, right: 0.5 }, textColor: 0, fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: rightWidth * 0.65 }, 1: { cellWidth: rightWidth * 0.35 } }
  });
};

const buildPDF = (docType, data) => {
  const doc = new jsPDF();
  let docNo = data.invoiceNo || data.bprNo || data.plNo || data.dcNo || data.psdNo || data.receiptNo || data.noteNo || 'N/A';
  
  if (docType === 'TI') {
    buildTaxInvoicePDF(doc, data);
    docNo = data.invoiceNo || 'N/A';
  } else if (docType === 'PO') {
    buildPurchaseOrderPDF(doc, data);
    docNo = data.poNo || 'N/A';
  } else if (docType === 'PI') {
    buildPerformaInvoicePDF(doc, data);
    docNo = data.invoiceNo || 'N/A';
  } else if (docType === 'BPR') {
    buildBPR(doc, data);
    docNo = data.bprNo || 'N/A';
  } else {
    buildOldLogic(doc, docType, data);
  }

  return { doc, docNo };
};

// Paste back the old logic for remaining doc types
const buildOldLogic = (doc, docType, data) => {
  const profile = getProfile(data);
  doc.setTextColor(0, 0, 0);
  drawCompanyLogo(doc, 15, 8, profile);
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

  let yPos = 55;
  doc.setFontSize(14);
  doc.text(docType === 'DC' ? 'Delivery Challan' : docType, 15, yPos);
  yPos += 15;

  if (docType === 'PL' && data.batches) {
    const parseWt = (v) => (v === '' || v === undefined || v === null ? 0 : parseFloat(v) || 0);
    const groups = {};
    const groupOrder = [];
    data.batches.forEach((b) => {
      const key = b.batchNo || 'Unknown';
      if (!groups[key]) {
        groups[key] = { gross: 0, tare: 0, net: 0, drums: 0 };
        groupOrder.push(key);
      }
      const net = b.net !== '' && b.net !== undefined ? parseWt(b.net) : Math.max(0, parseWt(b.gross) - parseWt(b.tare));
      groups[key].gross += parseWt(b.gross);
      groups[key].tare += parseWt(b.tare);
      groups[key].net += net;
      groups[key].drums += 1;
    });

    const plBody = [];
    let sr = 1;
    let grandGross = 0, grandTare = 0, grandNet = 0;

    groupOrder.forEach((key) => {
      data.batches.filter(b => (b.batchNo || 'Unknown') === key).forEach((b) => {
        const net = b.net !== '' && b.net !== undefined ? parseWt(b.net) : Math.max(0, parseWt(b.gross) - parseWt(b.tare));
        plBody.push([sr++, b.batchNo, b.drumNo, b.gross !== '' && b.gross !== undefined ? `${b.gross} Kg` : '', b.tare !== '' && b.tare !== undefined ? `${b.tare} Kg` : '', net > 0 ? `${net.toFixed(2)} Kg` : '']);
      });
      const g = groups[key];
      plBody.push([
        { content: `Batch ${key} Total (${g.drums} Drums)`, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [230, 245, 235] } },
        { content: g.gross > 0 ? `${g.gross.toFixed(2)} Kg` : '', styles: { fontStyle: 'bold' } },
        { content: g.tare > 0 ? `${g.tare.toFixed(2)} Kg` : '', styles: { fontStyle: 'bold' } },
        { content: g.net > 0 ? `${g.net.toFixed(2)} Kg` : '', styles: { fontStyle: 'bold' } }
      ]);
      grandGross += g.gross;
      grandTare += g.tare;
      grandNet += g.net;
    });

    plBody.push([
      { content: `ALL BATCHES GRAND TOTAL (${data.batches.length} Drums)`, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [200, 220, 250] } },
      { content: grandGross > 0 ? `${grandGross.toFixed(2)} Kg` : '', styles: { fontStyle: 'bold' } },
      { content: grandTare > 0 ? `${grandTare.toFixed(2)} Kg` : '', styles: { fontStyle: 'bold' } },
      { content: grandNet > 0 ? `${grandNet.toFixed(2)} Kg` : '', styles: { fontStyle: 'bold' } }
    ]);

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
  const enriched = { ...data, companyProfile: data?.companyProfile || getStoredCompanyProfile() };
  const { doc, docNo } = buildPDF(docType, enriched);
  doc.save(`${docType}_${docNo}.pdf`);
};

export const viewPDF = (docType, data) => {
  const enriched = { ...data, companyProfile: data?.companyProfile || getStoredCompanyProfile() };
  const { doc, docNo } = buildPDF(docType, enriched);
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
