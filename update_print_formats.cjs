const fs = require('fs');
const path = require('path');

const utilsDir = 'd:/Uma/src/utils';

const filesToModify = [
  'taxInvoiceHtml.js',
  'performaInvoiceHtml.js',
  'purchaseOrderHtml.js',
  'debitCreditNoteHtml.js'
];

filesToModify.forEach(filename => {
  const filePath = path.join(utilsDir, filename);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update pushRow definition
  content = content.replace(
    /const pushRow = \(desc, qty, rate, amt, sgstPercent, cgstPercent\) => \{[\s\S]*?(rows\.push\(`[\s\S]*?`\);\s*\n\s*\}\;)/,
    (match) => {
      let isPO = filename === 'purchaseOrderHtml.js';
      let igstLogic = isPO 
        ? "const igstAmt = 0; // Purchase orders in pdfExport default to 0 IGST for now, or calculate if out of state"
        : "const igstAmt = amt * (igstPercent / 100);";

      let headerFix = `const pushRow = (desc, qty, rate, amt, sgstPercent, cgstPercent, igstPercent = 0) => {
    const sgstAmt = amt * (sgstPercent / 100);
    const cgstAmt = amt * (cgstPercent / 100);
    ${igstLogic}
    const rowTotal = amt + sgstAmt + cgstAmt + igstAmt;
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalIgst += igstAmt;
    totalAll += rowTotal;
    totalQty += parseFloat(qty) || 0;

    // Extract HSN from description if present e.g. "Minimum Cleaning Charges(998842)"
    let hsn = '';
    let cleanDesc = desc;
    const match = desc.match(/(.*?)\\(\\d+\\)$/);
    if (match) {
      cleanDesc = match[1].trim();
      hsn = match[2];
    }

    rows.push(\`
      <tr>
        <td class="center">\${sr++}</td>
        <td class="left">\${escHtml(cleanDesc)}</td>
        <td class="center">\${escHtml(hsn)}</td>
        <td class="num">\${fmtQty(qty)}</td>
        <td class="num">\${rate ? escHtml(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="num">\${fmtMoney(amt)}</td>
        <td class="num">\${sgstPercent || 0}</td>
        <td class="num">\${fmtMoney(sgstAmt)}</td>
        <td class="num">\${cgstPercent || 0}</td>
        <td class="num">\${fmtMoney(cgstAmt)}</td>
        <td class="num">\${igstPercent || 0}</td>
        <td class="num">\${fmtMoney(igstAmt)}</td>
        <td class="num">\${fmtMoney(rowTotal)}</td>
      </tr>\`);
  };`;
      return headerFix;
    }
  );

  // 2. Update filler rows
  content = content.replace(
    /<tr class="filler-row">[\s\S]*?<\/tr>/,
    `<tr class="filler-row">
        <td></td><td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td>
      </tr>`
  );

  // 3. Update total row
  content = content.replace(
    /rows\.push\(`\s*<tr class="total-row">[\s\S]*?<\/tr>`\);/,
    `rows.push(\`
    <tr class="total-row">
      <td colspan="3" class="center" style="text-align:center;">TOTAL</td>
      <td class="num">\${fmtQty(totalQty) || '0.00'}</td>
      <td></td>
      <td class="num">\${fmtMoney(totalAmt)}</td>
      <td></td>
      <td class="num">\${fmtMoney(totalSgst)}</td>
      <td></td>
      <td class="num">\${fmtMoney(totalCgst)}</td>
      <td></td>
      <td class="num">\${fmtMoney(totalIgst)}</td>
      <td class="num">\${fmtMoney(totalAll)}</td>
    </tr>\`);`
  );

  // 4. Update thead
  content = content.replace(
    /<thead>[\s\S]*?<\/thead>/,
    `<thead>
        <tr>
          <th rowspan="2" style="width:4%; text-align:center;">Sr.<br>No.</th>
          <th rowspan="2" style="width:17%; text-align:center;">Description</th>
          <th rowspan="2" style="width:7%; text-align:center;">HSN /<br>SAC</th>
          <th rowspan="2" style="width:5%; text-align:center;">Qty.</th>
          <th rowspan="2" style="width:7%; text-align:center;">Rate<br>(&#8377;)</th>
          <th rowspan="2" style="width:8%; text-align:center;">Amount<br>(&#8377;)</th>
          <th colspan="2" style="width:14%; text-align:center;">SGST</th>
          <th colspan="2" style="width:14%; text-align:center;">CGST</th>
          <th colspan="2" style="width:14%; text-align:center;">IGST</th>
          <th rowspan="2" style="width:10%; text-align:center;">Total<br>Amount (&#8377;)</th>
        </tr>
        <tr>
          <th style="width:5%; text-align:center;">Rate %</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:5%; text-align:center;">Rate %</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:5%; text-align:center;">Rate %</th>
          <th style="width:9%; text-align:center;">Amount</th>
        </tr>
      </thead>`
  );

  // 5. Update tfoot (only exists in html table part)
  content = content.replace(
    /<tfoot>[\s\S]*?<\/tfoot>/,
    `<tfoot>
        <tr>
          <td colspan="3" style="text-align:center;">TOTAL</td>
          <td class="num">\${fmtQty(totalQty) || '0.00'}</td>
          <td></td>
          <td class="num">\${fmtMoney(totalAmt)}</td>
          <td></td>
          <td class="num">\${fmtMoney(totalSgst)}</td>
          <td></td>
          <td class="num">\${fmtMoney(totalCgst)}</td>
          <td></td>
          <td class="num">\${fmtMoney(totalIgst)}</td>
          <td class="num">\${fmtMoney(totalAll)}</td>
        </tr>
      </tfoot>`
  );

  fs.writeFileSync(filePath, content);
  console.log('Modified', filename);
});
