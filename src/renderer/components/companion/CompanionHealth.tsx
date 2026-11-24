import { HEALTH_LABEL } from '@/domain/vitals'
import type { CompanionView } from '@/domain/companion'
import { RuneRing } from '../Ornaments'

/** Hit points: the biggest thing on the screen, in a colour that says how bad it is before the number is read. */
export function HealthPanel({ health }: Pick<CompanionView, 'health'>): React.JSX.Element {
  const { hp, hpMax, tempHp, percent, state } = health
  return (
    <section className="panel cp-hp" data-state={state} aria-label={`Hit points: ${hp} of ${hpMax}. ${HEALTH_LABEL[state]}`}>
      <div className="cp-head-row">
        <h2 className="cp-title">Hit points</h2>
        <span className="cp-status">{HEALTH_LABEL[state]}</span>
      </div>
      <div className="cp-hp__figures">
        <span className="cp-hp__now">{hp}</span>
        <span className="cp-hp__max">/ {hpMax}</span>
        {tempHp > 0 && (
          <span className="cp-hp__temp">
            +{tempHp}
            <small> temp</small>
          </span>
        )}
      </div>
      {/* Scaled, not resized: a change moves a compositor layer and lays nothing out. */}
      <div className="cp-bar" aria-hidden="true">
        <div className="cp-bar__fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </section>
  )
}

/** What the character is holding on to: the concentration spell, and anything else still running. */
export function FocusPanel({ concentration, effects }: Pick<CompanionView, 'concentration' | 'effects'>): React.JSX.Element {
  return (
    <section className="panel cp-focus" data-active={concentration ? true : undefined} aria-label="Concentration">
      {concentration ? (
        <div className="cp-focus__main">
          <RuneRing />
          <div className="cp-focus__text">
            <p className="cp-label">Concentrating on</p>
            <p className="cp-focus__name">{concentration.name}</p>
          </div>
          {concentration.timer && (
            <span className="cp-focus__timer" data-soon={concentration.timer.soon || undefined}>
              {concentration.timer.text}
            </span>
          )}
        </div>
      ) : (
        <p className="cp-focus__none">Not concentrating</p>
      )}
      {effects.length > 0 && (
        <ul className="cp-effects" aria-label="Other running spells">
          {effects.map((effect) => (
            <li key={effect.id} className="cp-effect" data-soon={effect.soon || undefined}>
              <span>{effect.name}</span>
              <span className="cp-effect__left">{effect.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Only drawn while something is wrong: a quiet table has no "Conditions: none" to read. */
export function ConditionsPanel({ conditions }: Pick<CompanionView, 'conditions'>): React.JSX.Element | null {
  if (conditions.length === 0) return null
  return (
    <section className="panel cp-conditions" aria-label="Conditions">
      <ul>
        {conditions.map((c) => (
          <li key={c.id} className="cp-condition" title={c.summary}>
            {c.name}
          </li>
        ))}
      </ul>
    </section>
  )
}
