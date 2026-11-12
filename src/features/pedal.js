/**
 * Pedales Bluetooth: casi todos se comportan como un teclado. Se traduce cada
 * tecla a una acción según los ajustes.
 */
export const PEDAL_ACTIONS = {
  scrollDown: 'Bajar pantalla',
  scrollUp: 'Subir pantalla',
  nextSong: 'Canción siguiente',
  prevSong: 'Canción anterior',
  toggleScroll: 'Iniciar / pausar desplazamiento',
};

const KEY_LABEL = {
  ' ': 'Espacio', PageDown: 'AvPág', PageUp: 'RePág', ArrowDown: '↓', ArrowUp: '↑',
  ArrowLeft: '←', ArrowRight: '→', Enter: 'Intro', Escape: 'Esc', Backspace: 'Retroceso',
};
export const keyLabel = (k) => KEY_LABEL[k] ?? (k.length === 1 ? k.toUpperCase() : k);

export function actionForKey(mapping, key) {
  for (const [action, keys] of Object.entries(mapping)) if (keys.includes(key)) return action;
  return null;
}

/**
 * Escucha el teclado mientras se muestra una canción.
 * handlers: { scrollDown, scrollUp, nextSong, prevSong, toggleScroll }
 */
export function listenPedal(getMapping, handlers) {
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const action = actionForKey(getMapping(), e.key);
    if (!action || !handlers[action]) return;
    e.preventDefault();
    handlers[action](e);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
