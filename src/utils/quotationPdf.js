import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  PRINT_PAGE_W,
  renderHtmlToPdf,
  getSharedPrintStyles,
  buildPrintLogoHtml
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

  const qtnNo = escHtml(data.quotationNo || 'N/A');
  const qtnDate = escHtml(formatPdfDateDmy(data.date) || 'N/A');
  const validityDate = escHtml(formatPdfDateDmy(data.validityDate) || '');

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
        body {
            background-color: #f0f0f0;
            margin: 0;
            padding: 0;
        }
        .print-host {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            padding: 20px;
        }
        .qtn-page {
            width: ${PRINT_PAGE_W}px;
            height: 1123px;
            padding: 15px;
            box-sizing: border-box;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            position: relative;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            page-break-after: always;
        }
        .qtn-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid var(--primary-purple);
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .qtn-contact-row {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            padding: 6px 12px;
            background-color: var(--light-purple-bg);
            border-radius: 4px;
            margin-bottom: 15px;
        }
        .qtn-contact-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .qtn-contact-item i {
            color: var(--primary-purple);
            font-size: 12px;
        }
        .qtn-box {
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            overflow: hidden;
        }
        .qtn-box-header {
            background-color: var(--primary-purple);
            color: white;
            padding: 6px 10px;
            font-weight: bold;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .qtn-box-body {
            padding: 10px;
            font-size: 10.5px;
            line-height: 1.5;
        }
        .why-item {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            font-size: 10.5px;
            font-weight: bold;
            line-height: 1.3;
        }
        .why-icon {
            width: 26px;
            height: 26px;
            background: var(--primary-purple);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
        }
        .qtn-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            text-align: center;
        }
        .qtn-table th {
            padding: 6px 4px;
            border-bottom: 1.5px solid var(--border-purple);
            border-right: 1px solid var(--border-purple);
        }
        .qtn-table td {
            padding: 6px 4px;
            border-bottom: 1px solid var(--grid-line-purple);
            border-right: 1px solid var(--border-purple);
        }
        .qtn-footer {
            background: var(--primary-purple);
            color: white;
            padding: 6px 15px;
            font-size: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: auto;
            border-radius: 4px;
        }
    </style>
