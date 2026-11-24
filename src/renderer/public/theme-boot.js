// Runs as a classic, parser-blocking script in <head> so the chosen theme is on <html> before the first paint.
// It must be an external file: the production CSP is `script-src 'self'`, which forbids inline scripts.
// The key matches THEME_STORAGE_KEY in state/themeStore.ts. The value is deliberately not validated here: an unknown
// id matches no theme block, so the default palette applies, and the store validates it once the app boots.
try {
  const theme = localStorage.getItem('paladex.theme')
  if (theme) document.documentElement.dataset.theme = theme
} catch {
  // Storage unavailable: keep the default theme.
}
// The second-screen window (see main.tsx) scales everything to its size; set before first paint so it never shows at the sheet's scale.
// '#companion' matches COMPANION_HASH in shared/constants.ts: change both together.
if (location.hash === '#companion') document.documentElement.dataset.view = 'companion'
