// Genera las partituras de batería de la demostración (PDF e imágenes) a partir
// de HTML. Contenido propio; los himnos son de dominio público.
// Uso: node scripts/generate-demo-charts.mjs   (necesita Playwright + Chromium)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = 'public/demo/Cancionero/Bateria';

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: #fff; }
  .sheet { width: 794px; height: 1123px; padding: 56px 60px; page-break-after: always; position: relative; }
  .sheet:last-child { page-break-after: auto; }
  h1 { font-size: 34px; margin: 0; letter-spacing: -0.01em; }
  .sub { color: #555; margin: 6px 0 0; font-size: 16px; }
  .meta { display: flex; gap: 10px; margin: 18px 0 26px; }
  .meta span { border: 2px solid #111; border-radius: 40px; padding: 6px 16px; font-weight: 700; font-size: 16px; }
  h2 { font-size: 19px; margin: 26px 0 10px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 3px solid #DDA60D; display: inline-block; padding-bottom: 3px; }
  .road { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .road div { border: 2px solid #111; border-radius: 10px; padding: 10px 12px; font-size: 15px; min-height: 74px; }
  .road b { display: block; font-size: 17px; }
  .road i { color: #555; font-style: normal; font-size: 13px; }
  table.groove { border-collapse: collapse; margin: 4px 0 8px; }
  table.groove td, table.groove th { width: 34px; height: 34px; text-align: center; font-size: 20px; border: 1px solid #bbb; }
  table.groove th { font-size: 13px; color: #555; border: 0; height: 22px; }
  table.groove td.lbl { width: 70px; text-align: left; font-size: 14px; font-weight: 700; border: 0; padding-right: 8px; }
  table.groove td.beat { border-left: 2px solid #111; }
  .note { font-size: 15px; color: #333; margin: 6px 0 0; line-height: 1.5; }
  .foot { position: absolute; bottom: 40px; left: 60px; right: 60px; font-size: 12px; color: #777; display: flex; justify-content: space-between; }
`;

function groove(beats, sub, rows) {
  const n = beats * sub;
  const head = Array.from({ length: n }, (_, i) => `<th>${i % sub === 0 ? i / sub + 1 : sub === 2 ? '&' : ['', 'e', '&', 'a'][i % sub] || '·'}</th>`).join('');
  const body = rows
    .map(([lbl, pat]) => {
      const cells = [...pat.replace(/\s/g, '')].map((c, i) => `<td class="${i % sub === 0 ? 'beat' : ''}">${c === '.' ? '' : c === 'O' ? '<b>●</b>' : c === 'o' ? '●' : c === '>' ? '<b>✕</b>' : '✕'}</td>`).join('');
      return `<tr><td class="lbl">${lbl}</td>${cells}</tr>`;
    })
    .join('');
  return `<table class="groove"><tr><th></th>${head}</tr>${body}</table>`;
}

const santo = `
<div class="sheet">
  <h1>¡Santo! ¡Santo! ¡Santo!</h1>
  <p class="sub">Batería · himno solemne (Nicaea, J. B. Dykes)</p>
  <div class="meta"><span>♩ = 92</span><span>4/4</span><span>Tono: Re</span></div>
  <h2>Estructura</h2>
  <div class="road">
    <div><b>Intro</b><i>4 compases · solo platos (mazas)</i></div>
    <div><b>Estrofa 1</b><i>16 c. · ritmo A</i></div>
    <div><b>Estrofa 2</b><i>16 c. · piano solo, batería tacet</i></div>
    <div><b>Estrofa 5</b><i>16 c. · ritmo B, tutti</i></div>
  </div>
  <h2>Ritmo A · estrofas</h2>
  ${groove(4, 2, [['Ride', 'xx xx xx xx'], ['Aro', '.. o. .. o.'], ['Bombo', 'o. .. o. ..']])}
  <p class="note">Ride en la campana suave. Aro (cross-stick) en 2 y 4. Bombo ligero en 1 y 3.</p>
  <h2>Ritmo B · estrofa final</h2>
  ${groove(4, 2, [['Plato', 'x. x. x. x.'], ['Caja', '.. O. .. O.'], ['Bombo', 'o. .o o. ..']])}
  <p class="note">Platos abiertos, caja con fuerza. Mantener el tempo: no acelerar en «bendita Trinidad».</p>
  <div class="foot"><span>Cancionero Bethel · demostración</span><span>1 / 2</span></div>
</div>
<div class="sheet">
  <h1>¡Santo! ¡Santo! ¡Santo! <span style="font-weight:400;color:#777">(cont.)</span></h1>
  <h2>Rellenos</h2>
  ${groove(4, 4, [['Caja', '.... .... >>>> >>>>'], ['Tom 1', '.... .... .... ....'], ['Bombo', 'o... .... o... ....']])}
  <p class="note">Redoble de semicorcheas en los tiempos 3–4 del último compás de cada estrofa (solo antes de la estrofa 5).</p>
  <h2>Final</h2>
  <p class="note" style="font-size:18px">Ritardando en los dos últimos compases.<br>Último acorde: platos + bombo en el 1, dejar sonar.<br>Cortar con el director.</p>
  <h2>Dinámica</h2>
  <div class="road">
    <div><b>Estrofa 1</b><i>mp</i></div><div><b>Estrofa 2</b><i>tacet</i></div><div><b>Estrofa 5</b><i>f</i></div><div><b>Final</b><i>ff → rit.</i></div>
  </div>
  <div class="foot"><span>Cancionero Bethel · demostración</span><span>2 / 2</span></div>
</div>`;

const amazing = [
  `<div class="sheet">
    <h1>Amazing Grace</h1>
    <p class="sub">Batería · vals lento</p>
    <div class="meta"><span>♩ = 72</span><span>3/4</span><span>Tono: G</span></div>
    <h2>Estructura</h2>
    <div class="road">
      <div><b>Verse 1</b><i>16 c. · tacet</i></div>
      <div><b>Verse 2</b><i>16 c. · escobillas</i></div>
      <div><b>Verse 3</b><i>16 c. · vals A</i></div>
      <div><b>Verse 4</b><i>16 c. · vals B</i></div>
    </div>
    <h2>Vals A · escobillas</h2>
    ${groove(3, 2, [['Caja', 'x. xx xx'], ['Charles', '.. x. x.'], ['Bombo', 'o. .. ..']])}
    <p class="note">Barrido continuo con la escobilla izquierda. Charles con el pie en 2 y 3.</p>
    <div class="foot"><span>Cancionero Bethel · demostración</span><span>1 / 2</span></div>
  </div>`,
  `<div class="sheet">
    <h1>Amazing Grace <span style="font-weight:400;color:#777">(cont.)</span></h1>
    <h2>Vals B · baquetas</h2>
    ${groove(3, 2, [['Ride', 'x. x. x.'], ['Caja', '.. o. o.'], ['Bombo', 'o. .. ..']])}
    <p class="note">Entrar con platillo en «When we've been there».</p>
    <h2>Final</h2>
    <p class="note" style="font-size:18px">«Than when we'd first begun»: ritardando.<br>Redoble suave en platillo con mazas, dejar sonar.</p>
    <div class="foot"><span>Cancionero Bethel · demostración</span><span>2 / 2</span></div>
  </div>`,
];

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setContent(`<html><head><style>${css}</style></head><body>${santo}</body></html>`);
await page.pdf({ path: `${OUT}/Santo santo santo.pdf`, width: '794px', height: '1123px', printBackground: true });

mkdirSync(`${OUT}/Amazing Grace`, { recursive: true });
await page.setViewportSize({ width: 794, height: 1123 });
for (const [i, html] of amazing.entries()) {
  await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);
  await page.screenshot({ path: `${OUT}/Amazing Grace/${i + 1}.png` });
}
await browser.close();
console.log('Partituras de demostración generadas.');
