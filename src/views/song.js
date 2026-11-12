import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openSheet } from '../ui/dialog.js';
import { state, subscribe, setSettings, currentSource } from '../state.js';
import * as db from '../db.js';
import { resolveItem, drumVersion, vocesVersion, SECTION_SHORT, SECTION_LABEL } from '../library/library.js';
import { loadSongDoc } from '../chordpro/song-doc.js';
import { firstChord } from '../chordpro/parser.js';
import { renderSong } from '../viewers/chordpro-view.js';
import { createPageStack } from '../viewers/page-stack.js';
import { createPager } from '../viewers/pager.js';
import { parseKey, semitoneDiff } from '../music/chords.js';
import { makeChordTransformer, keyName, shiftKey } from '../music/transpose.js';
import { createAutoScroller, SPEED_MIN, SPEED_MAX } from '../features/autoscroll.js';
import { listenPedal } from '../features/pedal.js';
import { keepAwake } from '../features/wakelock.js';
import { openListen } from '../features/listen.js';
import { attachSongSwipe } from '../features/swipe.js';
import { enterImmersive, exitImmersive, isImmersive, onImmersiveChange } from '../features/immersive.js';
import { ensureBlob } from '../sync/sync.js';
import { link, emptyState, prettyKey } from '../ui/components.js';

const FONT_MIN = 0.7;
const FONT_MAX = 2.4;

function songUrl(list, index, song, { ver, atEnd } = {}) {
  if (!list) return link(`/cancion/${song.section}/${encodeURIComponent(song.id)}`);
  return link(
    `/cancion/${song.section}/${encodeURIComponent(song.id)}?lista=${encodeURIComponent(list.id)}&i=${index}` +
      (ver ? `&ver=${ver}` : '') +
      (atEnd ? '&fin=1' : ''),
  );
}

/**
 * Vista de una canción. No hay barras fijas: los controles flotan sobre la
 * letra en cápsulas de cristal y se ocultan al desplazar hacia abajo
 * (reaparecen al tocar o al subir).
 */
