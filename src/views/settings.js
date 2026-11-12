import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { state, setSettings, runSync, prefetchNeeded, DEFAULT_PEDAL, subscribe } from '../state.js';
import { PEDAL_ACTIONS, keyLabel } from '../features/pedal.js';
import { createBackup, shareOrDownload, restoreBackup } from '../features/backup.js';
import { importFiles, localSongCount, removeAllLocal } from '../features/local-import.js';
import { confirmDialog } from '../ui/dialog.js';
import { isLeader, hasPin, exitLeader } from '../leader/leader.js';
import { requestLeader, changePinSheet } from '../leader/leader-ui.js';
import { upcomingLists } from '../library/library.js';
import { currentSource, reloadLibrary, emitChange } from '../state.js';
import * as db from '../db.js';
import { WRITE_TARGET } from '../config.js';
import { linkReport, SECTION_LABEL } from '../library/library.js';
import { pageHeader, link } from '../ui/components.js';
import { timeAgo, plural } from '../ui/format.js';
import { todayISO } from '../util/text.js';

function segmented(name, value, options, onChange) {
  return h(
    'div.segmented.small',
    { role: 'radiogroup', 'aria-label': name },
    options.map(([v, label]) =>
      h('button', { role: 'radio', 'aria-checked': String(v === value), class: v === value ? 'on' : '', onclick: () => onChange(v) }, label),
    ),
  );
}

function row(title, desc, control) {
  return h('div.set-row', h('div.set-text', h('div.set-title', title), desc ? h('div.set-desc', desc) : null), control);
}

function toggle(label, checked, onChange) {
  return h(
    'label.switch',
    h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }),
    h('span.slider'),
  );
}

const card = (title, ...children) => h('section.set-card', h('h2', title), ...children);

