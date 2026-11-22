/**
 * Pause the always-running ambient animations (candle glow, rune ring, held-spell pulse, low-HP heartbeat) while the
 * window is unfocused or hidden, so a companion left open on a second screen does not keep the GPU awake. The CSS side is
 * the `html[data-ambient='off']` rule in app.css. One-shot animations are untouched.
 */
export function initAmbientPause(): void {
  const root = document.documentElement
  const sync = (): void => {
    root.dataset['ambient'] = document.hidden || !document.hasFocus() ? 'off' : 'on'
  }
  window.addEventListener('focus', sync)
  window.addEventListener('blur', sync)
  document.addEventListener('visibilitychange', sync)
  sync() // a window that opens unfocused (second screen, launched from a script) starts paused
}
