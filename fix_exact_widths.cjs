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

  // Replace thead completely
  const theadRegex = /<thead>[\s\S]*?<\/thead>/;
  const newThead = `<thead>
        <tr>
          <th rowspan="2" style="width:3%; text-align:center;">S.<br>No.</th>
          <th rowspan="2" style="width:26%; text-align:center;">Description</th>
          <th rowspan="2" style="width:5%; text-align:center;">Qty</th>
          <th rowspan="2" style="width:7%; text-align:center;">Rate</th>
          <th rowspan="2" style="width:10%; text-align:center;">Amount</th>
          <th colspan="2" style="width:13%; text-align:center;">SGST</th>
          <th colspan="2" style="width:13%; text-align:center;">CGST</th>
          <th colspan="2" style="width:13%; text-align:center;">IGST</th>
          <th rowspan="2" style="width:10%; text-align:center;">Total</th>
        </tr>
        <tr>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
          <th style="width:4%; text-align:center;">Rate</th>
          <th style="width:9%; text-align:center;">Amount</th>
        </tr>
      </thead>`;
  content = content.replace(theadRegex, newThead);

  // Also replace td center in S.no body in case it's missed, make it num
  content = content.replace(/<td class="center">\$\{r\.sr\}<\/td>/g, '<td class="num">${r.sr}</td>');
  content = content.replace(/<td class="center">\$\{sr\+\+\}<\/td>/g, '<td class="num">${sr++}</td>');

  fs.writeFileSync(filePath, content);
  console.log('Fixed widths for exact match in', filename);
});
