import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { state } from '../state.js';
import { searchSongs, categoriesOf, SECTION_LABEL, ALL } from '../library/library.js';
import { link, songRow, emptyState, pageHeader, displayKey } from '../ui/components.js';
import { plural } from '../ui/format.js';

// Última categoría elegida en cada sección (mientras la app está abierta).
const lastCategory = { voces: ALL, bateria: ALL };

export function SongsView({ query }) {
  const section = state.settings.section;
  const lib = state.library;
  const cats = categoriesOf(lib, section);
  let category = query.get('cat') ?? lastCategory[section];
  if (!cats.some((c) => c.id === category)) category = ALL;

  const el = h('div.view.songs');
  const results = h('div.results');
  const count = h('p.page-sub');
  const chips = h('div.cat-chips', { role: 'tablist', 'aria-label': 'Categorías' });

  const input = h('input', {
    type: 'search',
    value: query.get('q') ?? '',
    placeholder: 'Título o artista',
    'aria-label': 'Buscar por título o artista',
    enterkeyhint: 'search',
    autocomplete: 'off',
    oninput: () => {
      render();
      saveUrl();
    },
  });

  function saveUrl() {
    const q = input.value.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category !== ALL) params.set('cat', category);
    const qs = params.toString();
    history.replaceState(null, '', link('/canciones' + (qs ? '?' + qs : '')));
  }

  function renderChips() {
    clear(chips);
    for (const c of cats) {
      if (c.id !== ALL && !c.count) continue; // «Sin categoría» vacía no se muestra
      const on = c.id === category;
      chips.append(
        h(
          'button.cat-chip',
          {
            role: 'tab',
            'aria-selected': String(on),
            class: on ? 'on' : '',
            onclick: () => {
              category = c.id;
              lastCategory[section] = c.id;
              renderChips();
              render();
              saveUrl();
            },
          },
          h('span', c.label),
          h('span.cat-count', String(c.count)),
        ),
      );
    }
    requestAnimationFrame(() => chips.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }

  function render() {
    const found = searchSongs(lib, section, input.value, category);
    const catLabel = cats.find((c) => c.id === category)?.label;
    const where = category === ALL ? SECTION_LABEL[section] : `«${catLabel}»`;
    count.textContent = input.value.trim()
      ? `${plural(found.length, 'resultado', 'resultados')} en ${where}`
      : `${plural(found.length, 'canción', 'canciones')} en ${where}`;
    clear(results);
    if (!found.length) {
      results.append(emptyState('Sin resultados', category === ALL ? 'Prueba con otra palabra del título o del artista.' : 'Prueba con otra categoría o con «Todas».'));
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
    h('div.sticky-search', pageHeader('Canciones'), h('label.search', icon('search', { size: 20 }), input), chips, count),
    results,
  );
  renderChips();
  render();
  return { el, focus: () => !input.value && matchMedia('(hover: hover)').matches && input.focus() };
}
