const fs = require('fs');
const path = require('path');

let hasMismatch = false;

function checkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory() && f !== 'node_modules' && f !== '.git') {
      checkDir(full);
    } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
      const code = fs.readFileSync(full, 'utf8');
      const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
          const target = path.resolve(dir, importPath);
          const dirOfTarget = path.dirname(target);
          if (fs.existsSync(dirOfTarget)) {
            const basename = path.basename(target);
            const actualFiles = fs.readdirSync(dirOfTarget);
            
            // Check if there is an exact case-sensitive match
            let exactMatch = false;
            for (const ext of ['', '.js', '.jsx']) {
                if (actualFiles.includes(basename + ext)) exactMatch = true;
            }
            if (!exactMatch) {
                // Try case-insensitive
                const lowerBasename = basename.toLowerCase();
                const matchedFile = actualFiles.find(af => af.toLowerCase() === lowerBasename || af.toLowerCase() === lowerBasename + '.js' || af.toLowerCase() === lowerBasename + '.jsx');
                if (matchedFile) {
                    console.log('Case mismatch in', full, ':', importPath, '-> actual is', matchedFile);
                    hasMismatch = true;
                }
            }
          }
        }
      }
    }
  }
}

checkDir(path.join(__dirname, 'src'));
if (!hasMismatch) console.log("No case mismatches found.");
