import * as db from './db.js';
import { buildLibrary } from './library/library.js';
import { syncFrom, prefetch } from './sync/sync.js';
import { demoSource } from './sources/demo.js';
import { upcomingLists, resolveItem } from './library/library.js';

export const DEFAULT_PEDAL = {
  scrollDown: ['PageDown', 'ArrowDown'],
  scrollUp: ['PageUp', 'ArrowUp'],
  nextSong: ['ArrowRight'],
  prevSong: ['ArrowLeft'],
  toggleScroll: [' '],
};

export const DEFAULT_SETTINGS = {
  section: 'voces',
  notation: 'american',
  theme: 'auto',
  fontScale: 1,
  lyricsOnly: false,
  pedal: DEFAULT_PEDAL,
  autoAdvance: true,
  downloadAll: false,
  pageMode: 'paged', // PDF/imágenes: 'paged' (página a página) o 'scroll' (continuo)
  source: 'demo',
};

const SOURCES = { demo: demoSource };

const emptyLib = buildLibrary([]);

export const state = {
  settings: { ...DEFAULT_SETTINGS },
  library: emptyLib,
  files: [],
  sync: { running: false, progress: null, last: null, error: null },
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  installPrompt: null,
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(what) {
  for (const fn of listeners) fn(what);
}

export function currentSource() {
  return SOURCES[state.settings.source] ?? demoSource;
}

export async function loadSettings() {
  const saved = await db.kvGet('settings', {});
  state.settings = { ...DEFAULT_SETTINGS, ...saved, pedal: { ...DEFAULT_PEDAL, ...(saved.pedal ?? {}) } };
  state.sync.last = await db.kvGet('lastSync', null);
  emit('settings');
}

export async function setSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  emit('settings'); // la pantalla responde al instante; se guarda después
  await db.kvSet('settings', state.settings);
}

export async function reloadLibrary() {
  state.files = await db.getAllFiles();
  state.library = buildLibrary(state.files);
  emit('library');
}

export function setInstallPrompt(e) {
  state.installPrompt = e;
  emit('install');
}

export function setOnline(v) {
  state.online = v;
  emit('online');
}

/** Sincroniza con el origen configurado y prepara los PDF/imágenes necesarios. */
export async function runSync({ quiet = false } = {}) {
  if (state.sync.running) return null;
  if (!navigator.onLine) {
    state.sync.error = 'Sin conexión: se muestra la última versión guardada.';
    emit('sync');
    return null;
  }
  state.sync = { ...state.sync, running: true, progress: null, error: null };
  emit('sync');
  try {
    const source = currentSource();
    const result = await syncFrom(source, {
      onProgress: (done, total) => {
        state.sync.progress = { done, total, label: 'Actualizando' };
        emit('sync');
      },
    });
    await reloadLibrary();
    navigator.storage?.persist?.().catch(() => {});
    await prefetchNeeded();
    state.sync.last = await db.kvGet('lastSync', null);
    return { ...result, quiet };
  } catch (e) {
    console.error(e);
    state.sync.error = 'No se pudo actualizar: ' + (e.message || e);
    return null;
  } finally {
    state.sync.running = false;
    state.sync.progress = null;
    emit('sync');
  }
}

/**
 * PDF e imágenes: se descargan los de las listas próximas (ambas secciones,
 * para poder cambiar de sección sin conexión) o todo si el ajuste lo pide.
 */
export async function prefetchNeeded() {
  const lib = state.library;
  let songs;
  if (state.settings.downloadAll) {
    songs = [...lib.songs.voces, ...lib.songs.bateria];
  } else {
    songs = upcomingLists(lib)
      .slice(0, 3)
      .flatMap((l) => l.items.flatMap((it) => [resolveItem(lib, it, 'voces').song, resolveItem(lib, it, 'bateria').song]));
  }
  return prefetch(currentSource(), songs, {
    onProgress: (done, total) => {
      state.sync.progress = { done, total, label: 'Descargando partituras' };
      emit('sync');
    },
  });
}
