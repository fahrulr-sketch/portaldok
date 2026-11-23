// Menyalin pustaka penampil (PDF.js dan SheetJS) ke public/vendor saat build.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { CATEGORIES } from '../api/_categories.js';

mkdirSync('public/vendor', { recursive: true });
const jobs = [
  ['node_modules/pdfjs-dist/legacy/build/pdf.min.mjs', 'public/vendor/pdf.min.mjs'],
  ['node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'public/vendor/pdf.worker.min.mjs'],
  ['node_modules/xlsx/dist/xlsx.full.min.js', 'public/vendor/xlsx.full.min.js'],
];
for (const [from, to] of jobs) {
  if (!existsSync(from)) {
    console.error('File tidak ditemukan: ' + from + ' (jalankan npm install terlebih dahulu)');
    process.exit(1);
  }
  copyFileSync(from, to);
}
writeFileSync('public/categories.js', 'window.PORTAL_CATEGORIES = ' + JSON.stringify(CATEGORIES) + ';\n');
console.log('Aset penampil disalin; categories.js dibuat.');
