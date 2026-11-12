/**
 * Deslizar en horizontal sobre una canción de texto para pasar a la anterior o
 * siguiente de la lista. Para no interferir:
 *  - solo cuenta un gesto claramente horizontal y rápido de iniciar (una
 *    pulsación larga es selección de texto)
 *  - nunca con dos dedos, ni si hay texto seleccionado
 *  - nunca si empieza sobre algo que se desplaza en horizontal (tablas de ritmo)
 */
export function attachSongSwipe(el, { enabled = () => true, labels = {}, hint, moveEl, onSwipe }) {
  let g = null;
  const width = () => el.clientWidth;

  const hasSelection = () => {
    const s = window.getSelection?.();
    return s && !s.isCollapsed && String(s).trim().length > 0;
  };
  const insideHScroll = (target) => {
    for (let n = target; n && n !== el; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2 && getComputedStyle(n).overflowX !== 'visible') return true;
    }
    return false;
  };

  function showHint(dir, strength) {
    if (!hint) return;
    const label = dir > 0 ? labels.next : labels.prev;
    if (!label || strength <= 0) {
      hint.className = 'swipe-hint';
      hint.style.opacity = '';
      return;
    }
    hint.textContent = dir > 0 ? `Siguiente: ${label} ›` : `‹ Anterior: ${label}`;
    hint.className = `swipe-hint ${dir > 0 ? 'right' : 'left'}${strength >= 1 ? ' ready' : ''}`;
    hint.style.opacity = String(Math.min(1, 0.35 + strength * 0.65));
  }

  function reset(animate = true) {
    if (moveEl) {
      moveEl.style.transition = animate ? 'transform .2s ease-out, opacity .2s' : 'none';
      moveEl.style.transform = '';
      moveEl.style.opacity = '';
    }
    showHint(0, 0);
  }

  function onStart(e) {
    if (!enabled() || e.touches.length !== 1 || hasSelection() || insideHScroll(e.target)) {
      g = null;
      return;
    }
    const t = e.touches[0];
    g = { x: t.clientX, y: t.clientY, t: performance.now(), mode: null, dx: 0 };
  }

  function onMove(e) {
    if (!g) return;
    if (e.touches.length !== 1) {
      g = null;
      reset();
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      const quick = performance.now() - g.t < 400;
      g.mode = quick && Math.abs(dx) > Math.abs(dy) * 1.8 && !hasSelection() ? 'swipe' : 'native';
      if (g.mode === 'native') return;
    }
    if (g.mode !== 'swipe') return;
    e.preventDefault();
    g.dx = dx;
    const dir = dx < 0 ? 1 : -1;
    const available = dir > 0 ? labels.next : labels.prev;
    const strength = Math.abs(dx) / (width() * 0.28);
    if (moveEl) {
      moveEl.style.transition = 'none';
      moveEl.style.transform = `translateX(${dx * (available ? 0.35 : 0.12)}px)`;
      moveEl.style.opacity = available ? String(1 - Math.min(0.35, strength * 0.3)) : '';
    }
    showHint(dir, available ? strength : 0);
  }

  function onEnd() {
    if (!g) return;
    const gesture = g;
    g = null;
    if (gesture.mode !== 'swipe') return;
    const dir = gesture.dx < 0 ? 1 : -1;
    const fast = performance.now() - gesture.t < 350 && Math.abs(gesture.dx) > 60;
    if (Math.abs(gesture.dx) > width() * 0.28 || fast) {
      if (onSwipe(dir)) return;
    }
    reset();
  }

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onEnd);
  el.addEventListener('touchcancel', () => {
    g = null;
    reset();
  });
  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
  };
}
