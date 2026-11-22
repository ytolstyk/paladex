import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
// Order matters: themes.css must follow tokens.css, because `:root` and `[data-theme='x']` tie on specificity.
import './styles/tokens.css'
import './styles/themes.css'
import './styles/app.css'
import { App } from './App'
import { usePlayStore } from './state/session'
import { initTheme } from './state/themeStore'

// public/theme-boot.js already set the attribute before first paint; this makes the store authoritative.
initTheme()

// Start the load now so the IPC round trip overlaps React's first render (init() is idempotent).
void usePlayStore.getState().init()

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
