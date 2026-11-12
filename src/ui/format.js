import { todayISO, daysBetween } from '../util/text.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const dateFmtYear = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

const parse = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function longDate(iso) {
  if (!iso) return 'Sin fecha';
  const d = parse(iso);
  return cap((d.getFullYear() === new Date().getFullYear() ? dateFmt : dateFmtYear).format(d));
}

export function shortDate(iso) {
  return iso ? shortFmt.format(parse(iso)).replace('.', '') : '';
}

export function relativeDay(iso, today = todayISO()) {
  if (!iso) return '';
  const n = daysBetween(today, iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n > 1 && n < 14) return `En ${n} días`;
  if (n < -1 && n > -14) return `Hace ${-n} días`;
  return '';
}

export function timeAgo(ms) {
  if (!ms) return 'nunca';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'ahora mismo';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
