const fs = require('fs');
['src/utils/taxInvoiceHtml.js', 'src/utils/performaInvoiceHtml.js', 'src/utils/deliveryChallanHtml.js', 'src/utils/packingListHtml.js', 'src/utils/bprHtml.js'].forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
    fs.writeFileSync(f, content);
  }
});
