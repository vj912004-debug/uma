import ExcelJS from 'exceljs';
import { mergeCompanyProfile, formatCompanyAddressLines, getContactLine, getBankDetailRows, getStoredCompanyProfile } from './companyProfile';
import {
  buildTiPrintChargeRows,
  getSplitGstRates,
  formatPdfDateDmy,
  splitPartyAddressLines
} from './taxInvoiceLayout';
import {
  DEFAULT_PI_NOTE,
  DEFAULT_PI_TERMS,
  DEFAULT_INVOICE_TERMS,
  DEFAULT_INVOICE_DECLARATION,
  isPlaceholderInvoiceTerms
} from './printTheme';

const fileName = (docType, data) => {
  const raw = data?.invoiceNo || docType || 'Document';
  return String(raw).replace(/[\\/:*?"<>|]+/g, '-');
};

const PURPLE = 'FF5B1C85';
const LAVENDER = 'FFF3EEF9';
const WHITE = 'FFFFFFFF';
const TEXT = 'FF231F20';
const LINE = 'FFC4A8DC';
const COLS = 11;

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

const invoiceLines = (data) => {
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
    row.igstRate = row.amt > 0 && igst ? igst : '';
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

export const buildInvoiceWorkbook = async (docType, raw) => {
  const data = raw || {};
  const isPI = String(docType || '').toUpperCase() === 'PI';
  const title = isPI ? 'Performa Invoice' : 'Tax Invoice';
  const profile = mergeCompanyProfile(data.companyProfile || getStoredCompanyProfile());
  const totals = invoiceLines(data);
  const bill = partyBlock(data, 'bill');
  const ship = partyBlock(data, 'ship');
  const address = formatCompanyAddressLines(profile).join(', ');
  const contact = getContactLine(profile);
  const docNo = data.invoiceNo || '';
  const docDate = formatPdfDateDmy(data.date) || '';
  const poNo = data.partyDocNo || '';
  const poDate = formatPdfDateDmy(data.partyDocDate) || '';
  const note = isPI ? DEFAULT_PI_NOTE : '';
  const terms = termLines(data.terms, isPI ? DEFAULT_PI_TERMS : DEFAULT_INVOICE_TERMS);

  const wb = new ExcelJS.Workbook();
  wb.creator = profile.companyName || 'UMA MICRON';
  const ws = wb.addWorksheet(title, {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true
    }
  });
  ws.columns = [
    { width: 36 }, { width: 10 }, { width: 12 }, { width: 14 },
    { width: 10 }, { width: 13 }, { width: 10 }, { width: 13 },
    { width: 10 }, { width: 13 }, { width: 14 }
  ];

  const titleFont = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } };
  const headFont = { name: 'Calibri', size: 14, bold: true, color: { argb: PURPLE } };
  const labelFont = { name: 'Calibri', size: 10, bold: true, color: { argb: TEXT } };
  const bodyFont = { name: 'Calibri', size: 10, color: { argb: TEXT } };
  const whiteBold = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
  const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const left = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const right = { vertical: 'middle', horizontal: 'right' };

  let r = 1;
  merge(ws, r, 1, r, COLS, profile.companyName || 'UMA MICRON', {
    font: headFont,
    align: { vertical: 'middle', horizontal: 'center' }
  });
  ws.getRow(r).height = 22;
  r += 1;
  merge(ws, r, 1, r, COLS, address, { font: bodyFont, align: center });
  r += 1;
  if (contact) {
    merge(ws, r, 1, r, COLS, contact, { font: bodyFont, align: center });
    r += 1;
  }
  if (profile.gstNumber) {
    merge(ws, r, 1, r, COLS, `GSTIN : ${profile.gstNumber}`, { font: labelFont, align: center });
    r += 1;
  }

  merge(ws, r, 1, r, COLS, title, {
    font: titleFont,
    fill: solid(PURPLE),
    align: center,
    border
  });
  ws.getRow(r).height = 24;
  r += 1;

  const meta = (row, c, label, value) => {
    paint(ws.getCell(row, c), { value: label, font: labelFont, align: left, border, fill: solid(LAVENDER) });
    merge(ws, row, c + 1, row, c + 2, value || '', { font: bodyFont, align: left, border });
  };
  meta(r, 1, isPI ? 'PI No.' : 'Invoice No.', docNo);
  meta(r, 5, 'PO No.', poNo);
  meta(r, 8, 'State', bill.state || profile.state || '');
  r += 1;
  meta(r, 1, isPI ? 'PI Date' : 'Invoice Date', docDate);
  meta(r, 5, 'PO Date', poDate);
  meta(r, 8, 'Code', bill.code || '');
  r += 2;

  const sectionHead = { font: whiteBold, fill: solid(PURPLE), align: left, border };
  merge(ws, r, 1, r, 5, 'BILL TO PARTY', sectionHead);
  merge(ws, r, 6, r, COLS, 'SHIP TO PARTY', sectionHead);
  r += 1;

  const writeParty = (startCol, endCol, party) => {
    const rows = [
      ['Name', party.name],
      ...party.lines.map((line, i) => [i === 0 ? 'Address' : '', line]),
      ['GSTIN', party.gstin],
      ['State', party.state],
      ['Code', party.code]
    ];
    rows.forEach((pair, i) => {
      paint(ws.getCell(r + i, startCol), { value: pair[0], font: labelFont, align: left, border, fill: solid(LAVENDER) });
      merge(ws, r + i, startCol + 1, r + i, endCol, pair[1] || '', { font: bodyFont, align: left, border });
    });
    return rows.length;
  };
  const billRows = writeParty(1, 5, bill);
  writeParty(6, COLS, ship);
  r += Math.max(billRows, 6) + 1;

  const headers = ['Description', 'Qty', 'Rate', 'Amount', 'SGST %', 'SGST Amt', 'CGST %', 'CGST Amt', 'IGST %', 'IGST Amt', 'Total'];
  headers.forEach((label, i) => {
    paint(ws.getCell(r, i + 1), {
      value: label,
      font: whiteBold,
      fill: solid(PURPLE),
      align: center,
      border
    });
  });
  ws.getRow(r).height = 20;
  const headerRow = r;
  r += 1;

  const writeLine = (row) => {
    const values = [
      row.desc,
      row.qty || '',
      row.rate ? money(row.rate) : '',
      money(row.amt),
      row.sgstRate === '' ? '' : row.sgstRate,
      money(row.sgstAmt),
      row.cgstRate === '' ? '' : row.cgstRate,
      money(row.cgstAmt),
      row.igstRate === '' ? '' : row.igstRate,
      money(row.igstAmt),
      money(row.total)
    ];
    values.forEach((value, i) => {
      const numeric = i > 0 && value !== '';
      paint(ws.getCell(r, i + 1), {
        value,
        font: bodyFont,
        align: i === 0 ? left : right,
        border,
        numFmt: numeric && i !== 1 && i !== 4 && i !== 6 && i !== 8 ? moneyFmt : undefined
      });
    });
    r += 1;
  };

  if (!totals.lines.length) writeLine({ desc: '', qty: '', rate: 0, amt: 0, sgstRate: '', cgstRate: '', igstRate: '', sgstAmt: 0, cgstAmt: 0, igstAmt: 0, total: 0 });
  totals.lines.forEach(writeLine);

  const totalValues = ['Total', totals.totalQty || '', '', money(totals.totalAmt), '', money(totals.totalSgst), '', money(totals.totalCgst), '', money(totals.totalIgst), money(totals.grand)];
  totalValues.forEach((value, i) => {
    paint(ws.getCell(r, i + 1), {
      value,
      font: labelFont,
      fill: solid(LAVENDER),
      align: i === 0 ? left : right,
      border,
      numFmt: typeof value === 'number' ? moneyFmt : undefined
    });
  });
  r += 2;

  const bankRows = getBankDetailRows(profile);
  merge(ws, r, 1, r, 4, 'OUR BANK DETAILS', sectionHead);
  const summaryStart = r;
  const summary = [
    ['Total Amount Before Tax', money(totals.totalAmt + (totals.discount || 0))],
    ...(totals.discount > 0 ? [['Discount', money(totals.discount)], ['Taxable Amount', money(totals.totalAmt)]] : []),
    [`CGST @ ${totals.displayRate}%`, money(totals.totalCgst)],
    [`SGST @ ${totals.displayRate}%`, money(totals.totalSgst)],
    [`IGST @ ${totals.taxRate}%`, money(totals.totalIgst)],
    ['Round Off', money(totals.roundOff)],
    ['Total Amount', money(totals.rounded)]
  ];
  summary.forEach((pair, i) => {
    const row = summaryStart + i;
    const last = i === summary.length - 1;
    merge(ws, row, 6, row, 9, pair[0], {
      font: last ? whiteBold : labelFont,
      fill: solid(last ? PURPLE : LAVENDER),
      align: left,
      border
    });
    merge(ws, row, 10, row, COLS, pair[1], {
      font: last ? whiteBold : labelFont,
      fill: solid(last ? PURPLE : WHITE),
      align: right,
      border,
      numFmt: moneyFmt
    });
  });
  r += 1;
  bankRows.forEach((pair) => {
    paint(ws.getCell(r, 1), { value: pair[0], font: labelFont, align: left, border, fill: solid(LAVENDER) });
    merge(ws, r, 2, r, 4, pair[1] || '', { font: bodyFont, align: left, border });
    r += 1;
  });
  r = Math.max(r, summaryStart + summary.length) + 1;

  if (note) {
    merge(ws, r, 1, r, COLS, 'NOTES', sectionHead);
    r += 1;
    merge(ws, r, 1, r, COLS, note, { font: bodyFont, align: { ...left, wrapText: true }, border });
    ws.getRow(r).height = 32;
    r += 2;
  }

  merge(ws, r, 1, r, COLS, 'TERMS & CONDITIONS', sectionHead);
  r += 1;
  terms.forEach((line) => {
    merge(ws, r, 1, r, COLS, line, { font: bodyFont, align: left, border });
    r += 1;
  });
  r += 1;
  merge(ws, r, 7, r, COLS, `For ${profile.companyName || 'UMA MICRON'}`, {
    font: labelFont,
    align: center
  });
  r += 3;
  merge(ws, r, 7, r, COLS, 'Authorised Signatory', { font: bodyFont, align: center });
  r += 2;
  merge(ws, r, 1, r, COLS, DEFAULT_INVOICE_DECLARATION, {
    font: { ...bodyFont, italic: true },
    align: { ...left, wrapText: true }
  });

  ws.autoFilter = undefined;
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};

export const downloadInvoiceExcel = async (docType, data) => {
  const buffer = await buildInvoiceWorkbook(docType, data);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName(docType, data)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
