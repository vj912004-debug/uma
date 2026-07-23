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

  // Replace colgroup widths to give more space to Qty
  content = content.replace(
    /<col style="width: 26%;">\s*<col style="width: 4%;">/g,
    '<col style="width: 25%;">\n        <col style="width: 6%;">'
  );

  content = content.replace(
    /<col style="width: 12%;">/g,
    '<col style="width: 11%;">'
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed Qty column width in', filename);
});
