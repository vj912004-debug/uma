import { mergeCompanyProfile } from './companyProfile';
import { formatPdfDateDmy } from './taxInvoiceLayout';
import {
  escHtml,
  buildPrintBrandHtml,
  buildFillerRowsHtml,
  renderHtmlToPdf
} from './printTheme';
import { applyPrintPrefsToHtml } from './printPrefs';
import { money } from './paymentFollowUpData';

export const buildPaymentFollowUpStatementHtml = ({
  customer,
  invoices,
  asOnDate,
  profileInput
}) => {
  const profile = mergeCompanyProfile(profileInput);
  const list = invoices || [];
  const asOn = formatPdfDateDmy(asOnDate) || asOnDate || '';
  const companyName = profile.companyName || 'UMA MICRON';

  const rows = list.map((inv, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="left">${escHtml(inv.invoiceNo)}</td>
      <td class="c">${escHtml(formatPdfDateDmy(inv.invoiceDate) || '')}</td>
      <td class="num">${money(inv.invoiceAmount)}</td>
      <td class="num">${money(inv.paidAmount)}</td>
      <td class="num">${money(inv.tdsAmount)}</td>
      <td class="num"><strong>${money(inv.outstanding)}</strong></td>
      <td class="c">${inv.ageDays ?? ''}</td>
    </tr>`).join('');

  const totalOutstanding = list.reduce((s, i) => s + (parseFloat(i.outstanding) || 0), 0);
  const fillerCount = Math.max(0, 34 - Math.max(list.length, 1));
  const fillerRowsHtml = fillerCount > 0 ? buildFillerRowsHtml(8, fillerCount) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UMA MICRON - Payment Follow-Up Statement</title>
<style>
  :root{
    --purple:#3d2b7d;
    --purple-dark:#2f2263;
    --lav-bg:#efeaf7;
    --lav-border:#c9bce8;
    --green:#2fa84f;
    --text:#231f20;
  }
  *{box-sizing:border-box;margin:0;padding:0;font-family:Cambria,Georgia,serif;}
  html,body{margin:0;padding:0;background:#fff;color:var(--text);}
  .page{
    width:794px;min-height:1123px;height:auto;padding:8px;margin:0;background:#fff;
    display:flex;flex-direction:column;box-sizing:border-box;overflow:visible;
  }
  .sheet{
    flex:1;border:2px solid var(--purple);padding:12px 14px 0;
    display:flex;flex-direction:column;box-sizing:border-box;min-height:1090px;
  }

  .header{
    display:flex;justify-content:space-between;align-items:center;gap:12px;
    margin:0 0 12px;padding:0 0 10px;
  }
  .brand{display:flex;align-items:center;gap:10px;min-width:0;}
  .logo{width:64px;height:64px;flex-shrink:0;}
  .logo img,.logo svg{width:100%;height:100%;object-fit:contain;display:block;}
  .brand-lockup{width:280px;height:70px;flex-shrink:0;display:flex;align-items:center;}
  .brand-lockup img{width:100%;height:100%;object-fit:contain;object-position:left center;display:block;}
  .brand-text h1{
    margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;
    letter-spacing:.5px;color:var(--purple);line-height:1;text-transform:uppercase;
  }
  .brand-text .tagline{
    color:var(--green);font-weight:700;font-size:13px;margin-top:2px;line-height:1.15;
  }
  .tax-invoice-box{
    background:var(--purple);color:#fff;text-align:center;padding:10px 20px;
    min-width:200px;min-height:64px;border-radius:6px;box-sizing:border-box;
    display:flex;flex-direction:column;justify-content:center;align-items:center;
  }
  .tax-invoice-box .ti-title{
    font-size:18px;font-weight:800;letter-spacing:.4px;margin:0;line-height:1.1;white-space:nowrap;
  }
  .tax-invoice-box .ti-sub{
    margin-top:5px;background:#fff;color:var(--purple);font-size:10px;font-weight:700;
    letter-spacing:.4px;padding:2px 8px;border-radius:3px;
  }

  .parties{display:flex;align-items:stretch;gap:12px;margin-bottom:12px;}
  .party{flex:1;border:1px solid var(--lav-border);display:flex;flex-direction:column;}
  .party-head{
    background:var(--lav-bg);color:var(--purple);font-weight:800;font-size:12px;
    letter-spacing:.4px;padding:7px 12px;border-bottom:1px solid var(--lav-border);
  }
  .party-body{
    padding:10px 12px;font-size:12px;line-height:1.45;flex:1;
  }
  .party-body .cname{color:var(--purple);font-weight:800;font-size:14px;margin:0 0 4px;}
  .party-body .addr{margin:0 0 8px;white-space:normal;}
  .party-body .frow{
    display:grid;grid-template-columns:7.4em 8px minmax(0,1fr);
    column-gap:8px;align-items:baseline;margin:0 0 4px;padding:0;
  }
  .party-body .frow:last-child{margin-bottom:0;}
  .party-body .flabel{
    font-weight:700;color:var(--text);white-space:nowrap;
  }
  .party-body .fcolon{font-weight:700;text-align:left;}
  .party-body .fval{
    min-width:0;white-space:nowrap;overflow:visible;font-weight:600;text-align:left;
  }

  .table-wrap{flex:0 0 auto;min-height:0;margin-bottom:8px;display:block;}
  table.items{
    width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;background:#fff;
    flex:0 0 auto;height:auto;
  }
  table.items thead th{
    background:var(--purple);color:#fff;font-weight:700;padding:5px 4px;
    text-align:center;vertical-align:middle;border:1px solid rgba(255,255,255,.55);
    line-height:1.2;font-size:11px;
  }
  table.items tbody td{
    border:1px solid var(--lav-border);padding:1px 4px;text-align:center;
    vertical-align:middle;background:#fff;color:var(--text);
    height:18px;min-height:18px;max-height:18px;font-weight:600;font-size:11px;line-height:1;
  }
  table.items tbody td.left{text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  table.items tbody td.num{text-align:right;}
  table.items tbody td.c{text-align:center;}
  table.items tbody tr.filler-row{height:18px;}
  table.items tbody tr.filler-row td{height:18px;min-height:18px;max-height:18px;padding:1px 4px;}
  table.items tfoot td{
    border:1px solid var(--purple);background:var(--lav-bg);font-weight:800;
    padding:3px 4px;color:var(--purple-dark);height:20px;font-size:11px;
  }
  table.items tfoot td.num{text-align:right;}
  table.items tfoot td.c{text-align:center;}

  .note{margin:0 0 12px;font-size:12px;color:var(--text);line-height:1.5;}
  .sign{display:flex;justify-content:flex-end;margin:8px 0 12px;}
  .sign .line{
    width:220px;text-align:center;border-top:1px solid #333;padding-top:6px;
    font-size:12px;color:var(--purple);font-weight:700;
  }
  .sign .line span{display:block;font-weight:600;color:var(--text);margin-top:2px;}

  .barfoot{
    background:var(--purple);color:#fff;margin:auto -14px 0 -14px;padding:8px 14px;
    display:flex;justify-content:space-between;align-items:center;
    font-size:12px;flex-shrink:0;
  }
</style>
</head>
<body>
  <div class="page pfu-page pdf-page print-host">
    <div class="sheet">
      <div class="header">
        <div class="brand">
          ${buildPrintBrandHtml(profile, {
            companyName,
            tagline: profile.tagline || "Micronization of API's"
          })}
        </div>
        <div class="tax-invoice-box">
          <div class="ti-title">PAYMENT FOLLOW-UP</div>
          <div class="ti-sub">STATEMENT</div>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <div class="party-head">CUSTOMER</div>
          <div class="party-body">
            <div class="cname">${escHtml(customer?.partyName || '')}</div>
            <div class="addr">${escHtml(customer?.address || '')}</div>
            ${customer?.gstin ? `<div class="frow"><span class="flabel">GSTIN</span><span class="fcolon">:</span><span class="fval">${escHtml(customer.gstin)}</span></div>` : ''}
          </div>
        </div>
        <div class="party">
          <div class="party-head">STATEMENT DETAILS</div>
          <div class="party-body">
            <div class="frow"><span class="flabel">As On</span><span class="fcolon">:</span><span class="fval">${escHtml(asOn)}</span></div>
            <div class="frow"><span class="flabel">Phone</span><span class="fcolon">:</span><span class="fval">${escHtml(customer?.phone || '—')}</span></div>
            <div class="frow"><span class="flabel">Email</span><span class="fcolon">:</span><span class="fval">${escHtml(customer?.email || '—')}</span></div>
            <div class="frow"><span class="flabel">Invoices</span><span class="fcolon">:</span><span class="fval">${list.length}</span></div>
            <div class="frow"><span class="flabel">Outstanding</span><span class="fcolon">:</span><span class="fval">₹ ${money(totalOutstanding)}</span></div>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="items">
          <thead>
            <tr>
              <th style="width:7%">No.</th>
              <th style="width:18%">Invoice No.</th>
              <th style="width:12%">Date</th>
              <th style="width:13%">Amount</th>
              <th style="width:12%">Paid</th>
              <th style="width:10%">TDS</th>
              <th style="width:16%">Outstanding</th>
              <th style="width:12%">Days</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="8" class="c">No outstanding invoices</td></tr>`}
            ${fillerRowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="6" class="num">GRAND TOTAL OUTSTANDING</td>
              <td class="num">₹ ${money(totalOutstanding)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p class="note">
        Kindly arrange payment of the outstanding amount at the earliest. For any discrepancy,
        please contact us within 7 days of receipt of this statement.
      </p>

      <div class="sign">
        <div class="line">For ${escHtml(companyName)}<span>Authorized Signatory</span></div>
      </div>

      <div class="barfoot">
        <span>Thank you for your business!</span>
        <span>E. &amp; O.E.</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const fillPfuBlankRows = (idoc, { singlePageHeight }) => {
  const page = idoc.querySelector('.pfu-page');
  const sheet = idoc.querySelector('.pfu-page .sheet');
  const tbody = idoc.querySelector('.pfu-page table.items tbody');
  const barfoot = idoc.querySelector('.pfu-page .barfoot');
  if (!page || !sheet || !tbody) return;

  const prevPageMin = page.style.minHeight;
  const prevSheetMin = sheet.style.minHeight;
  const prevBarMargin = barfoot ? barfoot.style.marginTop : '';
  page.style.minHeight = '0';
  page.style.height = 'auto';
  sheet.style.minHeight = '0';
  if (barfoot) barfoot.style.marginTop = '8px';

  const rowH = 18;
  let extra = Math.floor((singlePageHeight - page.scrollHeight) / rowH);
  extra = Math.max(0, Math.min(extra, 40));
  for (let i = 0; i < extra; i += 1) {
    const tr = idoc.createElement('tr');
    tr.className = 'filler-row';
    for (let c = 0; c < 8; c += 1) {
      const td = idoc.createElement('td');
      td.innerHTML = '&nbsp;';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  while (page.scrollHeight > singlePageHeight) {
    const last = tbody.querySelector('tr.filler-row:last-child');
    if (!last) break;
    last.remove();
  }

  page.style.minHeight = prevPageMin;
  page.style.height = '';
  sheet.style.minHeight = prevSheetMin;
  if (barfoot) barfoot.style.marginTop = prevBarMargin;
};

export const renderPaymentFollowUpStatementPdf = async ({
  customer,
  invoices,
  asOnDate,
  companyProfile,
  mode = 'save',
  printPrefs
}) => {
  const html = applyPrintPrefsToHtml(
    buildPaymentFollowUpStatementHtml({
      customer,
      invoices,
      asOnDate,
      profileInput: companyProfile
    }),
    printPrefs
  );
  await renderHtmlToPdf(html, {
    mode,
    filePrefix: 'Payment_FollowUp',
    docNo: (customer?.partyName || 'Statement').replace(/[^\w\-]+/g, '_').slice(0, 40),
    width: 794,
    fitPage: true,
    splitOverflowPages: true,
    printPrefs,
    prepareDoc: fillPfuBlankRows
  });
};
