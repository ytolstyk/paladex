import { formatLog } from '@/domain/log'
import type { RestKind } from '@/domain/rests'
import { canUndo as selectCanUndo } from '@/state/playStore'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { HISTORY_BUTTON_ID, UNDO_HISTORY_ID } from './ids'

export function Footer(): React.JSX.Element {
  const lastEntry = usePlayStore((s) => s.play?.log.at(-1))
  const canUndo = usePlayStore(selectCanUndo)
  const correcting = usePlayStore((s) => s.historyBackup !== null)
  const undoLast = usePlayStore((s) => s.undoLast)
  const saveError = usePlayStore((s) => s.saveError)
  const exportRaw = usePlayStore((s) => s.exportRaw)
  const takeRest = usePlayStore((s) => s.takeRest)
  const glowRest = useUiStore((s) => s.glowRest)
  const historyOpen = useUiStore((s) => s.historyOpen)
  const toggleHistory = useUiStore((s) => s.toggleHistory)
  const rest = (kind: RestKind): void => {
    takeRest(kind)
    glowRest(kind)
  }

  return (
    <footer className="footer">
      <p className="footer__log" aria-live="polite">
        {saveError ? (
          <span className="footer__error">Could not save: {saveError}</span>
        ) : (
          lastEntry && formatLog(lastEntry, catalog.nameOf)
        )}
      </p>
      <div className="footer__actions">
        <button type="button" className="btn" onClick={undoLast} disabled={!canUndo} title={correcting ? 'Take back the history change (Cmd+Z)' : 'Undo (Cmd+Z)'}>
          Undo
        </button>
        <button
          type="button"
          id={HISTORY_BUTTON_ID}
          className="btn"
          aria-expanded={historyOpen}
          aria-controls={UNDO_HISTORY_ID}
          onClick={toggleHistory}
          title="See the recent steps, and undo, change or remove one"
        >
          Edit steps
        </button>
        <button type="button" className="btn" onClick={() => rest('short')} title="Short rest: Channel Divinity +1">
          Short rest
        </button>
        <button type="button" className="btn" onClick={() => rest('long')} title="Long rest: slots, resources and hit points">
          Long rest
        </button>
        <button type="button" className="btn btn--quiet" onClick={() => void exportRaw()}>
          Export
        </button>
      </div>
    </footer>
  )
}
