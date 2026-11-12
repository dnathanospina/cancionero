import { normalize } from '../util/text.js';

/**
 * Enlaces para escuchar cada canción (YouTube u otros).
 *
 * Fuentes admitidas:
 *  - En la canción: {x_youtube: URL} (también {youtube}, {link}, {url}…)
 *  - En la carpeta Enlaces/ de OneDrive:
 *      · un archivo por canción con el mismo nombre: .url (Windows), .webloc (Mac) o .txt
 *      · un archivo con muchas canciones (.txt/.csv/.md), una por línea:
 *          Castillo fuerte | https://youtu.be/…
 *          Castillo fuerte;https://www.youtube.com/watch?v=…
 *        o bien el nombre en una línea y la URL en la siguiente.
 */

const URL_RE = /https?:\/\/[^\s"'<>|]+/i;

/** Datos de una URL de YouTube (id del vídeo) o null si no lo es. */
export function youtubeInfo(url) {
  let u;
  try {
    u = new URL(String(url).trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
      if (m) id = m[1];
    }
  }
  return id && /^[\w-]{6,20}$/.test(id) ? { id, url: `https://www.youtube.com/watch?v=${id}` } : null;
}

/** Enlace limpio para abrir (YouTube normalizado; otros http(s) tal cual). */
export function cleanLink(url) {
  const yt = youtubeInfo(url);
  if (yt) return yt.url;
  const m = URL_RE.exec(String(url ?? ''));
  return m ? m[0] : '';
}

/**
 * Enlace para escuchar varias canciones seguidas en YouTube (lista anónima).
 * Solo admite vídeos de YouTube; YouTube acepta hasta 50.
 */
export function youtubePlaylistUrl(urls) {
  const ids = urls.map(youtubeInfo).filter(Boolean).map((x) => x.id).slice(0, 50);
  return ids.length ? `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}` : '';
}

/**
 * Lee un archivo de la carpeta de enlaces y devuelve [{ name, url }].
 * `fileBase` es el nombre del archivo sin extensión (para archivos de un solo enlace).
 */
export function parseLinksFile(text, ext, fileBase) {
  const t = String(text ?? '');
  if (ext === 'url') {
    const m = /^\s*URL\s*=\s*(\S+)/im.exec(t);
    return m ? [{ name: fileBase, url: cleanLink(m[1]) }] : [];
  }
  if (ext === 'webloc') {
    const m = /<string>\s*(https?:\/\/[^<\s]+)\s*<\/string>/i.exec(t);
    return m ? [{ name: fileBase, url: cleanLink(m[1]) }] : [];
  }
  const out = [];
  let pendingName = '';
  const lines = t.replace(/\r\n?/g, '\n').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = URL_RE.exec(line);
    if (!m) {
      pendingName = line.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').replace(/[:;,|\t-]+$/, '').trim();
      continue;
    }
    // Nombre = la línea sin la URL, quitando separadores y comillas.
    let name = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length))
      .replace(/["']/g, '')
      .replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '')
      .replace(/[|;,\t:–-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!name) name = pendingName;
    // Un archivo con un único enlace sin nombre se asocia a su nombre de archivo.
    if (!name && lines.filter((l) => URL_RE.test(l)).length === 1) name = fileBase;
    pendingName = '';
    const url = cleanLink(m[0]);
    if (name && url) out.push({ name, url });
  }
  return out;
}

/** Mapa nombre normalizado → URL a partir de varios archivos. */
export function buildLinkMap(files) {
  const map = new Map();
  for (const f of files) {
    for (const { name, url } of parseLinksFile(f.text, f.ext, f.base)) {
      const key = normalize(name);
      if (key && !map.has(key)) map.set(key, url);
    }
  }
  return map;
}
