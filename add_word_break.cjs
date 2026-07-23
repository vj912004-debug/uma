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

  // Add word-break properties
  content = content.replace(
    /table\.items\{[\s\S]*?\}/,
    `table.items{
    width:100%;
    table-layout:fixed;
    word-break:break-word;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:10px;
    border:none;
  }`
  );

  fs.writeFileSync(filePath, content);
  console.log('Added word-break in', filename);
});
