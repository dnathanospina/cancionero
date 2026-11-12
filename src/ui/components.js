import { h } from './dom.js';
import { icon } from './icons.js';
import { state, setSettings } from '../state.js';
import { SECTION_SHORT } from '../library/library.js';
import { longDate, relativeDay, plural, shortDate } from './format.js';
import { BRAND } from '../config.js';
import { parseKey } from '../music/chords.js';
import { keyName } from '../music/transpose.js';

/** Tonalidad en la notación elegida ("Re" → "D" si se usa la americana). */
export function displayKey(k) {
  const key = k ? parseKey(k) : null;
  return key ? keyName(key, 0, state.settings.notation) : k || '';
}

export const link = (path) => '#' + path;

/** Selector Voces | Batería (botón píldora segmentado). */
export function sectionSwitch() {
  const el = h('div.segmented', { role: 'tablist', 'aria-label': 'Sección' });
  for (const [id, label] of Object.entries(SECTION_SHORT)) {
    el.append(
      h(
        'button',
        {
          role: 'tab',
          'aria-selected': String(state.settings.section === id),
          class: state.settings.section === id ? 'on' : '',
          onclick: () => state.settings.section !== id && setSettings({ section: id }),
        },
        icon(id === 'voces' ? 'mic' : 'drum', { size: 18 }),
        h('span', label),
      ),
    );
  }
  return el;
}

export function brandMark() {
  return h(
    'a.brand',
    { href: link('/'), 'aria-label': `${BRAND.name} · Inicio` },
    BRAND.logo ? h('img.brand-logo', { src: BRAND.logo, alt: BRAND.name }) : h('span.brand-name', BRAND.name),
    h('span.brand-sub', 'Cancionero'),
  );
}

const KIND_BADGE = { pdf: 'PDF', image: 'IMG', imageset: 'IMG' };

export function songRow(song, { href, number, keyLabel, note, warn } = {}) {
  return h(
    'a.row.song-row',
    { href },
    number != null ? h('span.row-num', String(number)) : null,
    h(
      'span.row-main',
      h('span.row-title', song ? song.title : '—'),
      song?.artist || note || warn
        ? h(
            'span.row-sub',
            warn ? h('span.warn', icon('alert', { size: 14 }), warn) : null,
            song?.artist ? h('span', song.artist) : null,
            note ? h('span.note', note) : null,
          )
        : null,
    ),
    h(
      'span.row-end',
      keyLabel ? h('span.chip.key', keyLabel) : null,
      song && KIND_BADGE[song.kind] ? h('span.chip.kind', KIND_BADGE[song.kind]) : null,
      song?.origin === 'local' ? h('span.chip.kind', 'Local') : null,
    ),
  );
}

export function listCard(list, { featured = false } = {}) {
  const rel = relativeDay(list.date);
  return h(
    `a.card.list-card${featured ? '.featured' : ''}`,
    { href: link('/lista/' + encodeURIComponent(list.id)) },
    h(
      'div.date-badge',
      list.date ? [h('span.d', list.date.slice(8, 10).replace(/^0/, '')), h('span.m', shortDate(list.date).split(' ')[1] ?? '')] : icon('list'),
    ),
    h(
      'div.card-main',
      h('div.card-title', list.name),
      h('div.card-sub', [rel ? h('strong', rel + ' · ') : null, longDate(list.date)]),
      h('div.card-sub.muted', plural(list.items.length, 'canción', 'canciones')),
    ),
    h('span.chev', icon('next')),
  );
}

export function emptyState(title, text, action) {
  return h('div.empty', h('div.empty-title', title), text ? h('p', text) : null, action ?? null);
}

export function pageHeader(title, sub) {
  return h('header.page-head', h('h1', title), sub ? h('p.page-sub', sub) : null);
}
