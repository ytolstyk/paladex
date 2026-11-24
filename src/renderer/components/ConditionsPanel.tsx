import { CONDITIONS, type ConditionId } from '@shared/constants'
import { CONDITION_INFO } from '@/domain/conditions'
import { selectConditions } from '@/state/selectors'
import { usePlayStore } from '@/state/session'
import { Chip } from './Chip'
import { ConditionIcon } from './Ornaments'

/**
 * Conditions on the character, marked by hand (2024 rules). A chip puts one on or takes it off. What an active one does is listed under
 * the chips, one click open, and every condition's rules are in "All conditions" for when the table asks. Nothing is enforced here
 * except that a condition which makes the character Incapacitated ends concentration, which the toast says.
 */
export function ConditionsPanel(): React.JSX.Element {
  const active = usePlayStore(selectConditions)
  const toggle = usePlayStore((s) => s.toggleCondition)

  return (
    <section className="panel conditions" aria-label="Conditions">
      <h2 className="panel__title">
        <ConditionIcon />
        Conditions
      </h2>
      <div className="chips conditions__chips" role="group" aria-label="Conditions on you">
        {CONDITIONS.map((id) => (
          <Chip key={id} pressed={active.includes(id)} title={CONDITION_INFO[id].summary} onClick={() => toggle(id)}>
            {CONDITION_INFO[id].name}
          </Chip>
        ))}
      </div>
      {active.length > 0 && (
        <ul className="conditions__active" aria-label="Active conditions">
          {active.map((id) => (
            <li key={id} className="condition">
              <details>
                <summary>
                  <strong className="condition__name">{CONDITION_INFO[id].name}</strong>
                  <span className="condition__summary muted">{CONDITION_INFO[id].summary}</span>
                </summary>
                <EffectList id={id} />
              </details>
            </li>
          ))}
        </ul>
      )}
      <details className="conditions__all">
        <summary>All conditions</summary>
        <dl className="conditions__rules">
          {CONDITIONS.map((id) => (
            <div key={id}>
              <dt>{CONDITION_INFO[id].name}</dt>
              <dd>
                <EffectList id={id} />
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}

function EffectList({ id }: { id: ConditionId }): React.JSX.Element {
  return (
    <ul className="condition__effects">
      {CONDITION_INFO[id].effects.map((effect) => (
        <li key={effect}>{effect}</li>
      ))}
    </ul>
  )
}
