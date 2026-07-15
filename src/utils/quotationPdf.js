import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { mergeCompanyProfile } from './companyProfile';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatPdfDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const DEFAULT_LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48" style="display:block;">
  <circle cx="50" cy="50" r="45" fill="none" stroke="#000" stroke-width="4"/>
  <text x="50" y="65" font-family="Arial, sans-serif" font-size="40" font-weight="900" fill="#000" text-anchor="middle">UM</text>
</svg>
`;

const QTN_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .qtn-host {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    width: 900px;
    color: #000;
  }
  .qtn-page {
    width: 100%;
    height: 1273px;
    background: #fff;
    display: flex;
    flex-direction: column;
    padding: 40px 50px;
    position: relative;
  }
  .qtn-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-bottom: 12px;
    border-bottom: 2px solid #000;
    margin-bottom: 25px;
  }
  .qtn-header-left {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .qtn-company-name {
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 4px;
    font-family: "Times New Roman", Times, serif;
    letter-spacing: 0.5px;
  }
  .qtn-company-sub {
    font-size: 13px;
    color: #333;
  }
  .qtn-header-right {
    font-size: 11px;
    color: #000;
    max-width: 450px;
    text-align: right;
  }
  .qtn-footer {
    position: absolute;
    bottom: 30px;
    left: 50px;
    right: 50px;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #000;
    border-top: 1px solid #ddd;
    padding-top: 10px;
  }
  .qtn-body {
    flex: 1 1 auto;
    font-size: 14.5px;
    line-height: 1.6;
  }
  .qtn-ref-date {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 25px;
  }
  .qtn-ref-date table {
    font-size: 14.5px;
  }
  .qtn-ref-date td {
    padding: 2px 0 2px 15px;
    font-weight: bold;
  }
  .qtn-address {
    margin-bottom: 25px;
    line-height: 1.5;
  }
  .qtn-subject {
    font-weight: bold;
    text-decoration: underline;
    margin: 25px 0;
  }
  .qtn-para {
    margin-bottom: 20px;
    text-align: justify;
  }
  .qtn-sign {
    margin-top: 40px;
  }
  .qtn-sign-name {
    font-weight: bold;
    margin-top: 60px;
  }
  
  /* Page 2 */
  .qtn-title-center {
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 30px;
    letter-spacing: 0.5px;
  }
  .qtn-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 30px;
  }
  .qtn-table th, .qtn-table td {
    border: 1px solid #000;
    padding: 12px 10px;
    text-align: left;
    font-size: 14px;
    vertical-align: middle;
  }
  .qtn-table th {
    font-weight: bold;
  }
  .qtn-table td.c {
    text-align: center;
  }
  .qtn-table td.r {
    text-align: right;
  }
  
  /* Page 3 */
  .qtn-terms-item {
    margin-bottom: 15px;
  }
  .qtn-terms-item strong {
    font-weight: bold;
  }
  .qtn-notes-list {
    margin-left: 20px;
    margin-bottom: 20px;
  }
  .qtn-notes-list li {
    margin-bottom: 12px;
    padding-left: 5px;
  }
`;

const buildHeader = (profile) => `
  <div class="qtn-header">
    <div class="qtn-header-left">
      ${profile.logo && profile.logo.startsWith('data:image') ? `<img src="${profile.logo}" style="width: 50px; height: 50px; object-fit: contain;">` : DEFAULT_LOGO}
      <div>
        <div class="qtn-company-name">UMA MICRON</div>
        <div class="qtn-company-sub">Micronization of API's</div>
      </div>
    </div>
    <div class="qtn-header-right">
      Plot No. 1116 G.I.D.C. Ranol, N.H. No. 8, Ranol, Dist. Vadodara-391350
    </div>
  </div>
`;

const buildFooter = () => `
  <div class="qtn-footer">
    <div>M - 09712000297</div>
    <div>info@umamicron.com &nbsp;-&nbsp; www.umamicron.com</div>
  </div>
`;

const splitAddress = (address) => {
  if (!address) return '';
  return address.split('\n').map(l => esc(l.trim())).filter(Boolean).join('<br>');
};

