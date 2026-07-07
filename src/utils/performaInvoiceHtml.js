import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatTiHeaderAddressLines, getTiContactLine, mergeCompanyProfile } from './companyProfile';
import {
  TI_CHARGES_LIST,
  calcTiTotals,
  formatPdfDateSlash,
  splitPartyAddressLines
} from './taxInvoiceLayout';

const NAVY = '#1f3864';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtMoney = (n) => (parseFloat(n) || 0).toFixed(2);

const fmtQty = (n) => {
  const v = parseFloat(n);
  if (!v) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

const DEFAULT_PI_LOGO_HTML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 88" width="96" height="78" aria-label="UMA MICRON Logo">
  <ellipse cx="42" cy="44" rx="30" ry="34" fill="none" stroke="#009900" stroke-width="2.5"/>
  <ellipse cx="58" cy="44" rx="30" ry="34" fill="none" stroke="#cc0000" stroke-width="2.5"/>
  <text x="28" y="56" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="700" fill="#cc0000">U</text>
  <text x="52" y="56" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="700" fill="#009900">M</text>
</svg>`;

const circIcon = (inner) => `<svg width="20" height="20" viewBox="0 0 24 24" style="display:block;"><circle cx="12" cy="12" r="12" fill="${NAVY}"/>${inner}</svg>`;

const IC_DOC = circIcon('<rect x="8" y="6" width="8" height="12" rx="1" fill="#fff"/><rect x="9.5" y="8.5" width="5" height="1.2" fill="' + NAVY + '"/><rect x="9.5" y="11" width="5" height="1.2" fill="' + NAVY + '"/><rect x="9.5" y="13.5" width="3.5" height="1.2" fill="' + NAVY + '"/>');
const IC_CAL = circIcon('<rect x="6.5" y="7.5" width="11" height="10" rx="1" fill="#fff"/><rect x="6.5" y="7.5" width="11" height="2.6" fill="#fff"/><rect x="8.2" y="5.8" width="1.6" height="3" rx="0.8" fill="#fff"/><rect x="14.2" y="5.8" width="1.6" height="3" rx="0.8" fill="#fff"/><rect x="8.3" y="11.5" width="2" height="2" fill="' + NAVY + '"/><rect x="11.3" y="11.5" width="2" height="2" fill="' + NAVY + '"/><rect x="14.3" y="11.5" width="2" height="2" fill="' + NAVY + '"/>');
const IC_TRUCK = circIcon('<rect x="5.5" y="9" width="8" height="5.5" rx="0.8" fill="#fff"/><path d="M13.5 10.5h3l2 2v2h-5z" fill="#fff"/><circle cx="9" cy="15.5" r="1.4" fill="#fff" stroke="' + NAVY + '" stroke-width="0.6"/><circle cx="16" cy="15.5" r="1.4" fill="#fff" stroke="' + NAVY + '" stroke-width="0.6"/>');
const IC_BANK = circIcon('<path d="M12 5.5l6.5 3.5v1h-13v-1z" fill="#fff"/><rect x="7" y="10.5" width="1.8" height="5" fill="#fff"/><rect x="11.1" y="10.5" width="1.8" height="5" fill="#fff"/><rect x="15.2" y="10.5" width="1.8" height="5" fill="#fff"/><rect x="5.5" y="16" width="13" height="1.8" fill="#fff"/>');
const IC_PERSON = '<svg width="16" height="16" viewBox="0 0 24 24" style="display:block;"><circle cx="12" cy="8" r="4" fill="#fff"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="#fff"/></svg>';
const IC_SHIP = '<svg width="16" height="16" viewBox="0 0 24 24" style="display:block;"><rect x="2" y="8" width="12" height="8" rx="1" fill="#fff"/><path d="M14 10h4l3 3v3h-7z" fill="#fff"/><circle cx="7" cy="17.5" r="2" fill="#fff"/><circle cx="17.5" cy="17.5" r="2" fill="#fff"/></svg>';
const IC_NOTE = '<svg width="15" height="15" viewBox="0 0 24 24" style="display:block;"><circle cx="12" cy="12" r="12" fill="' + NAVY + '"/><rect x="11" y="6" width="2" height="8" rx="1" fill="#fff"/><rect x="11" y="16" width="2" height="2" rx="1" fill="#fff"/></svg>';
const IC_PIN = '<svg width="13" height="13" viewBox="0 0 24 24" style="display:block;"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="' + NAVY + '"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>';
const IC_PHONE = '<svg width="13" height="13" viewBox="0 0 24 24" style="display:block;"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1z" fill="' + NAVY + '"/></svg>';
const IC_MAIL = '<svg width="13" height="13" viewBox="0 0 24 24" style="display:block;"><rect x="3" y="5" width="18" height="14" rx="2" fill="' + NAVY + '"/><path d="M4 7l8 6 8-6" stroke="#fff" stroke-width="1.6" fill="none"/></svg>';

const PI_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .pi-host {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    padding: 18px 22px;
    width: 950px;
    color: #1a1a1a;
  }
  .pi-doc { width: 100%; background: #fff; }

  .pi-header { display: flex; align-items: flex-start; margin-bottom: 12px; }
  .pi-logo { flex: 0 0 auto; margin-right: 14px; padding-top: 4px; }
  .pi-logo img, .pi-logo svg { width: 96px; height: auto; object-fit: contain; }
  .pi-company { flex: 1 1 auto; }
  .pi-company h1 {
    font-size: 30px;
    font-weight: 800;
    color: ${NAVY};
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .pi-addr-line { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; font-weight: bold; color: #222; margin-bottom: 2px; }
  .pi-addr-line .ic { flex: 0 0 auto; padding-top: 1px; }
  .pi-contact { display: flex; align-items: center; gap: 16px; font-size: 12px; font-weight: bold; margin: 3px 0; }
  .pi-contact span { display: flex; align-items: center; gap: 5px; }
  .pi-gstin { font-size: 12.5px; font-weight: bold; color: ${NAVY}; margin-top: 2px; }
  .pi-title-tag {
    flex: 0 0 auto;
    background: ${NAVY};
    color: #fff;
    font-size: 21px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 14px 22px;
    border-radius: 10px 0 0 10px;
    margin-right: -22px;
    margin-top: 18px;
    white-space: nowrap;
  }

  .pi-meta {
    display: flex;
    border: 1.5px solid ${NAVY};
    border-radius: 10px;
    padding: 8px 14px;
    margin-bottom: 10px;
  }
  .pi-meta .meta-col { flex: 1 1 50%; }
  .pi-meta .meta-col + .meta-col { border-left: 1px solid #c9d2e0; padding-left: 18px; margin-left: 18px; }
  .meta-row { display: flex; align-items: center; gap: 9px; padding: 6px 0; }
  .meta-row + .meta-row { border-top: 1px solid #d7dde8; }
  .meta-row .ic { flex: 0 0 auto; }
  .meta-row .m-label { font-size: 12.5px; font-weight: bold; color: #111; width: 150px; }
  .meta-row .m-value { font-size: 12.5px; color: #111; }

  .pi-statebar {
    display: flex;
    border: 1.2px solid #b7c0cf;
    background: #f3f5f8;
    border-radius: 8px;
    padding: 7px 14px;
    margin-bottom: 10px;
    font-size: 12.5px;
    font-weight: bold;
  }
  .pi-statebar .sb-state { flex: 0 0 55%; }

  .pi-parties { display: flex; gap: 14px; margin-bottom: 12px; }
  .party-card {
    flex: 1 1 50%;
    border: 1.2px solid #b7c0cf;
    border-radius: 8px;
    overflow: hidden;
  }
  .party-head {
    background: ${NAVY};
    color: #fff;
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 0.6px;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .party-body { padding: 9px 12px 11px; }
  .f-row { display: flex; align-items: flex-end; margin-bottom: 9px; }
  .f-label { font-size: 12px; font-weight: bold; white-space: nowrap; margin-right: 7px; }
  .f-line {
    flex: 1 1 auto;
    border-bottom: 1.2px solid #6b7686;
    font-size: 12px;
    min-height: 16px;
    padding: 0 2px 1px;
  }
  .f-row.split { gap: 14px; }
  .f-row.split .f-pair { display: flex; align-items: flex-end; flex: 1 1 50%; }

  table.pi-items { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }
  .pi-items th, .pi-items td { border: 1px solid #b7c0cf; font-size: 11.5px; padding: 5px 6px; }
  .pi-items thead th {
    background: ${NAVY};
    color: #fff;
    font-weight: bold;
    text-align: center;
    border-color: ${NAVY};
  }
  .pi-items td.c { text-align: center; }
  .pi-items td.l { text-align: left; }
  .pi-items td.r { text-align: right; }
  .pi-items tr.total-row td { font-weight: bold; font-size: 12px; border-color: ${NAVY}; }
  .pi-items tr.total-row td.total-cap {
    background: ${NAVY};
    color: #fff;
    text-align: center;
    letter-spacing: 1px;
  }

  .pi-bottom { display: flex; gap: 14px; margin-bottom: 12px; align-items: stretch; }
  .bank-card {
    flex: 1 1 52%;
    border: 1.2px solid #b7c0cf;
    border-radius: 8px;
    padding: 10px 14px;
  }
  .bank-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: #111; margin-bottom: 8px; }
  .bank-row { display: flex; font-size: 12px; margin-bottom: 4px; }
  .bank-row .b-label { width: 140px; font-weight: bold; }
  .totals-card {
    flex: 1 1 48%;
    border: 1.2px solid #b7c0cf;
    border-radius: 8px;
    overflow: hidden;
  }
  .totals-card table { width: 100%; height: 100%; border-collapse: collapse; }
  .totals-card td { border: 1px solid #c3ccda; font-size: 12px; padding: 6px 10px; }
  .totals-card td.t-label { font-weight: bold; }
  .totals-card td.t-value { text-align: right; width: 26%; }
  .totals-card tr.navy td { background: ${NAVY}; color: #fff; font-weight: bold; border-color: ${NAVY}; }

  .pi-note-sign { display: flex; margin-bottom: 10px; border-top: 1px solid #cdd5e0; }
  .note-col { flex: 1 1 52%; padding: 9px 12px 6px 0; border-right: 1px solid #cdd5e0; }
  .note-head { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; margin-bottom: 3px; }
  .note-body { font-size: 11px; font-weight: bold; margin-bottom: 8px; line-height: 1.5; }
  .terms-body { font-size: 11px; line-height: 1.55; }
  .sign-col { flex: 1 1 48%; padding: 9px 0 6px 16px; display: flex; flex-direction: column; }
  .sign-cert { font-size: 11px; margin-bottom: 6px; }
  .sign-space { flex: 1 1 auto; min-height: 52px; }
  .sign-for { text-align: center; font-size: 12.5px; font-weight: 800; padding-bottom: 4px; }

  .pi-footbar { display: flex; border: 1.2px solid #9aa5b5; border-radius: 6px; overflow: hidden; }
  .pi-footbar > div { padding: 8px 12px; font-size: 11.5px; font-weight: bold; }
  .pi-footbar .fb-gen { flex: 1 1 50%; border-right: 1.2px solid #9aa5b5; }
  .pi-footbar .fb-seal { flex: 0 0 20%; border-right: 1.2px solid #9aa5b5; text-align: center; }
  .pi-footbar .fb-auth { flex: 1 1 30%; text-align: center; }
`;

const buildItemRowsHtml = (data) => {
  const { chargeAmounts, totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty } = calcTiTotals(data);
  const rows = [];
  let sr = 0;

  const pushRow = (label, qty, rate, amt, sgstRate, cgstRate) => {
    const sgstAmt = amt * (sgstRate / 100);
    const cgstAmt = amt * (cgstRate / 100);
    const rowTotal = amt + sgstAmt + cgstAmt;
    sr += 1;
    rows.push(`
      <tr>
        <td class="c">${sr}</td>
        <td class="l">${esc(label)}</td>
        <td class="c">${esc(fmtQty(qty))}</td>
        <td class="c">${rate ? esc(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="r">${fmtMoney(amt)}</td>
        <td class="c">${sgstRate || ''}</td>
        <td class="r">${fmtMoney(sgstAmt)}</td>
        <td class="c">${cgstRate || ''}</td>
        <td class="r">${fmtMoney(cgstAmt)}</td>
        <td class="c"></td>
        <td class="r">${fmtMoney(0)}</td>
        <td class="r">${fmtMoney(rowTotal)}</td>
      </tr>`);
  };

  TI_CHARGES_LIST.forEach((charge) => {
    const line = chargeAmounts[charge.key];
    if (!line) return;
    pushRow(charge.label, line.qty, line.rate, line.amt || 0, charge.sgst, charge.cgst);
  });

  (data.customCharges || []).forEach((cc) => {
    if (!cc.checked) return;
    const ccQty = parseFloat(cc.qty) || 1;
    const rate = parseFloat(cc.rate) || 0;
    const amt = ccQty * rate;
    if (amt <= 0) return;
    pushRow(cc.name || '', ccQty, rate, amt, 9, 9);
  });

  rows.push(`
      <tr class="total-row">
        <td colspan="2" class="total-cap">TOTAL</td>
        <td class="c">${totalQty || 0}</td>
        <td></td>
        <td class="r">${fmtMoney(totalAmt)}</td>
        <td></td>
        <td class="r">${fmtMoney(totalSgst)}</td>
        <td></td>
        <td class="r">${fmtMoney(totalCgst)}</td>
        <td></td>
        <td class="r">${fmtMoney(totalIgst)}</td>
        <td class="r">${fmtMoney(totalAll)}</td>
      </tr>`);

  return {
    rowsHtml: rows.join(''),
    totals: { totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty }
  };
};

const buildPartyCardHtml = (title, icon, { name, address, state, stateCode, gstin }) => {
  const addrLines = splitPartyAddressLines(address, 44);
  const addrRows = (addrLines.length ? addrLines : ['']).map((line, i) => `
        <div class="f-row">
          <span class="f-label" style="${i === 0 ? '' : 'visibility:hidden;'}">Address :</span>
          <span class="f-line">${esc(line)}</span>
        </div>`).join('');

  return `
    <div class="party-card">
      <div class="party-head">${icon}${esc(title)}</div>
      <div class="party-body">
        <div class="f-row"><span class="f-label">Name :</span><span class="f-line">${esc(name || '')}</span></div>
        ${addrRows}
        <div class="f-row split">
          <span class="f-pair"><span class="f-label">State :</span><span class="f-line">${esc(state || '')}</span></span>
          <span class="f-pair"><span class="f-label">Code :</span><span class="f-line">${esc(stateCode || '')}</span></span>
        </div>
        <div class="f-row" style="margin-bottom:2px;"><span class="f-label">GSTIN :</span><span class="f-line">${esc(gstin || '')}</span></div>
      </div>
    </div>`;
};

export const buildPerformaInvoiceHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const addressLines = formatTiHeaderAddressLines(profile);
  const contact = getTiContactLine(profile);
  const logoSrc = profile.logo && profile.logo.startsWith('data:image') ? profile.logo : '';
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="UMA MICRON Logo">`
    : DEFAULT_PI_LOGO_HTML;

  const docNo = esc(data.invoiceNo || 'N/A');
  const docDate = esc(formatPdfDateSlash(data.date) || 'N/A');
  const dcNo = esc(data.dcNo || '');
  const dcDate = esc(formatPdfDateSlash(data.dcDate || data.date) || docDate);
  const companyState = esc(profile.state || 'GUJARAT');
  const companyStateCode = '24';

  const phone = (profile.phone || '').trim();
  const email = (profile.email || '').trim();
  const contactHtml = (phone || email)
    ? `<div class="pi-contact">
        ${phone ? `<span>${IC_PHONE}${esc(phone)}</span>` : ''}
        ${email ? `<span>${IC_MAIL}${esc(email)}</span>` : ''}
      </div>`
    : (contact ? `<div class="pi-contact"><span>${IC_PHONE}${esc(contact)}</span></div>` : '');

  const { rowsHtml, totals } = buildItemRowsHtml(data);
  const totalTax = totals.totalSgst + totals.totalCgst + totals.totalIgst;

  const billCard = buildPartyCardHtml('BILL TO PARTY', IC_PERSON, {
    name: data.partyName,
    address: data.billAddress || data.address,
    state: data.billState || data.state,
    stateCode: data.billStateCode || data.stateCode,
    gstin: data.gstinBill || data.gstin
  });
  const shipCard = buildPartyCardHtml('SHIP TO PARTY', IC_SHIP, {
    name: data.shipName || data.partyName,
    address: data.shipAddress || data.address,
    state: data.shipState || data.state,
    stateCode: data.shipStateCode || data.stateCode,
    gstin: data.gstinShip || data.gstin
  });

  return `
<style>${PI_STYLES}</style>
<div class="pi-host">
  <div class="pi-doc">

    <div class="pi-header">
      <div class="pi-logo">${logoHtml}</div>
      <div class="pi-company">
        <h1>${esc(profile.companyName)}</h1>
        <div class="pi-addr-line"><span class="ic">${IC_PIN}</span><span>${esc(addressLines[0] || '')}${addressLines[1] ? '<br>' + esc(addressLines[1]) : ''}</span></div>
        ${contactHtml}
        <div class="pi-gstin">GSTIN: &nbsp;${esc(profile.gstNumber)}</div>
      </div>
      <div class="pi-title-tag">PERFORMA INVOICE</div>
    </div>

    <div class="pi-meta">
      <div class="meta-col">
        <div class="meta-row"><span class="ic">${IC_DOC}</span><span class="m-label">PI No.</span><span class="m-value">${docNo}</span></div>
        <div class="meta-row"><span class="ic">${IC_CAL}</span><span class="m-label">PI Date</span><span class="m-value">${docDate}</span></div>
      </div>
      <div class="meta-col">
        <div class="meta-row"><span class="ic">${IC_TRUCK}</span><span class="m-label">Delivery Challan No.</span><span class="m-value">${dcNo}</span></div>
        <div class="meta-row"><span class="ic">${IC_DOC}</span><span class="m-label">Date</span><span class="m-value">${dcDate}</span></div>
      </div>
    </div>

    <div class="pi-statebar">
      <span class="sb-state">State :&nbsp; ${companyState}</span>
      <span>Code :&nbsp; ${companyStateCode}</span>
    </div>

    <div class="pi-parties">
      ${billCard}
      ${shipCard}
    </div>

    <table class="pi-items">
      <colgroup>
        <col style="width:4%"><col style="width:24%"><col style="width:5.5%"><col style="width:6.5%">
        <col style="width:8%"><col style="width:5%"><col style="width:7.5%"><col style="width:5%">
        <col style="width:7.5%"><col style="width:5%"><col style="width:7.5%"><col style="width:9%">
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2">S.<br>No.</th>
          <th rowspan="2">Description</th>
          <th rowspan="2">Qty</th>
          <th rowspan="2">Rate</th>
          <th rowspan="2">Amount</th>
          <th colspan="2">SGST</th>
          <th colspan="2">CGST</th>
          <th colspan="2">IGST</th>
          <th rowspan="2">Total</th>
        </tr>
        <tr>
          <th>Rate</th><th>Amount</th>
          <th>Rate</th><th>Amount</th>
          <th>Rate</th><th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="pi-bottom">
      <div class="bank-card">
        <div class="bank-title">${IC_BANK}OUR BANK DETAILS</div>
        <div class="bank-row"><div class="b-label">Bank Name</div><div>:&nbsp; AXIS BANK LTD</div></div>
        <div class="bank-row"><div class="b-label">A/c Name</div><div>:&nbsp; ${esc(profile.companyName)}</div></div>
        <div class="bank-row"><div class="b-label">Current A/c No.</div><div>:&nbsp; 916020061629671</div></div>
        <div class="bank-row"><div class="b-label">IFS CODE</div><div>:&nbsp; UTIB0000383</div></div>
        <div class="bank-row"><div class="b-label">Branch</div><div>:&nbsp; Nizampura</div></div>
      </div>
      <div class="totals-card">
        <table>
          <tr><td class="t-label">Total Amount before Tax</td><td class="t-value">${fmtMoney(totals.totalAmt)}</td></tr>
          <tr><td class="t-label">CGST</td><td class="t-value">${fmtMoney(totals.totalCgst)}</td></tr>
          <tr><td class="t-label">SGST</td><td class="t-value">${fmtMoney(totals.totalSgst)}</td></tr>
          <tr><td class="t-label">IGST</td><td class="t-value">${fmtMoney(totals.totalIgst)}</td></tr>
          <tr class="navy"><td class="t-label">Total Tax Amount</td><td class="t-value">${fmtMoney(totalTax)}</td></tr>
          <tr class="navy"><td class="t-label">Total Amount after Tax</td><td class="t-value">${fmtMoney(totals.totalAll)}</td></tr>
        </table>
      </div>
    </div>

    <div class="pi-note-sign">
      <div class="note-col">
        <div class="note-head">${IC_NOTE}NOTE:</div>
        <div class="note-body">PACKING MATERIALS AND TRANSPORTATION<br>CHARGES WILL BE CHAGRE EXTRA AS ACTUAL</div>
        <div class="note-head">${IC_NOTE}TERMS &amp; CONDITIONS</div>
        <div class="terms-body">
          1) &nbsp;Subject to vadodara Juridiction.<br>
          2) &nbsp;Payment 100% ADVANCE AGAINST PI
        </div>
      </div>
      <div class="sign-col">
        <div class="sign-cert">We certify that the particulars given above are true and correct.</div>
        <div class="sign-space"></div>
        <div class="sign-for">For ${esc(profile.companyName)}</div>
      </div>
    </div>

    <div class="pi-footbar">
      <div class="fb-gen">this is system generated PI so no need to sign</div>
      <div class="fb-seal">Seal</div>
      <div class="fb-auth">Authorised signatory</div>
    </div>

  </div>
</div>`;
};

export const renderPerformaInvoicePdf = async (data, { mode = 'save' } = {}) => {
  const html = buildPerformaInvoiceHtml(data, data.companyProfile);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const target = host.querySelector('.pi-host');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 950,
      windowWidth: 950
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH);
    } else {
      const scale = pageH / imgH;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW * scale, pageH);
    }

    const docNo = data.invoiceNo || 'N/A';
    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `PI_${docNo}`;
    } else {
      pdf.save(`PI_${docNo}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
