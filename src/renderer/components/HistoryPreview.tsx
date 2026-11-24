import { useMemo, useState } from 'react'
import type { DropReason } from '@/domain/calls'
import { plural } from '@/domain/describe'
import { describeNoVisibleChange, previewHistoryChange, type OkPreview, type PreviewRefusal } from '@/domain/historyPreview'
import { formatLog } from '@/domain/log'
import type { HistoryChange } from '@/domain/replay'
import { callWith, editorFor, type StepEditor } from '@/domain/stepEdit'
import type { Step } from '@/domain/steps'
import type { UndoEntry } from '@/domain/undo'
import { catalog, usePlayStore } from '@/state/session'

/** What a person does to a step; the words on the button that applies it. */
export type Mode = HistoryChange['kind']
export const MODE_LABEL: Record<Mode, string> = { revert: 'Undo from here', remove: 'Remove step', edit: 'Apply change' }

/** A long run can change thousands of steps; the lists show the first few and count the rest. */
const MAX_LISTED = 20

const REFUSAL_TEXT: Record<PreviewRefusal, string> = {
  empty: 'There is nothing to correct yet.',
  'out-of-sync': 'The history cannot be replayed exactly, so it is read-only. Undo still works.',
  'step-gone': 'This step is gone from the list (it was undone, or fell off the end).',
  'target-failed': 'That value cannot be applied at that point in the history.'
}

const DROP_HEADING: Record<DropReason, string> = {
  'no-longer-possible': 'Later steps that can no longer happen',
  'no-longer-needed': 'Later steps no longer needed'
}

export const stepText = (step: Step): string => formatLog(step.entry, catalog.nameOf)

function Field({ editor, draft, onChange }: { editor: StepEditor; draft: string; onChange: (value: string) => void }): React.JSX.Element {
  return (
    <label className="steps__field">
      <span>{editor.label}</span>
      {editor.kind === 'number' ? (
        <input
          className="field"
          type="number"
          inputMode="numeric"
          min={editor.min}
          max={editor.max}
          value={draft}
          placeholder={editor.hint}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <select className="field" value={draft} onChange={(e) => onChange(e.target.value)}>
          {editor.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </label>
  )
}

function StepList({ label, steps }: { label: string; steps: readonly Step[] }): React.JSX.Element | null {
  if (steps.length === 0) return null
  return (
    <div>
      <p className="steps__label">{label}</p>
      <ul className="steps__diff">
        {steps.slice(0, MAX_LISTED).map((s) => (
          <li key={s.id}>{stepText(s)}</li>
        ))}
        {steps.length > MAX_LISTED && <li className="muted">and {steps.length - MAX_LISTED} more</li>}
      </ul>
    </div>
  )
}

function Outcome({ preview }: { preview: OkPreview }): React.JSX.Element {
  const { replayed, differences } = preview
  const dropped = (reason: DropReason): Step[] => replayed.dropped.filter((d) => d.reason === reason).map((d) => d.step)
  return (
    <>
      <ul className="steps__diff" aria-label="What changes">
        {differences.length === 0 ? <li className="muted">{describeNoVisibleChange(preview)}</li> : differences.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <StepList label="Later steps that now read differently" steps={replayed.changed} />
      <StepList label={DROP_HEADING['no-longer-possible']} steps={dropped('no-longer-possible')} />
      <StepList label={DROP_HEADING['no-longer-needed']} steps={dropped('no-longer-needed')} />
      {replayed.trimmed > 0 && (
        <p className="steps__note">
          The {plural(replayed.trimmed, 'oldest step', 'oldest steps')} will fall off the end of the list.
        </p>
      )}
    </>
  )
}

interface Props {
  step: Step
  mode: Mode
  undo: readonly UndoEntry[]
  /** True when the undo list moved after the player began: the preview is of the new list and must be looked at again. */
  stale: boolean
  onLookAgain: () => void
  onCancel: () => void
  onApply: (change: HistoryChange) => void
}

/**
 * What a correction of one step would do, shown under the step before it is applied. The typed value lives here, so typing redraws this
 * panel and not the whole list; the parent gives it a `key` per step and mode, which starts a fresh draft.
 */
export function HistoryPreview({ step, mode, undo, stale, onLookAgain, onCancel, onApply }: Props): React.JSX.Element {
  const play = usePlayStore((s) => s.play)
  const editor = useMemo(() => (mode === 'edit' ? editorFor(step, catalog) : null), [step, mode])
  const [draft, setDraft] = useState(() => (editor ? String(editor.value ?? '') : ''))

  const change = useMemo((): HistoryChange | null => {
    if (mode !== 'edit') return { kind: mode, stepId: step.id }
    const call = callWith(step, draft)
    return call ? { kind: 'edit', stepId: step.id, call } : null
  }, [step, mode, draft])
  const preview = useMemo(() => (play && change ? previewHistoryChange(play, undo, catalog, change) : null), [play, undo, change])
  const ready = preview?.ok ? preview : null

  return (
    <div className="steps__preview" role="group" aria-label={`${MODE_LABEL[mode]}: ${stepText(step)}`}>
      {editor && <Field editor={editor} draft={draft} onChange={setDraft} />}
      {editor?.kind === 'number' && editor.value !== null && (
        <p className="muted">
          Asked for {editor.value}; the log says: {stepText(step)}
        </p>
      )}
      {change === null && <p className="steps__note">Enter a whole number to preview the change.</p>}
      {preview && !preview.ok && <p className="steps__note">{REFUSAL_TEXT[preview.reason]}</p>}
      {stale && (
        <p className="steps__note">
          The history changed while this was open.{' '}
          <button type="button" className="link-button" onClick={onLookAgain}>
            Check the preview again
          </button>
        </p>
      )}
      {ready && <Outcome preview={ready} />}
      <div className="steps__actions">
        <button type="button" className="btn btn--action" disabled={!ready || !change || stale} onClick={() => change && onApply(change)}>
          {MODE_LABEL[mode]}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export { REFUSAL_TEXT }
