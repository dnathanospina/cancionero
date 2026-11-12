import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { state, setSettings, runSync, prefetchNeeded, DEFAULT_PEDAL, subscribe } from '../state.js';
import { PEDAL_ACTIONS, keyLabel } from '../features/pedal.js';
import { createBackup, shareOrDownload, restoreBackup } from '../features/backup.js';
import { importFiles } from '../features/local-import.js';
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
          'Fase 1: biblioteca de demostración. La conexión con OneDrive llega en la fase 2.',
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

    // Importar
    const sectionSel = h('select', { 'aria-label': 'Sección' }, h('option', { value: 'voces' }, SECTION_LABEL.voces), h('option', { value: 'bateria' }, SECTION_LABEL.bateria));
    sectionSel.value = s.section;
    const fileInput = h('input', {
      type: 'file',
      multiple: true,
      hidden: true,
      onchange: async (e) => {
        const files = [...e.target.files];
        e.target.value = '';
        if (!files.length) return;
        const r = await importFiles(files, sectionSel.value, {
          confirmReplace: async (name) => confirm(`Ya existe «${name}» en esta sección. ¿Usar el archivo importado en este dispositivo?`),
        });
        const parts = [];
        if (r.added) parts.push(plural(r.added, 'importada', 'importadas'));
        if (r.replaced) parts.push(plural(r.replaced, 'reemplazada', 'reemplazadas'));
        if (r.skipped.length) parts.push(`${r.skipped.length} omitidos`);
        toast(parts.join(' · ') || 'No se importó nada');
      },
    });
    el.append(
      card(
        'Importar archivos',
        h('p.set-desc', 'Añade canciones solo a este dispositivo (.cho, .pro, .chordpro, .txt, PDF o imágenes). Puedes elegirlas desde OneDrive, iCloud o Drive en el selector de archivos.'),
        row('Sección de destino', null, sectionSel),
        h('div.set-actions', h('button.btn.small.primary', { onclick: () => fileInput.click() }, icon('upload', { size: 16 }), 'Elegir archivos'), fileInput),
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
      if (w === 'settings' || w === 'sync' || w === 'library') render();
    }),
  );
  return { el, destroy: () => cleanups.forEach((f) => f()) };
}

function chunk(chord, text) {
  return h('span.c.has-chord', chord ? h('span.ch', chord) : null, h('span.ly', text));
}
