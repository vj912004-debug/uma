import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CHARGE_KEYS, getChargeLineQty, getMRProductChargeSettings } from './documentCharges';
import { getProductBatches, getProductQty, getReceiptProductNames, receiptProductOptions } from './receiptProducts';
import { GST_TYPE_IGST, formatGstPercent, normalizeGstType } from './taxInvoiceLayout';

const EXTRA_LABELS = {
  cleaning: 'Minimum Cleaning',
  filterBag: 'Filter Bag',
  sieving: 'Sieving',
  psdReport: 'PSD Report Charges',
  liner: 'Liner',
  courier: 'Courier',
  fiberDrum: 'Fiber Drum',
  transportation: 'Transportation',
  hdpeDrum: 'HDPE Drum',
  batchChangeover: 'Batch Changeover'
};

const EXTRA_ORDER = CHARGE_KEYS.filter((key) => key !== 'processing');

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const money = (n) => round2(n).toFixed(2);

const sameId = (a, b) => a != null && b != null && a !== '' && b !== '' && String(a) === String(b);

const parseDateParts = (raw) => {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a > 12) return { y, mo: b, d: a };
    if (b > 12) return { y, mo: a, d: b };
    return { y, mo: b, d: a };
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate() };
  }
  return null;
};

const inMonth = (raw, ym) => {
  const parts = parseDateParts(raw);
  if (!parts || !ym) return false;
  const [y, m] = ym.split('-').map(Number);
  return parts.y === y && parts.mo === m;
};

export const summaryDateText = (raw, sep = '/') => {
  const parts = parseDateParts(raw);
  if (!parts) return '';
  return `${String(parts.d).padStart(2, '0')}${sep}${String(parts.mo).padStart(2, '0')}${sep}${parts.y}`;
};

const dateKey = (raw) => {
  const parts = parseDateParts(raw);
  if (!parts) return 0;
  return parts.y * 10000 + parts.mo * 100 + parts.d;
};

const shortInvoiceNo = (invoiceNo) => {
  const raw = String(invoiceNo || '').trim();
  if (!raw) return '';
  const parts = raw.split(/[/\\]/).filter(Boolean);
  const last = parts[parts.length - 1] || raw;
  const n = parseInt(String(last).replace(/\D/g, ''), 10);
  if (Number.isFinite(n) && n > 0) return String(n);
  return raw;
};

const belongsToCompany = (row, companyId, companyName) => {
  const name = norm(companyName);
  if (!name && !companyId) return false;
  if (companyId && sameId(row?.partyId, companyId)) return true;
  return Boolean(name) && norm(row?.partyName) === name;
};

const findMr = (receipts, dc) => (receipts || []).find((mr) => !mr?.isDeleted && (
  sameId(mr.id, dc.receiptId)
  || sameId(mr.id, dc.mrId)
  || (dc.receiptNo && mr.receiptNo === dc.receiptNo)
)) || null;

const findParty = (parties, companyId, companyName) => {
  const list = parties || [];
  return list.find((p) => sameId(p.id, companyId))
    || list.find((p) => norm(p.name) === norm(companyName))
    || null;
};

const chargeBlockFor = (blocks, productName) => {
  if (!blocks) return null;
  if (blocks[productName]) return blocks[productName];
  const key = Object.keys(blocks).find((name) => norm(name) === norm(productName));
  return key ? blocks[key] : null;
};

const dcProducts = (dc, mr, prodOpts) => {
  const summaries = (dc.productSummaries || []).filter((p) => p && (p.prodName || p.productName));
  if (summaries.length) {
    return summaries.map((p) => {
      const name = p.prodName || p.productName;
      return { name, qty: num(p.qty) || (mr ? getProductQty(mr, name, prodOpts) : 0) };
    });
  }
  const direct = String(dc.productName || '').trim();
  if (direct && !direct.includes(',')) {
    return [{ name: direct, qty: num(dc.qty) || (mr ? getProductQty(mr, direct, prodOpts) : 0) }];
  }
  if (mr) {
    const names = getReceiptProductNames(mr, prodOpts);
    if (names.length) {
      return names.map((name) => ({
        name,
        qty: names.length === 1 ? (num(dc.qty) || getProductQty(mr, name, prodOpts)) : getProductQty(mr, name, prodOpts)
      }));
    }
  }
  if (direct) {
    return direct.split(',').map((part) => part.trim()).filter(Boolean).map((name) => ({
      name,
      qty: num(dc.qty)
    }));
  }
  return [{ name: 'Material', qty: num(dc.qty) }];
};

