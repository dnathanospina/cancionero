import * as db from '../db.js';
import { state, setSettings, reloadLibrary } from '../state.js';

const FORMAT = 'cancionero-bethel-copia';

/**
 * Copia de seguridad: ajustes generales, ajustes por canción y archivos
 * importados a mano en este dispositivo (solo texto). Las canciones de la
 * biblioteca compartida no se incluyen: se vuelven a descargar al actualizar.
 */
export async function createBackup() {
  const files = (await db.getAllFiles()).filter((f) => f.origin === 'local' && typeof f.text === 'string');
  const data = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    prefs: await db.allPrefs(),
    localFiles: files,
  };
  return new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
}

export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export async function restoreBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida.');
  }
  if (data?.format !== FORMAT) throw new Error('El archivo no es una copia de seguridad de este cancionero.');
  if (data.settings) await setSettings({ ...data.settings });
  if (Array.isArray(data.prefs)) await db.putPrefs(data.prefs);
  const local = (data.localFiles ?? []).filter((f) => f && f.origin === 'local' && typeof f.path === 'string');
  if (local.length) await db.putFiles(local);
  await reloadLibrary();
  return { prefs: data.prefs?.length ?? 0, files: local.length };
}
