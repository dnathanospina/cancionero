import { parseChord } from '../music/chords.js';

/**
 * Convierte texto con "acordes encima de la letra" a ChordPro.
 * Si el texto ya parece ChordPro, se devuelve tal cual.
 */

const SECTION_HEADER =
  /^\s*\[?\s*((?:pre-?)?coro|estribillo|estrofa|verso|puente|intro|introducci[oó]n|final|outro|interludio|instrumental|chorus|verse|bridge|tag)\b[^\]]*\]?\s*:?\s*$/i;

const NON_CHORD_TOKEN = /^(\||\|\||-+|\/|%|x\d+|\(x\d+\)|\d+x|\.+|:\|\|?|\|\|?:)$/i;

export function looksLikeChordPro(text) {
  return /^\s*\{\s*[a-z_]+\s*[:}\s]/im.test(text) || /\[[A-G][^\]\s]{0,8}\][a-záéíóúñ]/i.test(text);
}

function tokenize(line) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) out.push({ text: m[0], col: m.index });
  return out;
}

const stripParens = (t) => t.replace(/^\((.+)\)$/, '$1');

export function isChordLine(line) {
  const tokens = tokenize(line);
  if (!tokens.length) return false;
  let chords = 0;
  for (const t of tokens) {
    if (NON_CHORD_TOKEN.test(t.text)) continue;
    if (!parseChord(stripParens(t.text), { strictCase: true })) return false;
    chords++;
  }
  return chords > 0;
}

/** Inserta los acordes de `chordLine` en `lyric` según su columna. */
export function mergeChordLine(chordLine, lyric) {
  const tokens = tokenize(chordLine).filter((t) => !NON_CHORD_TOKEN.test(t.text));
  let out = lyric;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const { text, col } = tokens[i];
    if (out.length < col) out = out.padEnd(col, ' ');
    out = out.slice(0, col) + `[${stripParens(text)}]` + out.slice(col);
  }
  return out.replace(/\s+$/, '');
}

function chordsOnly(chordLine) {
  return chordLine.replace(/\S+/g, (t) => (NON_CHORD_TOKEN.test(t) ? t : `[${stripParens(t)}]`)).trim();
}

export function txtToChordPro(text) {
  if (looksLikeChordPro(text)) return text;
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\t/g, '        ').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');
    if (SECTION_HEADER.test(line)) {
      out.push(`{c: ${line.trim().replace(/^\[|\]$/g, '').replace(/:$/, '')}}`);
      continue;
    }
    if (isChordLine(line)) {
      const next = lines[i + 1]?.replace(/\s+$/, '');
      if (next && next.trim() && !isChordLine(next) && !SECTION_HEADER.test(next)) {
        out.push(mergeChordLine(line, next));
        i++;
      } else {
        out.push(chordsOnly(line));
      }
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}
