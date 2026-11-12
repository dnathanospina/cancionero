/**
 * Cambios del modo líder pendientes de subir («bandeja de salida»).
 *
 * Entrada: { key, op: 'save'|'delete', path, origPath, baseEtag, text,
 *            status: 'pending'|'conflict'|'error', conflict?, error?, updatedAt }
 *  - path:     dónde quedará la lista (save)
 *  - origPath: archivo remoto en el que se basa (null si es nueva)
 *  - baseEtag: versión de ese archivo cuando se empezó a editar (para detectar conflictos)
 *
 * applyOutbox mezcla los cambios pendientes con los archivos descargados para
 * que la app muestre al momento lo que el líder ha guardado, aunque no se haya
 * subido todavía.
 */
export function applyOutbox(files, entries) {
  if (!entries?.length) return files;
  const byPath = new Map(files.map((f) => [f.path, f]));
  const sorted = [...entries].sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
  for (const e of sorted) {
    if (e.origPath) byPath.delete(e.origPath);
    if (e.op === 'save') {
      byPath.set(e.path, {
        path: e.path,
        origin: 'remote',
        section: 'listas',
        kind: 'list',
        ext: 'txt',
        text: e.text,
        pending: { key: e.key, status: e.status },
      });
    }
  }
  return [...byPath.values()];
}
