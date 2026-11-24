import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { plural } from '@/domain/describe'
import { isReplayable, stepsOf, type HistoryChange } from '@/domain/replay'
import { editorFor } from '@/domain/stepEdit'
import type { Step } from '@/domain/steps'
import type { UndoEntry } from '@/domain/undo'
import { useDismiss } from '@/hooks/useDismiss'
import { canUndo as selectCanUndo } from '@/state/playStore'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { HistoryPreview, MODE_LABEL, REFUSAL_TEXT, stepText, type Mode } from './HistoryPreview'
import { HISTORY_BUTTON_ID, UNDO_HISTORY_ID } from './ids'

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/** The step being worked on. `seen` is the undo list its preview was made from: when the list moves the player is told to look again. */
interface Target {
  stepId: number
  mode: Mode
  seen: readonly UndoEntry[]
}

function timeOf(step: Step): { text: string; iso: string | undefined } {
  const when = new Date(step.t)
  return Number.isNaN(when.getTime()) ? { text: '', iso: undefined } : { text: clock.format(when), iso: when.toISOString() }
}

const StepRow = memo(function StepRow({
  step,
  historyReplayable,
  hasEditor,
  onPick
}: {
  step: Step
  historyReplayable: boolean
  hasEditor: boolean
  onPick: (step: Step, mode: Mode) => void
}): React.JSX.Element {
  const time = timeOf(step)
  return (
    <>
      <time className="muted steps__time" dateTime={time.iso}>
        {time.text}
      </time>
      <span className="steps__text">{stepText(step)}</span>
      <span className="steps__buttons">
        <button type="button" className="btn btn--quiet" disabled={!historyReplayable} onClick={() => onPick(step, 'revert')} title="Undo this step and everything after it">
          {MODE_LABEL.revert}
        </button>
        {hasEditor && (
          <button type="button" className="btn btn--quiet" disabled={!historyReplayable} onClick={() => onPick(step, 'edit')}>
            Edit
          </button>
        )}
        <button type="button" className="btn btn--quiet" disabled={!historyReplayable} onClick={() => onPick(step, 'remove')} title="Take this step out and keep the later ones">
          Remove
        </button>
      </span>
    </>
  )
})

/**
 * The recent steps, newest first, each of which can be undone from, changed or removed with a preview of what that does to the
 * sheet. Session only (the list is not saved), so a relaunch starts it empty. A run of taps shows as one group.
 */
export function UndoHistory(): React.JSX.Element {
  const play = usePlayStore((s) => s.play)
  const undo = usePlayStore((s) => s.undo)
  const hasBackup = usePlayStore((s) => s.historyBackup !== null)
  const canUndo = usePlayStore(selectCanUndo)
  const undoLast = usePlayStore((s) => s.undoLast)
  const applyHistoryChange = usePlayStore((s) => s.applyHistoryChange)
  const closeHistory = useUiStore((s) => s.closeHistory)
  const [target, setTarget] = useState<Target | null>(null)
  const [openGroupIds, setOpenGroupIds] = useState<ReadonlySet<number>>(new Set())
  const panelRef = useRef<HTMLElement>(null)

  const close = useCallback(() => {
    closeHistory()
    document.getElementById(HISTORY_BUTTON_ID)?.focus()
  }, [closeHistory])
  // The footer stays usable while the list is open (Undo updates it), and the toast's Undo is a press outside it too.
  const ignore = useCallback((el: EventTarget | null) => el instanceof Element && el.closest('.footer, .toast') !== null, [])
  useDismiss(true, panelRef, close, ignore)

  const steps = useMemo(() => stepsOf(undo), [undo])
  const stepById = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps])
  const editableIds = useMemo(() => new Set(steps.filter((s) => editorFor(s, catalog) !== null).map((s) => s.id)), [steps])
  const entriesNewestFirst = useMemo(() => [...undo].reverse(), [undo])
  const historyReplayable = useMemo(() => (play ? isReplayable(play, undo, catalog) : false), [play, undo])
  const targetStep = target ? stepById.get(target.stepId) : undefined

  // `undo` is replaced by every change, so the handler would be new each time; the target is set from the list as it is now.
  const pick = useCallback((step: Step, mode: Mode) => setTarget({ stepId: step.id, mode, seen: undo }), [undo])
  const toggleGroup = (firstId: number): void =>
    setOpenGroupIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(firstId)) next.add(firstId)
      return next
    })
  const apply = (change: HistoryChange): void => {
    if (applyHistoryChange(change, undo)) setTarget(null)
  }

  const renderStep = (step: Step): React.JSX.Element => (
    <li key={step.id} className="steps__row" data-selected={target?.stepId === step.id || undefined}>
      <StepRow step={step} historyReplayable={historyReplayable} hasEditor={editableIds.has(step.id)} onPick={pick} />
      {target && targetStep === step && (
        <HistoryPreview
          key={`${step.id}:${target.mode}`}
          step={step}
          mode={target.mode}
          undo={undo}
          stale={target.seen !== undo}
          onLookAgain={() => setTarget({ ...target, seen: undo })}
          onCancel={() => setTarget(null)}
          onApply={apply}
        />
      )}
    </li>
  )

  return (
    <section id={UNDO_HISTORY_ID} className="steps" ref={panelRef} role="dialog" aria-label="Edit steps">
      <header className="steps__head">
        <h3 className="steps__title">Edit steps</h3>
        <span className="muted">
          This session only, last {plural(steps.length, 'step', 'steps')}
        </span>
        {hasBackup && (
          <button type="button" className="btn btn--action" onClick={undoLast} disabled={!canUndo}>
            Take back the last change
          </button>
        )}
        <button type="button" className="btn btn--quiet" onClick={close}>
          Close
        </button>
      </header>
      {!historyReplayable && steps.length > 0 && <p className="steps__note">{REFUSAL_TEXT['out-of-sync']}</p>}
      {target && !targetStep && (
        <p className="steps__note">
          {REFUSAL_TEXT['step-gone']}{' '}
          <button type="button" className="link-button" onClick={() => setTarget(null)}>
            Dismiss
          </button>
        </p>
      )}
      {steps.length === 0 ? (
        <p className="muted steps__empty">Nothing yet. Casts, rests and other changes you make appear here.</p>
      ) : (
        <ol className="steps__list">
          {entriesNewestFirst.map((entry) => {
            const [oldest] = entry.steps
            if (!oldest) return null
            if (entry.steps.length === 1) return renderStep(oldest)
            const newestFirst = [...entry.steps].reverse()
            const isOpen = openGroupIds.has(oldest.id) || entry.steps.some((s) => s.id === target?.stepId)
            return (
              <li key={oldest.id} className="steps__group">
                <button type="button" className="steps__group-head" aria-expanded={isOpen} onClick={() => toggleGroup(oldest.id)}>
                  <span className="steps__text">{stepText(newestFirst[0] ?? oldest)}</span>
                  <span className="muted">× {entry.steps.length}</span>
                </button>
                {isOpen && <ol className="steps__list steps__list--inner">{newestFirst.map(renderStep)}</ol>}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
