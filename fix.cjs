const fs = require('fs');
const file = 'd:/Uma/src/utils/quotationPdf.js';
let content = fs.readFileSync(file, 'utf8');

const start = content.indexOf('<div class="fac-img">');
const end = content.indexOf('</div>', start) + 6;

const b = fs.readFileSync('d:/Uma/public/jet_mill.jpeg');
const b64 = 'data:image/jpeg;base64,' + b.toString('base64');

content = content.substring(0, start) + '<div class="fac-img">\n        <img src="' + b64 + '" style="width:100%;height:100%;object-fit:contain;background-color:#fff;" alt="Jet Mill" />\n      </div>' + content.substring(end);

fs.writeFileSync(file, content);
