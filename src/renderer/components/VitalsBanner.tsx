import emblem from '@/assets/emblem.svg'
import { signed, spellAttackBonus, spellSaveDc } from '@/domain/derived'
import { catalog, usePlayStore } from '@/state/session'
import { HpControl } from './HpControl'

export function VitalsBanner(): React.JSX.Element {
  const vitals = usePlayStore((s) => s.play?.vitals)
  const isDev = usePlayStore((s) => s.isDev)
  const { character } = catalog
  if (!vitals) return <header className="banner" />

  return (
    <header className="banner">
      <img className="banner__emblem" src={emblem} alt="Paladex" draggable={false} />
      <div className="banner__id">
        <h1 className="banner__name">
          {character.name}
          {isDev && <span className="banner__dev">dev profile</span>}
        </h1>
        <p className="banner__sub">
          {character.race} {character.className} {character.level}, {character.subclass}
        </p>
      </div>

      <HpControl />

      <div className="vital">
        <span className="vital__value">{vitals.ac}</span>
        <span className="vital__label">Armor</span>
      </div>
      <div className="vital">
        <span className="vital__value">{spellSaveDc(character)}</span>
        <span className="vital__label">Spell save</span>
      </div>
      <div className="vital">
        <span className="vital__value">{signed(spellAttackBonus(character))}</span>
        <span className="vital__label">Spell attack</span>
      </div>
      <div className="vital">
        <span className="vital__value">{signed(character.proficiencyBonus)}</span>
        <span className="vital__label">Proficiency</span>
      </div>
    </header>
  )
}
