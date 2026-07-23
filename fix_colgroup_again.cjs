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

  // Replace colgroup entirely to adjust percentages
  const colgroupRegex = /<colgroup>[\s\S]*?<\/colgroup>/;
  const newColgroup = `<colgroup>
        <col style="width: 3%;">
        <col style="width: 22%;">
        <col style="width: 8%;">
        <col style="width: 8%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 4%;">
        <col style="width: 9%;">
        <col style="width: 11%;">
      </colgroup>`;

  content = content.replace(colgroupRegex, newColgroup);
  fs.writeFileSync(filePath, content);
  console.log('Fixed colgroup percentages in', filename);
});
