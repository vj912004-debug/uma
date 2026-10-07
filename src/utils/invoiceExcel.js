import ExcelJS from 'exceljs';
import { mergeCompanyProfile, formatCompanyAddressLines, getContactLine, getBankDetailRows, getStoredCompanyProfile } from './companyProfile';
import {
  buildTiPrintChargeRows,
  getSplitGstRates,
  formatPdfDateDmy,
  splitPartyAddressLines
} from './taxInvoiceLayout';
import { calcNoteLines } from './debitCreditNoteHtml';
import {
  DEFAULT_PI_NOTE,
  DEFAULT_PI_TERMS,
  DEFAULT_INVOICE_TERMS,
  DEFAULT_PO_TERMS,
  DEFAULT_INVOICE_DECLARATION,
  isPlaceholderInvoiceTerms
} from './printTheme';

const fileName = (docType, data) => {
  const raw = data?.invoiceNo || data?.poNo || data?.noteNo || data?.dcNo || data?.quotationNo || docType || 'Document';
  return String(raw).replace(/[\\/:*?"<>|]+/g, '-');
};

const PURPLE = 'FF5B1C85';
const FILL = 'FF5B1C85';
const WHITE = 'FFFFFFFF';
const TEXT = 'FF000000';
const LINE = 'FF000000';
const COLS = 12;
const FONT = 'Times New Roman';

const thin = { style: 'thin', color: { argb: LINE } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const moneyFmt = '#,##0.00';

const paint = (cell, { value, font, fill, align, numFmt, border: cellBorder } = {}) => {
  if (value !== undefined) cell.value = value;
  if (font) cell.font = font;
  if (fill) cell.fill = fill;
  if (align) cell.alignment = align;
  if (numFmt) cell.numFmt = numFmt;
  if (cellBorder) cell.border = cellBorder;
};

const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const applyRange = (ws, r1, c1, r2, c2, style) => {
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const cell = ws.getCell(r, c);
      if (style.font) cell.font = style.font;
      if (style.fill) cell.fill = style.fill;
      if (style.align) cell.alignment = style.align;
      if (style.border) cell.border = style.border;
    }
  }
};

const merge = (ws, r1, c1, r2, c2, value, style = {}) => {
  if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2);
  applyRange(ws, r1, c1, r2, c2, style);
  const cell = ws.getCell(r1, c1);
  paint(cell, { value, ...style });
  return cell;
};

const money = (n) => {
  const v = parseFloat(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
};

const termLines = (terms, fallback) => {
  const raw = isPlaceholderInvoiceTerms(terms) ? '' : String(terms || '').trim();
  const source = raw ? raw.split(/\r?\n/) : fallback;
  const lines = source
    .map((line) => String(line || '').replace(/^\s*\d{1,2}[.)]\s*/, '').trim())
    .filter(Boolean);
  return (lines.length ? lines : fallback).map((line, i) => `${i + 1}. ${line}`);
};

