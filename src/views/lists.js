import { h } from '../ui/dom.js';
import { state } from '../state.js';
import { link, listCard, emptyState, pageHeader, songRow } from '../ui/components.js';
import { displayKey } from '../ui/components.js';
import { todayISO } from '../util/text.js';
import { resolveItem, SECTION_LABEL } from '../library/library.js';
import { longDate, relativeDay } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { songHref } from './home.js';
import { openListenSheet } from '../features/listen.js';

export function ListsView() {
  const today = todayISO();
  const lists = state.library.lists;
  const upcoming = lists.filter((l) => l.date && l.date >= today);
  const undated = lists.filter((l) => !l.date);
  const past = lists.filter((l) => l.date && l.date < today);
  const el = h('div.view.lists', pageHeader('Listas', 'Preparadas para cada evento. Se actualizan para todo el equipo.'));
  if (!lists.length) el.append(emptyState('Todavía no hay listas', 'Las listas se crean en la carpeta Listas de OneDrive.'));
  if (upcoming.length) el.append(h('h3.section-title', 'Próximas'), h('div.cards', upcoming.map((l, i) => listCard(l, { featured: i === 0 }))));
  if (undated.length) el.append(h('h3.section-title', 'Sin fecha'), h('div.cards', undated.map((l) => listCard(l))));
  if (past.length) el.append(h('h3.section-title', 'Anteriores'), h('div.cards.past', past.map((l) => listCard(l))));
  return { el };
}

export function ListDetailView({ id }) {
  const lib = state.library;
  const list = lib.lists.find((l) => l.id === id);
  if (!list) return { el: h('div.view', emptyState('Lista no encontrada', 'Puede que se haya borrado o renombrado.', h('a.btn.primary', { href: link('/listas') }, 'Ver listas'))) };
  const section = state.settings.section;
  const items = list.items.map((it, i) => ({ it, i, ...resolveItem(lib, it, section) }));
  const first = items.find((x) => x.song);
  const rel = relativeDay(list.date);
  // Los enlaces son de la canción (voces); la batería los hereda.
  const listenItems = list.items.map((it) => {
    const v = resolveItem(lib, it, 'voces').song;
    const d = resolveItem(lib, it, 'bateria').song;
    return { title: v?.title ?? d?.title ?? it.name, link: v?.link || d?.link || '' };
  });

  const el = h(
    'div.view.list-detail',
    h('a.back-link', { href: link('/listas') }, icon('back', { size: 18 }), 'Listas'),
    h(
      'header.page-head',
      h('h1', list.name),
      h('p.page-sub', rel ? h('strong.accent', rel + ' · ') : null, longDate(list.date), list.time ? ` · ${list.time}` : '', list.place ? ` · ${list.place}` : ''),
      list.notes ? h('p.list-notes', list.notes) : null,
      h('p.page-sub', 'Mostrando la parte de ', h('strong', SECTION_LABEL[section])),
    ),
    h(
      'div.actions',
      first ? h('a.btn.primary', { href: songHref(list, first.i, first.song) }, icon('play', { size: 18 }), 'Empezar') : null,
      listenItems.some((x) => x.link)
        ? h('button.btn.ghost', { onclick: () => openListenSheet(list, listenItems) }, icon('headphones', { size: 18 }), 'Escuchar la lista')
        : h('button.btn.ghost', { disabled: true, title: 'Ninguna canción de la lista tiene enlace' }, icon('headphones', { size: 18 }), 'Sin enlaces para escuchar'),
    ),
    h(
      'div.rows.numbered',
      items.map(({ it, i, song, fallback }) =>
        songRow(song ?? { title: it.name, kind: '' }, {
          href: song ? songHref(list, i, song) : undefined,
          number: i + 1,
          keyLabel: displayKey(it.key),
          note: it.notes,
          warn: !song ? 'No encontrada en la biblioteca' : fallback ? 'Sin versión de batería: se abre la de voces' : '',
        }),
      ),
    ),
  );
  return { el };
}
