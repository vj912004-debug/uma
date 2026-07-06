import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { mergeCompanyProfile } from './companyProfile';
import {
  buildDcPrintLines,
  formatDcDateSlash,
  getDcAppData
} from './deliveryChallanLayout';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtQty = (n) => {
  const v = parseFloat(n);
  if (!v) return '0.00';
  return v.toFixed(2);
};

const DEFAULT_DC_LOGO_HTML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="72" height="72" aria-label="UMA MICRON Logo">
  <ellipse cx="30" cy="44" rx="22" ry="26" fill="none" stroke="#009900" stroke-width="2"/>
  <ellipse cx="42" cy="44" rx="22" ry="26" fill="none" stroke="#cc0000" stroke-width="2"/>
  <text x="18" y="52" font-family="Arial Black, Arial, sans-serif" font-size="26" font-weight="700" fill="#cc0000">U</text>
  <text x="36" y="52" font-family="Arial Black, Arial, sans-serif" font-size="26" font-weight="700" fill="#009900">M</text>
</svg>`;

const formatDcCompanyAddress = (profile) => {
  const p = mergeCompanyProfile(profile);
  const cityLine = [p.city, p.pincode].filter(Boolean).join('-');
  const region = [cityLine, p.state, p.country].filter(Boolean).join(', ');
  const line1 = (p.addressLine1 || '').replace(/,\s*$/, '');
  const line2 = region || '';
  return [line1, line2].filter(Boolean);
};

const formatDcEmailLine = (profile) => {
  const p = mergeCompanyProfile(profile);
  return p.email ? `Email - ${p.email}` : '';
};

const buildAlignedCellHtml = (lines, field) => {
  if (!lines.length) return '&nbsp;';
  return lines.map((line) => {
    const val = line[field];
    const display = val === '' || val === null || val === undefined ? '' : esc(val);
    const cls = field === 'text' ? 'dc-line dc-desc' : (field === 'qty' ? 'dc-line dc-qty' : 'dc-line dc-drums');
    const content = field === 'text' ? esc(line.text) : display;
    return content ? `<div class="${cls}">${content}</div>` : '';
  }).join('');
};

const buildDcFooterRows = (data, profileGstin) => {
  const rows = [];
  const add = (label, value) => {
    if (value) rows.push({ label, value });
  };

  add('Vehicle No.', data.vehicleNo);
  add('Drivers name :', data.driverName);
  add('Driver\'s Contact no. :', data.driverContact || data.driverPhone);
  add('Transporter\'s Name :', data.transporterName || data.transporter);

  if (profileGstin) {
    rows.push({ label: 'GSTIN', value: profileGstin, isGstin: true });
  }

  return rows;
};

const buildDcMetaRows = (dcNo, dcDate, poNo, poDate) => {
  const rows = [
    { label: 'Delivery Challan No. :', value: dcNo },
    { label: 'Date :', value: dcDate }
  ];
  if (poNo || poDate) {
    rows.push({ label: 'PO /DC NO.', value: poNo });
    rows.push({ label: 'Date :', value: poDate });
  }
  return rows;
};

const DC_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .dc-host {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    padding: 16px;
    width: 850px;
    color: #000;
  }
  .dc-wrapper {
    border: 1px solid #000;
    background: #fff;
  }
  table.dc-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.dc-grid td, table.dc-grid th {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: top;
    font-size: 12px;
  }
  .dc-title {
    text-align: center;
    font-weight: bold;
    font-size: 15px;
    letter-spacing: 0.5px;
    padding: 6px 0;
  }
  .dc-company-name {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 2px;
  }
  .dc-company-sub { font-size: 11.5px; font-weight: bold; line-height: 1.35; }
  .dc-meta-label { font-weight: bold; white-space: nowrap; }
  .dc-meta-value { font-weight: bold; }
  .dc-to-label { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
  .dc-address-block { font-size: 12px; line-height: 1.4; white-space: pre-wrap; }
  .dc-gstin-box { font-weight: bold; }
  .dc-state-row td { font-weight: bold; font-size: 12px; }
  .dc-items th {
    text-align: center;
    font-weight: bold;
    font-size: 11.5px;
    vertical-align: middle;
  }
  .dc-items td { font-size: 11.5px; }
  .dc-sr { text-align: center; vertical-align: top; width: 8%; }
  .dc-desc-col { width: 52%; }
  .dc-drums-col { width: 20%; text-align: center; }
  .dc-qty-col { width: 20%; text-align: right; }
  .dc-line { line-height: 1.35; padding: 1px 0; }
  .dc-desc { text-align: left; }
  .dc-drums { text-align: center; }
  .dc-qty { text-align: right; }
  .dc-total-row td { font-weight: bold; font-size: 12.5px; }
  .dc-total-label { text-align: center; }
  .dc-footer-label { font-weight: bold; white-space: nowrap; width: 38%; }
  .dc-footer-value { }
  .dc-sign-box {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    font-weight: bold;
    min-height: 72px;
    height: 100%;
    padding: 6px;
    box-sizing: border-box;
  }
  .dc-sign-title { font-size: 12px; line-height: 1.4; }
  .dc-sign-space { flex: 1; min-height: 28px; width: 100%; }
  .dc-sign-label { font-size: 11px; line-height: 1.4; }
  .dc-company-gstin { font-weight: bold; font-size: 11.5px; }
  .logo-wrap { display: inline-block; vertical-align: middle; margin-right: 8px; }
  .logo-wrap img, .logo-wrap svg { width: 72px; height: 72px; object-fit: contain; }
`;

