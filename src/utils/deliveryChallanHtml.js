import { mergeCompanyProfile } from './companyProfile';
import { buildDcPrintLines, getDcAppData } from './deliveryChallanLayout';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import { escHtml, fmtQty } from './printTheme';

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

  const cellDrums = (v) => (parseInt(v, 10) > 0 ? escHtml(String(parseInt(v, 10))) : '');
  const cellQty = (v) => (v !== '' && v != null && parseFloat(v) > 0 ? escHtml(v) : '');

  const bodyRows = [];
  let shownSr = false;
  lines.forEach((line) => {
    const isContent = line.kind === 'product' || line.kind === 'batch' || line.kind === 'empty';
    let sr = '';
    if (isContent && !shownSr) {
      sr = '1';
      shownSr = true;
    }
    bodyRows.push(`
      <tr>
        <td class="num">${sr}</td>
        <td class="left">${escHtml(line.text)}</td>
        <td class="num">${cellDrums(line.drums)}</td>
        <td class="num">${cellQty(line.qty)}</td>
      </tr>`);
  });
  const blanksCount = Math.max(0, 15 - bodyRows.length);
  for (let i = 0; i < blanksCount; i++) {
    bodyRows.push(`
      <tr class="empty">
        <td></td><td></td><td></td><td></td>
      </tr>`);
  }

  const drumsTotal = parseInt(totalDrums, 10) > 0 ? String(parseInt(totalDrums, 10)) : '';
  const qtyTotal = parseFloat(totalQty) > 0 ? fmtQty(totalQty) : '';

  const logoSrc = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';
  const logoHtml = logoSrc ? `<img src="${logoSrc}" alt="Logo">` : `<img src="data:image/png;base64,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" style="width:100%;height:100%;object-fit:contain;" alt="Logo" />`;

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
  *{box-sizing:border-box;}
  html,body{margin:0;padding: 4px;background:#fff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:var(--text);}
  
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
  .content-wrapper td { padding: 0; }

  /* ===== HEADER ===== */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 14px;
    margin-bottom: 14px;
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
    padding: 10px 22px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 230px;
  }
  .tax-invoice-box .ti-title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .tax-invoice-box .ti-sub {
    background: #fff;
    color: var(--purple);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .5px;
    padding: 3px 10px;
  }

  /* ===== COMPANY / INVOICE INFO ROW ===== */
  .info-row {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
  }
  .company-info {
    flex: 1.15;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .company-info .line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 4px;
  }
  .icon {
    color: var(--purple);
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    text-align: center;
    margin-top: 1px;
  }
  .icon svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .reg-details {
    margin-top: 10px;
    font-size: 12.5px;
    line-height: 1.7;
  }
  .reg-details b { color: var(--purple); }
  .reg-row { display: flex; }
  .reg-row .label { width: 62px; font-weight: 700; color: var(--purple); }
  .reg-row .colon { width: 14px; }

  .invoice-meta {
    flex: 1;
    border: 1px solid var(--purple);
  }
  .invoice-meta .block {
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .invoice-meta .block + .block {
    border-top: 1px solid var(--purple);
  }
  .meta-row {
    display: flex;
    margin-bottom: 3px;
  }
  .meta-row .m-icon { color: var(--purple); width: 18px; flex-shrink: 0; display: flex; align-items: center; }
  .meta-row .m-icon svg { width: 15px; height: 15px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .meta-row .m-label { width: 110px; flex-shrink: 0; color: #333; font-weight: normal; }
  .meta-row .m-colon { flex-shrink: 0; font-weight: 600; }
  .meta-row .m-value { flex-shrink: 0; font-weight: 600; }
  .meta-row.sub .m-label { width: 110px; padding-left: 18px; box-sizing: border-box; }

  /* ===== BOTTOM SECTION: meta + sign ===== */
  .bottom {
    display: flex;
    gap: 14px;
    margin-bottom: 0;
    align-items: stretch;
    
  }

  /* ===== BILL TO / SHIP TO ===== */
  .parties {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
  }
  .party {
    flex: 1;
    border: 1px solid var(--lav-border);
  }
  .party-head {
    background: var(--lav-bg);
    color: var(--purple);
    font-weight: 800;
    font-size: 13px;
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
    font-size: 12.5px;
    line-height: 1.55;
    min-height: 80px;
  }
  .party-body .cname {
    color: var(--purple);
    font-weight: 800;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .party-foot {
    border-top: 1px solid var(--lav-border);
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .party-foot .frow { display: flex; margin-bottom: 2px; }
  .party-foot .flabel { width: 50px; font-weight: 700; color: var(--text); }
  .party-foot .fcolon { width: 12px; }

  /* ===== TABLE ===== */
  .table-container { }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size: 12px;
  }
  table.items thead th {
    background: var(--purple);
    color: #fff;
    font-weight: 700;
    padding: 8px 6px;
    text-align: left;
    border: 1px solid var(--purple);
  }
  table.items thead th.num { text-align: center; }
  table.items tbody td {
    border: 1px solid var(--lav-border);
    padding: 6px 6px;
    height: 20px;
  }
  table.items tbody td.num { text-align: center; }
  table.items tbody td.left { text-align: left; }
  table.items tbody tr.empty td { height: 22px; }
  table.items tfoot td {
    border: 1px solid var(--purple);
    background: var(--lav-bg);
    font-weight: 800;
    padding: 8px 6px;
    color: var(--purple-dark);
  }
  table.items tfoot td.num { text-align: center; }

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
      font-size: 13px;
      letter-spacing: .5px;
      padding: 7px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--lav-border);
  }
  .box-head svg { width: 16px; height: 16px; display: block; fill: none; stroke: var(--purple); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .dc-meta-card > div:not(.box-head) { padding: 4px 12px; font-size: 12.5px; }
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
  .dc-sign-title { background: var(--lav-bg); color: var(--purple); font-weight: 800; font-size: 13px; padding: 7px 12px; width: 100%; border-bottom: 1px solid var(--lav-border); display: flex; align-items: center; justify-content: center; gap: 8px; box-sizing: border-box; }

  .barfoot {
    background: var(--purple);
    color: #fff;
    margin-top: 14px;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
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
          <div class="ti-sub">ORIGINAL FOR RECIPIENT</div>
        </div>
      </div>

      <div class="info-row">
        <div class="company-info">
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg></span><span>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli,')}<br>${escHtml(profile.city || 'Vadodara')} - ${escHtml(profile.pincode || '391350')},<br>${companyState}, India</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 2.9c0-.5.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg></span><span>${escHtml(profile.phone || '+91 97120 00297')}</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 6.5l9 7 9-7"/></svg></span><span>${escHtml(profile.email || 'umamicron@gmail.com')}</span></div>
          <div class="line"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9S9.6 5.4 12 3z"/></svg></span><span>${escHtml(profile.website || 'www.umamicron.com')}</span></div>
          
          <div class="reg-details">
            <div class="reg-row"><span class="label">GSTIN</span><span class="colon">:</span><span><b>${escHtml(profile.gstNumber || '')}</b></span></div>
            <div class="reg-row"><span class="label">PAN</span><span class="colon">:</span><span>${companyPan}</span></div>
            <div class="reg-row"><span class="label">State</span><span class="colon">:</span><span>${companyState}</span></div>
          </div>
        </div>

        <div class="invoice-meta">
          <div class="block">
            <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span><span class="m-label">DC No.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${dcNo}</span></div>
            <div class="meta-row"><span class="m-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span><span class="m-label">Date</span><span class="m-colon">:</span><span class="m-value">&nbsp;${dcDate}</span></div>
            <div class="meta-row sub" style="margin-top:6px;"><span class="m-label">PO No.</span><span class="m-colon">:</span><span class="m-value">&nbsp;${poNo}</span></div>
            <div class="meta-row sub"><span class="m-label">Date</span><span class="m-colon">:</span><span class="m-value">&nbsp;${poDate}</span></div>
          </div>
        </div>
      </div>

      <div class="parties" style="display:block;">
        <div class="party">
          <div class="party-head"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> CONSIGNEE / TO</div>
          <div class="party-body">
            <div class="cname">${partyName}</div>
            ${addressLines.map(line => `<div>${escHtml(line)}</div>`).join('')}
          </div>
          <div class="party-foot">
            <div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span>${partyGstin}</span></div>
            <div class="frow"><span class="flabel">State</span><span class="fcolon">:</span><span>${shipState} (${stateCode})</span></div>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="items">
          <thead>
            <tr>
              <th class="num" style="width:8%">Sr. No.</th>
              <th style="width:52%">DESCRIPTION</th>
              <th class="num" style="width:20%">TOTAL NO. OF DRUMS</th>
              <th class="num" style="width:20%">QUANTITY (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows.join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="num">TOTAL</td>
              <td class="num">${drumsTotal}</td>
              <td class="num">${qtyTotal}</td>
            </tr>
          </tfoot>
        </table>
  </div>

      <div class="dc-footer-grid">
        <div class="dc-meta-card">
          <div class="box-head"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> TRANSPORT DETAILS</div>
          <div class="dc-meta-row" style="margin-top:8px;"><div class="dc-meta-label">Vehicle No.</div><div class="data-value">: &nbsp;${escHtml(data.vehicleNo || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Drivers name</div><div class="data-value">: &nbsp;${escHtml(data.driverName || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Driver's Contact</div><div class="data-value">: &nbsp;${escHtml(data.driverContact || data.driverPhone || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">Transporter's Name</div><div class="data-value">: &nbsp;${escHtml(data.transporterName || data.transporter || '')}</div></div>
          <div class="dc-meta-row"><div class="dc-meta-label">GSTIN</div><div class="data-value">: &nbsp;${escHtml(profile.gstNumber || '')}</div></div>
        </div>
        <div class="dc-sign-stack">
          <div class="dc-sign-card">
            <div class="dc-sign-title">For ${escHtml(profile.companyName || 'UMA MICRON')}</div>
            <div class="dc-sign-space"></div>
            <span style="font-size: 11px; color: #333;">Authorised Signatory</span>
          </div>
          <div class="dc-sign-card">
            <div class="dc-sign-title">RECEIVED BY</div>
            <div class="dc-sign-space"></div>
            <span style="font-size: 11px; color: #333;">Authorised Signatory</span>
          </div>
        </div>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>This is a computer generated document.</span>
        <span>Page 1 of 1</span>
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
