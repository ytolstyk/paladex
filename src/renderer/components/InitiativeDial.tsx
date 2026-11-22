import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { INITIATIVE_MAX, INITIATIVE_MIN } from '@shared/constants'
import { angleFor, appendDigit, arcPath, isMajorTick, pointerAngle, polar, stepInitiative, TYPING_WINDOW_MS, valueAt, valueForKey } from '@/domain/dial'
import { selectInitiative } from '@/state/selectors'
import { usePlayStore } from '@/state/session'

/**
 * The initiative dial: an old brass dial with a knob you turn to a number from 1 to 25. Drag the knob, click the scale,
 * use the arrow keys (Page Up and Down step by five, Home and End jump to the ends), or type the number. The value is
 * saved with the character. The face is drawn in a 200 x 200 box; all geometry is in `domain/dial.ts`.
 */

const CENTER = 100
const TICK_OUTER = 84
const TICK_MAJOR_INNER = 70
const TICK_MINOR_INNER = 77
const NUMERAL_RADIUS = 58
const LIT_ARC_RADIUS = 89
const VALUES = Array.from({ length: INITIATIVE_MAX - INITIATIVE_MIN + 1 }, (_, i) => INITIATIVE_MIN + i)

function Tick({ value, lit }: { value: number; lit: boolean }): React.JSX.Element {
  const angle = angleFor(value)
  const from = polar(CENTER, CENTER, isMajorTick(value) ? TICK_MAJOR_INNER : TICK_MINOR_INNER, angle)
  const to = polar(CENTER, CENTER, TICK_OUTER, angle)
  return <line className="dial__tick" data-major={isMajorTick(value) || undefined} data-lit={lit || undefined} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
}

export function InitiativeDial(): React.JSX.Element {
  const initiative = usePlayStore(selectInitiative)
  const setInitiative = usePlayStore((s) => s.setInitiative)
  const face = useRef<HTMLDivElement>(null)
  /** Digits typed so far, and when the last one arrived (event timestamps, so it is the same clock as the key events). */
  /** A ref, not state: the release handler must know about a drag that started in the same tick, before any re-render. */
  const dragging = useRef(false)
  const typed = useRef({ text: '', at: -Infinity })
  /** The value under the pointer while it is down. The dial follows it live and only saves when the pointer is released. */
  const [draft, setDraft] = useState<number | null>(null)

  const shown = draft ?? initiative
  const save = (value: number | null): void => {
    if (value !== initiative) setInitiative(value)
  }

  const valueUnder = (e: PointerEvent<HTMLDivElement>): number => {
    const box = (face.current ?? e.currentTarget).getBoundingClientRect()
    return valueAt(pointerAngle(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2)))
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    setDraft(valueUnder(e))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (dragging.current) setDraft(valueUnder(e))
  }
  // Read the release position itself: the last pointermove may not have re-rendered yet, so `draft` can be one step behind.
  const onPointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (!dragging.current) return
    dragging.current = false
    save(valueUnder(e))
    setDraft(null)
  }
  // The drag is over without a release to save (cancelled, or the pointer was taken away): drop it, keep the old value.
  const abandonDrag = (): void => {
    dragging.current = false
    setDraft(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (/^[0-9]$/.test(e.key)) {
      const continuing = e.timeStamp - typed.current.at <= TYPING_WINDOW_MS
      const text = appendDigit(continuing ? typed.current.text : '', e.key)
      typed.current = { text, at: e.timeStamp }
      if (Number(text) >= INITIATIVE_MIN) save(Number(text))
      e.preventDefault()
      return
    }
    typed.current = { text: '', at: -Infinity } // any other key ends a run of typed digits
    const effect = valueForKey(e.key, initiative)
    if (!effect) return
    e.preventDefault()
    save(effect.value)
  }

  // An unset dial parks its knob at the low end, dimmed (see `data-set` in app.css); the empty readout is what says "not set".
  const isLit = (value: number): boolean => shown !== null && value <= shown
  const knobAngle = angleFor(shown ?? INITIATIVE_MIN)

  return (
    <div className="dial" data-set={shown !== null || undefined}>
      <div
        ref={face}
        className="dial__face"
        data-dragging={draft !== null || undefined}
        role="slider"
        tabIndex={0}
        aria-label="Initiative"
        aria-valuemin={INITIATIVE_MIN}
        aria-valuemax={INITIATIVE_MAX}
        aria-valuenow={shown ?? INITIATIVE_MIN}
        aria-valuetext={shown === null ? 'Not set' : String(shown)}
        title="Turn the dial: drag it, click a number, use the arrow keys, or type your initiative"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={abandonDrag}
        onLostPointerCapture={abandonDrag}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="dial-bezel" cx="38%" cy="30%" r="85%">
              <stop offset="0" className="dial__stop dial__stop--light" />
              <stop offset="0.55" className="dial__stop dial__stop--mid" />
              <stop offset="1" className="dial__stop dial__stop--deep" />
            </radialGradient>
            <radialGradient id="dial-knob" cx="35%" cy="28%" r="90%">
              <stop offset="0" className="dial__stop dial__stop--light" />
              <stop offset="0.6" className="dial__stop dial__stop--mid" />
              <stop offset="1" className="dial__stop dial__stop--deep" />
            </radialGradient>
          </defs>

          <circle className="dial__bezel" cx={CENTER} cy={CENTER} r="96" />
          <circle className="dial__plate" cx={CENTER} cy={CENTER} r="91" />
          {shown !== null && shown > INITIATIVE_MIN && (
            <path className="dial__arc" d={arcPath(CENTER, CENTER, LIT_ARC_RADIUS, angleFor(INITIATIVE_MIN), angleFor(shown))} />
          )}
          {VALUES.map((value) => (
            <Tick key={value} value={value} lit={isLit(value)} />
          ))}
          {VALUES.filter(isMajorTick).map((value) => {
            const at = polar(CENTER, CENTER, NUMERAL_RADIUS, angleFor(value))
            return (
              <text key={value} className="dial__numeral" data-lit={isLit(value) || undefined} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central">
                {value}
              </text>
            )
          })}
          <text className="dial__mark" x={CENTER} y="178" textAnchor="middle">
            INITIATIVE
          </text>

          <g className="dial__knob" style={{ transform: `rotate(${knobAngle}deg)` }}>
            <circle className="dial__knob-body" cx={CENTER} cy={CENTER} r="45" />
            <circle className="dial__knurl" cx={CENTER} cy={CENTER} r="42" />
            <path className="dial__pointer" d="M100 56 96.2 40 100 27 103.8 40Z" />
          </g>
          <circle className="dial__cap" cx={CENTER} cy={CENTER} r="27" />
          <text className="dial__readout" x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="central">
            {shown ?? '–'}
          </text>
        </svg>
      </div>

      <div className="dial__controls">
        <button type="button" className="step" aria-label="Lower initiative by one" onClick={() => save(stepInitiative(initiative, -1))}>
          −1
        </button>
        <span className="dial__caption">
          Initiative
          {initiative !== null ? (
            <button type="button" className="link-button dial__clear" onClick={() => save(null)}>
              clear
            </button>
          ) : (
            <span className="dial__hint">turn the dial</span>
          )}
        </span>
        <button type="button" className="step" aria-label="Raise initiative by one" onClick={() => save(stepInitiative(initiative, 1))}>
          +1
        </button>
      </div>
    </div>
  )
}
