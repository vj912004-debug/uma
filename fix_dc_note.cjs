const fs = require('fs');
const path = require('path');

const filePath = 'd:/Uma/src/utils/debitCreditNoteHtml.js';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /const bodyRows = rows\.map\(\(r\) => \{[\s\S]*?<\/tr>`;\s*\}\)\.join\(''\);/;

const replStr = `const bodyRows = rows.map((r) => {
    const { desc, hsn } = extractDescAndHsn(r.label);
    const sgstAmt = isIgst ? 0 : r.sgstAmt;
    const cgstAmt = isIgst ? 0 : r.cgstAmt;
    const igstAmt = isIgst ? (r.sgstAmt + r.cgstAmt) : 0;
    const sgstRate = r.sgstRate || 0;
    const cgstRate = r.cgstRate || 0;
    const igstRate = sgstRate + cgstRate;
    
    return \`
      <tr>
        <td class="center">\${r.sr}</td>
        <td class="left">\${escHtml(desc)}</td>
        <td class="center">\${escHtml(hsn)}</td>
        <td class="num">\${fmtQty(r.qty)}</td>
        <td class="num">\${fmtMoney(r.rate)}</td>
        <td class="num">\${fmtMoney(r.amt)}</td>
        <td class="num">\${isIgst ? '-' : sgstRate}</td>
        <td class="num">\${isIgst ? '-' : fmtMoney(sgstAmt)}</td>
        <td class="num">\${isIgst ? '-' : cgstRate}</td>
        <td class="num">\${isIgst ? '-' : fmtMoney(cgstAmt)}</td>
        <td class="num">\${!isIgst ? '-' : igstRate}</td>
        <td class="num">\${!isIgst ? '-' : fmtMoney(igstAmt)}</td>
        <td class="num">\${fmtMoney(r.rowTotal)}</td>
      </tr>\`;
  }).join('');`;

if(regex.test(content)) {
  content = content.replace(regex, replStr);
  fs.writeFileSync(filePath, content);
  console.log('Modified debitCreditNoteHtml.js manually');
} else {
  console.log('Regex did not match!');
}
