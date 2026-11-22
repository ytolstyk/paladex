import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Payment, Spell } from '@shared/types'
import { defaultPayment } from '@/domain/cost'
import { roman } from '@/domain/derived'
import { ROLE_LABEL } from '@/domain/labels'
import { isChoosable, isInDefaultView } from '@/domain/prepared'
import { NO_WARNINGS, turnWarnings, warningText } from '@/domain/turn'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { CastButton, CastRoundel } from './CardParts'

function paymentLabel(payment: Payment): string | null {
  switch (payment.kind) {
    case 'slot':
      return `level ${roman(payment.level)}`
    case 'free':
      return 'free cast'
    case 'charge':
      return 'item charge'
    case 'none':
      return null
  }
}

export const SpellCard = memo(function SpellCard({ spell }: { spell: Spell }): React.JSX.Element {
  // Select only this card's own result so a slot change re-renders just the cards it affects.
  const payment = usePlayStore(useShallow((s) => (s.play ? defaultPayment(s.play, spell, catalog) : null)))
  const active = usePlayStore((s) => s.play?.concentration === spell.id)
  const chosen = usePlayStore((s) => s.play?.prepared.includes(spell.id) ?? false)
  const cast = usePlayStore((s) => s.cast)
  const togglePrepared = usePlayStore((s) => s.togglePrepared)
  const openDetail = useUiStore((s) => s.openDetail)
  // Turn-economy hints come from the same rules the actions use, and only change for cards they affect.
  const warnings = usePlayStore(
    useShallow((s) =>
      s.play && payment
        ? turnWarnings(s.play.turn, { castTime: spell.castTime, spendsSlot: payment.kind === 'slot' })
        : NO_WARNINGS
    )
  )
  const castable = payment !== null
  // Spells payable with an item charge work without being prepared; everything else needs preparing first.
  const dimmed = !usePlayStore((s) => (s.play ? isInDefaultView(s.play, spell) : true))
  const label = payment ? paymentLabel(payment) : dimmed ? 'not prepared' : 'no slot'

  return (
    <article className="spell-card" data-role={spell.role} data-active={active || undefined} data-dimmed={dimmed || undefined}>
      <CastRoundel castTime={spell.castTime} />
      <div className="spell-card__body">
        <h3 className="spell-card__name">
          <button type="button" className="name-button" onClick={() => openDetail(spell.id)} title="Show details">
            {spell.name}
          </button>
        </h3>
        <p className="spell-card__meta">
          <span className="spell-card__role">{ROLE_LABEL[spell.role]}</span>
          {spell.concentration && <span className="spell-card__conc">concentration</span>}
          {spell.castingNote && <span>{spell.castingNote} to cast</span>}
          {spell.ritual && <span>ritual</span>}
          <span>{spell.range}</span>
          <span>{spell.duration}</span>
          {spell.tag && <span>{spell.tag}</span>}
          {isChoosable(spell) && (
            <button type="button" className="prep-toggle" aria-pressed={chosen} onClick={() => togglePrepared(spell.id)}>
              {chosen ? 'Prepared' : 'Prepare'}
            </button>
          )}
        </p>
        <p className="spell-card__summary">{spell.summary}</p>
      </div>
      <CastButton
        verb="Cast"
        detail={label}
        disabled={!castable}
        warn={castable && warnings.length > 0}
        title={castable ? warningText(warnings) || undefined : dimmed ? 'Prepare this spell to cast it' : 'Nothing left to pay for this spell'}
        onActivate={() => cast(spell.id)}
      />
    </article>
  )
})
