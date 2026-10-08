/**
 * Apply deep indigo/navy purple theme to the Uma Microns ERP
 * Replaces all instances of the old #9b62c4 medium-purple palette
 * with a deep indigo/navy palette matching the reference image.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'src', 'index.css');

let css = fs.readFileSync(FILE, 'utf-8');

// ── Color Mapping ──────────────────────────────────────────────
// Old color → New color (case-insensitive replacements)

const replacements = [
  // === Primary brand purple → Deep Indigo ===
  // Exact hex (most common)
  ['#9b62c4', '#2D1B69'],
  ['#8347ad', '#1E1250'],
  ['#b47be0', '#4A3585'],
  
  // === Lavender / light purple backgrounds → Indigo tints ===
  ['#F6F0FA', '#EEEAF5'],
  ['#f3e8ff', '#e8e0f5'],
  ['#faf5ff', '#f0ecf7'],
  ['#f8f2ff', '#ede8f5'],
  ['#faf7ff', '#efeaf7'],
  ['#f8f5fb', '#efeaf7'],
  ['#f3ecfb', '#ede8f5'],
  ['#faf8ff', '#f0ecf7'],
  
  // === Border purples → Indigo borders ===
  ['#e9d5ff', '#d1c4e9'],
  ['#d6c2e8', '#b8aad4'],
  ['#e4d5f2', '#cec0e0'],
  ['#b88ee0', '#5c4a8a'],
  ['#c4b5fd', '#b0a0d8'],
  ['#eadcf5', '#d9cfe8'],
  ['#eee8f5', '#ddd6ec'],
  ['#e8dff3', '#d5cce6'],
  ['#e7dff3', '#d5cce6'],
  ['#ece6f5', '#ddd6ec'],
  ['#d8c4ea', '#b8a5d3'],
  ['#c4b5d6', '#a89cc5'],
  
  // === Deeper purple accents → Deeper indigo ===
  ['#4c1d95', '#1a0f4f'],
  ['#6d28d9', '#3a1f8a'],
  ['#a78bfa', '#7c6bbc'],
  
  // === Dark text shades used with purple → Indigo darks ===
  ['#2d1b4e', '#1a0f3d'],
  ['#1f1630', '#110b24'],
  
  // === rgba(155, 98, 196, ...) → rgba(45, 27, 105, ...) ===
  // These need to be regex-based
];

// Apply simple string replacements (case-insensitive)
for (const [oldVal, newVal] of replacements) {
  const re = new RegExp(oldVal.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&'), 'gi');
  css = css.replace(re, newVal);
}

// Apply rgba replacements: rgba(155, 98, 196, ...) → rgba(45, 27, 105, ...)
css = css.replace(/rgba\(\s*155\s*,\s*98\s*,\s*196\s*,/g, 'rgba(45, 27, 105,');

// Apply rgba replacements: rgba(147, 51, 234, ...) → rgba(45, 27, 105, ...)
css = css.replace(/rgba\(\s*147\s*,\s*51\s*,\s*234\s*,/g, 'rgba(45, 27, 105,');

// Apply rgba replacements: rgba(196, 168, 220, ...) → rgba(135, 120, 175, ...)
css = css.replace(/rgba\(\s*196\s*,\s*168\s*,\s*220\s*,/g, 'rgba(135, 120, 175,');

// Green accent in sidebar (the brand subtitle color) stays as is

fs.writeFileSync(FILE, css, 'utf-8');

console.log('✅ Deep indigo theme applied to index.css');
console.log('   Old: #9b62c4 medium purple palette');
console.log('   New: #2D1B69 deep indigo/navy palette');
