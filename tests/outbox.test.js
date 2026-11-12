import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOutbox } from '../src/lists/outbox.js';
import { listFileName, uniqueListPath, nextSundayISO } from '../src/lists/files.js';
import { buildLibrary } from '../src/library/library.js';

const files = [
  { path: 'Listas/Domingo.txt', section: 'listas', kind: 'list', text: 'nombre: Domingo\nfecha: 2026-11-15\nA', etag: 'e1' },
  { path: 'Listas/Pascua.txt', section: 'listas', kind: 'list', text: 'nombre: Pascua\nfecha: 2027-03-28\nB', etag: 'e2' },
];

test('nombres de archivo de lista', () => {
  assert.equal(listFileName({ name: 'Culto: Navidad / Niños', date: '2026-12-24' }), '2026-12-24 Culto- Navidad - Niños.txt');
  assert.equal(listFileName({ name: '  ', date: null }), 'Lista.txt');
  const taken = new Set(['Listas/2026-11-22 Domingo.txt', 'Listas/2026-11-22 domingo (2).txt']);
  assert.equal(uniqueListPath({ name: 'Domingo', date: '2026-11-22' }, 'Listas', taken), 'Listas/2026-11-22 Domingo (3).txt');
  assert.equal(uniqueListPath({ name: 'Domingo', date: '2026-11-22' }, 'Listas', taken, 'Listas/2026-11-22 Domingo.txt'), 'Listas/2026-11-22 Domingo.txt');
  assert.equal(nextSundayISO(new Date(2026, 10, 12)), '2026-11-15');
  assert.equal(nextSundayISO(new Date(2026, 10, 15)), '2026-11-15');
});

test('los cambios pendientes se ven al momento', () => {
  const merged = applyOutbox(files, [
    { key: 'k1', op: 'save', path: 'Listas/2026-11-22 Domingo.txt', origPath: null, text: 'nombre: Domingo\nfecha: 2026-11-22\nC', status: 'pending', updatedAt: 1 },
    { key: 'k2', op: 'save', path: 'Listas/2026-11-15 Domingo.txt', origPath: 'Listas/Domingo.txt', text: 'nombre: Domingo\nfecha: 2026-11-15\nA\nD', status: 'conflict', updatedAt: 2 },
    { key: 'k3', op: 'delete', origPath: 'Listas/Pascua.txt', status: 'pending', updatedAt: 3 },
  ]);
  const lib = buildLibrary(merged, { today: '2026-11-12' });
  assert.deepEqual(
    lib.lists.map((l) => [l.id, l.items.length, l.pending?.status ?? null]),
    [
      ['Listas/2026-11-15 Domingo.txt', 2, 'conflict'],
      ['Listas/2026-11-22 Domingo.txt', 1, 'pending'],
    ],
  );
  assert.equal(applyOutbox(files, []), files);
});
