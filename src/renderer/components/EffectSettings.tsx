import { memo, useRef, useState } from 'react'
import type { Spell } from '@shared/types'
import {
  EFFECT_CHOICES,
  effectName,
  isEffectChoice,
  resolveEffect,
  type EffectChoice,
  type EffectSetting,
  type EffectSource
} from '@/domain/effects'
import { LEVEL_CHIP } from '@/domain/labels'
import { byLevelThenName } from '@/domain/order'
import { catalog } from '@/state/session'
import { useEffectsStore } from '@/state/effectsStore'
import { FxHost, type FxHandle } from './CastEffect'

/** Cantrips first, then by level, then alphabetical. */
const SPELLS_IN_ORDER: readonly Spell[] = [...catalog.spells].sort(byLevelThenName)

const levelText = (level: number): string => LEVEL_CHIP[level] ?? `Level ${level}`

const SOURCE_NOTE: Record<EffectSource, string> = {
  override: 'Your choice',
  matched: 'Matched to the spell',
  default: 'Uses your default'
}

/** One choice for the default effect, with a button that plays it behind the tile. */
const DefaultOption = memo(function DefaultOption({
  choice,
  checked,
  onChoose
}: {
  choice: (typeof EFFECT_CHOICES)[number]
  checked: boolean
  onChoose(id: EffectChoice): void
}): React.JSX.Element {
  const fx = useRef<FxHandle>(null)
  return (
    <FxHost ref={fx} className="fx-option">
      <div className="fx-option__card" data-checked={checked || undefined}>
        <label className="fx-option__label">
          <input
            type="radio"
            name="default-effect"
            className="sr-only"
            value={choice.id}
            checked={checked}
            onChange={() => {
              onChoose(choice.id)
              fx.current?.play(choice.id) // choosing it shows it
            }}
          />
          <span className="fx-option__name">{choice.name}</span>
          <span className="fx-option__blurb muted">{choice.blurb}</span>
        </label>
        <button
          type="button"
          className="btn btn--quiet"
          disabled={choice.id === 'none'}
          onClick={() => fx.current?.play(choice.id)}
          aria-label={`Preview ${choice.name}`}
        >
          Preview
        </button>
      </div>
    </FxHost>
  )
})

/** One spell and the effect it plays, with a way to change it and a preview behind the row. Props are primitives so `memo` holds. */
const SpellRow = memo(function SpellRow({
  spell,
  effect,
  source,
  automatic,
  onChange
}: {
  spell: Spell
  effect: EffectChoice
  source: EffectSource
  /** What "Automatic" gives for this spell, so the option says what it means before it is picked. */
  automatic: EffectChoice
  onChange(spellId: string, choice: EffectSetting): void
}): React.JSX.Element {
  const fx = useRef<FxHandle>(null)
  const selectId = `fx-${spell.id}`
  return (
    <FxHost ref={fx} as="li" role={spell.role} className="fx-row">
      <div className="fx-row__card" data-role={spell.role}>
        <div className="fx-row__who">
          <span className="fx-row__name">{spell.name}</span>
          <span className="muted fx-row__meta">
            {levelText(spell.level)} · {SOURCE_NOTE[source]}
          </span>
        </div>
        <label htmlFor={selectId} className="sr-only">
          Effect for {spell.name}
        </label>
        <select
          id={selectId}
          className="field"
          value={source === 'override' ? effect : 'auto'}
          onChange={(e) => {
            const value = e.target.value
            if (value === 'auto' || isEffectChoice(value)) onChange(spell.id, value)
          }}
        >
          <option value="auto">Automatic ({effectName(automatic)})</option>
          {EFFECT_CHOICES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--quiet"
          disabled={effect === 'none'}
          onClick={() => fx.current?.play(effect)}
          aria-label={`Preview the effect for ${spell.name}`}
        >
          Preview
        </button>
      </div>
    </FxHost>
  )
})

/** Settings for the show that plays behind a card when a spell is cast: a default, and per-spell overrides. */
export function EffectSettings(): React.JSX.Element {
  const prefs = useEffectsStore((s) => s.prefs)
  const setFallback = useEffectsStore((s) => s.setFallback)
  const setOverride = useEffectsStore((s) => s.setOverride)
  const clearOverrides = useEffectsStore((s) => s.clearOverrides)
  // The rows are built only once the list has been opened: most visits to Settings never need them.
  const [listOpen, setListOpen] = useState(false)
  const customized = SPELLS_IN_ORDER.filter((s) => Object.hasOwn(prefs.overrides, s.id)).length

  return (
    <section className="fx-settings" aria-labelledby="fx-settings-title">
      <h3 id="fx-settings-title" className="settings__heading">
        Spell effects
      </h3>
      <p className="muted">
        Casting a spell plays a short show from behind its card. Most spells get one that suits them (healing lifts motes of light, a
        fire smite throws embers). Spells with no clear match use the default you pick here, and you can set any spell yourself below.
      </p>
      <fieldset className="fx-default">
        <legend className="fx-subheading">Default effect</legend>
        <div className="fx-default__grid">
          {EFFECT_CHOICES.map((c) => (
            <DefaultOption key={c.id} choice={c} checked={prefs.fallback === c.id} onChoose={setFallback} />
          ))}
        </div>
      </fieldset>
      <details className="fx-overrides" onToggle={(e) => setListOpen(e.currentTarget.open)}>
        <summary>
          Effects for individual spells
          {customized > 0 && <span className="muted"> ({customized} customized)</span>}
        </summary>
        {listOpen && (
          <>
            <div className="fx-overrides__bar">
              <button type="button" className="btn btn--quiet" disabled={customized === 0} onClick={clearOverrides}>
                Reset all to automatic
              </button>
            </div>
            <ul className="fx-rows">
              {SPELLS_IN_ORDER.map((spell) => {
                const resolved = resolveEffect(spell.id, prefs)
                return (
                  <SpellRow
                    key={spell.id}
                    spell={spell}
                    effect={resolved.effect}
                    source={resolved.source}
                    automatic={resolved.automatic}
                    onChange={setOverride}
                  />
                )
              })}
            </ul>
          </>
        )}
      </details>
    </section>
  )
}