const invoiceLines = (data, docType) => {
  const type = String(docType || '').toUpperCase();
  if (type === 'DN' || type === 'CN') {
    const note = calcNoteLines(data);
    const ratio = note.discount > 0 && note.grossAmt > 0 ? note.totalAmt / note.grossAmt : 1;
    const lines = note.rows.map((row) => {
      const amt = row.amt * ratio;
      const sgstAmt = row.sgstAmt * ratio;
      const cgstAmt = row.cgstAmt * ratio;
      const igstAmt = row.igstAmt * ratio;
      return {
        desc: row.label,
        qty: row.qty,
        rate: row.rate,
        amt,
        sgstAmt,
        cgstAmt,
        igstAmt,
        total: amt + sgstAmt + cgstAmt + igstAmt,
        sgstRate: amt > 0 ? (Number(row.sgstRate) || 0) : '',
        cgstRate: amt > 0 ? (Number(row.cgstRate) || 0) : '',
        igstRate: amt > 0 ? (Number(row.igstRate) || 0) : ''
      };
    });
    return {
      lines,
      taxRate: note.taxRate,
      displayRate: note.displayRate,
      totalAmt: note.totalAmt,
      totalSgst: note.totalSgst,
      totalCgst: note.totalCgst,
      totalIgst: note.totalIgst,
      totalQty: note.totalQty,
      discount: note.discount,
      grand: note.totalAll,
      rounded: note.roundedTotal,
      roundOff: note.roundOff
    };
  }
  const { taxRate, displayRate, sgst, cgst, igst } = getSplitGstRates(data);
  const lines = [];
  const push = (desc, qty, rate, amt) => {
    const label = String(desc || '').trim();
    const lineAmt = parseFloat(amt) || 0;
    const lineQty = Number.isFinite(parseFloat(qty)) ? parseFloat(qty) : 0;
    const lineRate = parseFloat(rate) || 0;
    if (!label && lineAmt <= 0 && lineQty === 0 && lineRate === 0) return;
    if (/^\s*total\s*$/i.test(label)) return;
    lines.push({
      desc: label.replace(/\(\d+\)$/, '').trim(),
      qty: lineQty,
      rate: lineRate,
      amt: lineAmt
    });
  };

  if (type === 'PO' && String(data.productName || '').trim()) {
    const qty = parseFloat(data.qty) || 0;
    const rate = parseFloat(data.rate) || 0;
    const amt = qty * rate > 0 ? qty * rate : (parseFloat(data.amount) || 0);
    const specs = String(data.productDescription || '').trim();
    push(specs ? `${data.productName} - ${specs}` : data.productName, qty, rate, amt);
  }

  buildTiPrintChargeRows(data).forEach((row) => push(row.label, row.qty, row.rate, row.amt));
  (data.customCharges || []).forEach((cc) => {
    if (!cc.checked) return;
    const rawQty = cc.qty;
    const ccQty = parseFloat(rawQty);
    const qty = (rawQty === '' || rawQty == null || !Number.isFinite(ccQty) || ccQty === 0) ? 0 : ccQty;
    const rate = parseFloat(cc.rate) || 0;
    const name = String(cc.name || '').trim();
    if (!name) return;
    push(name, qty, rate, qty * rate);
  });

  let totalAmt = lines.reduce((sum, row) => sum + row.amt, 0);
  const discount = parseFloat(data.discount) || 0;
  if (discount > 0 && totalAmt > 0) {
    const ratio = Math.max(0, totalAmt - discount) / totalAmt;
    totalAmt = Math.max(0, totalAmt - discount);
    lines.forEach((row) => { row.amt *= ratio; });
  }

  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalQty = 0;
  lines.forEach((row) => {
    row.sgstAmt = row.amt * (sgst / 100);
    row.cgstAmt = row.amt * (cgst / 100);
    row.igstAmt = row.amt * (igst / 100);
    row.total = row.amt + row.sgstAmt + row.cgstAmt + row.igstAmt;
    row.sgstRate = row.amt > 0 ? sgst : '';
    row.cgstRate = row.amt > 0 ? cgst : '';
    row.igstRate = row.amt > 0 ? igst : '';
    totalSgst += row.sgstAmt;
    totalCgst += row.cgstAmt;
    totalIgst += row.igstAmt;
    totalQty += row.qty || 0;
  });
  const grand = totalAmt + totalSgst + totalCgst + totalIgst;
  const rounded = Math.round(grand);
  return {
    lines,
    taxRate,
    displayRate,
    totalAmt,
    totalSgst,
    totalCgst,
    totalIgst,
    totalQty,
    discount,
    grand,
    rounded,
    roundOff: rounded - grand
  };
};

