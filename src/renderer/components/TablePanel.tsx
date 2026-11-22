import { InitiativeDial } from './InitiativeDial'
import { InspirationDie } from './InspirationDie'

/**
 * The two things a player carries from the table into their own turn: where they stand in the initiative order, and
 * whether a Bard has given them a die to spend. Both are big, near the top, and saved with the character.
 */
export function TablePanel(): React.JSX.Element {
  return (
    <section className="panel table-panel" aria-label="At the table">
      <InitiativeDial />
      <InspirationDie />
    </section>
  )
}
