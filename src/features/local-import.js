import * as db from '../db.js';
import { decodeText, splitPath, normalize } from '../util/text.js';
import { songMeta } from '../chordpro/song-doc.js';
import { splitSongs, safeName } from '../chordpro/split.js';
import { reloadLibrary, state } from '../state.js';
import { sectionOfFolder } from '../library/library.js';

/**
 * Importar canciones solo en este dispositivo (nunca se suben ni van al
 * repositorio). Pensado para archivos exportados de SongBook:
 *  - .cho .chopro .chordpro .pro .crd .txt, PDF e imágenes
 *  - varios archivos a la vez, o un .zip (por ejemplo una carpeta de OneDrive
 *    descargada como .zip): sus subcarpetas se convierten en categorías y, si
 *    tiene carpetas «Voces» y «Batería», se respetan
 *  - archivos con varias canciones separadas por {new_song}
 * En iOS el selector no se filtra por extensión (deshabilitaría .pro/.cho).
 */
const FOLDER = { voces: 'Voces', bateria: 'Bateria' };
const TEXT = /^(pro|chordpro|cho|chopro|crd|txt)$/;
const IMG = /^(jpe?g|png|webp|gif)$/;
const MIME = { pdf: 'application/pdf', png: 'image/png', webp: 'image/webp', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)|(^|\/)\./;

/** Convierte la selección (archivos y .zip) en entradas { rel, bytes }. */
async function expand(fileList, onProgress) {
  const out = [];
  for (const file of fileList) {
    const { ext } = splitPath(file.name);
    if (ext !== 'zip') {
      out.push({ rel: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      continue;
    }
    onProgress?.('Abriendo ' + file.name + '…');
    const { unzipSync } = await import('fflate');
    const entries = Object.entries(unzipSync(new Uint8Array(await file.arrayBuffer())))
      .filter(([p, data]) => !p.endsWith('/') && data.length && !JUNK.test(p))
      .map(([p, data]) => ({ rel: p.normalize('NFC'), bytes: data }));
    // Si todo cuelga de una misma carpeta raíz, se quita (no es una categoría).
    const tops = new Set(entries.map((e) => e.rel.split('/')[0]));
    const nested = entries.every((e) => e.rel.includes('/'));
    if (tops.size === 1 && nested) entries.forEach((e) => (e.rel = e.rel.split('/').slice(1).join('/')));
    out.push(...entries);
  }
  return out;
}

/**
 * @param {FileList|File[]} fileList
 * @param {'voces'|'bateria'} section  sección por defecto
 * @param {{ duplicates: 'replace'|'skip', onProgress?: (msg) => void }} opts
 */
export async function importFiles(fileList, section, { duplicates = 'replace', onProgress } = {}) {
  const res = { added: 0, replaced: 0, skipped: 0, unsupported: [] };
  const entries = await expand([...fileList], onProgress);
  const existing = { voces: new Set(state.library.songs.voces.map((s) => s.id)), bateria: new Set(state.library.songs.bateria.map((s) => s.id)) };
  const records = [];
  let done = 0;

  for (const { rel, bytes } of entries) {
    onProgress?.(`Importando ${++done} de ${entries.length}…`);
    const dirs = rel.split('/').slice(0, -1);
    const fileName = rel.split('/').pop();
    const { base, ext } = splitPath(fileName);
    // Carpetas «Voces»/«Batería» dentro del .zip mandan sobre la sección elegida.
    let sec = section;
    const first = dirs[0] && sectionOfFolder(dirs[0]);
    if (first === 'voces' || first === 'bateria') {
      sec = first;
      dirs.shift();
    }
    const kind = TEXT.test(ext) ? 'text' : ext === 'pdf' ? 'pdf' : IMG.test(ext) ? 'image' : null;
    if (!kind) {
      res.unsupported.push(fileName);
      continue;
    }
    const folder = ['local', FOLDER[sec], ...dirs.map(safeName).filter(Boolean)].join('/');

    if (kind === 'text') {
      const text = decodeText(bytes);
      const songs = ext === 'txt' ? [text] : splitSongs(text);
      for (const [i, t] of songs.entries()) {
        const meta = songMeta(t, ext);
        const name = songs.length > 1 ? safeName(meta.title) || `${base} ${i + 1}` : base;
        const id = normalize(name);
        if (existing[sec].has(id)) {
          if (duplicates === 'skip') {
            res.skipped++;
            continue;
          }
          res.replaced++;
        } else {
          res.added++;
          existing[sec].add(id);
        }
        records.push({ path: `${folder}/${name}.${ext}`, origin: 'local', source: 'local', section: sec, ext, kind, depth: 1, etag: String(Date.now()), size: t.length, text: t, meta });
      }
    } else {
      const id = normalize(base);
      // Las imágenes sueltas de una carpeta forman una sola partitura: se cuenta la carpeta.
      if (existing[sec].has(id) && kind !== 'image') {
        if (duplicates === 'skip') {
          res.skipped++;
          continue;
        }
        res.replaced++;
      } else if (kind !== 'image' || !dirs.length) {
        res.added++;
      }
      const path = `${folder}/${fileName}`;
      await db.putBlob(path, new Blob([bytes], { type: MIME[ext] ?? 'application/octet-stream' }));
      records.push({ path, origin: 'local', source: 'local', section: sec, ext, kind, depth: 1, etag: String(Date.now()), size: bytes.length });
    }
  }
  if (records.length) await db.putFiles(records);
  await reloadLibrary();
  return res;
}

export const localSongCount = () => state.files.filter((f) => f.origin === 'local').length;

/** Borra todas las canciones importadas en este dispositivo. */
export async function removeAllLocal() {
  const paths = state.files.filter((f) => f.origin === 'local').map((f) => f.path);
  if (paths.length) await db.deleteFiles(paths);
  await reloadLibrary();
  return paths.length;
}
