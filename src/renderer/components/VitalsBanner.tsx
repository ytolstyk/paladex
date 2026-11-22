import emblem from '@/assets/emblem.svg'
import { signed, spellAttackBonus, spellSaveDc } from '@/domain/derived'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { HpControl } from './HpControl'

export function VitalsBanner(): React.JSX.Element {
  const vitals = usePlayStore((s) => s.play?.vitals)
  const isDev = usePlayStore((s) => s.isDev)
  const view = useUiStore((s) => s.view)
  const toggleSettings = useUiStore((s) => s.toggleSettings)
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
      <button
        type="button"
        className="icon-button"
        onClick={toggleSettings}
        aria-label="Settings"
        aria-pressed={view === 'settings'}
        title="Settings (Cmd/Ctrl+,)"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.8l1.7 2.4 2.9-.6.9 2.8 2.8.9-.6 2.9 2.4 1.7-2.4 1.7.6 2.9-2.8.9-.9 2.8-2.9-.6L12 21.2l-1.7-2.4-2.9.6-.9-2.8-2.8-.9.6-2.9L2.8 12l2.4-1.7-.6-2.9 2.8-.9.9-2.8 2.9.6z" strokeLinejoin="round" />
        </svg>
      </button>
    </header>
  )
}
