/**
 * Formato de las listas por evento (archivo .txt en la carpeta Listas):
 *
 *   nombre: Domingo
 *   fecha: 2026-11-15
 *   notas: Santa cena al final
 *
 *   Castillo fuerte | tono: D
 *   Santo santo santo | tono: E | notas: estrofa 2 solo piano
 *   Sublime gracia
 *
 * Cabecera: líneas "clave: valor" con claves conocidas. Después, una canción
 * por línea (nombre del archivo o título). Las líneas con # son comentarios.
 */

const HEADER_KEYS = { nombre: 'name', titulo: 'name', 'título': 'name', fecha: 'date', hora: 'time', notas: 'notes', nota: 'notes', lugar: 'place' };
const ITEM_KEYS = { tono: 'key', tonalidad: 'key', notas: 'notes', nota: 'notes' };

/** Acepta AAAA-MM-DD, DD/MM/AAAA y DD-MM-AAAA. */
export function parseDate(s) {
  const t = String(s ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

function iso(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * @param {string} text
 * @param {string} [fileBase]  nombre del archivo sin extensión ("2026-11-15 Domingo")
 */
export function parseList(text, fileBase = '') {
  const list = { name: '', date: null, time: '', place: '', notes: '', items: [] };
  let inHeader = true;
  for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (inHeader) {
      const m = /^([^:|]+):\s*(.*)$/.exec(line);
      const key = m && HEADER_KEYS[m[1].trim().toLowerCase()];
      if (key) {
        list[key] = key === 'date' ? parseDate(m[2]) : m[2].trim();
        continue;
      }
      inHeader = false;
    }
    const [first, ...parts] = line.split('|');
    const name = first.replace(/^\s*(\d+[.)-]|[-*•])\s*/, '').trim();
    if (!name) continue;
    const item = { name, key: '', notes: '' };
    for (const p of parts) {
      const m = /^\s*([^:]+):\s*(.*)$/.exec(p);
      const k = m && ITEM_KEYS[m[1].trim().toLowerCase()];
      if (k) item[k] = m[2].trim();
    }
    list.items.push(item);
  }

  // Si falta nombre o fecha, se deducen del nombre del archivo.
  const fm = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/.exec(fileBase.trim());
  if (!list.date && fm) list.date = parseDate(fm[1]);
  if (!list.name) list.name = (fm ? fm[2] : fileBase).trim() || 'Lista';
  return list;
}

export function serializeList(list) {
  const out = [`nombre: ${list.name}`];
  if (list.date) out.push(`fecha: ${list.date}`);
  if (list.time) out.push(`hora: ${list.time}`);
  if (list.place) out.push(`lugar: ${list.place}`);
  if (list.notes) out.push(`notas: ${list.notes}`);
  out.push('');
  for (const it of list.items) {
    const parts = [it.name];
    if (it.key) parts.push(`tono: ${it.key}`);
    if (it.notes) parts.push(`notas: ${it.notes}`);
    out.push(parts.join(' | '));
  }
  return out.join('\n') + '\n';
}
