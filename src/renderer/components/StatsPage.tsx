import { memo } from 'react'
import type { SkillProficiency } from '@shared/types'
import { signed } from '@/domain/derived'
import { buildStats, PASSIVE_BASE } from '@/domain/stats'
import { catalog } from '@/state/session'

const PROFICIENCY_WORD: Record<SkillProficiency | 'none', string> = { none: 'not proficient', proficient: 'proficient', expertise: 'expertise' }

/** The lozenge that says whether the character is trained: hollow (no), filled (proficient) or ringed (expertise). */
function Mark({ level }: { level: SkillProficiency | 'none' }): React.JSX.Element {
  return <span className="stat-mark" data-level={level} role="img" aria-label={PROFICIENCY_WORD[level]} title={PROFICIENCY_WORD[level]} />
}

// The catalog never changes in a session, so the numbers are worked out once.
const stats = buildStats(catalog.character)

/**
 * The "Stats" view: each ability's modifier and saving throw, the passive scores and the skills. Read only, and nothing here is
 * saved: the numbers are derived from the sheet (`domain/stats.ts`) and are the base ones, with no aura or spell bonus.
 */
export const StatsPage = memo(function StatsPage(): React.JSX.Element {
  const { character } = catalog
  const bonus = signed(character.proficiencyBonus)

  return (
    <div className="spell-grid stats">
      <p className="attack-strip muted">
        Base numbers from the sheet: add an aura, Bless or any other bonus yourself. A lit diamond means proficiency ({bonus}); a ringed one,
        expertise ({signed(character.proficiencyBonus * 2)}).
      </p>

      <section className="spell-level" aria-label="Ability scores and saving throws">
        <h2 className="spell-level__title">Abilities &amp; saving throws</h2>
        <div className="spell-level__cards stat-cards">
          {stats.abilities.map((ability) => (
            <article key={ability.id} className="stat-card" data-proficient={ability.save.proficient || undefined}>
              <h3 className="stat-card__name">{ability.name}</h3>
              <p className="stat-card__modifier" title={`Score ${ability.score}`}>
                <span className="stat-card__value">{signed(ability.modifier)}</span>
                <span className="stat-card__score">{ability.score}</span>
              </p>
              <p
                className="stat-card__save"
                title={ability.save.proficient ? `${signed(ability.modifier)} modifier, ${bonus} proficiency` : `${signed(ability.modifier)} modifier, not proficient`}
              >
                <Mark level={ability.save.proficient ? 'proficient' : 'none'} />
                <span className="stat-card__save-label">Saving throw</span>
                <span className="stat-card__save-value">{signed(ability.save.modifier)}</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="spell-level" aria-label="Passive scores">
        <h2 className="spell-level__title">Passive scores</h2>
        <div className="spell-level__cards stat-cards stat-cards--passive">
          {stats.passives.map((passive) => (
            <article key={passive.id} className="stat-card stat-card--passive">
              <h3 className="stat-card__name">Passive {passive.name}</h3>
              <p className="stat-card__modifier" title={`${PASSIVE_BASE} ${signed(passive.modifier)}`}>
                <span className="stat-card__value">{passive.value}</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="spell-level" aria-label="Skills">
        <h2 className="spell-level__title">Skills</h2>
        <ul className="skill-list">
          {stats.skills.map((skill) => (
            <li key={skill.id} className="skill-row" data-level={skill.proficiency ?? 'none'}>
              <Mark level={skill.proficiency ?? 'none'} />
              <span className="skill-row__name">{skill.name}</span>
              <span className="skill-row__ability">{skill.ability.toUpperCase()}</span>
              <span className="skill-row__value">{signed(skill.modifier)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
})
