import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { INITIATIVE_MAX } from '@shared/constants'
import { signed } from '@/domain/derived'
import { D20, D20_MODE_LABEL, D20_MODES, describeRoll, naturalOf, rollDie, wasClamped, type DiceRoll } from '@/domain/dice'
import { prefersReducedMotion } from '@/hooks/prefersReducedMotion'
import { startInitiativeRoll } from '@/state/rolls'
import { useUiStore } from '@/state/uiStore'
import { DieFace, type DieSides } from './Die'

/** How long one die tumbles. The stylesheet reads it from `--tumble-ms`, so the sum appears exactly when the last die stops. */
export const TUMBLE_MS = 850
/** Each further die starts this much later than the one before (`--die-delay`). */
export const DIE_STAGGER_MS = 90
/** While tumbling, a die's face changes this often. A flicker only: the roll was decided, and written to the sheet, before the tray opened. */
const FLICKER_MS = 70

interface TableDie {
  sides: DieSides
  value: number
  /** Thrown but not kept (the lower die with Advantage, the higher with Disadvantage). */
  dropped: boolean
}

/** The dice on the table for a roll. */
function diceOf(roll: DiceRoll): TableDie[] {
  if (roll.kind === 'inspiration') return [{ sides: roll.sides, value: roll.value, dropped: false }]
  // Two dice can show the same number; only the first of them is "the one that counts".
  const keptAt = roll.dice.indexOf(roll.kept)
  return roll.dice.map((value, i) => ({ sides: D20, value, dropped: i !== keptAt }))
}

/** Keeps the note's line in the layout until the dice land. */
const NBSP = '\u00a0'

const NATURAL_FLOURISH = { twenty: 'Natural 20! ', one: 'Natural 1. ' } as const

function noteFor(roll: DiceRoll): string {
  if (roll.kind === 'inspiration') return 'Add it to one d20 roll. The die is spent.'
  const natural = naturalOf(roll)
  const flourish = natural ? NATURAL_FLOURISH[natural] : ''
  const outcome = wasClamped(roll) ? `The dial holds ${roll.result} (it runs 1 to ${INITIATIVE_MAX}).` : 'Set on the dial.'
  return `${flourish}${outcome}`
}

/**
 * The dice tray: a card over the sheet where a roll tumbles and lands. It only plays the roll back. The roll was decided and
 * written to the sheet (the dial set, the die spent) when it was made (`state/rolls.ts`), so closing the tray early, or a roll
 * replacing another, loses nothing. While it is open it owns the keyboard: Esc closes it, Tab stays inside it, and the sheet's
 * shortcuts are off (`useShortcuts`).
 */
export function DiceTray(): React.JSX.Element | null {
  const shown = useUiStore((s) => s.roll)
  return shown ? <Tray roll={shown.roll} rollId={shown.id} /> : null
}

/** Mounted for as long as the tray is open. A reroll changes only the body, so the scrim and card do not flash again. */
function Tray({ roll, rollId }: { roll: DiceRoll; rollId: number }): React.JSX.Element {
  const closeRoll = useUiStore((s) => s.closeRoll)
  const card = useRef<HTMLElement>(null)

  // Give focus back to what was pressed. A layout effect, so it reads focus before the body's own effect moves it into the tray.
  // "Roll it" is gone once the die is spent, so then focus goes to the first button of the table panel, not to the page.
  useLayoutEffect(() => {
    const pressed = document.activeElement
    return () => {
      const back = pressed instanceof HTMLElement && pressed.isConnected ? pressed : document.querySelector<HTMLElement>('.table-panel button')
      back?.focus()
    }
  }, [])

  // Esc closes the tray and nothing else: the capture phase on `window` runs before the drawer's and the popovers' own Esc
  // (`useDismiss` cannot do this, it listens after them). Tab wraps around the tray's own buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRoll()
        return
      }
      if (e.key !== 'Tab' || !card.current) return
      const buttons = [...card.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (!first || !last) {
        e.preventDefault()
        return
      }
      const at = document.activeElement
      const leaving = !card.current.contains(at) || (e.shiftKey ? at === first : at === last)
      if (!leaving) return
      e.preventDefault()
      // Tab past the last button wraps to the first, Shift+Tab before the first wraps to the last; from outside the tray, focus comes in.
      ;(e.shiftKey ? last : first).focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closeRoll])

  const title = roll.kind === 'initiative' ? 'Initiative' : 'Bardic Inspiration'
  return (
    <div className="tray-scrim" onClick={(e) => e.target === e.currentTarget && closeRoll()}>
      <section
        ref={card}
        className="tray"
        role="dialog"
        aria-modal="true"
        aria-label={`Dice tray: ${title}`}
        style={{ '--tumble-ms': `${TUMBLE_MS}ms` } as React.CSSProperties}
      >
        <h2 className="tray__title">{title}</h2>
        <RollBody key={rollId} roll={roll} onClose={closeRoll} />
      </section>
    </div>
  )
}

