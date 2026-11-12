import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChordPro, parseLyricsLine, firstChord } from '../src/chordpro/parser.js';
import { txtToChordPro, isChordLine, mergeChordLine, looksLikeChordPro } from '../src/chordpro/txt-import.js';
import { decodeText } from '../src/util/text.js';

const SONG = `{title: Castillo fuerte}
{artist: Martín Lutero}
{key: C}
{capo: 0}
{x_bateria: Castillo fuerte (marcha)}
# comentario interno
{c: Estrofa 1}
Cas[C]tillo [G]fuerte es [C]nuestro Dios

{soc}
[F]Coro [C]aquí
{eoc}
{chorus}
{sot}
HH |x-x-x-x-|
{eot}
{new_page}`;

test('lee metadatos y directivas', () => {
  const doc = parseChordPro(SONG);
  assert.equal(doc.meta.title, 'Castillo fuerte');
  assert.equal(doc.meta.artist, 'Martín Lutero');
  assert.equal(doc.meta.key, 'C');
  assert.equal(doc.meta.x.bateria, 'Castillo fuerte (marcha)');
  assert.equal(doc.meta.hasChords, true);
  const types = doc.blocks.map((b) => b.type);
  assert.deepEqual(types, ['none', 'chorus', 'none', 'tab']);
  assert.equal(doc.blocks[1].label, 'Coro');
  assert.equal(doc.blocks[0].lines[0].type, 'comment');
  assert.equal(doc.blocks[2].lines[0].type, 'chorusRef');
  assert.equal(doc.blocks[3].lines[0].text, 'HH |x-x-x-x-|');
  assert.equal(firstChord(doc), 'C');
});

test('alias cortos y forma sin dos puntos', () => {
  const doc = parseChordPro('{t: Uno}\n{st: Dos}\n{start_of_chorus: Coro final}\nla\n{end_of_chorus}');
  assert.equal(doc.meta.title, 'Uno');
  assert.equal(doc.meta.subtitle, 'Dos');
  assert.equal(doc.blocks[0].label, 'Coro final');
});

test('segmenta líneas con acordes', () => {
  assert.deepEqual(parseLyricsLine('Cas[G]tillo [D]fuerte'), [
    { chord: null, text: 'Cas' },
    { chord: 'G', text: 'tillo ' },
    { chord: 'D', text: 'fuerte' },
  ]);
  assert.deepEqual(parseLyricsLine('[G] [C]'), [
    { chord: 'G', text: ' ' },
    { chord: 'C', text: '' },
  ]);
  assert.deepEqual(parseLyricsLine('sin acordes'), [{ chord: null, text: 'sin acordes' }]);
});

test('convierte acordes encima de la letra', () => {
  assert.ok(isChordLine('G        C     D'));
  assert.ok(isChordLine('Do   Sol  | Lam  x2'));
  assert.ok(!isChordLine('Amen, amén'));
  assert.equal(mergeChordLine('G       C', 'Sublime gracia'), '[G]Sublime [C]gracia');
  const out = txtToChordPro('Coro:\nG     D\nAleluya\nC  G\n\nfin');
  assert.equal(out, '{c: Coro}\n[G]Aleluy[D]a\n[C]  [G]\n\nfin');
});

test('detecta ChordPro', () => {
  assert.ok(looksLikeChordPro('{title: X}\nhola'));
  assert.ok(looksLikeChordPro('Can[G]ción'));
  assert.ok(!looksLikeChordPro('G  C\nletra'));
});

test('decodifica UTF-8 y Windows-1252', () => {
  assert.equal(decodeText(new TextEncoder().encode('Canción')), 'Canción');
  assert.equal(decodeText(new Uint8Array([0x43, 0x61, 0x6e, 0x63, 0x69, 0xf3, 0x6e])), 'Canción');
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])), 'A');
});
