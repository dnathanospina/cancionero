import { h } from './dom.js';
import { icon } from './icons.js';
import { state, setSettings } from '../state.js';
import { SECTION_SHORT } from '../library/library.js';
import { longDate, relativeDay, plural, shortDate } from './format.js';
import { BRAND } from '../config.js';
import { parseKey } from '../music/chords.js';
import { keyName } from '../music/transpose.js';

/** Sostenidos y bemoles tipográficos para mostrar tonalidades: «Mib» → «Mi♭». */
export function prettyKey(name) {
  return String(name ?? '').replace(/^([A-G]|Do|Re|Mi|Fa|Sol|La|Si)([#b])/, (_m, n, a) => n + (a === '#' ? '♯' : '♭'));
}

/** Tonalidad en la notación elegida ("Re" → "D" si se usa la americana), con ♯/♭. */
export function displayKey(k) {
  const key = k ? parseKey(k) : null;
  return key ? prettyKey(keyName(key, 0, state.settings.notation)) : k || '';
}

export const link = (path) => '#' + path;

/** Selector Voces | Batería (control segmentado de cristal). */
export function sectionSwitch() {
  const el = h('div.segmented.glass-seg', { role: 'tablist', 'aria-label': 'Sección' });
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
      song && KIND_BADGE[song.kind] ? h('span.kind', KIND_BADGE[song.kind]) : null,
      song?.origin === 'local' ? h('span.kind', 'Local') : null,
      keyLabel ? h('span.key-text', keyLabel) : null,
      href ? icon('next', { size: 16, cls: 'icon chev' }) : null,
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
      list.date ? [h('span.m', shortDate(list.date).split(' ')[1] ?? ''), h('span.d', list.date.slice(8, 10).replace(/^0/, ''))] : icon('calendar', { size: 20 }),
    ),
    h(
      'div.card-main',
      h('div.card-title', featured ? h('span.dot', { title: 'Próximo evento' }) : null, list.name),
      h('div.card-sub', [rel ? rel + ' · ' : '', longDate(list.date), ' · ', plural(list.items.length, 'canción', 'canciones')]),
      list.pending ? pendingChip(list.pending.status) : null,
    ),
    icon('next', { size: 16, cls: 'icon chev' }),
  );
}

const PENDING_LABEL = { pending: 'Pendiente de subir', conflict: 'Conflicto', error: 'No se pudo subir' };
/** Etiqueta de estado de una lista guardada en el dispositivo y aún no subida. */
export function pendingChip(status) {
  return h(`span.status-chip.${status}`, icon(status === 'pending' ? 'cloud' : 'alert', { size: 13 }), PENDING_LABEL[status] ?? status);
}

export function emptyState(title, text, action) {
  return h('div.empty', h('div.empty-title', title), text ? h('p', text) : null, action ?? null);
}

/** Título grande (se encoge al desplazar) con subtítulo y contenido extra opcionales. */
export function pageHeader(title, sub, ...extra) {
  return h('header.page-head', h('h1', title), sub ? h('p.page-sub', sub) : null, ...extra);
}
