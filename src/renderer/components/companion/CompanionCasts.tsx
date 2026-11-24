import { roman } from '@/domain/derived'
import type { CastItem, CompanionView } from '@/domain/companion'

/** More than this many spells and the names are set smaller, so a long list still fits without scrolling. */
const DENSE_AFTER = 14

const VIA_TAG: Partial<Record<NonNullable<CastItem['via']>, string>> = { free: 'Free', charge: 'Item' }

function Chip({ item }: { item: CastItem }): React.JSX.Element {
  const via = item.via ? VIA_TAG[item.via] : undefined
  return (
    <li className="cp-chip" data-ready={item.ready} data-via={item.via ?? undefined}>
      <span className="cp-chip__name">{item.name}</span>
      {!item.ready && <span className="cp-sr">, no way to cast it right now</span>}
      {via && <span className="cp-tag cp-tag--via">{via}</span>}
      {item.timing && <span className="cp-tag">{item.timing}</span>}
      {item.concentration && <span className="cp-tag cp-tag--conc">Conc.</span>}
    </li>
  )
}

/** The prepared spells, by level, with the ones that cannot be cast right now dimmed. Nothing moves when a slot is spent. */
export function CastPanel({ cast }: Pick<CompanionView, 'cast'>): React.JSX.Element {
  const all = cast.flatMap((group) => group.items)
  const ready = all.filter((item) => item.ready).length
  return (
    <section className="panel cp-cast" data-dense={all.length > DENSE_AFTER || undefined} aria-label="Spells">
      <div className="cp-head-row">
        <h2 className="cp-title">Ready to cast</h2>
        <span className="cp-count">
          {ready} of {all.length}
        </span>
      </div>
      <div className="cp-cast__groups">
        {cast.map((group) => (
          <div key={group.level} className="cp-group">
            <h3 className="cp-group__title">{group.level === 0 ? 'Cantrips' : `Level ${roman(group.level)}`}</h3>
            <ul className="cp-chips">
              {group.items.map((item) => (
                <Chip key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
