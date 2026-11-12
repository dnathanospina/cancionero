import '@fontsource/cabin/latin-600.css';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-700.css';
import './styles/base.css';
import './styles/song.css';

import { h, clear } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { state, subscribe, loadSettings, reloadLibrary, runSync, setOnline } from './state.js';
import { brandMark, sectionSwitch, link } from './ui/components.js';
import { setupInstall } from './features/install.js';
import { exitImmersive } from './features/immersive.js';
import { HomeView } from './views/home.js';
import { SongsView } from './views/songs.js';
import { ListsView, ListDetailView } from './views/lists.js';
import { SongView } from './views/song.js';
import { SettingsView } from './views/settings.js';
import { plural } from './ui/format.js';

// ---------- Tema
const themeMeta = document.querySelector('meta[name="theme-color"]');
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  themeMeta?.setAttribute('content', dark ? '#000000' : '#ffffff');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- Estructura
const app = document.getElementById('app');
const appbarSync = h('button.icon-btn.sync-btn', { 'aria-label': 'Actualizar biblioteca', onclick: () => runSync() }, icon('refresh'));
const offlineBadge = h('span.offline-badge', { hidden: true, title: 'Sin conexión' }, icon('wifiOff', { size: 16 }), h('span', 'Sin conexión'));
const switchHost = h('div.appbar-switch');
const appbar = h('header.appbar', h('div.appbar-inner', brandMark(), switchHost, h('div.appbar-actions', offlineBadge, appbarSync)));
const progress = h('div.progress', { hidden: true }, h('div.progress-bar'));
const main = h('main#view', { tabindex: '-1' });

const TABS = [
  ['/', 'Inicio', 'home'],
  ['/canciones', 'Canciones', 'music'],
  ['/listas', 'Listas', 'list'],
  ['/ajustes', 'Ajustes', 'settings'],
];
const tabbar = h(
  'nav.tabbar',
  { 'aria-label': 'Secciones de la app' },
  TABS.map(([path, label, ic]) => h('a.tab', { href: link(path), dataset: { path } }, icon(ic), h('span', label))),
);
app.append(appbar, progress, main, tabbar);

// ---------- Rutas
let current = null;
let currentKey = '';
let lastListHref = '';
const scrollMemory = new Map();

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: new URLSearchParams(qs), raw };
}

function route() {
  const { path, query, raw } = parseHash();
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const songMode = parts[0] === 'cancion';

  if (current && !current.fullscreen) scrollMemory.set(currentKey, window.scrollY);
  try {
    current?.destroy?.();
  } catch (e) {
    console.error(e);
  }

  let view;
  if (!parts.length) view = HomeView();
  else if (parts[0] === 'canciones') view = SongsView({ query });
  else if (parts[0] === 'listas') view = ListsView();
  else if (parts[0] === 'lista') view = ListDetailView({ id: parts.slice(1).join('/') });
  else if (songMode) view = SongView({ section: parts[1], id: parts[2] ?? '', query, backHref: lastListHref });
  else if (parts[0] === 'ajustes') view = SettingsView();
  else view = HomeView();

  if (!songMode) {
    lastListHref = '#' + raw;
    exitImmersive(); // la pantalla completa solo se mantiene entre canciones
  }
  current = view;
  currentKey = path;
  document.body.classList.toggle('song-mode', !!view.fullscreen);
  clear(main).append(view.el);

  const tabPath = '/' + (parts[0] === 'lista' ? 'listas' : parts[0] === 'cancion' ? '' : parts[0] ?? '');
  for (const t of tabbar.children) {
    const on = t.dataset.path === (tabPath === '/' ? '/' : tabPath);
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  }
  if (!view.fullscreen) window.scrollTo(0, scrollMemory.get(path) ?? 0);
  view.focus?.();
}

/** Repinta la vista actual cuando cambian datos (salvo una canción abierta). */
function refresh() {
  if (current?.fullscreen) return;
  const y = window.scrollY;
  scrollMemory.set(currentKey, y);
  route();
}

function renderChrome() {
  clear(switchHost).append(sectionSwitch());
}

subscribe((what) => {
  if (what === 'settings') {
    applyTheme();
    renderChrome();
    refresh();
  } else if (what === 'library' || what === 'install') {
    refresh();
  } else if (what === 'sync') {
    appbarSync.classList.toggle('spinning', state.sync.running);
    appbarSync.disabled = state.sync.running;
    const p = state.sync.progress;
    progress.hidden = !state.sync.running;
    progress.firstChild.style.width = p && p.total ? `${Math.round((p.done / p.total) * 100)}%` : '15%';
  } else if (what === 'online') {
    offlineBadge.hidden = state.online;
  }
});

window.addEventListener('hashchange', route);
window.addEventListener('online', () => {
  setOnline(true);
  runSync({ quiet: true }).then(report);
});
window.addEventListener('offline', () => setOnline(false));

function report(r) {
  if (!r) {
    if (state.sync.error) toast(state.sync.error);
    return;
  }
  const parts = [];
  if (r.added) parts.push(plural(r.added, 'nueva', 'nuevas'));
  if (r.updated) parts.push(plural(r.updated, 'modificada', 'modificadas'));
  if (r.removed) parts.push(plural(r.removed, 'eliminada', 'eliminadas'));
  if (parts.length) toast('Biblioteca actualizada: ' + parts.join(', '));
  else if (!r.quiet) toast('La biblioteca ya está al día');
}
// El botón de actualizar también informa del resultado.
appbarSync.onclick = () => runSync().then(report);

// ---------- Service worker (actualizaciones de la app)
async function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const { registerSW } = await import('virtual:pwa-register');
  const update = registerSW({
    onNeedRefresh() {
      toast('Hay una versión nueva del cancionero.', { action: { label: 'Actualizar', run: () => update(true) }, timeout: 0 });
    },
    onOfflineReady() {
      toast('Listo para usar sin conexión');
    },
  });
}

// ---------- Arranque
async function start() {
  setupInstall();
  await loadSettings();
  applyTheme();
  renderChrome();
  await reloadLibrary();
  setOnline(navigator.onLine);
  offlineBadge.hidden = navigator.onLine;
  route();
  registerSW();
  const empty = !state.files.length;
  if (navigator.onLine) runSync({ quiet: !empty }).then((r) => (empty ? null : report(r)));
}
start();
