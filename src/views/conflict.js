import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { openSheet } from '../ui/dialog.js';
import { state } from '../state.js';
import { parseList } from '../lists/format.js';
import { findSong } from '../library/library.js';
import { resolveConflict } from '../lists/outbox-runner.js';
import { displayKey, link } from '../ui/components.js';
import { longDate } from '../ui/format.js';
import { splitPath } from '../util/text.js';

function summary(title, text, path, others = null) {
  if (text == null) return h('div.version', h('h3', title), h('p.muted', 'Ya no existe (la han borrado).'));
  const l = parseList(text, splitPath(path ?? '').base);
  const otherNames = others ? others.items.map((x) => x.name.toLowerCase()) : null;
  return h(
    'div.version',
    h('h3', title),
    h('p.version-meta', h('strong', l.name), ' · ', longDate(l.date), l.time ? ` · ${l.time}` : ''),
    l.notes ? h('p.version-notes', l.notes) : null,
    h(
      'ol',
      l.items.map((it) => {
        const t = findSong(state.library, 'voces', it.name)?.title ?? it.name;
        const changed = otherNames && !otherNames.includes(it.name.toLowerCase());
        return h('li', { class: changed ? 'diff' : '' }, t, it.key ? h('span.chip.key', displayKey(it.key)) : null);
      }),
    ),
  );
}

/** Ventana para resolver un conflicto de una lista. */
export function conflictSheet(entry) {
  const c = entry.conflict ?? {};
  const isDelete = entry.op === 'delete';
  const theirs = c.text != null ? parseList(c.text, splitPath(c.path ?? '').base) : null;
  const mine = !isDelete ? parseList(entry.text, splitPath(entry.path).base) : null;

  const text =
    c.reason === 'exists'
      ? 'Ya hay otra lista con el mismo nombre de archivo (mismo nombre y fecha).'
      : c.reason === 'deleted'
        ? 'Otra persona ha borrado esta lista mientras la editabas.'
        : isDelete
          ? 'Querías borrar esta lista, pero otra persona la ha cambiado mientras tanto.'
          : 'Otra persona ha cambiado esta lista mientras la editabas. Elige qué versión se queda.';

  const options = isDelete
    ? [
        { value: 'theirs', label: 'No borrar: quedarme con su versión', kind: 'primary' },
        { value: 'mine', label: 'Borrar igualmente', kind: 'danger' },
      ]
    : [
        { value: 'theirs', label: c.text == null ? 'Descartar mis cambios' : 'Quedarme con su versión', kind: 'ghost' },
        { value: 'copy', label: 'Guardar la mía como copia', kind: 'ghost' },
        { value: 'mine', label: c.reason === 'deleted' ? 'Volver a crearla con la mía' : 'Sobrescribir con la mía', kind: 'primary' },
      ];

  let choice = null;
  const s = openSheet({
    title: 'Conflicto en una lista',
    wide: true,
    body: [
      h('p.dialog-text', text),
      h(
        'div.versions',
        summary('Su versión (la de OneDrive)', c.text ?? null, c.path, mine),
        isDelete ? h('div.version', h('h3', 'Tu cambio'), h('p', 'Borrar la lista.')) : summary('Tu versión (en este dispositivo)', entry.text, entry.path, theirs),
      ),
      h('p.muted.small', 'Las canciones resaltadas no están en la otra versión.'),
    ],
    footer: options.map((o) => h(`button.btn.${o.kind}`, { onclick: () => ((choice = o.value), s.close()) }, o.label)),
    onClose: async () => {
      if (!choice) return;
      const path = await resolveConflict(entry.key, choice);
      toast(choice === 'theirs' ? 'Te has quedado con su versión' : choice === 'copy' ? 'Tu versión se ha guardado como copia' : isDelete ? 'Lista borrada' : 'Se ha guardado tu versión');
      const gone = (choice === 'mine' && isDelete) || (choice === 'theirs' && c.text == null);
      const target = gone || !path ? '/listas' : '/lista/' + encodeURIComponent(path);
      location.replace(link(target));
    },
  });
  s.el.classList.add('choices');
}
