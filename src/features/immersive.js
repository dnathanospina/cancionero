import { isIOS } from './install.js';

/**
 * Pantalla completa para leer partituras.
 * Android y escritorio: Fullscreen API real además de ocultar las barras.
 * iPhone: la Fullscreen API no existe en las PWA, así que solo se oculta la
 * interfaz de la app (la barra de estado del sistema sigue visible).
 * El estado se mantiene al pasar de una canción a otra.
 */
let on = false;
let real = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(on));

const canUseApi = () =>
  !isIOS() && document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';

export const isImmersive = () => on;

export function onImmersiveChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function enterImmersive() {
  on = true;
  if (canUseApi() && !document.fullscreenElement) {
    document.documentElement
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => (real = true))
      .catch(() => (real = false));
  }
  emit();
}

export function exitImmersive() {
  if (!on) return;
  on = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  real = false;
  emit();
}

// Si el sistema sale de pantalla completa (botón atrás, Esc), se vuelve a mostrar todo.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && real) {
    real = false;
    if (on) {
      on = false;
      emit();
    }
  }
});
