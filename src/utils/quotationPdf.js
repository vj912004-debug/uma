import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  PRINT_PAGE_W,
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

const ic = {
  pin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.5 0 1 .4 1 1V20c0 .5-.5 1-1 1C10.9 21 3 13.1 3 3.4c0-.5.5-1 1-1h3.5c.5 0 1 .5 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
  web: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.8a15.6 15.6 0 0 0-1.4-3.5A8.03 8.03 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8C10.5 6.5 11.2 5.2 12 4zM4.3 14a8.1 8.1 0 0 1 0-4h3.2a17 17 0 0 0 0 4H4.3zM5.1 16h2.8c.3 1.3.8 2.5 1.4 3.5A8.03 8.03 0 0 1 5.1 16zM8 8H5.1a8.03 8.03 0 0 1 4.2-3.5C8.8 5.5 8.3 6.7 8 8zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.5-6h-5a15 15 0 0 1 0-4h5a15 15 0 0 1 0 4zm.5 5.5c.6-1 1.1-2.2 1.4-3.5h2.8a8.03 8.03 0 0 1-4.2 3.5zM16 8c-.3-1.3-.8-2.5-1.4-3.5A8.03 8.03 0 0 1 18.9 8H16zM19.7 14h-3.2a17 17 0 0 0 0-4h3.2a8.1 8.1 0 0 1 0 4z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-12 2-12 6v2h24v-2c0-4-8-6-12-6z"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L18.5 9H15zM8 13h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-3.8-3.8 1.4-1.4 2.4 2.4 5-5 1.4 1.4-6.4 6.4z"/></svg>`,
  molecule: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="7" r="2.8"/><circle cx="17" cy="7" r="2.8"/><circle cx="12" cy="17" r="2.8"/><path d="M9.1 8.5 10.9 15M14.9 8.5 13.1 15" stroke="#fff" stroke-width="1.4" fill="none"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 20h3V10H4v10zm6 0h3V4h-3v16zm6 0h3v-7h-3v7z"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.1 12.9a7.2 7.2 0 0 0 .1-.9 7.2 7.2 0 0 0-.1-.9l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.4 7.4 0 0 0-1.6-.9l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5c-.6.2-1.1.5-1.6.9l-2.4-1a.5.5 0 0 0-.6.2L2.7 8.9a.5.5 0 0 0 .1.6l2 1.6a7.2 7.2 0 0 0-.1.9 7.2 7.2 0 0 0 .1.9l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1c.5.4 1 .7 1.6.9l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5c.6-.2 1.1-.5 1.6-.9l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6l-2-1.6zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm-1.1 14.3-3.6-3.6 1.4-1.4 2.2 2.2 4.6-4.6 1.4 1.4-6 6z"/></svg>`,
  warehouse: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 9v2h2v9h6v-6h4v6h6v-9h2V9L12 3z"/></svg>`,
  rupee: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.5 20v-2H7v-2h5.2c1.7 0 3.1-.4 4-1.2.9-.8 1.3-1.9 1.3-3.3 0-1.1-.3-2-1-2.7-.6-.7-1.5-1.1-2.6-1.3H18V6h-5.5V4H10v2H7v2h3c1.2 0 2.1.2 2.7.7.6.5.9 1.2.9 2.1s-.3 1.6-.9 2.1c-.6.5-1.5.7-2.7.7H7v2h3.5V20h2z"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 8 11zm8 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zM8 13c-.3 0-.7 0-1 .1C4.4 13.6 2 14.8 2 17v2h4v-2c0-1.3.7-2.4 2-3.2-.3-.1-.7-.2-1-.2z"/></svg>`,
  note: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-1 4H9V4h6v2zm-5.2 5.3 1.4 1.4 3.3-3.3 1.4 1.4-4.7 4.7-2.8-2.8 1.4-1.4z"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h12v2H7V5zm0 6h12v2H7v-2zm0 6h12v2H7v-2zM4 5.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm0 6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm0 6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z"/></svg>`
};

