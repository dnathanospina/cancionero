/**
 * Un archivo ChordPro puede contener varias canciones separadas por
 * {new_song} o {ns} (así exportan varias canciones juntas SongBook y otras apps).
 * Devuelve el texto de cada canción.
 */
export function splitSongs(text) {
  const parts = String(text).split(/^[ \t]*\{\s*(?:new_song|ns)\s*\}[ \t]*$/im);
  const songs = parts.map((p) => p.replace(/^\s*\n/, '')).filter((p) => p.trim());
  return songs.length ? songs : [String(text)];
}

/** Nombre de archivo seguro a partir de un título. */
export function safeName(title) {
  return String(title ?? '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}
