import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { state, setInstallPrompt } from '../state.js';

const DISMISS_KEY = 'install-hint-dismissed';

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function dismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setInstallPrompt(e);
  });
  window.addEventListener('appinstalled', () => setInstallPrompt(null));
}

/** Aviso para instalar la app (Android: botón; iOS: instrucciones). */
export function installBanner() {
  if (isStandalone() || dismissed()) return null;
  const close = (el) => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sin almacenamiento: se volverá a mostrar */
    }
    el.remove();
  };
  if (state.installPrompt) {
    const el = h(
      'div.install',
      icon('download'),
      h('div', h('strong', 'Instala el cancionero'), h('p', 'Se abre como una app y funciona sin conexión.')),
      h('button.btn.primary.small', {
        onclick: async () => {
          state.installPrompt.prompt();
          await state.installPrompt.userChoice.catch(() => {});
          setInstallPrompt(null);
          el.remove();
        },
      }, 'Instalar'),
      h('button.icon-btn', { 'aria-label': 'Cerrar', onclick: () => close(el) }, icon('close', { size: 18 })),
    );
    return el;
  }
  if (isIOS()) {
    const el = h(
      'div.install',
      icon('share'),
      h('div', h('strong', 'Instálalo en tu iPhone o iPad'), h('p', 'En Safari pulsa Compartir y luego «Añadir a pantalla de inicio». Así funciona sin conexión y no se borran tus canciones.')),
      h('button.icon-btn', { 'aria-label': 'Cerrar', onclick: () => close(el) }, icon('close', { size: 18 })),
    );
    return el;
  }
  return null;
}
