import { memo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Payment, Spell } from '@shared/types'
import { availableCosts, paymentOptions, samePaymentOptions, type PaymentOptions } from '@/domain/cost'
import { paymentLabel, ROLE_LABEL } from '@/domain/labels'
import { isChoosable, isInDefaultView } from '@/domain/prepared'
import { spellFoundBeyondCard, searchTokens } from '@/domain/search'
import { NO_WARNINGS, turnWarnings, warningText } from '@/domain/turn'
import { catalog, usePlayStore } from '@/state/session'
import { selectEffectFor, useEffectsStore } from '@/state/effectsStore'
import { useUiStore } from '@/state/uiStore'
import { CastButton, CastRoundel, ComponentMarks, PaymentStepper } from './CardParts'
import { FxHost, type FxHandle } from './CastEffect'
import { opensDetail } from './detailTrigger'
import { RangeBadge } from './RangeBadge'

export const SpellCard = memo(function SpellCard({ spell }: { spell: Spell }): React.JSX.Element {
  // The player's pick (an upcast level, or a slot instead of the free cast). View state of this card, dropped after each cast.
  // It is kept while the pick is unavailable (the card shows the fallback), so it returns if the slot comes back.
  const [picked, setPicked] = useState<Payment | null>(null)
  // One selector for what the button pays with and what the arrows offer, so the label and the cast cannot disagree.
  // Payments are fresh objects on every call, so the previous result is handed back while it is equal in value.
  const last = useRef<PaymentOptions | null>(null)
  const { current: payment, lower, higher } = usePlayStore((s): PaymentOptions => {
    const next = paymentOptions(s.play ? availableCosts(s.play, spell, catalog) : [], picked)
    if (last.current && samePaymentOptions(last.current, next)) return last.current
    last.current = next
    return next
  })
  const active = usePlayStore((s) => s.play?.concentration === spell.id)
  const chosen = usePlayStore((s) => s.play?.prepared.includes(spell.id) ?? false)
  const cast = usePlayStore((s) => s.cast)
  // A string, so a card re-renders only when its own effect changes, not when any other spell's does.
  const effect = useEffectsStore(selectEffectFor(spell.id))
  const fx = useRef<FxHandle>(null)
  const togglePrepared = usePlayStore((s) => s.togglePrepared)
  const favorite = usePlayStore((s) => s.play?.favorites.includes(spell.id) ?? false)
  const toggleFavorite = usePlayStore((s) => s.toggleFavorite)
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
  const label = payment ? (payment.kind === 'none' ? null : paymentLabel(payment)) : dimmed ? 'not prepared' : 'no slot'

  return (
    <FxHost ref={fx} role={spell.role} className="fx-host--card">
      <article
        className="spell-card"
        data-role={spell.role}
        data-active={active || undefined}
        data-dimmed={dimmed || undefined}
        onClick={(e) => opensDetail(e.target) && openDetail(spell.id)}
      >
        <CastRoundel castTime={spell.castTime} />
        <div className="spell-card__body">
          <h3 className="spell-card__name">
            {/* No handler of its own: its click (and Enter or Space) bubbles to the card. It stays a button for the keyboard. */}
            <button type="button" className="name-button" title="Show details">
              {spell.name}
            </button>
          </h3>
          <p className="spell-card__meta">
            <span className="spell-card__role">{ROLE_LABEL[spell.role]}</span>
            <span>{spell.school}</span>
            {spell.concentration && <span className="spell-card__conc">concentration</span>}
            {spell.castingNote && <span>{spell.castingNote} to cast</span>}
            {spell.ritual && <span>ritual</span>}
            <span className="spell-card__tools">
              {isChoosable(spell) && (
                <button type="button" className="prep-toggle" aria-pressed={chosen} onClick={() => togglePrepared(spell.id)}>
                  {chosen ? 'Prepared' : 'Prepare'}
                </button>
              )}
              <button
                type="button"
                className="fav-toggle"
                aria-pressed={favorite}
                aria-label={`Favorite ${spell.name}`}
                title={favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                onClick={() => toggleFavorite(spell.id)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" />
                </svg>
              </button>
            </span>
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
        <div className="cast-stack">
          <CastButton
            verb="Cast"
            detail={label}
            disabled={!castable}
            warn={castable && warnings.length > 0}
            title={castable ? warningText(warnings) || undefined : dimmed ? 'Prepare this spell to cast it' : 'Nothing left to pay for this spell'}
            onActivate={() => {
              setPicked(null)
              // A refused cast (the store moved on since this render) must not look like a cast.
              if (cast(spell.id, payment ?? undefined)) fx.current?.play(effect)
            }}
          />
          {(lower || higher) && <PaymentStepper lower={lower} higher={higher} onPick={setPicked} />}
        </div>
      </article>
    </FxHost>
  )
})
