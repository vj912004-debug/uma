import { formatCompanyAddressLines, getContactLine, getStoredCompanyProfile } from './companyProfile';
import { formatDate } from './dateUtils';

const FILL = 'FFBDD7EE';
const TEXT = 'FF000000';
const FONT = 'Times New Roman';
const thin = { style: 'thin', color: { argb: TEXT } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const NUM_FMT = { money: '#,##0.00', number: '#,##0.00', int: '0' };

const groupName = (row, groupBy) => {
  const raw = typeof groupBy === 'function' ? groupBy(row) : row?.[groupBy];
  return String(raw || '').trim() || 'No Party';
};

const sheetName = (name, used) => {
  const base = name.replace(/[\\/?*[\]:]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i += 1) {
    const suffix = ` (${i})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

export const cellValue = (row, col) => {
  const raw = typeof col.value === 'function' ? col.value(row) : row?.[col.key];
  if (col.type === 'date') return formatDate(raw) || '';
  if (NUM_FMT[col.type]) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : '';
  }
  return raw ?? '';
};

const normProdKey = (s) => (s || '').trim().toLowerCase();

export const flattenRowsForExcel = (rows) => {
  const flattened = [];
  (rows || []).forEach((row) => {
    // 1. Check if productSummaries has multiple items with prodName
    const summaries = Array.isArray(row.productSummaries)
      ? row.productSummaries.filter(p => p && (p.prodName || p.productName))
      : [];

    if (summaries.length > 1) {
      const docTotalQty = summaries.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0) || parseFloat(row.qty) || 1;
      const docTotalAmount = typeof row.total === 'number' ? row.total : (parseFloat(row.total) || 0);

      // Check if per-product charge blocks exist
      const pcKeys = Object.keys(row.productCharges || {});
      if (pcKeys.length > 1) {
        let sumSub = 0;
        const prodSubs = {};
        pcKeys.forEach(pName => {
          const pc = row.productCharges[pName];
          const summary = summaries.find(s => normProdKey(s.prodName || s.productName) === normProdKey(pName));
          const pQty = summary ? (parseFloat(summary.qty) || 0) : 0;
          let sub = 0;
          if (pc && pc.charges) {
            Object.keys(pc.charges).forEach(k => {
              if (pc.charges[k]) {
                const r = parseFloat(pc.rates?.[k]) || 0;
                const q = k === 'processing' ? pQty : (parseFloat(pc.qtys?.[k]) || 0);
                sub += q * r;
              }
            });
          }
          prodSubs[pName] = { qty: pQty, sub };
          sumSub += sub;
        });

        const taxRate = parseFloat(row.taxRate) || 18;
        const discount = parseFloat(row.discount) || 0;

        summaries.forEach((p) => {
          const pName = p.prodName || p.productName;
          const matched = prodSubs[pName] || prodSubs[Object.keys(prodSubs).find(k => normProdKey(k) === normProdKey(pName))];
          let itemTotal = 0;
          if (matched && sumSub > 0) {
            const ratio = matched.sub / sumSub;
            const taxable = Math.max(0, matched.sub - (discount * ratio));
            itemTotal = +(taxable * (1 + taxRate / 100)).toFixed(2);
          } else {
            const itemQty = parseFloat(p.qty) || 0;
            const ratio = docTotalQty > 0 ? (itemQty / docTotalQty) : (1 / summaries.length);
            itemTotal = +(docTotalAmount * ratio).toFixed(2);
          }

          flattened.push({
            ...row,
            productName: pName,
            qty: parseFloat(p.qty) || +(row.qty / summaries.length).toFixed(2),
            total: itemTotal
          });
        });
        return;
      }

      summaries.forEach((p) => {
        const itemQty = parseFloat(p.qty) || 0;
        const ratio = docTotalQty > 0 ? (itemQty / docTotalQty) : (1 / summaries.length);
        const itemTotal = +(docTotalAmount * ratio).toFixed(2);
        flattened.push({
          ...row,
          productName: p.prodName || p.productName,
          qty: itemQty || +(row.qty / summaries.length).toFixed(2),
          total: itemTotal
        });
      });
      return;
    }

    // 2. Check if productName contains commas (e.g. "Rivaroxaban, Bosentan")
    const rawName = String(row.productName || '').trim();
    if (rawName.includes(',')) {
      const names = rawName.split(',').map(s => s.trim()).filter(Boolean);
      if (names.length > 1) {
        const docTotalQty = parseFloat(row.qty) || 0;
        const docTotalAmount = typeof row.total === 'number' ? row.total : (parseFloat(row.total) || 0);
        const itemQty = +(docTotalQty / names.length).toFixed(2);
        const itemTotal = +(docTotalAmount / names.length).toFixed(2);

        names.forEach((name) => {
          flattened.push({
            ...row,
            productName: name,
            qty: itemQty,
            total: itemTotal
          });
        });
        return;
      }
    }

    // Single product or no split needed
    flattened.push(row);
  });
  return flattened;
};

/** Generate an Excel workbook where every document gets its own formatted bill worksheet tab. */
export const downloadCompanyWiseExcel = async ({ filename, title, columns, rows, groupBy = 'partyName', docType }) => {
  const { default: ExcelJS } = await import('exceljs');
  const { appendInvoiceWorksheet } = await import('./invoiceExcel');
  const profile = getStoredCompanyProfile();

  const wb = new ExcelJS.Workbook();
  wb.creator = profile.companyName || 'UMA MICRON';
  const used = new Set();

  // Collect unique document objects for individual formatted bill sheets
  const uniqueDocs = [];
  const seenDocIds = new Set();
  (rows || []).forEach((row) => {
    const key = row?.invoiceNo || row?.poNo || row?.noteNo || row?.dcNo || row?.quotationNo || row?.id;
    if (key && !seenDocIds.has(key)) {
      seenDocIds.add(key);
      uniqueDocs.push(row);
    }
  });

  if (uniqueDocs.length > 0) {
    uniqueDocs.forEach((docObj) => {
      const type = docType || docObj.docType || (docObj.invoiceNo ? 'PI' : docObj.poNo ? 'PO' : docObj.noteNo ? 'DN' : docObj.dcNo ? 'DC' : 'PI');
      try {
        appendInvoiceWorksheet(wb, type, docObj, null, used);
      } catch (err) {
        console.warn('Could not append bill worksheet:', err);
      }
    });
  } else {
    // Fallback log list tabs for generic non-document data tables
    const companyLines = [
      profile.companyName || 'UMA MICRON',
      ...formatCompanyAddressLines(profile),
      getContactLine(profile),
      profile.gstNumber ? `GSTIN: ${profile.gstNumber}` : ''
    ].filter(Boolean);

    const flatRows = flattenRowsForExcel(rows);

    const groups = new Map();
    (flatRows || []).forEach((row) => {
      const name = groupName(row, groupBy);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(row);
    });
    if (!groups.size) groups.set('No Records', []);

    const width = columns.length + 1;
    const labelFont = { name: FONT, size: 11, bold: true, color: { argb: TEXT } };
    const bodyFont = { name: FONT, size: 11, color: { argb: TEXT } };
    const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const left = { vertical: 'middle', horizontal: 'left', wrapText: true };
    const right = { vertical: 'middle', horizontal: 'right' };

    [...groups.entries()]
      .sort((a, b) => (a[0] === 'No Party') - (b[0] === 'No Party')
        || a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true }))
      .forEach(([party, list]) => {
        const ws = wb.addWorksheet(sheetName(party, used), {
          views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }],
          pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
          },
          headerFooter: { oddFooter: `&L${party}&RPage &P of &N` }
        });

        const widths = [7, ...columns.map((col) => Math.max(12, String(col.label).length + 4))];
        list.forEach((row) => columns.forEach((col, i) => {
          const v = cellValue(row, col);
          const len = typeof v === 'number' ? v.toFixed(2).length + 4 : String(v).length + 3;
          widths[i + 1] = Math.min(48, Math.max(widths[i + 1], len));
        }));
        ws.columns = widths.map((w) => ({ width: w }));

        ws.mergeCells(1, 1, 1, width);
        const head = ws.getCell(1, 1);
        head.value = {
          richText: [
            { text: `${companyLines[0]}\n`, font: { name: FONT, size: 16, bold: true, color: { argb: TEXT } } },
            { text: companyLines.slice(1).join('\n'), font: { name: FONT, size: 10, color: { argb: TEXT } } }
          ]
        };
        head.alignment = center;
        head.border = border;
        ws.getRow(1).height = 20 + 14 * Math.max(1, companyLines.length - 1);

        ws.mergeCells(2, 1, 2, width);
        Object.assign(ws.getCell(2, 1), {
          value: title,
          font: { name: FONT, size: 13, bold: true, color: { argb: TEXT } },
          fill: solid(FILL),
          alignment: center,
          border
        });
        ws.getRow(2).height = 22;

        ws.mergeCells(3, 1, 3, width);
        Object.assign(ws.getCell(3, 1), {
          value: `Party: ${party}    ·    Documents: ${list.length}    ·    Exported: ${formatDate(new Date().toISOString())}`,
          font: labelFont,
          alignment: left,
          border
        });

        ['Sr. No.', ...columns.map((col) => col.label)].forEach((label, i) => {
          Object.assign(ws.getCell(4, i + 1), { value: label, font: labelFont, fill: solid(FILL), alignment: center, border });
        });
        ws.getRow(4).height = 20;

        let r = 5;
        list.forEach((row, idx) => {
          Object.assign(ws.getCell(r, 1), { value: idx + 1, font: bodyFont, alignment: center, border });
          columns.forEach((col, i) => {
            const cell = ws.getCell(r, i + 2);
            cell.value = cellValue(row, col);
            cell.font = bodyFont;
            cell.border = border;
            cell.alignment = NUM_FMT[col.type] ? right : left;
            if (NUM_FMT[col.type]) cell.numFmt = NUM_FMT[col.type];
          });
          r += 1;
        });

        if (list.length && columns.some((col) => col.total)) {
          Object.assign(ws.getCell(r, 1), { value: 'Total', font: labelFont, fill: solid(FILL), alignment: center, border });
          columns.forEach((col, i) => {
            const cell = ws.getCell(r, i + 2);
            if (col.total) {
              cell.value = list.reduce((sum, row) => sum + (Number(cellValue(row, col)) || 0), 0);
              cell.numFmt = NUM_FMT[col.type] || NUM_FMT.number;
              cell.alignment = right;
            }
            cell.font = labelFont;
            cell.fill = solid(FILL);
            cell.border = border;
          });
        }
        ws.pageSetup.printTitlesRow = '4:4';
      });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename || 'Export'}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
