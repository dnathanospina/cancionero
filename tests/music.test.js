import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, parseKey, semitoneDiff } from '../src/music/chords.js';
import { makeChordTransformer, keyName } from '../src/music/transpose.js';

test('reconoce acordes americanos y latinos', () => {
  for (const c of ['C', 'C#m7', 'Bb', 'Ebmaj7', 'F/A', 'Gsus4', 'D7(b9)', 'Asus2', 'Cadd9', 'E°', 'Bm7b5', 'G/F#']) {
    assert.ok(parseChord(c), c);
  }
  for (const c of ['Do', 'Rem', 'Mi7', 'Fa#m', 'Sol/Si', 'Lam', 'Sib', 'DO', 'sol']) {
    assert.ok(parseChord(c), c);
  }
});

test('rechaza palabras que no son acordes', () => {
  for (const w of ['Amen', 'Hola', 'casa', 'Dios', 'Santo', 'Gloria', 'x2', 'N.C.']) {
    assert.equal(parseChord(w, { strictCase: true }), null, w);
  }
});

test('"Fadd9" es F + add9 y "Fa" es Fa latino', () => {
  assert.equal(parseChord('Fadd9').root.pc, 5);
  assert.equal(parseChord('Fadd9').suffix, 'add9');
  assert.equal(parseChord('Fa').suffix, '');
});

test('transpone respetando sufijos y bajo', () => {
  const t = makeChordTransformer({ semitones: 2, targetKey: parseKey('A') });
  assert.equal(t('G'), 'A');
  assert.equal(t('Em7'), 'F#m7');
  assert.equal(t('C/E'), 'D/F#');
  assert.equal(t('D7sus4'), 'E7sus4');
});

test('usa bemoles en tonalidades con bemoles', () => {
  const t = makeChordTransformer({ semitones: 3, targetKey: parseKey('Bb') });
  assert.equal(t('G'), 'Bb');
  assert.equal(t('C'), 'Eb');
  assert.equal(t('D'), 'F');
  assert.equal(t('Em'), 'Gm');
});

test('sin transponer conserva la grafía original', () => {
  const t = makeChordTransformer({ semitones: 0 });
  assert.equal(t('Db'), 'Db');
  assert.equal(t('C#m'), 'C#m');
});

test('notación latina', () => {
  const t = makeChordTransformer({ semitones: 0, notation: 'latin' });
  assert.equal(t('C'), 'Do');
  assert.equal(t('Am7'), 'Lam7');
  assert.equal(t('G/B'), 'Sol/Si');
  const t2 = makeChordTransformer({ semitones: 1, notation: 'latin', targetKey: parseKey('Ab') });
  assert.equal(t2('G'), 'Lab');
  const t3 = makeChordTransformer({ semitones: 2, notation: 'american', targetKey: parseKey('E') });
  assert.equal(t3('Re'), 'E');
});

test('nombres de tonalidad y diferencias', () => {
  assert.equal(keyName(parseKey('G'), 2), 'A');
  assert.equal(keyName(parseKey('Dm'), 0, 'latin'), 'Rem');
  assert.equal(keyName(parseKey('C'), 1), 'Db');
  assert.equal(semitoneDiff(7, 2), -5);
  assert.equal(semitoneDiff(2, 9), -5);
  assert.equal(semitoneDiff(0, 6), 6);
});
