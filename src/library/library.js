import { normalize, splitPath, compareEs, todayISO } from '../util/text.js';
import { parseList } from '../lists/format.js';
import { buildLinkMap, cleanLink } from '../links/links.js';

/**
 * Construye la biblioteca a partir de los archivos guardados (sin el contenido
 * binario). Todo es puro para poder probarlo fuera del navegador.
 *
 * Registro de archivo: { path, origin, section, ext, kind, etag, size, meta?, text? }
 */

export const SECTIONS = ['voces', 'bateria'];
export const SECTION_LABEL = { voces: 'Voces e instrumentos', bateria: 'Batería' };
export const SECTION_SHORT = { voces: 'Voces', bateria: 'Batería' };

const TEXT_EXT = new Set(['pro', 'chordpro', 'cho', 'chopro', 'crd', 'txt']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const LINK_EXT = new Set(['txt', 'csv', 'md', 'url', 'webloc']);
const KIND_RANK = { chordpro: 0, pdf: 1, imageset: 2, image: 2 };

export function sectionOfFolder(name) {
  const n = normalize(name);
  if (/^(voces|voz|vocal|voces e instrumentos|instrumentos)/.test(n)) return 'voces';
  if (/^(bateria|drums?|percusion)/.test(n)) return 'bateria';
  if (/^(listas?|setlists?|eventos?)/.test(n)) return 'listas';
  if (/^(enlaces?|links?|youtube|videos?|audios?|escuchar)/.test(n)) return 'enlaces';
  return null;
}

/** Clasifica un archivo según su ruta relativa a la carpeta raíz del cancionero. */
export function classifyPath(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const section = sectionOfFolder(parts[0]);
  if (!section) return null;
  const { ext, base } = splitPath(path);
  if (base.startsWith('.') || base.startsWith('~')) return null;
  let kind = null;
  if (section === 'listas') kind = ext === 'txt' ? 'list' : null;
  else if (section === 'enlaces') kind = LINK_EXT.has(ext) ? 'links' : null;
  else if (TEXT_EXT.has(ext)) kind = 'text';
  else if (ext === 'pdf') kind = 'pdf';
  else if (IMAGE_EXT.has(ext)) kind = 'image';
  return kind ? { section, ext, kind } : null;
}

export const isBinaryKind = (kind) => kind === 'pdf' || kind === 'image';

const naturalPage = (a, b) => compareEs(splitPath(a).base, splitPath(b).base);

/**
 * Carpetas intermedias entre la carpeta de sección y el archivo = categorías
 * (así organiza SongBook las suyas). `skip` quita la carpeta de una canción de imágenes.
 */
function folderCategories(path, origin, skip = 0) {
  const dirs = path.split('/').slice(origin === 'local' ? 2 : 1, -1);
  return skip ? dirs.slice(0, -skip) : dirs;
}

function makeSong(section, id, name, kind, paths, record, { imageset = false } = {}) {
  const meta = record?.meta ?? {};
  const title = meta.title || name;
  const categories = [...new Set([...folderCategories(paths[0], record?.origin, imageset ? 1 : 0), ...(meta.tags ?? [])])];
  return {
    key: `${section}:${id}`,
    id,
    section,
    name,
    title,
    artist: meta.artist || '',
    songKey: meta.key || '',
    tempo: meta.tempo || '',
    bateria: meta.bateria || '',
    kind, // 'chordpro' | 'pdf' | 'image' | 'imageset'
    paths,
    path: paths[0],
    ext: record?.ext ?? '',
    origin: record?.origin ?? 'remote',
    sortTitle: title.replace(/^[^\p{L}\p{N}]+/u, ''),
    search: normalize(`${title} ${meta.artist || ''} ${name}`),
    categories,
    link: cleanLink(meta.link || ''),
  };
}

export function buildLibrary(files, { today = todayISO() } = {}) {
  const lib = {
    songs: { voces: [], bateria: [] },
    byId: { voces: new Map(), bateria: new Map() },
    byTitle: { voces: new Map(), bateria: new Map() },
    lists: [],
    duplicates: [],
    linkMap: new Map(),
  };

  // Agrupa por carpeta para detectar canciones hechas de varias imágenes.
  const folders = new Map();
  for (const f of files) {
    if (!SECTIONS.includes(f.section)) continue;
    const dir = splitPath(f.path).dir;
    if (!folders.has(dir)) folders.set(dir, []);
    folders.get(dir).push(f);
  }

  const candidates = { voces: [], bateria: [] };
  for (const [dir, group] of folders) {
    const depth = dir.split('/').length; // 1 = carpeta de sección
    const onlyImages = group.every((f) => f.kind === 'image');
    // Imágenes locales importadas viven en local/<Sección>, profundidad 2.
    const sectionDepth = group[0].origin === 'local' ? 2 : 1;
    if (depth > sectionDepth && onlyImages) {
      const name = dir.split('/').pop();
      const paths = group.map((f) => f.path).sort(naturalPage);
      candidates[group[0].section].push(makeSong(group[0].section, normalize(name), name, 'imageset', paths, group[0], { imageset: true }));
      continue;
    }
    for (const f of group) {
      const name = splitPath(f.path).base;
      const kind = f.kind === 'text' ? 'chordpro' : f.kind;
      candidates[f.section].push(makeSong(f.section, normalize(name), name, kind, [f.path], f));
    }
  }

  for (const section of SECTIONS) {
    // Preferencias ante nombres repetidos: local > remoto, texto > PDF > imagen.
    candidates[section].sort(
      (a, b) =>
        (a.origin === 'local' ? 0 : 1) - (b.origin === 'local' ? 0 : 1) ||
        KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
        compareEs(a.path, b.path),
    );
    for (const s of candidates[section]) {
      if (lib.byId[section].has(s.id)) {
        lib.duplicates.push(s);
        continue;
      }
      lib.byId[section].set(s.id, s);
      const t = normalize(s.title);
      if (t && !lib.byTitle[section].has(t)) lib.byTitle[section].set(t, s);
      lib.songs[section].push(s);
    }
    lib.songs[section].sort((a, b) => compareEs(a.sortTitle, b.sortTitle));
  }

  // Enlaces de la carpeta Enlaces/ y categorías heredadas por la batería.
  lib.linkMap = buildLinkMap(
    files.filter((f) => f.section === 'enlaces' && typeof f.text === 'string').map((f) => ({ ...f, base: splitPath(f.path).base })),
  );
  for (const s of lib.songs.voces) {
    s.link ||= lib.linkMap.get(s.id) || lib.linkMap.get(normalize(s.title)) || '';
  }
  for (const s of lib.songs.bateria) {
    const v = vocesVersion(lib, s);
    if (v) s.categories = [...new Set([...s.categories, ...v.categories])];
    s.link ||= v?.link || lib.linkMap.get(s.id) || lib.linkMap.get(normalize(s.title)) || '';
  }

  for (const f of files) {
    if (f.section !== 'listas' || typeof f.text !== 'string') continue;
    const base = splitPath(f.path).base;
    const list = parseList(f.text, base);
    lib.lists.push({ ...list, id: f.path, path: f.path });
  }
  sortLists(lib.lists, today);
  return lib;
}

/** Próximas (fecha ascendente) primero, después sin fecha, después pasadas (más reciente primero). */
export function sortLists(lists, today = todayISO()) {
  const rank = (l) => (!l.date ? 1 : l.date >= today ? 0 : 2);
  lists.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (rank(a) === 0) return a.date.localeCompare(b.date) || compareEs(a.name, b.name);
    if (rank(a) === 2) return b.date.localeCompare(a.date) || compareEs(a.name, b.name);
    return compareEs(a.name, b.name);
  });
  return lists;
}

