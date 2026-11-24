import { formatSpan, timerView } from '@/domain/duration'
import { catalog, usePlayStore } from '@/state/session'
import { useTimerPrefs } from '@/state/timerPrefsStore'
import { HourglassIcon } from './Ornaments'

/**
 * The spells that are counting down, with the turns each has left. "New turn" is the tick. Rendered only while something runs, so a
 * rail with no timed spell is no taller. A reminder from each spell's printed duration: End it by hand if the table rules otherwise.
 */
export function TimerPanel(): React.JSX.Element | null {
  const timers = usePlayStore((s) => s.play?.timers)
  const endTimer = usePlayStore((s) => s.endTimer)
  const turnSeconds = useTimerPrefs((s) => s.turnSeconds)
  if (!timers || timers.length === 0) return null

  return (
    <section className="panel timer-panel" aria-label="Spell timers">
      <h2 className="panel__title">
        <HourglassIcon />
        Spell timers
      </h2>
      <ul className="timer-list">
        {timers.map((timer) => {
          const name = catalog.nameOf(timer.spellId)
          const { text, soon } = timerView(timer.remaining, turnSeconds)
          return (
            <li key={timer.spellId} className="timer" data-soon={soon || undefined}>
              <span className="timer__name">{name}</span>
              <span className="timer__left" title={`${formatSpan(timer.remaining)} left of ${formatSpan(timer.total)}`}>
                {text}
              </span>
              <button type="button" className="btn btn--quiet timer__end" aria-label={`End the ${name} timer`} onClick={() => endTimer(timer.spellId)}>
                End
              </button>
              {/* Drawn with scale, not width, so a tick never lays the rail out again. */}
              <span className="timer__bar" aria-hidden="true">
                <span className="timer__fill" style={{ transform: `scaleX(${Math.min(1, timer.remaining / timer.total)})` }} />
              </span>
            </li>
          )
        })}
      </ul>
      <p className="muted timer-panel__note">
        New turn counts down {formatSpan(turnSeconds)}. Based on each spell&rsquo;s printed duration.
      </p>
    </section>
  )
}
