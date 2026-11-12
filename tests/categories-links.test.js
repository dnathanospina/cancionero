import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChordPro } from '../src/chordpro/parser.js';
import { songMeta } from '../src/chordpro/song-doc.js';
import { youtubeInfo, youtubePlaylistUrl, parseLinksFile, cleanLink } from '../src/links/links.js';
import { buildLibrary, categoriesOf, searchSongs, classifyPath, ALL, NONE } from '../src/library/library.js';

test('lee etiquetas de SongBook y variantes', () => {
  const doc = parseChordPro(
    '{title: X}\n{tag: Himnos}\n{tag: Adoración (lentas)}\n{category: Navidad, Himnos}\n{x_sbp_tags: lenta; vals}\n{meta: keywords Pascua}\n{keywords: }',
  );
  assert.deepEqual(doc.meta.tags, ['Himnos', 'Adoración (lentas)', 'Navidad', 'lenta', 'vals', 'Pascua']);
});

test('lee el enlace de la canción', () => {
  assert.equal(songMeta('{x_youtube: https://youtu.be/abcdefghijk}', 'cho').link, 'https://youtu.be/abcdefghijk');
  assert.equal(songMeta('{link: https://example.org/a}\n{youtube: https://youtu.be/zzzzzzzzzzz}', 'cho').link, 'https://youtu.be/zzzzzzzzzzz');
  assert.equal(songMeta('{title: Y}', 'cho').link, '');
});

test('reconoce URLs de YouTube', () => {
  for (const u of [
    'https://www.youtube.com/watch?v=abcdefghijk&t=10',
    'https://youtu.be/abcdefghijk?si=x',
    'https://m.youtube.com/watch?v=abcdefghijk',
    'https://music.youtube.com/watch?v=abcdefghijk',
    'https://www.youtube.com/shorts/abcdefghijk',
  ]) {
    assert.equal(youtubeInfo(u)?.id, 'abcdefghijk', u);
  }
  assert.equal(youtubeInfo('https://example.org/watch?v=abcdefghijk'), null);
  assert.equal(cleanLink('ver: https://open.spotify.com/track/1 (oficial)'), 'https://open.spotify.com/track/1');
  assert.equal(
    youtubePlaylistUrl(['https://youtu.be/aaaaaaaaaaa', 'https://example.org', 'https://youtu.be/bbbbbbbbbbb']),
    'https://www.youtube.com/watch_videos?video_ids=aaaaaaaaaaa,bbbbbbbbbbb',
  );
});

test('lee archivos de enlaces en varios formatos', () => {
  const txt = [
    '# Enlaces del equipo',
    'Castillo fuerte | https://youtu.be/aaaaaaaaaaa',
    '"Santo santo santo";"https://www.youtube.com/watch?v=bbbbbbbbbbb"',
    '1. 10.000 razones - https://youtu.be/ccccccccccc',
    'Sublime gracia',
    'https://youtu.be/ddddddddddd',
  ].join('\n');
  assert.deepEqual(parseLinksFile(txt, 'txt', 'Enlaces'), [
    { name: 'Castillo fuerte', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' },
    { name: 'Santo santo santo', url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' },
    { name: '10.000 razones', url: 'https://www.youtube.com/watch?v=ccccccccccc' },
    { name: 'Sublime gracia', url: 'https://www.youtube.com/watch?v=ddddddddddd' },
  ]);
  assert.deepEqual(parseLinksFile('[InternetShortcut]\r\nURL=https://youtu.be/eeeeeeeeeee\r\n', 'url', 'Noche de paz'), [
    { name: 'Noche de paz', url: 'https://www.youtube.com/watch?v=eeeeeeeeeee' },
  ]);
  assert.deepEqual(
    parseLinksFile('<plist><dict><key>URL</key><string>https://youtu.be/fffffffffff</string></dict></plist>', 'webloc', 'Himno'),
    [{ name: 'Himno', url: 'https://www.youtube.com/watch?v=fffffffffff' }],
  );
  assert.deepEqual(parseLinksFile('https://youtu.be/ggggggggggg\n', 'txt', 'Amazing Grace'), [
    { name: 'Amazing Grace', url: 'https://www.youtube.com/watch?v=ggggggggggg' },
  ]);
  assert.deepEqual(classifyPath('Enlaces/Noche de paz.url'), { section: 'enlaces', ext: 'url', kind: 'links' });
});

const files = [
  { path: 'Voces/Castillo fuerte.cho', section: 'voces', kind: 'text', ext: 'cho', meta: { tags: ['Himnos', 'Alabanzas (rápidas)'] } },
  { path: 'Voces/Navidad/Noche de paz.cho', section: 'voces', kind: 'text', ext: 'cho', meta: { tags: ['Adoración (lentas)'], link: 'https://youtu.be/hhhhhhhhhhh' } },
  { path: 'Voces/Doxología.txt', section: 'voces', kind: 'text', ext: 'txt', meta: {} },
  { path: 'Bateria/Castillo fuerte.pdf', section: 'bateria', kind: 'pdf', ext: 'pdf' },
  { path: 'Bateria/Himnos/Amazing Grace/1.png', section: 'bateria', kind: 'image', ext: 'png' },
  { path: 'Enlaces/enlaces.txt', section: 'enlaces', kind: 'links', ext: 'txt', text: 'castillo FUERTE | https://youtu.be/aaaaaaaaaaa' },
];

test('categorías desde etiquetas y carpetas, con recuento', () => {
  const lib = buildLibrary(files);
  const cats = categoriesOf(lib, 'voces');
  assert.deepEqual(
    cats.map((c) => `${c.label}:${c.count}`),
    ['Todas:3', 'Sin categoría:1', 'Adoración (lentas):1', 'Alabanzas (rápidas):1', 'Himnos:1', 'Navidad:1'],
  );
  assert.deepEqual(searchSongs(lib, 'voces', '', 'himnos').map((s) => s.name), ['Castillo fuerte']);
  assert.deepEqual(searchSongs(lib, 'voces', '', NONE).map((s) => s.name), ['Doxología']);
  assert.equal(searchSongs(lib, 'voces', 'noche', ALL).length, 1);
  // La batería hereda las categorías de voces; las imágenes en subcarpeta usan la carpeta superior.
  const drums = categoriesOf(lib, 'bateria').map((c) => `${c.label}:${c.count}`);
  assert.deepEqual(drums, ['Todas:2', 'Sin categoría:0', 'Alabanzas (rápidas):1', 'Himnos:2']);
  assert.equal(lib.byId.bateria.get('amazing grace').kind, 'imageset');
});

test('enlaces desde la canción, la carpeta Enlaces y heredados por batería', () => {
  const lib = buildLibrary(files);
  assert.equal(lib.byId.voces.get('noche de paz').link, 'https://www.youtube.com/watch?v=hhhhhhhhhhh');
  assert.equal(lib.byId.voces.get('castillo fuerte').link, 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
  assert.equal(lib.byId.bateria.get('castillo fuerte').link, 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
  assert.equal(lib.byId.voces.get('doxologia').link, '');
});
