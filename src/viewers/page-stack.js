import { h } from '../ui/dom.js';

/**
 * Pila de páginas (PDF o imágenes) con zoom. Con zoom 1 cada página ocupa el
 * ancho disponible; con más zoom aparece desplazamiento horizontal.
 * Las páginas se dibujan solo cuando están cerca de la pantalla.
 *
 * pages: [{ aspect, draw(el, cssWidth) → Promise, release?(el) }]
 */
export function createPageStack(scroller, pages, { zoom = 1, onZoom } = {}) {
  const inner = h('div.pages');
  const items = pages.map((p, i) => {
    const el = h('div.page', { dataset: { page: i + 1 }, style: { aspectRatio: String(1 / p.aspect) } });
    inner.append(el);
    return { ...p, el, drawnWidth: 0, visible: false };
  });

  let z = zoom;
  const width = () => Math.max(200, (scroller.clientWidth - 2 * pad()) * z);
  const pad = () => (scroller.clientWidth > 700 ? 16 : 6);

  function layout() {
    inner.style.width = width() + 'px';
    refresh();
  }

  let timer;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = width();
      for (const it of items) {
        if (it.visible && Math.abs(it.drawnWidth - w) > 1) {
          it.drawnWidth = w;
          it.draw(it.el, w).catch((e) => console.warn(e));
        }
      }
    }, 60);
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const it = items.find((x) => x.el === e.target);
        if (!it) continue;
        it.visible = e.isIntersecting;
        if (!it.visible && it.drawnWidth && it.release) {
          it.release(it.el);
          it.drawnWidth = 0;
        }
      }
      refresh();
    },
    { root: scroller, rootMargin: '150% 0px' },
  );
  items.forEach((it) => io.observe(it.el));

  const ro = new ResizeObserver(() => layout());
  ro.observe(scroller);

  /** Cambia el zoom manteniendo el punto (px, py) de la pantalla en su sitio. */
  function setZoom(next, px = scroller.clientWidth / 2, py = scroller.clientHeight / 2) {
    next = Math.min(4, Math.max(0.5, Math.round(next * 100) / 100));
    if (next === z) return;
    const fx = (scroller.scrollLeft + px) / inner.offsetWidth;
    const fy = (scroller.scrollTop + py) / inner.offsetHeight;
    z = next;
    inner.style.width = width() + 'px';
    scroller.scrollLeft = fx * inner.offsetWidth - px;
    scroller.scrollTop = fy * inner.offsetHeight - py;
    refresh();
    onZoom?.(z);
  }

  // Pellizco con dos dedos: vista previa con transform y zoom real al soltar.
  let pinch = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onStart = (e) => {
    if (e.touches.length !== 2) return;
    const r = scroller.getBoundingClientRect();
    pinch = {
      d0: dist(e.touches),
      cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
      cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
      scale: 1,
    };
    inner.style.transformOrigin = `${scroller.scrollLeft + pinch.cx}px ${scroller.scrollTop + pinch.cy}px`;
  };
  const onMove = (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    pinch.scale = Math.min(4 / z, Math.max(0.5 / z, dist(e.touches) / pinch.d0));
    inner.style.transform = `scale(${pinch.scale})`;
  };
  const onEnd = () => {
    if (!pinch) return;
    const { scale, cx, cy } = pinch;
    pinch = null;
    inner.style.transform = '';
    setZoom(z * scale, cx, cy);
  };
  const stopGesture = (e) => e.preventDefault(); // Safari: evita el zoom de toda la página
  scroller.addEventListener('touchstart', onStart, { passive: true });
  scroller.addEventListener('touchmove', onMove, { passive: false });
  scroller.addEventListener('touchend', onEnd);
  scroller.addEventListener('touchcancel', onEnd);
  scroller.addEventListener('gesturestart', stopGesture);
  scroller.addEventListener('gesturechange', stopGesture);

  layout();

  return {
    el: inner,
    get zoom() {
      return z;
    },
    setZoom,
    get pinching() {
      return !!pinch;
    },
    destroy() {
      io.disconnect();
      ro.disconnect();
      clearTimeout(timer);
      scroller.removeEventListener('touchstart', onStart);
      scroller.removeEventListener('touchmove', onMove);
      scroller.removeEventListener('touchend', onEnd);
      scroller.removeEventListener('touchcancel', onEnd);
      scroller.removeEventListener('gesturestart', stopGesture);
      scroller.removeEventListener('gesturechange', stopGesture);
      for (const it of items) it.release?.(it.el);
      try {
        pages.dispose?.();
      } catch (e) {
        console.warn(e);
      }
    },
  };
}
