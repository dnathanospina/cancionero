import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { youtubeInfo, youtubePlaylistUrl } from '../links/links.js';
import { isIOS } from './install.js';

const isAndroid = () => /Android/i.test(navigator.userAgent);

/**
 * Abre un enlace para escuchar. Con YouTube intenta abrir su app:
 *  - Android: enlace «intent» con vuelta automática al navegador si no está instalada
 *  - iPhone/iPad: esquema youtube:// y, si la app no se abre, la web
 */
export function openListen(url) {
  const yt = youtubeInfo(url);
  if (yt && isAndroid()) {
    const fallback = encodeURIComponent(yt.url);
    location.href = `intent://www.youtube.com/watch?v=${yt.id}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${fallback};end`;
    return;
  }
  if (yt && isIOS()) {
    let left = false;
    const onHide = () => {
      left = true;
    };
    document.addEventListener('visibilitychange', onHide, { once: true });
    location.href = `youtube://www.youtube.com/watch?v=${yt.id}`;
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      if (!left && document.visibilityState === 'visible') location.href = yt.url;
    }, 1200);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

/** Botón «Escuchar»: desactivado si la canción no tiene enlace. */
export function listenButton(link, { compact = false } = {}) {
  return h(
    'button.ctl-btn.listen',
    {
      disabled: !link,
      title: link ? 'Escuchar' : 'Esta canción no tiene enlace para escuchar',
      'aria-label': link ? 'Escuchar' : 'Escuchar (sin enlace)',
      onclick: () => link && openListen(link),
    },
    icon('headphones', { size: 20 }),
    compact ? null : h('span', 'Escuchar'),
  );
}

/** Hoja «Escuchar la lista»: todas seguidas en YouTube o una a una. */
export function openListenSheet(list, items) {
  const withLink = items.filter((x) => x.link);
  const playlist = youtubePlaylistUrl(withLink.map((x) => x.link));
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const overlay = h(
    'div.sheet-overlay',
    { onclick: (e) => e.target === overlay && close() },
    h(
      'div.sheet',
      { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Escuchar la lista' },
      h('div.sheet-head', h('h2', 'Escuchar la lista'), h('button.icon-btn', { 'aria-label': 'Cerrar', onclick: close }, icon('close'))),
      h('p.page-sub', `${list.name} · ${withLink.length} de ${items.length} canciones con enlace`),
      playlist
        ? h(
            'a.btn.primary.block',
            { href: playlist, target: '_blank', rel: 'noopener' },
            icon('play', { size: 18 }),
            'Reproducir todas en YouTube',
          )
        : null,
      h(
        'ol.sheet-list',
        items.map((x) =>
          h(
            'li',
            h('span.sheet-title', x.title),
            x.link
              ? h('button.btn.small.ghost', { onclick: () => openListen(x.link) }, icon('headphones', { size: 16 }), 'Escuchar')
              : h('span.muted.small', 'Sin enlace'),
          ),
        ),
      ),
    ),
  );
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  overlay.querySelector('button')?.focus();
}
