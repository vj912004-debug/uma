import fs from 'fs';
import path from 'path';

const dir = 'd:/Uma/src/modules';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Replace {obj.date} inside JSX text nodes (e.g., >{obj.date} or {obj.date} )
  // We look for patterns like >{xxx.date} or \s{xxx.date}
  // Let's just do a blanket replace for table cells and spans
  // regex to find {var.dateField} where var is alphanumeric
  const dateFields = 'date|partyDocDate|ewayBillDate|startDate|endDate|bprDate|dispatchDate|invoiceDate|paymentDate|createdAt|updatedAt|deletedAt|timestamp';
  const regex1 = new RegExp(`>\\{([a-zA-Z0-9_]+)\\.(${dateFields})\\}`, 'g');
  const regex2 = new RegExp(`\\s\\{([a-zA-Z0-9_]+)\\.(${dateFields})\\}`, 'g');
  const regex3 = new RegExp(`\\(\\{([a-zA-Z0-9_]+)\\.(${dateFields})\\}\\)`, 'g');
  
  content = content.replace(regex1, '>{formatDate($1.$2)}');
  content = content.replace(regex2, ' {formatDate($1.$2)}');
  content = content.replace(regex3, '({formatDate($1.$2)})');

  // If we replaced something, ensure formatDate is imported
  if (content !== original) {
    if (!content.includes('import { formatDate }')) {
      content = `import { formatDate } from '../utils/dateUtils';\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
});