const partyBlock = (data, side) => {
  const bill = side === 'bill';
  const name = bill ? (data.partyName || '') : (data.shipName || data.partyName || '');
  const address = bill
    ? (data.billAddress || data.address || '')
    : (data.shipAddress || data.address || '');
  return {
    name,
    lines: splitPartyAddressLines(address, 42).slice(0, 4),
    gstin: bill ? (data.gstinBill || data.gstin || '') : (data.gstinShip || data.gstin || ''),
    state: bill ? (data.billState || data.state || '') : (data.shipState || data.state || ''),
    code: bill ? (data.billStateCode || data.stateCode || '') : (data.shipStateCode || data.stateCode || '')
  };
};

const DOC_TITLES = {
  PI: 'Performa Invoice',
  TI: 'Tax Invoice',
  PO: 'Purchase Order',
  DN: 'Debit Note',
  CN: 'Credit Note'
};

const fallbackTerms = (type) => {
  if (type === 'PI') return DEFAULT_PI_TERMS;
  if (type === 'PO') return DEFAULT_PO_TERMS;
  return DEFAULT_INVOICE_TERMS;
};

const docMeta = (type, data) => {
  const docDate = formatPdfDateDmy(data.date) || '';
  if (type === 'PO') {
    return {
      noLabel: 'PO No:',
      no: data.poNo || '',
      dateLabel: 'PO Date:',
      date: docDate,
      sideLabel: 'Party Doc No.',
      side: data.partyDocNo || '',
      sideDate: formatPdfDateDmy(data.partyDocDate) || ''
    };
  }
  if (type === 'DN' || type === 'CN') {
    return {
      noLabel: type === 'DN' ? 'Debit Note No:' : 'Credit Note No:',
      no: data.noteNo || '',
      dateLabel: 'Date:',
      date: docDate,
      sideLabel: 'Invoice No.',
      side: data.refInvoice || '',
      sideDate: formatPdfDateDmy(data.refInvoiceDate || data.invoiceDate) || ''
    };
  }
  return {
    noLabel: type === 'PI' ? 'PI No:' : 'Invoice No:',
    no: data.invoiceNo || '',
    dateLabel: type === 'PI' ? 'PI Date:' : 'Invoice Date:',
    date: docDate,
    sideLabel: 'Delivery Challan No.',
    side: data.dcNo || '',
    sideDate: formatPdfDateDmy(data.dcDate) || ''
  };
};

