/** Controls inside a card that do their own job; a click on one must not also open the detail drawer. */
const OWN_ACTION = 'button:not(.name-button), input, select, textarea, a, label, summary, [role="button"], [role="switch"], [contenteditable]'

/**
 * True when a press landed on the body of a spell or feature card (not on its Cast, Prepare or amount controls).
 * The card opens the drawer on the click, and the drawer passes this as `useDismiss`'s `ignore` so the press that
 * precedes that click does not close the drawer just before the card switches it. A new control inside a card that is
 * not one of the elements above must be added to the list, or using it will also open the drawer.
 */
export function opensDetail(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('.spell-card') !== null && target.closest(OWN_ACTION) === null
}
