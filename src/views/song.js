import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { state, subscribe, setSettings, currentSource } from '../state.js';
import * as db from '../db.js';
import { resolveItem, drumVersion, vocesVersion, SECTION_SHORT } from '../library/library.js';
import { loadSongDoc } from '../chordpro/song-doc.js';
import { firstChord } from '../chordpro/parser.js';
import { renderSong } from '../viewers/chordpro-view.js';
import { createPageStack } from '../viewers/page-stack.js';
import { parseKey, semitoneDiff } from '../music/chords.js';
import { makeChordTransformer, keyName, shiftKey } from '../music/transpose.js';
import { createAutoScroller, SPEED_MIN, SPEED_MAX } from '../features/autoscroll.js';
import { listenPedal } from '../features/pedal.js';
import { keepAwake } from '../features/wakelock.js';
import { ensureBlob } from '../sync/sync.js';
import { link, emptyState } from '../ui/components.js';

const FONT_MIN = 0.7;
const FONT_MAX = 2.4;

function songUrl(list, index, song, ver) {
  if (!list) return link(`/cancion/${song.section}/${encodeURIComponent(song.id)}`);
  return link(
    `/cancion/${song.section}/${encodeURIComponent(song.id)}?lista=${encodeURIComponent(list.id)}&i=${index}` + (ver ? `&ver=${ver}` : ''),
  );
}

