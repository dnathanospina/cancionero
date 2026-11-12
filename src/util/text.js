/** Utilidades de texto independientes del navegador. */

/** Clave de comparación: minúsculas, sin tildes ni signos, espacios simples. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
export const compareEs = (a, b) => collator.compare(a, b);

/** Separa "carpeta/Nombre.ext" en { dir, base, ext }. */
export function splitPath(path) {
  const i = path.lastIndexOf('/');
  const dir = i >= 0 ? path.slice(0, i) : '';
  const file = i >= 0 ? path.slice(i + 1) : path;
  const j = file.lastIndexOf('.');
  return j > 0
    ? { dir, base: file.slice(0, j), ext: file.slice(j + 1).toLowerCase() }
    : { dir, base: file, ext: '' };
}

/**
 * Decodifica un archivo de texto: respeta BOM, intenta UTF-8 y, si no es
 * válido, usa Windows-1252 (típico de archivos antiguos con tildes y ñ).
 */
export function decodeText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Fecha local de hoy en formato AAAA-MM-DD. */
export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Diferencia en días entre dos fechas AAAA-MM-DD (b - a). */
export function daysBetween(a, b) {
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}
