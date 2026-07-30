import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  renderHtmlToPdf,
  buildPrintLogoHtml
} from './printTheme';

const splitAddress = (address) => {
  if (!address) return '';
  return address
    .split('\n')
    .map((l) => escHtml(l.trim()))
    .filter(Boolean)
    .join('<br>');
};

const extractUnit = (rateStr) => {
  if (!rateStr) return '-';
  const lower = rateStr.toLowerCase();
  if (lower.includes('/ kg')) return 'Per Kg';
  if (lower.includes('/ pc') || lower.includes('/ no')) return 'Per No.';
  if (lower.includes('nil')) return 'Lump Sum';
  if (lower.includes('/ report')) return 'Per Report';
  return 'Per Process';
};

const extractRate = (rateStr) => {
  if (!rateStr) return '-';
  let rate = rateStr.replace(/₹/g, '').trim();
  rate = rate.replace(/\/\s*[a-zA-Z]+/g, '').trim();
  return rate || 'Nil';
};

export const buildQuotationHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const mainCharges = data.mainCharges || [];
  const optionalCharges = data.optionalCharges || [];
  const companyName = escHtml(profile.companyName || 'UMA MICRON');
  const qtnNo = escHtml(data.quotationNo || 'N/A');
  const qtnDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const validityDate = escHtml(formatPdfDateDmy(data.validityDate) || '');
  
  let valDays = '30';
  if (data.date && data.validityDate) {
    const d1 = new Date(data.date);
    const d2 = new Date(data.validityDate);
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (!isNaN(diff) && diff > 0) valDays = String(diff);
  }

  const descriptionHtml = data.description
    ? escHtml(data.description).replace(/\r?\n/g, '<br>')
    : '';

  const mainRows =
    mainCharges.length > 0
      ? mainCharges
          .map(
            (c, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="left">${escHtml(c.description)}</td>
              <td>${c.psdRequirement ? escHtml(c.psdRequirement) : '—'}</td>
              <td>${extractUnit(c.rate)}</td>
              <td>${extractRate(c.rate)}</td>
              <td>—</td>
            </tr>`
          )
          .join('')
      : `<tr><td colspan="6" style="text-align:center;color:var(--muted)">No charges applied</td></tr>`;

  const optionalRows =
    optionalCharges.length > 0
      ? optionalCharges
          .map(
            (c, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="left">${escHtml(c.description)}</td>
              <td>${extractRate(c.rate)} / ${extractUnit(c.rate)}</td>
            </tr>`
          )
          .join('')
      : `<tr><td colspan="3" style="text-align:center;color:var(--muted)">No optional charges applied</td></tr>`;

  const addrStr = escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli, N.H. No. 8, Vadodara – 391350, Gujarat, India');
  const phoneStr = escHtml(profile.phone || '+91 97120 00297');
  const emailStr = escHtml(profile.email || 'info@umamicron.com');
  const webStr = escHtml(profile.website || 'www.umamicron.com');

  const sigName = escHtml(data.signatoryName || 'Amit Patel');
  const sigFirstName = sigName.split(' ')[0];

  const partyName = escHtml(data.partyName || '');
  const partyAddr = splitAddress(data.partyAddress || data.address || '');
  const partyGstin = escHtml(data.gstin || '');
  const partyContact = escHtml(data.contactPerson || '');
  const partyMobile = escHtml(data.partyMobile || data.mobile || '');
  const partyEmail = escHtml(data.partyEmail || data.email || '');

  const subject = escHtml(data.subject || 'Quotation for Micronization Services');

  const logoHtml = buildPrintLogoHtml(profile);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Quotation - ${companyName}</title>
<style>
  :root{
    --purple:#4a2472;
    --purple-dark:#3a1c5c;
    --purple-light:#f2edf8;
    --purple-border:#d9cdec;
    --green:#2e8b3d;
    --orange:#f5811f;
    --text:#2b2b2b;
    --muted:#5a5a5a;
  }
  *{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;}
  body{background:#e9e9ee;padding:24px 0;}
  .sheet{
    width:850px;margin:0 auto 24px auto;background:#fff;
    box-shadow:0 4px 18px rgba(0,0,0,.15);
    position:relative;overflow:hidden;
    border-radius:4px;
  }
  .sheet + .sheet{margin-top:30px;}

  /* ============ HEADER ============ */
  .header{position:relative;display:flex;align-items:center;justify-content:space-between;
    padding:22px 28px 16px 28px;background:#fff;}
  .header::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--purple);}
  .brand{display:flex;align-items:center;gap:14px;}
  .brand-logo{width:62px;height:62px;position:relative;flex-shrink:0;}
  .brand-title h1{font-family:Georgia,'Times New Roman',serif;color:var(--purple);font-size:30px;
    letter-spacing:.5px;font-weight:700;}
  .brand-title p{color:var(--green);font-weight:700;font-size:13px;letter-spacing:.3px;margin-top:1px;}

  .quote-banner{position:relative;display:flex;align-items:center;height:92px;margin-right:-28px;}
  .quote-banner .cut{
    position:absolute;top:0;bottom:0;left:-42px;width:42px;background:var(--purple);
    clip-path:polygon(100% 0, 100% 100%, 0 100%);
  }
  .quote-banner .fill{background:var(--purple);height:100%;display:flex;flex-direction:column;
    align-items:flex-end;justify-content:center;padding:0 28px 0 30px;min-width:300px;}
  .quote-banner h2{color:#fff;font-size:28px;letter-spacing:2px;font-weight:800;}
  .quote-banner .sub{margin-top:6px;background:rgba(255,255,255,.14);color:#fff;font-size:10px;
    font-weight:700;letter-spacing:.6px;padding:4px 12px;border-radius:3px;}

  /* ============ CONTACT BAR ============ */
  .contact-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;
    gap:6px 18px;padding:9px 28px;font-size:10.5px;color:var(--text);border-bottom:1px solid #eee;}
  .contact-bar span{display:flex;align-items:center;gap:6px;white-space:nowrap;}
  .contact-right{display:flex;align-items:center;flex-wrap:wrap;gap:6px 20px;}
  .ic{width:14px;height:14px;flex-shrink:0;fill:var(--purple);}

  .body-pad{padding:0 28px;}

  /* ============ TWO COL INFO ============ */
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;}
  .pill-head{background:var(--purple);color:#fff;font-size:11px;font-weight:700;letter-spacing:.4px;
    padding:6px 14px;border-radius:16px;display:inline-flex;align-items:center;gap:6px;
    position:relative;z-index:2;margin-left:12px;}
  .pill-head svg{width:13px;height:13px;fill:#fff;}
  .card{border:1px solid var(--purple-border);border-radius:6px;padding:16px 14px 12px 14px;
    margin-top:-11px;background:#fff;position:relative;}
  .card .co-name{font-weight:800;color:var(--purple);font-size:12.5px;}
  .card .addr{color:var(--muted);font-size:10.5px;margin:5px 0 9px 0;line-height:1.45;}
  .info-table{width:100%;border-collapse:collapse;font-size:10.5px;}
  .info-table td{padding:2.5px 0;vertical-align:top;}
  .info-table td.label{font-weight:600;color:var(--muted);width:38%;}
  .info-table td.colon{width:4%;}

  .qd-card{position:relative;}
  .badge{position:absolute;top:10px;right:10px;width:78px;height:92px;text-align:center;color:#fff;}
  .badge svg{width:78px;height:92px;}
  .badge .txt{position:absolute;top:16px;left:0;right:0;text-align:center;}
  .badge .txt .l1{font-size:6px;font-weight:700;letter-spacing:.3px;}
  .badge .txt .l2{font-size:19px;font-weight:800;line-height:1.1;margin:1px 0;}
  .badge .txt .l3{font-size:6px;font-weight:700;letter-spacing:.3px;}

  /* ============ SUBJECT ============ */
  .subject{background:var(--purple-light);border-left:4px solid var(--purple);padding:7px 14px;
    margin-top:16px;font-size:11px;font-weight:700;color:var(--purple-dark);}
  .subject span{color:var(--text);font-weight:400;}

  /* ============ LETTER ============ */
  .letter{display:flex;gap:18px;margin-top:12px;align-items:flex-start;}
  .letter-text{flex:2;font-size:10.8px;line-height:1.55;color:var(--text);}
  .letter-text p{margin-top:7px;}
  .letter-text p:first-child{margin-top:0;}
  .letter-text b{color:var(--purple-dark);}
  .fac-img{flex:1;border-radius:6px;overflow:hidden;height:118px;}
  .fac-img svg{width:100%;height:100%;display:block;}

  /* ============ TABLES ============ */
  .tables{display:grid;grid-template-columns:1.32fr 1fr;gap:14px;margin-top:16px;}
  .tbl-title{display:flex;align-items:center;gap:7px;background:var(--purple);color:#fff;
    font-size:11px;font-weight:700;letter-spacing:.3px;padding:7px 12px;border-radius:6px 6px 0 0;}
  .tbl-title.green{background:var(--green);}
  .tbl-title svg{width:14px;height:14px;fill:#fff;}
  table.dt{width:100%;border-collapse:collapse;border:1px solid var(--purple-border);border-top:none;}
  table.dt.green{border-color:#bfe0c4;}
  table.dt th{background:var(--purple-light);color:var(--purple-dark);font-size:9.6px;font-weight:700;
    padding:6px 5px;border:1px solid var(--purple-border);text-align:center;}
  table.dt.green th{background:#eaf7ec;color:var(--green);border-color:#bfe0c4;}
  table.dt td{border:1px solid #e6e6e6;padding:6px 5px;font-size:9.8px;text-align:center;color:var(--text);}
  table.dt.green td{border-color:#dcefdf;}
  table.dt td.left{text-align:left;}
  .nil{color:var(--green);font-weight:800;}

  /* ============ FEATURES BAR ============ */
  .features{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin:20px 0 4px 0;}
  .feat{border:1px solid #eae4f2;border-radius:8px;padding:10px 5px 8px 5px;text-align:center;
    background:#fbfaff;}
  .feat .circ{width:34px;height:34px;border-radius:50%;margin:0 auto 6px auto;display:flex;
    align-items:center;justify-content:center;}
  .feat .circ svg{width:18px;height:18px;}
  .feat p{font-size:7.6px;font-weight:800;color:var(--text);line-height:1.25;letter-spacing:.1px;}

  /* ============ SIGN / NOTE / QR ============ */
  .foot-row{display:flex;gap:20px;border-top:1px solid #eee;padding:14px 0 6px 0;margin-top:8px;}
  .fr-sign{flex:0 0 150px;}
  .fr-sign p{font-size:11px;}
  .fr-sign .sig{font-family:'Brush Script MT',cursive;color:var(--purple);font-size:20px;margin:8px 0 0 4px;}
  .fr-sign .name{font-weight:700;margin-top:2px;font-size:11px;}
  .fr-note{flex:1;}
  .fr-note p{font-weight:700;font-size:11px;margin-bottom:4px;}
  .fr-note ul{padding-left:16px;font-size:9.3px;color:#444;line-height:1.55;}
  .fr-qr{flex:0 0 92px;text-align:center;border:1px solid #ddd;border-radius:6px;padding:8px 6px;}
  .fr-qr .qrbox{width:64px;height:64px;margin:0 auto;}
  .fr-qr span{display:block;font-size:7.3px;font-weight:700;color:var(--purple-dark);margin-top:5px;line-height:1.3;}

  /* wave bottom of page 1 */
  .wave{height:26px;background:linear-gradient(90deg,var(--purple),#6a3aa0);
    clip-path:ellipse(70% 100% at 50% 100%);margin-top:6px;}

  /* ============ PAGE 2 ============ */
  .page2-header{background:var(--purple);color:#fff;display:flex;align-items:center;gap:8px;
    padding:9px 28px;font-size:13px;font-weight:800;letter-spacing:.4px;margin:0;
    clip-path:polygon(0 0,100% 0,100% 100%,3% 100%);}
  .page2-header svg{width:15px;height:15px;fill:#fff;}

  .terms-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;padding:18px 28px 4px 28px;}
  .term{border:1px solid #e6e6e6;border-top:3px solid var(--purple);border-radius:6px;padding:9px 7px;
    background:#fdfdfd;}
  .term .ticon{width:20px;height:20px;margin-bottom:5px;}
  .term h4{color:var(--purple-dark);font-size:8.6px;font-weight:800;letter-spacing:.2px;margin-bottom:4px;}
  .term p{font-size:8px;color:#555;line-height:1.4;}

  .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 28px 22px 28px;}
  .bbox{background:#f7f9fb;border:1px solid #e3e8ee;border-radius:6px;padding:12px 14px;}
  .bbox-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
  .bbox-head svg{width:16px;height:16px;fill:var(--purple-dark);}
  .bbox-head h4{color:var(--purple-dark);font-size:11px;font-weight:800;letter-spacing:.2px;}
  .bbox ol{padding-left:16px;font-size:9.6px;line-height:1.55;color:#333;}
  .sign2{text-align:right;margin-top:14px;}
  .sign2 p{font-size:10.5px;}
  .sign2 .sig{font-family:'Brush Script MT',cursive;color:var(--purple);font-size:19px;margin:6px 30px 0 0;}
  .sign2 .seal{width:52px;height:52px;margin-left:auto;margin-top:2px;}

  .bottom-banner{background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:space-between;
    padding:11px 28px;font-size:10.5px;margin:0 0 0 0;}
  .bottom-banner .thankyou{font-style:italic;font-size:11px;}
  .bottom-banner .items{display:flex;align-items:center;gap:14px;}
  .bottom-banner .items span{display:flex;align-items:center;gap:6px;}
  .bottom-banner svg{width:13px;height:13px;fill:#fff;}
  .bottom-banner .sep{opacity:.5;}

  @media print{
    body{background:#fff;padding:0;}
    .sheet{box-shadow:none;margin:0;width:210mm;min-height:297mm;border-radius:0;}
  }
</style>
</head>
<body>

<!-- ============================================================ PAGE 1 ============================================================ -->
<div class="sheet pdf-page print-host">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <div class="brand-logo">
        ${logoHtml}
      </div>
      <div class="brand-title">
        <h1>${companyName}</h1>
        <p>${escHtml(profile.tagline || "Micronization of API's")}</p>
      </div>
    </div>
    <div class="quote-banner">
      <div class="cut"></div>
      <div class="fill">
        <h2>QUOTATION</h2>
        <div class="sub">CONTRACT MICRONIZATION SERVICES</div>
      </div>
    </div>
  </div>

  <!-- CONTACT BAR -->
  <div class="contact-bar">
    <span><svg class="ic" viewBox="0 0 24 24"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>${addrStr}</span>
    <div class="contact-right">
      <span><svg class="ic" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1L6.6 10.8z"/></svg>${phoneStr}</span>
      <span><svg class="ic" viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>${emailStr}</span>
      <span><svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-3a15.6 15.6 0 00-1.4-3.9A8 8 0 0118.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8 8 0 010-4h3.4a17 17 0 000 4H4.3zm.8 2h3a15.6 15.6 0 001.4 3.9A8 8 0 015.1 16zm3-8H5.1a8 8 0 014.4-3.9A15.6 15.6 0 008.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a13 13 0 010-4h4.6a13 13 0 010 4zm.4 5.9c.6-1.2 1.1-2.5 1.4-3.9h3a8 8 0 01-4.4 3.9zm1.8-5.9a17 17 0 000-4h3.4a8 8 0 010 4h-3.4z"/></svg>${webStr}</span>
    </div>
  </div>

  <div class="body-pad">
    <!-- TWO COL -->
    <div class="two-col">
      <div>
        <div class="pill-head"><svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z"/></svg>PREPARED FOR</div>
        <div class="card">
          <div class="co-name">${partyName}</div>
          <div class="addr">${partyAddr}</div>
          <table class="info-table">
            <tr><td class="label">GSTIN</td><td class="colon">:</td><td>${partyGstin}</td></tr>
            <tr><td class="label">Contact Person</td><td class="colon">:</td><td>${partyContact}</td></tr>
            <tr><td class="label">Mobile</td><td class="colon">:</td><td>${partyMobile}</td></tr>
            <tr><td class="label">Email</td><td class="colon">:</td><td>${partyEmail}</td></tr>
          </table>
        </div>
      </div>

      <div>
        <div class="pill-head"><svg viewBox="0 0 24 24"><path d="M6 2h12a1 1 0 011 1v18l-7-3-7 3V3a1 1 0 011-1z"/></svg>QUOTATION DETAILS</div>
        <div class="card qd-card">
          <table class="info-table">
            <tr><td class="label">Quotation No.</td><td class="colon">:</td><td>${qtnNo}</td></tr>
            <tr><td class="label">Quotation Date</td><td class="colon">:</td><td>${qtnDate}</td></tr>
            <tr><td class="label">Validity</td><td class="colon">:</td><td>${validityDate}</td></tr>
            <tr><td class="label">Contact Person</td><td class="colon">:</td><td>${sigName}</td></tr>
            <tr><td class="label">Mobile</td><td class="colon">:</td><td>${phoneStr}</td></tr>
            <tr><td class="label">Email</td><td class="colon">:</td><td>${emailStr}</td></tr>
          </table>
        </div>
      </div>
    </div>

    <!-- SUBJECT -->
    <div class="subject">SUBJECT: <span>${subject}</span></div>

    <!-- LETTER -->
    <div class="letter">
      <div class="letter-text">
        <p><b>Dear Sir/Madam,</b></p>
        <p>With reference to your enquiry, we are pleased to submit our offer for Micronization Services as per the details mentioned below. <b>${companyName}</b>, Vadodara is a Gujarat based company that offers <b>CONTRACT MICRONIZATION SERVICES</b> dedicated to comply the needs of the pharmaceutical industry. Our facility at Ranoli – Vadodara operates as per cGMP standards with more than <b>500 sq.ft.</b> processing area and large warehouse facility.</p>
        <p>We trust our offer will be in line with your requirement.</p>
        <p>For any techno-commercial queries, please feel free to contact us.</p>
        ${descriptionHtml ? `<p>${descriptionHtml}</p>` : ''}
      </div>
      <div class="fac-img">
        <svg viewBox="0 0 300 190" preserveAspectRatio="xMidYMid slice">
          <rect width="300" height="190" fill="#dfe6ee"/>
          <rect y="120" width="300" height="70" fill="#c7d0dc"/>
          <rect x="0" y="0" width="300" height="120" fill="#eef2f6"/>
          <rect x="20" y="30" width="60" height="90" rx="4" fill="#b9c3d1"/>
          <ellipse cx="150" cy="90" rx="45" ry="55" fill="#9aa7b8"/>
          <ellipse cx="150" cy="90" rx="45" ry="55" fill="none" stroke="#6f7c8d" stroke-width="3"/>
          <rect x="130" y="20" width="40" height="16" fill="#7f8ca0"/>
          <circle cx="150" cy="150" r="6" fill="#556170"/>
          <rect x="200" y="55" width="70" height="65" rx="3" fill="#aeb8c6"/>
          <rect x="210" y="65" width="20" height="45" fill="#8f9aab"/>
          <rect x="235" y="65" width="20" height="45" fill="#8f9aab"/>
          <circle cx="65" cy="45" r="8" fill="#6f7c8d"/>
        </svg>
      </div>
    </div>

    <!-- TABLES -->
    <div class="tables">
      <div>
        <div class="tbl-title"><svg viewBox="0 0 24 24"><path d="M4 4h16v2H4zM4 11h16v2H4zM4 18h16v2H4z"/></svg>COMMERCIAL OFFER</div>
        <table class="dt">
          <thead><tr><th>Sr. No.</th><th>Description</th><th>PSD Requirement</th><th>Unit</th><th>Rate (₹)</th><th>Remarks</th></tr></thead>
          <tbody>
            ${mainRows}
          </tbody>
        </table>
      </div>
      <div>
        <div class="tbl-title green"><svg viewBox="0 0 24 24"><path d="M12 2l1.9 5.9H20l-4.9 3.6L17 17.5 12 14l-5 3.5 1.9-6L4 7.9h6.1z"/></svg>OPTIONAL SERVICES</div>
        <table class="dt green">
          <thead><tr><th>Sr. No.</th><th>Description</th><th>Rate (₹)</th></tr></thead>
          <tbody>
            ${optionalRows}
          </tbody>
        </table>
      </div>
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

    <!-- FOOT ROW: sign / note / qr -->
    <div class="foot-row">
      <div class="fr-sign">
        <p><b>Thanking You,</b></p>
        <p><b>For ${companyName}</b></p>
        <div class="sig">${sigFirstName}</div>
        <p class="name">${sigName}</p>
      </div>
      <div class="fr-note">
        <p>Note:</p>
        <ul>
          <li>All above rates are in Indian Rupees (₹).</li>
          <li>GST will be charged extra as applicable.</li>
          <li>This is a quotation and not an invoice.</li>
          <li>Please send your Purchase Order along with material &amp; specification.</li>
        </ul>
      </div>
      <div class="fr-qr">
        <div class="qrbox">
          <svg viewBox="0 0 100 100" width="64" height="64">
            <rect width="100" height="100" fill="#fff"/>
            <rect x="4" y="4" width="26" height="26" fill="none" stroke="#000" stroke-width="5"/>
            <rect x="12" y="12" width="10" height="10" fill="#000"/>
            <rect x="70" y="4" width="26" height="26" fill="none" stroke="#000" stroke-width="5"/>
            <rect x="78" y="12" width="10" height="10" fill="#000"/>
            <rect x="4" y="70" width="26" height="26" fill="none" stroke="#000" stroke-width="5"/>
            <rect x="12" y="78" width="10" height="10" fill="#000"/>
            <rect x="40" y="10" width="8" height="8" fill="#000"/>
            <rect x="52" y="10" width="8" height="8" fill="#000"/>
            <rect x="40" y="24" width="8" height="8" fill="#000"/>
            <rect x="60" y="40" width="8" height="8" fill="#000"/>
            <rect x="40" y="40" width="8" height="8" fill="#000"/>
            <rect x="80" y="40" width="8" height="8" fill="#000"/>
            <rect x="40" y="55" width="8" height="8" fill="#000"/>
            <rect x="55" y="60" width="8" height="8" fill="#000"/>
            <rect x="70" y="70" width="8" height="8" fill="#000"/>
            <rect x="55" y="80" width="8" height="8" fill="#000"/>
            <rect x="85" y="85" width="8" height="8" fill="#000"/>
            <rect x="40" y="85" width="8" height="8" fill="#000"/>
          </svg>
        </div>
        <span>SCAN TO VISIT OUR WEBSITE</span>
      </div>
    </div>
  </div>
  <div class="wave"></div>
</div>

<!-- ============================================================ PAGE 2 ============================================================ -->
<div class="sheet pdf-page">
  <div class="page2-header"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM6 8h12M6 12h12M6 16h8"/></svg>TERMS &amp; CONDITIONS</div>

  <div class="terms-grid">
    <div class="term">
      <svg class="ticon" viewBox="0 0 24 24" fill="var(--purple)"><path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5z"/></svg>
      <h4>TAXES</h4>
      <p>GST will be charged extra as applicable.</p>
    </div>
    <div class="term">
      <svg class="ticon" viewBox="0 0 24 24" fill="#2f9e8f"><path d="M17 4L4 17l1.4 1.4L18.4 5.4zM6.5 4a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm11 10a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>
      <h4>PROCESS LOSS</h4>
      <p>Loss occurs during processing is on your account.</p>
    </div>
    <div class="term">
      <svg class="ticon" viewBox="0 0 24 24" fill="var(--green)"><path d="M12 4V1L8 5l4 4V6a6 6 0 11-6 6H4a8 8 0 108-8z"/></svg>
      <h4>BATCH / CHANGE OVER</h4>
      <p>If same material is required to be micronized in separate batch(es) or different PSD specification, Change Over Charge @ ₹ 500/- per batch or per specification will be applicable.</p>
    </div>
    <div class="term">
      <svg class="ticon" viewBox="0 0 24 24" fill="var(--orange)"><path d="M3 6h11v8H3zM14 9h4l3 3v2h-7zM6.5 19a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z"/></svg>
      <h4>OTHER CHARGES</h4>
      <p>This is only processing charges. All other charges like Transportation, Insurance, Repacking material charges will be extra.</p>
    </div>
    <div class="term">
      <svg class="ticon" viewBox="0 0 24 24" fill="#2f9e8f"><path d="M2 5h20v14H2zm0 4h20v2H2zm3 5h6v2H5z"/></svg>
      <h4>PAYMENT TERMS</h4>
      <p>100% Advance against Performa Invoice.</p>
    </div>
    <div class="term">
      <svg class="ticon" viewBox="0 0 24 24" fill="#2f9e8f"><path d="M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z"/></svg>
      <h4>VALIDITY</h4>
      <p>This quotation is valid up to ${validityDate}.</p>
    </div>
  </div>

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
      <div class="sign2">
        <p><b>For ${companyName}</b></p>
        <svg class="seal" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--purple)" stroke-width="2"/><text x="50" y="45" text-anchor="middle" font-size="12" fill="var(--purple)" font-weight="700">UMA</text><text x="50" y="60" text-anchor="middle" font-size="9" fill="var(--purple)">MICRON</text></svg>
        <div class="sig">${sigFirstName}</div>
        <p><b>${sigName}</b><br><small>Authorised Signatory</small></p>
      </div>
    </div>
  </div>

  <div class="bottom-banner">
    <span class="thankyou">Thank you for your business!</span>
    <div class="items">
      <span><svg viewBox="0 0 24 24"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>Quality You Can Trust</span>
      <span class="sep">|</span>
      <span><svg viewBox="0 0 24 24"><path d="M13 2L3 14h6l-1 8 11-14h-6z"/></svg>Performance You Can Rely On</span>
    </div>
  </div>
</div>

</body>
</html>`;
};

export const renderQuotationPdf = async (data, { mode = 'save' } = {}) => {
  alert('Loading NEW two-page quotation format!');
  const html = buildQuotationHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'QUOTATION_NEW',
    docNo: data.quotationNo || 'N/A',
    width: 850,
    fitPage: false
  });
};
