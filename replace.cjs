const fs = require('fs');
const path = require('path');

const dir = 'd:/Uma/src/modules';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Replace setData(prev => ({ ...prev, xxx: prev.xxx.filter(x => x.id !== id) }))
  // with deleteItemSoftly('xxx', id)
  
  const regex = /setData\(\s*prev\s*=>\s*\(\{\s*\.\.\.prev,\s*([a-zA-Z0-9_]+)\s*:\s*prev\.[a-zA-Z0-9_]+\.filter\(\s*[a-zA-Z0-9_]+\s*=>\s*[a-zA-Z0-9_]+\.id\s*!==\s*([a-zA-Z0-9_]+)\s*\)\s*\}\)\s*\);?/g;
  
  content = content.replace(regex, (match, collection, idVar) => {
    return `deleteItemSoftly('${collection}', ${idVar});`;
  });

  // Specifically for UnderProcess.jsx which has nested filters in a weird way maybe
  
  // also look for materialReceipts: prev.materialReceipts.filter(mr => mr.id !== id) inside a multiline setData
  
  const regex2 = /([a-zA-Z0-9_]+)\s*:\s*prev\.[a-zA-Z0-9_]+\.filter\(\s*[a-zA-Z0-9_]+\s*=>\s*[a-zA-Z0-9_]+\.id\s*!==\s*([a-zA-Z0-9_]+)\s*\)/g;
  
  // But be careful with regex2 because it might be part of a bigger object.
  // Actually, replacing deleteDataSoftly with deleteItemSoftly was what I tried to do in powershell.
  content = content.replace(/deleteDataSoftly/g, 'deleteItemSoftly');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
});