export function SettingsView() {
  const el = h('div.view.settings');
  const cleanups = [];

  function render() {
    const s = state.settings;
    clear(el);
    el.append(pageHeader('Ajustes'));

    el.append(
      card(
        'Lectura',
        row('Sección', 'Qué parte del cancionero ves por defecto.', segmented('Sección', s.section, [['voces', 'Voces'], ['bateria', 'Batería']], (v) => setSettings({ section: v }))),
        row('Notación de acordes', s.notation === 'latin' ? 'Do Re Mi Fa Sol La Si' : 'C D E F G A B', segmented('Notación', s.notation, [['american', 'C D E'], ['latin', 'Do Re Mi']], (v) => setSettings({ notation: v }))),
        row('Tema', null, segmented('Tema', s.theme, [['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']], (v) => setSettings({ theme: v }))),
        row('Solo letra', 'Oculta los acordes (para cantantes).', toggle('Solo letra', s.lyricsOnly, (v) => setSettings({ lyricsOnly: v }))),
        row(
          'Tamaño de letra',
          `${Math.round(s.fontScale * 100)} %`,
          h(
            'div.stepper',
            h('button.ctl-btn', { 'aria-label': 'Más pequeña', onclick: () => setSettings({ fontScale: Math.max(0.7, Math.round((s.fontScale - 0.1) * 10) / 10) }) }, icon('minus', { size: 20 })),
            h('button.ctl-btn', { 'aria-label': 'Más grande', onclick: () => setSettings({ fontScale: Math.min(2.4, Math.round((s.fontScale + 0.1) * 10) / 10) }) }, icon('plus', { size: 20 })),
          ),
        ),
        h('div.preview', { style: { '--fs': s.fontScale } }, h('div.line.has-chords', h('span.w', chunk('G', 'Sublime '), chunk('C', 'gra'), chunk('', 'cia')))),
      ),
    );

    // Modo líder
    const leader = isLeader();
    const timeInput = h('input.time-input', {
      type: 'time',
      value: s.sundayTime || '11:00',
      'aria-label': 'Hora habitual del domingo',
      onchange: (e) => e.target.value && setSettings({ sundayTime: e.target.value }),
    });
    el.append(
      card(
        'Listas y modo líder',
        row(
          'Modo líder',
          leader ? 'Activo en este dispositivo hasta que cierres la app.' : hasPin() ? 'Para crear y editar las listas hace falta el PIN.' : 'Todavía no hay PIN de líder.',
          leader
            ? h('button.btn.small.ghost', { onclick: () => (exitLeader(), toast('Has salido del modo líder')) }, icon('lock', { size: 16 }), 'Salir')
            : h('button.btn.small.primary', { onclick: () => requestLeader() }, icon('unlock', { size: 16 }), hasPin() ? 'Entrar' : 'Crear PIN'),
        ),
        leader ? row('PIN de líder', 'Cámbialo si lo conoce alguien que no debería.', h('button.btn.small.ghost', { onclick: () => changePinSheet() }, 'Cambiar PIN')) : null,
        row('Hora habitual del domingo', 'La propone la plantilla «Domingo» al crear una lista.', timeInput),
        h(
          'p.honest',
          'Sobre la seguridad: el PIN impide editar listas desde la app sin permiso, pero no protege los archivos. Con la contraseña de la cuenta compartida se pueden cambiar directamente en OneDrive.',
        ),
      ),
    );

    // Pedal
    const pedalRows = Object.entries(PEDAL_ACTIONS).map(([action, label]) => {
      const keys = s.pedal[action] ?? [];
      const btn = h('button.btn.small.ghost', { 'aria-label': `Cambiar tecla para ${label}` }, keys.length ? keys.map(keyLabel).join(' · ') : 'Sin asignar');
      btn.onclick = () => {
        btn.textContent = 'Pulsa el pedal…';
        btn.classList.add('listening');
        const onKey = (e) => {
          e.preventDefault();
          window.removeEventListener('keydown', onKey, true);
          if (e.key === 'Escape') return render();
          const pedal = { ...state.settings.pedal };
          for (const k of Object.keys(pedal)) pedal[k] = pedal[k].filter((x) => x !== e.key);
          pedal[action] = [e.key];
          setSettings({ pedal });
        };
        window.addEventListener('keydown', onKey, true);
      };
      return row(label, null, btn);
    });
    el.append(
      card(
        'Pedal Bluetooth',
        h('p.set-desc', 'Empareja el pedal en los ajustes Bluetooth del teléfono. Para cambiar una tecla, pulsa el botón y después el pedal.'),
        ...pedalRows,
        row('Pasar de canción al final', 'Si ya estás al final, «Bajar pantalla» abre la siguiente canción de la lista.', toggle('Pasar de canción al final', s.autoAdvance, (v) => setSettings({ autoAdvance: v }))),
        h('div.set-actions', h('button.btn.small.ghost', { onclick: () => setSettings({ pedal: DEFAULT_PEDAL }) }, 'Restablecer teclas')),
      ),
    );

    // Biblioteca
    const last = state.sync.last;
    const storage = h('span', '…');
    navigator.storage?.estimate?.().then((e) => {
      storage.textContent = `${(e.usage / 1048576).toFixed(1)} MB usados`;
    });
    el.append(
      card(
        'Biblioteca',
        row(
          'Origen',
          'De momento, biblioteca de demostración. OneDrive se conectará cuando se apruebe el registro en Microsoft.',
          segmented('Origen', s.source, [['demo', 'Demostración'], ['onedrive', 'OneDrive']], (v) => (v === 'onedrive' ? toast('OneDrive estará disponible en la próxima versión.') : setSettings({ source: v }))),
        ),
        row(
          'Última actualización',
          last ? timeAgo(last.at) : 'Nunca',
          h('button.btn.small.primary', { disabled: state.sync.running, onclick: () => runSync() }, icon('refresh', { size: 16 }), state.sync.running ? 'Actualizando…' : 'Actualizar'),
        ),
        row('PDF e imágenes', 'Se guardan los de las próximas listas. Activa esto para tener todo sin conexión (ocupa más espacio).', toggle('Descargar todo', s.downloadAll, async (v) => {
          await setSettings({ downloadAll: v });
          if (v) {
            const n = await prefetchNeeded();
            toast(n ? `${plural(n, 'archivo descargado', 'archivos descargados')}` : 'Todo está descargado');
          }
        })),
        row('Espacio en el dispositivo', null, storage),
      ),
    );

    if (s.source === 'demo') {
      const upcoming = upcomingLists(state.library);
      const listSel = h('select', { 'aria-label': 'Lista' }, upcoming.map((l) => h('option', { value: l.id }, l.name)));
      el.append(
        card(
          'Pruebas de la demostración',
          h('p.set-desc', 'En la demostración, lo que guarda el modo líder va a una «OneDrive simulada» dentro de este dispositivo, con las mismas reglas que la real: si no hay conexión queda pendiente, y si otra persona cambió la lista aparece un conflicto.'),
          upcoming.length
            ? row(
                'Simular que otra persona cambia una lista',
                'Después edita esa misma lista y guárdala para ver el aviso de conflicto.',
                h(
                  'div.inline-controls',
                  listSel,
                  h('button.btn.small.ghost', {
                    onclick: async () => {
                      await currentSource().simulateOtherEdit(listSel.value);
                      toast('Hecho: alguien ha cambiado la lista en la OneDrive simulada. Este móvil aún no lo sabe.');
                    },
                  }, 'Simular'),
                ),
              )
            : null,
          row(
            'Restablecer la demostración',
            'Borra las listas creadas o cambiadas en la demostración y los cambios pendientes.',
            h('button.btn.small.ghost.danger-text', {
              onclick: async () => {
                if (!(await confirmDialog({ title: '¿Restablecer la demostración?', text: 'Se perderán las listas creadas o editadas en la demostración.', confirm: 'Restablecer', danger: true }))) return;
                await currentSource().reset();
                for (const e of state.outbox) await db.outboxDelete(e.key);
                await db.kvDelete('editor-borrador');
                await reloadLibrary();
                await runSync({ quiet: true });
                emitChange('outbox');
                toast('Demostración restablecida');
              },
            }, 'Restablecer'),
          ),
        ),
      );
    }

    // Estructura de carpetas en OneDrive (se usará al conectar OneDrive)
    const layout = s.layout;
    const layoutField = (key, label, hint) =>
      h(
        'label.field',
        h('span', label),
        h('input', {
          type: 'text',
          value: layout[key] ?? '',
          placeholder: hint,
          autocomplete: 'off',
          autocapitalize: 'off',
          spellcheck: 'false',
          onchange: (e) => setSettings({ layout: { ...state.settings.layout, [key]: e.target.value.trim().replace(/^\/+|\/+$/g, '') } }),
        }),
      );
    el.append(
      card(
        'Carpetas en OneDrive',
        h('p.set-desc', 'Para adaptarse a la biblioteca que ya tenéis (SongBook) sin reorganizar nada. Se aplicará al conectar OneDrive; en la demostración no cambia nada.'),
        layoutField('root', 'Carpeta del cancionero', 'Por ejemplo: SongBook'),
        layoutField('voces', 'Canciones de voces e instrumentos', 'Vacío = toda la carpeta (las subcarpetas son categorías)'),
        layoutField('bateria', 'Partituras de batería', 'Por ejemplo: Partituras batería'),
        layoutField('enlaces', 'Enlaces para escuchar', 'Por ejemplo: Enlaces'),
        h(
          'p.set-desc',
          'Las listas y el PIN se guardarán en ',
          h('strong', WRITE_TARGET.location === 'appFolder' ? `Aplicaciones/Cancionero Bethel/${WRITE_TARGET.listsFolder}` : `${layout.root}/${WRITE_TARGET.listsFolder}`),
          WRITE_TARGET.location === 'appFolder' ? ' (carpeta propia de la app: no puede tocar las canciones).' : '.',
        ),
      ),
    );

    // Importar
    const sectionSel = h('select', { 'aria-label': 'Sección', value: s.section }, h('option', { value: 'voces' }, SECTION_LABEL.voces), h('option', { value: 'bateria' }, SECTION_LABEL.bateria));
    let duplicates = 'replace';
    const dupSwitch = segmented('Si ya existe', duplicates, [['replace', 'Reemplazar'], ['skip', 'Omitir']], (v) => {
      duplicates = v;
      [...dupSwitch.children].forEach((b, i) => {
        const on = (i === 0) === (v === 'replace');
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
    });
    const status = h('p.form-msg', { role: 'status' });
    const fileInput = h('input', {
      type: 'file',
      multiple: true,
      hidden: true,
      onchange: async (e) => {
        const files = [...e.target.files];
        e.target.value = '';
        if (!files.length) return;
        try {
          const r = await importFiles(files, sectionSel.value, { duplicates, onProgress: (m) => (status.textContent = m) });
          const parts = [];
          if (r.added) parts.push(plural(r.added, 'canción nueva', 'canciones nuevas'));
          if (r.replaced) parts.push(plural(r.replaced, 'reemplazada', 'reemplazadas'));
          if (r.skipped) parts.push(plural(r.skipped, 'omitida (ya existía)', 'omitidas (ya existían)'));
          if (r.unsupported.length) parts.push(plural(r.unsupported.length, 'archivo no admitido', 'archivos no admitidos'));
          toast(parts.length ? 'Importación: ' + parts.join(', ') : 'No se importó nada', { timeout: 6000 });
        } catch (err) {
          console.error(err);
          toast('No se pudo importar: ' + (err.message || err));
        }
        status.textContent = '';
      },
    });
    const nLocal = localSongCount();
    el.append(
      card(
        'Importar canciones a este dispositivo',
        h('p.set-desc', 'Para probar con vuestras canciones reales: se guardan solo en este teléfono, nunca se suben ni se comparten.'),
        h(
          'ul.help-list',
          h('li', h('strong', 'Desde SongBook: '), 'comparte o exporta las canciones en formato ChordPro (una, varias o todas en un .zip) y elígelas aquí.'),
          h('li', h('strong', 'Desde OneDrive: '), 'elige los archivos en el selector, o descarga una carpeta como .zip: sus subcarpetas se convierten en categorías.'),
          h('li', 'Formatos: .cho, .chopro, .chordpro, .pro, .crd, .txt, PDF, imágenes y .zip. Respeta tildes y ñ de archivos antiguos.'),
        ),
        row('Sección', 'Si el .zip trae carpetas «Voces» y «Batería», se respetan.', sectionSel),
        row('Si la canción ya existe', null, dupSwitch),
        status,
        h(
          'div.set-actions',
          h('button.btn.small.primary', { onclick: () => fileInput.click() }, icon('upload', { size: 16 }), 'Elegir archivos'),
          fileInput,
          nLocal
            ? h('button.btn.small.ghost.danger-text', {
                onclick: async () => {
                  if (!(await confirmDialog({ title: '¿Borrar las canciones importadas?', text: `Se borrarán ${plural(nLocal, 'archivo importado', 'archivos importados')} de este dispositivo. La biblioteca compartida no cambia.`, confirm: 'Borrar', danger: true }))) return;
                  const n = await removeAllLocal();
                  toast(plural(n, 'archivo borrado', 'archivos borrados'));
                },
              }, icon('trash', { size: 16 }), `Borrar importadas (${nLocal})`)
            : null,
        ),
      ),
    );

    // Revisión de nombres
    const rep = linkReport(state.library);
    const details = (title, items, fmt) =>
      h('details.review', h('summary', h('span', title), h('span.chip', String(items.length))), items.length ? h('ul', items.slice(0, 200).map((x) => h('li', fmt(x)))) : h('p.muted', 'Todo correcto.'));
    el.append(
      card(
        'Revisión de nombres',
        h('p.set-desc', 'La versión de batería se empareja por nombre de archivo (o con {x_bateria: …} en el archivo de voces).'),
        details('Voces sin versión de batería', rep.vocesSinBateria, (s) => s.title),
        details('Batería sin canción de voces', rep.bateriaSinVoces, (s) => s.name),
        details('Canciones de listas no encontradas', rep.noEncontradas, (x) => `${x.item.name} — ${x.list.name}`),
        details('Archivos repetidos', rep.duplicados, (s) => s.path),
      ),
    );

    // Copias de seguridad
    const restoreInput = h('input', {
      type: 'file',
      hidden: true,
      onchange: async (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
          const r = await restoreBackup(f);
          toast(`Copia restaurada: ${plural(r.prefs, 'ajuste de canción', 'ajustes de canción')}, ${plural(r.files, 'archivo', 'archivos')}`);
        } catch (err) {
          toast(err.message);
        }
      },
    });
    el.append(
      card(
        'Copia de seguridad',
        h('p.set-desc', 'Guarda tus ajustes (tono y capo por canción, zoom, velocidad, pedal…) y los archivos importados en este dispositivo. Las canciones compartidas se recuperan al actualizar.'),
        h(
          'div.set-actions',
          h('button.btn.small.primary', { onclick: async () => shareOrDownload(await createBackup(), `cancionero-copia-${todayISO()}.json`) }, icon('download', { size: 16 }), 'Exportar'),
          h('button.btn.small.ghost', { onclick: () => restoreInput.click() }, icon('upload', { size: 16 }), 'Restaurar'),
          restoreInput,
        ),
      ),
    );

    el.append(h('p.about', `Cancionero Bethel · versión ${__APP_VERSION__}`));
  }

  render();
  // Durante la sincronización solo se repinta al empezar y al terminar.
  let wasRunning = state.sync.running;
  cleanups.push(
    subscribe((w) => {
      if (w === 'sync' && state.sync.running === wasRunning) return;
      wasRunning = state.sync.running;
      if (['settings', 'sync', 'library', 'leader', 'outbox'].includes(w)) render();
    }),
  );
  return { el, destroy: () => cleanups.forEach((f) => f()) };
}

function chunk(chord, text) {
  return h('span.c.has-chord', chord ? h('span.ch', chord) : null, h('span.ly', text));
}
