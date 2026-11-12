/**
 * PIN del modo líder. Nunca se guarda el PIN: solo una «huella» PBKDF2-SHA256
 * con sal aleatoria y muchas iteraciones, en ajustes-lider.json (OneDrive).
 *
 * Límite honesto: quien pueda leer ese archivo puede probar los 1 000 000 de
 * PIN de 6 dígitos por fuerza bruta. Las iteraciones lo hacen lento (horas en
 * un ordenador normal), pero no imposible. Es un cerrojo contra cambios por
 * error o sin permiso, no una protección fuerte.
 */
export const PIN_ITERATIONS = 310_000;
export const PIN_MIN_LENGTH = 6;

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const validPin = (pin) => new RegExp(`^\\d{${PIN_MIN_LENGTH},12}$`).test(String(pin ?? ''));

export async function hashPin(pin, saltB64, iterations = PIN_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations }, key, 256);
  return b64(bits);
}

export async function makePinRecord(pin, iterations = PIN_ITERATIONS) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  return { algo: 'PBKDF2-SHA256', iterations, salt, hash: await hashPin(pin, salt, iterations) };
}

export async function verifyPin(pin, record) {
  if (!record?.hash || !record?.salt) return false;
  const h = await hashPin(pin, record.salt, record.iterations || PIN_ITERATIONS);
  // Comparación sin cortar al primer carácter distinto.
  let diff = h.length ^ record.hash.length;
  for (let i = 0; i < Math.min(h.length, record.hash.length); i++) diff |= h.charCodeAt(i) ^ record.hash.charCodeAt(i);
  return diff === 0;
}

/** Contenido del archivo ajustes-lider.json. */
export function leaderConfigText(pinRecord, extra = {}) {
  return JSON.stringify({ version: 1, ...extra, pin: pinRecord, updatedAt: new Date().toISOString() }, null, 2) + '\n';
}

export function parseLeaderConfig(text) {
  try {
    const c = JSON.parse(text);
    return c && c.pin?.hash ? c : null;
  } catch {
    return null;
  }
}
