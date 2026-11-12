import { h } from '../ui/dom.js';

/**
 * Visor página a página (PDF o imágenes):
 *  - deslizar a la izquierda/derecha cambia de página
 *  - al pasar de la última (o primera) página se llama a onEdge(+1 / −1)
 *  - el pellizco con dos dedos solo hace zoom: mientras haya dos dedos, o
 *    durante el resto de ese gesto, no se cambia de página
 *  - con zoom, la página se puede mover; solo cambia de página cuando el
 *    borde de la página ya está a la vista
 *
 * pages: [{ aspect, draw(el, cssWidth), release?(el) }] (ver pdf-view / image-view)
 */
export function createPager(viewport, pages, { zoom = 1, start = 0, onZoom, onChange, onEdge, edgeLabels = {} } = {}) {
  const n = pages.length;
  const track = h('div.pager-track');
  const slides = pages.map((p, i) => {
    const page = h('div.page', { dataset: { page: i + 1 }, style: { aspectRatio: String(1 / p.aspect) } });
    const slide = h('div.pager-slide', h('div.pager-inner', page));
    track.append(slide);
    return { ...p, slide, page, drawnWidth: 0 };
  });
  const indicator = h('div.pager-indicator', { 'aria-live': 'polite' });
  const hint = h('div.swipe-hint', { 'aria-hidden': 'true' });
  const root = h('div.pager', track, indicator, hint);
  viewport.classList.add('paged');
  viewport.append(root);

  let index = Math.max(0, Math.min(n - 1, start === 'last' ? n - 1 : start));
  let z = zoom;
  const W = () => viewport.clientWidth;
  const pad = () => (W() > 700 ? 16 : 6);
  const pageWidth = () => Math.max(160, (W() - 2 * pad()) * z);

  function setTransform(dx = 0, animate = false) {
    track.style.transition = animate ? 'transform 0.28s cubic-bezier(.2,.8,.2,1)' : 'none';
    track.style.transform = `translate3d(${-index * W() + dx}px,0,0)`;
  }

  function draw() {
    const w = pageWidth();
    slides.forEach((s, i) => {
      s.page.style.width = w + 'px';
      const near = Math.abs(i - index) <= 1;
      if (near && Math.abs(s.drawnWidth - w) > 1) {
        s.drawnWidth = w;
        s.draw(s.page, w).catch((e) => console.warn(e));
      } else if (!near && s.drawnWidth && s.release) {
        s.release(s.page);
        s.drawnWidth = 0;
      }
    });
  }

  function updateIndicator() {
    let text = `${index + 1} / ${n}`;
    if (index === n - 1 && edgeLabels.next) text += ` · Siguiente: ${edgeLabels.next}`;
    indicator.textContent = text;
    indicator.classList.toggle('single', n === 1 && !edgeLabels.next);
  }

  function go(i, { animate = true, toBottom = false } = {}) {
    index = Math.max(0, Math.min(n - 1, i));
    const s = slides[index].slide;
    s.scrollTop = toBottom ? s.scrollHeight : 0;
    setTransform(0, animate);
    draw();
    updateIndicator();
    onChange?.(index);
  }

  const cur = () => slides[index].slide;
  const canScrollDown = () => cur().scrollTop + cur().clientHeight < cur().scrollHeight - 4;
  const canScrollUp = () => cur().scrollTop > 2;

  // ---- Pista del borde (siguiente/anterior canción)
  function showHint(dir, strength) {
    const label = dir > 0 ? edgeLabels.next : edgeLabels.prev;
    if (!label || !strength) {
      hint.className = 'swipe-hint';
      return;
    }
    hint.textContent = dir > 0 ? `Siguiente: ${label} ›` : `‹ Anterior: ${label}`;
    hint.className = `swipe-hint ${dir > 0 ? 'right' : 'left'}${strength >= 1 ? ' ready' : ''}`;
    hint.style.opacity = String(Math.min(1, 0.35 + strength * 0.65));
  }

  // ---- Gestos táctiles
  let g = null; // gesto actual
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  function onStart(e) {
    if (e.touches.length === 2) {
      // Empieza un pellizco: se anula cualquier deslizamiento en curso.
      if (g?.mode === 'swipe') setTransform(0, true);
      const r = viewport.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const pr = slides[index].page.getBoundingClientRect();
      g = { mode: 'pinch', d0: dist(e.touches), scale: 1, cx: mx - r.left, cy: my - r.top };
      slides[index].page.style.transformOrigin = `${mx - pr.left}px ${my - pr.top}px`;
      showHint(0, 0);
      return;
    }
    if (e.touches.length === 1 && !g) {
      const t = e.touches[0];
      g = { mode: null, x: t.clientX, y: t.clientY, t: performance.now(), dx: 0 };
    }
  }

  function onMove(e) {
    if (!g) return;
    if (g.mode === 'pinch') {
      if (e.touches.length < 2) return;
      e.preventDefault();
      g.scale = Math.min(4 / z, Math.max(0.5 / z, dist(e.touches) / g.d0));
      slides[index].page.style.transform = `scale(${g.scale})`;
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      const s = cur();
      const maxLeft = s.scrollWidth - s.clientWidth;
      const atEdge = maxLeft <= 1 || (dx < 0 ? s.scrollLeft >= maxLeft - 1 : s.scrollLeft <= 1);
      g.mode = Math.abs(dx) > Math.abs(dy) * 1.2 && atEdge ? 'swipe' : 'native';
    }
    if (g.mode !== 'swipe') return;
    e.preventDefault();
    const beyond = (dx < 0 && index === n - 1) || (dx > 0 && index === 0);
    g.dx = beyond ? dx * 0.35 : dx;
    setTransform(g.dx);
    if (beyond) showHint(dx < 0 ? 1 : -1, Math.min(1, Math.abs(dx) / (W() * 0.25)));
  }

  function onEnd(e) {
    if (!g || e.touches.length) return;
    const gesture = g;
    g = null;
    if (gesture.mode === 'pinch') {
      slides[index].page.style.transform = '';
      setZoom(z * gesture.scale, gesture.cx, gesture.cy);
      return;
    }
    if (gesture.mode !== 'swipe') return;
    showHint(0, 0);
    const raw = gesture.dx;
    const fast = performance.now() - gesture.t < 300 && Math.abs(raw) > 40;
    const dir = raw < 0 ? 1 : -1;
    const target = index + dir;
    if (target >= 0 && target < n) {
      if (Math.abs(raw) > W() * 0.2 || fast) return go(target);
    } else if (Math.abs(raw) / 0.35 > W() * 0.25 && onEdge?.(dir)) {
      return;
    }
    setTransform(0, true);
  }

  function onCancel() {
    if (g?.mode === 'pinch') slides[index].page.style.transform = '';
    g = null;
    showHint(0, 0);
    setTransform(0, true);
  }

  const stopGesture = (e) => e.preventDefault(); // Safari: sin zoom de toda la página
  viewport.addEventListener('touchstart', onStart, { passive: true });
  viewport.addEventListener('touchmove', onMove, { passive: false });
  viewport.addEventListener('touchend', onEnd);
  viewport.addEventListener('touchcancel', onCancel);
  viewport.addEventListener('gesturestart', stopGesture);
  viewport.addEventListener('gesturechange', stopGesture);

  function setZoom(next, px = W() / 2, py = viewport.clientHeight / 2) {
    next = Math.min(4, Math.max(0.5, Math.round(next * 100) / 100));
    if (next === z) return;
    const s = cur();
    const inner = s.firstChild;
    const fx = (s.scrollLeft + px) / Math.max(1, inner.scrollWidth);
    const fy = (s.scrollTop + py) / Math.max(1, inner.scrollHeight);
    z = next;
    draw();
    s.scrollLeft = fx * inner.scrollWidth - px;
    s.scrollTop = fy * inner.scrollHeight - py;
    onZoom?.(z);
  }

  const ro = new ResizeObserver(() => {
    setTransform(0);
    draw();
  });
  ro.observe(viewport);

  go(index, { animate: false });

  return {
    get zoom() {
      return z;
    },
    get index() {
      return index;
    },
    get count() {
      return n;
    },
    setZoom,
    /** Pedal hacia delante: baja dentro de la página, luego página siguiente. false = no hay más. */
    forward() {
      if (canScrollDown()) {
        cur().scrollBy({ top: cur().clientHeight * 0.8, behavior: 'smooth' });
        return true;
      }
      if (index < n - 1) {
        go(index + 1);
        return true;
      }
      return false;
    },
    back() {
      if (canScrollUp()) {
        cur().scrollBy({ top: -cur().clientHeight * 0.8, behavior: 'smooth' });
        return true;
      }
      if (index > 0) {
        go(index - 1, { toBottom: true });
        return true;
      }
      return false;
    },
    get busy() {
      return !!g && g.mode !== 'native';
    },
    destroy() {
      ro.disconnect();
      viewport.removeEventListener('touchstart', onStart);
      viewport.removeEventListener('touchmove', onMove);
      viewport.removeEventListener('touchend', onEnd);
      viewport.removeEventListener('touchcancel', onCancel);
      viewport.removeEventListener('gesturestart', stopGesture);
      viewport.removeEventListener('gesturechange', stopGesture);
      viewport.classList.remove('paged');
      for (const s of slides) s.release?.(s.page);
      try {
        pages.dispose?.();
      } catch (e) {
        console.warn(e);
      }
      root.remove();
    },
  };
}
