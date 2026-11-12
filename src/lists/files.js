import { normalize } from '../util/text.js';

/** Nombre de archivo de una lista: «2026-11-22 Domingo.txt». */
export function listFileName(list) {
  const name = String(list.name ?? '')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Lista';
  return `${list.date ? list.date + ' ' : ''}${name}.txt`;
}

/**
 * Ruta libre para una lista dentro de `folder`, sin chocar con `taken`
 * (rutas existentes; se compara sin mayúsculas ni tildes, como OneDrive).
 */
export function uniqueListPath(list, folder, taken, own = null) {
  const used = new Set([...taken].filter((p) => p !== own).map((p) => normalize(p)));
  const base = listFileName(list).replace(/\.txt$/, '');
  for (let i = 1; i < 100; i++) {
    const path = `${folder}/${base}${i > 1 ? ` (${i})` : ''}.txt`;
    if (!used.has(normalize(path))) return path;
  }
  return `${folder}/${base} ${Date.now()}.txt`;
}

/** Próximo domingo (hoy si es domingo) en formato AAAA-MM-DD. */
export function nextSundayISO(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
