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

  // Replace table.items CSS completely
  const tableItemsCssRegex = /table\.items\{[\s\S]*?table\.items tfoot td\.num\{text-align:right;padding-right:10px;\}/;
  const newTableItemsCss = `table.items{
    width:100%;
    table-layout:fixed;
    word-break:break-word;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:11px;
    font-family: Calibri, Arial, sans-serif;
    color: #000;
  }
  table.items thead th{
    background:#b4c6e7;
    color:#000;
    font-weight:700;
    padding:6px 4px;
    text-align:center;
    vertical-align:middle;
    border:1px solid #000;
  }
  table.items tbody td{
    border:1px solid #000;
    padding:4px 6px;
    height:22px;
    vertical-align:middle;
  }
  table.items tbody td.num{text-align:right;padding-right:6px;}
  table.items tbody td.center{text-align:center;}
  table.items tbody td.left{text-align:left;padding-left:6px;}
  table.items tbody tr.filler-row td{height:22px;}
  table.items tfoot td{
    border:1px solid #000;
    background:#b4c6e7;
    font-weight:800;
    padding:6px 4px;
    color:#000;
  }
  table.items tfoot td.num{text-align:right;padding-right:6px;}`;

  content = content.replace(tableItemsCssRegex, newTableItemsCss);
  
  // Just in case the regex fails because of slightly different old CSS:
  if (!content.includes('background:#b4c6e7;')) {
     // fallback replacement
     content = content.replace(/table\.items\{[\s\S]*?\}/, `table.items{
    width:100%;
    table-layout:fixed;
    word-break:break-word;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:11px;
    font-family: Calibri, Arial, sans-serif;
    color: #000;
  }`);
     content = content.replace(/table\.items thead th\{[\s\S]*?\}/, `table.items thead th{
    background:#b4c6e7;
    color:#000;
    font-weight:700;
    padding:6px 4px;
    text-align:center;
    vertical-align:middle;
    border:1px solid #000;
  }`);
     content = content.replace(/table\.items tbody td\{[\s\S]*?\}/, `table.items tbody td{
    border:1px solid #000;
    padding:4px 6px;
    height:22px;
    vertical-align:middle;
  }`);
     content = content.replace(/table\.items tfoot td\{[\s\S]*?\}/, `table.items tfoot td{
    border:1px solid #000;
    background:#b4c6e7;
    font-weight:800;
    padding:6px 4px;
    color:#000;
  }`);
  }

  // Ensure tbody Qty is right aligned, S.No is right aligned.
  // Actually, the image has S.No as right aligned, and Qty right aligned or center. Let's make S.No num and Qty num.
  content = content.replace(/<td class="center">\$\{r\.sr\}<\/td>/g, '<td class="num">${r.sr}</td>');
  content = content.replace(/<td class="center">\$\{sr\+\+\}<\/td>/g, '<td class="num">${sr++}</td>');

  fs.writeFileSync(filePath, content);
  console.log('Fixed styling to exact match for', filename);
});
