import { useEffect } from 'react'
import { FilterBar } from './components/FilterBar'
import { DetailDrawer } from './components/DetailDrawer'
import { Footer } from './components/Footer'
import { OtherFeatures } from './components/OtherFeatures'
import { ResourcePanel } from './components/ResourcePanel'
import { SettingsPage } from './components/SettingsPage'
import { SlotTracker } from './components/SlotTracker'
import { SpellGrid } from './components/SpellGrid'
import { Toast } from './components/Toast'
import { TurnPanel } from './components/TurnPanel'
import { UnreadableState } from './components/UnreadableState'
import { VitalsBanner } from './components/VitalsBanner'
import { useShortcuts } from './hooks/useShortcuts'
import { usePlayStore } from './state/session'
import { useUiStore } from './state/uiStore'

export function App(): React.JSX.Element {
  const view = useUiStore((s) => s.view)
  const status = usePlayStore((s) => s.status)
  const init = usePlayStore((s) => s.init)
  const recovered = usePlayStore((s) => s.recoveredFromBackup)
  useShortcuts()

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') return <div className="app app--loading" aria-busy="true" />
  if (status === 'unreadable') return <UnreadableState />

  return (
    <div className="app">
      <VitalsBanner />
      {view === 'settings' ? (
        <SettingsPage />
      ) : (
        <>
          <aside className="rail">
            <SlotTracker />
            <TurnPanel />
            <ResourcePanel />
          </aside>
          <main className="stage">
            {recovered && (
              <p className="notice">Your latest save was damaged, so the previous backup was loaded. Check your slots and HP.</p>
            )}
            <FilterBar />
            <SpellGrid />
            <OtherFeatures />
          </main>
        </>
      )}
      <Footer />
      <DetailDrawer />
      <Toast />
    </div>
  )
}
