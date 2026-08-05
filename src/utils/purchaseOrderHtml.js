import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import { renderHtmlToPdf } from './printTheme';

export const escHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const fmtMoney = (n) => {
  const v = parseFloat(n);
  if (!Number.isFinite(v) || v === 0) return '';
  return v.toFixed(2);
};

export const fmtQty = (n) => {
  const v = parseFloat(n);
  if (!Number.isFinite(v) || v === 0) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

const JAGDAMBA_DEFAULTS = {
  companyName: 'JAGDAMBA PROFILE',
  addressLine1: '504/1A, GIDC Makarpura, Vadodara -390010.',
  gstNumber: '24AJGPP9863R1Z5',
  phone: '9824917250, 9824025001, 8799617254',
  email: 'jagdambaprofile@gmail.com'
};

const DEFAULT_PO_TERMS = [
  'Material should be supplied strictly as per above size, grade and specification.',
  'Test Certificate / MTC report wherever applicable.',
  'Material should be free from heavy rust, lamination, oil, paint and major surface defects.',
  'Final weight, rate and payment will be as per mutually agreed terms.',
  'Delivery schedule and transport details must be confirmed before dispatch.'
];

const emptyItem = () => ({
  grade: '',
  thickness: '',
  width: '',
  length: '',
  nos: '',
  kg: '',
  rate: '',
  amount: ''
});

export const normalizePoItems = (data) => {
  if (Array.isArray(data?.items) && data.items.length) {
    return data.items.map((it) => ({
      ...emptyItem(),
      ...it,
      amount: it.amount !== '' && it.amount != null
        ? it.amount
        : ((parseFloat(it.kg) || 0) * (parseFloat(it.rate) || 0)) || ''
    }));
  }

  // Backward-compat: single product line from older Uma PO records
  if (data?.productName || parseFloat(data?.qty) > 0) {
    const kg = parseFloat(data.qty) || 0;
    const rate = parseFloat(data.rate) || 0;
    const amount = kg * rate || parseFloat(data.subtotal) || 0;
    return [{
      ...emptyItem(),
      grade: data.productName || data.productDescription || '',
      kg: kg || '',
      rate: rate || '',
      amount: amount || ''
    }];
  }

  return [emptyItem(), emptyItem(), emptyItem(), emptyItem()];
};

export const calcPoTotals = (data) => {
  const items = normalizePoItems(data);
  const totalNos = items.reduce((s, it) => s + (parseFloat(it.nos) || 0), 0);
  const totalKg = items.reduce((s, it) => s + (parseFloat(it.kg) || 0), 0);
  const basicAmount = items.reduce((s, it) => {
    const amt = parseFloat(it.amount);
    if (Number.isFinite(amt) && amt > 0) return s + amt;
    return s + ((parseFloat(it.kg) || 0) * (parseFloat(it.rate) || 0));
  }, 0);
  const taxRate = parseFloat(data.taxRate) || 18;
  const gstAmount = basicAmount * (taxRate / 100);
  const grandTotal = basicAmount + gstAmount;
  return { items, totalNos, totalKg, basicAmount, taxRate, gstAmount, grandTotal };
};

const buildTermsList = (data) => {
  if (data?.terms && String(data.terms).trim()) {
    return String(data.terms)
      .split(/\r?\n/)
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }
  return DEFAULT_PO_TERMS;
};

export const buildPurchaseOrderHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  // Jagdamba PO print uses fixed company block from the approved format.
  // Logo can still come from Company Profile when uploaded.
  const useProfileBrand = /jagdamba/i.test(profile.companyName || '');
  const companyNameRaw = useProfileBrand
    ? (profile.companyName || JAGDAMBA_DEFAULTS.companyName)
    : JAGDAMBA_DEFAULTS.companyName;
  const companyName = companyNameRaw.toUpperCase();
  const companyTitle = companyNameRaw
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
  const address = useProfileBrand && profile.addressLine1
    ? [
        profile.addressLine1,
        [profile.city, profile.pincode].filter(Boolean).join(' - ')
      ].filter(Boolean).join(', ')
    : JAGDAMBA_DEFAULTS.addressLine1;
  const gstin = useProfileBrand && profile.gstNumber
    ? profile.gstNumber
    : JAGDAMBA_DEFAULTS.gstNumber;
  const phones = useProfileBrand && profile.phone
    ? profile.phone
    : JAGDAMBA_DEFAULTS.phone;
  const email = useProfileBrand && profile.email
    ? profile.email
    : JAGDAMBA_DEFAULTS.email;

  const poNo = escHtml(data.poNo || '');
  const poDate = escHtml(formatPdfDateDmy(data.date) || '');

  const partyName = escHtml(data.partyName || '');
  const partyAddress = escHtml(data.address || data.billAddress || '');
  const partyGstin = escHtml(data.gstin || data.gstinBill || '');
  const partyMobile = escHtml(data.mobile || data.phone || '');
  const partyEmail = escHtml(data.email || '');

  const paymentTerms = escHtml(data.paymentTerms || '');
  const make = escHtml(data.make || '');
  const mtc = escHtml(data.mtc || '');
  const utLevel = escHtml(data.utLevel || '');
  const inspection = escHtml(data.inspection || '');
  const deliveryLocation = escHtml(data.deliveryLocation || '');

  const vehicleNo = escHtml(data.vehicleNo || '');
  const driverMobile = escHtml(data.driverMobile || data.driverContact || '');
  const transportName = escHtml(data.transportName || data.transporterName || '');

  const transportCharges = fmtMoney(data.transportCharges);
  const loadingCharges = fmtMoney(data.loadingCharges);

  const note = escHtml(data.note || '');
  const remark = escHtml(data.remark || '');
  const preparedBy = escHtml(data.preparedBy || '');
  const checkedBy = escHtml(data.checkedBy || '');

  const { items, totalNos, totalKg, basicAmount, taxRate, gstAmount, grandTotal } = calcPoTotals(data);

  const MIN_ROWS = 4;
  const padded = [...items];
  while (padded.length < MIN_ROWS) padded.push(emptyItem());

  const materialRows = padded.map((it, idx) => {
    const hasAny = Object.values(it).some((v) => String(v ?? '').trim() !== '');
    const amt = parseFloat(it.amount);
    const computedAmt = (parseFloat(it.kg) || 0) * (parseFloat(it.rate) || 0);
    const amountStr = Number.isFinite(amt) && amt > 0
      ? fmtMoney(amt)
      : (computedAmt > 0 ? fmtMoney(computedAmt) : '');
    return `
        <tr>
          <td>${hasAny ? idx + 1 : ''}</td>
          <td>${escHtml(it.grade)}</td>
          <td>${escHtml(it.thickness)}</td>
          <td>${escHtml(it.width)}</td>
          <td>${escHtml(it.length)}</td>
          <td>${fmtQty(it.nos)}</td>
          <td>${fmtQty(it.kg)}</td>
          <td>${fmtMoney(it.rate)}</td>
          <td>${amountStr}</td>
        </tr>`;
  }).join('');

  const termsHtml = buildTermsList(data)
    .map((t) => `<li>${escHtml(t)}</li>`)
    .join('');

  const logoHtml = profile.logo?.startsWith('data:image')
    ? `<img src="${profile.logo}" alt="logo" style="width:100%;height:100%;object-fit:contain;" />`
    : `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,4 88,26 88,74 50,96 12,74 12,26" fill="none" stroke="#233b73" stroke-width="4"/>
          <polygon points="50,12 80,30 80,70 50,88 20,70 20,30" fill="none" stroke="#e65200" stroke-width="4"/>
          <text x="50" y="63" text-anchor="middle" font-family="'Impact', Arial, sans-serif" font-weight="900" font-size="40" fill="#233b73">JP</text>
        </svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(companyName)} - Purchase Order</title>
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    background: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
    width: 794px;
    margin: 0;
    padding: 0;
  }

  .outer-frame {
    width: 794px;
    background: #ffffff;
    border: 2px solid #233b73;
    padding: 8px;
    box-sizing: border-box;
  }

  .inner-frame {
    border: 1.5px solid #233b73;
  }

  .header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1.5px solid #233b73;
  }

  .logo-wrap {
    width: 70px;
    height: 70px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-wrap svg, .logo-wrap img {
    width: 100%;
    height: 100%;
  }

  .header-text {
    flex: 1;
    text-align: center;
  }

  .company-name {
    font-family: 'Impact', 'Arial Narrow', 'Arial Black', sans-serif;
    font-size: 40px;
    font-weight: 900;
    color: #233b73;
    letter-spacing: 2px;
    line-height: 1;
    margin-bottom: 4px;
    text-transform: uppercase;
  }

  .company-details {
    font-size: 10.5px;
    font-weight: bold;
    color: #1a1a1a;
    line-height: 1.35;
  }

  .band-title {
    background: #e65200;
    color: #ffffff;
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    padding: 4px 0;
    border-bottom: 1.5px solid #233b73;
    letter-spacing: 0.5px;
  }

  .section-header {
    background: #e65200;
    color: #ffffff;
    font-weight: bold;
    font-size: 11px;
    padding: 4px 8px;
    text-transform: uppercase;
  }

  table.doc-table {
    width: 100%;
    border-collapse: collapse;
  }

  table.doc-table td, table.doc-table th {
    border: 1.5px solid #233b73;
    padding: 3px 7px;
    font-size: 11px;
    color: #000000;
    vertical-align: middle;
  }

  table.doc-table:not(:first-of-type) tr:first-child td,
  table.doc-table:not(:first-of-type) tr:first-child th {
    border-top: none;
  }

  .label {
    font-weight: bold;
    color: #1a1a1a;
  }

  .val {
    font-weight: normal;
  }

  .h-fixed {
    height: 22px;
  }

  .split-cell {
    display: flex;
    justify-content: space-between;
    padding-right: 10%;
    gap: 8px;
  }

  .material-head th {
    background: #e65200;
    color: #ffffff;
    font-weight: bold;
    font-size: 11px;
    text-align: center;
    padding: 4px 2px;
    border: 1.5px solid #233b73;
  }

  .material-table td {
    height: 24px;
    text-align: center;
  }

  .terms-block {
    font-size: 10.5px;
    font-weight: bold;
    line-height: 1.5;
    padding: 6px 10px;
    color: #1a1a1a;
  }

  .terms-block ol {
    margin: 0;
    padding-left: 22px;
  }

  .terms-block li {
    padding-left: 2px;
  }

  .sign-row td {
    height: 70px;
    vertical-align: top;
    padding: 6px;
  }

  .sign-row .sign-center {
    text-align: center;
    font-weight: bold;
  }

  .for-jagdamba {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    text-align: center;
  }

  .for-jagdamba .top-title {
    font-size: 12px;
    font-weight: bold;
    color: #233b73;
  }

  .for-jagdamba .bottom-title {
    font-size: 11px;
    font-weight: bold;
    color: #1a1a1a;
  }
</style>
</head>
<body>

<div class="outer-frame pdf-page print-host">
  <div class="inner-frame">

    <div class="header">
      <div class="logo-wrap">
        ${logoHtml}
      </div>
      <div class="header-text">
        <div class="company-name">${escHtml(companyName)}</div>
        <div class="company-details">
          ${escHtml(address)}<br>
          GST No: ${escHtml(gstin)}<br>
          Mo: ${escHtml(phones)} &nbsp;&nbsp;&nbsp;&nbsp; Email: ${escHtml(email)}
        </div>
      </div>
    </div>

    <div class="band-title">PURCHASE ORDER</div>

    <table class="doc-table">
      <tr class="h-fixed">
        <td style="width: 65%;"><span class="label">PO No.:</span> <span class="val">${poNo}</span></td>
        <td style="width: 35%;"><span class="label">PO Date :</span> <span class="val">${poDate}</span></td>
      </tr>
    </table>

    <table class="doc-table">
      <tr>
        <td class="section-header" style="width: 60%;">SUPPLIER DETAILS</td>
        <td class="section-header" style="width: 40%;">PAYMENT &amp; OTHER DETAILS</td>
      </tr>
    </table>

    <table class="doc-table">
      <tr class="h-fixed">
        <td style="width: 60%;"><span class="label">Party Name:</span> <span class="val">${partyName}</span></td>
        <td style="width: 40%;"><span class="label">Payment Terms :</span> <span class="val">${paymentTerms}</span></td>
      </tr>
      <tr class="h-fixed">
        <td rowspan="2" style="vertical-align: top;"><span class="label">Address:</span> <span class="val">${partyAddress}</span></td>
        <td>
          <div class="split-cell">
            <span><span class="label">Make :</span> <span class="val">${make}</span></span>
            <span><span class="label">MTC :</span> <span class="val">${mtc}</span></span>
          </div>
        </td>
      </tr>
      <tr class="h-fixed">
        <td><span class="label">UT Level :</span> <span class="val">${utLevel}</span></td>
      </tr>
      <tr class="h-fixed">
        <td><span class="label">GST Number:</span> <span class="val">${partyGstin}</span></td>
        <td><span class="label">Inspection :</span> <span class="val">${inspection}</span></td>
      </tr>
      <tr class="h-fixed">
        <td><span class="label">Mobile Number:</span> <span class="val">${partyMobile}</span></td>
        <td rowspan="2" style="vertical-align: top;"><span class="label">Delivery Location :</span> <span class="val">${deliveryLocation}</span></td>
      </tr>
      <tr class="h-fixed">
        <td><span class="label">Email ID :</span> <span class="val">${partyEmail}</span></td>
      </tr>
    </table>

    <table class="doc-table">
      <tr>
        <td class="section-header" style="text-align: center;">VEHICLE TRANSPORT DETAILS</td>
      </tr>
    </table>

    <table class="doc-table">
      <tr class="h-fixed">
        <td style="width: 36%;"><span class="label">Vehicle Number:</span> <span class="val">${vehicleNo}</span></td>
        <td style="width: 32%;"><span class="label">Driver Mobile No:</span> <span class="val">${driverMobile}</span></td>
        <td style="width: 32%;"><span class="label">Transport Name:</span> <span class="val">${transportName}</span></td>
      </tr>
    </table>

    <table class="doc-table material-table">
      <thead>
        <tr class="material-head">
          <th style="width: 6%;">Sr No</th>
          <th style="width: 13%;">Grade</th>
          <th style="width: 12%;">Thickness</th>
          <th style="width: 11%;">Width</th>
          <th style="width: 11%;">Length</th>
          <th style="width: 10%;">Nos</th>
          <th style="width: 9%;">Kg</th>
          <th style="width: 11%;">Rate</th>
          <th style="width: 17%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${materialRows}
      </tbody>
    </table>

    <table class="doc-table">
      <tr class="h-fixed">
        <td style="width: 53%;"><span class="label">Total Nos.</span> <span class="val">${fmtQty(totalNos)}</span></td>
        <td style="width: 47%;"><span class="label">Total Kg.</span> <span class="val">${fmtQty(totalKg)}</span></td>
      </tr>
    </table>

    <table class="doc-table">
      <tr>
        <td class="section-header" style="width: 53%;">Transportation &amp; Loading Charges</td>
        <td class="section-header" style="width: 47%;">FINANCIAL SUMMARY</td>
      </tr>
    </table>

    <table class="doc-table">
      <tr class="h-fixed">
        <td style="width: 53%;"><span class="label">Transport Charges :</span> <span class="val">${transportCharges}</span></td>
        <td style="width: 27%;"><span class="label">BASIC AMOUNT</span></td>
        <td style="width: 20%; text-align: right;">${fmtMoney(basicAmount)}</td>
      </tr>
      <tr class="h-fixed">
        <td><span class="label">Loading Charges :</span> <span class="val">${loadingCharges}</span></td>
        <td><span class="label">GST @ ${taxRate}%</span></td>
        <td style="text-align: right;">${fmtMoney(gstAmount)}</td>
      </tr>
      <tr class="h-fixed">
        <td style="border-top: none;"></td>
        <td><span class="label">GRAND TOTAL</span></td>
        <td style="text-align: right; font-weight: bold;">${fmtMoney(grandTotal)}</td>
      </tr>
    </table>

    <table class="doc-table">
      <tr>
        <td class="section-header">COMMERCIAL / QUALITY DETAILS</td>
      </tr>
      <tr class="h-fixed"><td><span class="label">Note</span> <span class="val">${note}</span></td></tr>
      <tr class="h-fixed"><td><span class="label">Remark</span> <span class="val">${remark}</span></td></tr>
    </table>

    <table class="doc-table">
      <tr>
        <td class="section-header">GENERAL TERMS AND CONDITIONS</td>
      </tr>
      <tr>
        <td class="terms-block">
          <ol>
            ${termsHtml}
          </ol>
        </td>
      </tr>
    </table>

    <table class="doc-table">
      <tr class="sign-row">
        <td style="width: 30%;" class="sign-center">
          <span class="label">Prepared By</span>
          <div class="val" style="margin-top: 28px;">${preparedBy}</div>
        </td>
        <td style="width: 30%;" class="sign-center">
          <span class="label">Checked By</span>
          <div class="val" style="margin-top: 28px;">${checkedBy}</div>
        </td>
        <td style="width: 40%;">
          <div class="for-jagdamba">
            <div class="top-title">For ${escHtml(companyTitle)}</div>
            <div class="bottom-title">Authorized Signatory</div>
          </div>
        </td>
      </tr>
    </table>

  </div>
</div>

</body>
</html>`;
};

export const renderPurchaseOrderPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPurchaseOrderHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'PO',
    docNo: data.poNo || 'N/A',
    width: 794,
    fitPage: true
  });
};
