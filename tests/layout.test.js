import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath, buildLibrary, categoriesOf } from '../src/library/library.js';

// Biblioteca al estilo SongBook: canciones en la raíz, categorías = subcarpetas,
// y la batería en una carpeta de categoría propia.
const layout = { voces: '', bateria: 'Partituras batería', enlaces: 'Enlaces', listas: 'Listas' };

test('estructura configurable: voces en la raíz', () => {
  assert.deepEqual(classifyPath('Sublime gracia.cho', layout), { section: 'voces', ext: 'cho', kind: 'text', depth: 0 });
  assert.deepEqual(classifyPath('Himnos/Castillo fuerte.pro', layout), { section: 'voces', ext: 'pro', kind: 'text', depth: 0 });
  assert.deepEqual(classifyPath('Partituras bateria/Castillo fuerte.pdf', layout), { section: 'bateria', ext: 'pdf', kind: 'pdf', depth: 1 });
  assert.deepEqual(classifyPath('Listas/2026-11-15 Domingo.txt', layout), { section: 'listas', ext: 'txt', kind: 'list', depth: 1 });
  assert.equal(classifyPath('Notas.docx', layout), null);
  assert.deepEqual(classifyPath('ajustes-lider.json'), { section: 'config', ext: 'json', kind: 'config', depth: 0 });
});

test('estructura configurable: carpetas de varios niveles', () => {
  const l = { voces: 'SongBook/Canciones', bateria: 'SongBook/Canciones/Batería' };
  assert.equal(classifyPath('SongBook/Canciones/Batería/X.pdf', l).section, 'bateria');
  assert.deepEqual(classifyPath('SongBook/Canciones/Navidad/Y.cho', l), { section: 'voces', ext: 'cho', kind: 'text', depth: 2 });
  assert.equal(classifyPath('Otros/Z.cho', l), null);
});

test('categorías desde subcarpetas con voces en la raíz', () => {
  const files = ['Sublime gracia.cho', 'Himnos/Castillo fuerte.cho', 'Navidad/Noche de paz.cho', 'Partituras batería/Castillo fuerte.pdf'].map(
    (path) => ({ path, ...classifyPath(path, layout), meta: {} }),
  );
  const lib = buildLibrary(files);
  assert.deepEqual(
    categoriesOf(lib, 'voces').map((c) => `${c.label}:${c.count}`),
    ['Todas:3', 'Sin categoría:1', 'Himnos:1', 'Navidad:1'],
  );
  assert.deepEqual(lib.byId.bateria.get('castillo fuerte').categories, ['Himnos']);
});
