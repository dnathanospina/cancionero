import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseList, serializeList, parseDate } from '../src/lists/format.js';
import {
  buildLibrary, classifyPath, resolveItem, nextEvent, searchSongs, drumVersion, linkReport, findSong,
} from '../src/library/library.js';

test('lee listas por evento', () => {
  const l = parseList('nombre: Domingo\nfecha: 15/11/2026\nnotas: Santa cena\n\n1. Castillo fuerte | tono: D\n- Santo santo santo | tono: E | notas: piano\n# nada\nSublime gracia');
  assert.equal(l.name, 'Domingo');
  assert.equal(l.date, '2026-11-15');
  assert.equal(l.notes, 'Santa cena');
  assert.deepEqual(l.items.map((i) => i.name), ['Castillo fuerte', 'Santo santo santo', 'Sublime gracia']);
  assert.equal(l.items[1].key, 'E');
  assert.equal(l.items[1].notes, 'piano');
  assert.deepEqual(parseList(serializeList(l)), l);
});

test('deduce nombre y fecha del archivo', () => {
  const l = parseList('Salmo 23: El Señor', '2027-03-28 Pascua');
  assert.equal(l.name, 'Pascua');
  assert.equal(l.date, '2027-03-28');
  assert.equal(l.items[0].name, 'Salmo 23: El Señor');
  assert.equal(parseDate('2026-13-01'), null);
});

test('clasifica rutas', () => {
  assert.deepEqual(classifyPath('Voces/Himno.cho'), { section: 'voces', ext: 'cho', kind: 'text', depth: 1 });
  assert.deepEqual(classifyPath('Batería/Himno.PDF'), { section: 'bateria', ext: 'pdf', kind: 'pdf', depth: 1 });
  assert.deepEqual(classifyPath('Listas/2026-11-15 Domingo.txt'), { section: 'listas', ext: 'txt', kind: 'list', depth: 1 });
  assert.equal(classifyPath('Otros/x.cho'), null);
  assert.equal(classifyPath('Voces/x.docx'), null);
});

const files = [
  { path: 'Voces/Castillo fuerte.cho', section: 'voces', kind: 'text', ext: 'cho', meta: { title: 'Castillo fuerte es nuestro Dios', artist: 'Lutero', bateria: '' } },
  { path: 'Voces/Himnos/Santo santo santo.pro', section: 'voces', kind: 'text', ext: 'pro', meta: { title: '¡Santo! ¡Santo! ¡Santo!', bateria: 'Santo (6-8)' } },
  { path: 'Voces/Doxología.txt', section: 'voces', kind: 'text', ext: 'txt', meta: {} },
  { path: 'Voces/Doxología.pdf', section: 'voces', kind: 'pdf', ext: 'pdf' },
  { path: 'Bateria/Castillo Fuerte.pdf', section: 'bateria', kind: 'pdf', ext: 'pdf' },
  { path: 'Bateria/Santo (6-8).cho', section: 'bateria', kind: 'text', ext: 'cho', meta: {} },
  { path: 'Bateria/Amazing Grace/2.png', section: 'bateria', kind: 'image', ext: 'png' },
  { path: 'Bateria/Amazing Grace/1.png', section: 'bateria', kind: 'image', ext: 'png' },
  { path: 'Listas/Pasada.txt', section: 'listas', kind: 'list', text: 'fecha: 2026-11-01\nCastillo fuerte' },
  { path: 'Listas/Domingo.txt', section: 'listas', kind: 'list', text: 'fecha: 2026-11-15\ncastillo FUERTE | tono: D\nSanto santo santo\nDoxologia\nNo existe' },
  { path: 'Listas/Pascua.txt', section: 'listas', kind: 'list', text: 'fecha: 2027-03-28\nAmazing Grace' },
];

test('construye la biblioteca y empareja batería', () => {
  const lib = buildLibrary(files, { today: '2026-11-12' });
  assert.equal(lib.songs.voces.length, 3);
  assert.equal(lib.duplicates.length, 1); // Doxología.pdf queda detrás del .txt
  assert.equal(findSong(lib, 'voces', 'doxologia').kind, 'chordpro');
  const amazing = lib.byId.bateria.get('amazing grace');
  assert.equal(amazing.kind, 'imageset');
  assert.deepEqual(amazing.paths, ['Bateria/Amazing Grace/1.png', 'Bateria/Amazing Grace/2.png']);
  assert.equal(drumVersion(lib, findSong(lib, 'voces', 'Castillo fuerte')).kind, 'pdf');
  assert.equal(drumVersion(lib, findSong(lib, 'voces', 'Santo santo santo')).name, 'Santo (6-8)');
});

test('listas: próxima, orden y resolución por sección', () => {
  const lib = buildLibrary(files, { today: '2026-11-12' });
  assert.deepEqual(lib.lists.map((l) => l.name), ['Domingo', 'Pascua', 'Pasada']);
  const next = nextEvent(lib, '2026-11-12');
  assert.equal(next.name, 'Domingo');
  const [a, b, c, d] = next.items;
  assert.equal(resolveItem(lib, a, 'voces').song.id, 'castillo fuerte');
  assert.equal(resolveItem(lib, a, 'bateria').song.kind, 'pdf');
  assert.equal(resolveItem(lib, b, 'bateria').song.name, 'Santo (6-8)');
  assert.deepEqual(
    { fallback: resolveItem(lib, c, 'bateria').fallback, kind: resolveItem(lib, c, 'bateria').song.kind },
    { fallback: true, kind: 'chordpro' },
  );
  assert.equal(resolveItem(lib, d, 'voces').song, null);
  assert.equal(nextEvent(lib, '2026-11-16').name, 'Pascua');
});

test('búsqueda sin tildes y por título o artista', () => {
  const lib = buildLibrary(files, { today: '2026-11-12' });
  assert.equal(searchSongs(lib, 'voces', 'santo').length, 1);
  assert.equal(searchSongs(lib, 'voces', 'LUTERO')[0].id, 'castillo fuerte');
  assert.equal(searchSongs(lib, 'voces', 'doxología')[0].name, 'Doxología');
  const r = linkReport(lib);
  assert.deepEqual(r.vocesSinBateria.map((s) => s.name), ['Doxología']);
  assert.deepEqual(r.bateriaSinVoces.map((s) => s.name), ['Amazing Grace']);
  assert.deepEqual(r.noEncontradas.map((x) => x.item.name), ['No existe']);
});
