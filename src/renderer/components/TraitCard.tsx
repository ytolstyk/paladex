import { memo } from 'react'
import type { Trait } from '@shared/types'
import { TRAIT_KIND_LABEL, TRAIT_WHEN_LABEL, TRAIT_WHEN_LETTER } from '@/domain/labels'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { Roundel } from './CardParts'
import { opensDetail } from './detailTrigger'

/**
 * A feat, Oath feature, species trait or piece of homebrew: reference only, nothing to spend. A press on the card opens its full
 * text in the drawer; each "see also" button opens the spell or tile it grants or works with. `foundInText` is decided by the caller (it
 * knows the search), so a keystroke re-renders only the cards whose badge changes.
 */
export const TraitCard = memo(function TraitCard({ trait, foundInText }: { trait: Trait; foundInText: boolean }): React.JSX.Element {
  const openDetail = useUiStore((s) => s.openDetail)
  const whenLabel = TRAIT_WHEN_LABEL[trait.when]
  const kindLabel = TRAIT_KIND_LABEL[trait.kind]

  return (
    <article className="spell-card trait-card" data-kind={trait.kind} onClick={(e) => opensDetail(e.target) && openDetail(trait.id)}>
      <Roundel time={trait.when} label={whenLabel} letter={TRAIT_WHEN_LETTER[trait.when]} />
      <div className="spell-card__body">
        <h3 className="spell-card__name">
          <button type="button" className="name-button" title="Show details">
            {trait.name}
          </button>
        </h3>
        <p className="spell-card__meta">
          <span className="trait-card__kind">{kindLabel}</span>
          {trait.origin !== kindLabel && <span>{trait.origin}</span>}
          <span>{whenLabel}</span>
        </p>
        <p className="spell-card__summary">{trait.summary}</p>
        {trait.related && (
          <p className="trait-card__links">
            <span className="trait-card__see">See also</span>
            {trait.related.map((id) => {
              const name = catalog.nameOf(id)
              return (
                <button key={id} type="button" className="trait-link" onClick={() => openDetail(id)} title={`Show details for ${name}`}>
                  {name}
                </button>
              )
            })}
          </p>
        )}
        {foundInText && (
          <p className="spell-card__found" title="Your search matched this one's full text, which the card doesn't show">
            Found in the full text
          </p>
        )}
      </div>
    </article>
  )
})
