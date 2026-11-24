import { useEffect } from 'react'
import { canUndo as selectCanUndo } from '@/state/playStore'
import { usePlayStore } from '@/state/session'

const TOAST_MS = 4500

export function Toast(): React.JSX.Element | null {
  const toast = usePlayStore((s) => s.toast)
  const canUndo = usePlayStore(selectCanUndo)
  const undoLast = usePlayStore((s) => s.undoLast)
  const dismiss = usePlayStore((s) => s.dismissToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(dismiss, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, dismiss])

  if (!toast) return null
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.msg}</span>
      {canUndo && toast.undoable && (
        <button type="button" className="btn btn--action" onClick={undoLast}>
          Undo
        </button>
      )}
    </div>
  )
}
