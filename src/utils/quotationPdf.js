import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy, formatPdfDateSlash, splitPartyAddressLines, partyAddressHtml } from './taxInvoiceLayout';
import {
  escHtml,
  renderHtmlToPdf,
  buildPrintHeader,
  buildStatusBar,
  fillPrintPartyFields,
  loadUmaAppData,
  buildPartyFootHtml,
  buildOptionalMetaRowHtml,
  PRINT_ICON_DOC,
  PRINT_ICON_CAL,
  PRINT_FOOTER_MESSAGES
} from './printTheme';
import { formatPrintRateText, formatQuotedRate, mergeRateUnits, defaultRateUnit } from './quotationRates';

/** Keep digits from colliding with ( ) in PDF capture (Cambria / html2canvas kerning). */
const wrapHsnCodeHtml = (text) => {
  const withGaps = String(text || '').replace(/\(\s*(\d[\d\s.]*)\s*\)/g, '(\u200A$1\u200A)');
  return escHtml(withGaps).replace(
    /\((\u200A?\d[\d\s.]*\u200A?)\)/g,
    '<span class="hsn-code">($1)</span>'
  );
};

const formatChargeDescriptionHtml = (c) => {
  const base = String(c?.description || '').trim();
  const note = String(c?.note || c?.chargeNote || '').trim();
  if (!base && !note) return '';
  if (!note) return wrapHsnCodeHtml(base);
  const wrapped = /^\(.*\)$/.test(note) ? note : `(${note})`;
  if (base && base.toLowerCase().includes(note.toLowerCase())) return wrapHsnCodeHtml(base);
  const prefix = base ? `${wrapHsnCodeHtml(base)} ` : '';
  return `${prefix}<b>${wrapHsnCodeHtml(wrapped)}</b>`;
};

const rateDisplayHtml = (rateStr, sourceKey = '', rateUnits = {}) => {
  const text = formatPrintRateText(rateStr, sourceKey, rateUnits);
  if (!text || text === '-' || /^nil$/i.test(text)) {
    return '<span class="nil">NIL</span>';
  }
  return escHtml(text);
};

const MAIN_PRINT_CHARGES = [
  { key: 'cleaning', label: 'Minimum Cleaning Charges (998842)', isQtyRate: true },
  { key: 'processing', label: 'Processing Charges (998842)', isQtyRate: true },
  { key: 'sieving', label: 'Sieving Charges (998842)', isQtyRate: true }
];

const OPTIONAL_PRINT_CHARGES = [
  { key: 'filterBag', label: 'Filter Bag Charges (591190)', isQtyRate: false },
  { key: 'psdReport', label: 'PSD Report Charges (998346)', isQtyRate: false },
  { key: 'liner', label: 'Liner (39233090)', isQtyRate: false },
  { key: 'courier', label: 'Courier (996812)', isQtyRate: false },
  { key: 'fiberDrum', label: 'Fiber Drum (7310)', isQtyRate: false },
  { key: 'transportation', label: 'Transportation (996511)', isQtyRate: false },
  { key: 'hdpeDrum', label: 'HDPE Drum (39233090)', isQtyRate: false },
  { key: 'batchChangeover', label: 'Batch Changeover (998842)', isQtyRate: false }
];

const ALL_PRINT_CHARGES = [...MAIN_PRINT_CHARGES, ...OPTIONAL_PRINT_CHARGES];

const customPrintDefs = (data) =>
  (Array.isArray(data?.customChargeDefs) ? data.customChargeDefs : [])
    .filter((def) => def?.key && String(def.label || '').trim())
    .map((def) => ({ key: def.key, label: String(def.label).trim(), isQtyRate: false, section: def.section }));

const printChargeDefs = (data) => [...ALL_PRINT_CHARGES, ...customPrintDefs(data)];

const defaultPrintSection = (key, data) => {
  if (MAIN_PRINT_CHARGES.some((item) => item.key === key)) return 'main';
  const custom = customPrintDefs(data).find((def) => def.key === key);
  return custom?.section === 'main' ? 'main' : 'optional';
};

const printSectionFor = (data, key) =>
  data.chargeSection?.[key] || defaultPrintSection(key, data);

const customPrintRows = (rows = []) =>
  (rows || [])
    .filter((row) => !row.sourceKey && String(row.description || '').trim())
    .map((row) => ({
      ...row,
      note: row.note || row.chargeNote || ''
    }));

const savedRowFor = (data, key) =>
  [...(data.mainCharges || []), ...(data.optionalCharges || [])]
    .find((row) => row?.sourceKey === key) || null;

const catalogRowForPrint = (item, data) => {
  const saved = savedRowFor(data, item.key);
  const rateUnits = mergeRateUnits(data.rateUnits);
  const rateNum = parseFloat(data.rates?.[item.key]);
  const fallbackRate = Number.isFinite(rateNum) && rateNum > 0
    ? formatQuotedRate(rateNum, rateUnits[item.key] ?? defaultRateUnit(item.key))
    : 'NIL';
  const qty = saved?.qty != null && saved.qty !== ''
    ? saved.qty
    : (item.isQtyRate ? data.qty : '');
  return {
    description: saved?.description || item.label,
    psdRequirement: item.key === 'processing'
      ? (saved?.psdRequirement || data.psdRequirement || '')
      : (saved?.psdRequirement || ''),
    qty,
    rate: saved?.dryRate || saved?.rate || fallbackRate,
    dryRate: saved?.dryRate || saved?.rate || fallbackRate,
    wetRate: saved?.wetRate || '',
    sourceKey: item.key,
    note: saved?.note || data.chargeNotes?.[item.key] || ''
  };
};

const firstProductName = (data) =>
  String(data?.productName || '').split(',')[0].trim();

const rateNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const firstPositiveRate = (...values) => {
  for (const value of values) {
    if (rateNumber(value) > 0) return rateNumber(value);
  }
  return 0;
};

/** Merge product snapshot + top-level quote so print sees the ticked charges. */
export const enrichQuotationForPrint = (data = {}) => {
  const productName = firstProductName(data);
  const saved = (productName && data.productSettings?.[productName]) || {};
  const savedCharges = saved.charges || {};
  const charges = { ...(data.charges || {}) };
  Object.entries(savedCharges).forEach(([key, on]) => {
    if (on) charges[key] = true;
  });

  const rates = { ...(saved.rates || {}) };
  Object.entries(data.rates || {}).forEach(([key, value]) => {
    if (rateNumber(value) > 0 || rates[key] == null) rates[key] = value;
  });

  let mainCharges = (data.mainCharges && data.mainCharges.length)
    ? data.mainCharges
    : (saved.mainCharges || []);
  let optionalCharges = (data.optionalCharges && data.optionalCharges.length)
    ? data.optionalCharges
    : (saved.optionalCharges || []);

  const header = data.defaultRates || {};
  const lines = (Array.isArray(data.quoteLines) ? data.quoteLines : [])
    .filter((line) => String(line?.name || '').trim());
  const companyQuote = Boolean(data.companyQuoteMode) || lines.length > 0;

  if (companyQuote) {
    const cleaning = firstPositiveRate(header.cleaning, header.minimum, rates.cleaning);
    const sieving = firstPositiveRate(header.sieving, rates.sieving);
    const filterBag = firstPositiveRate(header.filterBag, rates.filterBag);
    const headerProcessing = firstPositiveRate(header.processing, rates.processing);
    rates.cleaning = cleaning || rates.cleaning || 0;
    rates.sieving = sieving || rates.sieving || 0;
    rates.filterBag = filterBag || rates.filterBag || 0;
    rates.processing = firstPositiveRate(lines[0]?.rates?.processing, headerProcessing, rates.processing);
    charges.cleaning = true;
    charges.sieving = true;
    charges.filterBag = true;
    charges.processing = lines.length <= 1;

    const rateUnits = mergeRateUnits({ ...(saved.rateUnits || {}), ...(data.rateUnits || {}) });
    const productRows = lines.slice(lines.length > 1 ? 0 : 1).map((line) => {
      const amount = firstPositiveRate(line?.rates?.processing, headerProcessing);
      const printed = formatQuotedRate(amount, rateUnits.processing ?? defaultRateUnit('processing'));
      const name = String(line?.name || '').trim();
      return {
        description: name ? `Processing Charges — ${name} (998842)` : 'Processing Charges (998842)',
        psdRequirement: line?.psdReq || line?.psdRequirement || '',
        rate: printed,
        dryRate: printed,
        sourceKey: ''
      };
    });
    if (productRows.length) {
      const isProcessingRow = (row) => row?.sourceKey === 'processing' || /^processing charges/i.test(String(row?.description || ''));
      const keptMain = (mainCharges || []).filter((row) => !isProcessingRow(row));
      const keptOptional = (optionalCharges || []).filter((row) => !isProcessingRow(row));
      if (printSectionFor(data, 'processing') === 'optional') {
        mainCharges = keptMain;
        optionalCharges = [...productRows, ...keptOptional];
      } else {
        mainCharges = [...productRows, ...keptMain];
        optionalCharges = keptOptional;
      }
    }
    const other = firstPositiveRate(header.other);
    if (other > 0) {
      const printed = formatQuotedRate(other, '');
      const isOther = (row) => /other charges/i.test(String(row?.description || ''));
      if (![...(mainCharges || []), ...(optionalCharges || [])].some(isOther)) {
        const row = { description: 'Other Charges', rate: printed, dryRate: printed, sourceKey: '' };
        if ((data.chargeSection?.other || 'optional') === 'main') mainCharges = [...(mainCharges || []), row];
        else optionalCharges = [...(optionalCharges || []), row];
      }
    }
  }

  const psdFromLine = lines[0]?.psdReq || lines[0]?.psdRequirement || '';
  return {
    ...data,
    charges,
    rates,
    chargeNotes: { ...(saved.chargeNotes || {}), ...(data.chargeNotes || {}) },
    chargeSection: { ...(saved.chargeSection || {}), ...(data.chargeSection || {}) },
    rateUnits: mergeRateUnits({ ...(saved.rateUnits || {}), ...(data.rateUnits || {}) }),
    mainCharges,
    optionalCharges,
    qty: data.qty ?? saved.qty,
    psdRequirement: psdFromLine || data.psdRequirement || saved.psdRequirement || ''
  };
};

