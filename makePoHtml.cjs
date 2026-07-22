const fs = require('fs');

let content = fs.readFileSync('src/utils/performaInvoiceHtml.js', 'utf8');

// Replace identifiers and strings
content = content.replace(/buildPerformaInvoiceHtml/g, 'buildPurchaseOrderHtml');
content = content.replace(/renderPerformaInvoicePdf/g, 'renderPurchaseOrderPdf');
content = content.replace(/Performa Invoice/g, 'Purchase Order');
content = content.replace(/PERFORMA INVOICE/g, 'PURCHASE ORDER');

// Replace PI specific things
content = content.replace(/PI No\./g, 'PO No.');
content = content.replace(/PI Date/g, 'PO Date');

// Handle PO doc data mappings
content = content.replace(/data\.invoiceNo/g, 'data.poNo');
content = content.replace(/data\.partyDocNo/g, 'data.refNo'); // actually PO uses data.partyDocNo or refNo
content = content.replace(/data\.partyDocDate/g, 'data.refDate'); // and refDate

// Write the file
fs.writeFileSync('src/utils/purchaseOrderHtml.js', content);
console.log('Created src/utils/purchaseOrderHtml.js');
