import { memo } from 'react'
import type { Weapon } from '@shared/types'
import { weaponAttack, weaponRangeText } from '@/domain/attacks'
import { signed } from '@/domain/derived'
import { describeMastery } from '@/domain/describe'
import { ATTUNEMENT_LABEL } from '@/domain/labels'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { opensDetail } from './detailTrigger'

/**
 * A carried weapon: to hit and damage, reach or range, its properties and its mastery. Informational (an attack spends nothing),
 * so it has no button. It keeps the spell card's class so the detail drawer treats a press on it like a press on a spell.
 */
export const WeaponCard = memo(function WeaponCard({ weapon }: { weapon: Weapon }): React.JSX.Element {
  const openDetail = useUiStore((s) => s.openDetail)
  const attack = weaponAttack(weapon, catalog.character)
  const mastery = weapon.mastery && describeMastery(weapon.mastery)

  return (
    <article className="spell-card weapon-card" data-role="offense" onClick={(e) => opensDetail(e.target) && openDetail(weapon.id)}>
      <div className="card-stat" title={attack.breakdown}>
        <span className="card-stat__label">To hit</span>
        <span className="card-stat__value">{signed(attack.toHit)}</span>
      </div>
      <div className="spell-card__body">
        <h3 className="spell-card__name">
          <button type="button" className="name-button" title="Show details">
            {weapon.name}
          </button>
        </h3>
        <p className="spell-card__meta">
          <span className="spell-card__role">{weapon.melee ? 'Melee' : 'Ranged'}</span>
          {weaponRangeText(weapon).map((text) => (
            <span key={text}>{text}</span>
          ))}
          {weapon.magic && <span className="weapon-card__magic">magic</span>}
          {weapon.attunement && <span>{ATTUNEMENT_LABEL[weapon.attunement]}</span>}
        </p>
        <p className="weapon-card__tags">
          {attack.disadvantage && (
            <span className="weapon-prop" data-tone="warn">
              {attack.disadvantage}
            </span>
          )}
          {weapon.properties.map((p) => (
            <span key={p.name} className="weapon-prop" title={p.text}>
              {p.name}
            </span>
          ))}
          {mastery && (
            <span className="weapon-prop" data-tone={mastery.tone} title={mastery.tooltip}>
              {mastery.label}
            </span>
          )}
        </p>
      </div>
      <div className="card-stat" title={`${attack.modifierText} added to the damage`}>
        <span className="card-stat__label">Damage</span>
        <span className="card-stat__value">{attack.damage}</span>
        <span className="card-stat__sub">{attack.damageType}</span>
        {attack.versatileDamage && <span className="card-stat__sub">{attack.versatileDamage} two-handed</span>}
      </div>
    </article>
  )
})