/** Tick flag or a row already in the Main/Optional table counts as selected. */
const isChargeSelected = (data, item) =>
  Boolean(data.charges?.[item.key]) || Boolean(savedRowFor(data, item.key));

const resolveChargesForPrint = (data) => {
  const mainCharges = [];
  const optionalCharges = [];
  printChargeDefs(data).forEach((item) => {
    if (!isChargeSelected(data, item)) return;
    const row = catalogRowForPrint(item, data);
    if (printSectionFor(data, item.key) === 'main') mainCharges.push(row);
    else optionalCharges.push(row);
  });
  return {
    mainCharges: [...mainCharges, ...customPrintRows(data.mainCharges)],
    optionalCharges: [...optionalCharges, ...customPrintRows(data.optionalCharges)]
  };
};

export const buildQuotationHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const { mainCharges, optionalCharges } = resolveChargesForPrint(data);
  const companyName = escHtml(profile.companyName || 'UMA MICRON');
  const validityDate = escHtml(formatPdfDateSlash(data.validityDate) || formatPdfDateDmy(data.validityDate) || '');

  const descriptionHtml = data.description
    ? escHtml(data.description).replace(/\r?\n/g, '<br>')
    : '';

  const rateUnits = mergeRateUnits(data.rateUnits);
  const mainRows =
    mainCharges.length > 0
      ? mainCharges
          .map((c, i) => {
            const rateSrc = c.dryRate || c.rate || c.wetRate || '';
            return `
            <tr>
              <td>${i + 1}</td>
              <td class="left">${formatChargeDescriptionHtml(c)}</td>
              <td>${c.psdRequirement ? escHtml(c.psdRequirement) : ''}</td>
              <td class="rate">${rateDisplayHtml(rateSrc, c.sourceKey, rateUnits)}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td class="empty-offer" colspan="4">No&nbsp;charges&nbsp;selected</td></tr>`;

  const optionalRows =
    optionalCharges.length > 0
      ? optionalCharges
          .map(
            (c, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="left">${formatChargeDescriptionHtml(c)}</td>
              <td class="rate">${rateDisplayHtml(c.rate, c.sourceKey, rateUnits)}</td>
            </tr>`
          )
          .join('')
      : '';

  const addr1 = profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli, N.H. No. 8';
  const city = profile.city || 'Vadodara';
  const pincode = profile.pincode || '391350';
  const state = profile.state || 'Gujarat';
  const addrLine1 = escHtml(String(addr1).replace(/\s*,\s*,+/g, ',').trim());
  const phoneRaw = String(profile.phone || '+91 97120 00297').trim();
  const phoneFmt = phoneRaw.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')
    .replace(/^\+91(\d{10})$/, (_, d) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`);
  const phoneStr = escHtml(phoneFmt);
  const emailStr = escHtml(profile.email || 'info@umamicron.com');
  const webStr = escHtml(String(profile.website || 'www.umamicron.com').replace(/^https?:\/\//i, ''));
  const gstStr = escHtml(profile.gstNumber || '24AAGBPR8564D1ZE');
  const assetUrl = (path) => {
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
      }
    } catch (_) { /* ignore */ }
    return path;
  };
  const factoryImg = assetUrl('/jet_mill.jpeg');
  const qrImg = assetUrl('/qr.png');

  const sigName = escHtml(data.signatoryName || 'Amit Patel');

  const party = fillPrintPartyFields(data, data.appData || loadUmaAppData());
  const partyName = escHtml(party.partyName || '');
  const partyLines = splitPartyAddressLines(party.partyAddress || party.billAddress || party.address || '');
  const titleCase = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
  const partyFootHtml = buildPartyFootHtml(
    party.gstinBill || party.gstin || '',
    titleCase(party.billState || party.state || ''),
    party.billStateCode || party.stateCode || ''
  );
  const attentionRows = [
    ['Contact Person', data.contactPerson],
    ['Mobile', data.partyMobile || data.mobile],
    ['Email', data.partyEmail || data.email]
  ].filter(([, v]) => String(v || '').trim())
    .map(([label, v]) => `<div class="frow"><span class="flabel">${label}</span><span class="fcolon">:</span><span>${escHtml(v)}</span></div>`)
    .join('');

  const companyStateName = titleCase(profile.state || 'Gujarat');
  const companyStateCode = String(profile.gstNumber || '24').replace(/\s/g, '').slice(0, 2) || '24';
  const companyPan = profile.panNumber
    || (String(profile.gstNumber || '').length >= 15 ? String(profile.gstNumber).substring(2, 12) : '');

  const quoteMetaRows = [
    buildOptionalMetaRowHtml('Quotation No.', data.quotationNo || 'N/A', { iconHtml: PRINT_ICON_DOC }),
    buildOptionalMetaRowHtml('Quotation Date', formatPdfDateDmy(data.date) || 'N/A', { iconHtml: PRINT_ICON_CAL }),
    buildOptionalMetaRowHtml('Valid Till', formatPdfDateDmy(data.validityDate) || '', { iconHtml: PRINT_ICON_CAL })
  ].join('');
  const contactMetaRows = [
    buildOptionalMetaRowHtml('Contact Person', data.signatoryName || 'Amit Patel', { iconHtml: PRINT_ICON_DOC }),
    buildOptionalMetaRowHtml('Mobile', phoneFmt, { iconHtml: PRINT_ICON_DOC }),
    buildOptionalMetaRowHtml('Email', profile.email || 'info@umamicron.com', { iconHtml: PRINT_ICON_DOC })
  ].join('');

  const subject = escHtml(data.subject || 'Quotation for Micronization Services');

  const customNotes = String(data.notes || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const notesListHtml = [
    'All above rates are in Indian Rupees <span class="sym">(₹)</span>.',
    'GST will be charged extra as applicable.',
    'This is a quotation and not an invoice.',
    'Please send your Purchase Order along with material &amp; specification.',
    ...customNotes.map((line) => escHtml(line))
  ].map((line) => `<li>${line}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Quotation - ${companyName}</title>
<style>
  :root{
    --purple:#5a2d81;
    --purple-dark:#3a1c5c;
    --purple-light:#f2edf8;
    --purple-border:#d9cdec;
    --green:#2e8b3d;
    --orange:#f5811f;
    --text:#2b2b2b;
    --muted:#5a5a5a;
  }
  *{box-sizing:border-box;margin:0;padding:0;font-family:Cambria,Georgia,serif;}
  body{background:#e9e9ee;padding:24px 0;color:var(--text);}
  .sheet{
    width:794px;margin:0 auto 24px auto;background:#fff;
    box-shadow:0 4px 18px rgba(0,0,0,.15);
    position:relative;overflow:hidden;
    border-radius:0;
    box-sizing:border-box;
  }
  .sheet.pdf-page{
    width:794px;min-height:1123px;height:1123px;max-height:1123px;
    display:flex;flex-direction:column;
  }
  .sheet.pdf-page::after{
    content:'';position:absolute;top:0;left:0;right:0;bottom:0;
    border:2px solid var(--purple);pointer-events:none;z-index:60;
  }
  .sheet + .sheet{margin-top:30px;}

  /* ============ HEADER (same badge style as TI / PI / PO) ============ */
  .header{
    position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;
    margin:0;padding:10px 18px 10px 22px;background:#fff;
    border-bottom:1px solid var(--purple);
    width:100%;box-sizing:border-box;flex-shrink:0;
  }
  .brand{display:flex;align-items:center;gap:10px;min-width:0;flex:0 1 auto;}
  .brand-lockup{width:250px;height:60px;flex-shrink:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}
  .brand-title h1{font-family:Georgia,'Times New Roman',serif;color:var(--purple);font-size:26px;
    letter-spacing:.5px;font-weight:700;line-height:1;}
  .brand-title p{color:var(--green);font-weight:700;font-size:11px;letter-spacing:.3px;margin-top:2px;}
  .tax-invoice-box{
    background:var(--purple);color:#fff;text-align:center;padding:8px 18px;
    display:flex;flex-direction:column;justify-content:center;align-items:center;align-self:center;
    min-width:200px;min-height:64px;border-radius:6px;overflow:visible;height:auto;box-sizing:border-box;
    flex:0 0 auto;
  }
  .tax-invoice-box .ti-title{
    font-size:22px;font-weight:800;letter-spacing:0.5px;margin:0;padding:0;line-height:1.1;white-space:nowrap;
  }
  .tax-invoice-box .ti-sub{
    background:#fff;color:var(--purple);font-size:10px;font-weight:700;letter-spacing:.5px;
    padding:2px 8px;margin-top:4px;white-space:nowrap;
  }

  /* ============ CONTACT BAR ============ */
  .contact-bar{
    display:grid;
    grid-template-columns:minmax(160px,1fr) max-content max-content;
    grid-template-rows:auto auto;
    gap:4px 18px;
    align-items:center;
    padding:8px 18px;
    font-size:9px;
    color:var(--text);
    background:var(--purple-light);
    border-bottom:1px solid var(--purple-border);
    width:100%;
    box-sizing:border-box;
    flex-shrink:0;
    overflow:visible;
  }
  .contact-bar .citem{
    display:flex;align-items:flex-start;gap:6px;min-width:0;overflow:visible;
  }
  .contact-bar .citem:nth-child(1){grid-column:1;grid-row:1 / span 2;align-self:start;}
  .contact-bar .citem:nth-child(2){grid-column:2;grid-row:1;}
  .contact-bar .citem:nth-child(3){grid-column:3;grid-row:1;}
  .contact-bar .citem:nth-child(4){grid-column:2;grid-row:2;}
  .contact-bar .citem:nth-child(5){grid-column:3;grid-row:2;}
  .contact-bar .citem span{
    line-height:1.35;color:var(--purple-dark);font-weight:600;
    word-break:normal;overflow-wrap:normal;hyphens:none;
  }
  .contact-bar .citem.c-addr span{word-break:normal;overflow-wrap:break-word;}
  .contact-bar .citem.c-tight{
    flex:0 0 auto;min-width:max-content;
  }
  .contact-bar .citem.c-tight span{
    white-space:nowrap;overflow:visible;text-overflow:clip;max-width:none;
  }
  .ic{width:12px;height:12px;flex-shrink:0;fill:#5a2d81;fill:var(--purple);margin-top:2px;}

  .body-pad{padding:0 22px 4px;flex:1 1 auto;width:100%;box-sizing:border-box;min-width:0;min-height:0;overflow:visible;display:flex;flex-direction:column;}
  .sheet.quot-hide-features .body-pad{flex:0 0 auto;}

  /* ============ TWO COL INFO ============ */
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;align-items:stretch;width:100%;}
  .info-box{
    border:1px solid var(--purple-border);border-radius:6px;overflow:hidden;
    background:var(--purple-light);display:flex;flex-direction:column;min-width:0;width:100%;height:100%;
  }
  .pill-head{
    background:var(--purple);color:#fff;font-size:10px;font-weight:700;letter-spacing:.4px;
    padding:6px 12px;border-radius:0;display:flex;align-items:center;gap:6px;
    width:100%;box-sizing:border-box;margin:0;flex-shrink:0;
  }
  .pill-head svg{width:12px;height:12px;fill:#fff;flex-shrink:0;}
  .card{
    border:none;border-radius:0;padding:8px 12px;margin:0;background:var(--purple-light);
    position:relative;flex:1 1 auto;width:100%;box-sizing:border-box;
  }
  .card .co-name{font-weight:800;color:var(--purple);font-size:11.5px;}
  .card .addr{color:var(--muted);font-size:9.5px;margin:3px 0 6px 0;line-height:1.35;}
  .info-table{width:100%;border-collapse:collapse;font-size:9.5px;}
  .info-table td{padding:1.5px 0;vertical-align:top;}
  .info-table td.label{font-weight:600;color:var(--muted);width:38%;}
  .info-table td.colon{width:4%;}

  .qd-card{position:relative;}

  /* ============ COMPANY INFO + QUOTATION META + PARTIES (same shell as DC / PI) ============ */
  .info-row{display:flex;gap:12px;margin-top:10px;align-items:stretch;}
  .company-info{flex:1.15;display:flex;justify-content:space-between;align-items:center;gap:12px;
    font-size:10.5px;line-height:1.5;color:var(--text);min-width:0;}
  .company-info .address-col{flex:1;min-width:0;}
  .company-info .line{display:flex;gap:7px;align-items:flex-start;margin-bottom:3px;}
  .company-info .icon{flex-shrink:0;width:14px;height:14px;margin-top:1px;}
  .company-info .icon svg,.meta-row .m-icon svg,.party-head svg{
    width:14px;height:14px;display:block;fill:none;stroke:#3d2b7d;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}
  .reg-details{font-size:10.5px;line-height:1.7;flex-shrink:0;}
  .reg-row{display:grid;grid-template-columns:44px 10px auto;column-gap:4px;align-items:center;white-space:nowrap;}
  .reg-row .label{font-weight:700;color:var(--purple);}
  .invoice-meta{flex:1;min-width:280px;border:1px solid var(--purple);border-radius:6px;overflow:hidden;
    display:flex;flex-direction:column;justify-content:center;}
  .invoice-meta .block{padding:7px 10px;}
  .invoice-meta .block + .block{border-top:1px solid var(--purple);}
  .meta-row{display:grid;grid-template-columns:14px 118px 10px minmax(0,1fr);column-gap:4px;align-items:center;
    margin-bottom:3px;font-size:10.5px;line-height:1.3;white-space:nowrap;color:#231f20;}
  .meta-row:last-child{margin-bottom:0;}
  .meta-row .m-label,.meta-row .m-colon,.meta-row .m-value{font-weight:700;}
  .meta-row .m-value{min-width:0;overflow:hidden;text-overflow:ellipsis;}
  .meta-row .m-icon{display:flex;align-items:center;justify-content:center;}
  .parties{display:flex;gap:10px;margin-top:10px;width:100%;}
  .party{flex:1;min-width:0;border:1px solid var(--purple);border-radius:6px;overflow:hidden;
    display:flex;flex-direction:column;box-sizing:border-box;}
  .party-head{background:var(--purple-light);color:var(--purple);font-weight:800;font-size:10.5px;letter-spacing:.5px;
    padding:6px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--purple-border);}
  .party-body{padding:7px 12px;font-size:10.5px;line-height:1.4;flex:1;color:var(--text);}
  .party-body .cname{color:var(--purple);font-weight:800;margin:0 0 2px;}
  .party-body .addr{margin:0 0 3px;line-height:1.45;}
  .party-body .addr:last-child{margin-bottom:0;}
  .party-foot{border-top:1px solid var(--purple-border);padding:6px 12px;font-size:10.5px;}
  .party-foot .frow,.qt-attention .frow{display:grid;grid-template-columns:max-content 10px minmax(0,1fr);column-gap:6px;margin-bottom:2px;}
  .party-foot .frow:last-child,.qt-attention .frow:last-child{margin-bottom:0;}
  .party-foot .flabel,.qt-attention .flabel{font-weight:700;}
  .qt-attention .frow{grid-template-columns:100px 10px minmax(0,1fr);margin-bottom:4px;}
  .sheet.quot-compact .info-row,.sheet.quot-compact .parties{margin-top:6px;gap:8px;}
  .sheet.quot-compact .company-info,.sheet.quot-compact .reg-details,.sheet.quot-compact .meta-row,
  .sheet.quot-compact .party-head,.sheet.quot-compact .party-body,.sheet.quot-compact .party-foot{font-size:9.5px;}
  .sheet.quot-compact .invoice-meta .block,.sheet.quot-compact .party-body,.sheet.quot-compact .party-foot{padding:5px 10px;}
  .sheet.quot-ultra .company-info .line{margin-bottom:1px;}
  .sheet.quot-ultra .company-info,.sheet.quot-ultra .reg-details,.sheet.quot-ultra .meta-row,
  .sheet.quot-ultra .party-head,.sheet.quot-ultra .party-body,.sheet.quot-ultra .party-foot{font-size:8.5px;line-height:1.3;}

  /* ============ SUBJECT ============ */
  .subject{
    background:var(--purple-light);border-left:4px solid var(--purple);padding:5px 12px;
    margin-top:8px;font-size:10px;font-weight:700;color:var(--purple-dark);
    word-spacing:normal;letter-spacing:normal;white-space:normal;width:100%;box-sizing:border-box;
  }
  .subject span{color:var(--text);font-weight:400;}

  /* ============ LETTER ============ */
  .letter{display:flex;gap:12px;margin-top:8px;align-items:flex-start;}
  .letter-text{
    flex:2;font-size:10px;line-height:1.45;color:#231f20;
    word-spacing:normal;letter-spacing:0.01px;white-space:normal;
    overflow:visible;
  }
  .letter-text p{margin-top:5px;color:#231f20;opacity:1;-webkit-text-fill-color:#231f20;
    word-spacing:normal;letter-spacing:0.01px;white-space:normal;overflow:visible;}
  .letter-text p:first-child{margin-top:0;}
  .letter-text b{color:var(--purple-dark);}
  .sym{white-space:nowrap;word-spacing:0;letter-spacing:0;display:inline;}
  .fac-img{flex:0 0 180px;border-radius:6px;overflow:hidden;height:100px;align-self:stretch;}
  .fac-img img{width:100%;height:100%;object-fit:cover;display:block;}

  /* ============ TABLES ============ */
  .tables{display:flex;flex-direction:column;gap:10px;margin-top:8px;align-items:stretch;width:100%;flex:0 0 auto;overflow:visible;}
  .tables > div{min-width:0;display:flex;flex-direction:column;width:100%;flex:0 0 auto;overflow:visible;}
  .tbl-title{display:flex;align-items:center;gap:6px;background:var(--purple);color:#fff;
    font-size:10px;font-weight:700;letter-spacing:.3px;
    padding:5px 10px;border-radius:6px 6px 0 0;width:100%;box-sizing:border-box;}
  .tbl-title.green{background:var(--green);}
  .tbl-title svg{width:12px;height:12px;fill:#fff;}
  table.dt{
    width:100%;border-collapse:collapse;border:1px solid var(--purple-border);border-top:none;
    flex:0 0 auto;height:auto;max-height:none;overflow:visible;
  }
  table.dt.green{border-color:#bfe0c4;}
  table.dt th{
    background:var(--purple-light);color:var(--purple-dark);
    font-size:9px;font-weight:700;
    padding:5px 6px;border:1px solid var(--purple-border);text-align:center;vertical-align:middle;
    white-space:normal;word-break:normal;line-height:1.25;
    letter-spacing:normal;word-spacing:normal;
  }
  table.dt.green th{background:#eaf7ec;color:var(--green);border-color:#bfe0c4;}
  table.dt td{
    border:1px solid #e6e6e6;padding:5px 6px;
    font-size:9.5px;font-weight:400;
    text-align:center;color:#231f20;vertical-align:middle;
    word-spacing:normal;letter-spacing:normal;white-space:normal;
    font-kerning:none;font-feature-settings:"kern" 0,"liga" 0;
  }
  table.dt tbody tr:nth-child(even) td{background:#f8f4fc;}
  table.dt.green tbody tr:nth-child(even) td{background:#f3faf4;}
  table.dt.green td{border-color:#dcefdf;}
  table.dt td.left{text-align:left;font-weight:400;}
  table.dt td.rate,
  table.dt th:last-child,
  table.dt td:last-child{
    width:140px;white-space:nowrap;
    font-size:9.5px;font-weight:400;letter-spacing:normal;word-spacing:normal;
  }
  table.dt th:first-child, table.dt td:first-child{width:42px;}
  table.dt td.empty-offer{
    width:auto!important;
    max-width:none!important;
    white-space:normal!important;
    word-spacing:0.2em!important;
    letter-spacing:0.01em!important;
    text-align:center;
    color:var(--muted);
    padding:8px 12px;
  }
  /* HSN/SAC codes: same face as cell; stop digit+) collision in PDF capture */
  table.dt .hsn-code{
    font-family:inherit!important;
    font-weight:inherit!important;
    font-style:normal!important;
    font-kerning:none;
    font-feature-settings:"kern" 0,"liga" 0;
    letter-spacing:.02em;
    white-space:nowrap;
  }
  /* Qty is not printed on quotations */
  table.dt th.qty, table.dt td.qty{display:none!important;width:0!important;padding:0!important;border:none!important;}
  /* NIL matches rate text — same color/weight/size as other cells */
  table.dt .nil,
  .nil{
    color:#231f20!important;
    font-family:inherit!important;
    font-size:inherit!important;
    font-weight:400!important;
    letter-spacing:normal!important;
    word-spacing:normal!important;
  }
  table.dt td b,
  table.dt td strong{
    font-family:inherit!important;
    font-weight:700;
    letter-spacing:normal!important;
  }

  /* ============ FEATURES (grow to fill leftover A4 space) ============ */
  .features{
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    grid-template-rows:repeat(2,minmax(0,1fr));
    gap:8px;
    margin:8px 0 4px 0;
    flex:0 0 auto;
    min-height:0;
    align-content:stretch;
  }
  .sheet.quot-features-fill .features{
    flex:1 1 auto!important;
    min-height:0!important;
    height:auto!important;
    align-self:stretch;
  }
  .sheet.quot-features-fill .body-pad{
    flex:1 1 auto!important;
    min-height:0!important;
  }
  .feat{
    border:1px solid #e6e6e6;
    border-top:3px solid var(--purple);
    border-radius:6px;
    padding:6px 6px;
    text-align:center;
    background:#fdfdfd;
    min-width:0;
    min-height:0;
    height:100%;
    width:100%;
    box-sizing:border-box;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:4px;
  }
  .feat .circ{width:22px;height:22px;border-radius:50%;margin:0;display:flex;
    align-items:center;justify-content:center;flex-shrink:0;}
  .feat .circ svg{width:11px;height:11px;}
  .feat p{font-size:8px;font-weight:800;color:var(--text);line-height:1.15;letter-spacing:.05px;margin:0;}

  /* Compact modes when charge tables are tall — keep all rows visible on page 1 */
  .sheet.quot-compact .brand-lockup{width:210px;height:48px;}
  .sheet.quot-compact .tax-invoice-box{min-height:56px;padding:6px 14px;}
  .sheet.quot-compact .tax-invoice-box .ti-title{font-size:18px;}
  .sheet.quot-compact .tax-invoice-box .ti-sub{font-size:8.5px;padding:2px 6px;}
  .sheet.quot-compact .contact-bar{padding:5px 14px;font-size:8px;gap:3px 12px;}
  .sheet.quot-compact .two-col{margin-top:5px;gap:6px!important;}
  .sheet.quot-compact .card{padding:6px 10px;}
  .sheet.quot-compact .subject{margin-top:5px;padding:3px 8px;font-size:9px;}
  .sheet.quot-compact .letter{margin-top:5px;gap:8px;}
  .sheet.quot-compact .letter-text{font-size:9px;line-height:1.3;}
  .sheet.quot-compact .letter-text p{margin-top:3px;}
  .sheet.quot-compact .fac-img{flex-basis:130px;height:72px;}
  .sheet.quot-compact .tables{margin-top:5px;gap:6px!important;}
  .sheet.quot-compact table.dt th,
  .sheet.quot-compact table.dt td{padding:3px 2px!important;font-size:8px!important;}
  .sheet.quot-compact .features{margin:6px 0 2px 0;gap:6px!important;}
  .sheet.quot-compact .feat{padding:5px 4px;gap:3px;}
  .sheet.quot-compact .feat .circ{width:20px;height:20px;}
  .sheet.quot-compact .feat .circ svg{width:10px;height:10px;}
  .sheet.quot-compact .feat p{font-size:7.5px;}
  .sheet.quot-compact-more .body-pad{padding:0 16px 2px;}
  .sheet.quot-compact-more .letter-text{font-size:8.5px;line-height:1.25;}
  .sheet.quot-compact-more .fac-img{display:none!important;}
  .sheet.quot-compact-more .features{min-height:0;}
  .sheet.quot-compact-more .feat{padding:4px 3px;gap:2px;}
  .sheet.quot-compact-more .feat .circ{width:18px;height:18px;margin-bottom:0;}
  .sheet.quot-compact-more .feat .circ svg{width:9px;height:9px;}
  .sheet.quot-compact-more .feat p{font-size:7px;}
  .sheet.quot-compact-more table.dt td,
  .sheet.quot-compact-more table.dt th{padding:2px 2px!important;font-size:7.5px!important;}
  .sheet.quot-compact-more .tbl-title{padding:3px 8px;font-size:9px;}
  .sheet.quot-hide-features .features{display:none!important;}
  .sheet.quot-ultra .letter{margin-top:3px;}
  .sheet.quot-ultra .letter-text p:nth-child(n+3){display:none;}
  .sheet.quot-ultra .two-col{margin-top:4px;}
  .sheet.quot-ultra .tables{margin-top:4px;gap:4px!important;}
  .sheet.quot-ultra table.dt td,
  .sheet.quot-ultra table.dt th{padding:1px 2px!important;font-size:7px!important;line-height:1.15;}
  .sheet.quot-ultra .brand-lockup{width:180px;height:42px;}
  .sheet.quot-ultra .tax-invoice-box{min-height:50px;padding:5px 12px;}
  .sheet.quot-ultra .tax-invoice-box .ti-title{font-size:16px;}
  .sheet.quot-ultra .tax-invoice-box .ti-sub{font-size:8px;padding:1px 5px;}
  .sheet.quot-ultra .contact-bar{padding:4px 12px;font-size:7.5px;}
  /* ============ PAGE 2 ============ */
  .sheet.page2{
    display:flex;
    flex-direction:column;
    width:794px;
    height:1123px;
    min-height:1123px;
    max-height:1123px;
    padding-bottom:0;
    overflow:hidden;
    box-sizing:border-box;
  }
  .page2-header{
    background:var(--purple);color:#fff;display:flex;align-items:center;gap:8px;
    padding:12px 28px;font-size:14px;font-weight:800;letter-spacing:.4px;margin:0;flex-shrink:0;
    width:100%;box-sizing:border-box;
  }
  .page2-header svg{width:16px;height:16px;fill:#fff;}

  .page2-body{
    flex:1 1 auto;
    display:flex;
    flex-direction:column;
    min-height:0;
    gap:12px;
    padding:14px 22px 10px 22px;
  }

  .terms-grid{
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    grid-auto-rows:1fr;
    gap:8px;
    flex:0.75 1 0;
    min-height:0;
    max-height:38%;
  }
  .terms-wrap{
    margin-top:8px;
    flex:0 0 auto;
    display:flex;
    flex-direction:column;
    min-height:0;
  }
  .terms-banner{
    background:var(--purple);
    color:#fff;
    display:flex;
    align-items:center;
    gap:8px;
    padding:6px 10px;
    font-size:11px;
    font-weight:800;
    letter-spacing:.3px;
    border-radius:6px 6px 0 0;
  }
  .terms-banner svg{width:14px;height:14px;fill:#fff;flex-shrink:0;}
  .body-pad .terms-grid{
    flex:0 0 auto;
    max-height:none;
    margin-top:0;
    grid-auto-rows:auto;
  }
  .body-pad .term{height:auto;}
  .page2 .features{
    flex:0 0 auto;
    margin:0 0 8px 0;
    grid-template-rows:auto auto;
  }
  .page2 .feat{height:auto;min-height:78px;}
  .term{
    border:1px solid #e6e6e6;
    border-top:3px solid var(--purple);
    border-radius:6px;
    padding:9px 10px;
    background:#fdfdfd;
    min-width:0;
    height:100%;
    display:flex;
    flex-direction:column;
    gap:5px;
  }
  .term-head{
    display:flex;
    flex-direction:row;
    align-items:center;
    gap:6px;
    flex-shrink:0;
  }
  .term .ticon{width:16px;height:16px;flex-shrink:0;margin:0;}
  .term h4{
    color:var(--purple-dark);
    font-size:10px;
    font-weight:800;
    letter-spacing:.2px;
    margin:0;
    line-height:1.15;
  }
  .term p{
    font-size:9.5px;
    color:#231f20;
    line-height:1.4;
    margin:0;
    word-spacing:normal;letter-spacing:normal;white-space:normal;overflow:visible;
    opacity:1;-webkit-text-fill-color:#231f20;
  }

  .bottom-grid{
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    gap:10px;
    flex:0 0 auto;
    min-height:auto;
    align-items:stretch;
  }
  .quot-continue .features{flex:0 0 auto;margin:0 0 8px 0;grid-template-rows:auto auto;}
  .quot-continue .feat{height:auto;min-height:78px;}
  .quot-continue .terms-wrap + .bottom-grid{margin-top:10px;}
  .bbox{
    background:#f7f9fb;
    border:1px solid #e3e8ee;
    border-radius:6px;
    padding:12px 14px;
    min-width:0;
    height:100%;
    display:flex;
    flex-direction:column;
  }
  .bbox-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-shrink:0;}
  .bbox-head svg{width:14px;height:14px;fill:#2f2263;fill:var(--purple-dark);flex-shrink:0;}
  .bbox-head h4{color:var(--purple-dark);font-size:11px;font-weight:800;letter-spacing:.2px;margin:0;}
  .bbox ol{list-style:none;counter-reset:bbox;padding-left:0;font-size:10px;line-height:1.5;color:#231f20;margin:0;flex:1 1 auto;
    word-spacing:normal;letter-spacing:normal;white-space:normal;overflow:visible;}
  .bbox ol li{counter-increment:bbox;position:relative;padding-left:18px;color:#231f20;opacity:1;-webkit-text-fill-color:#231f20;margin:0;}
  .bbox ol li::before{content:counter(bbox) ".";position:absolute;left:0;top:0;font-weight:700;color:#2f2263;-webkit-text-fill-color:#2f2263;}
  .bbox ol li + li{margin-top:6px;}
  .sign2{
    text-align:right;margin:6px 0 4px auto;padding:0;flex-shrink:0;
    display:flex;flex-direction:column;align-items:center;gap:4px;
    width:fit-content;align-self:flex-end;
  }
  .sign2 .seal-box{
    width:68px;height:68px;border:1px dashed #9a8bb8;border-radius:4px;
    display:flex;align-items:center;justify-content:center;
    color:#9a8bb8;font-size:8px;font-weight:700;letter-spacing:.3px;
    background:#faf8fc;box-sizing:border-box;flex-shrink:0;
  }
  .sign2 p{font-size:10px;color:#231f20;margin:0;text-align:center;}
  .sign2 p small{color:#666;font-weight:400;}
  .page2-lower{
    display:flex;
    flex-direction:column;
    gap:10px;
    flex:1 1 0;
    min-height:0;
  }
  .page2-notes{
    display:flex;gap:14px;align-items:stretch;
    border:1px solid #e6e6e6;border-radius:6px;background:#fff;
    padding:12px 14px;margin:0;flex:0 0 auto;
  }
  .page2-notes .fr-note{flex:1;min-width:0;overflow:visible;}
  .page2-notes .fr-note > p,.page2-notes .fr-note .note-title{
    font-weight:700;font-size:11.5px;margin-bottom:6px;color:#231f20;
    font-style:normal;
  }
  .page2-notes .fr-note ul{
    padding-left:16px;margin:0;list-style:disc;
    font-size:10.5px;color:#231f20;line-height:1.5;
    word-spacing:normal;letter-spacing:normal;white-space:normal;
    overflow:visible;font-style:normal;
  }
  .page2-notes .fr-note li{
    margin:0 0 5px 0;color:#231f20;opacity:1;-webkit-text-fill-color:#231f20;
    word-spacing:normal;letter-spacing:normal;white-space:normal;
    overflow:visible;font-style:normal;font-weight:400;
  }
  .page2-notes .fr-note li:last-child{margin-bottom:0;}
  .page2-notes .fr-qr{
    flex:0 0 104px;text-align:center;border:1px solid #ddd;border-radius:6px;padding:10px 8px;
    background:#fff;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  }
  .page2-notes .fr-qr .qrbox{width:74px;height:74px;margin:0 auto;}
  .page2-notes .fr-qr span{display:block;font-size:7.5px;font-weight:700;color:var(--purple-dark);margin-top:6px;line-height:1.2;}
  .page2-notes .sign2{
    flex:0 0 132px;margin:0;align-self:stretch;justify-content:center;
    border-left:1px dashed #d8cfe6;padding-left:12px;width:auto;
  }
  .page2-spacer{display:none;}
  .bottom-banner{
    background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:space-between;
    padding:7px 14px;font-size:10.5px;position:relative;bottom:auto;left:auto;right:auto;
    width:100%;box-sizing:border-box;flex-shrink:0;margin-top:0;gap:8px;
  }
  .bottom-banner > span{min-width:0;}
  .barfoot{
    background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:space-between;
    padding:7px 14px;font-size:10.5px;width:100%;box-sizing:border-box;flex-shrink:0;margin-top:auto;gap:8px;
  }
  .barfoot span{min-width:0;}

  @media print{
    body{background:#fff;padding:0;}
    .sheet{box-shadow:none;margin:0;width:210mm;min-height:297mm;border-radius:0;}
    .sheet.page2{min-height:297mm;}
  }
</style>
</head>
<body>

<!-- ============================================================ PAGE 1 ============================================================ -->
<div class="sheet pdf-page print-host">

  <!-- HEADER (same layout as TI / PI / PO) -->
  ${buildPrintHeader(profile, 'QUOTATION', 'CONTRACT MICRONIZATION SERVICES')}

  <div class="body-pad">
    <!-- COMPANY + QUOTATION META (same layout as DC / PI) -->
    <div class="info-row">
      <div class="company-info">
        <div class="address-col">
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>${addrLine1}<br>${escHtml(city)} - ${escHtml(pincode)},<br>${escHtml(state)}, India</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span>${phoneStr}</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span><span>${emailStr}</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span><span>${webStr}</span></div>
        </div>
        <div class="reg-details">
          <div class="reg-row"><span class="label">GSTIN</span><span class="colon">:</span><span>${gstStr}</span></div>
          ${companyPan ? `<div class="reg-row"><span class="label">PAN</span><span class="colon">:</span><span>${escHtml(companyPan)}</span></div>` : ''}
          <div class="reg-row"><span class="label">State</span><span class="colon">:</span><span>${escHtml(companyStateName)} (${escHtml(companyStateCode)})</span></div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="block">${quoteMetaRows}</div>
        <div class="block">${contactMetaRows}</div>
      </div>
    </div>

    <!-- PREPARED FOR / KIND ATTENTION (same cards as DC Bill To / Ship To) -->
    <div class="parties">
      <div class="party">
        <div class="party-head"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg> PREPARED FOR</div>
        <div class="party-body"><div class="cname">${partyName}</div>${partyAddressHtml(partyLines)}</div>
        ${partyFootHtml}
      </div>
      ${attentionRows ? `<div class="party">
        <div class="party-head"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg> KIND ATTENTION</div>
        <div class="party-body qt-attention">${attentionRows}</div>
      </div>` : ''}
    </div>

    <!-- SUBJECT -->
    <div class="subject">SUBJECT:&nbsp;<span>${subject}</span></div>

    <!-- LETTER -->
    <div class="letter">
      <div class="letter-text">
        <p><b>Dear Sir/Madam,</b></p>
        <p>With reference to your enquiry, we are pleased to submit our offer for Micronization Services as per the details mentioned below. <b>${companyName}</b>, Vadodara is a Gujarat based company that offers <b>CONTRACT MICRONIZATION SERVICES</b> dedicated to comply the needs of the pharmaceutical industry. Our facility at Ranoli &ndash; Vadodara operates as per cGMP standards with more than <b>500 sq.ft.</b> processing area and large warehouse facility.</p>
        <p>We trust our offer will be in line with your requirement.</p>
        <p>For any techno-commercial queries, please feel free to contact us.</p>
        ${descriptionHtml ? `<p>${descriptionHtml}</p>` : ''}
      </div>
      <div class="fac-img">
        <img src="${factoryImg}" style="width:100%; height:100%; object-fit:cover; display:block;" alt="Micronizer Diagram" />
      </div>
    </div>

    <!-- TABLES -->
    <div class="tables">
      <div>
        <div class="tbl-title"><svg viewBox="0 0 24 24"><path d="M4 4h16v2H4zM4 11h16v2H4zM4 18h16v2H4z"/></svg>COMMERCIAL OFFER</div>
        <table class="dt quote-main-table">
          <thead><tr><th style="width:42px">Sr. No.</th><th>Description</th><th>PSD Requirement</th><th style="width:140px">Rate</th></tr></thead>
          <tbody>
            ${mainRows}
          </tbody>
        </table>
      </div>
      ${optionalCharges.length ? `<div>
        <div class="tbl-title green"><svg viewBox="0 0 24 24"><path d="M12 2l1.9 5.9H20l-4.9 3.6L17 17.5 12 14l-5 3.5 1.9-6L4 7.9h6.1z"/></svg>BELOW ITEMS IF REQUIRED:</div>
        <table class="dt green quote-optional-table">
          <thead><tr><th style="width:42px">Sr. No.</th><th>Description</th><th style="width:140px">Rate</th></tr></thead>
          <tbody>
            ${optionalRows}
          </tbody>
        </table>
      </div>` : ''}
    </div>

    <!-- TERMS (kept on page 1) -->
    <div class="terms-wrap">
      <div class="terms-banner"><svg viewBox="0 0 24 24" fill="#ffffff"><path d="M4 4h16v16H4zM6 8h12M6 12h12M6 16h8"/></svg>TERMS &amp; CONDITIONS</div>
      <div class="terms-grid">
        <div class="term">
          <div class="term-head">
            <svg class="ticon" viewBox="0 0 24 24" fill="#5a2d81"><path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5z"/></svg>
            <h4>TAXES</h4>
          </div>
          <p>GST will be charged extra as applicable.</p>
        </div>
        <div class="term">
          <div class="term-head">
            <svg class="ticon" viewBox="0 0 24 24" fill="#2f9e8f"><path d="M17 4L4 17l1.4 1.4L18.4 5.4zM6.5 4a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm11 10a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>
            <h4>PROCESS LOSS</h4>
          </div>
          <p>Loss occurs during processing is on your account.</p>
        </div>
        <div class="term">
          <div class="term-head">
            <svg class="ticon" viewBox="0 0 24 24" fill="#2e8b3d"><path d="M12 4V1L8 5l4 4V6a6 6 0 11-6 6H4a8 8 0 108-8z"/></svg>
            <h4>BATCH / CHANGE OVER</h4>
          </div>
          <p>If same material is required to be micronized in separate batch<span class="sym">(es)</span> or different PSD specification, Change Over Charge <span class="sym">@ ₹&nbsp;500/-</span> per batch or per specification will be applicable.</p>
        </div>
        <div class="term">
          <div class="term-head">
            <svg class="ticon" viewBox="0 0 24 24" fill="#f5811f"><path d="M3 6h11v8H3zM14 9h4l3 3v2h-7zM6.5 19a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z"/></svg>
            <h4>OTHER CHARGES</h4>
          </div>
          <p>This is only processing charges. All other charges like Transportation, Insurance, Repacking material charges will be extra.</p>
        </div>
        <div class="term">
          <div class="term-head">
            <svg class="ticon" viewBox="0 0 24 24" fill="#2f9e8f"><path d="M2 5h20v14H2zm0 4h20v2H2zm3 5h6v2H5z"/></svg>
            <h4>PAYMENT TERMS</h4>
          </div>
          <p>100% Advance against Performa Invoice.</p>
        </div>
        <div class="term">
          <div class="term-head">
            <svg class="ticon" viewBox="0 0 24 24" fill="#2f9e8f"><path d="M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z"/></svg>
            <h4>VALIDITY</h4>
          </div>
          <p>This quotation is valid up to ${validityDate}.</p>
        </div>
      </div>
    </div>

  </div>

  ${buildStatusBar('Page 1 of 2', PRINT_FOOTER_MESSAGES.QT)}
</div>

<!-- ============================================================ PAGE 2 ============================================================ -->
<div class="sheet pdf-page page2">
  <div class="page2-body">
  <div class="bottom-grid">
    <div class="bbox">
      <div class="bbox-head">
        <svg viewBox="0 0 24 24"><path d="M4 3h16v18l-8-4-8 4zM7 8h10v2H7zM7 12h6v2H7z"/></svg>
        <h4>IMPORTANT NOTES</h4>
      </div>
      <ol>
        <li>Please send Purchase Order and specification letter regarding particle size requirement, material dispatch destination with preferred transporter / courier along with material.</li>
        <li>Please send extra drums and other repacking materials considering increase of volume after micronization &amp; micronized materials to be repacked in fresh bags.</li>
        <li>Material must be Non-Hazardous, uniform, dry and free flow powder form. Declaration form regarding material's non hazardous property is mandatory.</li>
      </ol>
    </div>

    <div class="bbox">
      <div class="bbox-head">
        <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H5zm14.5-9.5a3.5 3.5 0 10-3.4-4.3c.6.5 1 1.2 1.3 1.9a5 5 0 012.1 2.4z"/></svg>
        <h4>CUSTOMER RESPONSIBILITIES</h4>
      </div>
      <ol>
        <li>Material must be non-hazardous and free from any contamination.</li>
        <li>Material specification and desired PSD must be clearly mentioned.</li>
        <li>All documents &amp; regulatory forms to be provided along with material.</li>
        <li>Repacking material to be provided if customer does not opt for our material.</li>
      </ol>
    </div>
  </div>

  <div class="features">
    <div class="feat">
      <div class="circ" style="background:#eee6f7;"><svg viewBox="0 0 24 24" fill="#5a2d81"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm-1 13l5.5-5.5-1.4-1.4L11 12.2 8.9 10 7.5 11.5 11 15z"/></svg></div>
      <p>cGMP COMPLIANT FACILITY</p>
    </div>
    <div class="feat">
      <div class="circ" style="background:#e2eefb;"><svg viewBox="0 0 24 24" fill="#2f6fbf"><path d="M19.4 13a7.6 7.6 0 000-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-1.7-1L14.9 3H9.1l-.4 2.4a7.4 7.4 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7.6 7.6 0 000 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.4h5.8l.4-2.4c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"/></svg></div>
      <p>CONTRACT MICRONIZATION EXPERTS</p>
    </div>
    <div class="feat">
      <div class="circ" style="background:#e3f4e5;"><svg viewBox="0 0 24 24" fill="#2e8b3d"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 17a7 7 0 110-14 7 7 0 010 14zm0-11a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4z"/></svg></div>
      <p>PARTICLE SIZE ANALYSIS &amp; DEVELOPMENT</p>
    </div>
    <div class="feat">
      <div class="circ" style="background:#fdeadb;"><svg viewBox="0 0 24 24" fill="#f5811f"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM12 5.2L18 8l-6 3.3L6 8l6-2.8zM5 9.7l6 3.3v6.5l-6-3.3V9.7zm8 9.8v-6.5l6-3.3v6.5l-6 3.3z"/></svg></div>
      <p>CLEAN ROOM PROCESSING AREA</p>
    </div>
    <div class="feat">
      <div class="circ" style="background:#fbe3e6;"><svg viewBox="0 0 24 24" fill="#d94459"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 10.5V6h-2v7l5.2 3.1 1-1.6L13 12.5z"/></svg></div>
      <p>ON TIME DELIVERY</p>
    </div>
    <div class="feat">
      <div class="circ" style="background:#dfeaf5;"><svg viewBox="0 0 24 24" fill="#4a6fa5"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H5zm14.5-9.5a3.5 3.5 0 10-3.4-4.3c.6.5 1 1.2 1.3 1.9a5 5 0 012.1 2.4zM19 13.3c1.8.7 3 2 3 3.7v1h-3.1a8.9 8.9 0 00-1-3.6c.4-.4.8-.7 1.1-1.1z"/></svg></div>
      <p>DEDICATED TECHNICAL SUPPORT</p>
    </div>
  </div>

  <div class="page2-lower">
  <div class="page2-notes">
    <div class="fr-note">
      <p class="note-title">Note:</p>
      <ul>
        ${notesListHtml}
      </ul>
    </div>
    <div class="fr-qr">
      <div class="qrbox">
        <img src="${qrImg}" style="width:100%; height:100%; object-fit:contain; display:block;" alt="QR Code" />
      </div>
      <span>SCAN TO VISIT OUR WEBSITE</span>
    </div>
    <div class="sign2">
      ${profile.stamp ? `<img src="${profile.stamp}" alt="Stamp" style="max-height:54px;max-width:100px;object-fit:contain;display:block;margin:0 auto 4px auto;" />` : '<div class="seal-box">SEAL</div>'}
      <p><b>For ${companyName}</b></p>
      <p><b>${sigName}</b><br><small>Authorised Signatory</small></p>
    </div>
  </div>
  </div>
  <div class="page2-spacer"></div>
  </div>

  ${buildStatusBar('Page 2 of 2', PRINT_FOOTER_MESSAGES.QT)}
</div>

</body>
</html>`;
};

const quotePageHeight = (page) => {
  page.style.height = 'auto';
  page.style.maxHeight = 'none';
  page.style.minHeight = '0';
  page.style.overflow = 'visible';
  page.style.transform = 'none';
  page.style.zoom = '1';
  void page.offsetHeight;
  return Math.max(page.scrollHeight, page.offsetHeight || 0);
};

const lockQuotePage = (page, singlePageHeight) => {
  page.style.width = '';
  page.style.transform = 'none';
  page.style.zoom = '1';
  page.style.display = 'flex';
  page.style.flexDirection = 'column';
  page.style.height = `${singlePageHeight}px`;
  page.style.minHeight = `${singlePageHeight}px`;
  page.style.maxHeight = `${singlePageHeight}px`;
  page.style.overflow = 'hidden';
  const body = page.querySelector('.body-pad, .page2-body');
  if (body) {
    body.style.setProperty('flex', '1 1 auto', 'important');
    body.style.setProperty('min-height', '0', 'important');
  }
  page.querySelectorAll('.barfoot').forEach((el) => {
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('margin-top', 'auto', 'important');
    el.style.setProperty('flex-shrink', '0', 'important');
  });
};

const renumberQuotePages = (doc) => {
  const pages = [...doc.querySelectorAll('.sheet.pdf-page')];
  const total = pages.length || 1;
  pages.forEach((page, index) => {
    const span = [...page.querySelectorAll('.barfoot span')]
      .find((el) => /page\s+\d+\s+of\s+\d+/i.test(el.textContent || ''));
    if (span) span.textContent = `Page ${index + 1} of ${total}`;
  });
};

const quoteTableKey = (block) => {
  const table = block?.querySelector?.('table');
  if (!table) return '';
  if (table.classList.contains('quote-main-table')) return 'main';
  if (table.classList.contains('quote-optional-table')) return 'optional';
  return table.className || 'table';
};

const continuationAfter = (doc, page) => {
  const next = page.nextElementSibling;
  if (next?.classList.contains('quot-continue')) return next;
  const fresh = doc.createElement('div');
  fresh.className = 'sheet pdf-page quot-continue';
  const proto = doc.querySelector('.sheet.pdf-page') || page;
  const header = proto.querySelector('.header');
  const contact = proto.querySelector('.contact-bar');
  if (header) fresh.appendChild(header.cloneNode(true));
  if (contact) fresh.appendChild(contact.cloneNode(true));
  const body = doc.createElement('div');
  body.className = 'body-pad';
  fresh.appendChild(body);
  const foot = proto.querySelector('.barfoot');
  if (foot) fresh.appendChild(foot.cloneNode(true));
  if (page.parentNode) page.parentNode.insertBefore(fresh, page.nextSibling);
  return fresh;
};

const quoteBody = (page) => page?.querySelector?.('.body-pad, .page2-body');

const meaningfulChildren = (el) => [...(el?.children || [])].filter((child) => {
  if (child.classList?.contains('page2-spacer')) return false;
  return true;
});

const placeAtStart = (parent, node) => {
  parent.insertBefore(node, parent.firstChild);
};

const slotOnNext = (doc, page, node) => {
  const next = continuationAfter(doc, page);
  const dest = next.querySelector('.body-pad');
  if (node.classList?.contains('term')) {
    let grid = dest.querySelector(':scope > .terms-wrap .terms-grid, :scope > .terms-grid');
    if (!grid) {
      const wrap = doc.createElement('div');
      wrap.className = 'terms-wrap';
      const banner = page.querySelector('.terms-banner');
      if (banner) wrap.appendChild(banner.cloneNode(true));
      grid = doc.createElement('div');
      grid.className = 'terms-grid';
      wrap.appendChild(grid);
      placeAtStart(dest, wrap);
    }
    placeAtStart(grid, node);
    return;
  }
  if (node.classList?.contains('feat')) {
    let grid = dest.querySelector(':scope > .features');
    if (!grid) {
      grid = doc.createElement('div');
      grid.className = 'features';
      placeAtStart(dest, grid);
    }
    placeAtStart(grid, node);
    return;
  }
  if (node.tagName === 'LI') {
    let list = dest.querySelector(':scope > .page2-notes ul, :scope > ul');
    if (!list) {
      const box = doc.createElement('div');
      box.className = 'page2-notes';
      const note = doc.createElement('div');
      note.className = 'fr-note';
      const title = doc.createElement('p');
      title.className = 'note-title';
      title.textContent = 'Note (continued):';
      list = doc.createElement('ul');
      note.append(title, list);
      box.appendChild(note);
      placeAtStart(dest, box);
    }
    placeAtStart(list, node);
    return;
  }
  if (node.matches?.('tbody tr, tr')) {
    return;
  }
  const ownList = node.matches?.('.page2-notes') ? node.querySelector('ul') : node.querySelector?.('.page2-notes ul');
  const carried = ownList && dest.querySelector(':scope > .page2-notes');
  if (carried && !node.contains(carried)) {
    const lines = carried.querySelector('ul');
    if (lines) ownList.append(...lines.children);
    carried.remove();
  }
  placeAtStart(dest, node);
};

const moveLastTableRow = (doc, page, tables) => {
  const blocks = [...tables.children];
  const last = blocks[blocks.length - 1];
  if (!last) return false;
  const rows = [...last.querySelectorAll('tbody tr')];
  if (!rows.length) return false;
  const body = quoteBody(page);
  const other = meaningfulChildren(body).some((el) => el !== tables);
  if (rows.length === 1 && blocks.length === 1 && !other) return false;
  const next = continuationAfter(doc, page);
  const tbody = destTableBlock(doc, next, last).querySelector('tbody');
  if (!tbody) return false;
  placeAtStart(tbody, rows[rows.length - 1]);
  if (!last.querySelector('tbody tr')) last.remove();
  if (!tables.children.length) tables.remove();
  return true;
};

/** Move the bottom-most piece that does not fit onto the following page. */
const shiftQuoteOverflow = (doc, page) => {
  const body = quoteBody(page);
  if (!body) return false;

  const shiftFrom = (container) => {
    const kids = meaningfulChildren(container);
    if (!kids.length) return false;
    const tail = kids[kids.length - 1];

    if (tail.classList?.contains('tables')) {
      if (moveLastTableRow(doc, page, tail)) return true;
      if (kids.length > 1) {
        slotOnNext(doc, page, tail);
        return true;
      }
      return false;
    }

    if (tail.classList?.contains('page2-lower') || tail.classList?.contains('page2-notes')) {
      const list = tail.classList.contains('page2-notes') ? tail.querySelector('ul') : null;
      if (list && list.children.length > 1) {
        slotOnNext(doc, page, list.lastElementChild);
        return true;
      }
      if (!list && shiftFrom(tail)) return true;
      if (kids.length > 1) {
        slotOnNext(doc, page, tail);
        return true;
      }
      return false;
    }

    if (kids.length > 1) {
      slotOnNext(doc, page, tail);
      return true;
    }

    if (tail.classList?.contains('terms-wrap') || tail.classList?.contains('terms-grid')) {
      const grid = tail.querySelector?.('.terms-grid') || tail;
      const cards = meaningfulChildren(grid);
      if (cards.length > 1) {
        slotOnNext(doc, page, cards[cards.length - 1]);
        return true;
      }
    }
    if (tail.classList?.contains('features')) {
      const cards = meaningfulChildren(tail);
      if (cards.length > 1) {
        slotOnNext(doc, page, cards[cards.length - 1]);
        return true;
      }
    }
    const list = tail.querySelector?.('ul');
    if (list && list.children.length > 1 && (tail.classList?.contains('fr-note') || tail.classList?.contains('page2-notes') || tail.closest?.('.page2-notes'))) {
      slotOnNext(doc, page, list.lastElementChild);
      return true;
    }
    return false;
  };

  return shiftFrom(body);
};

const spillQuoteUntilFit = (doc, singlePageHeight) => {
  let guard = 0;
  let page = doc.querySelector('.sheet.pdf-page');
  while (page && guard < 400) {
    guard += 1;
    const height = quotePageHeight(page);
    if (height <= singlePageHeight + 4) {
      page = page.nextElementSibling;
      continue;
    }
    if (!shiftQuoteOverflow(doc, page)) page = page.nextElementSibling;
  }
  doc.querySelectorAll('.quot-continue').forEach((extra) => {
    const body = extra.querySelector('.body-pad');
    if (!body || !String(body.textContent || '').trim()) extra.remove();
  });
};

/** When the T&C boxes spill onto a continuation page, continue page 2's content right after them on that page. */
const flowPage2AfterTerms = (doc) => {
  const page2 = doc.querySelector('.sheet.page2');
  const terms = [...doc.querySelectorAll('.sheet.pdf-page .terms-wrap')].pop();
  const termsPage = terms?.closest('.sheet.pdf-page');
  if (!page2 || !termsPage?.classList.contains('quot-continue')) return false;
  const dest = termsPage.querySelector('.body-pad');
  if (!dest) return false;

  const absorb = (child) => {
    if (child.classList?.contains('page2-spacer')) return;
    const extra = child.classList?.contains('page2-notes') ? child.querySelector('ul') : null;
    const list = extra && dest.querySelector('.page2-notes ul');
    if (list && list !== extra) {
      list.append(...extra.children);
      return;
    }
    dest.appendChild(child);
  };

  [...(quoteBody(page2)?.children || [])].forEach(absorb);
  let next = page2.nextElementSibling;
  page2.remove();
  while (next?.classList.contains('quot-continue')) {
    const after = next.nextElementSibling;
    [...(next.querySelector('.body-pad')?.children || [])].forEach(absorb);
    next.remove();
    next = after;
  }
  return true;
};

/**
 * Flow quotation content onto as many A4 pages as it needs.
 * Rows, terms, notes, and feature cards move to the next page instead of being clipped.
 */
export const fitQuotationToTwoPages = (doc, { singlePageHeight = 1123 } = {}) => {
  if (!doc) return;

  doc.querySelectorAll('.quot-continue').forEach((el) => el.remove());
  doc.querySelectorAll('.sheet.pdf-page tr.filler-row').forEach((tr) => tr.remove());

  doc.querySelectorAll('table.dt').forEach((table) => {
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const qtyIndexes = [];
    [...headerRow.children].forEach((th, idx) => {
      const label = String(th.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^qty$/i.test(label) || th.classList.contains('qty')) qtyIndexes.push(idx);
    });
    qtyIndexes.reverse().forEach((colIdx) => {
      table.querySelectorAll('tr').forEach((tr) => {
        const cell = tr.children[colIdx];
        if (cell) cell.remove();
      });
    });
  });

  doc.querySelectorAll('.sheet.pdf-page').forEach((page) => {
    page.style.zoom = '1';
    page.style.transform = 'none';
    page.style.width = '';
    page.classList.remove(
      'quot-compact',
      'quot-compact-more',
      'quot-hide-features',
      'quot-ultra',
      'quot-features-fill'
    );
    page.style.height = 'auto';
    page.style.maxHeight = 'none';
    page.style.minHeight = '0';
    page.style.overflow = 'visible';
    const body = quoteBody(page);
    if (body) {
      body.style.setProperty('flex', '0 0 auto', 'important');
      body.style.setProperty('height', 'auto', 'important');
      body.style.setProperty('max-height', 'none', 'important');
      body.style.setProperty('overflow', 'visible', 'important');
    }
    page.querySelectorAll('.tables, .tables > div, table.dt, .terms-wrap, .features, .page2-lower').forEach((el) => {
      el.style.setProperty('flex', '0 0 auto', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    });
  });

  spillQuoteUntilFit(doc, singlePageHeight);
  if (flowPage2AfterTerms(doc)) spillQuoteUntilFit(doc, singlePageHeight);

  doc.querySelectorAll('.sheet.pdf-page').forEach((page) => {
    const height = quotePageHeight(page);
    if (height <= singlePageHeight + 8) lockQuotePage(page, singlePageHeight);
  });

  renumberQuotePages(doc);
};

const destTableBlock = (doc, nextPage, sourceBlock) => {
  const body = nextPage.querySelector('.body-pad');
  let tables = body.querySelector(':scope > .tables');
  if (!tables) {
    tables = doc.createElement('div');
    tables.className = 'tables';
    body.insertBefore(tables, body.firstChild);
  }
  const key = quoteTableKey(sourceBlock);
  let block = [...tables.children].find((el) => quoteTableKey(el) === key);
  if (!block) {
    block = sourceBlock.cloneNode(true);
    const tbody = block.querySelector('tbody');
    if (tbody) tbody.replaceChildren();
    const sourceOrder = [...(sourceBlock.parentElement?.children || [])].map(quoteTableKey);
    const insertAt = sourceOrder.indexOf(key);
    const before = [...tables.children].find((el) => sourceOrder.indexOf(quoteTableKey(el)) > insertAt);
    if (before) tables.insertBefore(block, before);
    else tables.appendChild(block);
  }
  return block;
};

export const renderQuotationPdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const quote = enrichQuotationForPrint(data);
  const html = buildQuotationHtml(quote, quote.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'QT',
    docNo: data.quotationNo || quote.quotationNo || 'N/A',
    partyName: data.partyName || quote.partyName || '',
    data: quote,
    width: 794,
    fitPage: true,
    printPrefs,
    prepareDoc: fitQuotationToTwoPages,
    splitOverflowPages: true
  });
};