export function SongView({ section, id, query, backHref }) {
  const lib = state.library;
  const list = query.get('lista') ? lib.lists.find((l) => l.id === query.get('lista')) : null;
  const index = list ? parseInt(query.get('i') ?? '0', 10) : -1;
  const ver = query.get('ver'); // sección forzada dentro de una lista
  const openAtEnd = query.get('fin') === '1'; // se llega retrocediendo desde la canción siguiente
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
  const go = (step, opts) => step && location.replace(songUrl(list, step.index, step.song, opts));
  const edgeLabels = { next: next?.song.title, prev: prev?.song.title };
  /** Cambia de canción por gesto o pedal; devuelve false si no hay más. */
  const advance = (dir) => {
    const step = dir > 0 ? next : prev;
    if (step) {
      go(step, { atEnd: dir < 0 });
      return true;
    }
    if (list) toast(dir > 0 ? 'Es la última canción de la lista' : 'Es la primera canción de la lista');
    return false;
  };

  // Otra versión (voces ⇄ batería).
  const other = song.section === 'voces' ? drumVersion(lib, song) : vocesVersion(lib, song);
  const otherHref = other ? (list ? songUrl(list, index, other, { ver: other.section }) : songUrl(null, 0, other)) : null;

  const cleanups = [];
  const scroller = h('div.song-scroll', { tabindex: '-1' });
  const paper = h('div.song-paper');
  scroller.append(paper);

  // ---------- Cápsulas flotantes
  const capText = h(
    'div.cap-text',
    h('strong', song.title),
    h('span', list ? `${list.name} · ${index + 1} de ${list.items.length}` : SECTION_SHORT[song.section]),
  );
  const centerCap = h(
    'div.glass-cap.center-cap',
    list ? h('button.cap-btn', { 'aria-label': 'Canción anterior', disabled: !prev, onclick: () => go(prev) }, icon('prev', { size: 20 })) : null,
    capText,
    list ? h('button.cap-btn', { 'aria-label': 'Canción siguiente', disabled: !next, onclick: () => go(next) }, icon('next', { size: 20 })) : null,
  );
  const listenBtn = h(
    'button.cap-btn',
    {
      'aria-label': song.link ? 'Escuchar' : 'Escuchar (esta canción no tiene enlace)',
      title: song.link ? 'Escuchar' : 'Sin enlace para escuchar',
      disabled: !song.link,
      onclick: () => song.link && openListen(song.link),
    },
    icon('headphones', { size: 21 }),
  );
  const moreBtn = h('button.cap-btn', { 'aria-label': 'Más opciones', onclick: () => moreSheet() }, icon('more', { size: 21 }));
  const notes = h(
    'div.float-notes',
    fallback ? h('div.note-pill.warn', icon('alert', { size: 15 }), 'Sin versión de batería: se muestra la de voces') : null,
    item?.notes ? h('div.note-pill', icon('text', { size: 15 }), item.notes) : null,
  );
  const topFloat = h(
    'div.float-top',
    h('div.float-row', h('a.glass-btn.circle', { href: back, 'aria-label': 'Volver' }, icon('back', { size: 22 })), centerCap, h('div.glass-cap', listenBtn, moreBtn)),
    notes,
  );

  const controls = h('div.glass-cap.controls-cap', { role: 'toolbar', 'aria-label': 'Controles' });
  const goldBtn = h('button.gold-btn', { 'aria-label': 'Desplazamiento automático', hidden: true });
  const speedValue = h('span.cap-value');
  const speedCap = h(
    'div.glass-cap.speed-cap',
    { 'aria-label': 'Velocidad' },
    h('button.cap-btn', { 'aria-label': 'Más lento', onclick: () => setSpeed(-1) }, icon('minus', { size: 18 })),
    speedValue,
    h('button.cap-btn', { 'aria-label': 'Más rápido', onclick: () => setSpeed(1) }, icon('plus', { size: 18 })),
  );
  const nextPill = list && next ? h('button.glass-cap.next-pill', { onclick: () => go(next) }, h('span', 'Siguiente: ', h('strong', next.song.title)), icon('next', { size: 15 })) : null;
  const bottomFloat = h('div.float-bottom', speedCap, nextPill, h('div.float-row', controls, goldBtn));

  const screen = h(
    'div.song-screen',
    { style: { '--fs': state.settings.fontScale } },
    scroller,
    h('div.fade-top', { 'aria-hidden': 'true' }),
    h('div.fade-bottom', { 'aria-hidden': 'true' }),
    topFloat,
    bottomFloat,
  );
  const setControls = (...groups) => {
    const parts = groups.filter(Boolean);
    controls.replaceChildren(...parts.flatMap((g, i) => (i ? [h('span.cap-sep'), g] : [g])));
  };

  // ---------- Mostrar/ocultar los controles
  const showChrome = () => screen.classList.remove('chrome-hidden');
  const hideChrome = () => screen.classList.add('chrome-hidden');
  let lastTop = 0;
  scroller.addEventListener(
    'scroll',
    () => {
      const top = scroller.scrollTop;
      if (top < 40) showChrome();
      else if (top > lastTop + 6) hideChrome();
      else if (top < lastTop - 12 && !scrollerApi.running) showChrome();
      lastTop = top;
    },
    { passive: true },
  );

  // ---------- Pantalla completa (API real en Android; en iPhone se oculta la interfaz)
  const syncImmersive = () => {
    const on = isImmersive();
    screen.classList.toggle('immersive', on);
    if (on) hideChrome();
    else showChrome();
  };
  syncImmersive();
  cleanups.push(onImmersiveChange(syncImmersive));

  // ---------- Desplazamiento automático
  const scrollerApi = createAutoScroller(scroller, {
    onChange: (a) => {
      goldBtn.replaceChildren(icon(a.running ? 'pause' : 'play', { size: 24 }));
      goldBtn.classList.toggle('on', a.running);
      goldBtn.setAttribute('aria-pressed', String(a.running));
      speedValue.textContent = String(a.speed);
      screen.classList.toggle('scrolling', a.running);
      if (a.running) screen.classList.add('scrolled-once'); // desde ahora se muestra la velocidad
    },
  });
  scrollerApi.setSpeed(6);
  goldBtn.onclick = (e) => {
    e.stopPropagation();
    scrollerApi.toggle();
    if (scrollerApi.running) hideChrome();
  };
  const setSpeed = (d) => {
    scrollerApi.setSpeed(Math.max(SPEED_MIN, Math.min(SPEED_MAX, scrollerApi.speed + d)));
    db.prefPatch(song.key, { speed: scrollerApi.speed });
  };
  cleanups.push(() => scrollerApi.destroy());

  // ---------- Toque en la partitura: muestra/oculta controles o pausa
  let down = null;
  scroller.addEventListener('pointerdown', (e) => {
    down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  });
  scroller.addEventListener('pointerup', (e) => {
    if (!down || e.target.closest('a,button')) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const fast = performance.now() - down.t < 350;
    down = null;
    if (moved > 10 || !fast || stack?.pinching || pager?.busy) return;
    if (scrollerApi.running) {
      scrollerApi.stop();
      showChrome();
    } else {
      screen.classList.toggle('chrome-hidden');
    }
  });

  // ---------- Pedal / teclado
  const atBottom = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
  const atTop = () => scroller.scrollTop <= 2;
  const page = (dir) => scroller.scrollBy({ top: dir * scroller.clientHeight * 0.8, behavior: 'smooth' });
  const auto = () => list && state.settings.autoAdvance;
  // Mientras se abre un PDF o imagen, el pedal espera (no salta de canción).
  const loading = () => song.kind !== 'chordpro' && !pager && !stack;
  const guard = (fn) => (e) => (loading() ? undefined : fn(e));
  cleanups.push(
    listenPedal(() => state.settings.pedal, {
      scrollDown: guard((e) => {
        if (pager) return pager.forward() || (!e.repeat && auto() && advance(1));
        if (atBottom() && auto()) !e.repeat && advance(1);
        else page(1);
      }),
      scrollUp: guard((e) => {
        if (pager) return pager.back() || (!e.repeat && auto() && advance(-1));
        if (atTop() && auto()) !e.repeat && advance(-1);
        else page(-1);
      }),
      // En el visor por páginas, las flechas pasan página y después canción.
      nextSong: guard((e) => (pager ? pager.forward() || (!e.repeat && advance(1)) : !e.repeat && advance(1))),
      prevSong: guard((e) => (pager ? pager.back() || (!e.repeat && advance(-1)) : !e.repeat && advance(-1))),
      toggleScroll: guard((e) => !e.repeat && !pager && scrollerApi.toggle()),
    }),
  );
  cleanups.push(keepAwake());

  // ---------- Deslizar en horizontal: canción anterior/siguiente (no en el visor por páginas)
  const swipeHint = h('div.swipe-hint', { 'aria-hidden': 'true' });
  screen.append(swipeHint);
  if (list) {
    cleanups.push(
      attachSongSwipe(scroller, {
        enabled: () => !pager,
        labels: edgeLabels,
        hint: swipeHint,
        moveEl: paper,
        onSwipe: (dir) => (dir > 0 ? next : prev) && advance(dir),
      }),
    );
  }

  // ---------- Final de la canción
  const endBlock = () =>
    list
      ? h(
          'div.song-end',
          next
            ? h('button.btn.tinted', { onclick: () => go(next) }, 'Siguiente: ', h('strong', next.song.title), icon('next', { size: 16 }))
            : h('p.muted', 'Fin de la lista'),
        )
      : h('div.song-end');

  let stack = null;
  let pager = null;

  // ---------- Hoja «Más»: opciones menos frecuentes
  const moreRows = []; // funciones que devuelven filas extra según el tipo de canción
  function stepper(label, value, onMinus, onPlus) {
    const v = h('span.step-value', value());
    const upd = () => (v.textContent = value());
    return h(
      'div.sheet-row',
      h('span.sheet-row-label', label),
      h(
        'div.stepper',
        h('button.step-btn', { 'aria-label': `${label}: menos`, onclick: () => (onMinus(), upd()) }, icon('minus', { size: 18 })),
        v,
        h('button.step-btn', { 'aria-label': `${label}: más`, onclick: () => (onPlus(), upd()) }, icon('plus', { size: 18 })),
      ),
    );
  }
  function moreSheet() {
    const rows = [
      ...moreRows.map((f) => f(stepper)),
      song.kind === 'chordpro' || stack ? stepper('Velocidad de desplazamiento', () => String(scrollerApi.speed), () => setSpeed(-1), () => setSpeed(1)) : null,
      h(
        'button.sheet-row.action',
        { onclick: () => (s.close(), isImmersive() ? exitImmersive() : enterImmersive()) },
        icon(isImmersive() ? 'shrink' : 'expand', { size: 20 }),
        h('span.sheet-row-label', isImmersive() ? 'Salir de pantalla completa' : 'Pantalla completa'),
      ),
      otherHref
        ? h(
            'a.sheet-row.action',
            { href: otherHref, onclick: () => s.close() },
            icon(other.section === 'bateria' ? 'drum' : 'mic', { size: 20 }),
            h('span.sheet-row-label', `Ver versión de ${SECTION_LABEL[other.section].toLowerCase()}`),
            icon('next', { size: 16, cls: 'icon chev' }),
          )
        : null,
    ];
    const s = openSheet({ title: song.title, subtitle: [song.artist, SECTION_LABEL[song.section]].filter(Boolean).join(' · '), body: [h('div.group.sheet-group', rows)] });
  }

  async function init() {
    const prefs = await db.prefGet(song.key);
    if (prefs.speed) scrollerApi.setSpeed(prefs.speed);
    if (song.kind === 'chordpro') await initChordPro(prefs);
    else await initPages(prefs);
  }

  // ---------- ChordPro
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

    const head = h('header.song-head');
    const body = h('div.song-body');
    paper.replaceChildren(head, body, endBlock());
    paper.classList.toggle('lyrics-only', state.settings.lyricsOnly && hasChords);

    const keyValue = h('button.cap-value.key-value', { title: 'Volver al tono original' });
    const draw = () => {
      const shift = transpose - (capo - fileCapo);
      const notation = state.settings.notation;
      const chordFn = makeChordTransformer({ semitones: shift, notation, targetKey: shiftKey(written, shift) });
      body.replaceChildren(renderSong(doc, { chord: chordFn }));

      const sounding = written ? prettyKey(keyName(written, transpose + fileCapo, notation)) : '';
      keyValue.textContent = sounding || (transpose > 0 ? '+' : '') + transpose;
      keyValue.disabled = transpose === defaultTranspose;
      keyValue.setAttribute('aria-label', `Tono ${sounding}. Toca para volver al original`);

      const meta = [];
      if (sounding) meta.push(`Tono ${sounding}${transpose !== defaultTranspose ? ` (${transpose > 0 ? '+' : ''}${transpose})` : listTarget && transpose === listShift ? ' de la lista' : ''}`);
      if (capo > 0 && written) meta.push(`Capo ${capo}, formas de ${prettyKey(keyName(written, shift, notation))}`);
      if (doc.meta.tempo) meta.push(`${doc.meta.tempo} bpm`);
      if (doc.meta.time) meta.push(doc.meta.time);
      if (doc.meta.duration) meta.push(doc.meta.duration);
      head.replaceChildren(
        ...[
          h('h1.song-title', doc.meta.title || song.title),
          doc.meta.subtitle ? h('p.song-subtitle', doc.meta.subtitle) : null,
          song.artist ? h('p.song-artist', song.artist) : null,
          meta.length ? h('p.song-meta', meta.join(' · ')) : null,
        ].filter(Boolean),
      );
    };
    const saveTranspose = () => (ctxKey ? db.prefPatch(ctxKey, { transpose }) : db.prefPatch(song.key, { transpose }));
    const setT = (d) => {
      transpose = Math.max(-11, Math.min(11, transpose + d));
      saveTranspose();
      draw();
    };
    keyValue.onclick = () => {
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
      'button.cap-btn.text-btn',
      {
        'aria-pressed': String(state.settings.lyricsOnly),
        onclick: () => setSettings({ lyricsOnly: !state.settings.lyricsOnly }),
      },
      'Solo letra',
    );
    const fontBtn = h('button.cap-btn.text-btn.aa', { 'aria-label': 'Tamaño de letra', 'aria-expanded': 'false', onclick: () => toggleFont() }, h('span.a-small', 'A'), h('span.a-big', 'A'));
    const fontCap = h(
      'div.glass-cap.font-cap',
      { hidden: true },
      h('button.cap-btn', { 'aria-label': 'Letra más pequeña', onclick: () => setFont(-0.1) }, h('span.a-small', 'A')),
      h('span.cap-value.font-value'),
      h('button.cap-btn', { 'aria-label': 'Letra más grande', onclick: () => setFont(0.1) }, h('span.a-big', 'A')),
    );
    const paintFont = () => (fontCap.querySelector('.font-value').textContent = Math.round(state.settings.fontScale * 100) + '%');
    function toggleFont() {
      fontCap.hidden = !fontCap.hidden;
      fontBtn.setAttribute('aria-expanded', String(!fontCap.hidden));
      paintFont();
    }
    bottomFloat.prepend(fontCap);

    setControls(
      hasChords && written
        ? h('div.cap-group', h('button.cap-btn', { 'aria-label': 'Bajar medio tono', onclick: () => setT(-1) }, icon('minus', { size: 18 })), keyValue, h('button.cap-btn', { 'aria-label': 'Subir medio tono', onclick: () => setT(1) }, icon('plus', { size: 18 })))
        : null,
      fontBtn,
      hasChords ? lyricsBtn : null,
    );
    goldBtn.hidden = false;
    if (hasChords) {
      moreRows.push((stepperRow) => stepperRow('Capo', () => (capo ? `Traste ${capo}` : 'Sin capo'), () => setCapo(-1), () => setCapo(1)));
    }
    moreRows.push((stepperRow) => stepperRow('Tamaño de letra', () => Math.round(state.settings.fontScale * 100) + '%', () => setFont(-0.1), () => setFont(0.1)));

    const unsub = subscribe((what) => {
      if (what !== 'settings') return;
      screen.style.setProperty('--fs', state.settings.fontScale);
      paper.classList.toggle('lyrics-only', state.settings.lyricsOnly && hasChords);
      lyricsBtn.setAttribute('aria-pressed', String(state.settings.lyricsOnly));
      paintFont();
      draw();
    });
    cleanups.push(unsub);
    draw();
    if (openAtEnd) requestAnimationFrame(() => (scroller.scrollTop = scroller.scrollHeight));
  }

  const setFont = (d) => {
    const v = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX, state.settings.fontScale + d)) * 10) / 10;
    setSettings({ fontScale: v });
  };

  // ---------- PDF e imágenes
  async function initPages(prefs) {
    paper.classList.add('pages-paper');
    paper.replaceChildren(h('div.loading', 'Abriendo partitura…'));
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

    const makePages = async () =>
      song.kind === 'pdf'
        ? (await import('../viewers/pdf-view.js')).pdfPages(blobs[0])
        : (await import('../viewers/image-view.js')).imagePages(blobs);

    const zoomValue = h('button.cap-value.zoom-value', { title: 'Ajustar al ancho' });
    const showZoom = (z) => {
      zoomValue.textContent = Math.round(z * 100) + '%';
    };
    const saveZoom = (z) => {
      showZoom(z);
      db.prefPatch(song.key, { zoom: z });
    };
    const viewer = () => pager ?? stack;

    async function mount() {
      let pages;
      try {
        pages = await makePages();
      } catch (e) {
        console.error(e);
        paper.replaceChildren(emptyState('No se pudo abrir la partitura', String(e.message || e)));
        return;
      }
      if (destroyed) return pages.dispose?.();
      pager?.destroy();
      stack?.destroy();
      pager = stack = null;
      const paged = state.settings.pageMode !== 'scroll';
      screen.classList.toggle('paged-mode', paged);
      if (paged) {
        paper.replaceChildren();
        paper.hidden = true;
        pager = createPager(scroller, pages, {
          zoom: prefs.zoom ?? 1,
          start: openAtEnd ? 'last' : 0,
          onZoom: saveZoom,
          edgeLabels: list ? edgeLabels : {},
          onEdge: (dir) => list && advance(dir),
        });
      } else {
        paper.hidden = false;
        paper.replaceChildren();
        stack = createPageStack(scroller, pages, { zoom: prefs.zoom ?? 1, onZoom: saveZoom });
        paper.append(stack.el, endBlock());
        if (openAtEnd) requestAnimationFrame(() => (scroller.scrollTop = scroller.scrollHeight));
      }
      showZoom(viewer().zoom);
      const modeBtn = h(
        'button.cap-btn.text-btn',
        {
          title: paged ? 'Ver en continuo' : 'Ver página a página',
          onclick: async () => {
            await setSettings({ pageMode: paged ? 'scroll' : 'paged' });
            scrollerApi.stop();
            mount();
          },
        },
        icon(paged ? 'pages' : 'scrollV', { size: 19 }),
        h('span', paged ? 'Páginas' : 'Continuo'),
      );
      setControls(
        h(
          'div.cap-group',
          h('button.cap-btn', { 'aria-label': 'Alejar', onclick: () => viewer().setZoom(viewer().zoom / 1.2) }, icon('minus', { size: 18 })),
          zoomValue,
          h('button.cap-btn', { 'aria-label': 'Acercar', onclick: () => viewer().setZoom(viewer().zoom * 1.2) }, icon('plus', { size: 18 })),
        ),
        modeBtn,
      );
      goldBtn.hidden = paged;
    }
    zoomValue.onclick = () => viewer()?.setZoom(1);
    cleanups.push(() => {
      pager?.destroy();
      stack?.destroy();
    });
    await mount();
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
