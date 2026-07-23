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

  // Replace CSS: remove word-break and set font-size to 9px
  content = content.replace(
    /table\.items\{\s*width:100%;\s*table-layout:fixed;\s*word-break:break-word;/g,
    `table.items{
    width:100%;
    table-layout:fixed;`
  );
  content = content.replace(/font-size:9\.5px;/g, 'font-size:9px;');
  
  // Replace thead completely to include colgroup and remove inline widths from th
  const theadRegex = /<thead>[\s\S]*?<\/thead>/;
  const newThead = `<colgroup>
        <col style="width: 3%;">
        <col style="width: 26%;">
        <col style="width: 4%;">
        <col style="width: 7%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 12%;">
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2" style="text-align:center;">S.<br>No.</th>
          <th rowspan="2" style="text-align:center;">Description</th>
          <th rowspan="2" style="text-align:center;">Qty</th>
          <th rowspan="2" style="text-align:center;">Rate</th>
          <th rowspan="2" style="text-align:center;">Amount</th>
          <th colspan="2" style="text-align:center;">SGST</th>
          <th colspan="2" style="text-align:center;">CGST</th>
          <th colspan="2" style="text-align:center;">IGST</th>
          <th rowspan="2" style="text-align:center;">Total</th>
        </tr>
        <tr>
          <th style="text-align:center;">Rate</th>
          <th style="text-align:center;">Amount</th>
          <th style="text-align:center;">Rate</th>
          <th style="text-align:center;">Amount</th>
          <th style="text-align:center;">Rate</th>
          <th style="text-align:center;">Amount</th>
        </tr>
      </thead>`;
  content = content.replace(theadRegex, newThead);

  fs.writeFileSync(filePath, content);
  console.log('Fixed table colgroup and widths in', filename);
});
