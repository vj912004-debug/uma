import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  PRINT_PAGE_W,
  renderHtmlToPdf,
  getSharedPrintStyles,
  buildPrintHeader,
  buildStatusBar
} from './printTheme';

const splitAddress = (address) => {
  if (!address) return '';
  return address.split('\n').map(l => escHtml(l.trim())).filter(Boolean).join('<br>');
};

export const buildQuotationHtml = (data, profileInput) => {
  const profile = mergeCompanyProfile(profileInput);

  const mainCharges = data.mainCharges || [];
  const optionalCharges = data.optionalCharges || [];

  const qtnNo = escHtml(data.quotationNo || 'N/A');
  const qtnDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');

  const metaStrip = `
    <div class="meta-strip" style="grid-template-columns: 1fr 1fr; border-bottom: 1.5px solid var(--primary-purple); padding-bottom: 12px; margin-bottom: 16px;">
        <div class="meta-col">
            <div class="data-row"><div class="data-label" style="width: 50px;">Ref</div><div class="data-value">: &nbsp;${qtnNo}</div></div>
        </div>
        <div class="meta-col" style="text-align: right;">
            <div class="data-row" style="justify-content: flex-end;"><div class="data-label" style="width: 50px; text-align: left;">Date</div><div class="data-value" style="flex: none;">: &nbsp;${qtnDate}</div></div>
        </div>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quotation - ${escHtml(profile.companyName)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        ${getSharedPrintStyles()}
        .qtn-body {
            flex: 1 1 auto;
            font-size: 13px;
            line-height: 1.6;
            padding: 0 10px;
        }
        .qtn-address {
            margin-bottom: 20px;
            line-height: 1.5;
            font-size: 13px;
        }
        .qtn-subject {
            font-weight: bold;
            text-decoration: underline;
            margin: 20px 0;
            font-size: 13px;
        }
        .qtn-para {
            margin-bottom: 16px;
            text-align: justify;
            font-size: 13px;
        }
        .qtn-sign {
            margin-top: 40px;
            font-size: 13px;
        }
        .qtn-sign-name {
            font-weight: bold;
            margin-top: 50px;
            color: var(--primary-purple);
        }
        
        /* Page 2 & 3 */
        .qtn-title-center {
            text-align: center;
            font-size: 15px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 24px;
            letter-spacing: 0.5px;
            color: var(--primary-purple);
        }
        .qtn-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }
        .qtn-table th, .qtn-table td {
            border: 1px solid var(--grid-line-purple);
            padding: 10px 8px;
            text-align: left;
            font-size: 12.5px;
            vertical-align: middle;
        }
        .qtn-table th {
            background-color: var(--primary-purple);
            color: #ffffff;
            font-weight: normal;
            text-align: center;
        }
        .qtn-table td.c { text-align: center; border-left: 1px solid var(--border-purple); border-right: 1px solid var(--border-purple); }
        .qtn-table td.r { text-align: right; border-left: 1px solid var(--border-purple); border-right: 1px solid var(--border-purple); }
        .qtn-table td.l { text-align: left; border-left: 1px solid var(--border-purple); border-right: 1px solid var(--border-purple); }
        
        .qtn-terms-item {
            margin-bottom: 12px;
            font-size: 13px;
        }
        .qtn-terms-item strong {
            font-weight: bold;
            color: var(--primary-purple);
        }
        .qtn-notes-list {
            margin-left: 20px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        .qtn-notes-list li {
            margin-bottom: 10px;
            padding-left: 5px;
        }
    </style>
</head>
<body>
<div class="print-host">

  <!-- Page 1: Cover Letter -->
  <div class="pdf-page">
    <div class="invoice-box">
      ${buildPrintHeader(profile, 'QUOTATION', '')}
      ${metaStrip}
      
      <div class="qtn-body">
        <div class="qtn-address">
          To,<br>
          M/s <b>${escHtml(data.partyName)}</b><br>
          ${splitAddress(data.partyAddress)}
          ${data.gstNumber ? `<br>GSTIN : ${escHtml(data.gstNumber)}` : ''}
        </div>
        
        <div class="qtn-para">Dear Sir/Madam,</div>
        
        <div class="qtn-subject">Sub: ${escHtml(data.subject || 'Quotation for Micronization Services.')}</div>
        
        <div class="qtn-para">With reference to the above mentioned subject, please find attached our offer along with relevant terms and conditions for your ready reference.</div>
        
        <div class="qtn-para">Uma Micron, Vadodara is a Gujarat based company that offers <b>Contract Micronization Services</b> dedicated to comply with the needs of the pharmaceutical industry. The facility is at Ranol-Vadodara, operates according to cGMP standards with more than 500 sq.ft processing area and big warehouse facility.</div>
        
        <div class="qtn-para"><b>Micronization:</b> Jet micronization is used to mill particles below 10-20 microns. Particle to particle impact facilitated by air flow allows for producing particles less than 10-20 microns in size.</div>
        
        ${data.description ? `<div class="qtn-para">${escHtml(data.description).replace(/\n/g, '<br>')}</div>` : ''}
        
        <div class="qtn-para">We trust our offer will be in line with your requirement and if you have any techno-commercial queries, please feel free to contact us.</div>
        
        <div class="qtn-sign">
          Thanking You,<br>
          For ${escHtml(profile.companyName || 'UMA MICRON')}
          <div class="qtn-sign-name">${escHtml(data.signatoryName || 'Amit Patel')}</div>
        </div>
      </div>
      
      <div style="margin-top: auto;">
        ${buildStatusBar('Page 1 of 3')}
      </div>
    </div>
  </div>

  <!-- Page 2: Charges Table -->
  <div class="pdf-page">
    <div class="invoice-box">
      ${buildPrintHeader(profile, 'QUOTATION', '')}
      ${metaStrip}
      
      <div class="qtn-body">
        <div class="qtn-title-center">QUOTATION: MICRONIZATION CHARGE</div>
        
        <table class="qtn-table">
          <thead>
            <tr>
              <th style="width: 8%;">Sr.<br>No.</th>
              <th style="width: 42%;">Description</th>
              <th style="width: 30%;">PSD Requirement</th>
              <th style="width: 20%; text-align: right; padding-right: 8px;">Rate</th>
            </tr>
          </thead>
          <tbody>
            ${mainCharges.map((c, i) => `
              <tr>
                <td class="c">${i + 1}</td>
                <td class="l">${escHtml(c.description)}</td>
                <td class="l">${c.psdRequirement ? escHtml(c.psdRequirement) : '&mdash;'}</td>
                <td class="r">${escHtml(c.rate)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${optionalCharges.length > 0 ? `
          <div style="font-weight: bold; margin-bottom: 12px; font-size: 13px; color: var(--primary-purple);">BELOW ITEMS IF REQUIRED:</div>
          <table class="qtn-table">
            <thead>
              <tr>
                <th style="width: 8%;">Sr.<br>No</th>
                <th style="width: 72%;">Description</th>
                <th style="width: 20%; text-align: right; padding-right: 8px;">Rate</th>
              </tr>
            </thead>
            <tbody>
              ${optionalCharges.map((c, i) => `
                <tr>
                  <td class="c">${i + 1}</td>
                  <td class="l">${escHtml(c.description)}</td>
                  <td class="r">${escHtml(c.rate)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
      
      <div style="margin-top: auto;">
        ${buildStatusBar('Page 2 of 3')}
      </div>
    </div>
  </div>

  <!-- Page 3: Terms & Condition -->
  <div class="pdf-page">
    <div class="invoice-box">
      ${buildPrintHeader(profile, 'QUOTATION', '')}
      ${metaStrip}
      
      <div class="qtn-body">
        <div class="qtn-title-center">Terms and Condition:</div>
        
        <div style="margin-bottom: 24px;">
          ${(data.terms || '').split('\n').filter(l => l.trim()).map(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1 && colonIndex < 30) {
              const boldPart = line.substring(0, colonIndex + 1);
              const restPart = line.substring(colonIndex + 1);
              return `<div class="qtn-terms-item"><strong>${escHtml(boldPart)}</strong> ${escHtml(restPart.trim())}</div>`;
            }
            return `<div class="qtn-terms-item">${escHtml(line)}</div>`;
          }).join('')}
        </div>
        
        <div style="font-weight: bold; margin-bottom: 12px; color: var(--primary-purple); font-size: 13px;">Note:</div>
        <ol class="qtn-notes-list">
          ${(data.notes || '').split('\n').filter(l => l.trim()).map(line => {
            const cleanLine = line.replace(/^[0-9]+[.)]\s*/, '');
            return `<li>${escHtml(cleanLine)}</li>`;
          }).join('')}
        </ol>
        
        <div class="qtn-sign">
          For ${escHtml(profile.companyName || 'UMA MICRON')}
          <div class="qtn-sign-name">${escHtml(data.signatoryName || 'Amit Patel')}</div>
        </div>
      </div>
      
      <div style="margin-top: auto;">
        ${buildStatusBar('Page 3 of 3')}
      </div>
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
