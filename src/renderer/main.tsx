import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/app.css'
import { App } from './App'
import { usePlayStore } from './state/session'

// Start the load now so the IPC round trip overlaps React's first render (init() is idempotent).
void usePlayStore.getState().init()

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
