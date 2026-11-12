import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { state } from '../state.js';
import { searchSongs, SECTION_LABEL } from '../library/library.js';
import { link, songRow, emptyState, pageHeader, displayKey } from '../ui/components.js';
import { plural } from '../ui/format.js';

export function SongsView({ query }) {
  const section = state.settings.section;
  const lib = state.library;
  const el = h('div.view.songs');
  const results = h('div.results');
  const count = h('p.page-sub');

  const input = h('input', {
    type: 'search',
    value: query.get('q') ?? '',
    placeholder: 'Título o artista',
    'aria-label': 'Buscar por título o artista',
    enterkeyhint: 'search',
    autocomplete: 'off',
    oninput: () => {
      render();
      const q = input.value.trim();
      history.replaceState(null, '', link('/canciones' + (q ? '?q=' + encodeURIComponent(q) : '')));
    },
  });

  function render() {
    const found = searchSongs(lib, section, input.value);
    count.textContent = input.value.trim()
      ? `${plural(found.length, 'resultado', 'resultados')} en ${SECTION_LABEL[section]}`
      : `${plural(found.length, 'canción', 'canciones')} en ${SECTION_LABEL[section]}`;
    clear(results);
    if (!found.length) {
      results.append(emptyState('Sin resultados', 'Prueba con otra palabra del título o del artista.'));
      return;
    }
    // Índice por letra cuando no se está buscando.
    const searching = !!input.value.trim();
    let letter = '';
    const frag = document.createDocumentFragment();
    for (const s of found) {
      const l = (s.sortTitle.normalize('NFD')[0] || '#').toUpperCase().replace(/[^A-Z]/, '#');
      if (!searching && l !== letter) {
        letter = l;
        frag.append(h('div.letter', l));
      }
      frag.append(songRow(s, { href: link(`/cancion/${section}/${encodeURIComponent(s.id)}`), keyLabel: displayKey(s.songKey) }));
    }
    results.append(frag);
  }

  el.append(
    h('div.sticky-search', pageHeader('Canciones'), h('label.search', icon('search', { size: 20 }), input), count),
    results,
  );
  render();
  return { el, focus: () => !input.value && matchMedia('(hover: hover)').matches && input.focus() };
}
