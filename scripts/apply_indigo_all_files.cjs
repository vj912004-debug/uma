/**
 * Apply deep indigo theme to ALL source files (JSX, JS)
 * that contain hardcoded purple color references.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.resolve(__dirname, '..', 'src');

// Find all .jsx and .js files recursively
function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (/\.(jsx?|js)$/.test(entry.name)) results.push(full);
  }
  return results;
}

const files = walk(SRC);
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  const original = content;

  // Simple hex replacements (case-insensitive)
  const hexMap = [
    ['#9b62c4', '#2D1B69'],
    ['#8347ad', '#1E1250'],
    ['#b47be0', '#4A3585'],
    ['#F6F0FA', '#EEEAF5'],
    ['#f3e8ff', '#e8e0f5'],
    ['#faf5ff', '#f0ecf7'],
    ['#f8f2ff', '#ede8f5'],
    ['#faf7ff', '#efeaf7'],
    ['#f8f5fb', '#efeaf7'],
    ['#e9d5ff', '#d1c4e9'],
    ['#d6c2e8', '#b8aad4'],
    ['#e4d5f2', '#cec0e0'],
    ['#b88ee0', '#5c4a8a'],
    ['#eadcf5', '#d9cfe8'],
    ['#eee8f5', '#ddd6ec'],
    ['#e8dff3', '#d5cce6'],
    ['#c4b5fd', '#b0a0d8'],
    ['#4c1d95', '#1a0f4f'],
    ['#6d28d9', '#3a1f8a'],
    ['#a78bfa', '#7c6bbc'],
    ['#2d1b4e', '#1a0f3d'],
    ['#1f1630', '#110b24'],
  ];

  for (const [old, nw] of hexMap) {
    const re = new RegExp(old.replace(/[#]/g, '\\$&'), 'gi');
    content = content.replace(re, nw);
  }

  // rgba replacements
  content = content.replace(/rgba\(\s*155\s*,\s*98\s*,\s*196\s*,/g, 'rgba(45, 27, 105,');
  content = content.replace(/rgba\(\s*147\s*,\s*51\s*,\s*234\s*,/g, 'rgba(45, 27, 105,');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    totalChanges++;
    console.log(`  ✓ ${path.relative(SRC, file)}`);
  }
}

console.log(`\n✅ Updated ${totalChanges} files with deep indigo theme`);
