import { useEffect } from 'react'
import { usePlayStore } from '@/state/session'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

/**
 * Cmd/Ctrl+Z undoes; N starts a new turn. Ignored while typing, and for held-key auto-repeat
 * (a held key must not fire dozens of actions). The Edit menu deliberately has no Undo item, so Cmd+Z reaches us.
 */
export function useShortcuts(): void {
  const undoLast = usePlayStore((s) => s.undoLast)
  const newTurn = usePlayStore((s) => s.newTurn)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && key === 'z') {
        e.preventDefault()
        undoLast()
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey && key === 'n') {
        newTurn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoLast, newTurn])
}