const invoiceForDc = (invoices, dc, mr) => {
  const list = invoices || [];
  const monthly = list.find((inv) => (
    !inv?.isDeleted
    && inv.monthlyBilling
    && Array.isArray(inv.linkedDcIds)
    && inv.linkedDcIds.some((id) => sameId(id, dc.id))
  ));
  if (monthly) return monthly;
  if (dc.monthlyInvoiceId) {
    const linked = list.find((inv) => !inv?.isDeleted && sameId(inv.id, dc.monthlyInvoiceId));
    if (linked) return linked;
  }
  if (!mr) return null;
  return list.find((inv) => (
    !inv?.isDeleted
    && sameId(inv.receiptId, mr.id)
    && (inv.type === 'Tax Invoice' || String(inv.invoiceNo || '').includes('/IN/'))
  )) || list.find((inv) => (
    !inv?.isDeleted
    && sameId(inv.receiptId, mr.id)
    && (inv.type === 'Proforma Invoice' || String(inv.invoiceNo || '').includes('/PI/'))
  )) || null;
};

const taxSplit = (amount, taxRate, gstType) => {
  const base = round2(amount);
  const rate = num(taxRate) || 18;
  const igst = normalizeGstType(gstType) === GST_TYPE_IGST;
  if (igst) {
    const tax = round2(base * rate / 100);
    return { leftRate: rate, leftAmt: tax, rightRate: 0, rightAmt: 0, total: round2(base + tax), igst: true };
  }
  const half = rate / 2;
  const side = round2(base * half / 100);
  return { leftRate: half, leftAmt: side, rightRate: half, rightAmt: side, total: round2(base + side + side), igst: false };
};

const blankIdentity = () => ({
  sr: '',
  dcNo: '',
  dcDate: '',
  poNo: '',
  poDate: ''
});

const lineFrom = (identity, description, qty, rate, amount, tax) => ({
  ...identity,
  description,
  qty: qty === '' || qty == null ? '' : round2(qty),
  rate: rate === '' || rate == null ? '' : round2(rate),
  amount: round2(amount),
  leftRate: tax.leftAmt || tax.leftRate ? tax.leftRate : '',
  leftAmt: round2(tax.leftAmt),
  rightRate: tax.rightAmt || tax.rightRate ? tax.rightRate : '',
  rightAmt: round2(tax.rightAmt),
  total: round2(tax.total)
});

const extraCharges = (block) => EXTRA_ORDER
  .filter((key) => block?.charges?.[key])
  .map((key) => {
    const rate = num(block.rates?.[key]);
    let qty = getChargeLineQty(block.qtys, key);
    if (!qty && rate) qty = 1;
    return { key, label: EXTRA_LABELS[key] || key, qty, rate, amount: round2(qty * rate) };
  })
  .filter((row) => row.amount > 0);

const customChargeRows = (mr) => (mr?.customCharges || [])
  .filter((row) => row && row.checked !== false)
  .map((row) => {
    const qty = num(row.qty) || 1;
    const rate = num(row.rate);
    const amount = num(row.amount) || round2(qty * rate);
    return {
      label: String(row.name || row.description || '').trim(),
      qty,
      rate: rate || (qty ? round2(amount / qty) : 0),
      amount: round2(amount)
    };
  })
  .filter((row) => row.label && row.amount > 0);

export const buildSummaryTitle = ({ companyName, refNo, invoiceNo, summaryDate }) => {
  const ref = String(refNo || '').trim();
  const inv = String(invoiceNo || '').trim();
  let rest = ref ? `Ref No. ${ref}. ` : '';
  rest += 'Summary';
  if (inv) rest += ` for Invoice No. ${inv}`;
  const dated = summaryDateText(summaryDate, '/');
  if (dated) rest += ` Date: ${dated}`;
  return `${companyName} - ${rest}`;
};

