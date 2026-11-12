import { parseChord, noteName, keyPrefersFlats, parseKey } from './chords.js';

/**
 * Crea una función que transforma acordes según semitonos, notación y
 * tonalidad de destino (que decide sostenidos o bemoles).
 *
 * @param {object} o
 * @param {number} o.semitones  desplazamiento total a aplicar a los acordes escritos
 * @param {'american'|'latin'} o.notation
 * @param {{pc:number, minor:boolean}|null} o.targetKey  tonalidad en la que se leen los acordes
 */
export function makeChordTransformer({ semitones = 0, notation = 'american', targetKey = null } = {}) {
  const flats = keyPrefersFlats(targetKey);
  const cache = new Map();

  const spell = (note) => {
    if (semitones === 0) {
      // Sin transponer se respeta la grafía del archivo (C# o Db).
      return note.acc > 0 ? 'sharp' : note.acc < 0 ? 'flat' : 'default';
    }
    return flats === null ? 'default' : flats ? 'flat' : 'sharp';
  };

  return function transform(chord) {
    if (cache.has(chord)) return cache.get(chord);
    const c = parseChord(chord);
    let out = chord;
    if (c) {
      const root = noteName(c.root.pc + semitones, { spelling: spell(c.root), notation });
      const bass = c.bass ? '/' + noteName(c.bass.pc + semitones, { spelling: spell(c.bass), notation }) : '';
      out = root + c.suffix + bass;
    }
    cache.set(chord, out);
    return out;
  };
}

/** Nombre de una tonalidad desplazada (para mostrar "Tono: Sol"). */
export function keyName(key, semitones = 0, notation = 'american') {
  if (!key) return '';
  const pc = key.pc + semitones;
  const target = { pc: ((pc % 12) + 12) % 12, minor: key.minor };
  const flats = keyPrefersFlats(target);
  return noteName(pc, { spelling: flats ? 'flat' : 'sharp', notation }) + (key.minor ? 'm' : '');
}

/** Desplaza una tonalidad y la devuelve como objeto. */
export function shiftKey(key, semitones) {
  if (!key) return null;
  return { pc: (((key.pc + semitones) % 12) + 12) % 12, minor: key.minor };
}

export { parseKey };
