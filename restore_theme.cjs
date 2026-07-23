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

  const cssRegex = /table\.items\{\s*width:100%;\s*table-layout:fixed;\s*border-collapse:collapse;[\s\S]*?table\.items tfoot td\.num\{text-align:right;padding-right:3px;\}/;

  const newCss = `table.items{
    width:100%;
    table-layout:fixed;
    border-collapse:collapse;
    margin-bottom:14px;
    font-size:9px;
    color: var(--text);
  }
  table.items thead th{
    background:var(--purple);
    color:#fff;
    font-weight:700;
    padding:3px 2px;
    text-align:center;
    vertical-align:middle;
    border:1px solid var(--purple);
  }
  table.items tbody td{
    border:1px solid var(--lav-border);
    padding:3px 3px;
    height:18px;
    vertical-align:middle;
  }
  table.items tbody td.num{text-align:right;padding-right:3px;}
  table.items tbody td.center{text-align:center;}
  table.items tbody td.left{text-align:left;padding-left:3px;}
  table.items tbody tr.filler-row td{height:18px;}
  table.items tfoot td{
    border:1px solid var(--purple);
    background:var(--lav-bg);
    font-weight:800;
    padding:3px 2px;
    color:var(--purple-dark);
  }
  table.items tfoot td.num{text-align:right;padding-right:3px;}`;

  content = content.replace(cssRegex, newCss);
  fs.writeFileSync(filePath, content);
  console.log('Restored print theme colors for', filename);
});
