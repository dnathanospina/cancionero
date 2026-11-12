// Copia a public/pdfjs/ los recursos que pdf.js carga bajo demanda
// (fuentes estándar y decodificadores WebAssembly). Se ejecuta antes de dev/build.
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist');
const out = join(root, 'public', 'pdfjs');

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
cpSync(join(src, 'standard_fonts'), join(out, 'standard_fonts'), { recursive: true });
cpSync(join(src, 'wasm'), join(out, 'wasm'), {
  recursive: true,
  filter: (f) => !/quickjs/.test(f),
});
console.log('pdf.js: recursos copiados a public/pdfjs/');