export const buildQuotationHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const mainCharges = data.mainCharges || [];
  const optionalCharges = data.optionalCharges || [];
  const companyName = escHtml(profile.companyName || 'UMA MICRON');
  const qtnNo = escHtml(data.quotationNo || 'N/A');
  const qtnDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const validityDate = escHtml(formatPdfDateDmy(data.validityDate) || '');
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
          <td class="tl">${escHtml(c.description)}</td>
          <td>${c.psdRequirement ? escHtml(c.psdRequirement) : '—'}</td>
          <td>${extractUnit(c.rate)}</td>
          <td>${extractRate(c.rate)}</td>
          <td>—</td>
        </tr>`
          )
          .join('')
      : `
        <tr><td>1</td><td class="tl">Minimum cleaning charges for every single process</td><td>–</td><td>Per Process</td><td>3,500.00</td><td>Mandatory</td></tr>
        <tr><td>2</td><td class="tl">Processing of your product – Fenofibrate (By our Dry Method)</td><td>d(0.9) &lt; 10 Micron</td><td>Per Kg</td><td>70.00</td><td>Dry Method</td></tr>
        <tr><td>3</td><td class="tl">Malvern particle sizing report (Dry Method)</td><td>–</td><td>Per Report</td><td>1,350.00</td><td>Per Each</td></tr>
        <tr><td>4</td><td class="tl">Filter bag charges (One time for one product)</td><td>–</td><td>Lump Sum</td><td>Nil</td><td>One time</td></tr>`;

  const optionalRows =
    optionalCharges.length > 0
      ? optionalCharges
          .map(
            (c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="tl">${escHtml(c.description)}</td>
            <td>${extractUnit(c.rate)}</td>
            <td>${extractRate(c.rate)}</td>
          </tr>`
          )
          .join('')
      : `
          <tr><td>1</td><td class="tl">Malvern particle sizing report (Wet Method)</td><td>Per Report</td><td>1,500.00</td></tr>
          <tr><td>2</td><td class="tl">Sieving Charges (If applicable)</td><td>Per Kg</td><td>5.00</td></tr>
          <tr><td>3</td><td class="tl">HDPE Drum 60 LTR (If Required)</td><td>Per No.</td><td>550.00</td></tr>
          <tr><td>4</td><td class="tl">Liner (If Required)</td><td>Per No.</td><td>35.00</td></tr>`;

  /* Fixed design text only — do not append placeholder form notes like "1) ABC" */
  const noteItems = [
    'Prices mentioned are exclusive of GST.',
    'GST will be charged extra as applicable.',
    'Transportation, Insurance & Packing Charges will be extra.',
    'Rates are subject to change without prior notice.'
  ];

  const importantNotes = [
    'If properties of material change then rate will be change and PSD will change then rate will be change.',
    'Any changes in taxes will be applicable as per actual.',
    'Disputes are subject to Vadodara Jurisdiction only.'
  ];

  /*
   * Exact same visual design as the 2-page reference (fonts, spacing, tabs, icons).
   * Page-2 terms are appended under page-1 content on ONE .pdf-page.
   * renderHtmlToPdf(fitPage:true) uniformly scales the whole sheet to one A4.
   */
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Quotation - ${companyName}</title>
<style>
  :root{
    --navy:#2f2263;
    --lavender:#E8E4F3;
    --border:#C9BEE0;
    --green:#22874F;
    --text:#2b2b2b;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#e9e9ec;font-family:Arial,Helvetica,sans-serif;color:var(--text)}
  .sheet{
    width:210mm;
    margin:10px auto;background:#fff;border:1px solid #b8b8b8;
    display:flex;flex-direction:column;overflow:visible;
  }
  @media print{
    body{background:#fff}
    .sheet{margin:0;border:none}
    @page{size:A4;margin:0}
  }
  .ico{width:12px;height:12px;display:inline-flex;color:var(--navy);flex-shrink:0}
  .ico svg{width:100%;height:100%}
  .ico.w{color:#fff}
  .ico.sm{width:10px;height:10px}

  .hdr{display:flex;height:78px;flex-shrink:0}
  .hdr-l{flex:1;display:flex;align-items:center;gap:14px;padding:8px 22px}
  .logo{width:60px;height:60px;flex-shrink:0}
  .logo img,.logo svg{width:100%;height:100%;object-fit:contain}
  .brand{font:800 32px/1 Georgia,'Times New Roman',serif;color:var(--navy);letter-spacing:.5px}
  .tag{font:700 13px/1.15 Arial;color:var(--green);margin-top:5px}
  .hdr-r{
    width:290px;background:linear-gradient(135deg,#3d2b7d,#2f2263);
    clip-path:polygon(36px 0,100% 0,100% 100%,0 100%);
    color:#fff;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;
    padding:8px 30px 8px 54px;
  }
  .hdr-r .t1{font:800 30px/1 Arial;letter-spacing:2px}
  .hdr-r .t2{font:600 11px/1 Arial;letter-spacing:3px;margin-top:3px;color:#efeaf7}

  .cbar{
    display:flex;align-items:flex-start;gap:20px;
    padding:7px 24px;font-size:10.2px;line-height:1.35;color:#444;
    border-bottom:1px solid var(--border);flex-shrink:0;background:#fff;
  }
  .citem{display:flex;gap:7px;align-items:flex-start}
  .citem.addr{max-width:310px;flex:1.2}
  .citem .ico{margin-top:1px;color:#6C4FA1}

  .top{display:flex;gap:18px;padding:10px 24px 0;flex-shrink:0}
  .prep{width:265px;flex-shrink:0}
  .prep-tag{
    background:var(--navy);color:#fff;font:700 11.5px/1 Arial;
    padding:6px 14px;display:inline-flex;align-items:center;gap:7px;
    clip-path:polygon(0 0,100% 0,95% 100%,0 100%);
  }
  .prep-body{
    border:1px solid var(--border);border-top:none;
    padding:8px 12px;font-size:10.5px;line-height:1.4;color:#444;
  }
  .prep-body .name{font:800 13px/1.25 Arial;color:#1f1f1f;margin-bottom:4px}
  .prep-body .addr-row{display:flex;gap:6px;align-items:flex-start}
  .meta{
    flex:1;border:1.5px solid #6C4FA1;border-radius:3px;
    padding:8px 16px;font-size:11px;
  }
  .mrow{display:flex;align-items:center;gap:8px;padding:2.5px 0}
  .mlab{width:112px;font-weight:600;color:#333}
  .mcol{width:10px}
  .mval{font-weight:700;color:#222}

  .letter{padding:10px 24px 0;flex-shrink:0}
  .subj{font:800 11.5px/1.3 Arial;color:#222;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid var(--navy)}
  .body{font-size:10.5px;line-height:1.42;color:#333;text-align:justify}
  .body p{margin-bottom:5px}
  .caps{font-weight:700}

  .main{display:flex;gap:16px;padding:8px 24px 0;flex-shrink:0}
  .side{width:155px;flex-shrink:0}
  .side-h{
    background:var(--navy);color:#fff;font:700 11px/1 Arial;
    padding:7px 10px;clip-path:polygon(0 0,100% 0,91% 100%,0 100%);
  }
  .side-list{border:1px solid var(--border);border-top:none;background:var(--lavender);padding:4px 8px}
  .side-item{
    display:flex;align-items:center;gap:8px;padding:6px 0;
    font:700 10px/1.15 Arial;color:#2a2a2a;border-bottom:1px dashed #c9bce8;
  }
  .side-item:last-child{border-bottom:none}
  .side-ico{
    width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  }
  .side-ico svg{width:13px;height:13px}

  .tables{flex:1;min-width:0}
  .sec{
    background:var(--navy);color:#fff;font:700 11px/1 Arial;
    padding:7px 12px;display:flex;align-items:center;gap:7px;
    clip-path:polygon(0 0,100% 0,98.5% 100%,0 100%);
  }
  table.t{width:100%;border-collapse:collapse;font-size:10px}
  table.t th{
    background:var(--lavender);color:var(--navy);font-weight:700;
    padding:5px 6px;border:1px solid var(--border);text-align:center;
  }
  table.t td{
    padding:5px 6px;border:1px solid var(--border);text-align:center;
    vertical-align:middle;color:#333;
  }
  table.t td.tl{text-align:left}
  table.t tr:nth-child(even) td{background:#f7f4fb}

  .row2{display:flex;gap:14px;margin-top:8px;align-items:stretch}
  .opt{flex:1.35;min-width:0}
  .note{flex:1;min-width:140px}
  .note-box{
    border:1.5px dashed #B8A8D4;border-radius:8px;
    padding:10px 12px;height:100%;min-height:110px;background:#fff;
  }
  .note-h{
    display:flex;align-items:center;gap:6px;
    font:800 12px/1 Arial;color:var(--navy);margin-bottom:6px;letter-spacing:.3px;
  }
  .note-h .ico{width:14px;height:14px;color:var(--navy)}
  .note-box ul{list-style:none;margin:0;padding:0}
  .note-box li{
    font-size:9.8px;line-height:1.35;padding-left:12px;position:relative;
    color:#111;margin-bottom:3px;
  }
  .note-box li::before{content:"•";position:absolute;left:0;color:#111;font-weight:900}

  .terms{padding:16px 24px 0;flex-shrink:0}
  .p2-top{display:flex;gap:14px;align-items:stretch}
  .p2-left{flex:1.05;display:flex;flex-direction:column;gap:12px;min-width:0}
  .p2-mid{flex:1;min-width:0}
  .tbox{
    border:1.5px solid var(--border);border-radius:4px;background:#fff;
    position:relative;padding:26px 12px 10px;overflow:visible;
  }
  .tbox.solid{border-color:var(--navy)}
  .tbox.fill{display:flex;flex-direction:column;min-height:140px}
  .ttab{
    position:absolute;top:-1px;left:-1px;
    background:var(--navy);color:#fff;font:700 11px/1 Arial;
    padding:7px 14px 7px 10px;display:inline-flex;align-items:center;gap:6px;
    clip-path:polygon(0 0,100% 0,93% 100%,0 100%);
  }
  .ttab.light{
    background:var(--lavender);color:var(--navy);
    border:1px solid var(--border);border-bottom:none;
  }
  .tbox ul,.tbox ol{margin:4px 0 0;padding-left:18px}
  .tbox li{font-size:10.5px;line-height:1.4;color:#333;margin-bottom:5px}
  .p2-bot{display:flex;gap:14px;margin-top:12px;align-items:stretch}
  .p2-bot .tbox{flex:1;min-height:110px}
  .imp-box{
    flex:1;min-width:0;min-height:110px;
    border:1.5px solid #D0C8E0;border-radius:8px;background:#fff;
    padding:12px 14px;
  }
  .imp-h{
    display:flex;align-items:center;gap:7px;
    font:800 12px/1 Arial;color:var(--navy);margin-bottom:8px;letter-spacing:.3px;
  }
  .imp-h .ico{width:15px;height:15px;color:var(--navy)}
  .imp-box ul{list-style:none;margin:0;padding:0}
  .imp-box li{
    font-size:10.5px;line-height:1.4;padding-left:14px;position:relative;
    color:#111;margin-bottom:5px;
  }
  .imp-box li::before{content:"•";position:absolute;left:0;color:#111;font-weight:900}
  .decl{font-size:10.5px;line-height:1.4;color:#333;margin-top:4px}
  .decl-line{
    margin-top:28px;border-top:1px solid #999;width:65%;
    text-align:center;padding-top:4px;font-size:10px;color:#555;
    margin-left:auto;margin-right:auto;
  }

  .close{
    display:flex;justify-content:space-between;align-items:flex-end;
    padding:14px 24px 10px;flex-shrink:0;gap:12px;
  }
  .stamp{width:64px;height:64px;flex-shrink:0}
  .thanks{font-size:10.5px;line-height:1.35;color:#333;flex:1;max-width:360px}
  .sig{text-align:center;font-size:10.5px;flex-shrink:0}
  .sig .for{font-weight:700;color:var(--navy);margin-bottom:3px}
  .sig .nm{font-weight:800;margin-top:3px;font-size:12px;color:var(--navy)}
  .sig .role{font-size:9.5px;color:#555}

  .foot{
    background:var(--navy);color:#fff;font-size:10px;padding:6px 24px;
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
  }
  .foot-l{display:flex;gap:22px;align-items:center}
  .foot-l span{display:flex;align-items:center;gap:6px}
  .foot-r{display:flex;gap:16px;align-items:center}
</style>
</head>
<body>
<div class="sheet pdf-page print-host">

  <div class="hdr">
    <div class="hdr-l">
      <div class="logo">${buildPrintLogoHtml(profile)}</div>
      <div>
        <div class="brand">${companyName}</div>
        <div class="tag">${escHtml(profile.tagline || "Micronization of API's")}</div>
      </div>
    </div>
    <div class="hdr-r">
      <div class="t1">QUOTATION</div>
      <div class="t2">COMMERCIAL OFFER</div>
    </div>
  </div>

  <div class="cbar">
    <div class="citem addr"><span class="ico">${ic.pin}</span><span>${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli, N.H. No. 8, Vadodara – 391350, Gujarat, India')}</span></div>
    <div class="citem"><span class="ico">${ic.phone}</span><span>${escHtml(profile.phone || '+91 97120 00297')}</span></div>
    <div class="citem"><span class="ico">${ic.web}</span><span>${escHtml(profile.website || 'www.umamicron.com')}</span></div>
    <div class="citem"><span class="ico">${ic.mail}</span><span>${escHtml(profile.email || 'info@umamicron.com')}</span></div>
  </div>

  <div class="top">
    <div class="prep">
      <div class="prep-tag"><span class="ico w">${ic.user}</span> PREPARED FOR</div>
      <div class="prep-body">
        <div class="name">${escHtml(data.partyName)}</div>
        <div class="addr-row"><span class="ico sm">${ic.pin}</span><span>${splitAddress(data.partyAddress)}</span></div>
      </div>
    </div>
    <div class="meta">
      <div class="mrow"><span class="ico">${ic.doc}</span><span class="mlab">Quotation No.</span><span class="mcol">:</span><span class="mval">${qtnNo}</span></div>
      <div class="mrow"><span class="ico">${ic.cal}</span><span class="mlab">Quotation Date</span><span class="mcol">:</span><span class="mval">${qtnDate}</span></div>
      <div class="mrow"><span class="ico">${ic.cal}</span><span class="mlab">Validity</span><span class="mcol">:</span><span class="mval">${validityDate}</span></div>
      <div class="mrow"><span class="ico">${ic.user}</span><span class="mlab">Prepared By</span><span class="mcol">:</span><span class="mval">${escHtml(data.signatoryName || 'Amit Patel')}</span></div>
      <div class="mrow"><span class="ico">${ic.phone}</span><span class="mlab">Contact No.</span><span class="mcol">:</span><span class="mval">${escHtml(profile.phone || '+91 97120 00297')}</span></div>
      <div class="mrow"><span class="ico">${ic.mail}</span><span class="mlab">Email ID</span><span class="mcol">:</span><span class="mval">${escHtml(profile.email || 'info@umamicron.com')}</span></div>
    </div>
  </div>

  <div class="letter">
    <div class="subj">SUBJECT: ${escHtml(data.subject || 'Quotation for Micronization Services')}</div>
    <div class="body">
      <p><b>Dear Sir / Madam,</b></p>
      <p>With reference to the above mentioned subject, please find our offer along with relevant terms and conditions for your ready reference.</p>
      <p>${escHtml(profile.companyName || 'Uma Micron')}, Vadodara is a Gujarat based company that offers <span class="caps">CONTRACT MICRONIZATION SERVICES</span> dedicated to comply the needs of the pharmaceutical industry. The facility is at Ranoli – Vadodara, operates according to cGMP standards with more than 500 sq.ft processing area and big warehouse facility.</p>
      <p><b>Micronization:</b> Jet micronization is used to mill particles below 10-20 microns. Particle to particle impact facilitated by air flow allows for producing particles less than 10-20 microns in size. We trust our offer will be in line with your requirement and if you have any techno-commercial queries, please feel free to contact us.${descriptionHtml ? ` ${descriptionHtml}` : ''}</p>
    </div>
  </div>

  <div class="main">
    <div class="side">
      <div class="side-h">WHY ${companyName}?</div>
      <div class="side-list">
        <div class="side-item"><div class="side-ico">${ic.check}</div><span>cGMP Compliant Facility</span></div>
        <div class="side-item"><div class="side-ico">${ic.molecule}</div><span>Contract Micronization</span></div>
        <div class="side-item"><div class="side-ico">${ic.chart}</div><span>PSD Development</span></div>
        <div class="side-item"><div class="side-ico">${ic.gear}</div><span>Jet Milling Technology</span></div>
        <div class="side-item"><div class="side-ico">${ic.shield}</div><span>Quality Assurance</span></div>
        <div class="side-item"><div class="side-ico">${ic.warehouse}</div><span>Spacious Warehouse</span></div>
      </div>
    </div>
    <div class="tables">
      <div class="sec"><span class="ico w">${ic.doc}</span> COMMERCIAL OFFER – MICRONIZATION CHARGES</div>
      <table class="t">
        <tr>
          <th style="width:8%">Sr. No.</th>
          <th style="width:33%">Description</th>
          <th style="width:20%">PSD Requirement</th>
          <th style="width:12%">Unit</th>
          <th style="width:12%">Rate (₹)</th>
          <th style="width:15%">Remarks</th>
        </tr>
        ${mainRows}
      </table>
      <div class="row2">
        <div class="opt">
          <div class="sec"><span class="ico w">${ic.gear}</span> OPTIONAL SERVICES (IF REQUIRED)</div>
          <table class="t">
            <tr>
              <th style="width:10%">Sr. No.</th>
              <th style="width:54%">Description</th>
              <th style="width:18%">Unit</th>
              <th style="width:18%">Rate (₹)</th>
            </tr>
            ${optionalRows}
          </table>
        </div>
        <div class="note">
          <div class="note-box">
            <div class="note-h"><span class="ico">${ic.note}</span> NOTE</div>
            <ul>${noteItems.map((n) => `<li>${escHtml(n)}</li>`).join('')}</ul>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="terms">
    <div class="p2-top">
      <div class="p2-left">
        <div class="tbox solid">
          <div class="ttab"><span class="ico w">${ic.doc}</span> TERMS &amp; CONDITIONS</div>
          <ul>
            <li>This is only processing charges, all other charges like Transportation, Insurance, Repacking material charges will be extra.</li>
            <li>GST will be charged extra as applicable.</li>
          </ul>
        </div>
        <div class="tbox">
          <div class="ttab light"><span class="ico">${ic.rupee}</span> PAYMENT TERMS</div>
          <ul>
            <li>100% Advance against Proforma Invoice.</li>
            <li>No process will be started without advance payment.</li>
          </ul>
        </div>
        <div class="tbox">
          <div class="ttab light"><span class="ico">${ic.cal}</span> VALIDITY</div>
          <ul>
            <li>This quotation is valid till ${validityDate || 'N/A'}.</li>
          </ul>
        </div>
      </div>
      <div class="tbox fill p2-mid">
        <div class="ttab light"><span class="ico">${ic.gear}</span> MATERIAL &amp; PROCESS CONDITIONS</div>
        <ul>
          <li>Loss occurs during processing is on your account.</li>
          <li>Same materials requirement of micronization separately batch wise of different specification of same materials then change over charge @ Rs. 500/- batch or per specification will be applicable.</li>
          <li>Material must be non-hazardous, uniform, dry and free flow powder form.</li>
        </ul>
      </div>
      <div class="tbox fill p2-mid">
        <div class="ttab light"><span class="ico">${ic.people}</span> CUSTOMER RESPONSIBILITIES</div>
        <ol>
          <li>Please send Purchase Order and specification letter regarding particle size requirement, material dispatch destination with preferred transporter / courier along with material.</li>
          <li>Please send extra drums and other repacking materials considering increase of volume after micronization &amp; micronized materials to be repacked in fresh bags.</li>
          <li>Declaration of non-hazardous property of material is mandatory.</li>
        </ol>
      </div>
    </div>
    <div class="p2-bot">
      <div class="imp-box">
        <div class="imp-h"><span class="ico">${ic.list}</span> IMPORTANT NOTES</div>
        <ul>
          ${importantNotes.map((n) => `<li>${escHtml(n)}</li>`).join('')}
        </ul>
      </div>
      <div class="tbox">
        <div class="ttab light"><span class="ico">${ic.shield}</span> DECLARATION</div>
        <div class="decl">We hereby declare that the above quotation is true and correct to the best of our knowledge.</div>
        <div class="decl-line">Authorised Signatory</div>
      </div>
    </div>
  </div>

  <div class="close">
    <svg class="stamp" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#6C4FA1" stroke-width="1.6"/>
      <circle cx="50" cy="50" r="39" fill="none" stroke="#6C4FA1" stroke-width="1"/>
      <path id="ct" d="M 15 50 A 35 35 0 0 1 85 50" fill="none"/>
      <path id="cb" d="M 20 60 A 30 30 0 0 0 80 60" fill="none"/>
      <text font-size="9" fill="#6C4FA1" font-weight="700"><textPath href="#ct" startOffset="10%">${companyName}</textPath></text>
      <text font-size="8" fill="#6C4FA1" font-weight="700"><textPath href="#cb" startOffset="28%">VADODARA</textPath></text>
    </svg>
    <div class="thanks">Thank you for considering ${companyName} for your micronization requirements. We look forward to a long term business association.</div>
    <div class="sig">
      <div class="for">For ${companyName}</div>
      <svg width="70" height="22" viewBox="0 0 70 26"><path d="M2 20 Q 10 4, 18 16 T 34 14 Q 40 8, 46 18 T 62 10" stroke="#2f2263" stroke-width="1.4" fill="none"/></svg>
      <div class="nm">${escHtml(data.signatoryName || 'Amit Patel')}</div>
      <div class="role">Authorised Signatory</div>
    </div>
  </div>

  <div class="foot">
    <div class="foot-l">
      <span><span class="ico w">${ic.phone}</span> ${escHtml(profile.phone || '+91 97120 00297')}</span>
      <span><span class="ico w">${ic.mail}</span> ${escHtml(profile.email || 'info@umamicron.com')}</span>
      <span><span class="ico w">${ic.web}</span> ${escHtml(profile.website || 'www.umamicron.com')}</span>
    </div>
    <div class="foot-r">
      <span style="font-style:italic">Thank you for your business!</span>
      <span>E. &amp; O.E.</span>
      <span style="font-weight:700">Page 1 of 1</span>
    </div>
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
