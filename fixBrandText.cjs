const fs = require('fs');
const files = [
  'src/utils/taxInvoiceHtml.js',
  'src/utils/performaInvoiceHtml.js',
  'src/utils/purchaseOrderHtml.js',
  'src/utils/deliveryChallanHtml.js',
  'src/utils/debitCreditNoteHtml.js',
  'src/utils/packingListHtml.js',
  'src/utils/bprHtml.js'
];
for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace .brand-text h1 and .brand-text .tagline
  content = content.replace(/\.brand-text h1\{[\s\S]*?\}/, `.brand-text {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .brand-text h1{
    margin:0;
    font-family:'Times New Roman',Times,serif;
    font-size:46px;
    letter-spacing:1px;
    color:#123282;
    line-height:1;
  }`);
  
  content = content.replace(/\.brand-text \.tagline\{[\s\S]*?\}/, `.brand-text .tagline{
    color:#1d9444;
    font-family: Arial, Helvetica, sans-serif;
    font-weight:700;
    font-size:16px;
    margin-top:2px;
  }`);
  
  fs.writeFileSync(file, content);
}
console.log('Updated brand text styles');
