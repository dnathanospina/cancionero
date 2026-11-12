import { h } from '../ui/dom.js';

const BASE = import.meta.env.BASE_URL;
let pdfjsPromise;

/** Carga pdf.js solo cuando se abre el primer PDF. */
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

// Safari limita el tamaño total de los canvas: se acota la resolución.
const MAX_CANVAS_PIXELS = 8_000_000;

/** Prepara las páginas de un PDF para createPageStack. */
export async function pdfPages(blob) {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    standardFontDataUrl: BASE + 'pdfjs/standard_fonts/',
    wasmUrl: BASE + 'pdfjs/wasm/',
  });
  const doc = await loadingTask.promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    let task = null;
    pages.push({
      aspect: vp.height / vp.width,
      async draw(el, cssWidth) {
        task?.cancel();
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        let scale = (cssWidth * dpr) / vp.width;
        const area = vp.width * vp.height * scale * scale;
        if (area > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / area);
        const viewport = page.getViewport({ scale });
        const canvas = h('canvas', { width: Math.floor(viewport.width), height: Math.floor(viewport.height) });
        task = page.render({ canvas, viewport });
        try {
          await task.promise;
        } catch (e) {
          if (e?.name === 'RenderingCancelledException') return;
          throw e;
        }
        el.replaceChildren(canvas);
      },
      release(el) {
        task?.cancel();
        const c = el.querySelector('canvas');
        if (c) {
          c.width = c.height = 0; // libera memoria en iOS
          c.remove();
        }
      },
    });
  }
  pages.dispose = () => loadingTask.destroy?.();
  return pages;
}
