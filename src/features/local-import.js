import * as db from '../db.js';
import { decodeText, splitPath, normalize } from '../util/text.js';
import { songMeta } from '../chordpro/song-doc.js';
import { reloadLibrary, state } from '../state.js';

const FOLDER = { voces: 'Voces', bateria: 'Bateria' };
const TEXT = /^(pro|chordpro|cho|chopro|crd|txt)$/;
const IMG = /^(jpe?g|png|webp|gif)$/;

/**
 * Importa archivos elegidos a mano a una sección, solo en este dispositivo.
 * No se filtra por extensión en el selector porque iOS deshabilita .pro/.cho;
 * aquí se descartan los formatos no admitidos.
 */
export async function importFiles(fileList, section, { confirmReplace } = {}) {
  const res = { added: 0, replaced: 0, skipped: [] };
  const existing = new Set(state.library.songs[section].map((s) => s.id));
  for (const file of fileList) {
    const { base, ext } = splitPath(file.name);
    const kind = TEXT.test(ext) ? 'text' : ext === 'pdf' ? 'pdf' : IMG.test(ext) ? 'image' : null;
    if (!kind) {
      res.skipped.push(file.name);
      continue;
    }
    const isDup = existing.has(normalize(base));
    if (isDup && confirmReplace && !(await confirmReplace(base))) {
      res.skipped.push(file.name);
      continue;
    }
    const path = `local/${FOLDER[section]}/${file.name}`;
    const rec = { path, origin: 'local', source: 'local', section, ext, kind, etag: String(file.lastModified), size: file.size };
    if (kind === 'text') {
      rec.text = decodeText(await file.arrayBuffer());
      rec.meta = songMeta(rec.text, ext);
    } else {
      await db.putBlob(path, file.slice(0, file.size, file.type || (kind === 'pdf' ? 'application/pdf' : 'image/jpeg')));
    }
    await db.putFiles([rec]);
    isDup ? res.replaced++ : res.added++;
  }
  await reloadLibrary();
  return res;
}

export async function removeLocalFile(path) {
  await db.deleteFiles([path]);
  await reloadLibrary();
}
