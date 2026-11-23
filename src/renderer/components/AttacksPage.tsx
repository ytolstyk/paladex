import { useMemo } from 'react'
import { attackRiders, attacksPerAttackAction, NO_RIDERS, unarmedStrike } from '@/domain/attacks'
import { signed } from '@/domain/derived'
import { plural } from '@/domain/describe'
import { catalog, usePlayStore } from '@/state/session'
import { FeatureCard } from './FeatureCard'
import { SpellCard } from './SpellCard'
import { WeaponCard } from './WeaponCard'

/**
 * The "Weapons & attacks" view: what you can swing, what to add to a swing, and how many swings the Attack action gives.
 * Everything here ignores the spell grid's filters on purpose (a remembered chip must not hide a rider).
 */
export function AttacksPage(): React.JSX.Element {
  // Only the prepared list changes what this page shows, so an HP tick or a spent slot does not rebuild it.
  const prepared = usePlayStore((s) => s.play?.prepared)
  const { character, weapons } = catalog
  const attacks = attacksPerAttackAction(character.level)
  const unarmed = unarmedStrike(character)
  const riders = useMemo(() => (prepared ? attackRiders(catalog, { prepared }) : NO_RIDERS), [prepared])
  const anyRiders = riders.spells.length > 0 || riders.features.length > 0

  return (
    <div className="spell-grid attacks">
      <section className="attack-strip" aria-label="Attack action">
        <p>
          <strong>Attack action:</strong> {plural(attacks, 'attack', 'attacks')}
          {attacks > 1 && ' (Extra Attack)'}.
        </p>
        <p>
          <strong>Unarmed Strike:</strong> {signed(unarmed.toHit)} to hit, {unarmed.flatDamage} {unarmed.damageType}. Grapple or Shove: DC{' '}
          {unarmed.grappleShoveDc}.
        </p>
        <p className="muted">Base numbers: add Magic Weapon, Bless and any other bonus yourself. Hover a number for what it is made of.</p>
      </section>

      <section className="spell-level" aria-label="Weapons">
        <h2 className="spell-level__title">Weapons</h2>
        {weapons.length === 0 ? (
          <p className="muted">No weapons on the sheet.</p>
        ) : (
          <div className="spell-level__cards weapon-cards">
            {weapons.map((weapon) => (
              <WeaponCard key={weapon.id} weapon={weapon} />
            ))}
          </div>
        )}
      </section>

      {(anyRiders || riders.unpreparedSpells > 0) && (
        <section className="spell-level" aria-label="Attack options">
          <h2 className="spell-level__title">Attack options</h2>
          {anyRiders && (
            <div className="spell-level__cards">
              {riders.spells.map((spell) => (
                <SpellCard key={spell.id} spell={spell} />
              ))}
              {riders.features.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          )}
          {riders.unpreparedSpells > 0 && (
            <p className="muted">
              {plural(riders.unpreparedSpells, 'more attack spell', 'more attack spells')} among the ones you haven&apos;t prepared.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
