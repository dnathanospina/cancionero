import { h } from '../ui/dom.js';
import { state } from '../state.js';
import { link, listCard, emptyState, pageHeader, songRow, displayKey, pendingChip } from '../ui/components.js';
import { todayISO } from '../util/text.js';
import { resolveItem, SECTION_LABEL } from '../library/library.js';
import { longDate, relativeDay, plural } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';
import { songHref } from './home.js';
import { openListenSheet } from '../features/listen.js';
import { isLeader, exitLeader } from '../leader/leader.js';
import { requestLeader } from '../leader/leader-ui.js';
import { deleteList, flushOutbox, outboxFor, retryEntry } from '../lists/outbox-runner.js';
import { conflictSheet } from './conflict.js';
import { nextSundayISO } from '../lists/files.js';

/** Barra del modo líder: entrar, o crear listas y salir. */
function leaderBar() {
  if (!isLeader()) {
    return h(
      'div.leader-bar',
      h('button.btn.ghost.small', { onclick: async () => (await requestLeader()) && refreshView() }, icon('lock', { size: 16 }), 'Editar listas'),
    );
  }
  const sunday = longDate(nextSundayISO());
  return h(
    'div.leader-bar.on',
    h('div.leader-tag', icon('unlock', { size: 16 }), 'Modo líder', h('button.link-btn', { onclick: () => (exitLeader(), toast('Has salido del modo líder')) }, 'Salir')),
    h(
      'div.leader-actions',
      h('a.btn.primary', { href: link('/listas/nueva?plantilla=domingo') }, icon('plus', { size: 18 }), 'Nuevo domingo', h('small', sunday.replace(/^[^,]+, /, ''))),
      h('a.btn.ghost', { href: link('/listas/nueva?plantilla=evento') }, icon('calendar', { size: 18 }), 'Evento especial'),
    ),
  );
}

const refreshView = () => dispatchEvent(new HashChangeEvent('hashchange'));

/** Aviso con los cambios guardados en el dispositivo que aún no se han subido. */
function outboxBanner() {
  const n = state.outbox.length;
  if (!n) return null;
  const conflicts = state.outbox.filter((e) => e.status === 'conflict').length;
  const errors = state.outbox.filter((e) => e.status === 'error').length;
  const pending = n - conflicts - errors;
  const parts = [];
  if (pending) parts.push(plural(pending, 'cambio pendiente de subir', 'cambios pendientes de subir'));
  if (conflicts) parts.push(plural(conflicts, 'conflicto', 'conflictos'));
  if (errors) parts.push(plural(errors, 'error', 'errores'));
  return h(
    `div.banner${conflicts || errors ? '.alert' : ''}`,
    icon(conflicts || errors ? 'alert' : 'cloud', { size: 18 }),
    h('span', parts.join(' · '), pending && !navigator.onLine ? ' (sin conexión: se subirán solos)' : ''),
    pending && navigator.onLine ? h('button.btn.small.ghost', { onclick: () => flushOutbox() }, 'Subir ahora') : null,
  );
}

export function ListsView() {
  const today = todayISO();
  const lists = state.library.lists;
  const upcoming = lists.filter((l) => l.date && l.date >= today);
  const undated = lists.filter((l) => !l.date);
  const past = lists.filter((l) => l.date && l.date < today);
  const el = h('div.view.lists', pageHeader('Listas', 'Preparadas para cada evento. Se actualizan para todo el equipo.'), leaderBar(), outboxBanner());
  if (!lists.length) el.append(emptyState('Todavía no hay listas', isLeader() ? 'Crea la primera con «Nuevo domingo».' : 'El líder de alabanza las prepara para cada evento.'));
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
  const leader = isLeader();
  const entry = outboxFor(list.id);

  const statusBanner = entry
    ? entry.status === 'conflict'
      ? h(
          'div.banner.alert',
          icon('alert', { size: 18 }),
          h('span', 'Otra persona ha cambiado esta lista mientras la editabas. Tu versión está guardada en este dispositivo.'),
          leader ? h('button.btn.small.primary', { onclick: () => conflictSheet(entry) }, 'Resolver') : h('span.muted', 'Entra en modo líder para resolverlo.'),
        )
      : entry.status === 'error'
        ? h('div.banner.alert', icon('alert', { size: 18 }), h('span', `No se pudo subir: ${entry.error}`), h('button.btn.small.ghost', { onclick: () => retryEntry(entry.key) }, 'Reintentar'))
        : h('div.banner', icon('cloud', { size: 18 }), h('span', navigator.onLine ? 'Subiendo los cambios…' : 'Guardada en este dispositivo. Se subirá sola al recuperar la conexión.'))
    : null;

  const remove = async () => {
    const ok = await confirmDialog({
      title: `¿Borrar «${list.name}»?`,
      text: `${longDate(list.date)} · ${plural(list.items.length, 'canción', 'canciones')}. Se borrará para todo el equipo. Las canciones no se tocan.`,
      confirm: 'Borrar lista',
      danger: true,
    });
    if (!ok) return;
    await deleteList(list.id);
    toast(navigator.onLine ? 'Lista borrada' : 'Lista borrada en este dispositivo. Se borrará para todos al recuperar la conexión.');
    location.replace(link('/listas'));
  };

  const el = h(
    'div.view.list-detail',
    h('a.back-link', { href: link('/listas') }, icon('back', { size: 18 }), 'Listas'),
    statusBanner,
    h(
      'header.page-head',
      h('h1', list.name, list.pending ? pendingChip(list.pending.status) : null),
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
    leader
      ? h(
          'div.leader-tools',
          h('span.leader-tag', icon('unlock', { size: 15 }), 'Modo líder'),
          h('a.btn.small.primary', { href: link('/listas/editar/' + encodeURIComponent(list.id)) }, icon('edit', { size: 16 }), 'Editar'),
          h('a.btn.small.ghost', { href: link('/listas/duplicar/' + encodeURIComponent(list.id)) }, icon('copy', { size: 16 }), 'Duplicar'),
          h('button.btn.small.ghost.danger-text', { onclick: remove }, icon('trash', { size: 16 }), 'Borrar'),
        )
      : null,
    items.length
      ? h(
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
        )
      : emptyState('Lista sin canciones', leader ? 'Pulsa «Editar» para añadirlas.' : null),
  );
  return { el };
}
