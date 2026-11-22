import { useEffect } from 'react'
import { useUiStore } from '@/state/uiStore'
import { EffectSettings } from './EffectSettings'
import { Flourish } from './Ornaments'
import { ThemePicker } from './ThemePicker'

/** Full-width settings view. Esc or the back button returns to the sheet. */
export function SettingsPage(): React.JSX.Element {
  const closeSettings = useUiStore((s) => s.closeSettings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeSettings])

  return (
    <main className="settings" aria-labelledby="settings-title">
      <header className="settings__head">
        <h2 id="settings-title" className="settings__title">
          Settings
        </h2>
        <button type="button" className="btn" onClick={closeSettings}>
          Back to sheet
        </button>
      </header>
      <Flourish />
      <ThemePicker />
      <Flourish />
      <EffectSettings />
      <p className="muted settings__note">Your choices are remembered on this computer and apply instantly.</p>
    </main>
  )
}
