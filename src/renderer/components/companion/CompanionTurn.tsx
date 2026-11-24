import type { CompanionView } from '@/domain/companion'

/** What has been used this turn: action, move, bonus action, reaction, and the turn's one spell slot. The wording is the view-model's. */
export function TurnStrip({ turn }: Pick<CompanionView, 'turn'>): React.JSX.Element {
  return (
    <section className="panel cp-turn" aria-label="This turn">
      <h2 className="cp-sr">This turn</h2>
      <ul className="cp-tiles">
        {turn.map((tile) => (
          <li key={tile.key} className="cp-tile" data-used={tile.used || undefined}>
            <span className="cp-tile__name">{tile.name}</span>
            <span className="cp-tile__state">{tile.state}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
