import * as db from '../db.js';
import { state, reloadLibrary, currentSource, runSync, emitChange } from '../state.js';
import { serializeList, parseList } from './format.js';
import { uniqueListPath } from './files.js';
import { ConflictError, OfflineError } from '../sources/errors.js';
import { WRITE_TARGET } from '../config.js';
import { splitPath } from '../util/text.js';

/**
 * Guardar y borrar listas del modo líder.
 *
 * Todo cambio se guarda primero en el dispositivo (bandeja de salida) y la
 * lista se ve al momento. Después se intenta subir: si no hay conexión queda
 * «pendiente» y se sube sola al recuperarla. Antes de escribir se comprueba
 * que el archivo sigue en la versión en la que se basó el cambio; si otra
 * persona lo cambió, queda en «conflicto» para que el líder decida.
 */

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const folder = () => WRITE_TARGET.listsFolder;

function takenPaths(exceptKey) {
  const paths = new Set(state.library.lists.map((l) => l.id));
  for (const e of state.outbox) if (e.key !== exceptKey && e.op === 'save') paths.add(e.path);
  return paths;
}

const fileEtag = (path) => state.files.find((f) => f.path === path)?.etag ?? null;

/**
 * Guarda una lista. `originalId` es el id (ruta) de la lista que se edita, o
 * null si es nueva. Devuelve la ruta con la que queda (su nuevo id).
 */
export async function saveList(list, originalId = null) {
  const text = serializeList(list);
  let entry = originalId ? state.outbox.find((e) => e.op === 'save' && e.path === originalId) : null;
  if (!entry) {
    entry = {
      key: newKey(),
      op: 'save',
      origPath: originalId,
      baseEtag: originalId ? fileEtag(originalId) : null,
    };
  }
  // Se conserva el nombre de archivo si no cambian ni el nombre ni la fecha
  // (respeta archivos creados a mano con otro criterio de nombres).
  const keepPath = originalId && (() => {
    const before = state.library.lists.find((l) => l.id === originalId);
    return before && before.name === list.name && before.date === list.date;
  })();
  entry.path = keepPath ? originalId : uniqueListPath(list, folder(), takenPaths(entry.key), originalId);
  Object.assign(entry, { text, status: 'pending', conflict: null, error: null, updatedAt: Date.now() });
  await db.outboxPut(entry);
  await refresh();
  flushOutbox();
  return entry.path;
}

/** Borra una lista (o descarta una lista nueva que aún no se había subido). */
export async function deleteList(listId) {
  const pending = state.outbox.find((e) => e.op === 'save' && e.path === listId);
  if (pending && !pending.origPath) {
    await db.outboxDelete(pending.key);
  } else {
    const origPath = pending ? pending.origPath : listId;
    const entry = {
      key: pending?.key ?? newKey(),
      op: 'delete',
      path: null,
      origPath,
      baseEtag: pending ? pending.baseEtag : fileEtag(listId),
      text: '',
      status: 'pending',
      updatedAt: Date.now(),
    };
    await db.outboxPut(entry);
  }
  await refresh();
  flushOutbox();
}

async function refresh() {
  state.outbox = await db.outboxAll();
  await reloadLibrary();
  emitChange('outbox');
}

let running = null;

/** Sube los cambios pendientes. Se puede llamar en cualquier momento. */
export function flushOutbox() {
  running ??= doFlush().finally(() => (running = null));
  return running;
}

