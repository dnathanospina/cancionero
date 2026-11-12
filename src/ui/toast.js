import { h } from './dom.js';

let host;
/** Aviso breve en la parte inferior. `action` = { label, run }; timeout 0 = hasta que se cierre. */
export function toast(message, { action, timeout = 3500, variant = '' } = {}) {
  host ??= document.body.appendChild(h('div.toasts', { role: 'status', 'aria-live': 'polite' }));
  const el = h(`div.toast${variant ? '.' + variant : ''}`, h('span', message));
  if (action) {
    el.append(
      h('button.toast-action', { onclick: () => { action.run(); el.remove(); } }, action.label),
    );
  }
  host.append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}