export function SongView({ section, id, query, backHref }) {
  const lib = state.library;
  const list = query.get('lista') ? lib.lists.find((l) => l.id === query.get('lista')) : null;
  const index = list ? parseInt(query.get('i') ?? '0', 10) : -1;
  const ver = query.get('ver'); // sección forzada dentro de una lista
  const item = list?.items[index] ?? null;

  let song;
  let fallback = false;
  if (item) {
    ({ song, fallback } = resolveItem(lib, item, ver || state.settings.section));
  } else {
    song = lib.byId[section]?.get(id) ?? null;
  }

  const back = list ? link('/lista/' + encodeURIComponent(list.id)) : backHref || link('/canciones');
  if (!song) {
    return {
      el: h('div.view', emptyState('Canción no encontrada', item ? `«${item.name}» no está en la biblioteca.` : 'Puede que se haya borrado o renombrado.', h('a.btn.primary', { href: back }, 'Volver'))),
    };
  }

  // Navegación dentro de la lista: se saltan las canciones que no existen.
  const findStep = (dir) => {
    if (!list) return null;
    for (let j = index + dir; j >= 0 && j < list.items.length; j += dir) {
      const r = resolveItem(lib, list.items[j], state.settings.section);
      if (r.song) return { index: j, song: r.song };
    }
    return null;
  };
  const prev = findStep(-1);
  const next = findStep(1);
  const go = (step) => step && location.replace(songUrl(list, step.index, step.song));

  // Otra versión (voces ⇄ batería).
  const other = song.section === 'voces' ? drumVersion(lib, song) : vocesVersion(lib, song);
  const otherHref = other
    ? list
      ? songUrl(list, index, other, other.section)
      : songUrl(null, 0, other)
    : null;

  const cleanups = [];
  const scroller = h('div.song-scroll', { tabindex: '-1' });
  const paper = h('div.song-paper');
  const controls = h('footer.song-controls', { 'aria-label': 'Controles' });
  const chips = h('div.song-chips');
  scroller.append(paper);

  const screen = h(
    'div.song-screen',
    { style: { '--fs': state.settings.fontScale } },
    h(
      'header.song-top',
      h('a.icon-btn', { href: back, 'aria-label': 'Volver' }, icon('back')),
      h(
        'div.song-titles',
        h('h1', song.title),
        h(
          'p',
          [
            list ? `${list.name} · ${index + 1}/${list.items.length}` : null,
            song.artist || null,
            h('span.section-tag', SECTION_SHORT[song.section]),
          ]
            .filter(Boolean)
            .flatMap((x, i) => (i ? [' · ', x] : [x])),
        ),
      ),
      otherHref
        ? h('a.icon-btn.alt-version', { href: otherHref, 'aria-label': `Ver versión de ${SECTION_SHORT[other.section]}`, title: `Versión de ${SECTION_SHORT[other.section]}` }, icon(other.section === 'bateria' ? 'drum' : 'mic'))
        : null,
      list
        ? h(
            'div.song-nav',
            h('button.icon-btn', { 'aria-label': 'Canción anterior', disabled: !prev, onclick: () => go(prev) }, icon('prev')),
            h('button.icon-btn', { 'aria-label': 'Canción siguiente', disabled: !next, onclick: () => go(next) }, icon('next')),
          )
        : null,
    ),
    fallback ? h('div.song-banner.warn', icon('alert', { size: 16 }), 'No hay versión de batería: se muestra la de voces.') : null,
    item?.notes ? h('div.song-banner', icon('text', { size: 16 }), item.notes) : null,
    scroller,
    controls,
  );

  // ---- Desplazamiento automático
  const speedLabel = h('span.ctl-value');
  const playBtn = h('button.ctl-btn.play', { 'aria-label': 'Desplazamiento automático' });
  const scrollerApi = createAutoScroller(scroller, {
    onChange: (a) => {
      playBtn.replaceChildren(icon(a.running ? 'pause' : 'play', { size: 22 }));
      playBtn.classList.toggle('on', a.running);
      playBtn.setAttribute('aria-pressed', String(a.running));
      speedLabel.textContent = String(a.speed);
      screen.classList.toggle('scrolling', a.running);
    },
  });
  scrollerApi.setSpeed(6);
  playBtn.onclick = () => scrollerApi.toggle();
  const setSpeed = (d) => {
    scrollerApi.setSpeed(scrollerApi.speed + d);
    db.prefPatch(song.key, { speed: scrollerApi.speed });
  };
  const scrollGroup = group('Desplazar', [
    playBtn,
    btn('minus', 'Más lento', () => setSpeed(-1), scrollerApi.speed <= SPEED_MIN),
    speedLabel,
    btn('plus', 'Más rápido', () => setSpeed(1)),
  ]);
  cleanups.push(() => scrollerApi.destroy());

  // ---- Toque en la partitura: muestra/oculta controles o pausa
  let down = null;
  scroller.addEventListener('pointerdown', (e) => {
    down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  });
  scroller.addEventListener('pointerup', (e) => {
    if (!down || e.target.closest('a,button')) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const fast = performance.now() - down.t < 350;
    down = null;
    if (moved > 10 || !fast || stack?.pinching) return;
    if (scrollerApi.running) {
      scrollerApi.stop();
      screen.classList.remove('chrome-hidden');
    } else {
      screen.classList.toggle('chrome-hidden');
    }
  });

  // ---- Pedal / teclado
  const atBottom = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
  const atTop = () => scroller.scrollTop <= 2;
  const page = (dir) => scroller.scrollBy({ top: dir * scroller.clientHeight * 0.8, behavior: 'smooth' });
  const tryStep = (step, last) => {
    if (step) go(step);
    else if (list) toast(last);
  };
  cleanups.push(
    listenPedal(() => state.settings.pedal, {
      scrollDown: (e) => {
        if (atBottom() && list && state.settings.autoAdvance) !e.repeat && tryStep(next, 'Es la última canción de la lista');
        else page(1);
      },
      scrollUp: (e) => {
        if (atTop() && list && state.settings.autoAdvance) !e.repeat && tryStep(prev, 'Es la primera canción de la lista');
        else page(-1);
      },
      nextSong: (e) => !e.repeat && tryStep(next, 'Es la última canción de la lista'),
      prevSong: (e) => !e.repeat && tryStep(prev, 'Es la primera canción de la lista'),
      toggleScroll: (e) => !e.repeat && scrollerApi.toggle(),
    }),
  );
  cleanups.push(keepAwake());

  // ---- Final de la canción
  const endBlock = () =>
    list
      ? h(
          'div.song-end',
          next
            ? h('button.btn.primary', { onclick: () => go(next) }, 'Siguiente: ', h('strong', next.song.title), icon('next', { size: 18 }))
            : h('p.muted', 'Fin de la lista'),
        )
      : h('div.song-end');

  let stack = null;
  const setControls = (...groups) => controls.replaceChildren(...groups.filter(Boolean));

  async function init() {
    const prefs = await db.prefGet(song.key);
    if (prefs.speed) scrollerApi.setSpeed(prefs.speed);
    if (song.kind === 'chordpro') await initChordPro(prefs);
    else await initPages(prefs);
  }

  // ---- ChordPro
  async function initChordPro(prefs) {
    const file = state.files.find((f) => f.path === song.path);
    const doc = loadSongDoc(file?.text ?? '', song.ext);
    const ctxKey = list ? `${list.id}|${song.key}` : null;
    const ctx = ctxKey ? await db.prefGet(ctxKey) : {};

    const written = parseKey(doc.meta.key) ?? parseKey(firstChord(doc) ?? '');
    const fileCapo = Math.max(0, parseInt(doc.meta.capo, 10) || 0);
    const listTarget = item?.key ? parseKey(item.key) : null;
    const listShift = listTarget && written ? semitoneDiff(written.pc + fileCapo, listTarget.pc) : 0;
    const defaultTranspose = ctxKey ? listShift : 0;
    let transpose = (ctxKey ? ctx.transpose : prefs.transpose) ?? defaultTranspose;
    let capo = prefs.capo ?? fileCapo;
    const hasChords = doc.meta.hasChords;

    const body = h('div.song-body');
    paper.replaceChildren(chips, body, endBlock());
    paper.classList.toggle('lyrics-only', state.settings.lyricsOnly && hasChords);

    const keyBtn = h('button.ctl-value.wide', { title: 'Volver al tono original' });
    const capoLabel = h('span.ctl-value');
    const draw = () => {
      const shift = transpose - (capo - fileCapo);
      const notation = state.settings.notation;
      const chordFn = makeChordTransformer({ semitones: shift, notation, targetKey: shiftKey(written, shift) });
      body.replaceChildren(renderSong(doc, { chord: chordFn }));

      const sounding = written ? keyName(written, transpose + fileCapo, notation) : '';
      const rel = transpose === 0 ? '' : ` (${transpose > 0 ? '+' : ''}${transpose})`;
      keyBtn.textContent = sounding ? sounding + rel : (transpose > 0 ? '+' : '') + transpose;
      keyBtn.disabled = transpose === defaultTranspose;
      capoLabel.textContent = String(capo);

      clear(chips);
      if (sounding) chips.append(chip('Tono', sounding, listTarget && transpose === listShift ? 'de la lista' : ''));
      if (capo > 0 && written) chips.append(chip('Capo', String(capo), `formas de ${keyName(written, shift, notation)}`));
      if (doc.meta.tempo) chips.append(chip('Tempo', `${doc.meta.tempo} bpm`));
      if (doc.meta.time) chips.append(chip('Compás', doc.meta.time));
      if (doc.meta.duration) chips.append(chip('Duración', doc.meta.duration));
      if (doc.meta.subtitle) chips.prepend(h('p.song-subtitle', doc.meta.subtitle));
    };
    const saveTranspose = () => (ctxKey ? db.prefPatch(ctxKey, { transpose }) : db.prefPatch(song.key, { transpose }));
    const setT = (d) => {
      transpose = Math.max(-11, Math.min(11, transpose + d));
      saveTranspose();
      draw();
    };
    keyBtn.onclick = () => {
      transpose = defaultTranspose;
      saveTranspose();
      draw();
    };
    const setCapo = (d) => {
      capo = Math.max(0, Math.min(11, capo + d));
      db.prefPatch(song.key, { capo });
      draw();
    };

    const lyricsBtn = h(
      'button.ctl-btn.toggle',
      {
        'aria-pressed': String(state.settings.lyricsOnly),
        onclick: () => setSettings({ lyricsOnly: !state.settings.lyricsOnly }),
      },
      icon('lyrics', { size: 20 }),
      h('span', 'Solo letra'),
    );

    setControls(
      hasChords && written ? group('Tono', [btn('minus', 'Bajar medio tono', () => setT(-1)), keyBtn, btn('plus', 'Subir medio tono', () => setT(1))], 'key') : null,
      hasChords ? group('Capo', [btn('minus', 'Quitar traste de capo', () => setCapo(-1)), capoLabel, btn('plus', 'Añadir traste de capo', () => setCapo(1))]) : null,
      hasChords ? group('Acordes', [lyricsBtn]) : null,
      group('Letra', [btn('minus', 'Letra más pequeña', () => setFont(-0.1), false, 'A'), btn('plus', 'Letra más grande', () => setFont(0.1), false, 'A')], 'font'),
      scrollGroup,
    );

    const unsub = subscribe((what) => {
      if (what !== 'settings') return;
      screen.style.setProperty('--fs', state.settings.fontScale);
      paper.classList.toggle('lyrics-only', state.settings.lyricsOnly && hasChords);
      lyricsBtn.setAttribute('aria-pressed', String(state.settings.lyricsOnly));
      draw();
    });
    cleanups.push(unsub);
    draw();
  }

  const setFont = (d) => {
    const v = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX, state.settings.fontScale + d)) * 10) / 10;
    setSettings({ fontScale: v });
  };

  // ---- PDF e imágenes
  async function initPages(prefs) {
    paper.classList.add('pages-paper');
    paper.replaceChildren(h('div.loading', 'Abriendo partitura…'));
    setControls(scrollGroup);
    let blobs;
    try {
      blobs = await Promise.all(song.paths.map((p) => ensureBlob(currentSource(), p)));
    } catch (e) {
      console.error(e);
      blobs = [null];
    }
    if (blobs.some((b) => !b)) {
      paper.replaceChildren(
        emptyState(
          'Partitura no descargada',
          navigator.onLine ? 'No se pudo descargar. Inténtalo de nuevo.' : 'Conéctate a internet una vez para guardarla en este dispositivo.',
          h('button.btn.primary', { onclick: () => initPages(prefs) }, 'Reintentar'),
        ),
      );
      return;
    }
    let pages;
    try {
      pages =
        song.kind === 'pdf'
          ? await (await import('../viewers/pdf-view.js')).pdfPages(blobs[0])
          : await (await import('../viewers/image-view.js')).imagePages(blobs);
    } catch (e) {
      console.error(e);
      paper.replaceChildren(emptyState('No se pudo abrir la partitura', String(e.message || e)));
      return;
    }
    if (destroyed) return pages.dispose?.();

    const zoomLabel = h('button.ctl-value.wide', { title: 'Ajustar al ancho' });
    const showZoom = (z) => {
      zoomLabel.textContent = Math.round(z * 100) + '%';
    };
    paper.replaceChildren();
    stack = createPageStack(scroller, pages, {
      zoom: prefs.zoom ?? 1,
      onZoom: (z) => {
        showZoom(z);
        db.prefPatch(song.key, { zoom: z });
      },
    });
    paper.append(stack.el, endBlock());
    showZoom(stack.zoom);
    zoomLabel.onclick = () => stack.setZoom(1);
    cleanups.push(() => stack.destroy());
    setControls(
      group('Zoom', [btn('zoomOut', 'Alejar', () => stack.setZoom(stack.zoom / 1.2)), zoomLabel, btn('zoomIn', 'Acercar', () => stack.setZoom(stack.zoom * 1.2))], 'zoom'),
      scrollGroup,
    );
  }

  let destroyed = false;
  init().catch((e) => {
    console.error(e);
    paper.replaceChildren(emptyState('No se pudo mostrar la canción', String(e.message || e)));
  });

  return {
    el: screen,
    fullscreen: true,
    focus: () => scroller.focus({ preventScroll: true }),
    destroy() {
      destroyed = true;
      cleanups.forEach((fn) => fn());
    },
  };
}

function btn(iconName, label, onclick, disabled = false, text = '') {
  return h(
    'button.ctl-btn',
    { 'aria-label': label, title: label, onclick, disabled },
    text ? h('span.ctl-letter', { class: iconName === 'plus' ? 'big' : 'small' }, text) : icon(iconName, { size: 20 }),
  );
}

function group(label, children, cls = '') {
  return h(`div.ctl-group${cls ? '.' + cls : ''}`, { role: 'group', 'aria-label': label }, h('span.ctl-label', label), h('div.ctl-row', children));
}

function chip(label, value, note = '') {
  return h('span.meta-chip', h('span.meta-label', label), h('strong', value), note ? h('span.meta-note', note) : null);
}
