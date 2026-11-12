/**
 * Lectura y escritura de acordes en notación americana (C D E…) y latina
 * (Do Re Mi…). Una nota se representa por su clase de altura (0 = Do … 11 = Si).
 */

const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LATIN_TO_LETTER = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
const LETTER_TO_LATIN = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Grafía habitual cuando no hay tonalidad que indique otra cosa. */
const DEFAULT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Tonalidades que se escriben con bemoles (mayores y menores). */
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]); // Dm Gm Cm Fm Bbm Ebm

const ACC = { '#': 1, '♯': 1, b: -1, '♭': -1 };

// Sufijos válidos: se trocean en piezas conocidas para no confundir palabras
// ("Amen", "La casa") con acordes.
const SUFFIX_TOKEN =
  /^(?:maj|min|dim|aug|sus|add|alt|omit|no|mmaj|ma|mi|m|M|°|º|o|ø|Δ|\+|-|\d{1,2}|#|♯|b|♭|\(|\)|,|\.|\^|\/(?=\d))/;

function validSuffix(s) {
  let rest = s;
  while (rest.length) {
    const m = SUFFIX_TOKEN.exec(rest);
    if (!m || !m[0].length) return false;
    rest = rest.slice(m[0].length);
  }
  return true;
}

/**
 * Lee una nota al inicio de `s`. Devuelve candidatos (latina y americana)
 * porque "Fa" puede ser Fa latino o F + "a".
 */
function noteCandidates(s, { strictCase = false } = {}) {
  const out = [];
  const latin = /^(do|re|mi|fa|sol|la|si)/i.exec(s);
  if (latin) {
    const word = latin[1];
    const okCase = !strictCase || /^[A-Z]/.test(word);
    if (okCase) {
      let len = word.length;
      let pc = NATURAL[LATIN_TO_LETTER[word.toLowerCase()]];
      let acc = 0;
      if (ACC[s[len]] !== undefined) {
        acc = ACC[s[len]];
        len += 1;
      }
      out.push({ pc: (pc + acc + 12) % 12, len, latin: true, acc });
    }
  }
  const am = /^[A-G]/.exec(s);
  if (am) {
    let len = 1;
    let acc = 0;
    if (ACC[s[1]] !== undefined) {
      acc = ACC[s[1]];
      len = 2;
    }
    out.push({ pc: (NATURAL[am[0]] + acc + 12) % 12, len, latin: false, acc });
  }
  return out;
}

function parseNoteExact(s, opts) {
  return noteCandidates(s, opts).find((c) => c.len === s.length) ?? null;
}

/**
 * Analiza un acorde. Devuelve { root, suffix, bass } o null si no lo es.
 * `strictCase` exige mayúscula inicial (útil para detectar líneas de acordes).
 */
export function parseChord(input, opts = {}) {
  const s = String(input).trim();
  if (!s || s.length > 16) return null;
  let main = s;
  let bass = null;
  const slash = s.lastIndexOf('/');
  if (slash > 0) {
    const b = parseNoteExact(s.slice(slash + 1), opts);
    if (b) {
      bass = b;
      main = s.slice(0, slash);
    }
  }
  for (const root of noteCandidates(main, opts)) {
    const suffix = main.slice(root.len);
    if (validSuffix(suffix)) return { root, suffix, bass };
  }
  return null;
}

/** ¿La tonalidad de destino se escribe con bemoles? */
export function keyPrefersFlats(key) {
  if (!key) return null;
  return key.minor ? FLAT_MINOR.has(key.pc) : FLAT_MAJOR.has(key.pc);
}

/**
 * Nombre de una nota. `spelling`: 'sharp' | 'flat' | 'default'.
 * `notation`: 'american' | 'latin'.
 */
export function noteName(pc, { spelling = 'default', notation = 'american' } = {}) {
  const table = spelling === 'sharp' ? SHARP_NAMES : spelling === 'flat' ? FLAT_NAMES : DEFAULT_NAMES;
  const name = table[((pc % 12) + 12) % 12];
  if (notation !== 'latin') return name;
  return LETTER_TO_LATIN[name[0]] + name.slice(1);
}

/** Analiza una tonalidad ("G", "Em", "Sib", "Fa#m"). */
export function parseKey(input) {
  const c = parseChord(String(input ?? '').trim());
  if (!c) return null;
  const minor = /^(m|min|mi)(?!aj)/.test(c.suffix);
  return { pc: c.root.pc, minor };
}

/** Diferencia en semitonos de `from` a `to`, en el rango −5…+6. */
export function semitoneDiff(fromPc, toPc) {
  let d = (((toPc - fromPc) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}