function RollBody({ roll, onClose }: { roll: DiceRoll; onClose: () => void }): React.JSX.Element {
  const dice = useMemo(() => diceOf(roll), [roll])
  // With reduced motion there is no show: the dice are down at once (the stylesheet also turns every animation off).
  const [landed, setLanded] = useState(prefersReducedMotion)
  const done = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (landed) return
    const timer = window.setTimeout(() => setLanded(true), TUMBLE_MS + DIE_STAGGER_MS * (dice.length - 1))
    return () => window.clearTimeout(timer)
  }, [landed, dice.length])

  useEffect(() => {
    done.current?.focus()
  }, [])

  const natural = landed ? naturalOf(roll) : null
  return (
    <div className="tray__body" data-natural={natural ?? undefined}>
      <div className="tray__table">
        {dice.map((die, i) => (
          <TumblingDie key={i} die={die} index={i} landed={landed} />
        ))}
        {roll.kind === 'initiative' && (
          <div className="tray__sum" data-landed={landed || undefined}>
            <span className="tray__mod">{signed(roll.modifier)}</span>
            <span className="tray__equals" aria-hidden="true">
              =
            </span>
            <span className="tray__total">{roll.total}</span>
          </div>
        )}
      </div>

      <p className="tray__note" data-landed={landed || undefined}>
        {landed ? noteFor(roll) : NBSP}
      </p>
      <p className="sr-only" role="status">
        {landed ? describeRoll(roll) : ''}
      </p>

      {roll.kind === 'initiative' && (
        <div className="tray__modes" role="group" aria-label="Roll again">
          {D20_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className="step"
              aria-pressed={mode === roll.mode}
              disabled={!landed}
              title={mode === roll.mode ? 'Roll again' : `Roll again with ${D20_MODE_LABEL[mode]}`}
              onClick={() => startInitiativeRoll(mode)}
            >
              {D20_MODE_LABEL[mode]}
            </button>
          ))}
        </div>
      )}
      {/* Skip only ends the show: the roll is already on the sheet. */}
      <button ref={done} type="button" className="btn tray__done" onClick={landed ? onClose : () => setLanded(true)}>
        {landed ? 'Done' : 'Skip'}
      </button>
    </div>
  )
}

/** One die. It owns its flicker, so the rest of the card does not re-render every few frames. */
function TumblingDie({ die, index, landed }: { die: TableDie; index: number; landed: boolean }): React.JSX.Element {
  const [flicker, setFlicker] = useState(() => rollDie(die.sides, Math.random)) // not the answer: it must not show before the dice land
  useEffect(() => {
    if (landed) return
    // Math.random, not the roll's source: these faces are for show and never a result.
    const timer = window.setInterval(() => setFlicker(rollDie(die.sides, Math.random)), FLICKER_MS)
    return () => window.clearInterval(timer)
  }, [landed, die.sides])

  return (
    <div
      className="tray__die"
      data-rolling={!landed || undefined}
      data-landed={landed || undefined}
      data-dropped={(landed && die.dropped) || undefined}
      style={{ '--die-delay': `${index * DIE_STAGGER_MS}ms` } as React.CSSProperties}
    >
      <DieFace size={die.sides} label={landed ? die.value : flicker} className="die--roll" />
    </div>
  )
}