</head>
<body>
<div class="print-host">
  
  <!-- PAGE 1 -->
  <div class="qtn-page pdf-page">
    
    <!-- Header -->
    <div class="qtn-header">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 65px; height: 65px;">
                ${buildPrintLogoHtml(profile)}
            </div>
            <div>
                <h1 style="color: var(--primary-purple); font-size: 36px; font-weight: 900; margin: 0; line-height: 1; text-transform: uppercase;">${escHtml(profile.companyName || 'UMA MICRON')}</h1>
                <div style="color: var(--brand-green); font-size: 16px; font-weight: bold; margin-top: 2px;">Micronization of API's</div>
            </div>
        </div>
        <div style="background-color: var(--primary-purple); color: white; padding: 10px 20px; border-radius: 8px 0 0 8px; text-align: center; min-width: 260px; margin-right: -15px;">
            <div style="font-size: 26px; font-weight: bold; letter-spacing: 1px;">QUOTATION</div>
            <div style="background-color: white; color: var(--primary-purple); font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 4px; margin-top: 5px; display: inline-block;">COMMERCIAL OFFER</div>
        </div>
    </div>

    <!-- Contact Info -->
    <div class="qtn-contact-row">
        <div class="qtn-contact-item"><i class="bi bi-geo-alt-fill"></i> ${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli, Vadodara - 391350')}</div>
        <div class="qtn-contact-item"><i class="bi bi-telephone-fill"></i> ${escHtml(profile.phone || '+91 97120 00297')}</div>
        <div class="qtn-contact-item"><i class="bi bi-envelope-fill"></i> ${escHtml(profile.email || 'umamicron@gmail.com')}</div>
        <div class="qtn-contact-item"><i class="bi bi-globe"></i> ${escHtml(profile.website || 'www.umamicron.com')}</div>
    </div>

    <div style="display: flex; gap: 15px; flex: 1;">
        
        <!-- Left Column -->
        <div style="width: 28%; display: flex; flex-direction: column; gap: 15px;">
            <div class="qtn-box">
                <div class="qtn-box-header"><i class="bi bi-person-circle"></i> PREPARED FOR</div>
                <div class="qtn-box-body">
                    <div style="font-weight: bold; color: var(--primary-purple); font-size: 13px; margin-bottom: 8px;">M/s ${escHtml(data.partyName)}</div>
                    <div style="display: flex; gap: 6px;">
                        <i class="bi bi-geo-alt-fill" style="color: var(--primary-purple); margin-top: 2px;"></i>
                        <div>${splitAddress(data.partyAddress)}</div>
                    </div>
                </div>
            </div>

            <div class="qtn-box">
                <div class="qtn-box-header" style="background: var(--light-purple-bg); color: var(--primary-purple); border-bottom: 1.5px solid var(--border-purple);">WHY UMA MICRON?</div>
                <div class="qtn-box-body" style="padding: 15px 12px;">
                    <div class="why-item"><div class="why-icon"><i class="bi bi-shield-check"></i></div><div>cGMP<br>Compliant Facility</div></div>
                    <div class="why-item"><div class="why-icon"><i class="bi bi-gear"></i></div><div>Contract<br>Micronization</div></div>
                    <div class="why-item"><div class="why-icon"><i class="bi bi-bar-chart-line"></i></div><div>PSD<br>Development</div></div>
                    <div class="why-item"><div class="why-icon"><i class="bi bi-fan"></i></div><div>Jet Milling<br>Technology</div></div>
                    <div class="why-item"><div class="why-icon"><i class="bi bi-award"></i></div><div>Quality<br>Assurance</div></div>
                    <div class="why-item" style="margin-bottom: 0;"><div class="why-icon"><i class="bi bi-building"></i></div><div>Spacious<br>Warehouse</div></div>
                </div>
            </div>

            <div style="text-align: center; margin-top: auto; padding-bottom: 20px;">
                <div style="width: 110px; height: 110px; border: 2px solid var(--primary-purple); border-radius: 50%; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; color: var(--primary-purple); font-weight: bold; font-size: 11px; text-align: center; position: relative;">
                    <div style="position: absolute; top: 15px;">UMA</div>
                    <div style="position: absolute; top: 30px;">MICRON</div>
                    <i class="bi bi-star-fill" style="font-size: 10px; position: absolute; top: 50px;"></i>
                    <i class="bi bi-star-fill" style="font-size: 10px; position: absolute; top: 50px; left: 20px;"></i>
                    <i class="bi bi-star-fill" style="font-size: 10px; position: absolute; top: 50px; right: 20px;"></i>
                    <div style="position: absolute; bottom: 20px;">VADODARA</div>
                </div>
            </div>
        </div>

        <!-- Right Column -->
        <div style="width: 72%; display: flex; flex-direction: column;">
            
            <!-- Details Box -->
            <div style="background: var(--light-purple-bg); border: 1.5px solid var(--border-purple); border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                <table style="width: 100%; font-size: 10.5px; line-height: 1.8;">
                    <tr>
                        <td style="width: 50%;"><i class="bi bi-file-earmark-text" style="color: var(--primary-purple); margin-right: 6px;"></i> <strong>Quotation No.</strong> &nbsp;&nbsp;:&nbsp; ${qtnNo}</td>
                        <td style="width: 50%;"><i class="bi bi-calendar3" style="color: var(--primary-purple); margin-right: 6px;"></i> <strong>Quotation Date</strong> &nbsp;&nbsp;:&nbsp; ${qtnDate}</td>
                    </tr>
                    <tr>
                        <td><i class="bi bi-clock" style="color: var(--primary-purple); margin-right: 6px;"></i> <strong>Validity</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp; ${validityDate}</td>
                        <td><i class="bi bi-person" style="color: var(--primary-purple); margin-right: 6px;"></i> <strong>Prepared By</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp; ${escHtml(data.signatoryName || 'Amit Patel')}</td>
                    </tr>
                    <tr>
                        <td><i class="bi bi-telephone" style="color: var(--primary-purple); margin-right: 6px;"></i> <strong>Contact No.</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp; ${escHtml(profile.phone || '+91 97120 00297')}</td>
                        <td><i class="bi bi-envelope" style="color: var(--primary-purple); margin-right: 6px;"></i> <strong>Email ID</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp; ${escHtml(profile.email || 'umamicron@gmail.com')}</td>
                    </tr>
                </table>
            </div>

            <!-- Subject & Letter -->
            <div style="display: flex; gap: 10px; margin-bottom: 10px; font-size: 11px;">
                <div style="font-weight: bold; color: var(--primary-purple);">SUBJECT:</div>
                <div style="font-weight: bold;">${escHtml(data.subject || 'Quotation for Micronization Services')}</div>
            </div>
            <div style="font-size: 10.5px; line-height: 1.5; margin-bottom: 15px; text-align: justify;">
                <strong>Dear Sir / Madam,</strong><br>
                With reference to the above mentioned subject, please find our offer along with relevant terms and conditions for your ready reference.<br>
                Uma Micron, Vadodara is a Gujarat based company that offers <strong>CONTRACT MICRONIZATION SERVICES</strong> dedicated to comply the needs of the pharmaceutical industry. The facility is at Ranoli - Vadodara, operates according to cGMP standards with more than 500 sq.ft processing area and big warehouse facility.<br>
                Micronization: Jet micronization is used to mill particles below 10-20 microns. Particle to particle impact facilitated by air flow allows for producing particles less than 10-20 microns in size.<br>
                We trust our offer will be in line with your requirement and if you have any techno-commercial queries, please feel free to contact us.
            </div>

            <!-- Commercial Offer Table -->
            <div class="qtn-box" style="margin-bottom: 15px;">
                <div class="qtn-box-header"><i class="bi bi-people-fill"></i> COMMERCIAL OFFER - MICRONIZATION CHARGES</div>
                <table class="qtn-table">
                    <tr style="background: var(--light-purple-bg); color: var(--primary-purple);">
                        <th style="width: 8%;">Sr. No.</th>
                        <th style="width: 35%;">Description</th>
                        <th style="width: 20%;">PSD Requirement</th>
                        <th style="width: 12%;">Unit</th>
                        <th style="width: 12%;">Rate (₹)</th>
                        <th style="width: 13%; border-right: none;">Remarks</th>
                    </tr>
                    ${mainCharges.map((c, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td style="text-align: left;">${escHtml(c.description)}</td>
                        <td>${c.psdRequirement ? escHtml(c.psdRequirement) : '-'}</td>
                        <td>${extractUnit(c.rate)}</td>
                        <td>${extractRate(c.rate)}</td>
                        <td style="border-right: none;">-</td>
                    </tr>
                    `).join('')}
                </table>
            </div>

            <!-- Optional Services & Note -->
            <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                <div class="qtn-box" style="flex: 1.5;">
                    <div class="qtn-box-header"><i class="bi bi-gear-fill"></i> OPTIONAL SERVICES (IF REQUIRED)</div>
                    <table class="qtn-table">
                        <tr style="background: var(--light-purple-bg); color: var(--primary-purple);">
                            <th style="width: 10%;">Sr. No.</th>
                            <th style="width: 50%;">Description</th>
                            <th style="width: 20%;">Unit</th>
                            <th style="width: 20%; border-right: none;">Rate (₹)</th>
                        </tr>
                        ${optionalCharges.map((c, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td style="text-align: left;">${escHtml(c.description)}</td>
                            <td>${extractUnit(c.rate)}</td>
                            <td style="border-right: none;">${extractRate(c.rate)}</td>
                        </tr>
                        `).join('')}
                    </table>
                </div>
                <div class="qtn-box" style="flex: 1;">
                    <div class="qtn-box-header" style="background: white; color: var(--primary-purple); border-bottom: 1.5px solid var(--border-purple);"><i class="bi bi-journal-text"></i> NOTE</div>
                    <div class="qtn-box-body" style="font-size: 9px; padding: 8px;">
                        <ul style="padding-left: 12px; margin: 0; line-height: 1.6;">
                            <li>Prices mentioned are exclusive of GST.</li>
                            <li>GST will be charged extra as applicable.</li>
                            <li>Transportation, Insurance & Packing Charges will be extra.</li>
                            <li>Rates are subject to change without prior notice.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Sign-off -->
            <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-top: auto;">
                <div>
                    Thank you for considering Uma Micron for your micronization requirements.<br>
                    We look forward to a long term business association.
                </div>
                <div style="text-align: right;">
                    <strong>For UMA MICRON</strong><br><br><br>
                    <strong>${escHtml(data.signatoryName || 'Amit Patel')}</strong><br>
                    Authorised Signatory
                </div>
            </div>
        </div>
    </div>

    <!-- Page 1 Footer -->
    <div class="qtn-footer">
        <div><i class="bi bi-telephone-fill"></i> ${escHtml(profile.phone || '+91 97120 00297')}</div>
        <div><i class="bi bi-envelope-fill"></i> ${escHtml(profile.email || 'umamicron@gmail.com')}</div>
        <div><i class="bi bi-globe"></i> ${escHtml(profile.website || 'www.umamicron.com')}</div>
        <div style="font-weight: bold;">Page 1 of 2</div>
    </div>
  </div>

  <!-- PAGE 2 -->
  <div class="qtn-page pdf-page">
    
    <div style="flex: 1; display: flex; flex-direction: column; gap: 15px; margin-top: 10px;">
        
        <!-- Top Row: 3 Columns -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
            
            <!-- Col 1 -->
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div class="qtn-box">
                    <div class="qtn-box-header"><i class="bi bi-file-earmark-text"></i> TERMS & CONDITIONS</div>
                    <div class="qtn-box-body">
                        <ul style="padding-left: 15px; margin: 0; font-size: 10px;">
                            <li style="margin-bottom: 6px;">This is only processing charges, all other charges like Transportation, Insurance, Repacking material charges will be extra.</li>
                            <li>GST will be charged extra as applicable.</li>
                        </ul>
                    </div>
                </div>
                <div class="qtn-box">
                    <div class="qtn-box-header" style="background: white; color: var(--primary-purple); border-bottom: 1.5px solid var(--border-purple);"><i class="bi bi-currency-rupee"></i> PAYMENT TERMS</div>
                    <div class="qtn-box-body" style="font-size: 10px;">
                        <ul style="padding-left: 15px; margin: 0;">
                            <li style="margin-bottom: 6px;">100% Advance against Proforma Invoice.</li>
                            <li>No process will be started without advance payment.</li>
                        </ul>
                    </div>
                </div>
                <div class="qtn-box">
                    <div class="qtn-box-header" style="background: white; color: var(--primary-purple); border-bottom: 1.5px solid var(--border-purple);"><i class="bi bi-calendar-check"></i> VALIDITY</div>
                    <div class="qtn-box-body" style="font-size: 10px;">
                        <ul style="padding-left: 15px; margin: 0;">
                            <li>This quotation is valid till ${validityDate}.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Col 2 -->
            <div class="qtn-box">
                <div class="qtn-box-header"><i class="bi bi-gear"></i> MATERIAL & PROCESS CONDITIONS</div>
                <div class="qtn-box-body">
                    <ul style="padding-left: 15px; margin: 0; font-size: 10px;">
                        <li style="margin-bottom: 10px;">Loss occurs during processing is on your account.</li>
                        <li style="margin-bottom: 10px;">Same materials requirement of micronization separately batch wise of different specification of same materials then change over charge @ Rs. 500/- batch or per specification will be applicable.</li>
                        <li>Material must be non-hazardous, uniform, dry and free flow powder form.</li>
                    </ul>
                </div>
            </div>

            <!-- Col 3 -->
            <div class="qtn-box">
                <div class="qtn-box-header"><i class="bi bi-person-check"></i> CUSTOMER RESPONSIBILITIES</div>
                <div class="qtn-box-body">
                    <ol style="padding-left: 15px; margin: 0; font-size: 10px;">
                        <li style="margin-bottom: 10px;">Please send Purchase Order and specification letter regarding particle size requirement, material dispatch destination with preferred transporter / courier along with material.</li>
                        <li style="margin-bottom: 10px;">Please send extra drums and other repacking materials considering increase of volume after micronization & micronized materials to be repacked in fresh bags.</li>
                        <li>Declaration of non-hazardous property of material is mandatory.</li>
                    </ol>
                </div>
            </div>
        </div>

        <!-- Bottom Row: 2 Columns -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            
            <!-- Col 1 -->
            <div class="qtn-box">
                <div class="qtn-box-header" style="background: white; color: var(--primary-purple); border-bottom: 1.5px solid var(--border-purple);"><i class="bi bi-journal-text"></i> IMPORTANT NOTES</div>
                <div class="qtn-box-body">
                    <ul style="padding-left: 15px; margin: 0; font-size: 10px;">
                        <li style="margin-bottom: 8px;">If properties of material change then rate will be change and PSD will change then rate will be change.</li>
                        <li style="margin-bottom: 8px;">Any changes in taxes will be applicable as per actual.</li>
                        <li>Disputes are subject to Vadodara Jurisdiction only.</li>
                    </ul>
                </div>
            </div>

            <!-- Col 2 -->
            <div class="qtn-box" style="display: flex; flex-direction: column;">
                <div class="qtn-box-header" style="background: white; color: var(--primary-purple); border-bottom: 1.5px solid var(--border-purple);"><i class="bi bi-shield-check"></i> DECLARATION</div>
                <div class="qtn-box-body" style="flex: 1; display: flex; flex-direction: column;">
                    <div style="font-size: 10px; margin-bottom: 30px;">
                        We hereby declare that the above quotation is true and correct to the best of our knowledge.
                    </div>
                    <div style="margin-top: auto; text-align: right; font-size: 10px;">
                        <div style="border-top: 1px solid var(--text-black); display: inline-block; padding-top: 5px; width: 200px; text-align: center;">
                            Authorised Signatory
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <!-- Page 2 Footer -->
    <div class="qtn-footer">
        <div style="font-style: italic; font-size: 11px;">Thank you for your business!</div>
        <div>E. & O.E.</div>
        <div style="font-weight: bold;">Page 2 of 2</div>
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
