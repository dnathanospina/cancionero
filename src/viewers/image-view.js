import { h } from '../ui/dom.js';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagen no válida'));
    img.src = url;
  });
}

/** Prepara una o varias imágenes para createPageStack. */
export async function imagePages(blobs) {
  const urls = blobs.map((b) => URL.createObjectURL(b));
  const imgs = await Promise.all(urls.map(loadImage));
  const pages = imgs.map((img, i) => ({
    aspect: img.naturalHeight / img.naturalWidth || 1.414,
    async draw(el) {
      if (!el.firstChild) el.append(h('img', { src: urls[i], alt: `Página ${i + 1}`, draggable: 'false' }));
    },
  }));
  pages.dispose = () => urls.forEach((u) => URL.revokeObjectURL(u));
  return pages;
}
