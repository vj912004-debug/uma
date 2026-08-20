import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import { renderHtmlToPdf } from './printTheme';
import { applyPrintPrefsToHtml } from './printPrefs';
import { money } from './paymentFollowUpData';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const buildPaymentFollowUpStatementHtml = ({
  customer,
  invoices,
  asOnDate,
  profileInput
}) => {
  const profile = mergeCompanyProfile(profileInput);
  const rows = (invoices || []).map((inv, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(inv.invoiceNo)}</td>
      <td class="c">${esc(formatPdfDateDmy(inv.invoiceDate) || '')}</td>
      <td class="r">${money(inv.invoiceAmount)}</td>
      <td class="r">${money(inv.paidAmount)}</td>
      <td class="r">${money(inv.tdsAmount)}</td>
      <td class="r"><strong>${money(inv.outstanding)}</strong></td>
      <td class="c">${inv.ageDays ?? ''}</td>
    </tr>`).join('');

  const totalOutstanding = (invoices || []).reduce((s, i) => s + (parseFloat(i.outstanding) || 0), 0);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Payment Follow-Up Statement</title>
<style>
  *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;}
  html,body{margin:0;padding:0;background:#fff;color:#111;width:794px;}
  .page{width:794px;padding:28px 32px;box-sizing:border-box;}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #3d2b7d;padding-bottom:12px;margin-bottom:16px;}
  .brand h1{margin:0;color:#3d2b7d;font-size:22px;}
  .brand p{margin:4px 0 0;font-size:11px;color:#444;line-height:1.4;}
  .doc-title{text-align:right;}
  .doc-title h2{margin:0;color:#3d2b7d;font-size:16px;}
  .doc-title p{margin:4px 0 0;font-size:11px;}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:12px;}
  .box{border:1px solid #c9bce8;border-radius:6px;padding:10px 12px;background:#faf8ff;}
  .box strong{color:#3d2b7d;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#3d2b7d;color:#fff;padding:8px 6px;text-align:center;}
  td{border:1px solid #c9bce8;padding:7px 6px;}
  td.c,th.c{text-align:center;}
  td.r{text-align:right;}
  tfoot td{background:#efeaf7;font-weight:700;border:1px solid #3d2b7d;}
  .note{margin-top:14px;font-size:11px;color:#444;line-height:1.5;}
  .sign{margin-top:36px;display:flex;justify-content:flex-end;font-size:12px;}
  .sign .line{width:200px;text-align:center;border-top:1px solid #333;padding-top:6px;}
</style></head><body>
<div class="page pdf-page print-host">
  <div class="head">
    <div class="brand">
      <h1>${esc(profile.companyName || 'UMA MICRON')}</h1>
      <p>${esc(profile.addressLine1 || '')}<br>
      ${esc(profile.city || '')} - ${esc(profile.pincode || '')}, ${esc(profile.state || '')}<br>
      GSTIN: ${esc(profile.gstNumber || '')}<br>
      ${esc(profile.phone || '')} | ${esc(profile.email || '')}</p>
    </div>
    <div class="doc-title">
      <h2>PAYMENT FOLLOW-UP STATEMENT</h2>
      <p>As On: <strong>${esc(formatPdfDateDmy(asOnDate) || asOnDate)}</strong></p>
    </div>
  </div>

  <div class="meta">
    <div class="box">
      <div><strong>Customer</strong></div>
      <div style="margin-top:4px;font-weight:700;">${esc(customer?.partyName || '')}</div>
      <div style="margin-top:4px;">${esc(customer?.address || '')}</div>
      ${customer?.gstin ? `<div style="margin-top:4px;">GSTIN: ${esc(customer.gstin)}</div>` : ''}
    </div>
    <div class="box">
      <div><strong>Contact</strong></div>
      <div style="margin-top:4px;">Phone: ${esc(customer?.phone || '—')}</div>
      <div style="margin-top:4px;">Email: ${esc(customer?.email || '—')}</div>
      <div style="margin-top:8px;">Pending Invoices: <strong>${(invoices || []).length}</strong></div>
      <div>Total Outstanding: <strong>₹ ${money(totalOutstanding)}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:6%">No.</th>
        <th style="width:18%">Invoice No.</th>
        <th style="width:12%">Date</th>
        <th style="width:13%">Amount</th>
        <th style="width:12%">Paid</th>
        <th style="width:10%">TDS</th>
        <th style="width:15%">Outstanding</th>
        <th style="width:10%">Days</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="8" class="c">No outstanding invoices</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="6" class="r">GRAND TOTAL OUTSTANDING</td>
        <td class="r">₹ ${money(totalOutstanding)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <p class="note">
    Kindly arrange payment of the outstanding amount at the earliest. For any discrepancy,
    please contact us within 7 days of receipt of this statement.
  </p>

  <div class="sign">
    <div class="line">For ${esc(profile.companyName || 'UMA MICRON')}<br>Authorized Signatory</div>
  </div>
</div>
</body></html>`;
};

export const renderPaymentFollowUpStatementPdf = async ({
  customer,
  invoices,
  asOnDate,
  companyProfile,
  mode = 'save',
  printPrefs
}) => {
  const html = buildPaymentFollowUpStatementHtml({
    customer,
    invoices,
    asOnDate,
    profileInput: companyProfile
  });
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'Payment_FollowUp',
    docNo: (customer?.partyName || 'Statement').replace(/[^\w\-]+/g, '_').slice(0, 40),
    width: 794,
    fitPage: true,
    printPrefs
  });
  return applyPrintPrefsToHtml(html, printPrefs);
};
