/**
 * Lector de ChordPro. Convierte el texto en una estructura:
 *   { meta, blocks: [{ type, label, lines: [...] }] }
 * donde type ∈ 'none' | 'verse' | 'chorus' | 'bridge' | 'tab' | 'grid'
 * y cada línea es:
 *   { type: 'lyrics', segments: [{ chord, text, annotation? }] }
 *   { type: 'comment', text, style: 'normal'|'italic'|'box' }
 *   { type: 'chorusRef', label }
 *   { type: 'empty' }
 *   { type: 'raw', text }        (dentro de tab/grid)
 */

const ALIASES = {
  t: 'title', st: 'subtitle', c: 'comment', ci: 'comment_italic', cb: 'comment_box',
  soc: 'start_of_chorus', eoc: 'end_of_chorus', sov: 'start_of_verse', eov: 'end_of_verse',
  sob: 'start_of_bridge', eob: 'end_of_bridge', sot: 'start_of_tab', eot: 'end_of_tab',
  sog: 'start_of_grid', eog: 'end_of_grid', highlight: 'comment',
};

const META_KEYS = new Set([
  'title', 'subtitle', 'artist', 'composer', 'lyricist', 'album', 'year', 'key', 'capo',
  'tempo', 'time', 'duration', 'copyright',
]);

const ENV_LABELS = { chorus: 'Coro', verse: '', bridge: 'Puente', tab: '', grid: '' };

const DIRECTIVE = /^\{\s*([A-Za-z_][\w-]*)\s*(?:[:\s]\s*([\s\S]*?))?\s*\}\s*$/;

export function parseDirective(line) {
  const m = DIRECTIVE.exec(line.trim());
  if (!m) return null;
  const raw = m[1].toLowerCase();
  return { name: ALIASES[raw] ?? raw, value: (m[2] ?? '').trim() };
}

/** Divide una línea con [acordes] en segmentos acorde + texto. */
export function parseLyricsLine(line) {
  const segments = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let pending = null;
  let m;
  while ((m = re.exec(line))) {
    const text = line.slice(last, m.index);
    if (pending !== null || text) segments.push({ ...(pending ?? { chord: null }), text });
    const inner = m[1].trim();
    pending = inner.startsWith('*')
      ? { chord: inner.slice(1), annotation: true }
      : { chord: inner };
    last = re.lastIndex;
  }
  const tail = line.slice(last);
  if (pending !== null || tail || !segments.length) segments.push({ ...(pending ?? { chord: null }), text: tail });
  return segments;
}

export function parseChordPro(text) {
  const meta = { x: {} };
  const blocks = [];
  let block = { type: 'none', label: '', lines: [] };
  let hasChords = false;

  const pushBlock = () => {
    if (block.lines.length) blocks.push(block);
  };
  const open = (type, label) => {
    pushBlock();
    block = { type, label: label || ENV_LABELS[type] || '', lines: [] };
  };
  const close = () => {
    pushBlock();
    block = { type: 'none', label: '', lines: [] };
  };

  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const raw = block.type === 'tab' || block.type === 'grid';

    if (raw) {
      const d = line.trim().startsWith('{') ? parseDirective(line) : null;
      if (d && d.name === `end_of_${block.type}`) close();
      else block.lines.push({ type: 'raw', text: rawLine.replace(/\t/g, '    ') });
      continue;
    }

    if (/^\s*#/.test(line)) continue; // comentario del archivo
    if (!line.trim()) {
      block.lines.push({ type: 'empty' });
      continue;
    }

    const d = line.trim().startsWith('{') ? parseDirective(line) : null;
    if (d) {
      const { name, value } = d;
      if (META_KEYS.has(name)) {
        if (!(name in meta)) meta[name] = value;
      } else if (name === 'meta') {
        const [k, ...v] = value.split(/\s+/);
        if (k && !(k.toLowerCase() in meta)) meta[k.toLowerCase()] = v.join(' ');
      } else if (name.startsWith('x_')) {
        meta.x[name.slice(2)] = value;
      } else if (name.startsWith('start_of_')) {
        const type = name.slice(9);
        open(['chorus', 'verse', 'bridge', 'tab', 'grid'].includes(type) ? type : 'verse', value);
      } else if (name.startsWith('end_of_')) {
        close();
      } else if (name === 'chorus') {
        block.lines.push({ type: 'chorusRef', label: value || 'Coro' });
      } else if (name === 'comment' || name === 'comment_italic' || name === 'comment_box') {
        const style = name === 'comment' ? 'normal' : name.slice(8);
        block.lines.push({ type: 'comment', text: value, style });
      }
      // Otras directivas (formato, saltos de página…) se ignoran.
      continue;
    }

    const segments = parseLyricsLine(line);
    if (segments.some((s) => s.chord && !s.annotation)) hasChords = true;
    block.lines.push({ type: 'lyrics', segments });
  }
  pushBlock();

  // Quita líneas vacías al principio/fin de cada bloque.
  for (const b of blocks) {
    while (b.lines[0]?.type === 'empty') b.lines.shift();
    while (b.lines.at(-1)?.type === 'empty') b.lines.pop();
  }

  meta.hasChords = hasChords;
  return { meta, blocks: blocks.filter((b) => b.lines.length) };
}

/** Primer acorde de la canción (para deducir la tonalidad si falta {key}). */
export function firstChord(doc) {
  for (const b of doc.blocks) {
    for (const l of b.lines) {
      if (l.type !== 'lyrics') continue;
      const s = l.segments.find((x) => x.chord && !x.annotation);
      if (s) return s.chord;
    }
  }
  return null;
}
