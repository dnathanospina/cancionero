import { h } from './dom.js';

let host;
/** Aviso breve en la parte inferior. `action` = { label, run }. */
export function toast(message, { action, timeout = 3500 } = {}) {
  host ??= document.body.appendChild(h('div.toasts', { role: 'status', 'aria-live': 'polite' }));
  const el = h('div.toast', h('span', message));
  if (action) {
    el.append(
      h('button.toast-action', { onclick: () => { action.run(); el.remove(); } }, action.label),
    );
  }
  host.append(el);
  if (timeout) setTimeout(() => el.remove(), action ? timeout * 3 : timeout);
  return el;
}
