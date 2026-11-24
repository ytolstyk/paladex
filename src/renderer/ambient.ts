/**
 * Pause the always-running ambient animations (candle glow, rune ring, held-spell pulse, low-HP heartbeat) while the
 * window is unfocused or hidden, so a companion left open on a second screen does not keep the GPU awake. The companion passes `followFocus: false`: it is never the
 * focused window, so only hidden or minimized counts as away. The CSS side is
 * the `html[data-ambient='off']` rule in app.css. One-shot animations are untouched.
 */
export function initAmbientPause({ followFocus = true }: { followFocus?: boolean } = {}): void {
  const root = document.documentElement
  const sync = (): void => {
    const away = document.hidden || (followFocus && !document.hasFocus())
    root.dataset['ambient'] = away ? 'off' : 'on'
  }
  document.addEventListener('visibilitychange', sync)
  if (followFocus) {
    window.addEventListener('focus', sync)
    window.addEventListener('blur', sync)
  }
  sync() // a window that opens unfocused (second screen, launched from a script) starts paused
}
