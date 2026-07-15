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

const DC_STYLES = `
        :root {
            --primary-color: #1e3a8a; /* Modern corporate navy */
            --text-dark: #1f2937;
            --text-light: #4b5563;
            --border-color: #e5e7eb;
            --bg-light: #f9fafb;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .dc-host {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            color: var(--text-dark);
            background-color: #f3f4f6;
            line-height: 1.5;
            width: 850px;
            min-height: 1202px;
        }

        .challan-container {
            width: 100%;
            height: 100%;
            background-color: #ffffff;
            padding: 40px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border-radius: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }

        /* Header Layout */
        .header-section {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 30px;
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 20px;
            margin-bottom: 25px;
        }

        .company-logo-area {
            display: flex;
            gap: 15px;
            align-items: center;
        }

        .company-logo-area h1 {
            color: var(--primary-color);
            margin: 0 0 5px 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .company-address {
            font-size: 13px;
            color: var(--text-light);
            margin: 0;
        }

        .document-title-badge {
            background-color: var(--primary-color);
            color: #ffffff;
            text-align: center;
            padding: 6px 15px;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 15px;
        }

        /* Meta Data Grid */
        .meta-details-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            font-size: 13px;
        }

        .meta-item {
            background-color: var(--bg-light);
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
        }

        .meta-label {
            font-weight: 600;
            color: var(--text-light);
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            margin-bottom: 2px;
        }

        .meta-value {
            color: var(--text-dark);
            font-weight: 500;
        }

        /* Shipping Info Section */
        .shipping-section {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 30px;
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 12px;
            text-transform: uppercase;
            color: var(--primary-color);
            font-weight: 700;
            margin: 0 0 8px 0;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 4px;
        }

        .address-box {
            font-size: 14px;
            white-space: pre-wrap;
        }

        .address-box strong {
            display: block;
            font-size: 16px;
            margin-bottom: 5px;
            color: var(--text-dark);
        }

        /* Modernized Items Table */
        .items-table-wrapper {
            flex: 1;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .items-table th {
            background-color: var(--bg-light);
            color: var(--text-dark);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            padding: 12px 10px;
            border-top: 1px solid var(--border-color);
            border-bottom: 2px solid var(--border-color);
            text-align: left;
        }

        .items-table td {
            padding: 15px 10px;
            border-bottom: 1px solid var(--border-color);
            font-size: 14px;
            vertical-align: top;
        }

        .items-table th.text-right, .items-table td.text-right {
            text-align: right;
        }

        .items-table th.text-center, .items-table td.text-center {
            text-align: center;
        }

        .description-cell p {
            margin: 0 0 10px 0;
            font-weight: 600;
            color: var(--text-dark);
            white-space: pre-wrap;
        }

        .batch-badge {
            display: inline-block;
            background-color: #eff6ff;
            color: #1e40af;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid #bfdbfe;
        }

        .value-highlight {
            margin-top: 15px;
            font-size: 14px;
            color: var(--text-light);
        }

        .value-highlight strong {
            color: var(--text-dark);
            font-size: 15px;
        }

        /* Totals & Summary Row */
        .total-row td {
            font-weight: 700;
            background-color: var(--bg-light);
            border-top: 2px solid var(--border-color);
            border-bottom: 2px solid var(--border-color);
        }

        /* Logistics & Signatures Footer Grid */
        .footer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: auto;
        }

        .logistics-card, .signature-card {
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 15px;
            background-color: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 140px;
        }

        .logistics-list {
            list-style: none;
            padding: 0;
            margin: 0;
            font-size: 13px;
        }

        .logistics-list li {
            margin-bottom: 6px;
            color: var(--text-light);
        }

        .logistics-list strong {
            color: var(--text-dark);
            display: inline-block;
            width: 140px;
        }

        .signature-area {
            text-align: center;
            border-top: 1px dashed var(--border-color);
            padding-top: 10px;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-light);
        }

        @media print {
            .dc-host {
                background-color: #ffffff;
                padding: 0;
            }
            .challan-container {
                box-shadow: none;
                padding: 0;
            }
            .meta-item {
                background-color: #ffffff !important;
                print-color-adjust: exact;
            }
            .batch-badge {
                background-color: #ffffff !important;
                border: 1px solid #000000 !important;
            }
        }
`;

