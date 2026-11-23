import { useState } from 'react'
import type { CastTime, Payment, SpellComponents } from '@shared/types'
import { COMPONENT_KINDS, componentsTitle, componentWords } from '@/domain/components'
import { CAST_LABEL, CAST_LETTER, paymentLabel } from '@/domain/labels'

/** The round badge on a card: A, B, R or T for the action it takes. Bonus actions are filled so they stand out. */
export function CastRoundel({ castTime }: { castTime: CastTime }): React.JSX.Element {
  return (
    <span className="roundel" data-time={castTime} title={CAST_LABEL[castTime]} aria-label={CAST_LABEL[castTime]}>
      {CAST_LETTER[castTime]}
    </span>
  )
}

/**
 * V S M, always all three: a letter the spell needs is lit and one it doesn't is faded, so "no gestures" reads at a glance
 * (a free hand, a gag and a Silence all ask different questions). The tooltip says what each one demands.
 */
export function ComponentMarks({ components }: { components: SpellComponents }): React.JSX.Element {
  const title = componentsTitle(components)
  return (
    <span className="components" role="img" aria-label={`Components: ${componentWords(components).join(', ') || 'none'}`} title={title}>
      {COMPONENT_KINDS.map((k) => (
        <span key={k.key} className="components__mark" data-needed={components[k.key] || undefined}>
          {k.letter}
        </span>
      ))}
    </span>
  )
}

interface CastButtonProps {
  /** "Cast" or "Use". */
  verb: string
  /** The small line under the verb: what it will cost, or why it can't be used. */
  detail: string | null
  disabled: boolean
  /** Flags a turn-economy warning (a second slotted spell, a second bonus action). */
  warn: boolean
  title: string | undefined
  onActivate(): void
}

/** The gilt button on a card. Each press releases a ring of light (purely visual; it never affects the action). */
export function CastButton({ verb, detail, disabled, warn, title, onActivate }: CastButtonProps): React.JSX.Element {
  const [burst, setBurst] = useState(0)
  return (
    <button
      type="button"
      className="cast-button"
      disabled={disabled}
      data-warn={warn || undefined}
      title={title}
      onClick={() => {
        onActivate()
        setBurst((n) => n + 1)
      }}
    >
      {verb}
      {detail && <span className="cast-button__level">{detail}</span>}
      {burst > 0 && <span key={burst} className="cast-burst" aria-hidden="true" onAnimationEnd={() => setBurst(0)} />}
    </button>
  )
}

const STEP_GLYPH = { lower: '‹', higher: '›' } as const

interface StepButtonProps {
  side: keyof typeof STEP_GLYPH
  /** The option this arrow switches to, or null when there is none on that side. */
  target: Payment | null
  onPick(payment: Payment): void
}

function StepButton({ side, target, onPick }: StepButtonProps): React.JSX.Element {
  const text = target ? `Cast with ${paymentLabel(target)}` : `No ${side} option`
  return (
    <button
      type="button"
      className="step"
      disabled={!target}
      aria-label={text}
      title={target ? text : undefined}
      onClick={() => target && onPick(target)} // the guard narrows the type; a disabled button never fires it
    >
      {STEP_GLYPH[side]}
    </button>
  )
}

/** Two small arrows under the Cast button to pay with another option: a higher slot (upcasting), or a slot instead of a free cast. */
export function PaymentStepper({ lower, higher, onPick }: { lower: Payment | null; higher: Payment | null; onPick(payment: Payment): void }): React.JSX.Element {
  return (
    <span className="payment-stepper">
      <StepButton side="lower" target={lower} onPick={onPick} />
      <StepButton side="higher" target={higher} onPick={onPick} />
    </span>
  )
}
