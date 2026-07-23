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

  // Revert CSS colors
  content = content.replace(
    /table\.items thead th\{[\s\S]*?\}/,
    `table.items thead th{
    background:var(--purple);
    color:#fff;
    font-weight:700;
    padding:8px 6px;
    text-align:center;
    border:1px solid var(--purple);
  }`
  );
  content = content.replace(
    /table\.items tbody td\{[\s\S]*?\}/,
    `table.items tbody td{
    border:1px solid var(--lav-border);
    padding:4px 6px;
    height:20px;
  }`
  );
  content = content.replace(
    /table\.items tfoot td\{[\s\S]*?\}/,
    `table.items tfoot td{
    border:1px solid var(--purple);
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
    border:none;
  }`
  );

  fs.writeFileSync(filePath, content);
  console.log('Reverted colors in', filename);
});
