import { state, currentSource, runSync, emitChange } from '../state.js';
import { verifyPin, makePinRecord, leaderConfigText, parseLeaderConfig } from './pin.js';
import { WRITE_TARGET } from '../config.js';
import { OfflineError, ConflictError } from '../sources/errors.js';

/**
 * Modo líder. Se recuerda en el dispositivo mientras la app está abierta
 * (sessionStorage): al cerrarla del todo hay que volver a poner el PIN.
 * Si el líder cambia el PIN, los demás dispositivos salen del modo líder al
 * actualizar.
 */
const SESSION_KEY = 'cancionero-lider';
const FAIL_KEY = 'cancionero-lider-fallos';
const MAX_FAILS = 5;
const LOCK_MS = 30_000;

const configFile = () => state.files.find((f) => f.section === 'config' && f.path === WRITE_TARGET.leaderFile);
export const leaderConfig = () => {
  const f = configFile();
  return f?.text ? parseLeaderConfig(f.text) : null;
};
export const hasPin = () => !!leaderConfig();

const fingerprint = (cfg) => (cfg?.pin?.hash ?? '').slice(0, 16);

function session(get, value) {
  try {
    if (get) return sessionStorage.getItem(SESSION_KEY);
    if (value == null) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    /* almacenamiento no disponible: el modo líder dura hasta recargar */
    memory = value;
  }
  return memory;
}
let memory = null;

export function isLeader() {
  const cfg = leaderConfig();
  const s = session(true) ?? memory;
  return !!cfg && !!s && s === fingerprint(cfg);
}

function fails() {
  try {
    return JSON.parse(sessionStorage.getItem(FAIL_KEY) || '{"n":0,"until":0}');
  } catch {
    return { n: 0, until: 0 };
  }
}
function setFails(v) {
  try {
    sessionStorage.setItem(FAIL_KEY, JSON.stringify(v));
  } catch {
    /* sin almacenamiento */
  }
}

/** Segundos que faltan para poder volver a intentarlo (tras varios fallos). */
export function lockedFor() {
  return Math.max(0, Math.ceil((fails().until - Date.now()) / 1000));
}

export async function enterLeader(pin) {
  if (lockedFor()) return { ok: false, locked: lockedFor() };
  const cfg = leaderConfig();
  if (!cfg) return { ok: false, reason: 'nopin' };
  if (await verifyPin(pin, cfg.pin)) {
    setFails({ n: 0, until: 0 });
    session(false, fingerprint(cfg));
    memory = fingerprint(cfg);
    emitChange('leader');
    return { ok: true };
  }
  const f = fails();
  f.n += 1;
  if (f.n >= MAX_FAILS) {
    f.n = 0;
    f.until = Date.now() + LOCK_MS;
  }
  setFails(f);
  return { ok: false, reason: 'wrong', locked: lockedFor() };
}

export function exitLeader() {
  session(false, null);
  memory = null;
  emitChange('leader');
}

function friendly(err) {
  if (err instanceof OfflineError) return 'Hace falta conexión a internet para guardar el PIN.';
  if (err instanceof ConflictError) return 'Otra persona ha cambiado el PIN mientras tanto. Actualiza e inténtalo de nuevo.';
  return 'No se pudo guardar el PIN: ' + (err.message || err);
}

/** Crea el PIN por primera vez (solo si todavía no existe). */
export async function createPin(pin) {
  try {
    const rec = await makePinRecord(pin);
    await currentSource().writeText(WRITE_TARGET.leaderFile, leaderConfigText(rec), { ifNoneMatch: '*' });
    await runSync({ quiet: true });
    return enterLeader(pin);
  } catch (err) {
    return { ok: false, message: friendly(err) };
  }
}

/** Cambia el PIN (pide el actual). */
export async function changePin(current, next) {
  const cfg = leaderConfig();
  if (!cfg || !(await verifyPin(current, cfg.pin))) return { ok: false, message: 'El PIN actual no es correcto.' };
  try {
    const rec = await makePinRecord(next);
    const { pin: _old, updatedAt: _u, ...rest } = cfg;
    await currentSource().writeText(WRITE_TARGET.leaderFile, leaderConfigText(rec, rest), { ifMatch: configFile()?.etag });
    await runSync({ quiet: true });
    session(false, null);
    return enterLeader(next);
  } catch (err) {
    return { ok: false, message: friendly(err) };
  }
}
