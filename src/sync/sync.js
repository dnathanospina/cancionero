import * as db from '../db.js';
import { classifyPath, isBinaryKind } from '../library/library.js';
import { decodeText } from '../util/text.js';
import { songMeta } from '../chordpro/song-doc.js';

/** Ejecuta `fn` sobre `items` con un máximo de `n` tareas a la vez. */
export async function pool(items, n, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

/**
 * Sincronización incremental con un origen (demostración u OneDrive):
 *  - texto (ChordPro, .txt, listas): se descarga siempre que cambia su eTag
 *  - PDF e imágenes: solo se guardan sus datos; el contenido se descarga bajo
 *    demanda o al preparar las listas próximas (ver prefetch)
 *  - lo que desaparece del origen se borra del dispositivo
 */
export async function syncFrom(source, { onProgress } = {}) {
  const remote = (await source.list())
    .map((r) => ({ ...r, info: classifyPath(r.path) }))
    .filter((r) => r.info);
  const local = (await db.getAllFiles()).filter((f) => f.origin === 'remote');
  const localByPath = new Map(local.map((f) => [f.path, f]));
  const remotePaths = new Set(remote.map((r) => r.path));

  const removed = local.filter((f) => f.source !== source.id || !remotePaths.has(f.path)).map((f) => f.path);
  const changed = remote.filter((r) => {
    const l = localByPath.get(r.path);
    return !l || l.source !== source.id || l.etag !== r.etag;
  });

  let done = 0;
  const added = changed.filter((r) => !localByPath.has(r.path)).length;
  const records = [];
  const staleBlobs = [];
  await pool(changed, 6, async (r) => {
    const { section, ext, kind } = r.info;
    const rec = { path: r.path, origin: 'remote', source: source.id, section, ext, kind, etag: r.etag, size: r.size ?? 0 };
    if (isBinaryKind(kind)) {
      if (localByPath.has(r.path)) staleBlobs.push(r.path);
    } else {
      const text = decodeText(await source.getBuffer(r.path));
      rec.text = text;
      if (kind === 'text') rec.meta = songMeta(text, ext);
    }
    records.push(rec);
    onProgress?.(++done, changed.length);
  });

  if (removed.length) await db.deleteFiles(removed);
  for (const p of staleBlobs) await db.deleteBlob(p);
  if (records.length) await db.putFiles(records);
  await db.kvSet('lastSync', { at: Date.now(), source: source.id });

  return { added, updated: changed.length - added, removed: removed.filter((p) => !remotePaths.has(p)).length };
}

/** Devuelve el contenido de un PDF o imagen, descargándolo si hace falta. */
export async function ensureBlob(source, path) {
  const cached = await db.getBlob(path);
  if (cached) return cached;
  if (!source || !navigator.onLine) return null;
  const buf = await source.getBuffer(path);
  const type = /\.pdf$/i.test(path) ? 'application/pdf' : /\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : /\.gif$/i.test(path) ? 'image/gif' : 'image/jpeg';
  const blob = new Blob([buf], { type });
  await db.putBlob(path, blob);
  return blob;
}

/** Descarga los PDF/imágenes de `songs` que aún no estén en el dispositivo. */
export async function prefetch(source, songs, { onProgress } = {}) {
  const have = await db.blobKeys();
  const paths = [...new Set(songs.filter((s) => s && s.origin === 'remote').flatMap((s) => s.paths))].filter(
    (p) => /\.(pdf|png|jpe?g|webp|gif)$/i.test(p) && !have.has(p),
  );
  let done = 0;
  await pool(paths, 3, async (p) => {
    try {
      await ensureBlob(source, p);
    } catch (e) {
      console.warn('prefetch', p, e);
    }
    onProgress?.(++done, paths.length);
  });
  return paths.length;
}
