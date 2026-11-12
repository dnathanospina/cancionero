import { parseChordPro } from './parser.js';
import { txtToChordPro } from './txt-import.js';

/** Convierte el texto de un archivo de canción en documento ChordPro analizado. */
export function loadSongDoc(text, ext = 'cho') {
  const source = ext === 'txt' ? txtToChordPro(text) : text;
  return parseChordPro(source);
}

/** Metadatos ligeros que se guardan junto al archivo para construir la biblioteca. */
export function songMeta(text, ext) {
  const { meta } = loadSongDoc(text, ext);
  return {
    title: meta.title || '',
    artist: meta.artist || meta.composer || '',
    key: meta.key || '',
    tempo: meta.tempo || '',
    bateria: meta.x.bateria || '',
  };
}
