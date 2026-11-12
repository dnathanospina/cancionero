import manifest from 'virtual:demo-manifest';
import { todayISO } from '../util/text.js';

/**
 * Origen "Demostración": la misma estructura que la carpeta de OneDrive, pero
 * servida con la app (public/demo/Cancionero). Las listas de ejemplo usan
 * fechas relativas (@domingo, @domingo+7, @domingo-7) para que siempre haya
 * un "próximo evento".
 */
const ROOT = import.meta.env.BASE_URL + 'demo/Cancionero/';

function nextSunday(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7) + offsetDays);
  return todayISO(d);
}

const relDates = (text) =>
  text.replace(/@domingo([+-]\d+)?/g, (_m, off) => nextSunday(off ? parseInt(off, 10) : 0));

export const demoSource = {
  id: 'demo',
  label: 'Demostración',
  async list() {
    const stamp = nextSunday();
    return manifest.map((f) => ({
      path: f.path,
      size: f.size,
      // Las listas cambian de fecha cada semana: se fuerza su relectura.
      etag: f.path.startsWith('Listas/') ? `${f.etag}:${stamp}` : f.etag,
    }));
  },
  async getBuffer(path) {
    const url = ROOT + path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar ${path} (${res.status})`);
    const buf = await res.arrayBuffer();
    if (!path.startsWith('Listas/')) return buf;
    return new TextEncoder().encode(relDates(new TextDecoder().decode(buf))).buffer;
  },
};
