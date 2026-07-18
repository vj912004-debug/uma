import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  PRINT_PAGE_W,
  renderHtmlToPdf
} from './printTheme';

const splitAddress = (address) => {
  if (!address) return '';
  return address.split('\n').map(l => escHtml(l.trim())).filter(Boolean).join('<br>');
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
  const savedNotes = String(data.notes || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const descriptionHtml = data.description
    ? escHtml(data.description).replace(/\r?\n/g, '<br>')
    : '';

  const qtnNo = escHtml(data.quotationNo || 'N/A');
  const qtnDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const validityDate = escHtml(formatPdfDateDmy(data.validityDate) || '');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Quotation - ${escHtml(profile.companyName || 'UMA MICRON')}</title>
<style>
  :root{
    --purple-deep: #3A1B6E;
    --purple: #5B3A9E;
    --purple-mid: #6C4FA1;
    --purple-light: #F1EDF9;
    --purple-border: #C9BEE0;
    --green: #22874F;
    --text-dark: #2b2b2b;
  }
  *{box-sizing:border-box;}
  html,body{
    margin:0;padding:0;
    background:#e9e9ec;
    font-family: Arial, Helvetica, sans-serif;
    color: var(--text-dark);
  }
  .sheet{
    width:210mm;
    min-height:297mm;
    margin:10px auto;
    background:#fff;
    border:1px solid #B8B8B8;
    padding:0 0 3mm 0;
    position:relative;
    overflow:hidden;
    display:flex;
    flex-direction:column;
  }
  @media print{
    body{background:#fff;}
    .sheet{margin:0;border:none;}
    @page{ size:A4; margin:0; }
  }
  .pad{ padding-left:9mm; padding-right:9mm; }

  /* ===== HEADER ===== */
  .header{
    position:relative;
    display:flex;
    align-items:center;
    justify-content:space-between;
    min-height:58px;
    padding:6px 9mm 6px 9mm;
    background:#fff;
  }
  .header::after{
    content:"";
    position:absolute;
    top:0; right:0; bottom:0;
    width:62%;
    background:linear-gradient(120deg, var(--purple) 0%, var(--purple-deep) 100%);
    clip-path: polygon(28% 0, 100% 0, 100% 100%, 0% 100%);
    z-index:0;
  }
  .logo-block{
    display:flex;
    align-items:center;
    gap:10px;
    position:relative;
    z-index:1;
  }
  .logo-icon{ width:36px;height:36px; }
  .company-name{ font-size:23px;font-weight:800; color:#3A1B6E; font-family: Georgia, 'Times New Roman', serif; }
  .company-tagline{ font-size:11px;color:#1a9e6a;font-weight:700; letter-spacing:0.3px; }
  .quote-title-block{
    position:relative; z-index:1;
    text-align:right;
    color:#fff;
    padding-right:6px;
  }
  .quote-title{
    font-size:27px;
    font-weight:800;
    letter-spacing:1.5px;
  }
  .quote-pill{
    display:inline-block;
    background:#fff;
    color:var(--purple-deep);
    font-weight:700;
    font-size:10px;
    letter-spacing:0.3px;
    padding:4px 12px;
    border-radius:12px;
    margin-top:5px;
  }

  /* ===== CONTACT BAR ===== */
  .contact-bar{
    display:flex;
    align-items:center;
    gap:10px;
    padding:4px 9mm;
    background:var(--purple-light);
    font-size:9px;
    line-height:1.3;
    flex-wrap:wrap;
  }
  .contact-bar .item{
    display:flex;align-items:center;gap:6px;
  }

  /* ===== PREPARED FOR / QUOTATION DETAILS ===== */
  .info-section{
    display:flex;
    gap:10px;
    padding:5px 9mm 0 9mm;
  }
  .info-col{ width:50%; }
  .box{
    border:1px solid var(--purple-border);
    border-radius:6px;
    overflow:visible;
    height:100%;
  }
  .box-hd{
    background:var(--purple-mid);
    color:#fff;
    font-weight:700;
    font-size:10.5px;
    padding:4px 11px;
    display:flex;
    align-items:center;
    gap:7px;
    border-radius:12px;
    width:fit-content;
    position:relative;
    top:-1px;
    left:8px;
    margin-bottom:-8px;
  }
  .box-body{
    padding:9px 10px 4px 10px;
    font-size:9.4px;
    line-height:1.42;
  }
  .box-body .cname{ font-weight:700; color:var(--purple-deep); margin-bottom:3px; }
  .qd-row{ display:flex; gap:6px; margin-bottom:1px; align-items:center;}
  .qd-row .qd-label{ width:95px; display:flex; align-items:center; gap:6px; color:#444; flex-shrink:0; }
  .qd-row .qd-val{ font-weight:700; }
  .qd-with-badge{ display:flex; gap:10px; }
  .qd-fields{ flex:1; }
  .badge-wrap{ width:78px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

  /* ===== SUBJECT BAR ===== */
  .subject-bar{
    margin:5px 9mm 0 9mm;
    background:var(--purple-light);
    border:1px solid var(--purple-border);
    border-radius:6px;
    padding:4px 12px;
    font-size:9.8px;
    display:flex;
    gap:8px;
    align-items:center;
  }
  .subject-bar b{ color:var(--purple-deep); }

  /* ===== INTRO ===== */
  .intro{
    display:flex;
    gap:16px;
    padding:5px 9mm 0 9mm;
    font-size:9.4px;
    line-height:1.36;
  }
  .intro-text{ flex:1.4; }
  .intro-text p{ margin:0 0 3px 0; }
  .intro-img{
    flex:1;
    border-radius:6px;
    overflow:hidden;
    height:100px;
  }
  .intro-img svg{ width:100%; height:100%; display:block; }

  /* ===== TABLES ===== */
  .tables-row{
    display:flex;
    gap:14px;
    padding:4px 9mm 0 9mm;
    align-items:flex-start;
  }
  .table-col{ width:58%; }
  .table-col.opt{ width:42%; }
  .table-hd{
    display:flex;
    align-items:center;
    gap:7px;
    background:var(--purple-deep);
    color:#fff;
    font-weight:700;
    font-size:11px;
    padding:6px 12px;
    border-radius:5px 5px 0 0;
  }
  .table-hd.green{ background:var(--green); }
  table.offer{
    width:100%;
    border-collapse:collapse;
    font-size:8.5px;
    border:1px solid var(--purple-border);
    border-top:none;
  }
  table.offer th{
    background:#F5F2FA;
    padding:3.5px 4px;
    font-weight:700;
    border:1px solid var(--purple-border);
    text-align:center;
  }
  table.offer td{
    padding:3.5px 4px;
    border:1px solid var(--purple-border);
    text-align:center;
  }
  table.offer td.desc{ text-align:left; }
  table.offer td.nil{ color:var(--green); font-weight:800; }

  /* ===== ICON ROW ===== */
  .icon-row{
    display:flex;
    justify-content:space-between;
    padding:3px 9mm 0 9mm;
    gap:4px;
  }
  .icon-item{
    flex:1;
    display:flex;
    flex-direction:column;
    align-items:center;
    text-align:center;
    gap:2px;
    font-size:7.4px;
    font-weight:700;
    color:#333;
  }
  .icon-circle{
    width:30px;height:30px;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }

  /* ===== THANKING / NOTE / QR ===== */
  .closing-row{
    display:flex;
    gap:14px;
    padding:3px 9mm 0 9mm;
    align-items:stretch;
  }
  .thank-box{ width:24%; font-size:9px; line-height:1.3; }
  .note-box{
    width:52%;
    font-size:8.8px;
    border-left:1px solid var(--purple-border);
    border-right:1px solid var(--purple-border);
    padding:0 14px;
  }
  .note-box ul{ margin:2px 0; padding-left:14px; line-height:1.4; }
  .qr-box{
    width:24%;
    display:flex;
    align-items:center;
    gap:8px;
    font-size:8.8px;
    font-weight:700;
    color:var(--purple-deep);
  }
  .qr-box img{ width:46px;height:46px; border:1px solid #ccc; padding:2px; }
  .sig-img{ font-family:'Brush Script MT', cursive; font-size:17px; color:#333; margin:2px 0; }

  /* ===== FOOTER BAR ===== */
  .footer-bar{
    margin-top:6px;
    background:var(--purple-deep);
    color:#fff;
    display:flex;
    justify-content:space-around;
    align-items:center;
    padding:4px 9mm;
    font-size:8.6px;
    gap:10px;
  }
  .footer-bar .thankyou{ font-style:italic; font-weight:600; }
  .footer-bar .item{ display:flex; align-items:center; gap:6px; }

  /* ===== PAGE 2 : TERMS ===== */
  .terms-hd{
    display:inline-flex;
    align-items:center;
    gap:8px;
    background:var(--purple-deep);
    color:#fff;
    font-weight:700;
    font-size:11px;
    padding:5px 14px;
    border-radius:0 10px 10px 0;
    margin:6px 0 6px 0;
  }
  .terms-cards{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:6px;
    padding:0 9mm;
  }
  .tcard{
    border:1px solid var(--purple-border);
    border-radius:6px;
    padding:5px 7px;
    font-size:8px;
    line-height:1.28;
    text-align:center;
  }
  .tcard .ticon{
    width:20px;height:20px;
    margin:0 auto 3px auto;
  }
  .tcard .ttitle{
    font-weight:800;
    font-size:8.5px;
    margin-bottom:2px;
    letter-spacing:0.2px;
  }
  .notes-resp-row{
    display:flex;
    gap:8px;
    padding:5px 9mm 0 9mm;
  }
  .notes-box, .resp-box{
    width:50%;
    border:1px solid var(--purple-border);
    border-radius:6px;
    padding:6px 9px;
    font-size:8.3px;
    line-height:1.32;
  }
  .notes-box .nrhd, .resp-box .nrhd{
    display:flex;align-items:center;gap:5px;
    font-weight:800;
    color:var(--purple-deep);
    font-size:9.3px;
    margin-bottom:3px;
  }
  .notes-box ol, .resp-box ol{ margin:0; padding-left:12px; }
  .notes-box li, .resp-box li{ margin-bottom:2px; }

  .sign-block2{
    display:flex;
    justify-content:flex-end;
    padding:4px 9mm 3px 9mm;
    gap:10px;
    align-items:flex-end;
  }
  .stamp{
    width:46px;height:46px;
    border:1.5px solid var(--purple-mid);
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    font-size:5.6px;
    font-weight:700;
    color:var(--purple-mid);
    transform:rotate(-8deg);
  }
  .for-uma{ text-align:right; font-size:8.8px; }
  .for-uma b{ display:block; margin-bottom:4px; color:var(--purple-deep); }
</style>
</head>
<body>

<div class="sheet pdf-page print-host">

  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <svg class="logo-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 30 A35 20 0 1 1 19 71" fill="none" stroke="#1a9e6a" stroke-width="4" stroke-linecap="round"/>
        <path d="M80 70 A35 20 0 1 1 81 29" fill="none" stroke="#1a9e6a" stroke-width="4" stroke-linecap="round"/>
        <polygon points="18,66 12,78 26,76" fill="#1a9e6a"/>
        <polygon points="82,34 88,22 74,24" fill="#1a9e6a"/>
        <text x="28" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#e8781e">U</text>
        <text x="46" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#2d3a8c">M</text>
        <text x="66" y="63" font-family="Arial" font-weight="800" font-size="38" fill="#7a2f8c">J</text>
      </svg>
      <div>
        <div class="company-name">${escHtml(profile.companyName || 'UMA MICRON')}</div>
        <div class="company-tagline">${escHtml(profile.tagline || "Micronization of API's")}</div>
      </div>
    </div>
    <div class="quote-title-block">
      <div class="quote-title">QUOTATION</div>
      <div class="quote-pill">CONTRACT MICRONIZATION SERVICES</div>
    </div>
  </div>

  <!-- CONTACT BAR -->
  <div class="contact-bar">
    <div class="item">
      <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z" fill="#6C4FA1"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>
      ${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli, N.H. No. 8, Vadodara - 391350, Gujarat, India')}
    </div>
    <div class="item">
      <svg width="13" height="13" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2 2.2z" fill="#6C4FA1"/></svg>
      ${escHtml(profile.phone || '+91 97120 00297')}
    </div>
    <div class="item">
      <svg width="13" height="13" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#6C4FA1"/><path d="M2 6l10 7 10-7" stroke="#fff" stroke-width="1.6" fill="none"/></svg>
      ${escHtml(profile.email || 'info@umamicron.com')}
    </div>
    <div class="item">
      <svg width="13" height="13" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#6C4FA1"/><path d="M2 12h20M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10z" stroke="#fff" stroke-width="1.2" fill="none"/></svg>
      ${escHtml(profile.website || 'www.umamicron.com')}
    </div>
  </div>

  <!-- PREPARED FOR / QUOTATION DETAILS -->
  <div class="info-section">
    <div class="info-col">
      <div class="box-hd">
        <svg width="13" height="13" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><circle cx="12" cy="9" r="3.4" fill="#6C4FA1"/><path d="M5 19c1.2-3.2 4-5 7-5s5.8 1.8 7 5c-1.9 1.6-4.4 2.6-7 2.6s-5.1-1-7-2.6z" fill="#6C4FA1"/></svg>
        PREPARED FOR
      </div>
      <div class="box">
        <div class="box-body">
          <div class="cname">${escHtml(data.partyName)}</div>
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <svg width="11" height="11" viewBox="0 0 24 24" style="margin-top:2px;flex-shrink:0;"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z" fill="#6C4FA1"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>
            <span>${splitAddress(data.partyAddress)}</span>
          </div>
          <div class="qd-row"><span class="qd-label">GSTIN</span><span class="qd-val">: &nbsp; ${escHtml(data.gstNumber || '')}</span></div>
          <div class="qd-row"><span class="qd-label">Contact Person</span><span class="qd-val">: &nbsp; ${escHtml(data.contactPerson || '')}</span></div>
          <div class="qd-row"><span class="qd-label">Mobile</span><span class="qd-val">: &nbsp; ${escHtml(data.mobile || '')}</span></div>
          <div class="qd-row"><span class="qd-label">Email</span><span class="qd-val">: &nbsp; ${escHtml(data.email || '')}</span></div>
        </div>
      </div>
    </div>

    <div class="info-col">
      <div class="box-hd">
        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" fill="#fff"/><path d="M15 2v5h5" fill="#c9bee0"/></svg>
        QUOTATION DETAILS
      </div>
      <div class="box">
        <div class="box-body qd-with-badge">
          <div class="qd-fields">
            <div class="qd-row"><span class="qd-label">Quotation No.</span><span>:</span>&nbsp;<span class="qd-val">${qtnNo}</span></div>
            <div class="qd-row"><span class="qd-label">Quotation Date</span><span>:</span>&nbsp;<span class="qd-val">${qtnDate}</span></div>
            <div class="qd-row"><span class="qd-label">Validity</span><span>:</span>&nbsp;<span class="qd-val">${validityDate}</span></div>
            <div class="qd-row"><span class="qd-label">Contact Person</span><span>:</span>&nbsp;<span class="qd-val">${escHtml(data.signatoryName || 'Amit Patel')}</span></div>
            <div class="qd-row"><span class="qd-label">Mobile</span><span>:</span>&nbsp;<span class="qd-val">${escHtml(profile.phone || '+91 97120 00297')}</span></div>
            <div class="qd-row"><span class="qd-label">Email</span><span>:</span>&nbsp;<span class="qd-val">${escHtml(profile.email || 'info@umamicron.com')}</span></div>
          </div>
          <div class="badge-wrap">
            <svg width="74" height="88" viewBox="0 0 86 100">
              <polygon points="18,60 8,96 26,88" fill="#4a2f80"/>
              <polygon points="68,60 78,96 60,88" fill="#4a2f80"/>
              <circle cx="43" cy="42" r="38" fill="#6C4FA1" stroke="#4a2f80" stroke-width="2"/>
              <circle cx="43" cy="42" r="31" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="2,2"/>
              <text x="43" y="32" font-size="9" fill="#fff" text-anchor="middle" font-weight="700">★ ★ ★</text>
              <text x="43" y="44" font-size="7.5" fill="#fff" text-anchor="middle" font-weight="700">VALID FOR</text>
              <text x="43" y="56" font-size="11" fill="#fff" text-anchor="middle" font-weight="800">30 DAYS</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- SUBJECT -->
  <div class="subject-bar">
    <svg width="14" height="14" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="#6C4FA1"/><path d="M3 7l9 6 9-6" stroke="#fff" stroke-width="1.4" fill="none"/></svg>
    <b>SUBJECT:</b> ${escHtml(data.subject || 'Quotation for Micronization Services')}
  </div>

  <!-- INTRO -->
  <div class="intro">
    <div class="intro-text">
      <p>Dear Sir/Madam,</p>
      <p>With reference to your enquiry, we are pleased to submit our offer for Micronization Services as per the details mentioned below. UMA MICRON, Vadodara is a Gujarat based company that offers <b>CONTRACT MICRONIZATION SERVICES</b> dedicated to comply the needs of the pharmaceutical industry. Our facility at Ranoli – Vadodara operates as per cGMP standards with more than 500 sq.ft. processing area and large warehouse facility.</p>
      ${descriptionHtml ? \`<p>\${descriptionHtml}</p>\` : ''}
      <p>We trust our offer will be in line with your requirement.</p>
      <p>For any techno-commercial queries, please feel free to contact us.</p>
    </div>
  </div>

  <!-- TABLES -->
  <div class="tables-row">
    <div class="table-col">
      <div class="table-hd">
        <svg width="14" height="14" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="#fff"/><path d="M3 9h18M9 4v16" stroke="#3A1B6E" stroke-width="1.2"/></svg>
        COMMERCIAL OFFER
      </div>
      <table class="offer">
        <tr><th style="width:6%;">Sr. No.</th><th style="width:32%;">Description</th><th style="width:18%;">PSD Requirement</th><th style="width:12%;">Unit</th><th style="width:14%;">Rate (₹)</th><th style="width:12%;">Remarks</th></tr>
        ${mainCharges.length > 0 ? mainCharges.map((c, i) => \`
        <tr><td>\${i + 1}</td><td class="desc">\${escHtml(c.description)}</td><td>\${c.psdRequirement ? escHtml(c.psdRequirement) : '&mdash;'}</td><td>\${extractUnit(c.rate)}</td><td>\${extractRate(c.rate)}</td><td>&mdash;</td></tr>
        \`).join('') : \`
        <tr><td>1</td><td class="desc">Minimum Cleaning Charges for every single process</td><td>—</td><td>Per Process</td><td>3,500.00</td><td>—</td></tr>
        <tr><td>2</td><td class="desc">Processing of your product (By our Dry Method)</td><td>d(0.9) &lt; 10 Micron</td><td>Per Kg</td><td>70.00</td><td>—</td></tr>
        <tr><td>3</td><td class="desc">Malvern Particle Sizing Report (Dry Method)</td><td>—</td><td>Each</td><td>1,350.00</td><td>—</td></tr>
        <tr><td>4</td><td class="desc">Filter Bag Charges (One time for one product)</td><td>—</td><td>—</td><td class="nil">NIL</td><td>—</td></tr>
        \`}
      </table>
    </div>
    <div class="table-col opt">
      <div class="table-hd green">
        <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M12 8v4l3 2" stroke="#fff" stroke-width="1.6" fill="none"/></svg>
        OPTIONAL SERVICES
      </div>
      <table class="offer">
        <tr><th style="width:10%;">Sr. No.</th><th style="width:62%;">Description</th><th style="width:28%;">Rate (₹)</th></tr>
        ${optionalCharges.length > 0 ? optionalCharges.map((c, i) => \`
        <tr><td>\${i + 1}</td><td class="desc">\${escHtml(c.description)}</td><td>\${extractRate(c.rate)} / \${extractUnit(c.rate)}</td></tr>
        \`).join('') : \`
        <tr><td>1</td><td class="desc">Malvern Particle Sizing Report (Wet Method)</td><td>1,500.00 / Each</td></tr>
        <tr><td>2</td><td class="desc">Sieving Charges (If Applicable)</td><td>5.00 / Kg</td></tr>
        <tr><td>3</td><td class="desc">HDPE Drum 60 LTR (If Required)</td><td>550.00 / No</td></tr>
        <tr><td>4</td><td class="desc">Liner (If Required)</td><td>35.00 / No</td></tr>
        \`}
      </table>
    </div>
  </div>

  <!-- ICON ROW -->
  <div class="icon-row">
    <div class="icon-item">
      <div class="icon-circle" style="background:#7F509E;">
        <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="#fff"/><path d="M9 12l2 2 4-4" stroke="#7F509E" stroke-width="1.8" fill="none"/></svg>
      </div>
      cGMP<br>COMPLIANT<br>FACILITY
    </div>
    <div class="icon-item">
      <div class="icon-circle" style="background:#3B9FC4;">
        <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M19.4 13a7.4 7.4 0 000-2l2-1.6-2-3.4-2.4.8a7.6 7.6 0 00-1.8-1l-.4-2.5h-4l-.4 2.5a7.6 7.6 0 00-1.8 1l-2.4-.8-2 3.4L6.2 11a7.4 7.4 0 000 2l-2 1.6 2 3.4 2.4-.8a7.6 7.6 0 001.8 1l.4 2.5h4l.4-2.5a7.6 7.6 0 001.8-1l2.4.8 2-3.4z" fill="none" stroke="#fff" stroke-width="1.3"/></svg>
      </div>
      CONTRACT<br>MICRONIZATION<br>EXPERTS
    </div>
    <div class="icon-item">
      <div class="icon-circle" style="background:#4CAF6B;">
        <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="1.6" fill="#fff"/></svg>
      </div>
      PARTICLE SIZE<br>ANALYSIS &amp;<br>DEVELOPMENT
    </div>
    <div class="icon-item">
      <div class="icon-circle" style="background:#E8A33D;">
        <svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 8l9-5 9 5-9 5-9-5z" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M3 8v8l9 5 9-5V8" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M12 13v8" stroke="#fff" stroke-width="1.5"/></svg>
      </div>
      CLEAN ROOM<br>PROCESSING<br>AREA
    </div>
    <div class="icon-item">
      <div class="icon-circle" style="background:#D6467A;">
        <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M12 9v4l3 2" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M9 2h6M12 2v2" stroke="#fff" stroke-width="1.6"/></svg>
      </div>
      ON TIME<br>DELIVERY
    </div>
    <div class="icon-item">
      <div class="icon-circle" style="background:#5B8DC4;">
        <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="8" cy="9" r="3" fill="#fff"/><circle cx="16" cy="9" r="3" fill="#fff"/><path d="M2 19c0-3 3-5 6-5s6 2 6 5M10 19c0-3 3-5 6-5s6 2 6 5" fill="none" stroke="#fff" stroke-width="1.4"/></svg>
      </div>
      DEDICATED<br>TECHNICAL<br>SUPPORT
    </div>
  </div>

  <!-- THANKING / NOTE / QR -->
  <div class="closing-row">
    <div class="thank-box">
      Thanking You,<br>
      <b>For ${escHtml(profile.companyName || 'UMA MICRON')}</b>
      <div class="sig-img">${escHtml(data.signatoryName || 'Amit Patel')}</div>
      <div style="margin-top:20px;">${escHtml(data.signatoryName || 'Amit Patel')}</div>
    </div>
    <div class="note-box">
      <b>Note:</b>
      <ul>
        ${savedNotes.length > 0 ? savedNotes.map(line => \`<li>\${escHtml(line)}</li>\`).join('') : \`
        <li>All above rates are in Indian Rupees (₹).</li>
        <li>GST will be charged extra as applicable.</li>
        <li>This is a quotation and not an invoice.</li>
        <li>Please send your Purchase Order along with material &amp; specification.</li>
        \`}
      </ul>
    </div>
    <div class="qr-box">
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANgAAADYAQAAAAChWxBAAAABKUlEQVR4nN2YwY6EMAxD/RD//8ueQ9KWHWkuZdBkU6SKxhdbIXEK1sd1fIb+Daahz47dK1KJ5y52pkIkI2E0I5V43tAnJEvIwsgzUonnV7AhrwKXBzAceazA5VvYqdVihKP+MlKJ5/3+eXkyUonnfv4uBYdlluRKPG/kL+Q4U2ePc5P8SZIsPDxCxhIuxXMXI1QxXT6X6VF/R04ulgA5G427+PsoOoU0XbYW+WMU2zhG/eEm9bc8z2/hHvk7pPQ87DSHLMJyPHcxbOILjQ6Dwimq8dzBWMNn9FHGXakWz/vzp51tdMygLepv3d+5OgSmFs8789kcqZm7adJfzj+nlGlQm/lsLstivHTyh3Q9YtCGtIlyPHewc14aEJo/B8UPuDzrf7/n8gT2AtGFlmveOxz6AAAAAElFTkSuQmCC" alt="QR code"/>
      <div>SCAN TO<br>VISIT OUR<br>WEBSITE</div>
    </div>
  </div>

  <div class="terms-hd">
    <svg width="16" height="16" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="#fff"/><path d="M7 8h10M7 12h10M7 16h6" stroke="#3A1B6E" stroke-width="1.4"/></svg>
    TERMS &amp; CONDITIONS
  </div>

  <div class="terms-cards">
    <div class="tcard">
      <svg class="ticon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#6C4FA1" stroke-width="1.6"/><path d="M7 8h10M7 12h6" stroke="#6C4FA1" stroke-width="1.4"/></svg>
      <div class="ttitle" style="color:#6C4FA1;">TAXES</div>
      GST will be charged extra as applicable.
    </div>
    <div class="tcard">
      <svg class="ticon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4" fill="none" stroke="#3B9FC4" stroke-width="1.6"/><path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5" fill="none" stroke="#3B9FC4" stroke-width="1.6"/></svg>
      <div class="ttitle" style="color:#3B9FC4;">PROCESS LOSS</div>
      Loss occurs during processing is on your account.
    </div>
    <div class="tcard">
      <svg class="ticon" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0113-6" fill="none" stroke="#4CAF6B" stroke-width="1.6"/><path d="M20 12a8 8 0 01-13 6" fill="none" stroke="#4CAF6B" stroke-width="1.6"/><polygon points="17,4 17,8 13,8" fill="#4CAF6B"/><polygon points="7,20 7,16 11,16" fill="#4CAF6B"/></svg>
      <div class="ttitle" style="color:#4CAF6B;">BATCH / CHANGE OVER</div>
      If same material is required to be micronized in separate batch(es) or different PSD specification, Change Over Charge @ ₹ 500/- per batch or per specification will be applicable.
    </div>
    <div class="tcard">
      <svg class="ticon" viewBox="0 0 24 24"><rect x="2" y="9" width="14" height="8" rx="1" fill="none" stroke="#E8A33D" stroke-width="1.6"/><path d="M16 11h4l2 3v3h-6z" fill="none" stroke="#E8A33D" stroke-width="1.6"/><circle cx="7" cy="19" r="1.6" fill="#E8A33D"/><circle cx="18" cy="19" r="1.6" fill="#E8A33D"/></svg>
      <div class="ttitle" style="color:#E8A33D;">OTHER CHARGES</div>
      This is only processing charges. All other charges like Transportation, Insurance, Repacking material charges will be extra.
    </div>
    <div class="tcard">
      <svg class="ticon" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="#D6467A" stroke-width="1.6"/><path d="M2 9h20" stroke="#D6467A" stroke-width="1.6"/><path d="M6 14h4" stroke="#D6467A" stroke-width="1.6"/></svg>
      <div class="ttitle" style="color:#D6467A;">PAYMENT TERMS</div>
      100% Advance against Performa Invoice.
    </div>
    <div class="tcard">
      <svg class="ticon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" fill="none" stroke="#5B8DC4" stroke-width="1.6"/><path d="M3 9h18M7 2v4M17 2v4" stroke="#5B8DC4" stroke-width="1.6"/></svg>
      <div class="ttitle" style="color:#5B8DC4;">VALIDITY</div>
      This quotation is valid up to ${validityDate || '10/08/2026'}.
    </div>
  </div>

  <div class="notes-resp-row">
    <div class="notes-box">
      <div class="nrhd">
        <svg width="15" height="15" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="#3A1B6E" stroke-width="1.5"/><path d="M8 7h8M8 11h8M8 15h5" stroke="#3A1B6E" stroke-width="1.3"/></svg>
        IMPORTANT NOTES
      </div>
      <ol>
        <li>Please send Purchase Order and specification letter regarding particle size requirement, material dispatch destination with preferred transporter / courier along with material.</li>
        <li>Please send extra drums and other repacking materials considering increase of volume after micronization &amp; micronized materials to be repacked in fresh bags.</li>
        <li>Material must be Non-Hazardous, uniform, dry and free flow powder form. Declaration form regarding material's non hazardous property is mandatory.</li>
      </ol>
    </div>
    <div class="resp-box">
      <div class="nrhd">
        <svg width="15" height="15" viewBox="0 0 24 24"><circle cx="9" cy="7" r="3" fill="none" stroke="#3A1B6E" stroke-width="1.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="#3A1B6E" stroke-width="1.4"/><circle cx="18" cy="8" r="2.4" fill="none" stroke="#3A1B6E" stroke-width="1.4"/><path d="M14.5 20c.3-2.6 2.2-4.6 4.7-4.9" fill="none" stroke="#3A1B6E" stroke-width="1.4"/></svg>
        CUSTOMER RESPONSIBILITIES
      </div>
      <ol>
        <li>Material must be non-hazardous and free from any contamination.</li>
        <li>Material specification and desired PSD must be clearly mentioned.</li>
        <li>All documents &amp; regulatory forms to be provided along with material.</li>
        <li>Repacking material to be provided if customer does not opt for our material.</li>
      </ol>
    </div>
  </div>

  <div class="sign-block2">
    <div class="stamp">UMA MICRON<br>VADODARA</div>
    <div class="for-uma">
      <b>For ${escHtml(profile.companyName || 'UMA MICRON')}</b>
      <div class="sig-img">${escHtml(data.signatoryName || 'Amit Patel')}</div>
      ${escHtml(data.signatoryName || 'Amit Patel')}<br>Authorised Signatory
    </div>
  </div>

  <div class="footer-bar">
    <span class="thankyou">Thank you for your business!</span>
    <span class="item">
      <svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="#fff"/></svg>
      Quality You Can Trust
    </span>
    <span class="item">
      <svg width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M12 8v4l3 2" stroke="#fff" stroke-width="1.5" fill="none"/></svg>
      Performance You Can Rely On
    </span>
  </div>

</div>

</body>
</html>`;
};

export const renderQuotationPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildQuotationHtml(data, data.companyProfile);
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'QTN',
    docNo: data.quotationNo || 'N/A',
    width: PRINT_PAGE_W,
    fitPage: true
  });
};
