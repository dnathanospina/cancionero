// Genera los PNG de la PWA a partir de public/favicon.svg.
// Uso (solo hace falta si cambias el icono): node scripts/generate-icons.mjs
// Necesita Playwright con Chromium disponible en el sistema.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const svg = readFileSync('public/favicon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(file, size, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable: fondo completo y el dibujo dentro de la zona segura (80 %).
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#000;display:grid;place-items:center">
         <img src="data:image/svg+xml;base64,${Buffer.from(svg.replace('rx="112"', 'rx="0"')).toString('base64')}" style="width:${size * 0.8}px;height:${size * 0.8}px">
       </div>`
    : `<img src="data:image/svg+xml;base64,${Buffer.from(svg.replace(file.includes('apple') ? 'rx="112"' : '\0', 'rx="0"')).toString('base64')}" style="width:${size}px;height:${size}px;display:block">`;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: !maskable });
}

await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('icon-maskable-512.png', 512, { maskable: true });
await render('apple-touch-icon.png', 180);
await browser.close();
console.log('Iconos generados en public/icons/');
