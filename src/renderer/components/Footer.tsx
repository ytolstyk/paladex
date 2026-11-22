import { formatLog } from '@/domain/log'
import { catalog, usePlayStore } from '@/state/session'

export function Footer(): React.JSX.Element {
  const lastEntry = usePlayStore((s) => s.play?.log.at(-1))
  const canUndo = usePlayStore((s) => s.undo.length > 0)
  const undoLast = usePlayStore((s) => s.undoLast)
  const saveError = usePlayStore((s) => s.saveError)
  const exportRaw = usePlayStore((s) => s.exportRaw)
  const takeRest = usePlayStore((s) => s.takeRest)

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
        <button type="button" className="btn" onClick={undoLast} disabled={!canUndo} title="Undo (Cmd+Z)">
          Undo
        </button>
        <button type="button" className="btn" onClick={() => takeRest('short')} title="Short rest: Channel Divinity +1">
          Short rest
        </button>
        <button type="button" className="btn" onClick={() => takeRest('long')} title="Long rest: slots, resources and hit points">
          Long rest
        </button>
        <button type="button" className="btn btn--quiet" onClick={() => void exportRaw()}>
          Export
        </button>
      </div>
    </footer>
  )
}
