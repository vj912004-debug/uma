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
  // regex to find {var.date} where var is alphanumeric
  const regex = /\{([a-zA-Z0-9_]+)\.date\}/g;
  
  // We need to be careful not to replace it inside input value={form.date}
  // The grep showed them mostly as >{var.date}< or >{var.date} or {var.date} -
  // We can do this: look for ">{" or " {"
  
  content = content.replace(/>\{([a-zA-Z0-9_]+)\.date\}/g, '>{formatDate($1.date)}');
  content = content.replace(/\s\{([a-zA-Z0-9_]+)\.date\}/g, ' {formatDate($1.date)}');
  content = content.replace(/\(\{([a-zA-Z0-9_]+)\.date\}\)/g, '({formatDate($1.date)})');

  // If we replaced something, ensure formatDate is imported
  if (content !== original) {
    if (!content.includes('import { formatDate }')) {
      content = `import { formatDate } from '../utils/dateUtils';\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
});
