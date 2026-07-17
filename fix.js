const fs = require('fs');
['src/utils/taxInvoiceHtml.js', 'src/utils/performaInvoiceHtml.js'].forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
  fs.writeFileSync(f, content);
});