export function upcomingLists(lib, today = todayISO()) {
  return lib.lists.filter((l) => l.date && l.date >= today);
}

export function nextEvent(lib, today = todayISO()) {
  return upcomingLists(lib, today)[0] ?? null;
}

export function findSong(lib, section, nameOrId) {
  const n = normalize(nameOrId);
  return lib.byId[section].get(n) ?? lib.byTitle[section].get(n) ?? null;
}

/** Versión de batería de una canción de voces. */
export function drumVersion(lib, vocesSong) {
  if (!vocesSong) return null;
  if (vocesSong.bateria) {
    const s = findSong(lib, 'bateria', vocesSong.bateria);
    if (s) return s;
  }
  return lib.byId.bateria.get(vocesSong.id) ?? lib.byTitle.bateria.get(normalize(vocesSong.title)) ?? null;
}

/** Canción de voces correspondiente a una partitura de batería. */
export function vocesVersion(lib, drumSong) {
  if (!drumSong) return null;
  for (const s of lib.songs.voces) {
    if (s.bateria && normalize(s.bateria) === drumSong.id) return s;
  }
  return lib.byId.voces.get(drumSong.id) ?? lib.byTitle.voces.get(normalize(drumSong.title)) ?? null;
}

/**
 * Resuelve un elemento de lista para una sección.
 * Devuelve { song, fallback } — fallback=true si en Batería se muestra la versión de voces.
 */
