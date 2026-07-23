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

  // Replace old widths in thead
  content = content.replace(
    /style="width:25%; text-align:center;">Description<\/th>/g,
    'style="width:32%; text-align:center;">Description</th>'
  );
  content = content.replace(
    /style="width:9%; text-align:center;">Amount<\/th>/g,
    'style="width:8%; text-align:center;">Amount</th>'
  );
  // Revert any previous "Amount" replacements first since I'm blindly replacing
  // Actually, let's just replace the whole thead
  content = content.replace(
    /<thead>[\s\S]*?<\/thead>/,
    `<thead>
        <tr>
          <th rowspan="2" style="width:4%; text-align:center;">S.<br>No.</th>
          <th rowspan="2" style="width:32%; text-align:center;">Description</th>
          <th rowspan="2" style="width:4%; text-align:center;">Qty</th>
          <th rowspan="2" style="width:7%; text-align:center;">Rate</th>
          <th rowspan="2" style="width:8%; text-align:center;">Amount</th>
          <th colspan="2" style="width:11%; text-align:center;">SGST</th>
          <th colspan="2" style="width:11%; text-align:center;">CGST</th>
          <th colspan="2" style="width:11%; text-align:center;">IGST</th>
          <th rowspan="2" style="width:12%; text-align:center;">Total</th>
        </tr>
        <tr>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:7%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:7%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:7%; text-align:center;">Amount</th>
        </tr>
      </thead>`
  );

  fs.writeFileSync(filePath, content);
  console.log('Modified column widths in', filename);
});
