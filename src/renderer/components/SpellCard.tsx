import { memo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Payment, Spell } from '@shared/types'
import { defaultPayment } from '@/domain/cost'
import { roman } from '@/domain/derived'
import { ROLE_LABEL } from '@/domain/labels'
import { isChoosable, isInDefaultView } from '@/domain/prepared'
import { spellFoundBeyondCard, searchTokens } from '@/domain/search'
import { NO_WARNINGS, turnWarnings, warningText } from '@/domain/turn'
import { catalog, usePlayStore } from '@/state/session'
import { selectEffectFor, useEffectsStore } from '@/state/effectsStore'
import { useUiStore } from '@/state/uiStore'
import { CastButton, CastRoundel, ComponentMarks } from './CardParts'
import { FxHost, type FxHandle } from './CastEffect'
import { RangeBadge } from './RangeBadge'

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
  // A string, so a card re-renders only when its own effect changes, not when any other spell's does.
  const effect = useEffectsStore(selectEffectFor(spell.id))
  const fx = useRef<FxHandle>(null)
  const togglePrepared = usePlayStore((s) => s.togglePrepared)
  const openDetail = useUiStore((s) => s.openDetail)
  // A search can match text the card doesn't show (the full description); say so, or the card looks like a false hit.
  const foundInText = useUiStore((s) => spellFoundBeyondCard(spell, searchTokens(s.filters.query)))
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
    <FxHost ref={fx} role={spell.role} className="fx-host--card">
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
            <span>{spell.school}</span>
            {spell.concentration && <span className="spell-card__conc">concentration</span>}
            {spell.castingNote && <span>{spell.castingNote} to cast</span>}
            {spell.ritual && <span>ritual</span>}
            {isChoosable(spell) && (
              <button type="button" className="prep-toggle" aria-pressed={chosen} onClick={() => togglePrepared(spell.id)}>
                {chosen ? 'Prepared' : 'Prepare'}
              </button>
            )}
          </p>
          <p className="spell-card__facts">
            <RangeBadge range={spell.range} />
            <ComponentMarks components={spell.components} />
            <span className="spell-card__duration">{spell.tag ? `${spell.duration} · ${spell.tag}` : spell.duration}</span>
          </p>
          <p className="spell-card__summary">{spell.summary}</p>
          {foundInText && (
            <p className="spell-card__found" title="Your search matched this spell's full text, which the card doesn't show">
              Found in the full text
            </p>
          )}
        </div>
        <CastButton
          verb="Cast"
          detail={label}
          disabled={!castable}
          warn={castable && warnings.length > 0}
          title={castable ? warningText(warnings) || undefined : dimmed ? 'Prepare this spell to cast it' : 'Nothing left to pay for this spell'}
          onActivate={() => {
            cast(spell.id)
            fx.current?.play(effect)
          }}
        />
      </article>
    </FxHost>
  )
})
