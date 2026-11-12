import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openSheet, pinField } from '../ui/dialog.js';
import { state } from '../state.js';
import { isLeader, hasPin, enterLeader, createPin, changePin, lockedFor } from './leader.js';
import { validPin, PIN_MIN_LENGTH } from './pin.js';

const isDemo = () => state.settings.source === 'demo';

/** Pide el PIN si hace falta. Devuelve una promesa: true si queda en modo líder. */
export function requestLeader() {
  if (isLeader()) return Promise.resolve(true);
  return hasPin() ? enterPinSheet() : createPinSheet();
}

function enterPinSheet() {
  return new Promise((resolve) => {
    let ok = false;
    const msg = h('p.form-msg', { role: 'alert' });
    const submit = async (pin) => {
      if (!pin) return;
      const locked = lockedFor();
      if (locked) {
        msg.textContent = `Demasiados intentos. Espera ${locked} s.`;
        return;
      }
      field.input.disabled = true;
      msg.textContent = 'Comprobando…';
      msg.className = 'form-msg';
      const r = await enterLeader(pin);
      field.input.disabled = false;
      if (r.ok) {
        ok = true;
        s.close();
        toast('Modo líder activado');
        return;
      }
      field.clear();
      field.shake();
      msg.className = 'form-msg error';
      msg.textContent = r.locked ? `PIN incorrecto. Demasiados intentos: espera ${r.locked} s.` : 'PIN incorrecto.';
      field.focus();
    };
    const field = pinField({ length: PIN_MIN_LENGTH, autoSubmit: true, onComplete: submit, label: 'PIN de líder' });
    const s = openSheet({
      title: 'Modo líder',
      subtitle: 'Para crear y editar las listas de los eventos.',
      body: [
        field.el,
        msg,
        isDemo() ? h('p.demo-hint', icon('alert', { size: 16 }), 'Demostración: el PIN es 123456.') : null,
      ],
      footer: [h('button.btn.primary', { onclick: () => submit(field.value) }, 'Entrar')],
      onClose: () => resolve(ok),
    });
    field.focus(); // en el mismo toque: así iOS abre el teclado
  });
}

function twoPinForm({ withCurrent }) {
  const current = withCurrent ? pinField({ label: 'PIN actual' }) : null;
  const a = pinField({ label: `PIN nuevo (${PIN_MIN_LENGTH} dígitos o más)` });
  const b = pinField({ label: 'Repite el PIN nuevo' });
  const msg = h('p.form-msg', { role: 'alert' });
  const check = () => {
    if (!validPin(a.value)) return `El PIN debe tener al menos ${PIN_MIN_LENGTH} números.`;
    if (a.value !== b.value) return 'Los dos PIN nuevos no coinciden.';
    if (/^(\d)\1+$/.test(a.value) || '0123456789'.includes(a.value) || '9876543210'.includes(a.value)) {
      return 'Elige un PIN menos fácil de adivinar (no 111111 ni 123456).';
    }
    return '';
  };
  return { current, a, b, msg, check, fields: [current?.el, a.el, b.el, msg] };
}

const honestNote = () =>
  h(
    'p.honest',
    'El PIN evita que alguien edite las listas por error o sin permiso desde la app. No protege los archivos: con la contraseña de la cuenta compartida se pueden cambiar directamente en OneDrive.',
  );

function createPinSheet() {
  return new Promise((resolve) => {
    let ok = false;
    const f = twoPinForm({ withCurrent: false });
    const save = async () => {
      const err = f.check();
      if (err) {
        f.msg.className = 'form-msg error';
        f.msg.textContent = err;
        return;
      }
      f.msg.className = 'form-msg';
      f.msg.textContent = 'Guardando…';
      const r = await createPin(f.a.value);
      if (r.ok) {
        ok = true;
        s.close();
        toast('PIN creado. Modo líder activado');
      } else {
        f.msg.className = 'form-msg error';
        f.msg.textContent = r.message ?? 'No se pudo crear el PIN.';
      }
    };
    const s = openSheet({
      title: 'Crear PIN de líder',
      subtitle: 'Todavía no hay PIN. Créalo una vez y compártelo solo con quien vaya a preparar las listas.',
      body: [...f.fields, honestNote()],
      footer: [h('button.btn.primary', { onclick: save }, 'Crear PIN')],
      onClose: () => resolve(ok),
    });
    f.a.focus();
  });
}

export function changePinSheet() {
  return new Promise((resolve) => {
    let ok = false;
    const f = twoPinForm({ withCurrent: true });
    const save = async () => {
      const err = f.check();
      if (err) {
        f.msg.className = 'form-msg error';
        f.msg.textContent = err;
        return;
      }
      f.msg.className = 'form-msg';
      f.msg.textContent = 'Guardando…';
      const r = await changePin(f.current.value, f.a.value);
      if (r.ok) {
        ok = true;
        s.close();
        toast('PIN cambiado. Los demás dispositivos lo usarán al actualizar.');
      } else {
        f.msg.className = 'form-msg error';
        f.msg.textContent = r.message ?? 'No se pudo cambiar el PIN.';
      }
    };
    const s = openSheet({
      title: 'Cambiar PIN de líder',
      body: [...f.fields, honestNote()],
      footer: [h('button.btn.primary', { onclick: save }, 'Guardar PIN')],
      onClose: () => resolve(ok),
    });
    f.current.focus();
  });
}
