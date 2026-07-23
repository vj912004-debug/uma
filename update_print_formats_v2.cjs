const fs = require('fs');
const path = require('path');

const utilsDir = 'd:/Uma/src/utils';

const filesToModify = [
  'taxInvoiceHtml.js',
  'performaInvoiceHtml.js',
  'purchaseOrderHtml.js',
];

filesToModify.forEach(filename => {
  const filePath = path.join(utilsDir, filename);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update pushRow definition (remove HSN column)
  content = content.replace(
    /const pushRow = \(desc, qty, rate, amt, sgstPercent, cgstPercent, igstPercent = 0\) => \{[\s\S]*?(rows\.push\(`[\s\S]*?`\);\s*\n\s*\}\;)/,
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

    let cleanDesc = desc;
    const match = desc.match(/(.*?)\\(\\d+\\)$/);
    if (match) {
      cleanDesc = match[1].trim();
    }

    rows.push(\`
      <tr>
        <td class="center">\${sr++}</td>
        <td class="left">\${escHtml(cleanDesc)}</td>
        <td class="num">\${fmtQty(qty)}</td>
        <td class="num">\${rate ? escHtml(parseFloat(rate).toFixed(2)) : ''}</td>
        <td class="num">\${fmtMoney(amt)}</td>
        <td class="num">\${sgstPercent || ''}</td>
        <td class="num">\${fmtMoney(sgstAmt)}</td>
        <td class="num">\${cgstPercent || ''}</td>
        <td class="num">\${fmtMoney(cgstAmt)}</td>
        <td class="num">\${igstPercent || ''}</td>
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
        <td></td><td></td><td></td><td></td>
        <td class="num">0.00</td><td></td><td class="num">0.00</td>
        <td></td><td class="num">0.00</td><td></td><td class="num">0.00</td>
        <td class="num">0.00</td>
      </tr>`
  );

  // 3. Update total row
  content = content.replace(
    /rows\.push\(`\s*<tr class="total-row">[\s\S]*?<\/tr>`\);/,
    `rows.push(\`
    <tr class="total-row">
      <td colspan="2" class="center" style="text-align:center;">TOTAL</td>
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
          <th rowspan="2" style="width:4%; text-align:center;">S.<br>No.</th>
          <th rowspan="2" style="width:25%; text-align:center;">Description</th>
          <th rowspan="2" style="width:4%; text-align:center;">Qty</th>
          <th rowspan="2" style="width:7%; text-align:center;">Rate</th>
          <th rowspan="2" style="width:9%; text-align:center;">Amount</th>
          <th colspan="2" style="width:13%; text-align:center;">SGST</th>
          <th colspan="2" style="width:13%; text-align:center;">CGST</th>
          <th colspan="2" style="width:13%; text-align:center;">IGST</th>
          <th rowspan="2" style="width:12%; text-align:center;">Total</th>
        </tr>
        <tr>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
        </tr>
      </thead>`
  );

  // 5. Update tfoot (only exists in some)
  content = content.replace(
    /<tfoot>[\s\S]*?<\/tfoot>/,
    `<tfoot>
        <tr>
          <td colspan="2" style="text-align:center;">TOTAL</td>
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

  // 6. Update CSS
  content = content.replace(
    /table\.items thead th\{[\s\S]*?\}/,
    `table.items thead th{
    background:#b4c6e7;
    color:#000;
    font-weight:700;
    padding:8px 6px;
    text-align:center;
    border:1px solid #000;
  }`
  );
  content = content.replace(
    /table\.items tbody td\{[\s\S]*?\}/,
    `table.items tbody td{
    border:1px solid #000;
    padding:4px 6px;
    height:20px;
  }`
  );
  content = content.replace(
    /table\.items tfoot td\{[\s\S]*?\}/,
    `table.items tfoot td{
    border:1px solid #000;
    background:var(--lav-bg);
    font-weight:800;
    padding:8px 6px;
    color:var(--purple-dark);
  }`
  );
  content = content.replace(
    /table\.items\{[\s\S]*?\}/,
    `table.items{
    width:100%;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:10px;
    border:1px solid #000;
  }`
  );

  fs.writeFileSync(filePath, content);
  console.log('Modified', filename);
});

// Now handle debitCreditNoteHtml.js manually since it doesn't use pushRow
let dcPath = path.join(utilsDir, 'debitCreditNoteHtml.js');
if(fs.existsSync(dcPath)) {
    let dcContent = fs.readFileSync(dcPath, 'utf8');

    // thead
    dcContent = dcContent.replace(
        /<thead>[\s\S]*?<\/thead>/,
        `<thead>
        <tr>
          <th rowspan="2" style="width:4%; text-align:center;">S.<br>No.</th>
          <th rowspan="2" style="width:25%; text-align:center;">Description</th>
          <th rowspan="2" style="width:4%; text-align:center;">Qty</th>
          <th rowspan="2" style="width:7%; text-align:center;">Rate</th>
          <th rowspan="2" style="width:9%; text-align:center;">Amount</th>
          <th colspan="2" style="width:13%; text-align:center;">SGST</th>
          <th colspan="2" style="width:13%; text-align:center;">CGST</th>
          <th colspan="2" style="width:13%; text-align:center;">IGST</th>
          <th rowspan="2" style="width:12%; text-align:center;">Total</th>
        </tr>
        <tr>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
        </tr>
      </thead>`
    );

    // tfoot
    dcContent = dcContent.replace(
        /<tfoot>[\s\S]*?<\/tfoot>/,
        `<tfoot>
        <tr>
          <td colspan="2" style="text-align:center;">TOTAL</td>
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

    // filler
    dcContent = dcContent.replace(
        /<tr class="filler-row">[\s\S]*?<\/tr>/,
        `<tr class="filler-row">
        <td></td><td></td><td></td><td></td>
        <td class="num">0.00</td><td></td><td class="num">0.00</td>
        <td></td><td class="num">0.00</td><td></td><td class="num">0.00</td>
        <td class="num">0.00</td>
      </tr>`
    );

    // rows mapping
    const dcRowsRegex = /const bodyRows = rows\.map\(\(r\) => \{[\s\S]*?<\/tr>`;\s*\}\)\.join\(''\);/;
    const dcReplStr = `const bodyRows = rows.map((r) => {
    let desc = r.label;
    const match = r.label.match(/(.*?)\\s*\\(\\d+\\)$/);
    if (match) {
      desc = match[1].trim();
    }
    const sgstAmt = isIgst ? 0 : r.sgstAmt;
    const cgstAmt = isIgst ? 0 : r.cgstAmt;
    const igstAmt = isIgst ? (r.sgstAmt + r.cgstAmt) : 0;
    const sgstRate = r.sgstRate || 0;
    const cgstRate = r.cgstRate || 0;
    const igstRate = sgstRate + cgstRate;
    
    return \`
      <tr>
        <td class="center">\${r.sr}</td>
        <td class="left">\${escHtml(desc)}</td>
        <td class="num">\${fmtQty(r.qty)}</td>
        <td class="num">\${fmtMoney(r.rate)}</td>
        <td class="num">\${fmtMoney(r.amt)}</td>
        <td class="num">\${isIgst ? '' : sgstRate}</td>
        <td class="num">\${isIgst ? '0.00' : fmtMoney(sgstAmt)}</td>
        <td class="num">\${isIgst ? '' : cgstRate}</td>
        <td class="num">\${isIgst ? '0.00' : fmtMoney(cgstAmt)}</td>
        <td class="num">\${!isIgst ? '' : igstRate}</td>
        <td class="num">\${!isIgst ? '0.00' : fmtMoney(igstAmt)}</td>
        <td class="num">\${fmtMoney(r.rowTotal)}</td>
      </tr>\`;
  }).join('');`;

    dcContent = dcContent.replace(dcRowsRegex, dcReplStr);

    // css
    dcContent = dcContent.replace(
        /table\.items thead th\{[\s\S]*?\}/,
        `table.items thead th{
    background:#b4c6e7;
    color:#000;
    font-weight:700;
    padding:8px 6px;
    text-align:center;
    border:1px solid #000;
  }`
    );
    dcContent = dcContent.replace(
        /table\.items tbody td\{[\s\S]*?\}/,
        `table.items tbody td{
    border:1px solid #000;
    padding:4px 6px;
    height:20px;
  }`
    );
    dcContent = dcContent.replace(
        /table\.items tfoot td\{[\s\S]*?\}/,
        `table.items tfoot td{
    border:1px solid #000;
    background:var(--lav-bg);
    font-weight:800;
    padding:8px 6px;
    color:var(--purple-dark);
  }`
    );
    dcContent = dcContent.replace(
        /table\.items\{[\s\S]*?\}/,
        `table.items{
    width:100%;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:10px;
    border:1px solid #000;
  }`
    );

    fs.writeFileSync(dcPath, dcContent);
    console.log('Modified debitCreditNoteHtml.js');
}
