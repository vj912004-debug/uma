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
        .qtn-page {
            width: ${PRINT_PAGE_W}px;
            min-height: 1123px;
            padding: 15px;
            box-sizing: border-box;
            background: #ffffff;
            display: flex;
            flex-direction: column;
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
            margin-bottom: 12px;
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
            flex: 1;
        }
        .qtn-box-header {
            background-color: var(--primary-purple);
            color: white;
            padding: 5px 10px;
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
        .qtn-subject {
            background-color: var(--light-purple-bg);
            border: 1.5px solid var(--border-purple);
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 11px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .qtn-letter {
            font-size: 10.5px;
            line-height: 1.5;
            margin-bottom: 12px;
            text-align: justify;
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
        .qtn-terms-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
            margin-bottom: 12px;
        }
        .qtn-term-box {
            border: 1px solid var(--border-purple);
            border-radius: 4px;
            padding: 8px 6px;
            font-size: 9px;
            text-align: center;
            line-height: 1.3;
        }
        .qtn-term-title {
            font-weight: bold;
            margin-bottom: 5px;
            font-size: 9.5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
        }
        .qtn-term-title i {
            font-size: 14px;
        }
    </style>
</head>
<body>
<div class="print-host">
  <div class="qtn-page">
    
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
            <div style="background-color: white; color: var(--primary-purple); font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 4px; margin-top: 5px; display: inline-block;">CONTRACT MICRONIZATION SERVICES</div>
        </div>
    </div>

    <!-- Contact Info -->
    <div class="qtn-contact-row">
        <div class="qtn-contact-item"><i class="bi bi-geo-alt-fill"></i> ${escHtml(profile.addressLine1 || 'Plot No. 1116, G.I.D.C., Ranoli, Vadodara - 391350')}</div>
        <div class="qtn-contact-item"><i class="bi bi-telephone-fill"></i> ${escHtml(profile.phone || '+91 97120 00297')}</div>
        <div class="qtn-contact-item"><i class="bi bi-envelope-fill"></i> ${escHtml(profile.email || 'info@umamicron.com')}</div>
        <div class="qtn-contact-item"><i class="bi bi-globe"></i> ${escHtml(profile.website || 'www.umamicron.com')}</div>
    </div>

    <!-- Row 1: Prepared For & Details -->
    <div style="display: flex; gap: 15px; margin-bottom: 12px;">
        <div class="qtn-box">
            <div class="qtn-box-header"><i class="bi bi-person-circle"></i> PREPARED FOR</div>
            <div class="qtn-box-body">
                <div style="font-weight: bold; font-size: 13px; color: var(--primary-purple); margin-bottom: 5px;">${escHtml(data.partyName)}</div>
                <div style="display: flex; gap: 6px; margin-bottom: 5px;">
                    <i class="bi bi-geo-alt-fill" style="color: var(--primary-purple); margin-top: 2px;"></i>
                    <div>${splitAddress(data.partyAddress)}</div>
                </div>
                <table style="width: 100%; font-size: 10px; margin-top: 8px;">
                    <tr><td style="font-weight: bold; width: 90px;">GSTIN</td><td>: ${escHtml(data.gstNumber || '')}</td></tr>
                    <tr><td style="font-weight: bold;">Contact Person</td><td>: ${escHtml(data.contactPerson || '')}</td></tr>
                    <tr><td style="font-weight: bold;">Mobile</td><td>: ${escHtml(data.mobile || '')}</td></tr>
                    <tr><td style="font-weight: bold;">Email</td><td>: ${escHtml(data.email || '')}</td></tr>
                </table>
            </div>
        </div>
        
        <div class="qtn-box" style="position: relative;">
            <div class="qtn-box-header"><i class="bi bi-file-earmark-text"></i> QUOTATION DETAILS</div>
            <div class="qtn-box-body">
                <table style="width: 75%; font-size: 10.5px; line-height: 1.8;">
                    <tr><td style="width: 20px;"><i class="bi bi-file-earmark-text" style="color: var(--primary-purple);"></i></td><td style="font-weight: bold; width: 100px;">Quotation No.</td><td>: ${qtnNo}</td></tr>
                    <tr><td><i class="bi bi-calendar3" style="color: var(--primary-purple);"></i></td><td style="font-weight: bold;">Quotation Date</td><td>: ${qtnDate}</td></tr>
                    <tr><td><i class="bi bi-clock" style="color: var(--primary-purple);"></i></td><td style="font-weight: bold;">Validity</td><td>: ${validityDate}</td></tr>
                    <tr><td><i class="bi bi-person" style="color: var(--primary-purple);"></i></td><td style="font-weight: bold;">Contact Person</td><td>: ${escHtml(data.signatoryName || 'Amit Patel')}</td></tr>
                    <tr><td><i class="bi bi-telephone" style="color: var(--primary-purple);"></i></td><td style="font-weight: bold;">Mobile</td><td>: ${escHtml(profile.phone || '+91 97120 00297')}</td></tr>
                    <tr><td><i class="bi bi-envelope" style="color: var(--primary-purple);"></i></td><td style="font-weight: bold;">Email</td><td>: ${escHtml(profile.email || 'info@umamicron.com')}</td></tr>
                </table>
            </div>
            <div style="position: absolute; right: 20px; top: 35px; text-align: center;">
                <div style="width: 65px; height: 65px; background-color: var(--primary-purple); border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; border: 2px solid white; outline: 2px solid var(--primary-purple); box-shadow: 0 0 0 3px white, 0 0 0 4px var(--primary-purple);">
                    <i class="bi bi-star-fill" style="font-size: 8px; margin-bottom: 2px;"></i>
                    <div style="font-size: 8px;">VALID FOR</div>
                    <div style="font-size: 12px; font-weight: bold;">30 DAYS</div>
                    <div style="font-size: 8px; margin-top: 2px;">★ ★ ★</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Subject -->
    <div class="qtn-subject">
        <div style="background-color: var(--primary-purple); color: white; padding: 3px 6px; border-radius: 4px;"><i class="bi bi-card-text"></i></div>
        <div style="font-weight: bold; color: var(--primary-purple);">SUBJECT:</div>
        <div>${escHtml(data.subject || 'Quotation for Micronization Services')}</div>
    </div>

    <!-- Letter -->
    <div class="qtn-letter">
        <p style="margin-bottom: 8px;"><strong>Dear Sir/Madam,</strong></p>
        <p style="margin-bottom: 8px;">With reference to your enquiry, we are pleased to submit our offer for Micronization Services as per the details mentioned below. UMA MICRON, Vadodara is a Gujarat based company that offers <strong>CONTRACT MICRONIZATION SERVICES</strong> dedicated to comply the needs of the pharmaceutical industry. Our facility at Ranoli - Vadodara operates as per cGMP standards with more than 500 sq.ft. processing area and large warehouse facility.</p>
        <p style="margin-bottom: 8px;">We trust our offer will be in line with your requirement.</p>
        <p>For any techno-commercial queries, please feel free to contact us.</p>
    </div>

    <!-- Tables -->
    <div style="display: flex; gap: 15px; margin-bottom: 12px;">
        <div class="qtn-box" style="flex: 1.4;">
            <div class="qtn-box-header" style="justify-content: center;">COMMERCIAL OFFER</div>
            <table class="qtn-table">
                <tr style="background-color: var(--light-purple-bg); font-weight: bold; color: var(--primary-purple);">
                    <th style="width: 8%;">Sr. No.</th>
                    <th style="width: 42%;">Description</th>
                    <th style="width: 25%;">PSD Requirement</th>
                    <th style="width: 25%; border-right: none;">Rate (₹)</th>
                </tr>
                ${mainCharges.map((c, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td style="text-align: left;">${escHtml(c.description)}</td>
                    <td>${c.psdRequirement ? escHtml(c.psdRequirement) : '&mdash;'}</td>
                    <td style="font-weight: bold; border-right: none;">${escHtml(c.rate)}</td>
                </tr>
                `).join('')}
            </table>
        </div>

        <div class="qtn-box" style="flex: 1; border-color: var(--brand-green);">
            <div class="qtn-box-header" style="background-color: var(--brand-green); justify-content: center;"><i class="bi bi-gear-fill"></i> OPTIONAL SERVICES</div>
            <table class="qtn-table">
                <tr style="background-color: #e8f5e9; font-weight: bold; color: var(--brand-green);">
                    <th style="border-color: var(--brand-green); width: 10%;">Sr. No.</th>
                    <th style="border-color: var(--brand-green); width: 60%;">Description</th>
                    <th style="border-color: var(--brand-green); width: 30%; border-right: none;">Rate (₹)</th>
                </tr>
                ${optionalCharges.map((c, i) => `
                <tr>
                    <td style="border-color: #c8e6c9;">${i + 1}</td>
                    <td style="border-color: #c8e6c9; text-align: left;">${escHtml(c.description)}</td>
                    <td style="border-color: #c8e6c9; font-weight: bold; border-right: none;">${escHtml(c.rate)}</td>
                </tr>
                `).join('')}
            </table>
        </div>
    </div>

    <!-- Icons Row -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border: 1px solid var(--grid-line-purple); border-radius: 6px; padding: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background-color: var(--primary-purple); border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="bi bi-shield-check"></i></div>
            <div style="font-size: 8.5px; font-weight: bold; color: var(--primary-purple); width: 65px; line-height: 1.2;">cGMP COMPLIANT FACILITY</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background-color: #1976d2; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="bi bi-gear"></i></div>
            <div style="font-size: 8.5px; font-weight: bold; color: #1976d2; width: 85px; line-height: 1.2;">CONTRACT MICRONIZATION EXPERTS</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background-color: #388e3c; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="bi bi-bullseye"></i></div>
            <div style="font-size: 8.5px; font-weight: bold; color: #388e3c; width: 80px; line-height: 1.2;">PARTICLE SIZE ANALYSIS & DEVELOPMENT</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background-color: #f57c00; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="bi bi-box-seam"></i></div>
            <div style="font-size: 8.5px; font-weight: bold; color: #f57c00; width: 65px; line-height: 1.2;">CLEAN ROOM PROCESSING AREA</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background-color: #d32f2f; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="bi bi-clock-history"></i></div>
            <div style="font-size: 8.5px; font-weight: bold; color: #d32f2f; width: 55px; line-height: 1.2;">ON TIME DELIVERY</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background-color: #5c6bc0; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="bi bi-people"></i></div>
            <div style="font-size: 8.5px; font-weight: bold; color: #5c6bc0; width: 65px; line-height: 1.2;">DEDICATED TECHNICAL SUPPORT</div>
        </div>
    </div>

    <!-- Sign-off & Notes -->
    <div style="display: flex; gap: 15px; margin-bottom: 12px; font-size: 10.5px;">
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div>Thanking You,<br><strong>For ${escHtml(profile.companyName || 'UMA MICRON')}</strong></div>
            <div style="font-weight: bold; color: var(--primary-purple); margin-top: 30px;">${escHtml(data.signatoryName || 'Amit Patel')}</div>
        </div>
        <div style="flex: 2; background-color: var(--light-purple-bg); padding: 10px; border-radius: 6px; border: 1px solid var(--border-purple);">
            <div style="font-weight: bold; color: var(--primary-purple); margin-bottom: 5px;">Note:</div>
            <ul style="padding-left: 15px; margin: 0; line-height: 1.5;">
                ${(data.notes || '').split('\n').filter(l => l.trim()).map(line => {
                    const cleanLine = line.replace(/^[0-9]+[.)]\s*/, '');
                    return `<li>${escHtml(cleanLine)}</li>`;
                }).join('')}
            </ul>
        </div>
        <div style="width: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--border-purple); border-radius: 6px; padding: 5px;">
            <i class="bi bi-qr-code" style="font-size: 40px; color: var(--text-black);"></i>
            <div style="font-size: 8px; font-weight: bold; text-align: center; color: var(--primary-purple); margin-top: 5px;">SCAN TO<br>VISIT OUR<br>WEBSITE</div>
        </div>
    </div>

    <!-- Terms & Conditions -->
    <div style="background-color: var(--primary-purple); color: white; padding: 6px 15px; font-weight: bold; font-size: 12px; border-radius: 6px; margin-bottom: 10px;">
        TERMS & CONDITIONS
    </div>
    <div class="qtn-terms-grid">
        <div class="qtn-term-box" style="border-color: var(--border-purple);">
            <div class="qtn-term-title" style="color: var(--primary-purple);"><i class="bi bi-receipt"></i> TAXES</div>
            <div>GST will be charged extra as applicable.</div>
        </div>
        <div class="qtn-term-box" style="border-color: #90caf9;">
            <div class="qtn-term-title" style="color: #1976d2;"><i class="bi bi-droplet"></i> PROCESS LOSS</div>
            <div>Loss occurs during processing is on your account.</div>
        </div>
        <div class="qtn-term-box" style="border-color: #a5d6a7;">
            <div class="qtn-term-title" style="color: #388e3c;"><i class="bi bi-arrow-repeat"></i> BATCH / CHANGE OVER</div>
            <div>Change Over Charge @ ₹ 500/- per batch or per specification will be applicable.</div>
        </div>
        <div class="qtn-term-box" style="border-color: #ffcc80;">
            <div class="qtn-term-title" style="color: #f57c00;"><i class="bi bi-truck"></i> OTHER CHARGES</div>
            <div>Transportation, Insurance, Repacking material charges will be extra.</div>
        </div>
        <div class="qtn-term-box" style="border-color: #ef9a9a;">
            <div class="qtn-term-title" style="color: #d32f2f;"><i class="bi bi-cash-coin"></i> PAYMENT TERMS</div>
            <div>100% Advance against Performa Invoice.</div>
        </div>
        <div class="qtn-term-box" style="border-color: #80cbc4;">
            <div class="qtn-term-title" style="color: #00796b;"><i class="bi bi-calendar-check"></i> VALIDITY</div>
            <div>This quotation is valid up to ${validityDate}.</div>
        </div>
    </div>

    <!-- Important Notes & Responsibilities -->
    <div style="display: flex; gap: 15px; flex: 1;">
        <div style="flex: 1; border: 1.5px solid var(--border-purple); border-radius: 6px; padding: 10px; font-size: 9.5px; background-color: var(--light-purple-bg);">
            <div style="color: var(--primary-purple); font-weight: bold; font-size: 11px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;"><i class="bi bi-journal-text"></i> IMPORTANT NOTES</div>
            <ol style="padding-left: 15px; margin: 0; line-height: 1.5;">
                <li>Please send Purchase Order and specification letter regarding particle size requirement, material dispatch destination with preferred transporter / courier along with material.</li>
                <li>Please send extra drums and other repacking materials considering increase of volume after micronization & micronized materials to be repacked in fresh bags.</li>
                <li>Material must be Non-Hazardous, uniform, dry and free flow powder form. Declaration form regarding material's non hazardous property is mandatory.</li>
            </ol>
        </div>
        <div style="flex: 1; border: 1.5px solid #80cbc4; border-radius: 6px; padding: 10px; font-size: 9.5px; background-color: #e0f2f1; position: relative;">
            <div style="color: #00796b; font-weight: bold; font-size: 11px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;"><i class="bi bi-person-check"></i> CUSTOMER RESPONSIBILITIES</div>
            <ol style="padding-left: 15px; margin: 0; line-height: 1.5;">
                <li>Material must be non-hazardous and free from any contamination.</li>
                <li>Material specification and desired PSD must be clearly mentioned.</li>
                <li>All documents & regulatory forms to be provided along with material.</li>
                <li>Repacking material to be provided if customer does not opt for our material.</li>
            </ol>
            <div style="position: absolute; bottom: 10px; right: 10px; text-align: center; font-size: 10px;">
                <div style="font-weight: bold; color: var(--primary-purple); margin-bottom: 25px;">For ${escHtml(profile.companyName || 'UMA MICRON')}</div>
                <div style="font-weight: bold; color: var(--text-black);">${escHtml(data.signatoryName || 'Amit Patel')}</div>
                <div style="color: #555;">Authorised Signatory</div>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div style="background-color: var(--primary-purple); color: white; padding: 8px 15px; font-size: 11px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-top: 12px;">
        <div style="font-style: italic; font-size: 13px;">Thank you for your business!</div>
        <div style="display: flex; gap: 25px;">
            <div><i class="bi bi-shield-check"></i> Quality You Can Trust</div>
            <div><i class="bi bi-gear-fill"></i> Performance You Can Rely On</div>
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
