import { mergeCompanyProfile } from './companyProfile';
import { buildDcPrintLines, getDcAppData } from './deliveryChallanLayout';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import { escHtml, fmtQty, buildPrintLogoHtml } from './printTheme';

export const buildDeliveryChallanHtml = (data, profileInput, appDataInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const appData = appDataInput || getDcAppData();
  const { lines, totalDrums, totalQty } = buildDcPrintLines(data, appData);

  const dcNo = escHtml(data.dcNo || 'N/A');
  const dcDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const poNo = escHtml(data.partyDocNo || '');
  const poDate = escHtml(formatPdfDateDmy(data.partyDocDate) || '');
  const companyState = escHtml(profile.state || 'Gujarat');
  
  const shipState = escHtml(data.shipState || data.billState || data.state || companyState);
  const stateCode = escHtml(data.shipStateCode || data.billStateCode || data.stateCode || '24');
  const partyGstin = escHtml(data.gstinShip || data.gstinBill || data.gstin || '');
  const partyName = escHtml(data.partyName || '');
  const address = escHtml(data.shipAddress || data.billAddress || data.address || '');
  const addressLines = address.split(/\r?\n/).filter(Boolean);

  let companyPan = escHtml(profile.panNumber || '');
  if (!companyPan && profile.gstNumber && profile.gstNumber.length >= 15) {
    companyPan = escHtml(profile.gstNumber.substring(2, 12));
  }

  const bodyRows = [];
  let globalSr = 1;
  const groups = [];
  let curGroup = null;

  lines.forEach((line) => {
    if (line.kind === 'product') {
       curGroup = {
         isProduct: true,
         sr: globalSr++,
         productName: line.text,
         batches: [],
         totalDrums: 0,
         totalQty: 0
       };
       groups.push(curGroup);
    } else if (line.kind === 'batch') {
       if (!curGroup) {
         curGroup = { isProduct: true, sr: globalSr++, productName: '', batches: [], totalDrums: 0, totalQty: 0 };
         groups.push(curGroup);
       }
       const batchText = line.text.replace(/^BATCH NO:?\s*/i, '');
       curGroup.batches.push(batchText);
       curGroup.totalDrums += parseInt(line.drums, 10) || 0;
       curGroup.totalQty += parseFloat(line.qty) || 0;
    } else {
       groups.push({
         isProduct: false,
         text: line.text,
         drums: parseInt(line.drums, 10) || 0,
         qty: parseFloat(line.qty) || 0
       });
       curGroup = null; // break group
    }
  });

  groups.forEach((g) => {
    if (g.isProduct) {
      const d = g.totalDrums > 0 ? g.totalDrums : '';
      const q = g.totalQty > 0 ? fmtQty(g.totalQty) : '';
      const numBatches = g.batches.length;

      if (numBatches <= 1) {
        const batchText = numBatches === 1 ? g.batches[0] : '';
        bodyRows.push(`
          <tr>
            <td class="num">${g.sr}</td>
            <td class="left"><strong>${escHtml(g.productName)}</strong></td>
            <td class="num">${escHtml(batchText)}</td>
            <td class="num">${d}</td>
            <td class="num">${q}</td>
          </tr>`);
      } else {
        bodyRows.push(`
          <tr>
            <td class="num" rowspan="${numBatches}">${g.sr}</td>
            <td class="left" rowspan="${numBatches}"><strong>${escHtml(g.productName)}</strong></td>
            <td class="num">${escHtml(g.batches[0])}</td>
            <td class="num" rowspan="${numBatches}">${d}</td>
            <td class="num" rowspan="${numBatches}">${q}</td>
          </tr>`);
        for (let i = 1; i < numBatches; i++) {
          bodyRows.push(`
          <tr>
            <td class="num">${escHtml(g.batches[i])}</td>
          </tr>`);
        }
      }
    } else {
      bodyRows.push(`
        <tr>
          <td class="num"></td>
          <td class="left">${escHtml(g.text)}</td>
          <td class="num"></td>
          <td class="num">${g.drums > 0 ? g.drums : ''}</td>
          <td class="num">${g.qty > 0 ? fmtQty(g.qty) : ''}</td>
        </tr>`);
    }
  });

  const blanksCount = Math.max(0, 15 - bodyRows.length);
  for (let i = 0; i < blanksCount; i++) {
    bodyRows.push(`
      <tr class="empty">
        <td></td><td></td><td></td><td></td><td></td>
      </tr>`);
  }

  const drumsTotal = parseInt(totalDrums, 10) > 0 ? String(parseInt(totalDrums, 10)) : '';
  const qtyTotal = parseFloat(totalQty) > 0 ? fmtQty(totalQty) : '';

  const logoHtml = buildPrintLogoHtml(profile);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UMA MICRON - Delivery Challan</title>
<style>
  :root{
    --purple:#3d2b7d;
    --purple-dark:#2f2263;
    --lav-bg:#efeaf7;
    --lav-border:#c9bce8;
    --orange:#f47920;
    --green:#2fa84f;
    --text:#231f20;
    --grey-line:#d9d9d9;
  }
  *{box-sizing:border-box;font-family:Cambria,Georgia,serif;}
  html,body{margin:0;padding: 4px;background:#fff;font-family:Cambria,Georgia,serif;color:var(--text);}
  
  /* A4 scaling */
  .page {
    width: 794px;
    min-height: 1123px;
    padding: 4px;
    margin: 0;
    background: #fff;
    border: none;
    display: block;
  }

  /* Outline for the whole content */
  .content-wrapper { width: 100%; min-height: 1115px; height: 1115px; border-collapse: collapse; border: 2px solid var(--purple); box-sizing: border-box; }
  .content-wrapper td { padding: 0; vertical-align: top; }

  /* ===== HEADER ===== */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    margin-bottom: 8px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    width: 78px;
    height: 78px;
    position: relative;
    flex-shrink: 0;
  }
  .logo svg, .logo img { width: 100%; height: 100%; object-fit: contain; }
  .brand-text h1 {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 38px;
    letter-spacing: 1px;
    color: var(--purple);
    line-height: 1;
  }
  .brand-text .tagline {
    color: var(--green);
    font-weight: 700;
    font-size: 16px;
    margin-top: 2px;
  }
  .tax-invoice-box {
    background: var(--purple);
    color: #fff;
    text-align: center;
    padding: 12px 22px;
    display: flex;
    flex-direction: row;
    gap: 10px;
    justify-content: center;
    align-items: center;
    border-bottom-left-radius: 8px;
  }
  .tax-invoice-box .ti-title {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 1px;
    margin: 0;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .company-strip {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid var(--purple);
    padding-bottom: 8px;
    margin-bottom: 14px;
    font-size:12px;
    gap: 4px;
  }
  .company-strip .line {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  .company-strip .line.nowrap {
    white-space: nowrap;
    align-items: center;
  }
  .company-strip .icon {
    color: var(--purple);
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    margin-top: 1px;
  }
  .company-strip .icon svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

  /* ===== BILL TO / SHIP TO & META DETAILS ===== */
  .parties {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
  }
  .party {
    flex: 1;
    border: 1px solid var(--lav-border);
    display: flex;
    flex-direction: column;
  }
  .party-head {
    background: var(--lav-bg);
    color: var(--purple);
    font-weight: 800;
    font-size:12px;
    letter-spacing: .5px;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--lav-border);
  }
  .party-head svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .party-body {
    padding: 10px 12px;
    font-size:12px;
    line-height: 1.55;
    flex: 1;
  }
  .party-body .cname {
    color: var(--purple);
    font-weight: 800;
    font-size:12px;
    margin-bottom: 4px;
  }
  .party-foot {
    border-top: 1px solid var(--lav-border);
    padding: 8px 12px;
    font-size:12px;
  }
  .party-foot .frow { display: flex; margin-bottom: 2px; }
  .party-foot .flabel { width: 50px; font-weight: 700; color: var(--text); }
  .party-foot .fcolon { width: 12px; }

  /* Invoice Meta inside right party box */
  .invoice-meta {
    padding: 10px 12px;
    font-size:12px;
    flex: 1;
  }
  .meta-row {
    display: flex;
    margin-bottom: 6px;
    align-items: center;
  }
  .meta-row .m-icon { color: var(--purple); width: 22px; flex-shrink: 0; display: flex; align-items: center; }
  .meta-row .m-icon svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .meta-row .m-label { width: 110px; flex-shrink: 0; color: #333; font-weight: normal; }
  .meta-row .m-colon { width: 14px; flex-shrink: 0; font-weight: 600; }
  .meta-row .m-value { flex-shrink: 0; font-weight: 600; }

  /* ===== TABLE ===== */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size:12px;
  }
  table.items thead th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 8px 6px;
    text-align: center;
    border: 1px solid var(--purple);
  }
  table.items tbody td {
    border: 1px solid var(--lav-border);
    padding: 6px 6px;
    height: 20px;
    vertical-align: middle;
  }
  table.items tbody td.num { text-align: center; }
  table.items tbody td.left { text-align: left; }
  table.items tbody tr.empty td {
    height: 22px;
    border-top: 1px dashed var(--lav-border);
    border-bottom: 1px dashed var(--lav-border);
    border-left: 1px solid var(--lav-border);
    border-right: 1px solid var(--lav-border);
  }
  
  table.items td {
    padding: 6px 4px;
    border: 1px solid var(--purple-border);
    border-top: none;
    font-size:12px;
    font-weight: 500;
    word-break: break-all;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  
  table.items tfoot td {
    border: 1px solid var(--purple);
    background: var(--lav-bg);
    font-weight: 800;
    padding: 8px 6px;
    color: var(--purple-dark);
    text-align: center;
  }

  .dc-footer-grid {
      display: flex;
      gap: 14px;
      margin-top: 14px;
  }
  .dc-footer-grid > div:nth-child(1) { flex: 1.15; }
  .dc-footer-grid > div:nth-child(2) { flex: 0.85; }
  .dc-meta-card {
      border: 1px solid var(--lav-border);
      display: flex;
      flex-direction: column;
  }
  .box-head {
      background: var(--lav-bg);
      color: var(--purple);
      font-weight: 800;
      font-size:12px;
      letter-spacing: .5px;
      padding: 7px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--lav-border);
  }
  .box-head svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .dc-meta-card > div:not(.box-head) { padding: 4px 12px; font-size:12px; }
  .dc-meta-row { display: flex; margin-bottom: 2px; }
  .dc-meta-label { color: var(--text-black); font-weight: bold; width: 130px; flex-shrink: 0; }
  .dc-sign-stack { display: flex; flex-direction: column; gap: 14px; }
  .dc-sign-card {
      flex: 1;
      border: 1px solid var(--lav-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
  }
  .dc-sign-space { width: 80%; border-bottom: 1px solid #333; margin-top: 40px; margin-bottom: 5px; }
  .dc-sign-title { background: var(--lav-bg); color: var(--purple); font-weight: 800; font-size:12px; padding: 7px 12px; width: 100%; border-bottom: 1px solid var(--lav-border); display: flex; align-items: center; justify-content: center; gap: 8px; box-sizing: border-box; }

  .barfoot {
    background: var(--purple);
    color: #fff;
    margin: 14px -18px -18px -18px;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    font-size:12px;
  }
</style>
</head>
<body>

  <div class="page">
    <table class="content-wrapper">
  <tr>
    <td valign="top" style="padding: 18px; padding-bottom: 0;">
      
      <div class="header">
        <div class="brand">
          <div class="logo">
            ${logoHtml}
          </div>
          <div class="brand-text">
            <h1>${escHtml(profile.companyName || 'UMA MICRON')}</h1>
            <div class="tagline">Micronization of API's</div>
          </div>
        </div>
        <div class="tax-invoice-box">
          <div class="ti-title">DELIVERY CHALLAN</div>
          <svg style="width:36px; height:36px; fill:#fff;" viewBox="0 0 24 24">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </div>
      </div>

      <div class="company-strip">
        <div class="line" style="flex: 1;">
          <span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span>
          <span style="white-space: nowrap;">${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')}<br>${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')}, ${companyState}, India</span>
        </div>
        <div class="line nowrap">
          <span class="icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
          <span><strong>GSTIN:</strong> ${escHtml(profile.gstNumber || '')}</span>
        </div>
        <div class="line nowrap">
          <span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span>
          <span>${escHtml(profile.phone || '+91 97120 00297')}</span>
        </div>
        <div class="line nowrap">
          <span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span>
          <span>${escHtml(profile.email || 'umamicron@gmail.com')}</span>
        </div>
        <div class="line nowrap">
          <span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span>
          <span>${escHtml(profile.website || 'www.umamicron.com')}</span>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <div class="party-head"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> SHIP TO</div>
          <div class="party-body">
            <div class="cname">${partyName}</div>
            ${addressLines.map(line => `<div>${escHtml(line)}</div>`).join('')}
          </div>
          <div class="party-foot">
            <div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>${partyGstin}</span></div>
            <div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>${shipState} (${stateCode})</span></div>
          </div>
        </div>

        <div class="party">
          <div class="party-head"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> DELIVERY CHALLAN DETAILS</div>
          <div class="invoice-meta">
            <div class="meta-row">
              <span class="m-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
              <span class="m-label">Challan No.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${dcNo}</span>
            </div>
            <div class="meta-row">
              <span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
              <span class="m-label">Challan Date</span><span class="m-colon">:</span><span class="m-value">&nbsp;${dcDate}</span>
            </div>
            <div class="meta-row" style="margin-top:8px;">
              <span class="m-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
              <span class="m-label">PO No.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${poNo}</span>
            </div>
            <div class="meta-row">
              <span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
              <span class="m-label">PO Date</span><span class="m-colon">:</span><span class="m-value">&nbsp;${poDate}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="items">
          <thead>
            <tr>
              <th class="num" style="width:8%">Sr. No.</th>
              <th class="num" style="width:34%">DESCRIPTION WITH<br>BATCH DETAILS</th>
              <th class="num" style="width:28%">BATCH NO.</th>
              <th class="num" style="width:15%">UNIT<br>(No. of Drums)</th>
              <th class="num" style="width:15%">QTY.</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows.join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="num">TOTAL</td>
              <td class="num">${drumsTotal}</td>
              <td class="num">${qtyTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>

    </td>
  </tr>
  <tr>
    <td valign="bottom" style="padding: 18px; padding-top: 0; height: 1px;">
      <div class="dc-footer-grid">
        <div class="dc-meta-card">
          <div class="box-head"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> TRANSPORT DETAILS</div>
          <div class="dc-meta-row" style="margin-top:8px;"><div class="dc-meta-label">Vehicle No.</div><div class="data-value">: &nbsp;${escHtml(data.vehicleNo || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Drivers name</div><div class="data-value">: &nbsp;${escHtml(data.driverName || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Driver's Contact</div><div class="data-value">: &nbsp;${escHtml(data.driverContact || data.driverPhone || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Transporter's Name</div><div class="data-value">: &nbsp;${escHtml(data.transporterName || data.transporter || '')}</div></div>
        </div>
        <div class="dc-sign-stack">
          <div class="dc-sign-card">
            <div class="dc-sign-title">For ${escHtml(profile.companyName || 'UMA MICRON')}</div>
            <div class="dc-sign-space"></div>
            <span style="font-size:12px; color: #333;">Authorised Signatory</span>
          </div>
          <div class="dc-sign-card">
            <div class="dc-sign-title">RECEIVED BY</div>
            <div class="dc-sign-space"></div>
            <span style="font-size:12px; color: #333;">Authorised Signatory</span>
          </div>
        </div>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>This is a computer-generated document.</span>
        <span>Page 1 of 1</span>
      </div>
    </td>
  </tr>
</table>
</div>
</body>
</html>`;
};

export const renderDeliveryChallanPdf = async (data, { mode = 'save' } = {}) => {
  const appData = data.appData || getDcAppData();
  const html = buildDeliveryChallanHtml(data, data.companyProfile, appData);
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-12000px;top:0;z-index:-1;background:#fff;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 0;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const target = host.querySelector('.page') || host.firstElementChild;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      height: target.scrollHeight,
      windowheight: target.scrollHeight,
      logging: false
    });

    const naturalW = usableW;
    const naturalH = (canvas.height * naturalW) / canvas.width;
    const scale = Math.min(usableW / naturalW, usableH / naturalH, 1);
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;
    const x = margin + (usableW - drawW) / 2;
    const y = margin;
    
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);

    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `DC_${data.dcNo || 'N/A'}`;
    } else {
      pdf.save(`DC_${data.dcNo || 'N/A'}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
