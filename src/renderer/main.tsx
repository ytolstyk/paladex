import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
// Order matters: themes.css must follow tokens.css, because `:root` and `[data-theme='x']` tie on specificity.
import './styles/tokens.css'
import './styles/themes.css'
import './styles/app.css'
import './styles/backdrop.css'
import './styles/companion.css'
import { COMPANION_HASH } from '@shared/constants'
import { App } from './App'
import { initAmbientPause } from './ambient'
import { Companion } from './components/companion/Companion'
import { usePlayStore } from './state/session'
import { initTheme } from './state/themeStore'

// public/theme-boot.js already set the attribute before first paint; this makes the store authoritative.
initTheme()

// The second-screen window loads this same page with `#companion`. It is a read-only mirror: it never starts the play store (which would load, and
// could seed and save, the sheet). It is never the focused window, so it pauses its looping animations only when hidden or minimized.
const isCompanion = window.location.hash === `#${COMPANION_HASH}`
initAmbientPause({ followFocus: !isCompanion })
if (!isCompanion) {
  // Start the load now so the IPC round trip overlaps React's first render (init() is idempotent).
  void usePlayStore.getState().init()
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')
createRoot(root).render(<StrictMode>{isCompanion ? <Companion /> : <App />}</StrictMode>)
