import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy, formatPdfDateSlash } from './taxInvoiceLayout';
import {
  escHtml,
  renderHtmlToPdf,
  buildPrintHeader,
  buildStatusBar,
  PRINT_FOOTER_MESSAGES
} from './printTheme';
import { formatPrintRateText, formatQuotedRate, mergeRateUnits, defaultRateUnit } from './quotationRates';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const formatQuoteDateLong = (d) => {
  if (!d) return '';
  try {
    const str = String(d);
    const date = str.length === 10 && str[4] === '-'
      ? new Date(`${str}T00:00:00`)
      : new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return `${String(date.getDate()).padStart(2, '0')}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
  } catch {
    return String(d);
  }
};

const splitAddress = (address) => {
  if (!address) return '';
  return address
    .split('\n')
    .map((l) => escHtml(l.trim()))
    .filter(Boolean)
    .join('<br>');
};

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

const defaultPrintSection = (key) =>
  MAIN_PRINT_CHARGES.some((item) => item.key === key) ? 'main' : 'optional';

const printSectionFor = (data, key) =>
  data.chargeSection?.[key] || defaultPrintSection(key);

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

/** Merge product snapshot + top-level quote so print sees the ticked charges. */
export const enrichQuotationForPrint = (data = {}) => {
  const productName = firstProductName(data);
  const saved = (productName && data.productSettings?.[productName]) || {};
  const charges = { ...(saved.charges || {}), ...(data.charges || {}) };
  const rates = { ...(saved.rates || {}), ...(data.rates || {}) };
  const chargeNotes = { ...(saved.chargeNotes || {}), ...(data.chargeNotes || {}) };
  const chargeSection = { ...(saved.chargeSection || {}), ...(data.chargeSection || {}) };
  const rateUnits = mergeRateUnits({ ...(saved.rateUnits || {}), ...(data.rateUnits || {}) });
  const mainCharges = (data.mainCharges && data.mainCharges.length)
    ? data.mainCharges
    : (saved.mainCharges || []);
  const optionalCharges = (data.optionalCharges && data.optionalCharges.length)
    ? data.optionalCharges
    : (saved.optionalCharges || []);
  return {
    ...data,
    charges,
    rates,
    chargeNotes,
    chargeSection,
    rateUnits,
    mainCharges,
    optionalCharges,
    qty: data.qty ?? saved.qty,
    psdRequirement: data.psdRequirement || saved.psdRequirement || ''
  };
};

/** Tick flag or a row already in the Main/Optional table counts as selected. */
const isChargeSelected = (data, item) =>
  Boolean(data.charges?.[item.key]) || Boolean(savedRowFor(data, item.key));

const resolveChargesForPrint = (data) => {
  const mainCharges = [];
  const optionalCharges = [];
  ALL_PRINT_CHARGES.forEach((item) => {
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
  const qtnNo = escHtml(data.quotationNo || 'N/A');
  const qtnDate = escHtml(formatQuoteDateLong(data.date) || formatPdfDateDmy(data.date) || 'N/A');
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
      : `<tr><td colspan="4" style="text-align:center;color:var(--muted)">No charges selected</td></tr>`;

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
  const addrLine2 = escHtml(`${city} - ${pincode}, ${state}, India`);
  const phoneRaw = String(profile.phone || '+91 97120 00297').trim();
  const phoneStr = escHtml(
    phoneRaw.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')
      .replace(/^\+91(\d{10})$/, (_, d) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`)
  );
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

  const partyName = escHtml(data.partyName || '');
  const partyAddr = splitAddress(data.partyAddress || data.address || '');
  const partyGstinRaw = data.gstin || '';
  const partyContactRaw = data.contactPerson || '';
  const partyMobileRaw = data.partyMobile || data.mobile || '';
  const partyEmailRaw = data.partyEmail || data.email || '';
  const partyInfoRows = [
    ['GSTIN', partyGstinRaw],
    ['Contact Person', partyContactRaw],
    ['Mobile', partyMobileRaw],
    ['Email', partyEmailRaw]
  ].filter(([, v]) => String(v || '').trim())
    .map(([label, v]) => `<tr><td class="label">${label}</td><td class="colon">:</td><td>${escHtml(v)}</td></tr>`)
    .join('');

  const quoteDetailRows = [
    ['Quotation No.', qtnNo],
    ['Quotation Date', qtnDate],
    ...(String(data.validityDate || '').trim() ? [['Validity', validityDate]] : []),
    ['Contact Person', sigName],
    ['Mobile', phoneStr],
    ['Email', emailStr]
  ].map(([label, v]) => `<tr><td class="label">${label}</td><td class="colon">:</td><td>${v}</td></tr>`)
    .join('');

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
  .ic{width:12px;height:12px;flex-shrink:0;fill:var(--purple);margin-top:2px;}

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
    flex:1 1 0;
    min-height:0;
    align-items:stretch;
  }
  .bbox{
    background:#f7f9fb;
    border:1px solid #e3e8ee;
    border-radius:6px;
    padding:12px 14px;
    min-width:0;
    height:100%;
    min-height:0;
    display:flex;
    flex-direction:column;
  }
  .bbox-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-shrink:0;}
  .bbox-head svg{width:14px;height:14px;fill:var(--purple-dark);flex-shrink:0;}
  .bbox-head h4{color:var(--purple-dark);font-size:11px;font-weight:800;letter-spacing:.2px;margin:0;}
  .bbox ol{padding-left:15px;font-size:10px;line-height:1.5;color:#231f20;margin:0;flex:1 1 auto;
    word-spacing:normal;letter-spacing:normal;white-space:normal;overflow:visible;}
  .bbox ol li{color:#231f20;opacity:1;-webkit-text-fill-color:#231f20;margin:0;}
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
  .page2-spacer{display:none;}
  .bottom-banner{
    background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:space-between;
    padding:7px 14px;font-size:10.5px;position:relative;bottom:auto;left:auto;right:auto;
    width:100%;box-sizing:border-box;flex-shrink:0;margin-top:0;gap:8px;
  }
  .bottom-banner > span{min-width:0;}
  .barfoot{
    background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:space-between;
    padding:7px 14px;font-size:10.5px;width:100%;box-sizing:border-box;flex-shrink:0;margin-top:0;gap:8px;
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

  <!-- CONTACT BAR -->
  <div class="contact-bar">
    <div class="citem c-addr">
      <svg class="ic" viewBox="0 0 24 24"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>
      <span>${addrLine1}<br>${addrLine2}</span>
    </div>
    <div class="citem c-tight">
      <svg class="ic" viewBox="0 0 24 24"><path d="M4 3h12a2 2 0 012 2v14l-8-3.5L2 19V5a2 2 0 012-2zm3 4h6v2H7V7zm0 4h6v2H7v-2z"/></svg>
      <span>GSTIN: ${gstStr}</span>
    </div>
    <div class="citem c-tight">
      <svg class="ic" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1L6.6 10.8z"/></svg>
      <span>${phoneStr}</span>
    </div>
    <div class="citem c-tight">
      <svg class="ic" viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
      <span>${emailStr}</span>
    </div>
    <div class="citem c-tight">
      <svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-3a15.6 15.6 0 00-1.4-3.9A8 8 0 0118.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8 8 0 010-4h3.4a17 17 0 000 4H4.3zm.8 2h3a15.6 15.6 0 001.4 3.9A8 8 0 015.1 16zm3-8H5.1a8 8 0 014.4-3.9A15.6 15.6 0 008.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a13 13 0 010-4h4.6a13 13 0 010 4zm.4 5.9c.6-1.2 1.1-2.5 1.4-3.9h3a8 8 0 01-4.4 3.9zm1.8-5.9a17 17 0 000-4h3.4a8 8 0 010 4h-3.4z"/></svg>
      <span>${webStr}</span>
    </div>
  </div>

  <div class="body-pad">
    <!-- TWO COL -->
    <div class="two-col">
      <div class="info-box">
        <div class="pill-head"><svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z"/></svg>PREPARED FOR</div>
        <div class="card">
          <div class="co-name">${partyName}</div>
          <div class="addr">${partyAddr}</div>
          <table class="info-table">
            ${partyInfoRows}
          </table>
        </div>
      </div>

      <div class="info-box">
        <div class="pill-head"><svg viewBox="0 0 24 24"><path d="M6 2h12a1 1 0 011 1v18l-7-3-7 3V3a1 1 0 011-1z"/></svg>QUOTATION DETAILS</div>
        <div class="card qd-card">
          <table class="info-table">
            ${quoteDetailRows}
          </table>
        </div>
      </div>
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

    <!-- FEATURES -->
    <div class="features">
      <div class="feat">
        <div class="circ" style="background:#eee6f7;"><svg viewBox="0 0 24 24" fill="var(--purple)"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm-1 13l5.5-5.5-1.4-1.4L11 12.2 8.9 10 7.5 11.5 11 15z"/></svg></div>
        <p>cGMP COMPLIANT FACILITY</p>
      </div>
      <div class="feat">
        <div class="circ" style="background:#e2eefb;"><svg viewBox="0 0 24 24" fill="#2f6fbf"><path d="M19.4 13a7.6 7.6 0 000-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-1.7-1L14.9 3H9.1l-.4 2.4a7.4 7.4 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7.6 7.6 0 000 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.4h5.8l.4-2.4c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"/></svg></div>
        <p>CONTRACT MICRONIZATION EXPERTS</p>
      </div>
      <div class="feat">
        <div class="circ" style="background:#e3f4e5;"><svg viewBox="0 0 24 24" fill="var(--green)"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 17a7 7 0 110-14 7 7 0 010 14zm0-11a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4z"/></svg></div>
        <p>PARTICLE SIZE ANALYSIS &amp; DEVELOPMENT</p>
      </div>
      <div class="feat">
        <div class="circ" style="background:#fdeadb;"><svg viewBox="0 0 24 24" fill="var(--orange)"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM12 5.2L18 8l-6 3.3L6 8l6-2.8zM5 9.7l6 3.3v6.5l-6-3.3V9.7zm8 9.8v-6.5l6-3.3v6.5l-6 3.3z"/></svg></div>
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

  </div>

  ${buildStatusBar('Page 1 of 2', PRINT_FOOTER_MESSAGES.QT)}
</div>

<!-- ============================================================ PAGE 2 ============================================================ -->
<div class="sheet pdf-page page2">
  <div class="page2-header"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM6 8h12M6 12h12M6 16h8"/></svg>TERMS &amp; CONDITIONS</div>

  <div class="page2-body">
  <div class="terms-grid">
    <div class="term">
      <div class="term-head">
        <svg class="ticon" viewBox="0 0 24 24" fill="var(--purple)"><path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5z"/></svg>
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
        <svg class="ticon" viewBox="0 0 24 24" fill="var(--green)"><path d="M12 4V1L8 5l4 4V6a6 6 0 11-6 6H4a8 8 0 108-8z"/></svg>
        <h4>BATCH / CHANGE OVER</h4>
      </div>
      <p>If same material is required to be micronized in separate batch<span class="sym">(es)</span> or different PSD specification, Change Over Charge <span class="sym">@ ₹&nbsp;500/-</span> per batch or per specification will be applicable.</p>
    </div>
    <div class="term">
      <div class="term-head">
        <svg class="ticon" viewBox="0 0 24 24" fill="var(--orange)"><path d="M3 6h11v8H3zM14 9h4l3 3v2h-7zM6.5 19a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z"/></svg>
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

  <div class="page2-lower">
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
  </div>
  </div>
  <div class="page2-spacer"></div>

  <div class="sign2">
    <div class="seal-box">SEAL</div>
    <p><b>For ${companyName}</b></p>
    <p><b>${sigName}</b><br><small>Authorised Signatory</small></p>
  </div>
  </div>

  ${buildStatusBar('Page 2 of 2', PRINT_FOOTER_MESSAGES.QT)}
</div>

</body>
</html>`;
};

/**
 * Fit quotation page 1 onto one A4 sheet without clipping charge rows.
 * Tables always win: hide/compact chrome first, then optionally restore features
 * only when leftover space is enough. Never let feature flex steal table height.
 */
export const fitQuotationToTwoPages = (doc, { singlePageHeight = 1123, density = 'base' } = {}) => {
  if (!doc) return;

  doc.querySelectorAll('.quot-continue').forEach((el) => el.remove());
  doc.querySelectorAll('.sheet.pdf-page:not(.page2) tr.filler-row').forEach((tr) => tr.remove());

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

  const pages = [...doc.querySelectorAll('.sheet.pdf-page')];
  pages.forEach((page) => {
    const isPage2 = page.classList.contains('page2');
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

    if (isPage2) {
      page.style.height = `${singlePageHeight}px`;
      page.style.minHeight = `${singlePageHeight}px`;
      page.style.maxHeight = `${singlePageHeight}px`;
      page.style.overflow = 'hidden';
      return;
    }

    const features = page.querySelector('.features');
    const facImg = page.querySelector('.fac-img');
    const tablesBox = page.querySelector('.tables');
    const bodyPad = page.querySelector('.body-pad');

    page.style.height = 'auto';
    page.style.maxHeight = 'none';
    page.style.minHeight = '0';
    page.style.overflow = 'visible';
    if (tablesBox) {
      tablesBox.style.setProperty('flex', '0 0 auto', 'important');
      tablesBox.style.setProperty('height', 'auto', 'important');
      tablesBox.style.setProperty('max-height', 'none', 'important');
      tablesBox.style.setProperty('overflow', 'visible', 'important');
    }
    page.querySelectorAll('.tables > div, table.dt').forEach((el) => {
      el.style.setProperty('flex', '0 0 auto', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    });
    if (features) {
      features.style.display = '';
      features.style.setProperty('flex', '0 0 auto', 'important');
      features.style.setProperty('min-height', '0', 'important');
    }
    if (facImg) facImg.style.display = '';
    if (bodyPad) {
      bodyPad.style.setProperty('flex', '0 0 auto', 'important');
      bodyPad.style.setProperty('overflow', 'visible', 'important');
      bodyPad.style.setProperty('min-height', '0', 'important');
    }

    // Fit charge tables first — features stay hidden until we know there is room.
    page.classList.add('quot-hide-features');
    if (density === 'lg' || density === 'xl') page.classList.add('quot-compact');
    if (density === 'xl') page.classList.add('quot-compact-more');
    void page.offsetHeight;

    const pageH = () => Math.max(page.scrollHeight, page.offsetHeight || 0);
    const steps = [
      () => page.classList.add('quot-compact'),
      () => page.classList.add('quot-compact-more'),
      () => { if (facImg) facImg.style.display = 'none'; },
      () => page.classList.add('quot-ultra')
    ];
    for (let i = 0; i < steps.length && pageH() > singlePageHeight + 2; i += 1) {
      steps[i]();
      void page.offsetHeight;
    }

    // Restore feature cards and stretch them into leftover A4 space.
    const coreH = pageH();
    const leftover = singlePageHeight - coreH;
    if (features && leftover >= 72) {
      page.classList.remove('quot-hide-features');
      page.classList.add('quot-features-fill');

      page.style.height = `${singlePageHeight}px`;
      page.style.minHeight = `${singlePageHeight}px`;
      page.style.maxHeight = `${singlePageHeight}px`;
      page.style.overflow = 'hidden';

      if (bodyPad) {
        bodyPad.style.setProperty('flex', '1 1 auto', 'important');
        bodyPad.style.setProperty('min-height', '0', 'important');
      }

      // Measure how much of the page is used above the feature grid, then size cards to the rest.
      features.style.setProperty('display', 'none', 'important');
      void page.offsetHeight;
      let usedAbove = 0;
      const headerEl = page.querySelector('.header');
      const contactEl = page.querySelector('.contact-bar');
      if (headerEl) usedAbove += Math.ceil(headerEl.getBoundingClientRect().height);
      if (contactEl) usedAbove += Math.ceil(contactEl.getBoundingClientRect().height);
      if (bodyPad) {
        const cs = getComputedStyle(bodyPad);
        usedAbove += (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        [...bodyPad.children].forEach((child) => {
          if (child === features) return;
          usedAbove += Math.ceil(child.getBoundingClientRect().height);
          const m = getComputedStyle(child);
          usedAbove += (parseFloat(m.marginTop) || 0) + (parseFloat(m.marginBottom) || 0);
        });
      }
      const fillH = Math.max(72, Math.floor(singlePageHeight - usedAbove - 14));
      features.style.setProperty('display', 'grid', 'important');
      features.style.setProperty('flex', '1 1 auto', 'important');
      features.style.setProperty('min-height', `${fillH}px`, 'important');
      features.style.setProperty('height', `${fillH}px`, 'important');
      features.style.setProperty('align-content', 'stretch', 'important');
      features.style.setProperty('margin-top', '8px', 'important');
      features.style.setProperty('margin-bottom', '2px', 'important');
      features.style.setProperty('gap', '8px', 'important');
      void page.offsetHeight;

      // If showing features still overflows, drop them so charge tables stay complete.
      if (pageH() > singlePageHeight + 4) {
        page.classList.add('quot-hide-features');
        page.classList.remove('quot-features-fill');
        features.style.removeProperty('height');
        features.style.removeProperty('min-height');
        features.style.setProperty('flex', '0 0 auto', 'important');
        if (bodyPad) bodyPad.style.setProperty('flex', '0 0 auto', 'important');
        void page.offsetHeight;
      }
    } else {
      page.style.height = `${singlePageHeight}px`;
      page.style.minHeight = `${singlePageHeight}px`;
      page.style.maxHeight = `${singlePageHeight}px`;
      page.style.overflow = 'hidden';
      void page.offsetHeight;
    }

    // Still overflowing: scale the sheet (transform is respected by html2canvas better than zoom).
    const lockedH = pageH();
    if (lockedH > singlePageHeight + 4) {
      page.style.height = 'auto';
      page.style.maxHeight = 'none';
      page.style.minHeight = '0';
      page.style.overflow = 'visible';
      void page.offsetHeight;
      const natural = pageH();
      const scale = Math.max(0.72, Math.min(1, singlePageHeight / natural));
      page.style.width = `${Math.round(794 / scale)}px`;
      page.style.transform = `scale(${scale})`;
      page.style.transformOrigin = 'top left';
      page.style.height = `${singlePageHeight}px`;
      page.style.minHeight = `${singlePageHeight}px`;
      page.style.maxHeight = `${singlePageHeight}px`;
      page.style.overflow = 'hidden';
    }
  });
};

export const renderQuotationPdf = async (data, { mode = 'save', printPrefs } = {}) => {
  const quote = enrichQuotationForPrint(data);
  const html = buildQuotationHtml(quote, quote.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'QUOTATION',
    docNo: data.quotationNo || 'N/A',
    width: 794,
    fitPage: true,
    printPrefs,
    prepareDoc: fitQuotationToTwoPages,
    splitOverflowPages: false
  });
};
