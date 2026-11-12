/** Mantiene la pantalla encendida mientras se muestra una canción. */
export function keepAwake() {
  let lock = null;
  let active = true;
  const request = async () => {
    if (!active || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      /* no disponible o denegado: no es crítico */
    }
  };
  const onVis = () => request();
  document.addEventListener('visibilitychange', onVis);
  request();
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVis);
    lock?.release().catch(() => {});
  };
}