export const appendInvoiceWorksheet = (wb, docType, raw, customSheetName, usedNames = new Set()) => {
  const data = raw || {};
  const type = String(docType || data.docType || '').toUpperCase();
  const isPI = type === 'PI';
  const title = DOC_TITLES[type] || (type === 'DC' ? 'Delivery Challan' : type === 'QUOTATION' ? 'Quotation' : 'Invoice');
  const profile = mergeCompanyProfile(data.companyProfile || getStoredCompanyProfile());
  const totals = invoiceLines(data, type);
  const bill = partyBlock(data, 'bill');
  const ship = partyBlock(data, 'ship');
  const meta = docMeta(type, data);
  const addressLines = formatCompanyAddressLines(profile);
  const contact = getContactLine(profile);
  const packingNote = isPI ? DEFAULT_PI_NOTE : '';
  const terms = termLines(data.terms, fallbackTerms(type))
    .map((line) => line.replace(/^\s*\d{1,2}[.)]\s*/, ''))
    .filter((line) => !(packingNote && /packing materials and transportation/i.test(line)))
    .map((line, i) => `${i + 1}) ${line}`);

  const rawName = customSheetName || meta.no || data.invoiceNo || data.poNo || data.noteNo || data.dcNo || data.quotationNo || title;
  const baseName = String(rawName).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Bill';
  let sheetTitle = baseName;
  for (let i = 2; usedNames.has(sheetTitle.toLowerCase()); i += 1) {
    const suffix = ` (${i})`;
    sheetTitle = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
  }
  usedNames.add(sheetTitle.toLowerCase());

  const ws = wb.addWorksheet(sheetTitle, {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0, footer: 0 }
    }
  });
  ws.columns = [
    { width: 6 }, { width: 28 }, { width: 8 }, { width: 10 },
    { width: 12 }, { width: 8 }, { width: 12 }, { width: 8 },
    { width: 12 }, { width: 8 }, { width: 12 }, { width: 14 }
  ];

  const companyFont = { name: FONT, size: 18, bold: true, color: { argb: TEXT } };
  const titleFont = { name: FONT, size: 14, bold: true, color: { argb: WHITE } };
  const headLabelFont = { name: FONT, size: 10, bold: true, color: { argb: WHITE } };
  const labelFont = { name: FONT, size: 10, bold: true, color: { argb: TEXT } };
  const bodyFont = { name: FONT, size: 10, color: { argb: TEXT } };
  const smallFont = { name: FONT, size: 9, color: { argb: TEXT } };
  const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const left = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const topLeft = { vertical: 'top', horizontal: 'left', wrapText: true };
  const right = { vertical: 'middle', horizontal: 'right' };
  const fillHead = { font: headLabelFont, fill: solid(FILL), align: center, border };

  const companyLines = [
    profile.companyName || 'UMA MICRON',
    ...addressLines,
    contact,
    profile.gstNumber ? `GSTIN: ${profile.gstNumber}` : ''
  ].filter(Boolean);

  let r = 1;
  const headerCell = merge(ws, r, 1, r, COLS, {
    richText: [
      { text: `${companyLines[0]}\n`, font: companyFont },
      { text: companyLines.slice(1).join('\n'), font: bodyFont }
    ]
  }, { align: center, border });
  headerCell.alignment = center;
  ws.getRow(r).height = 78;
  r += 1;

  merge(ws, r, 1, r, COLS, title.toUpperCase(), { font: titleFont, fill: solid(FILL), align: center, border });
  ws.getRow(r).height = 24;
  r += 1;

  merge(ws, r, 1, r, 2, meta.noLabel, { font: labelFont, align: left, border });
  merge(ws, r, 3, r, 6, meta.no || '', { font: bodyFont, align: left, border });
  merge(ws, r, 7, r, 9, meta.sideLabel, { font: labelFont, align: center, border });
  merge(ws, r, 10, r, COLS, meta.side || '', { font: bodyFont, align: center, border });
  r += 1;
  merge(ws, r, 1, r, 2, meta.dateLabel, { font: labelFont, align: left, border });
  merge(ws, r, 3, r, 6, meta.date || '', { font: bodyFont, align: left, border });
  merge(ws, r, 7, r, 9, 'Date :', { font: labelFont, align: center, border });
  merge(ws, r, 10, r, COLS, meta.sideDate || '', { font: bodyFont, align: center, border });
  r += 1;
  merge(ws, r, 1, r, 6, `State : ${bill.state || profile.state || ''}`, { font: labelFont, align: left, border });
  merge(ws, r, 7, r, 9, 'Code', { font: labelFont, align: center, border });
  merge(ws, r, 10, r, COLS, bill.code || String(profile.gstNumber || '').slice(0, 2), { font: bodyFont, align: center, border });
  r += 1;

  merge(ws, r, 1, r, 6, 'BILL TO', fillHead);
  merge(ws, r, 7, r, COLS, 'SHIP TO', fillHead);
  r += 1;

  const addressRows = (party) => {
    const lines = [...party.lines];
    while (lines.length < 3) lines.push('');
    return lines.slice(0, 3);
  };
  const billAddr = addressRows(bill);
  const shipAddr = addressRows(ship);
  const partyRows = [
    ['Name :', bill.name, 'Name :', ship.name],
    ['Address :', billAddr[0], 'Address :', shipAddr[0]],
    ['', billAddr[1], '', shipAddr[1]],
    ['', billAddr[2], '', shipAddr[2]]
  ];
  partyRows.forEach((pair) => {
    merge(ws, r, 1, r, 2, pair[0], { font: pair[0] ? labelFont : bodyFont, align: left, border });
    merge(ws, r, 3, r, 6, pair[1] || '', { font: bodyFont, align: left, border });
    merge(ws, r, 7, r, 8, pair[2], { font: pair[2] ? labelFont : bodyFont, align: left, border });
    merge(ws, r, 9, r, COLS, pair[3] || '', { font: bodyFont, align: left, border });
    r += 1;
  });

  merge(ws, r, 1, r, 2, 'State :', { font: labelFont, align: left, border });
  merge(ws, r, 3, r, 4, bill.state || '', { font: bodyFont, align: left, border });
  paint(ws.getCell(r, 5), { value: 'Code', font: labelFont, align: center, border });
  paint(ws.getCell(r, 6), { value: bill.code || '', font: bodyFont, align: center, border });
  merge(ws, r, 7, r, 8, 'State :', { font: labelFont, align: left, border });
  merge(ws, r, 9, r, 10, ship.state || '', { font: bodyFont, align: left, border });
  paint(ws.getCell(r, 11), { value: 'Code', font: labelFont, align: center, border });
  paint(ws.getCell(r, 12), { value: ship.code || '', font: bodyFont, align: center, border });
  r += 1;
  merge(ws, r, 1, r, 2, 'GSTIN :', { font: labelFont, align: left, border });
  merge(ws, r, 3, r, 6, bill.gstin || '', { font: bodyFont, align: left, border });
  merge(ws, r, 7, r, 8, 'GSTIN :', { font: labelFont, align: left, border });
  merge(ws, r, 9, r, COLS, ship.gstin || '', { font: bodyFont, align: left, border });
  r += 1;

  const head1 = r;
  const head2 = r + 1;
  const spanHead = (c1, c2, value) => merge(ws, head1, c1, head2, c2, value, fillHead);
  spanHead(1, 1, 'S.\nNo.');
  spanHead(2, 2, 'Description');
  spanHead(3, 3, 'Qty');
  spanHead(4, 4, 'Rate');
  spanHead(5, 5, 'Amount');
  merge(ws, head1, 6, head1, 7, 'SGST', fillHead);
  merge(ws, head1, 8, head1, 9, 'CGST', fillHead);
  merge(ws, head1, 10, head1, 11, 'IGST', fillHead);
  spanHead(12, 12, 'Total');
  ['Rate', 'Amount', 'Rate', 'Amount', 'Rate', 'Amount'].forEach((label, i) => {
    paint(ws.getCell(head2, 6 + i), { value: label, ...fillHead });
  });
  ws.getRow(head1).height = 18;
  ws.getRow(head2).height = 16;
  const headerRow = head1;
  r = head2 + 1;

  const qtyText = (qty) => {
    const v = parseFloat(qty);
    if (!Number.isFinite(v) || v === 0) return '';
    return Number.isInteger(v) ? v : money(v);
  };
  const rateText = (rate) => (rate === '' || rate == null || !parseFloat(rate) ? '' : rate);

  const writeLine = (row, sr) => {
    const values = [
      sr || '',
      row?.desc || '',
      row ? qtyText(row.qty) : '',
      row && row.rate ? money(row.rate) : '',
      row ? money(row.amt) : '',
      row ? rateText(row.sgstRate) : '',
      row && money(row.sgstAmt) ? money(row.sgstAmt) : '',
      row ? rateText(row.cgstRate) : '',
      row && money(row.cgstAmt) ? money(row.cgstAmt) : '',
      row ? rateText(row.igstRate) : '',
      row && money(row.igstAmt) ? money(row.igstAmt) : '',
      row ? money(row.total) : ''
    ];
    const moneyCols = new Set([3, 4, 6, 8, 10, 11]);
    values.forEach((value, i) => {
      const showMoney = moneyCols.has(i) && value !== '' && row;
      paint(ws.getCell(r, i + 1), {
        value: row || i === 0 ? value : '',
        font: bodyFont,
        align: i === 1 ? left : center,
        border,
        numFmt: showMoney ? moneyFmt : undefined
      });
    });
    r += 1;
  };

  const body = totals.lines.length ? totals.lines : [];
  body.forEach((row, i) => writeLine(row, i + 1));
  const blanks = Math.max(0, 8 - body.length);
  for (let i = 0; i < blanks; i += 1) writeLine(null, '');

  merge(ws, r, 1, r, 2, 'TOTAL', { font: headLabelFont, fill: solid(FILL), align: center, border });
  const totalCells = [
    qtyText(totals.totalQty) || '0',
    '',
    money(totals.totalAmt),
    '',
    money(totals.totalSgst),
    '',
    money(totals.totalCgst),
    '',
    money(totals.totalIgst),
    money(totals.grand)
  ];
  totalCells.forEach((value, i) => {
    paint(ws.getCell(r, i + 3), {
      value,
      font: headLabelFont,
      fill: solid(FILL),
      align: center,
      border,
      numFmt: typeof value === 'number' ? moneyFmt : undefined
    });
  });
  r += 1;

  const bankRows = getBankDetailRows(profile);
  const summary = [
    ['Total Amount Before Tax', money(totals.totalAmt + (totals.discount || 0))],
    ...(totals.discount > 0 ? [['Discount', money(totals.discount)]] : []),
    [`CGST @ ${totals.taxRate ? (totals.taxRate / 2) : 9}%`, money(totals.totalCgst)],
    [`SGST @ ${totals.taxRate ? (totals.taxRate / 2) : 9}%`, money(totals.totalSgst)],
    ['IGST @ 0%', money(totals.totalIgst)],
    ['Total Tax Amount', money(totals.totalSgst + totals.totalCgst + totals.totalIgst)],
    ...(Math.abs(totals.roundOff) > 0.001 ? [['Round Off', money(totals.roundOff)]] : []),
    ['GRAND TOTAL', money(totals.rounded)]
  ];
  const bankText = ['OUR BANK DETAILS', ...bankRows.map((pair) => `${pair[0]} : ${pair[1] || ''}`)].join('\n');
  merge(ws, r, 1, r + summary.length - 1, 6, bankText, { font: bodyFont, align: topLeft, border });
  summary.forEach((pair, i) => {
    const row = r + i;
    const last = i === summary.length - 1;
    merge(ws, row, 7, row, 10, pair[0], {
      font: last ? headLabelFont : labelFont,
      fill: solid(last ? FILL : WHITE),
      align: left,
      border
    });
    merge(ws, row, 11, row, COLS, pair[1], {
      font: last ? headLabelFont : labelFont,
      fill: solid(last ? FILL : WHITE),
      align: right,
      border,
      numFmt: moneyFmt
    });
  });
  r += summary.length;

  const noteLines = [];
  if (packingNote) noteLines.push({ text: 'NOTE:', bold: true });
  if (packingNote) noteLines.push({ text: packingNote, bold: true });
  noteLines.push({ text: 'TERMS & CONDITIONS', bold: true });
  terms.forEach((line) => noteLines.push({ text: line, bold: /packing materials and transportation/i.test(line) }));

  const signRows = Math.max(noteLines.length + 1, 6);
  noteLines.forEach((line, i) => {
    merge(ws, r + i, 1, r + i, 5, line.text, {
      font: line.bold ? labelFont : smallFont,
      fill: solid(WHITE),
      align: left,
      border
    });
  });
  for (let i = noteLines.length; i < signRows - 1; i += 1) {
    merge(ws, r + i, 1, r + i, 5, '', { font: smallFont, align: left, border });
  }
  merge(ws, r, 6, r, 8, 'DECLARATION', fillHead);
  merge(ws, r + 1, 6, r + signRows - 2, 8, DEFAULT_INVOICE_DECLARATION, { font: smallFont, align: topLeft, border });

  merge(ws, r, 9, r, COLS, `For ${profile.companyName || 'UMA MICRON'}`, fillHead);
  merge(ws, r + 1, 9, r + signRows - 2, COLS, '\n\nAuthorised Signatory', { font: labelFont, align: center, border });

  const footerRow = r + signRows - 1;
  merge(ws, footerRow, 1, footerRow, 9, `This is a computer-generated ${title.toLowerCase()}.`, {
    font: headLabelFont,
    fill: solid(FILL),
    align: left,
    border
  });
  merge(ws, footerRow, 10, footerRow, COLS, 'Page 1 of 1', {
    font: headLabelFont,
    fill: solid(FILL),
    align: center,
    border
  });

  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow + 1}`;
  return ws;
};

export const buildInvoiceWorkbook = async (docType, raw) => {
  const profile = mergeCompanyProfile(raw?.companyProfile || getStoredCompanyProfile());
  const wb = new ExcelJS.Workbook();
  wb.creator = profile.companyName || 'UMA MICRON';
  appendInvoiceWorksheet(wb, docType, raw);
  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};

const saveWorkbook = async (buffer, filename) => {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadInvoiceExcel = async (docType, data) => {
  const buffer = await buildInvoiceWorkbook(docType, data);
  await saveWorkbook(buffer, fileName(docType, data));
};

export const downloadStyledTablesExcel = async (filename, title, sheets) => {
  const profile = getStoredCompanyProfile();
  const addressLines = formatCompanyAddressLines(profile);
  const contact = getContactLine(profile);
  const companyLines = [
    profile.companyName || 'UMA MICRON',
    ...addressLines,
    contact,
    profile.gstNumber ? `GSTIN: ${profile.gstNumber}` : ''
  ].filter(Boolean);
  const wb = new ExcelJS.Workbook();
  wb.creator = profile.companyName || 'UMA MICRON';
  const ws = wb.addWorksheet(String(title || 'Document').slice(0, 31), {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true
    }
  });
  const labelFont = { name: FONT, size: 10, bold: true, color: { argb: TEXT } };
  const bodyFont = { name: FONT, size: 10, color: { argb: TEXT } };
  const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const left = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const list = sheets?.length ? sheets : [{ name: title || 'Details', rows: [] }];
  const width = Math.max(2, ...list.map((sheet) => {
    const rows = sheet.rows || [];
    return rows.reduce((max, row) => Math.max(max, Object.keys(row).length), 0);
  }));
  ws.columns = Array.from({ length: width }, () => ({ width: 22 }));
  let r = 1;
  const header = merge(ws, r, 1, r, width, {
    richText: [
      { text: `${companyLines[0]}\n`, font: { name: FONT, size: 18, bold: true, color: { argb: TEXT } } },
      { text: companyLines.slice(1).join('\n'), font: bodyFont }
    ]
  }, { align: center, border });
  header.alignment = center;
  ws.getRow(r).height = 72;
  r += 1;
  merge(ws, r, 1, r, width, title || 'Document', {
    font: { name: FONT, size: 14, bold: true, color: { argb: TEXT } },
    fill: solid(FILL),
    align: center,
    border
  });
  r += 2;
  list.forEach((sheet) => {
    const rows = sheet.rows || [];
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (!headers.length) return;
    if (list.length > 1) {
      merge(ws, r, 1, r, headers.length, sheet.name || '', { font: labelFont, align: left });
      r += 1;
    }
    headers.forEach((label, i) => {
      paint(ws.getCell(r, i + 1), {
        value: label,
        font: labelFont,
        fill: solid(FILL),
        align: center,
        border
      });
    });
    r += 1;
    rows.forEach((row) => {
      headers.forEach((label, i) => {
        paint(ws.getCell(r, i + 1), {
          value: row[label] ?? '',
          font: bodyFont,
          align: left,
          border
        });
      });
      r += 1;
    });
    r += 1;
  });
  const buffer = await wb.xlsx.writeBuffer();
  await saveWorkbook(buffer, filename || 'Document');
};