export const buildDeliveryChallanHtml = (data, profileInput, appDataInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const appData = appDataInput || getDcAppData();
  const { lines, totalDrums, totalQty } = buildDcPrintLines(data, appData);

  const logoSrc = profile.logo && profile.logo.startsWith('data:image') ? profile.logo : '';
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="Logo">`
    : DEFAULT_DC_LOGO_HTML;

  const addressLines = formatDcCompanyAddress(profile);
  const emailLine = formatDcEmailLine(profile);

  const dcNo = esc(data.dcNo || 'N/A');
  const dcDate = esc(formatDcDateSlash(data.date) || 'N/A');
  const poNo = esc(data.partyDocNo || '');
  const poDate = esc(formatDcDateSlash(data.partyDocDate) || '');

  const shipState = esc(data.shipState || data.billState || data.state || profile.state || 'GUJARAT');
  const stateCode = esc(data.shipStateCode || data.billStateCode || data.stateCode || '24');
  const partyGstin = esc(data.gstinShip || data.gstinBill || data.gstin || '');

  const toAddress = [
    data.partyName || '',
    data.shipAddress || data.billAddress || data.address || ''
  ].filter(Boolean).join('\n');

  const metaRows = buildDcMetaRows(dcNo, dcDate, poNo, poDate);
  const metaRowsHtml = metaRows.map((row, idx) => `
            <tr>
              <td class="dc-meta-label" style="width:46%; ${idx === 0 ? 'border-top:none; border-left:none;' : 'border-left:none;'}">${row.label}</td>
              <td class="dc-meta-value" style="${idx === 0 ? 'border-top:none; border-right:none;' : 'border-right:none;'}">${row.value || '&nbsp;'}</td>
            </tr>`).join('');

  const footerRows = buildDcFooterRows(data, profile.gstNumber);
  const footerRowsHtml = footerRows.map((row, idx) => {
    if (row.isGstin) {
      return `
            <tr>
              <td colspan="2" class="dc-company-gstin" style="border-left:none; border-right:none; ${idx === footerRows.length - 1 ? 'border-bottom:none;' : ''}">
                GSTIN : ${esc(row.value)}
              </td>
            </tr>`;
    }
    return `
            <tr>
              <td class="dc-footer-label" style="border-left:none; ${idx === 0 ? 'border-top:none;' : ''}">${row.label}</td>
              <td class="dc-footer-value" style="${idx === 0 ? 'border-top:none; border-right:none;' : 'border-right:none;'}">${esc(row.value)}</td>
            </tr>`;
  }).join('');

  const signMinHeight = Math.max(72, footerRows.length * 22);

  return `
<style>${DC_STYLES}</style>
<div class="dc-host">
  <div class="dc-wrapper">
    <table class="dc-grid">
      <tr>
        <td colspan="4" class="dc-title">DELIVERY CHALLAN</td>
      </tr>

      <tr>
        <td colspan="2" style="width:58%; padding:8px 10px;">
          <div style="display:flex; align-items:center;">
            <div class="logo-wrap">${logoHtml}</div>
            <div>
              <div class="dc-company-name">${esc(profile.companyName)}</div>
              <div class="dc-company-sub">${esc(addressLines[0] || '')}</div>
              <div class="dc-company-sub">${esc(addressLines[1] || '')}</div>
              <div class="dc-company-sub">${esc(emailLine)}</div>
            </div>
          </div>
        </td>
        <td colspan="2" style="width:42%; padding:0;">
          <table class="dc-grid" style="border:none; height:100%;">
            ${metaRowsHtml}
          </table>
        </td>
      </tr>

      <tr>
        <td colspan="2" style="width:58%;">
          <div class="dc-to-label">To,</div>
          <div class="dc-address-block">${esc(toAddress)}</div>
        </td>
        <td colspan="2" class="dc-gstin-box" style="width:42%;">
          GSTIN : ${partyGstin}
        </td>
      </tr>

      <tr class="dc-state-row">
        <td colspan="2">State : ${shipState}</td>
        <td colspan="2" style="text-align:right;">Code : ${stateCode}</td>
      </tr>

      <tr class="dc-items">
        <th class="dc-sr">Sr. No.</th>
        <th class="dc-desc-col">DESCRIPTION</th>
        <th class="dc-drums-col">TOTAL NO. OF DRUMS</th>
        <th class="dc-qty-col">QUANTITY (kg)</th>
      </tr>

      <tr class="dc-items">
        <td class="dc-sr">1</td>
        <td class="dc-desc-col">${buildAlignedCellHtml(lines, 'text')}</td>
        <td class="dc-drums-col">${buildAlignedCellHtml(lines, 'drums')}</td>
        <td class="dc-qty-col">${buildAlignedCellHtml(lines, 'qty')}</td>
      </tr>

      <tr class="dc-total-row">
        <td></td>
        <td class="dc-total-label">TOTAL</td>
        <td style="text-align:center;">${totalDrums || 0}</td>
        <td style="text-align:right;">${fmtQty(totalQty)}</td>
      </tr>

      <tr>
        <td colspan="2" style="padding:0; vertical-align:top;">
          <table class="dc-grid" style="border:none;">
            ${footerRowsHtml}
          </table>
        </td>
        <td colspan="2" style="padding:0; vertical-align:top;">
          <table class="dc-grid" style="border:none; height:100%;">
            <tr style="height:50%;">
              <td class="dc-sign-box" style="border-left:none; border-top:none; border-right:none; min-height:${signMinHeight}px;">
                <div class="dc-sign-title">For ${esc(profile.companyName)}</div>
                <div class="dc-sign-space"></div>
                <div class="dc-sign-label">Authorised Signatory</div>
              </td>
            </tr>
            <tr style="height:50%;">
              <td class="dc-sign-box" style="border-left:none; border-right:none; border-bottom:none; min-height:${signMinHeight}px;">
                <div class="dc-sign-title">RECEIVED BY :</div>
                <div class="dc-sign-space"></div>
                <div class="dc-sign-label">Authorised Signatory</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</div>`;
};

export const renderDeliveryChallanPdf = async (data, { mode = 'save' } = {}) => {
  const appData = data.appData || getDcAppData();
  const html = buildDeliveryChallanHtml(data, data.companyProfile, appData);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const target = host.querySelector('.dc-host');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 850,
      windowWidth: 850
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

    const docNo = data.dcNo || 'N/A';
    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `DC_${docNo}`;
    } else {
      pdf.save(`DC_${docNo}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