export const buildQuotationHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);

  const mainCharges = data.mainCharges || [];
  const optionalCharges = data.optionalCharges || [];

  return `
<style>${QTN_STYLES}</style>
<div class="qtn-host">

  <!-- Page 1: Cover Letter -->
  <div class="qtn-page">
    ${buildHeader(profile)}
    <div class="qtn-body">
      <div class="qtn-ref-date">
        <table>
          <tr><td>Ref:</td><td>${esc(data.quotationNo)}</td></tr>
          <tr><td>Date:</td><td>${esc(formatPdfDate(data.date))}</td></tr>
        </table>
      </div>
      
      <div class="qtn-address">
        To,<br>
        M/s <b>${esc(data.partyName)}</b><br>
        ${splitAddress(data.partyAddress)}
        ${data.gstNumber ? `<br>GSTIN : ${esc(data.gstNumber)}` : ''}
      </div>
      
      <div class="qtn-para">Dear Sir/Madam,</div>
      
      <div class="qtn-subject">Sub: ${esc(data.subject || 'Quotation for Micronization Services.')}</div>
      
      <div class="qtn-para">With reference to the above mentioned subject, please find attached our offer along with relevant terms and conditions for your ready reference.</div>
      
      <div class="qtn-para">Uma Micron, Vadodara is a Gujarat based company that offers <b>Contract Micronization Services</b> dedicated to comply with the needs of the pharmaceutical industry. The facility is at Ranol-Vadodara, operates according to cGMP standards with more than 500 sq.ft processing area and big warehouse facility.</div>
      
      <div class="qtn-para"><b>Micronization:</b> Jet micronization is used to mill particles below 10-20 microns. Particle to particle impact facilitated by air flow allows for producing particles less than 10-20 microns in size.</div>
      
      ${data.description ? `<div class="qtn-para">${esc(data.description).replace(/\n/g, '<br>')}</div>` : ''}
      
      <div class="qtn-para">We trust our offer will be in line with your requirement and if you have any techno-commercial queries, please feel free to contact us.</div>
      
      <div class="qtn-sign">
        Thanking You,<br>
        For Uma Micron
        <div class="qtn-sign-name">${esc(data.signatoryName || 'Amit Patel')}</div>
      </div>
    </div>
    ${buildFooter()}
  </div>

  <!-- Page 2: Charges Table -->
  <div class="qtn-page">
    ${buildHeader(profile)}
    <div class="qtn-body">
      <div class="qtn-title-center">QUOTATION: MICRONIZATION CHARGE</div>
      
      <table class="qtn-table">
        <thead>
          <tr>
            <th style="width: 8%;">Sr.<br>No.</th>
            <th style="width: 42%;">Description</th>
            <th style="width: 30%;">PSD Requirement</th>
            <th style="width: 20%; text-align: right;">Rate</th>
          </tr>
        </thead>
        <tbody>
          ${mainCharges.map((c, i) => `
            <tr>
              <td class="c">${i + 1}</td>
              <td>${esc(c.description)}</td>
              <td>${c.psdRequirement ? esc(c.psdRequirement) : '&mdash;'}</td>
              <td class="r">${esc(c.rate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${optionalCharges.length > 0 ? `
        <div style="font-weight: bold; margin-bottom: 15px; font-size: 14px;">BELOW ITEMS IF REQUIRED:</div>
        <table class="qtn-table">
          <thead>
            <tr>
              <th style="width: 8%;">Sr.<br>No</th>
              <th style="width: 72%;">Description</th>
              <th style="width: 20%; text-align: right;">Rate</th>
            </tr>
          </thead>
          <tbody>
            ${optionalCharges.map((c, i) => `
              <tr>
                <td class="c">${i + 1}</td>
                <td>${esc(c.description)}</td>
                <td class="r">${esc(c.rate)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
    ${buildFooter()}
  </div>

  <!-- Page 3: Terms & Condition -->
  <div class="qtn-page">
    ${buildHeader(profile)}
    <div class="qtn-body">
      <div class="qtn-title-center">Terms and Condition:</div>
      
      <div style="margin-bottom: 30px;">
        ${(data.terms || '').split('\n').filter(l => l.trim()).map(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > -1 && colonIndex < 30) {
            const boldPart = line.substring(0, colonIndex + 1);
            const restPart = line.substring(colonIndex + 1);
            return `<div class="qtn-terms-item"><strong>${esc(boldPart)}</strong> ${esc(restPart.trim())}</div>`;
          }
          return `<div class="qtn-terms-item">${esc(line)}</div>`;
        }).join('')}
      </div>
      
      <div style="font-weight: bold; margin-bottom: 15px;">Note:</div>
      <ol class="qtn-notes-list">
        ${(data.notes || '').split('\n').filter(l => l.trim()).map(line => {
          const cleanLine = line.replace(/^[0-9]+[.)]\s*/, '');
          return `<li>${esc(cleanLine)}</li>`;
        }).join('')}
      </ol>
      
      <div class="qtn-sign">
        For Uma Micron
        <div class="qtn-sign-name">${esc(data.signatoryName || 'Amit Patel')}</div>
      </div>
    </div>
    ${buildFooter()}
  </div>

</div>
`;
};

export const renderQuotationPdf = async (data, { mode = 'save' } = {}) => {
  const html = buildQuotationHtml(data, data.companyProfile);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-15000px;top:0;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const pages = host.querySelectorAll('.qtn-page');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) pdf.addPage();
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 900,
        windowWidth: 900
      });
      
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH);
    }

    const docNo = data.quotationNo || 'N/A';
    if (mode === 'view') {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) win.document.title = `QTN_${docNo}`;
    } else {
      pdf.save(`QTN_${docNo}.pdf`);
    }
  } finally {
    document.body.removeChild(host);
  }
};
