import { useEffect } from 'react'
import { usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'

/** Inputs that take typed text. Radios, checkboxes and buttons are inputs too, but typing never edits them. */
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password'])

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type)
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

/**
 * Cmd/Ctrl+, toggles settings; Cmd/Ctrl+Z undoes; N starts a new turn. Held-key auto-repeat is ignored (a held key
 * must not fire dozens of actions). Z and N are also ignored while typing; the settings toggle is not, since a comma
 * with a modifier is never text. N does nothing on the settings page, where it would be a hidden side effect; Undo stays
 * live there because it is visible in the footer and the toast, which both remain on screen.
 * The Edit menu deliberately has no Undo item, so Cmd+Z reaches us.
 */
export function useShortcuts(): void {
  const undoLast = usePlayStore((s) => s.undoLast)
  const newTurn = usePlayStore((s) => s.newTurn)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return
      const key = e.key.toLowerCase()
      const hasCommandKey = e.metaKey || e.ctrlKey

      if (hasCommandKey && !e.shiftKey && key === ',') {
        e.preventDefault()
        useUiStore.getState().toggleSettings()
        return
      }
      if (isTypingTarget(e.target)) return
      if (hasCommandKey && !e.shiftKey && key === 'z') {
        e.preventDefault()
        undoLast()
      } else if (!hasCommandKey && !e.altKey && key === 'n' && useUiStore.getState().view !== 'settings') {
        newTurn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoLast, newTurn])
}
