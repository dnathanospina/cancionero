import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { state } from '../state.js';
import { nextEvent, upcomingLists, resolveItem, SECTION_LABEL } from '../library/library.js';
import { link, listCard, songRow, emptyState } from '../ui/components.js';
import { displayKey } from '../ui/components.js';
import { longDate, relativeDay, plural } from '../ui/format.js';
import { installBanner } from '../features/install.js';

export function HomeView() {
  const lib = state.library;
  const section = state.settings.section;
  const el = h('div.view.home');

  const banner = installBanner();
  if (banner) el.append(banner);

  el.append(
    h(
      'form.search-jump',
      {
        role: 'search',
        onsubmit: (e) => {
          e.preventDefault();
          const q = new FormData(e.target).get('q');
          location.hash = link('/canciones' + (q ? '?q=' + encodeURIComponent(q) : ''));
        },
      },
      icon('search', { size: 20 }),
      h('input', { name: 'q', type: 'search', placeholder: `Buscar en ${SECTION_LABEL[section].toLowerCase()}…`, 'aria-label': 'Buscar canción', enterkeyhint: 'search', autocomplete: 'off' }),
    ),
  );

  const total = lib.songs.voces.length + lib.songs.bateria.length;
  if (!total && !lib.lists.length) {
    el.append(
      state.sync.running
        ? emptyState('Preparando la biblioteca…', 'Descargando canciones por primera vez.')
        : emptyState('La biblioteca está vacía', 'Pulsa actualizar para descargar las canciones.'),
    );
    return { el };
  }

  const next = nextEvent(lib);
  if (next) {
    const rel = relativeDay(next.date);
    const items = next.items.map((it, i) => ({ it, i, ...resolveItem(lib, it, section) }));
    const listHref = link('/lista/' + encodeURIComponent(next.id));
    const first = items.find((x) => x.song);
    el.append(
      h(
        'section.hero',
        { 'aria-label': 'Próximo evento' },
        h('div.hero-kicker', h('span.dot'), 'Próximo evento', rel ? h('span.hero-rel', rel) : null),
        h('h2.hero-title', next.name),
        h('p.hero-date', longDate(next.date), next.time ? ` · ${next.time}` : '', next.place ? ` · ${next.place}` : ''),
        next.notes ? h('p.hero-notes', next.notes) : null,
        h(
          'ol.hero-songs',
          items.slice(0, 6).map(({ it, song, fallback }) =>
            h('li', h('span', song ? song.title : it.name), it.key ? h('span.chip.key', displayKey(it.key)) : null, !song || fallback ? h('span.warn-dot', { title: 'Revisar' }) : null),
          ),
          items.length > 6 ? h('li.more', `y ${items.length - 6} más…`) : null,
        ),
        h(
          'div.hero-actions',
          first
            ? h('a.btn.primary', { href: songHref(next, first.i, first.song) }, icon('play', { size: 18 }), 'Empezar')
            : null,
          h('a.btn.ghost', { href: listHref }, 'Ver lista'),
        ),
        h('p.hero-section', 'Mostrando: ', h('strong', SECTION_LABEL[section])),
      ),
    );
  }

  const others = upcomingLists(lib).filter((l) => l !== next);
  if (others.length) {
    el.append(h('h3.section-title', 'Más eventos'), h('div.cards', others.slice(0, 4).map((l) => listCard(l))));
  }

  el.append(
    h(
      'div.quick',
      h('a.quick-item', { href: link('/canciones') }, icon('music'), h('span', 'Todas las canciones'), h('small', plural(lib.songs[section].length, 'canción', 'canciones'))),
      h('a.quick-item', { href: link('/listas') }, icon('calendar'), h('span', 'Todas las listas'), h('small', plural(lib.lists.length, 'lista', 'listas'))),
    ),
  );

  if (!next) {
    el.append(emptyState('No hay eventos próximos', 'Cuando alguien prepare una lista con fecha, aparecerá aquí destacada.'));
  }
  return { el };
}

export function songHref(list, index, song) {
  const section = song?.section ?? state.settings.section;
  return link(`/cancion/${section}/${encodeURIComponent(song?.id ?? '')}?lista=${encodeURIComponent(list.id)}&i=${index}`);
}