export const summaryFileName = ({ refNo, companyName, month }) => {
  const [y, m] = String(month || '').split('-').map(Number);
  const mon = y && m
    ? new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' })
    : 'Month';
  const ref = String(refNo || '').trim().replace(/[<>:"/\\|?*]+/g, '');
  const company = String(companyName || 'Company').replace(/[<>:"/\\|?*]+/g, ' ').trim();
  return `${ref ? `${ref}-_` : `${company} `}${mon}_Summary.pdf`;
};

export const buildMonthlySummaryStatement = ({
  data = {},
  companyId = '',
  companyName = '',
  month = '',
  refNo = '',
  invoiceNo = '',
  summaryDate = ''
}) => {
  const receipts = data.materialReceipts || [];
  const invoices = data.invoices || [];
  const party = findParty(data.parties, companyId, companyName);
  const challans = (data.deliveryChallans || [])
    .filter((dc) => dc && !dc.isDeleted && belongsToCompany(dc, companyId, companyName) && inMonth(dc.date, month))
    .slice()
    .sort((a, b) => dateKey(a.date) - dateKey(b.date) || String(a.dcNo || '').localeCompare(String(b.dcNo || ''), undefined, { numeric: true }));

  const invoiceNos = [];
  let igstCount = 0;
  const rows = [];

  challans.forEach((dc, index) => {
    const mr = findMr(receipts, dc);
    const prodOpts = mr ? receiptProductOptions(mr, data) : { party, productionPlans: data.productionPlans || [] };
    if (!prodOpts.party && party) prodOpts.party = party;
    const blocks = mr ? buildChargeBlocks(mr, prodOpts.party || party, prodOpts) : {};
    const products = dcProducts(dc, mr, prodOpts);
    const invoice = invoiceForDc(invoices, dc, mr);
    if (invoice?.invoiceNo) invoiceNos.push(shortInvoiceNo(invoice.invoiceNo));
    const taxRate = num(invoice?.taxRate) || 18;
    const gstType = normalizeGstType(invoice?.gstType);
    if (gstType === GST_TYPE_IGST) igstCount += 1;

    const identity = {
      sr: index + 1,
      dcNo: dc.dcNo || '',
      dcDate: summaryDateText(dc.date, '-'),
      poNo: dc.partyDocNo || mr?.partyDocNo || '',
      poDate: summaryDateText(dc.partyDocDate || mr?.partyDocDate, '-')
    };

    products.forEach((product, productIndex) => {
      const block = chargeBlockFor(blocks, product.name);
      const rate = num(block?.rates?.processing);
      const qty = product.qty || 0;
      const amount = round2(qty * rate);
      const showIdentity = productIndex === 0 ? identity : blankIdentity();
      rows.push(lineFrom(showIdentity, product.name, qty, rate, amount, taxSplit(amount, taxRate, gstType)));
    });

    const firstBlock = chargeBlockFor(blocks, products[0]?.name) || Object.values(blocks)[0] || null;
    const extras = [
      ...extraCharges(firstBlock),
      ...customChargeRows(mr)
    ];
    const batchText = products
      .flatMap((product) => (mr ? getProductBatches(mr, product.name, prodOpts) : []))
      .map((batch) => String(batch?.batchNo || '').trim())
      .filter(Boolean)
      .filter((value, idx, list) => list.indexOf(value) === idx)
      .join(' & ');

    if (!extras.length) {
      if (batchText) {
        rows.push(lineFrom(blankIdentity(), batchText, '', '', 0, taxSplit(0, taxRate, gstType)));
      }
      return;
    }

    extras.forEach((extra, extraIndex) => {
      const description = extraIndex === 0 && batchText ? `${batchText}\n${extra.label}` : extra.label;
      rows.push(lineFrom(
        blankIdentity(),
        description,
        extra.qty,
        extra.rate,
        extra.amount,
        taxSplit(extra.amount, taxRate, gstType)
      ));
    });
  });

  const totals = rows.reduce((sum, row) => ({
    amount: round2(sum.amount + num(row.amount)),
    leftAmt: round2(sum.leftAmt + num(row.leftAmt)),
    rightAmt: round2(sum.rightAmt + num(row.rightAmt)),
    total: round2(sum.total + num(row.total))
  }), { amount: 0, leftAmt: 0, rightAmt: 0, total: 0 });

  const suggestedInvoiceNo = [...new Set(invoiceNos.filter(Boolean))].join(', ');
  const printedInvoiceNo = String(invoiceNo || '').trim();
  const igst = challans.length > 0 && igstCount === challans.length;

  return {
    title: buildSummaryTitle({
      companyName,
      refNo,
      invoiceNo: printedInvoiceNo,
      summaryDate
    }),
    fileName: summaryFileName({ refNo, companyName, month }),
    suggestedInvoiceNo,
    igst,
    rows,
    totals
  };
};

const buildChargeBlocks = (mr, party, prodOpts) => {
  const names = getReceiptProductNames(mr, prodOpts);
  const list = names.length ? names : (mr.productName ? [mr.productName] : ['Material']);
  const result = {};
  list.forEach((name) => {
    const settings = getMRProductChargeSettings(mr, party, name);
    result[name] = {
      charges: { ...(settings.charges || {}) },
      rates: { ...(settings.rates || {}) },
      qtys: { ...(settings.qtys || {}) }
    };
  });
  return result;
};

const cellQty = (value) => (value === '' || value == null ? '' : money(value));
const cellRate = (value) => (value === '' || value == null ? '' : money(value));
const cellPercent = (value) => (value === '' || value == null ? '' : formatGstPercent(value));

export const createMonthlySummaryPdf = (statement) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const leftLabel = statement.igst ? 'IGST' : 'SGST';
  const rightLabel = statement.igst ? '' : 'CGST';
  const body = statement.rows.length
    ? statement.rows.map((row) => [
      row.sr,
      row.dcNo,
      row.dcDate,
      row.poNo,
      row.poDate,
      row.description,
      cellQty(row.qty),
      cellRate(row.rate),
      money(row.amount),
      cellPercent(row.leftRate),
      money(row.leftAmt),
      cellPercent(row.rightRate),
      money(row.rightAmt),
      money(row.total)
    ])
    : [['', '', '', '', '', 'No delivery challans in this month', '', '', '', '', '', '', '', '']];

  autoTable(doc, {
    startY: 14,
    margin: { top: 14, right: 6, bottom: 12, left: 6 },
    head: [[
      { content: 'Sr.N', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Delivery Challan No.', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'D.C. Date', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'PO. No/Challan No.', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'PO Date', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Description', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Qty', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Rate', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Amount', rowSpan: 2, styles: { valign: 'middle' } },
      { content: leftLabel, colSpan: 2 },
      { content: rightLabel, colSpan: 2 },
      { content: 'Total', rowSpan: 2, styles: { valign: 'middle' } }
    ], ['Rate', 'Amount', 'Rate', 'Amount']],
    body,
    foot: [[
      { content: '', colSpan: 8 },
      money(statement.totals.amount),
      '',
      money(statement.totals.leftAmt),
      '',
      money(statement.totals.rightAmt),
      money(statement.totals.total)
    ]],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      cellPadding: 0.7,
      valign: 'middle',
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'right'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 31 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 31 },
      4: { cellWidth: 18, halign: 'center' },
      5: { halign: 'left' },
      6: { cellWidth: 16, halign: 'right' },
      7: { cellWidth: 14, halign: 'right' },
      8: { cellWidth: 20, halign: 'right' },
      9: { cellWidth: 12, halign: 'center' },
      10: { cellWidth: 18, halign: 'right' },
      11: { cellWidth: 12, halign: 'center' },
      12: { cellWidth: 18, halign: 'right' },
      13: { cellWidth: 22, halign: 'right' }
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(statement.title, 6, 8);
    }
  });

  const pages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`-- ${page} of ${pages} --`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }
  return doc;
};

export const downloadMonthlySummaryPdf = (statement) => {
  const doc = createMonthlySummaryPdf(statement);
  doc.save(statement.fileName);
};
