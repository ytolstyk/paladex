import { useEffect, type RefObject } from 'react'

/**
 * Closes a popover on a press outside `ref` or on Escape. Pass a stable `onClose` (a `useCallback` or a state setter
 * wrapper), since the listeners are re-attached whenever it changes.
 */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref, onClose])
}