export function resolveItem(lib, item, section) {
  const voces = findSong(lib, 'voces', item.name);
  if (section === 'voces') return { song: voces, fallback: false };
  const drums = (voces && drumVersion(lib, voces)) || findSong(lib, 'bateria', item.name);
  if (drums) return { song: drums, fallback: false };
  return { song: voces, fallback: !!voces };
}

export const ALL = '__todas__';
export const NONE = '__sin__';

/**
 * Categorías de una sección con su número de canciones:
 * [{ id, label, count }] empezando por «Todas» y «Sin categoría».
 */
export function categoriesOf(lib, section) {
  const songs = lib.songs[section];
  const counts = new Map();
  let none = 0;
  for (const s of songs) {
    if (!s.categories.length) none++;
    for (const c of s.categories) {
      const k = normalize(c);
      const cur = counts.get(k);
      if (cur) cur.count++;
      else counts.set(k, { id: k, label: c, count: 1 });
    }
  }
  const list = [...counts.values()].sort((a, b) => compareEs(a.label, b.label));
  return [{ id: ALL, label: 'Todas', count: songs.length }, { id: NONE, label: 'Sin categoría', count: none }, ...list];
}

export function inCategory(song, cat) {
  if (!cat || cat === ALL) return true;
  if (cat === NONE) return !song.categories.length;
  return song.categories.some((c) => normalize(c) === cat);
}

export function searchSongs(lib, section, query, category = ALL) {
  const q = normalize(query);
  const all = lib.songs[section].filter((s) => inCategory(s, category));
  if (!q) return all;
  const words = q.split(' ');
  return all.filter((s) => words.every((w) => s.search.includes(w)));
}

/** Datos para la pantalla de revisión de nombres. */
export function linkReport(lib) {
  const drumsLinked = new Set();
  const vocesSinBateria = [];
  for (const s of lib.songs.voces) {
    const d = drumVersion(lib, s);
    if (d) drumsLinked.add(d.key);
    else vocesSinBateria.push(s);
  }
  const bateriaSinVoces = lib.songs.bateria.filter((s) => !drumsLinked.has(s.key));
  const noEncontradas = [];
  for (const l of lib.lists) {
    for (const it of l.items) {
      if (!resolveItem(lib, it, 'voces').song && !findSong(lib, 'bateria', it.name)) {
        noEncontradas.push({ list: l, item: it });
      }
    }
  }
  return { vocesSinBateria, bateriaSinVoces, noEncontradas, duplicados: lib.duplicates };
}
