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

  // Replace table.items CSS to include table-layout: fixed;
  content = content.replace(
    /table\.items\{[\s\S]*?\}/,
    `table.items{
    width:100%;
    table-layout:fixed;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:10px;
    border:none;
  }`
  );

  // Re-write thead completely with new widths
  const theadRegex = /<thead>[\s\S]*?<\/thead>/;
  const newThead = `<thead>
        <tr>
          <th rowspan="2" style="width:4%; text-align:center;">S.<br>No.</th>
          <th rowspan="2" style="width:35%; text-align:center;">Description</th>
          <th rowspan="2" style="width:4%; text-align:center;">Qty</th>
          <th rowspan="2" style="width:6%; text-align:center;">Rate</th>
          <th rowspan="2" style="width:7%; text-align:center;">Amount</th>
          <th colspan="2" style="width:11%; text-align:center;">SGST</th>
          <th colspan="2" style="width:11%; text-align:center;">CGST</th>
          <th colspan="2" style="width:11%; text-align:center;">IGST</th>
          <th rowspan="2" style="width:11%; text-align:center;">Total</th>
        </tr>
        <tr>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:7%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:7%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:7%; text-align:center;">Amount</th>
        </tr>
      </thead>`;
  content = content.replace(theadRegex, newThead);

  fs.writeFileSync(filePath, content);
  console.log('Fixed table layout and widths in', filename);
});
