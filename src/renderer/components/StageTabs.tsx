import { tabIndexForKey } from '@/domain/tabs'
import { useUiStore, type StageTab } from '@/state/uiStore'

const TABS: { id: StageTab; label: string }[] = [
  { id: 'spells', label: 'Spells & features' },
  { id: 'attacks', label: 'Weapons & attacks' }
]

export const stageTabId = (tab: StageTab): string => `stage-tab-${tab}`
export const STAGE_PANEL_ID = 'stage-panel'

/** The two views of the stage. ARIA tabs: only the chosen tab is in the tab order, and the arrow keys, Home and End move between them. */
export function StageTabs(): React.JSX.Element {
  const stageTab = useUiStore((s) => s.stageTab)
  const setStageTab = useUiStore((s) => s.setStageTab)

  const move = (e: React.KeyboardEvent, current: number): void => {
    const target = tabIndexForKey(e.key, current, TABS.length)
    if (target === null) return
    const next = TABS[target]
    if (!next) return // unreachable: the index is within TABS; this narrows the type
    e.preventDefault()
    setStageTab(next.id)
    document.getElementById(stageTabId(next.id))?.focus() // every tab is rendered, so it can take focus before the state settles
  }

  return (
    <div className="stage-tabs" role="tablist" aria-label="Sheet view">
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          id={stageTabId(tab.id)}
          type="button"
          role="tab"
          className="stage-tab"
          aria-selected={stageTab === tab.id}
          aria-controls={STAGE_PANEL_ID}
          tabIndex={stageTab === tab.id ? 0 : -1}
          onClick={() => setStageTab(tab.id)}
          onKeyDown={(e) => move(e, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
