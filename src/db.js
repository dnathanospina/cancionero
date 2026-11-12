import { openDB } from 'idb';

/**
 * Almacenamiento local (IndexedDB):
 *  - files: metadatos y texto de cada archivo (clave: path)
 *  - blobs: contenido de PDF e imágenes, separado para no cargarlo al listar
 *  - prefs: ajustes por canción (transposición, capo, zoom, velocidad…)
 *  - kv:    ajustes generales y estado de sincronización
 */
const dbPromise = openDB('cancionero-bethel', 1, {
  upgrade(db) {
    db.createObjectStore('files', { keyPath: 'path' });
    db.createObjectStore('blobs');
    db.createObjectStore('prefs');
    db.createObjectStore('kv');
  },
});

export async function getAllFiles() {
  return (await dbPromise).getAll('files');
}

export async function putFiles(records) {
  const db = await dbPromise;
  const tx = db.transaction('files', 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

export async function deleteFiles(paths) {
  const db = await dbPromise;
  const tx = db.transaction(['files', 'blobs'], 'readwrite');
  await Promise.all([
    ...paths.flatMap((p) => [tx.objectStore('files').delete(p), tx.objectStore('blobs').delete(p)]),
    tx.done,
  ]);
}

export async function getBlob(path) {
  return (await dbPromise).get('blobs', path);
}
export async function putBlob(path, blob) {
  return (await dbPromise).put('blobs', blob, path);
}
export async function deleteBlob(path) {
  return (await dbPromise).delete('blobs', path);
}
export async function blobKeys() {
  return new Set(await (await dbPromise).getAllKeys('blobs'));
}

export async function kvGet(key, fallback = undefined) {
  const v = await (await dbPromise).get('kv', key);
  return v === undefined ? fallback : v;
}
export async function kvSet(key, value) {
  return (await dbPromise).put('kv', value, key);
}

export async function prefGet(key) {
  return (await (await dbPromise).get('prefs', key)) ?? {};
}
export async function prefPatch(key, patch) {
  const db = await dbPromise;
  const cur = (await db.get('prefs', key)) ?? {};
  const next = { ...cur, ...patch };
  await db.put('prefs', next, key);
  return next;
}
export async function allPrefs() {
  const db = await dbPromise;
  const [keys, values] = await Promise.all([db.getAllKeys('prefs'), db.getAll('prefs')]);
  return keys.map((k, i) => [k, values[i]]);
}
export async function putPrefs(entries) {
  const db = await dbPromise;
  const tx = db.transaction('prefs', 'readwrite');
  await Promise.all([...entries.map(([k, v]) => tx.store.put(v, k)), tx.done]);
}
