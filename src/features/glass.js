/**
 * «Liquid glass»: el cristal esmerilado (backdrop-filter) se usa solo cuando
 * conviene. Se cambia por fondos sólidos equivalentes si:
 *  - el usuario tiene activado «Reducir transparencia»
 *  - el navegador no admite backdrop-filter
 *  - el dispositivo parece lento (poca memoria o pocos núcleos)
 * En Ajustes se puede forzar: 'auto' | 'on' | 'off'.
 *
 * Nota: Safari no informa de la memoria y limita el número de núcleos que
 * declara, así que en iPhone/iPad no se usa el criterio de núcleos (todos los
 * que ejecutan esta app manejan el cristal sin problema).
 */
const isApple = () => /iPad|iPhone|iPod|Macintosh|Mac OS X/.test(navigator.userAgent);

export function glassSupported() {
  const css = window.CSS?.supports;
  return !!css && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)'));
}

export function lowEndDevice() {
  const mem = navigator.deviceMemory;
  if (typeof mem === 'number' && mem <= 4) return true;
  const cores = navigator.hardwareConcurrency;
  return !isApple() && typeof cores === 'number' && cores <= 4;
}

const reducedTransparency = () => matchMedia('(prefers-reduced-transparency: reduce)').matches;

/** Decide si se usa cristal y lo refleja en <html class="glass|no-glass">. */
export function applyGlass(pref = 'auto') {
  const on =
    pref === 'on' ? glassSupported() : pref === 'off' ? false : glassSupported() && !reducedTransparency() && !lowEndDevice();
  const root = document.documentElement;
  root.classList.toggle('glass', on);
  root.classList.toggle('no-glass', !on);
  return on;
}

export function glassReason() {
  if (!glassSupported()) return 'Este navegador no admite el efecto cristal.';
  if (reducedTransparency()) return 'Desactivado porque tienes activado «Reducir transparencia».';
  if (lowEndDevice()) return 'Desactivado para que vaya fluido en este dispositivo.';
  return 'Activado.';
}
