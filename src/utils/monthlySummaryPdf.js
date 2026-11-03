import { CHARGE_KEYS, getChargeLineQty, getMRProductChargeSettings } from './documentCharges';
import { getProductBatches, getProductQty, getReceiptProductNames, receiptProductOptions } from './receiptProducts';
import {
  GST_TYPE_IGST,
  TI_CHARGES_LIST,
  formatGstPercent,
  normalizeGstType,
  splitTaxableGstAmount
} from './taxInvoiceLayout';
import { mergeCompanyProfile, getStoredCompanyProfile } from './companyProfile';
import {
  escHtml,
  buildPrintBrandHtml,
  renderHtmlToPdf,
  buildStatusBar,
  PRINT_FOOTER_MESSAGES
} from './printTheme';
import { applyPrintPrefsToHtml, getStoredPrintPrefs } from './printPrefs';

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

const EXTRA_LABEL_TO_KEY = Object.fromEntries(
  Object.entries(EXTRA_LABELS).map(([key, label]) => [norm(label), key])
);

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

const inDateRange = (raw, from, to) => {
  const stamp = dateKey(raw);
  const start = dateKey(from);
  const end = dateKey(to);
  if (!stamp || !start || !end) return false;
  return stamp >= start && stamp <= end;
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

export const shortInvoiceNo = (invoiceNo) => {
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

export const buildSummaryTitle = ({ companyName, refNo, summaryDate }) => {
  const ref = String(refNo || '').trim();
  let rest = ref ? `Ref No. ${ref}. ` : '';
  rest += 'Summary';
  const dated = summaryDateText(summaryDate, '/');
  if (dated) rest += ` Date: ${dated}`;
  return `${companyName} - ${rest}`;
};

export const summaryFileName = ({ refNo, companyName, month, dateFrom, dateTo }) => {
  let label = 'Month';
  if (dateFrom && dateTo) {
    const fromText = summaryDateText(dateFrom, '-');
    const toText = summaryDateText(dateTo, '-');
    label = fromText && toText ? `${fromText}_to_${toText}` : 'Range';
  } else {
    const [y, m] = String(month || '').split('-').map(Number);
    if (y && m) label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
  }
  const ref = String(refNo || '').trim().replace(/[<>:"/\\|?*]+/g, '');
  const company = String(companyName || 'Company').replace(/[<>:"/\\|?*]+/g, ' ').trim();
  return `${ref ? `${ref}-_` : `${company} `}${label}_Summary.pdf`;
};

export const buildMonthlySummaryStatement = ({
  data = {},
  companyId = '',
  companyName = '',
  month = '',
  dateFrom = '',
  dateTo = '',
  refNo = '',
  invoiceNo = '',
  summaryDate = '',
  challans: challanList = null,
  taxRate: taxRateOverride = null,
  gstType: gstTypeOverride = null,
  fileName = ''
}) => {
  const receipts = data.materialReceipts || [];
  const invoices = data.invoices || [];
  const party = findParty(data.parties, companyId, companyName);
  const forcedType = gstTypeOverride ? normalizeGstType(gstTypeOverride) : '';
  const forcedRate = taxRateOverride != null && taxRateOverride !== '' ? num(taxRateOverride) : null;
  const challans = (Array.isArray(challanList) ? challanList : (data.deliveryChallans || [])
    .filter((dc) => {
      if (!dc || dc.isDeleted || !belongsToCompany(dc, companyId, companyName)) return false;
      if (dateFrom && dateTo) return inDateRange(dc.date, dateFrom, dateTo);
      return inMonth(dc.date, month);
    }))
    .filter((dc) => dc && !dc.isDeleted)
    .slice()
    .sort((a, b) => dateKey(a.date) - dateKey(b.date) || String(a.dcNo || '').localeCompare(String(b.dcNo || ''), undefined, { numeric: true }));

  let igstCount = 0;
  const rows = [];

  challans.forEach((dc, index) => {
    const mr = findMr(receipts, dc);
    const prodOpts = mr ? receiptProductOptions(mr, data) : { party, productionPlans: data.productionPlans || [] };
    if (!prodOpts.party && party) prodOpts.party = party;
    const blocks = mr ? buildChargeBlocks(mr, prodOpts.party || party, prodOpts) : {};
    const products = dcProducts(dc, mr, prodOpts);
    const invoice = invoiceForDc(invoices, dc, mr);
    const taxRate = forcedRate != null ? forcedRate : (num(invoice?.taxRate) || 18);
    const gstType = forcedType || normalizeGstType(invoice?.gstType);
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

const igst = forcedType
    ? forcedType === GST_TYPE_IGST
    : (challans.length > 0 && igstCount === challans.length);

  return {
    title: buildSummaryTitle({
      companyName,
      refNo,
      summaryDate
    }),
    fileName: fileName || summaryFileName({ refNo, companyName, month, dateFrom, dateTo }),
    suggestedInvoiceNo: '',
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

const nlHtml = (text) => escHtml(String(text || '')).replace(/\n/g, '<br>');

/** Landscape monthly summary with Uma brand header + purple footer (same family as TI/PI/PFU). */
export const buildMonthlySummaryHtml = (statement, profileInput) => {
  const profile = mergeCompanyProfile(profileInput || getStoredCompanyProfile());
  const companyName = profile.companyName || 'UMA MICRON';
  const leftLabel = statement.igst ? 'IGST' : 'SGST';
  const rightLabel = statement.igst ? 'CGST' : '';
  const gstHead = statement.igst
    ? `<th colspan="2">${leftLabel}</th><th rowspan="2">Total</th>`
    : `<th colspan="2">${leftLabel}</th><th colspan="2">${rightLabel}</th><th rowspan="2">Total</th>`;
  const gstSub = statement.igst
    ? `<th>Rate</th><th>Amount</th>`
    : `<th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>`;

  const bodyRows = (statement.rows || []).length
    ? statement.rows.map((row) => `
      <tr>
        <td class="c">${escHtml(row.sr || '')}</td>
        <td class="left">${escHtml(row.dcNo || '')}</td>
        <td class="c">${escHtml(row.dcDate || '')}</td>
        <td class="left">${escHtml(row.poNo || '')}</td>
        <td class="c">${escHtml(row.poDate || '')}</td>
        <td class="left desc">${nlHtml(row.description)}</td>
        <td class="num">${escHtml(cellQty(row.qty))}</td>
        <td class="num">${escHtml(cellRate(row.rate))}</td>
        <td class="num">${money(row.amount)}</td>
        <td class="c">${escHtml(cellPercent(row.leftRate))}</td>
        <td class="num">${money(row.leftAmt)}</td>
        ${statement.igst ? '' : `
        <td class="c">${escHtml(cellPercent(row.rightRate))}</td>
        <td class="num">${money(row.rightAmt)}</td>`}
        <td class="num">${money(row.total)}</td>
      </tr>`).join('')
    : `<tr><td colspan="${statement.igst ? 12 : 14}" class="c">No delivery challans in this period</td></tr>`;

  const footCells = statement.igst
    ? `
      <td colspan="8" class="num">TOTAL</td>
      <td class="num">${money(statement.totals?.amount)}</td>
      <td></td>
      <td class="num">${money(statement.totals?.leftAmt)}</td>
      <td class="num">${money(statement.totals?.total)}</td>`
    : `
      <td colspan="8" class="num">TOTAL</td>
      <td class="num">${money(statement.totals?.amount)}</td>
      <td></td>
      <td class="num">${money(statement.totals?.leftAmt)}</td>
      <td></td>
      <td class="num">${money(statement.totals?.rightAmt)}</td>
      <td class="num">${money(statement.totals?.total)}</td>`;

  const titleBits = String(statement.title || 'Monthly Summary').split(' - ');
  const subTitle = titleBits.length > 1 ? titleBits.slice(1).join(' - ') : 'MONTHLY SUMMARY';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UMA MICRON - Monthly Summary</title>
<style>
  :root{
    --purple:#3D2B7D;
    --purple-dark:#3D2B7D;
    --lav-bg:#EFEAF7;
    --lav-border:#CFC4EA;
    --green:#2fa84f;
    --text:#231f20;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{margin:0;padding:0;background:#fff;color:var(--text);}
  .page{
    width:1123px;min-height:0;height:auto;padding:8px;margin:0;background:#fff;
    display:flex;flex-direction:column;box-sizing:border-box;overflow:visible;
  }
  .sheet{
    flex:0 0 auto;border:2px solid var(--purple);padding:12px 14px 0;
    display:flex;flex-direction:column;box-sizing:border-box;min-height:0;height:auto;
  }
  .header{
    display:flex;justify-content:space-between;align-items:center;gap:12px;
    margin:0 0 10px;padding:0 0 8px;flex:0 0 auto;min-width:0;
  }
  .brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;}
  .logo{width:64px;height:64px;flex-shrink:0;}
  .logo img,.logo svg{width:100%;height:100%;object-fit:contain;display:block;}
  .brand-lockup{width:280px;height:70px;flex-shrink:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}
  .brand-text h1{
    margin:0;font-size:28px;letter-spacing:.4px;color:var(--purple);
    line-height:1.1;text-transform:uppercase;
  }
  .brand-text .tagline{
    color:var(--green);font-weight:700;font-size:12px;margin-top:2px;line-height:1.2;
  }
  .tax-invoice-box{
    background:var(--purple);color:#fff;text-align:center;padding:10px 18px 12px;
    flex:0 0 auto;min-width:210px;border-radius:8px;box-sizing:border-box;
    display:flex;flex-direction:column;align-items:center;gap:6px;
  }
  .tax-invoice-box .ti-title{
    font-size:18px;font-weight:800;margin:0;padding:0;line-height:1.15;
    letter-spacing:.4px;white-space:nowrap;
  }
  .tax-invoice-box .ti-sub{
    margin:0;background:#fff;color:#111;font-size:10px;font-weight:700;
    padding:3px 10px;border-radius:999px;line-height:1.3;max-width:280px;
    border:1px solid #111;overflow-wrap:anywhere;
  }
  .meta{
    display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:0 0 10px;
    font-size:12px;line-height:1.4;
  }
  .meta-field{display:flex;align-items:baseline;min-width:0;}
  .meta-field .lbl{font-weight:700;color:var(--purple);flex:0 0 110px;white-space:nowrap;}
  .meta-field .colon{font-weight:700;color:var(--purple);padding:0 8px 0 0;}
  .meta-field .val{font-weight:600;min-width:0;overflow-wrap:anywhere;}
  .table-wrap{flex:0 0 auto;margin:0 0 8px;overflow:visible;}
  table.items{
    width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;background:#fff;
  }
  table.items thead th{
    background:var(--purple);color:#fff;font-weight:700;padding:5px 4px;
    text-align:center;vertical-align:middle;border:1px solid rgba(255,255,255,.55);
    line-height:1.2;
  }
  table.items tbody td,table.items tfoot td{
    border:1px solid var(--lav-border);padding:3px 4px;text-align:center;
    vertical-align:middle;background:#fff;color:var(--text);font-weight:600;line-height:1.25;
  }
  table.items tbody td.left,table.items tbody td.desc{text-align:left;}
  table.items tbody td.desc{white-space:pre-wrap;overflow-wrap:anywhere;}
  table.items tbody td.num,table.items tfoot td.num{text-align:right;font-variant-numeric:tabular-nums;}
  table.items tbody td.c,table.items tfoot td.c{text-align:center;}
  table.items tbody tr:nth-child(even) td{background:#EFEAF7;}
  table.items tfoot td{
    background:var(--lav-bg);color:var(--purple-dark);font-weight:800;border-color:var(--purple);
  }
  .barfoot{
    background:var(--purple);color:#fff;margin:auto -14px 0 -14px;padding:8px 14px;
    display:flex;justify-content:space-between;align-items:center;gap:8px;
    font-size:11px;flex-shrink:0;min-width:0;
  }
  .barfoot span{min-width:0;overflow-wrap:anywhere;}
</style>
</head>
<body>
  <div class="page pdf-page ms-page">
    <div class="sheet">
      <div class="header">
        <div class="brand">
          ${buildPrintBrandHtml(profile, {
            companyName,
            tagline: profile.tagline || "Micronization of API's"
          })}
        </div>
        <div class="tax-invoice-box">
          <div class="ti-title">MONTHLY SUMMARY</div>
          <div class="ti-sub">${escHtml(subTitle)}</div>
        </div>
      </div>

      <div class="meta">
        <div class="meta-field"><span class="lbl">Company</span><span class="colon">:</span><span class="val">${escHtml(companyName)}</span></div>
        <div class="meta-field"><span class="lbl">Title</span><span class="colon">:</span><span class="val">${escHtml(statement.title || '')}</span></div>
      </div>

      <div class="table-wrap">
        <table class="items">
          <colgroup>
            <col style="width:3.5%"><col style="width:11%"><col style="width:7%"><col style="width:11%"><col style="width:7%">
            <col style="width:16%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:7%">
            <col style="width:4.5%"><col style="width:6.5%">${statement.igst ? '' : '<col style="width:4.5%"><col style="width:6.5%">'}
            <col style="width:7%">
          </colgroup>
          <thead>
            <tr>
              <th rowspan="2">Sr.N</th>
              <th rowspan="2">Delivery Challan No.</th>
              <th rowspan="2">D.C. Date</th>
              <th rowspan="2">PO. No/Challan No.</th>
              <th rowspan="2">PO Date</th>
              <th rowspan="2">Description</th>
              <th rowspan="2">Qty</th>
              <th rowspan="2">Rate</th>
              <th rowspan="2">Amount</th>
              ${gstHead}
            </tr>
            <tr>${gstSub}</tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
          <tfoot>
            <tr>${footCells}</tr>
          </tfoot>
        </table>
      </div>

      ${buildStatusBar('Page 1 of 1', PRINT_FOOTER_MESSAGES.MS)}
    </div>
  </div>
</body>
</html>`;
};

/** Landscape A4 HTML → PDF (same header/footer family as other Uma docs). */
export const renderMonthlySummaryPdf = async (statement, {
  mode = 'save',
  companyProfile,
  printPrefs
} = {}) => {
  const profile = companyProfile || getStoredCompanyProfile();
  const prefs = printPrefs || getStoredPrintPrefs();
  const html = applyPrintPrefsToHtml(
    buildMonthlySummaryHtml(statement, profile),
    prefs
  );
  // Landscape A4 at ~96dpi ≈ 1123 × 794
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'MS',
    docNo: statement.fileName?.replace(/\.pdf$/i, '') || 'Monthly-Summary',
    partyName: String(statement.title || '').split(' - ')[0] || '',
    data: {
      partyName: String(statement.title || '').split(' - ')[0] || '',
      invoiceNo: '01',
      fileName: statement.fileName
    },
    width: 1123,
    fitPage: false,
    splitOverflowPages: true,
    orientation: 'landscape',
    printPrefs: prefs
  });
};

export const createMonthlySummaryPdf = async (statement, options = {}) =>
  renderMonthlySummaryPdf(statement, { mode: 'save', ...options });

const summaryLine = (statement, row, isTotal = false) => {
  const base = {
    'Sr.N': isTotal ? '' : row.sr,
    'Delivery Challan No.': isTotal ? '' : row.dcNo,
    'D.C. Date': isTotal ? '' : row.dcDate,
    'PO. No/Challan No.': isTotal ? '' : row.poNo,
    'PO Date': isTotal ? '' : row.poDate,
    Description: isTotal ? '' : String(row.description || ''),
    Qty: isTotal ? '' : cellQty(row.qty),
    Rate: isTotal ? '' : cellRate(row.rate),
    Amount: money(isTotal ? statement.totals.amount : row.amount)
  };
  if (statement.igst) {
    base['IGST Rate'] = isTotal ? '' : cellPercent(row.leftRate);
    base['IGST Amount'] = money(isTotal ? statement.totals.leftAmt : row.leftAmt);
  } else {
    base['SGST Rate'] = isTotal ? '' : cellPercent(row.leftRate);
    base['SGST Amount'] = money(isTotal ? statement.totals.leftAmt : row.leftAmt);
    base['CGST Rate'] = isTotal ? '' : cellPercent(row.rightRate);
    base['CGST Amount'] = money(isTotal ? statement.totals.rightAmt : row.rightAmt);
  }
  base.Total = money(isTotal ? statement.totals.total : row.total);
  return base;
};

export const summaryExportRows = (statement) => {
  const rows = statement.rows.map((row) => summaryLine(statement, row));
  if (rows.length) rows.push(summaryLine(statement, {}, true));
  return rows;
};

export const downloadMonthlySummaryPdf = async (statement, options = {}) =>
  renderMonthlySummaryPdf(statement, { mode: 'save', ...options });

export const openMonthlySummaryPdf = async (statement, options = {}) =>
  renderMonthlySummaryPdf(statement, { mode: 'preview', ...options });

const chargeKeyFromDescription = (description) => {
  const parts = String(description || '').split(/\n+/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '';
  const last = norm(parts[parts.length - 1]);
  if (EXTRA_LABEL_TO_KEY[last]) return EXTRA_LABEL_TO_KEY[last];
  for (const [label, key] of Object.entries(EXTRA_LABEL_TO_KEY)) {
    if (last.includes(label) || label.includes(last)) return key;
  }
  return '';
};

/**
 * Roll the monthly summary rows into Tax Invoice charge lines
 * (Processing / Minimum Cleaning / PSD / Filter Bag / …), matching the office TI.
 */
export const buildMonthlyInvoiceChargesFromStatement = (statement) => {
  const buckets = {};
  let processingAmount = 0;
  let processingQty = 0;

  (statement?.rows || []).forEach((row) => {
    const amount = round2(num(row.amount));
    const qty = num(row.qty);
    const rate = num(row.rate);
    const key = chargeKeyFromDescription(row.description);
    if (key) {
      if (!buckets[key]) buckets[key] = { qty: 0, amount: 0, rate: 0 };
      buckets[key].qty = round2(buckets[key].qty + (qty || (amount > 0 && rate > 0 ? round2(amount / rate) : 0)));
      buckets[key].amount = round2(buckets[key].amount + amount);
      if (rate > 0) buckets[key].rate = rate;
      else if (buckets[key].qty > 0) buckets[key].rate = round2(buckets[key].amount / buckets[key].qty);
      return;
    }
    if (amount > 0.009 || qty > 0) {
      processingAmount = round2(processingAmount + amount);
      processingQty = round2(processingQty + qty);
    }
  });

  const charges = {};
  const rates = {};
  const qtys = {};

  if (processingAmount > 0.009) {
    charges.processing = true;
    // One processing line with the summary total (same as office TI 267).
    qtys.processing = 1;
    rates.processing = processingAmount;
  }

  EXTRA_ORDER.forEach((key) => {
    const bucket = buckets[key];
    if (!bucket || bucket.amount <= 0.009) return;
    const qty = bucket.qty > 0 ? bucket.qty : 1;
    const rate = bucket.rate > 0 ? bucket.rate : round2(bucket.amount / qty);
    charges[key] = true;
    qtys[key] = qty;
    rates[key] = rate;
  });

  const order = TI_CHARGES_LIST.map((c) => c.key).filter((key) => charges[key]);
  const subtotal = round2(
    (charges.processing ? processingAmount : 0)
    + EXTRA_ORDER.reduce((sum, key) => sum + (buckets[key]?.amount || 0), 0)
  );

  return {
    charges,
    rates,
    qtys,
    chargeOrder: order,
    productCharges: {},
    customCharges: [],
    subtotal,
    processingQty,
    qty: Object.values(qtys).reduce((sum, q) => sum + (num(q) || 0), 0)
  };
};

export const buildMonthlyBillingInvoicePayload = ({
  data = {},
  companyId = '',
  companyName = '',
  dateFrom = '',
  dateTo = '',
  month = '',
  challans = null,
  taxRate = 18,
  gstType = '',
  discount = 0,
  invoiceNo = '',
  summaryDate = ''
}) => {
  const statement = buildMonthlySummaryStatement({
    data,
    companyId,
    companyName,
    dateFrom,
    dateTo,
    month,
    challans,
    taxRate,
    gstType,
    invoiceNo: shortInvoiceNo(invoiceNo),
    summaryDate
  });
  const built = buildMonthlyInvoiceChargesFromStatement(statement);
  const taxable = Math.max(0, built.subtotal - (parseFloat(discount) || 0));
  const split = splitTaxableGstAmount(taxable, taxRate, gstType);
  return {
    statement,
    ...built,
    discount: parseFloat(discount) || 0,
    taxRate: parseFloat(taxRate) || 18,
    gstType: normalizeGstType(gstType),
    subtotal: built.subtotal,
    taxAmount: split.taxAmount,
    total: round2(taxable + split.taxAmount),
    taxable,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst
  };
};