export const buildDeliveryChallanHtml = (data, profileInput, appDataInput) => {
  const profile = mergeCompanyProfile(profileInput);
  const appData = appDataInput || getDcAppData();
  const { lines, totalDrums, totalQty } = buildDcPrintLines(data, appData);

  const logoSrc = profile.logo && profile.logo.startsWith('data:image') ? profile.logo : '';
  const logoHtml = logoSrc ? `<img src="${logoSrc}" style="width: 50px; height: 50px; object-fit: contain;">` : '';

  const dcNo = esc(data.dcNo || 'N/A');
  const dcDate = esc(formatDcDateSlash(data.date) || 'N/A');
  const poNo = esc(data.partyDocNo || '');
  const poDate = esc(formatDcDateSlash(data.partyDocDate) || '');

  const shipState = esc(data.shipState || data.billState || data.state || profile.state || 'GUJARAT');
  const stateCode = esc(data.shipStateCode || data.billStateCode || data.stateCode || '24');
  
  const buyerGstin = esc(data.gstinShip || data.gstinBill || data.gstin || '');
  const sellerGstin = esc(profile.gstNumber || '');

  const partyName = esc(data.partyName || '');
  const partyAddress = esc(data.shipAddress || data.billAddress || data.address || '');

  // Format Items rows
  const itemsHtml = lines.map((line, idx) => {
    // If the text contains "BATCH", we can attempt to format it slightly, but safest is just rendering the text natively.
    // We'll wrap the raw text cleanly.
    return `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="description-cell">
            <p>${esc(line.text)}</p>
        </td>
        <td class="text-center" style="font-weight: 500;">${esc(line.drums)}</td>
        <td class="text-right" style="font-weight: 500;">${esc(line.qty)}</td>
      </tr>
    `;
  }).join('');

  return `
<style>${DC_STYLES}</style>
<div class="dc-host">
    <div class="challan-container">
        
        <!-- Top Header Layout -->
        <div class="header-section">
            <div class="company-logo-area">
                ${logoHtml}
                <div>
                    <h1>${esc(profile.companyName)}</h1>
                    <p class="company-address">
                        ${esc(profile.addressLine1 || '')}<br>
                        ${esc(profile.city || '')} ${esc(profile.pincode || '')}, ${esc(profile.state || '')}<br>
                        <strong>Email:</strong> ${esc(profile.email || '')}
                    </p>
                </div>
            </div>
            
            <div style="text-align: right;">
                <div class="document-title-badge">Delivery Challan</div>
                <div class="meta-details-grid">
                    <div class="meta-item" style="text-align: left;">
                        <span class="meta-label">Challan No.</span>
                        <span class="meta-value">${dcNo}</span>
                    </div>
                    <div class="meta-item" style="text-align: left;">
                        <span class="meta-label">Date</span>
                        <span class="meta-value">${dcDate}</span>
                    </div>
                    <div class="meta-item" style="text-align: left;">
                        <span class="meta-label">PO / DC No.</span>
                        <span class="meta-value">${poNo || '—'}</span>
                    </div>
                    <div class="meta-item" style="text-align: left;">
                        <span class="meta-label">PO Date</span>
                        <span class="meta-value">${poDate || '—'}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Client and Origin Details -->
        <div class="shipping-section">
            <div>
                <h3 class="section-title">To (Consignee)</h3>
                <div class="address-box">
                    <strong>${partyName}</strong>
                    ${partyAddress}
                </div>
            </div>
            <div>
                <h3 class="section-title">Tax Registration</h3>
                <div class="meta-details-grid" style="grid-template-columns: 1fr;">
                    <div class="meta-item">
                        <span class="meta-label">Seller GSTIN</span>
                        <span class="meta-value">${sellerGstin}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">State / State Code</span>
                        <span class="meta-value">${shipState} (Code: ${stateCode})</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Product Line Items Table -->
        <div class="items-table-wrapper">
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 8%;" class="text-center">Sr. No.</th>
                        <th style="width: 62%;">Description of Goods</th>
                        <th style="width: 15%;" class="text-center">Total Drums</th>
                        <th style="width: 15%;" class="text-right">Quantity (kg)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                    <!-- Total Summary Row -->
                    <tr class="total-row">
                        <td></td>
                        <td>TOTAL</td>
                        <td class="text-center">${totalDrums || 0}</td>
                        <td class="text-right">${fmtQty(totalQty)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Bottom Logistics & Signatures Grid -->
        <div class="footer-grid">
            <div class="logistics-card">
                <h3 class="section-title" style="margin-bottom: 10px;">Logistics & Transport Details</h3>
                <ul class="logistics-list">
                    <li><strong>Vehicle No:</strong> ${esc(data.vehicleNo || '—')}</li>
                    <li><strong>Driver's Name:</strong> ${esc(data.driverName || '—')}</li>
                    <li><strong>Driver's Contact:</strong> ${esc(data.driverContact || data.driverPhone || '—')}</li>
                    <li><strong>Transporter:</strong> ${esc(data.transporterName || data.transporter || '—')}</li>
                    <li style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 6px;">
                        <strong>Buyer GSTIN:</strong> ${buyerGstin || '—'}
                    </li>
                </ul>
            </div>
            
            <div class="logistics-card">
                <h3 class="section-title" style="margin-bottom: 10px;">For ${esc(profile.companyName)}</h3>
                <div></div> <!-- Spacer -->
                <div class="signature-area">
                    Authorized Signatory
                </div>
            </div>
        </div>

        <div class="footer-grid" style="margin-top: 15px;">
            <div class="logistics-card" style="min-height: 110px; grid-column: span 2;">
                <h3 class="section-title" style="margin-bottom: 10px;">Acknowledgment</h3>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; height: 100%;">
                    <span style="font-size: 13px; color: var(--text-light)">Received the above material in good condition.</span>
                    <div class="signature-area" style="min-width: 200px;">
                        Receiver's Signature & Stamp
                    </div>
                </div>
            </div>
        </div>

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
      width: 850
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
