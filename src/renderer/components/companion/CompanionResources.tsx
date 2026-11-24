import type { CompanionView, ResourceView } from '@/domain/companion'

function Resource({ resource }: { resource: ResourceView }): React.JSX.Element {
  const { label, kind, max, left } = resource
  return (
    <li className="cp-res" data-empty={left === 0 || undefined} aria-label={`${label}: ${left} of ${max} left`}>
      <span className="cp-res__label">{label}</span>
      {kind === 'uses' ? (
        <span className="cp-pips" aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className="cp-pip" data-state={i < left ? 'full' : 'spent'} />
          ))}
        </span>
      ) : (
        <span className="cp-pool" aria-hidden="true">
          <span className="cp-pool__bar">
            <span className="cp-pool__fill" style={{ transform: `scaleX(${max > 0 ? left / max : 0})` }} />
          </span>
          <span className="cp-pool__count">
            {left}
            <small>/{max}</small>
          </span>
        </span>
      )}
    </li>
  )
}

/** Class and species resources as one row of small tiles under the main panels. */
export function ResourcesStrip({ resources }: Pick<CompanionView, 'resources'>): React.JSX.Element | null {
  if (resources.length === 0) return null
  return (
    <ul className="cp-resources" aria-label="Resources">
      {resources.map((r) => (
        <Resource key={r.id} resource={r} />
      ))}
    </ul>
  )
}
