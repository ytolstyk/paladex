import { useEffect } from 'react'
import { usePlayStore } from '@/state/session'

const TOAST_MS = 4500

export function Toast(): React.JSX.Element | null {
  const toast = usePlayStore((s) => s.toast)
  const canUndo = usePlayStore((s) => s.undo.length > 0)
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
        <button type="button" className="link-button" onClick={undoLast}>
          Undo
        </button>
      )}
    </div>
  )
}
