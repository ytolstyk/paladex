import { useEffect } from 'react'
import { AttacksPage } from './components/AttacksPage'
import { Backdrop } from './components/Backdrop'
import { FilterBar } from './components/FilterBar'
import { DetailDrawer } from './components/DetailDrawer'
import { Footer } from './components/Footer'
import { OtherFeatures } from './components/OtherFeatures'
import { ResourcePanel } from './components/ResourcePanel'
import { RestGlow } from './components/RestGlow'
import { SettingsPage } from './components/SettingsPage'
import { SlotTracker } from './components/SlotTracker'
import { SpellGrid } from './components/SpellGrid'
import { STAGE_PANEL_ID, StageTabs, stageTabId } from './components/StageTabs'
import { Toast } from './components/Toast'
import { TablePanel } from './components/TablePanel'
import { TurnChart } from './components/TurnChart'
import { TurnPanel } from './components/TurnPanel'
import { UnreadableState } from './components/UnreadableState'
import { VitalsBanner } from './components/VitalsBanner'
import { useShortcuts } from './hooks/useShortcuts'
import { usePlayStore } from './state/session'
import { useUiStore } from './state/uiStore'

export function App(): React.JSX.Element {
  const view = useUiStore((s) => s.view)
  const stageTab = useUiStore((s) => s.stageTab)
  const chartOpen = useUiStore((s) => s.chartOpen)
  const status = usePlayStore((s) => s.status)
  const init = usePlayStore((s) => s.init)
  const recovered = usePlayStore((s) => s.recoveredFromBackup)
  useShortcuts()

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') {
    return (
      <div className="app app--loading" aria-busy="true">
        <Backdrop />
      </div>
    )
  }
  if (status === 'unreadable') return <UnreadableState />

  return (
    // The chart is drawn beside the stage on the sheet only; its open state is kept while settings is up.
    <div className="app" data-chart={(chartOpen && view === 'sheet') || undefined}>
      <Backdrop />
      <VitalsBanner />
      {view === 'settings' ? (
        <SettingsPage />
      ) : (
        <>
          <aside className="rail">
            <TablePanel />
            <SlotTracker />
            <TurnPanel />
            <ResourcePanel />
          </aside>
          <main className="stage">
            <StageTabs />
            {recovered && (
              <p className="notice">Your latest save was damaged, so the previous backup was loaded. Check your slots and HP.</p>
            )}
            {/* Search, sort and filters describe spells, so they and the features list belong to the spells view only. */}
            <div id={STAGE_PANEL_ID} className="stage-panel" role="tabpanel" aria-labelledby={stageTabId(stageTab)}>
              {stageTab === 'spells' ? (
                <>
                  <FilterBar />
                  <SpellGrid />
                  <OtherFeatures />
                </>
              ) : (
                <AttacksPage />
              )}
            </div>
          </main>
        </>
      )}
      {/* Beside the stage on the sheet; kept mounted (hidden) on the settings page so its focus and state survive the round trip. */}
      {chartOpen && <TurnChart hidden={view !== 'sheet'} />}
      <Footer />
      <DetailDrawer />
      <Toast />
      <RestGlow />
    </div>
  )
}
