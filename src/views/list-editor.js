import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openSheet, confirmDialog } from '../ui/dialog.js';
import { makeSortable } from '../ui/reorder.js';
import { state, emitChange } from '../state.js';
import * as db from '../db.js';
import { findSong, drumVersion, searchSongs, categoriesOf, ALL } from '../library/library.js';
import { parseKey } from '../music/chords.js';
import { keyName } from '../music/transpose.js';
import { link, displayKey, emptyState } from '../ui/components.js';
import { isLeader } from '../leader/leader.js';
import { requestLeader } from '../leader/leader-ui.js';
import { saveList, flushOutbox, outboxFor } from '../lists/outbox-runner.js';
import { nextSundayISO } from '../lists/files.js';
import { longDate, timeAgo, plural } from '../ui/format.js';

const DRAFT_KEY = 'editor-borrador';

const blank = () => ({ name: '', date: '', time: '', place: '', notes: '', items: [] });

function fromList(list) {
  return {
    name: list.name ?? '',
    date: list.date ?? '',
    time: list.time ?? '',
    place: list.place ?? '',
    notes: list.notes ?? '',
    items: list.items.map((it) => ({ name: it.name, key: it.key ?? '', notes: it.notes ?? '' })),
  };
}

function sundayTemplate() {
  return { ...blank(), name: 'Domingo', date: nextSundayISO(), time: state.settings.sundayTime || '11:00' };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Editor de listas (modo líder).
 *  mode: 'new' (plantilla: 'domingo' | 'evento'), 'edit' (id), 'duplicate' (id)
 */
export function ListEditorView({ mode, id, query }) {
  const lib = state.library;
  const el = h('div.view.list-editor');
  const cleanups = [];

  if (!isLeader()) {
    el.append(
      emptyState(
        'Solo en modo líder',
        'Para crear o editar listas hace falta el PIN de líder.',
        h('button.btn.primary', { onclick: async () => (await requestLeader()) && dispatchEvent(new HashChangeEvent('hashchange')) }, icon('lock', { size: 18 }), 'Entrar en modo líder'),
      ),
    );
    return { el };
  }

  const source = mode !== 'new' ? lib.lists.find((l) => l.id === id) : null;
  if (mode !== 'new' && !source) {
    el.append(emptyState('Lista no encontrada', 'Puede que se haya borrado o renombrado.', h('a.btn.primary', { href: link('/listas') }, 'Ver listas')));
    return { el };
  }

  const originalId = mode === 'edit' ? source.id : null;
  let initial;
  if (mode === 'edit') initial = fromList(source);
  else if (mode === 'duplicate') initial = { ...fromList(source), date: nextSundayISO(), name: source.name };
  else initial = query.get('plantilla') === 'evento' ? blank() : sundayTemplate();

  let draft = structuredClone(initial);
  const dirty = () => !same(draft, initial);

  // ---------- Borrador local (por si se cierra la app a mitad)
  let saveTimer;
  function persistDraft() {
    clearTimeout(saveTimer);
    state.editingDirty = dirty();
    saveTimer = setTimeout(() => {
      if (dirty()) db.kvSet(DRAFT_KEY, { mode, originalId, draft, at: Date.now() });
      else db.kvDelete(DRAFT_KEY);
    }, 300);
  }
  const dropDraft = () => {
    clearTimeout(saveTimer);
    state.editingDirty = false;
    return db.kvDelete(DRAFT_KEY);
  };

  // ---------- Cabecera
  const title = mode === 'edit' ? 'Editar lista' : mode === 'duplicate' ? 'Duplicar lista' : 'Nueva lista';
  const backHref = originalId ? link('/lista/' + encodeURIComponent(originalId)) : link('/listas');
  const goBack = async () => {
    if (dirty() && !(await confirmDialog({ title: '¿Descartar los cambios?', text: 'Los cambios de esta lista no se han guardado.', confirm: 'Descartar', danger: true }))) return;
    await dropDraft();
    location.hash = backHref;
  };
  const recover = h('div.recover-slot');
  el.append(
    h('button.back-link', { onclick: goBack }, icon('back', { size: 18 }), originalId ? 'Lista' : 'Listas'),
    h('header.page-head', h('h1', title), h('p.page-sub', 'Se guarda en la carpeta de listas y aparece en los móviles de todos al actualizar.')),
    recover,
  );

  // ---------- Plantillas (solo lista nueva)
  if (mode === 'new') {
    const tplBtn = (label, sub, make, on) =>
      h(
        'button.template',
        {
          class: on ? 'on' : '',
          onclick: async (e) => {
            if (dirty() && draft.items.length && !(await confirmDialog({ title: 'Cambiar de plantilla', text: 'Se perderán las canciones añadidas.', confirm: 'Cambiar' }))) return;
            draft = make();
            initial = structuredClone(draft);
            el.querySelectorAll('.template').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
            renderFields();
            renderItems();
            persistDraft();
          },
        },
        h('strong', label),
        h('span', sub),
      );
    const isEvento = query.get('plantilla') === 'evento';
    el.append(
      h(
        'div.templates',
        tplBtn('Domingo', `${longDate(nextSundayISO())} · ${state.settings.sundayTime || '11:00'}`, sundayTemplate, !isEvento),
        tplBtn('Evento especial', 'Pascua, Navidad, bodas…', blank, isEvento),
      ),
    );
  }

  // ---------- Datos de la lista
  const fields = h('section.form-card');
  function renderFields() {
    clear(fields);
    const input = (key, attrs) =>
      h('input', {
        ...attrs,
        value: draft[key],
        oninput: (e) => {
          draft[key] = e.target.value;
          if (key === 'name' || key === 'date') nameWarn();
          persistDraft();
        },
      });
    const warn = h('p.form-msg');
    function nameWarn() {
      const clash = lib.lists.find((l) => l.id !== originalId && l.date && l.date === draft.date && l.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
      warn.className = clash ? 'form-msg warn-msg' : 'form-msg';
      warn.textContent = clash ? 'Ya hay una lista con este nombre y esta fecha. Se guardará como otra lista.' : '';
    }
    fields.append(
      h('label.field', h('span', 'Nombre'), input('name', { type: 'text', placeholder: 'Domingo, Pascua, Culto de oración…', autocomplete: 'off', enterkeyhint: 'next', maxlength: '80' })),
      h(
        'div.field-row',
        h('label.field', h('span', 'Fecha'), input('date', { type: 'date' })),
        h('label.field', h('span', 'Hora'), input('time', { type: 'time' })),
      ),
      h(
        'label.field',
        h('span', 'Nota ', h('small', '(opcional)')),
        h('textarea', {
          rows: 2,
          placeholder: 'Ensayo a las 10:00, Santa cena…',
          value: draft.notes,
          oninput: (e) => {
            draft.notes = e.target.value.replace(/\n+/g, ' ');
            persistDraft();
          },
        }),
      ),
      warn,
    );
    nameWarn();
  }

  // ---------- Canciones
  const itemsList = h('ol.edit-items');
  const itemsHead = h('h3.section-title');
  const itemsEmpty = h('div.items-empty');
  function songOf(item) {
    return findSong(lib, 'voces', item.name) ?? findSong(lib, 'bateria', item.name);
  }
  function badges(song) {
    const voces = song?.section === 'voces' ? song : null;
    const drums = voces ? drumVersion(lib, voces) : song?.section === 'bateria' ? song : null;
    const linkOk = !!(song?.link || drums?.link);
    return h(
      'span.badges',
      h(`span.badge${drums ? '.ok' : ''}`, { title: drums ? 'Tiene versión de batería' : 'Sin versión de batería' }, icon('drum', { size: 15 }), drums ? 'Batería' : 'Sin batería'),
      h(`span.badge${linkOk ? '.ok' : ''}`, { title: linkOk ? 'Tiene enlace para escuchar' : 'Sin enlace para escuchar' }, icon('headphones', { size: 15 }), linkOk ? 'Enlace' : 'Sin enlace'),
    );
  }
  function renderItems() {
    clear(itemsList);
    itemsHead.textContent = `Canciones (${draft.items.length})`;
    itemsEmpty.replaceChildren(
      draft.items.length ? '' : h('p.muted', 'Todavía no hay canciones. Añádelas desde el cancionero.'),
    );
    draft.items.forEach((it, i) => {
      const song = songOf(it);
      const original = song?.songKey ? displayKey(song.songKey) : '';
      itemsList.append(
        h(
          'li.edit-item',
          h('button.drag', { 'aria-label': `Mover ${song?.title ?? it.name}`, title: 'Arrastra para mover' }, icon('grip', { size: 20 })),
          h('span.row-num', String(i + 1)),
          h(
            'button.edit-main',
            { onclick: () => itemSheet(i), 'aria-label': `Opciones de ${song?.title ?? it.name}` },
            h('span.row-title', song?.title ?? it.name),
            song ? badges(song) : h('span.warn', icon('alert', { size: 14 }), 'No está en el cancionero'),
            it.notes ? h('span.item-note', it.notes) : null,
          ),
          h(
            'button.key-btn',
            { onclick: () => keySheet(i), 'aria-label': 'Tono para este evento', class: it.key ? 'set' : '' },
            h('span.key-label', 'Tono'),
            h('strong', it.key ? displayKey(it.key) : original || '—'),
          ),
          h('button.icon-btn.remove', { 'aria-label': `Quitar ${song?.title ?? it.name}`, onclick: () => removeItem(i) }, icon('close', { size: 18 })),
        ),
      );
    });
  }
  const changeItems = () => {
    renderItems();
    persistDraft();
  };
  function removeItem(i) {
    const [gone] = draft.items.splice(i, 1);
    changeItems();
    toast(`Quitada: ${songOf(gone)?.title ?? gone.name}`, {
      timeout: 8000,
      action: {
        label: 'Deshacer',
        run: () => {
          draft.items.splice(i, 0, gone);
          changeItems();
        },
      },
    });
  }
  cleanups.push(
    makeSortable(itemsList, {
      handle: '.drag',
      onReorder: (from, to) => {
        const [m] = draft.items.splice(from, 1);
        draft.items.splice(to, 0, m);
        changeItems();
      },
    }),
  );

  // ---------- Hoja: tono para el evento
  function keySheet(i) {
    const it = draft.items[i];
    const song = songOf(it);
    const notation = state.settings.notation;
    const current = parseKey(it.key);
    let minor = current?.minor ?? parseKey(song?.songKey ?? '')?.minor ?? false;
    const grid = h('div.key-grid');
    const paint = () => {
      clear(grid);
      for (let pc = 0; pc < 12; pc++) {
        const label = keyName({ pc, minor }, 0, notation);
        const value = keyName({ pc, minor }, 0, 'american');
        const on = current && current.pc === pc && current.minor === minor;
        grid.append(h('button.key-cell', { class: on ? 'on' : '', onclick: () => choose(value) }, label));
      }
    };
    const choose = (value) => {
      it.key = value;
      s.close();
      changeItems();
    };
    const modeSwitch = h(
      'div.segmented.small',
      ['Mayor', 'Menor'].map((label, idx) =>
        h('button', {
          class: (idx === 1) === minor ? 'on' : '',
          onclick: (e) => {
            minor = idx === 1;
            [...modeSwitch.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget));
            paint();
          },
        }, label),
      ),
    );
    paint();
    const s = openSheet({
      title: 'Tono para este evento',
      subtitle: `${song?.title ?? it.name}${song?.songKey ? ` · original: ${displayKey(song.songKey)}` : ''}`,
      body: [modeSwitch, grid],
      footer: [
        h('button.btn.ghost', { onclick: () => choose('') }, 'Tono original'),
      ],
    });
  }

  // ---------- Hoja: opciones de una canción (nota, mover, quitar)
  function itemSheet(i) {
    const it = draft.items[i];
    const song = songOf(it);
    const note = h('textarea', { rows: 2, value: it.notes, placeholder: 'Solo piano en la estrofa 2, repetir coro…' });
    const close = () => {
      it.notes = note.value.replace(/\n+/g, ' ').trim();
      changeItems();
    };
    const move = (d) => {
      const j = i + d;
      if (j < 0 || j >= draft.items.length) return;
      it.notes = note.value.replace(/\n+/g, ' ').trim();
      draft.items.splice(i, 1);
      draft.items.splice(j, 0, it);
      s.close();
      changeItems();
      setTimeout(() => itemSheet(j), 0);
    };
    let removed = false;
    const s = openSheet({
      title: song?.title ?? it.name,
      subtitle: song ? null : 'Esta canción no está en el cancionero (se mantiene el nombre tal cual).',
      body: [
        song ? badges(song) : null,
        h('label.field', h('span', 'Nota para esta canción ', h('small', '(opcional)')), note),
        h(
          'div.item-actions',
          h('button.btn.small.ghost', { disabled: i === 0, onclick: () => move(-1) }, icon('up', { size: 16 }), 'Subir'),
          h('button.btn.small.ghost', { disabled: i === draft.items.length - 1, onclick: () => move(1) }, icon('down', { size: 16 }), 'Bajar'),
          h('button.btn.small.ghost', { onclick: () => (s.close(), keySheet(i)) }, icon('music', { size: 16 }), 'Tono'),
        ),
      ],
      footer: [
        h('button.btn.ghost.danger-text', { onclick: () => ((removed = true), s.close(), removeItem(i)) }, icon('trash', { size: 16 }), 'Quitar de la lista'),
        h('button.btn.primary', { onclick: () => s.close() }, 'Hecho'),
      ],
      onClose: () => !removed && draft.items[i] === it && close(),
    });
  }

  // ---------- Hoja: añadir canciones del cancionero
  function pickerSheet() {
    const cats = categoriesOf(lib, 'voces');
    let cat = ALL;
    const chosen = [];
    const inList = new Set(draft.items.map((x) => songOf(x)?.key).filter(Boolean));
    const search = h('input', { type: 'search', placeholder: 'Buscar por título o artista', 'aria-label': 'Buscar canción', autocomplete: 'off', oninput: () => paint() });
    const chips = h('div.cat-chips.in-sheet');
    const results = h('div.picker-results');
    const addBtn = h('button.btn.primary', { onclick: () => s.close(true) });
    const paintChips = () => {
      clear(chips);
      for (const c of cats) {
        if (c.id !== ALL && !c.count) continue;
        chips.append(
          h('button.cat-chip', { class: c.id === cat ? 'on' : '', onclick: () => ((cat = c.id), paintChips(), paint()) }, h('span', c.label), h('span.cat-count', String(c.count))),
        );
      }
    };
    const paintBtn = () => {
      addBtn.textContent = chosen.length ? `Añadir ${chosen.length}` : 'Añadir';
      addBtn.disabled = !chosen.length;
    };
    function paint() {
      clear(results);
      const found = searchSongs(lib, 'voces', search.value, cat);
      if (!found.length) results.append(h('p.muted.center', 'Sin resultados.'));
      for (const song of found.slice(0, 300)) {
        const already = inList.has(song.key);
        const idx = chosen.findIndex((x) => x.key === song.key);
        results.append(
          h(
            'button.pick-row',
            {
              class: idx >= 0 ? 'on' : already ? 'already' : '',
              'aria-pressed': String(idx >= 0),
              onclick: () => {
                const j = chosen.findIndex((x) => x.key === song.key);
                if (j >= 0) chosen.splice(j, 1);
                else chosen.push(song);
                paint();
                paintBtn();
              },
            },
            h('span.pick-check', idx >= 0 ? h('span', String(idx + 1)) : already ? icon('check', { size: 16 }) : null),
            h('span.row-main', h('span.row-title', song.title), h('span.row-sub', already ? h('span.accent', 'Ya está en la lista') : null, song.artist ? h('span', song.artist) : null), badges(song)),
            song.songKey ? h('span.key-text', displayKey(song.songKey)) : null,
          ),
        );
      }
    }
    paintChips();
    paint();
    paintBtn();
    const s = openSheet({
      title: 'Añadir canciones',
      subtitle: 'Toca para elegir; se añaden en el orden en que las marcas.',
      wide: true,
      body: [h('label.search', icon('search', { size: 20 }), search), chips, results],
      footer: [addBtn],
      onClose: (add) => {
        if (!add || !chosen.length) return;
        for (const song of chosen) draft.items.push({ name: song.name, key: '', notes: '' });
        changeItems();
        toast(`${plural(chosen.length, 'canción añadida', 'canciones añadidas')}`);
      },
    });
    s.el.classList.add('picker');
  }

  // ---------- Guardar
  const saveBtn = h('button.btn.primary', { onclick: save }, icon('check', { size: 18 }), 'Guardar');
  async function save() {
    draft.name = draft.name.trim();
    const problems = [];
    if (!draft.name) problems.push('Escribe un nombre para la lista.');
    if (!draft.date) problems.push('Elige la fecha del evento.');
    if (problems.length) {
      toast(problems.join(' '));
      fields.querySelector(draft.name ? 'input[type=date]' : 'input[type=text]')?.focus();
      return;
    }
    if (!draft.items.length && !(await confirmDialog({ title: 'Lista sin canciones', text: '¿Guardarla igualmente? Podrás añadir canciones más tarde.', confirm: 'Guardar' }))) return;
    saveBtn.disabled = true;
    try {
      const list = { ...draft, items: draft.items.map((x) => ({ ...x })) };
      const newId = await saveList(list, originalId);
      await dropDraft();
      initial = structuredClone(draft);
      await flushOutbox();
      const entry = outboxFor(newId);
      if (!entry) toast('Lista guardada. Aparecerá en todos los móviles al actualizar.');
      else if (entry.status === 'conflict') toast('Lista guardada en este dispositivo, pero hay un conflicto: revísalo en la lista.');
      else toast('Guardada en este dispositivo. Se subirá sola al recuperar la conexión.', { timeout: 6000 });
      location.replace(link('/lista/' + encodeURIComponent(newId)));
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar: ' + (e.message || e));
      saveBtn.disabled = false;
    }
  }

  el.append(
    fields,
    h(
      'div.items-head',
      itemsHead,
      h('button.btn.small.ghost', { onclick: pickerSheet }, icon('plus', { size: 16 }), 'Añadir canciones'),
    ),
    itemsList,
    itemsEmpty,
    h('button.btn.add-songs', { onclick: pickerSheet }, icon('plus', { size: 18 }), 'Añadir canciones del cancionero'),
    h('div.editor-bar', h('button.btn.ghost', { onclick: goBack }, 'Cancelar'), saveBtn),
  );
  renderFields();
  renderItems();

  // ¿Hay cambios sin guardar de una sesión anterior?
  db.kvGet(DRAFT_KEY).then((saved) => {
    if (!saved || saved.mode !== mode || saved.originalId !== originalId || same(saved.draft, draft)) return;
    recover.replaceChildren(
      h(
        'div.banner',
        icon('alert', { size: 18 }),
        h('span', `Tienes cambios sin guardar de ${timeAgo(saved.at)}.`),
        h('button.btn.small.primary', { onclick: () => {
          draft = saved.draft;
          renderFields();
          renderItems();
          persistDraft();
          recover.replaceChildren();
        } }, 'Recuperar'),
        h('button.btn.small.ghost', { onclick: () => (db.kvDelete(DRAFT_KEY), recover.replaceChildren()) }, 'Descartar'),
      ),
    );
  });

  state.editingDirty = false;
  return {
    el,
    destroy() {
      cleanups.forEach((f) => f());
      clearTimeout(saveTimer);
      if (dirty()) db.kvSet(DRAFT_KEY, { mode, originalId, draft, at: Date.now() });
      state.editingDirty = false;
      emitChange('editing');
    },
  };
}
