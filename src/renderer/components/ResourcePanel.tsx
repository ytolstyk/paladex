import type { CounterDef } from '@shared/types'
import { selectCounters } from '@/state/selectors'
import { catalog, usePlayStore } from '@/state/session'

/** Pools bigger than this get ±5 buttons as well as ±1 (Lay On Hands is spent in chunks). */
const BIG_POOL = 10

function Pool({ def, left }: { def: CounterDef; left: number }): React.JSX.Element {
  const adjustCounter = usePlayStore((s) => s.adjustCounter)
  const steps = def.max > BIG_POOL ? [5, 1] : [1]
  return (
    <span className="pool">
      {steps.map((n) => (
        <button key={`-${n}`} type="button" className="step" aria-label={`Spend ${n} ${def.label}`} onClick={() => adjustCounter(def.id, -n)}>
          −{n}
        </button>
      ))}
      <span className="resource__count">
        {left}/{def.max}
      </span>
      {[...steps].reverse().map((n) => (
        <button key={`+${n}`} type="button" className="step" aria-label={`Restore ${n} ${def.label}`} onClick={() => adjustCounter(def.id, n)}>
          +{n}
        </button>
      ))}
    </span>
  )
}

function Pips({ def, left }: { def: CounterDef; left: number }): React.JSX.Element {
  const adjustCounter = usePlayStore((s) => s.adjustCounter)
  return (
    <span className="pips" role="group" aria-label={`${def.label}: ${left} of ${def.max} left`}>
      {Array.from({ length: def.max }, (_, i) => {
        const full = i < left
        return (
          <button
            key={i}
            type="button"
            className="pip"
            data-state={full ? 'full' : 'spent'}
            aria-label={`${def.label} ${i + 1}: ${full ? 'available, tap to spend' : 'spent, tap to restore'}`}
            onClick={() => adjustCounter(def.id, full ? -1 : 1)}
          />
        )
      })}
    </span>
  )
}

export function ResourcePanel(): React.JSX.Element {
  const used = usePlayStore(selectCounters)
  return (
    <section className="panel" aria-label="Resources">
      <h2 className="panel__title">Resources</h2>
      <ul className="resources">
        {catalog.counters.map((c) => {
          const left = Math.max(0, c.max - (used[c.id] ?? 0))
          return (
            <li key={c.id} className="resource" title={c.note}>
              <span className="resource__label">{c.label}</span>
              {c.kind === 'uses' ? <Pips def={c} left={left} /> : <Pool def={c} left={left} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
