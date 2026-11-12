import manifest from 'virtual:demo-manifest';
import { todayISO } from '../util/text.js';
import * as db from '../db.js';
import { ConflictError, OfflineError } from './errors.js';

/**
 * Origen «Demostración»: la misma estructura que la carpeta de OneDrive, pero
 * servida con la app (public/demo/Cancionero).
 *
 * Simula también la escritura de OneDrive para probar el modo líder: lo que se
 * guarda va a una «OneDrive simulada» en el dispositivo (IndexedDB), con su
 * propia versión (eTag) por archivo, comprobación de conflictos y sin conexión
 * cuando el dispositivo no tiene red. El resto de la app no distingue entre
 * esto y OneDrive.
 *
 * Las listas de ejemplo usan fechas relativas (@domingo, @domingo+7…) para que
 * siempre haya un «próximo evento».
 */
const ROOT = import.meta.env.BASE_URL + 'demo/Cancionero/';

function nextSunday(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7) + offsetDays);
  return todayISO(d);
}

const relDates = (text) =>
  text.replace(/@domingo([+-]\d+)?/g, (_m, off) => nextSunday(off ? parseInt(off, 10) : 0));

const isListish = (path) => path.startsWith('Listas/') || path === 'ajustes-lider.json';

/** eTag de un archivo de la app (cambia cada semana en las listas por las fechas relativas). */
const baseEtag = (f) => (isListish(f.path) ? `${f.etag}:${nextSunday()}` : f.etag);

const newEtag = () => 'demo-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

async function fetchBase(path) {
  const url = ROOT + path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${path} (${res.status})`);
  const buf = await res.arrayBuffer();
  if (!isListish(path)) return buf;
  return new TextEncoder().encode(relDates(new TextDecoder().decode(buf))).buffer;
}

/** Estado actual de un archivo en la «OneDrive simulada»: { etag } o null si no existe. */
async function current(path) {
  const o = await db.demoRemoteGet(path);
  if (o) return o.deleted ? null : { etag: o.etag, text: o.text };
  const f = manifest.find((m) => m.path === path);
  return f ? { etag: baseEtag(f) } : null;
}

function requireOnline() {
  if (!navigator.onLine) throw new OfflineError();
}

export const demoSource = {
  id: 'demo',
  label: 'Demostración',
  writable: true,

  async list() {
    const overlay = new Map((await db.demoRemoteAll()).map((o) => [o.path, o]));
    const out = [];
    for (const f of manifest) {
      const o = overlay.get(f.path);
      if (o?.deleted) continue;
      out.push({ path: f.path, size: f.size, etag: o ? o.etag : baseEtag(f) });
    }
    for (const o of overlay.values()) {
      if (!o.deleted && !manifest.some((f) => f.path === o.path)) out.push({ path: o.path, size: o.text.length, etag: o.etag });
    }
    return out;
  },

  async getBuffer(path) {
    const o = await db.demoRemoteGet(path);
    if (o && !o.deleted) return new TextEncoder().encode(o.text).buffer;
    return fetchBase(path);
  },

  /** Lee un archivo de texto con su versión actual, o null si no existe. */
  async readText(path) {
    requireOnline();
    const cur = await current(path);
    if (!cur) return null;
    const text = cur.text ?? new TextDecoder().decode(await fetchBase(path));
    return { text, etag: cur.etag };
  },

  /**
   * Escribe un archivo de texto.
   *  ifMatch: solo si su versión sigue siendo esa (si no, ConflictError)
   *  ifNoneMatch: '*' → solo si no existe todavía
   */
  async writeText(path, text, { ifMatch, ifNoneMatch } = {}) {
    requireOnline();
    const cur = await current(path);
    if (ifNoneMatch === '*' && cur) throw new ConflictError('exists', path);
    if (ifMatch && !cur) throw new ConflictError('deleted', path);
    if (ifMatch && cur.etag !== ifMatch) throw new ConflictError('changed', path);
    const etag = newEtag();
    await db.demoRemotePut({ path, text, etag, deleted: false, at: Date.now() });
    return { etag };
  },

  async remove(path, { ifMatch } = {}) {
    requireOnline();
    const cur = await current(path);
    if (!cur) return; // ya no existe: nada que hacer
    if (ifMatch && cur.etag !== ifMatch) throw new ConflictError('changed', path);
    await db.demoRemotePut({ path, text: '', etag: newEtag(), deleted: true, at: Date.now() });
  },

  // ---- Solo demostración
  /** Simula que otra persona cambia una lista (para probar los conflictos). */
  async simulateOtherEdit(path) {
    const cur = await this.readText(path);
    if (!cur) return false;
    const marker = 'notas: Cambiado por otra persona (prueba de conflicto)';
    const text = /^notas:.*$/m.test(cur.text) ? cur.text.replace(/^notas:.*$/m, marker) : cur.text.replace(/^(fecha:.*)$/m, `$1\n${marker}`);
    await db.demoRemotePut({ path, text, etag: newEtag(), deleted: false, at: Date.now() });
    return true;
  },
  /** Deja la demostración como venía (borra lo escrito en la OneDrive simulada). */
  async reset() {
    await db.demoRemoteClear();
  },
};
