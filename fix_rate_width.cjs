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

  // Give Rate a bit more space, take from Total
  content = content.replace(
    /<col style="width: 7%;">/g,
    '<col style="width: 8%;">'
  );

  content = content.replace(
    /<col style="width: 11%;">/g,
    '<col style="width: 10%;">'
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed Rate and Total column widths in', filename);
});
