import { useState } from 'react'
import { DEFAULT_TURN_SECONDS, SECONDS_PER } from '@shared/constants'
import { plural } from '@/domain/describe'
import { formatSpan } from '@/domain/duration'
import { joinTurnLength, splitTurnLength, TURN_UNITS, type TurnUnitId } from '@/domain/timerPrefs'
import { useTimerPrefs } from '@/state/timerPrefsStore'

/** Quick choices: a round of combat, and the two lengths most tables use away from one. */
const PRESETS = [
  { seconds: DEFAULT_TURN_SECONDS, label: 'Combat round (6 seconds)' },
  { seconds: 60, label: '1 minute' },
  { seconds: 600, label: '10 minutes' }
] as const

/** How long one "New turn" is, for the countdown on timed spells. */
export function TimerSettings(): React.JSX.Element {
  const turnSeconds = useTimerPrefs((s) => s.turnSeconds)
  const setTurnSeconds = useTimerPrefs((s) => s.setTurnSeconds)
  // The field is text while you type ("" and "1" on the way to "10"); the setting only changes when it reads as a whole number of 1 or more.
  const initial = splitTurnLength(turnSeconds)
  const [text, setText] = useState(String(initial.amount))
  const [unit, setUnit] = useState<TurnUnitId>(initial.unit)

  // The fields show what was typed while it is being typed; they take the setting's own form (so a clamped value shows as stored) on blur.
  const showSetting = (seconds: number): void => {
    const next = splitTurnLength(seconds)
    setText(String(next.amount))
    setUnit(next.unit)
  }
  const choose = (seconds: number): void => {
    setTurnSeconds(seconds)
    showSetting(seconds)
  }

  const commit = (nextText: string, nextUnit: TurnUnitId): void => {
    const amount = Number(nextText)
    if (nextText.trim() !== '' && Number.isFinite(amount) && amount >= 1) setTurnSeconds(joinTurnLength(amount, nextUnit))
  }

  const minuteInTurns = Math.ceil(SECONDS_PER.minute / turnSeconds)

  return (
    <section className="timer-settings" aria-labelledby="timer-settings-title">
      <h3 id="timer-settings-title" className="settings__heading">
        Spell timers
      </h3>
      <p className="muted">
        Casting a spell with a set duration (Bless, Hunter&rsquo;s Mark) starts a countdown. Each time you press <strong>New turn</strong>{' '}
        it drops by one turn, and a short or long rest takes off an hour or eight. Say here how long one of your turns is in the game;
        a running timer keeps its time if you change this, and only the next tick uses the new length.
      </p>
      <div className="timer-settings__row">
        <label className="timer-settings__field">
          <span>One turn is</span>
          <input
            type="number"
            className="field field--amount"
            min={1}
            step={1}
            inputMode="numeric"
            value={text}
            onBlur={() => showSetting(turnSeconds)}
            onChange={(e) => {
              setText(e.target.value)
              commit(e.target.value, unit)
            }}
          />
        </label>
        <label className="sr-only" htmlFor="turn-unit">
          Unit of a turn
        </label>
        <select
          id="turn-unit"
          className="field"
          value={unit}
          onChange={(e) => {
            const next = TURN_UNITS.find((u) => u.id === e.target.value)?.id ?? 'seconds'
            setUnit(next)
            commit(text, next)
          }}
        >
          {TURN_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="chips" role="group" aria-label="Common turn lengths">
        {PRESETS.map((p) => (
          <button key={p.seconds} type="button" className="chip" aria-pressed={turnSeconds === p.seconds} onClick={() => choose(p.seconds)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted">
        Now: one turn is {formatSpan(turnSeconds)}, so a 1 minute spell lasts {plural(minuteInTurns, 'turn', 'turns')}.
      </p>
    </section>
  )
}
