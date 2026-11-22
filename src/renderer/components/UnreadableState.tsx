import { usePlayStore } from '@/state/session'

/** Blocking prompt: the saved state could not be read. Never silently reseeds. */
export function UnreadableState(): React.JSX.Element {
  const reason = usePlayStore((s) => s.reason)
  const exportRaw = usePlayStore((s) => s.exportRaw)
  const resetState = usePlayStore((s) => s.resetState)

  return (
    <main className="blocker" role="alertdialog" aria-labelledby="blocker-title">
      <div className="panel blocker__box">
        <h1 id="blocker-title" className="panel__title">
          Your saved state can't be read
        </h1>
        <p>
          Neither the saved file nor its backup passed validation, so nothing was loaded. Your data is untouched on
          disk.
        </p>
        <p className="muted">Reason: {reason}</p>
        <p>Export the raw file first if you want to inspect it. Starting over moves the old files aside; it deletes nothing.</p>
        <div className="blocker__actions">
          <button type="button" className="btn" onClick={() => void exportRaw()}>
            Export raw file
          </button>
          <button type="button" className="btn btn--danger" onClick={() => void resetState()}>
            Start over (keep old files aside)
          </button>
        </div>
      </div>
    </main>
  )
}