async function doFlush() {
  const source = currentSource();
  const entries = (await db.outboxAll()).filter((e) => e.status === 'pending').sort((a, b) => a.updatedAt - b.updatedAt);
  if (!entries.length || !source.writable) return { uploaded: 0 };
  let uploaded = 0;
  for (const e of entries) {
    try {
      await upload(source, e);
      await db.outboxDelete(e.key);
      uploaded++;
    } catch (err) {
      if (err instanceof OfflineError) break;
      if (err instanceof ConflictError) {
        const remotePath = err.reason === 'exists' ? e.path : e.origPath;
        let remote = null;
        try {
          remote = await source.readText(remotePath);
        } catch {
          /* sin datos remotos: se resolverá igualmente */
        }
        e.status = 'conflict';
        e.conflict = { reason: err.reason, path: remotePath, text: remote?.text ?? null, etag: remote?.etag ?? null };
      } else {
        console.error(err);
        e.status = 'error';
        e.error = String(err.message || err);
      }
      await db.outboxPut(e);
    }
  }
  if (uploaded) await runSync({ quiet: true });
  await refresh();
  return { uploaded };
}

async function upload(source, e) {
  if (e.op === 'delete') {
    await source.remove(e.origPath, { ifMatch: e.baseEtag ?? undefined });
    return;
  }
  if (e.origPath && e.origPath !== e.path) {
    // Renombrar: comprobar que el original no cambió, crear el nuevo y borrar el viejo.
    const cur = await source.readText(e.origPath);
    if (!cur) throw new ConflictError('deleted', e.origPath);
    if (e.baseEtag && cur.etag !== e.baseEtag) throw new ConflictError('changed', e.origPath);
    await source.writeText(e.path, e.text, { ifNoneMatch: '*' });
    await source.remove(e.origPath, { ifMatch: cur.etag });
    return;
  }
  if (e.origPath) await source.writeText(e.path, e.text, { ifMatch: e.baseEtag ?? undefined });
  else await source.writeText(e.path, e.text, { ifNoneMatch: '*' });
}

/**
 * Resuelve un conflicto:
 *  'theirs' → descartar mis cambios y quedarse con la versión de la otra persona
 *  'mine'   → sobrescribir con mi versión
 *  'copy'   → guardar mi versión como una lista nueva (copia) y dejar la suya
 */
export async function resolveConflict(key, action) {
  const e = state.outbox.find((x) => x.key === key);
  if (!e) return null;
  let resultPath = e.conflict?.path ?? e.origPath ?? null;
  if (action === 'theirs') {
    await db.outboxDelete(key);
  } else if (action === 'mine') {
    const c = e.conflict ?? {};
    if (e.op === 'delete' || c.reason !== 'exists') {
      // Basarse en la versión actual del otro (o en «no existe» si la borró).
      e.baseEtag = c.etag;
      if (c.reason === 'deleted') e.origPath = null;
    } else {
      // Ya existe un archivo con ese nombre: se sobrescribe.
      e.origPath = e.path;
      e.baseEtag = c.etag;
    }
    Object.assign(e, { status: 'pending', conflict: null, updatedAt: Date.now() });
    await db.outboxPut(e);
    resultPath = e.path;
  } else if (action === 'copy' && e.op === 'save') {
    const list = parseList(e.text, splitPath(e.path).base);
    const copy = { ...list, name: `${list.name} (copia)` };
    // La lista original deja de estar afectada; la copia es nueva.
    Object.assign(e, {
      origPath: null,
      baseEtag: null,
      text: serializeList(copy),
      status: 'pending',
      conflict: null,
      updatedAt: Date.now(),
    });
    e.path = uniqueListPath(copy, folder(), takenPaths(e.key));
    await db.outboxPut(e);
    resultPath = e.path;
  }
  await refresh();
  await runSync({ quiet: true });
  await flushOutbox();
  return resultPath;
}

/** Vuelve a intentar un cambio que dio error. */
export async function retryEntry(key) {
  const e = state.outbox.find((x) => x.key === key);
  if (!e) return;
  Object.assign(e, { status: 'pending', error: null });
  await db.outboxPut(e);
  await refresh();
  return flushOutbox();
}

export const outboxFor = (listId) =>
  state.outbox.find((e) => (e.op === 'save' && e.path === listId) || (e.op === 'delete' && e.origPath === listId)) ?? null;
