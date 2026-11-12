/**
 * Desplazamiento automático suave. La velocidad va de 1 a 20; cada nivel es un
 * 18 % más rápido que el anterior (nivel 1 ≈ 7 px/s, nivel 20 ≈ 160 px/s).
 * Si el usuario mueve la pantalla a mano, se continúa desde la nueva posición.
 */
export const SPEED_MIN = 1;
export const SPEED_MAX = 20;
export const pxPerSecond = (level) => 7 * Math.pow(1.18, level - 1);

export function createAutoScroller(el, { speed = 6, onChange } = {}) {
  let running = false;
  let level = speed;
  let pos = 0;
  let last = 0;
  let raf = 0;

  const atEnd = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    // Si la posición real se aleja de la calculada, el usuario ha movido la pantalla.
    if (Math.abs(el.scrollTop - pos) > 3) pos = el.scrollTop;
    pos += pxPerSecond(level) * dt;
    el.scrollTop = pos;
    if (atEnd()) {
      stop();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    if (atEnd()) el.scrollTop = 0;
    running = true;
    pos = el.scrollTop;
    last = performance.now();
    raf = requestAnimationFrame(frame);
    onChange?.(api);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    onChange?.(api);
  }

  const api = {
    start,
    stop,
    toggle: () => (running ? stop() : start()),
    get running() {
      return running;
    },
    get speed() {
      return level;
    },
    setSpeed(v) {
      level = Math.max(SPEED_MIN, Math.min(SPEED_MAX, v));
      onChange?.(api);
    },
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
  return api;
}
