import { memo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Feature } from '@shared/types'
import { featureSpendCap, usesLeft } from '@/domain/cost'
import { ROLE_LABEL } from '@/domain/labels'
import { NO_WARNINGS, turnWarnings, warningText } from '@/domain/turn'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { CastRoundel } from './CardParts'

/** A class or species feature, spent from its counter. Pool features (Lay On Hands) ask how much. */
export const FeatureCard = memo(function FeatureCard({ feature }: { feature: Feature }): React.JSX.Element {
  const counter = catalog.counterById(feature.counterId) // the catalog guarantees it exists (checked at startup)
  const left = usePlayStore((s) => (counter && s.play ? usesLeft(counter, s.play.counters) : 0))
  const cap = usePlayStore((s) => (counter && s.play ? featureSpendCap(feature, counter, s.play.counters) : 0))
  const warnings = usePlayStore(
    useShallow((s) => (s.play ? turnWarnings(s.play.turn, { castTime: feature.castTime, spendsSlot: false }) : NO_WARNINGS))
  )
  const activateFeature = usePlayStore((s) => s.activateFeature)
  const openDetail = useUiStore((s) => s.openDetail)
  const [amount, setAmount] = useState('1')

  const isPool = feature.spend.kind === 'pool'
  const usable = cap > 0

  // An amount the domain would refuse (empty, below 1) is turned into the smallest valid one rather than silently mis-spent.
  const use = (): void => {
    const parsed = Number.parseInt(amount, 10)
    activateFeature(feature.id, isPool && Number.isFinite(parsed) ? parsed : 1)
  }

  return (
    <article className="spell-card feature-card" data-role={feature.role} data-dimmed={!usable || undefined}>
      <CastRoundel castTime={feature.castTime} />
      <div className="spell-card__body">
        <h3 className="spell-card__name">
          <button type="button" className="name-button" onClick={() => openDetail(feature.id)} title="Show details">
            {feature.name}
          </button>
        </h3>
        <p className="spell-card__meta">
          <span className="spell-card__role">{ROLE_LABEL[feature.role]}</span>
          {feature.timing && <span>{feature.timing}</span>}
          {feature.tag && <span>{feature.tag}</span>}
        </p>
        <p className="spell-card__summary">{feature.summary}</p>
      </div>
      <div className="feature-card__use">
        {isPool && usable && (
          <input
            className="field field--amount"
            type="number"
            min={1}
            max={cap}
            inputMode="numeric"
            aria-label={`Amount of ${counter?.label ?? 'points'} to spend (up to ${cap})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
        <button
          type="button"
          className="cast-button"
          disabled={!usable}
          data-warn={(usable && warnings.length > 0) || undefined}
          onClick={use}
          title={usable ? warningText(warnings) || undefined : 'Nothing left to spend'}
        >
          Use
          <span className="cast-button__level">{usable ? `${left}/${counter?.max ?? left} left` : 'none left'}</span>
        </button>
      </div>
    </article>
  )
})
