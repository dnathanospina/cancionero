/**
 * Reordenar arrastrando por el asa (dedo o ratón). La fila sigue al dedo y
 * las demás se recolocan en vivo; cerca de los bordes de la pantalla se
 * desplaza sola. Al soltar llama a onReorder(desde, hasta).
 */
export function makeSortable(list, { handle = '.drag', onReorder }) {
  let drag = null;

  function onDown(e) {
    const hd = e.target.closest(handle);
    if (!hd || !list.contains(hd) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const item = hd.closest('li');
    if (!item) return;
    e.preventDefault();
    hd.setPointerCapture(e.pointerId);
    const items = [...list.children];
    drag = {
      item,
      handle: hd,
      id: e.pointerId,
      from: items.indexOf(item),
      startY: e.clientY,
      startTop: item.offsetTop,
      startScroll: window.scrollY,
      y: e.clientY,
      raf: 0,
    };
    item.classList.add('dragging');
    list.classList.add('sorting');
    navigator.vibrate?.(10);
    tick();
  }

  function position() {
    const { item, startY, startTop, startScroll, y } = drag;
    const pointerTop = startTop + (y - startY) + (window.scrollY - startScroll);
    // Recolocar según el centro de la fila arrastrada.
    const center = pointerTop + item.offsetHeight / 2;
    const others = [...list.children].filter((c) => c !== item);
    let before = null;
    for (const c of others) {
      if (center < c.offsetTop + c.offsetHeight / 2) {
        before = c;
        break;
      }
    }
    if (item.nextElementSibling !== before) list.insertBefore(item, before);
    item.style.transform = `translateY(${pointerTop - item.offsetTop}px)`;
  }

  function tick() {
    if (!drag) return;
    const edge = 70;
    const vh = window.innerHeight;
    if (drag.y > vh - edge - 70) window.scrollBy(0, Math.min(14, (drag.y - (vh - edge - 70)) / 4));
    else if (drag.y < edge + 60) window.scrollBy(0, -Math.min(14, (edge + 60 - drag.y) / 4));
    position();
    drag.raf = requestAnimationFrame(tick);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.y = e.clientY;
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    cancelAnimationFrame(drag.raf);
    const { item, from } = drag;
    drag = null;
    item.classList.remove('dragging');
    list.classList.remove('sorting');
    item.style.transform = '';
    const to = [...list.children].indexOf(item);
    if (to !== from) onReorder(from, to);
  }

  list.addEventListener('pointerdown', onDown);
  list.addEventListener('pointermove', onMove);
  list.addEventListener('pointerup', onUp);
  list.addEventListener('pointercancel', onUp);
  return () => {
    list.removeEventListener('pointerdown', onDown);
    list.removeEventListener('pointermove', onMove);
    list.removeEventListener('pointerup', onUp);
    list.removeEventListener('pointercancel', onUp);
  };
}
