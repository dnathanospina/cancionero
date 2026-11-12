import { h } from './dom.js';
import { icon } from './icons.js';

/**
 * Ventana modal: hoja inferior en el móvil y ventana centrada en tablet.
 * Devuelve { el, close }. Se cierra con Esc, con la X o tocando fuera.
 */
export function openSheet({ title, subtitle, body = [], footer = null, onClose, wide = false, label } = {}) {
  const prevFocus = document.activeElement;
  let closed = false;
  const close = (value) => {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    document.body.classList.remove('sheet-open');
    prevFocus?.focus?.({ preventScroll: true });
    onClose?.(value);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  const sheet = h(
    `div.sheet${wide ? '.wide' : ''}`,
    { role: 'dialog', 'aria-modal': 'true', 'aria-label': label || title },
    h('div.sheet-head', h('h2', title), h('button.icon-btn', { 'aria-label': 'Cerrar', onclick: () => close() }, icon('close'))),
    subtitle ? h('p.page-sub', subtitle) : null,
    h('div.sheet-body', body),
    footer ? h('div.sheet-footer', footer) : null,
  );
  const overlay = h('div.sheet-overlay', { onclick: (e) => e.target === overlay && close() }, sheet);
  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  document.body.classList.add('sheet-open');
  return { el: sheet, overlay, close };
}

/** Confirmación con botones grandes. Devuelve una promesa con true/false. */
export function confirmDialog({ title, text, confirm = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const s = openSheet({
      title,
      body: text ? [h('p.dialog-text', text)] : [],
      footer: [
        h('button.btn.ghost', { onclick: () => s.close() }, cancel),
        h(`button.btn${danger ? '.danger' : '.primary'}`, { onclick: () => ((result = true), s.close()) }, confirm),
      ],
      onClose: () => resolve(result),
    });
    s.el.querySelector('.sheet-footer .btn:last-child')?.focus();
  });
}

/** Elección entre varias opciones: [{ value, label, kind }] → promesa con value o null. */
export function choiceDialog({ title, text, options, body = [] }) {
  return new Promise((resolve) => {
    let result = null;
    const s = openSheet({
      title,
      body: [text ? h('p.dialog-text', text) : null, ...body],
      footer: options.map((o) =>
        h(`button.btn.${o.kind ?? 'ghost'}`, { onclick: () => ((result = o.value), s.close()) }, o.label),
      ),
      onClose: () => resolve(result),
    });
    s.el.classList.add('choices');
  });
}

/**
 * Campo de PIN numérico con puntos. `onComplete(pin)` se llama al llegar a
 * `length` dígitos (si autoSubmit).
 */
export function pinField({ length = 6, autoSubmit = false, onComplete, label = 'PIN' } = {}) {
  const dots = h('div.pin-dots', { 'aria-hidden': 'true' }, Array.from({ length }, () => h('span')));
  const input = h('input.pin-input', {
    type: 'password',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    autocomplete: 'off',
    maxlength: '12',
    'aria-label': label,
    oninput: () => {
      input.value = input.value.replace(/\D/g, '');
      paint();
      if (autoSubmit && input.value.length === length) onComplete?.(input.value);
    },
  });
  const paint = () => {
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i < input.value.length));
    wrap.classList.toggle('long', input.value.length > length);
  };
  const wrap = h('label.pin-field', h('span.pin-label', label), input, dots);
  return {
    el: wrap,
    input,
    get value() {
      return input.value;
    },
    clear() {
      input.value = '';
      paint();
    },
    shake() {
      wrap.classList.remove('shake');
      void wrap.offsetWidth;
      wrap.classList.add('shake');
    },
    focus: () => input.focus(),
  };
}
