import { useEffect, useMemo } from 'react'
import emblem from '@/assets/emblem.svg'
import { buildCompanionView, type CompanionView } from '@/domain/companion'
import { followViewPrefs } from '@/state/companionStore'
import { catalog, connectCompanion, useCompanion } from '@/state/session'
import { useTimerPrefs } from '@/state/timerPrefsStore'
import { Backdrop } from '../Backdrop'
import { DieFace } from '../Die'
import { CastPanel } from './CompanionCasts'
import { ConditionsPanel, FocusPanel, HealthPanel } from './CompanionHealth'
import { ResourcesStrip } from './CompanionResources'
import { SlotsPanel } from './CompanionSlots'
import { TurnStrip } from './CompanionTurn'

function Stat({ value, label }: { value: string | number; label: string }): React.JSX.Element {
  return (
    <div className="cp-stat">
      <span className="cp-stat__value">{value}</span>
      <span className="cp-stat__label">{label}</span>
    </div>
  )
}

function Header({ view }: { view: CompanionView }): React.JSX.Element {
  const { inspiration, initiative } = view
  return (
    <header className="cp-header">
      <img className="cp-header__emblem" src={emblem} alt="" draggable={false} />
      <div className="cp-header__id">
        <h1 className="cp-header__name">{view.name}</h1>
        <p className="cp-header__title">{view.title}</p>
      </div>
      <div className="cp-stats">
        {inspiration.held && (
          <div className="cp-stat cp-stat--inspired">
            <DieFace size={inspiration.die} held className="cp-die" />
            <span className="cp-stat__label">Inspired</span>
          </div>
        )}
        {initiative !== null && <Stat value={initiative} label="Initiative" />}
        <Stat value={view.ac} label="Armor" />
      </div>
    </header>
  )
}

/** One line for what just happened, so someone who looked away can catch up. A new line fades in; the same line does not replay. */
function LatestLine({ latest }: Pick<CompanionView, 'latest'>): React.JSX.Element {
  return (
    <footer className="cp-latest" aria-live="polite">
      <span className="cp-label">Latest</span>
      {latest ? (
        <p key={`${latest.t}:${latest.text}`} className="cp-latest__text">
          {latest.text}
        </p>
      ) : (
        <p className="cp-latest__text cp-latest__text--none">Nothing yet</p>
      )}
    </footer>
  )
}

function Waiting({ unreadable }: { unreadable: boolean }): React.JSX.Element {
  return (
    <div className="cp cp--waiting" aria-busy={!unreadable}>
      <Backdrop />
      <img className="cp-waiting__emblem" src={emblem} alt="" draggable={false} />
      <p className="cp-waiting__text">{unreadable ? 'The saved sheet could not be read' : 'Waiting for the sheet'}</p>
    </div>
  )
}

/**
 * The second-screen view: a read-only summary of the sheet for the whole table, readable from across the room. It is a mirror of the
 * sheet window and nothing here changes anything. All the working-out is `buildCompanionView`; this only draws it.
 */
export function Companion(): React.JSX.Element {
  const status = useCompanion((s) => s.status)
  const play = useCompanion((s) => s.play)
  const turnSeconds = useTimerPrefs((s) => s.turnSeconds)

  useEffect(() => connectCompanion(), [])
  useEffect(() => followViewPrefs(), [])

  const view = useMemo(() => (play ? buildCompanionView(play, catalog, turnSeconds) : null), [play, turnSeconds])
  if (!view) return <Waiting unreadable={status === 'unreadable'} />

  return (
    <div className="cp" data-health={view.health.state}>
      <Backdrop />
      <Header view={view} />
      <main className="cp-main">
        <div className="cp-col cp-col--vitals">
          <HealthPanel health={view.health} />
          <FocusPanel concentration={view.concentration} effects={view.effects} />
          <ConditionsPanel conditions={view.conditions} />
          <TurnStrip turn={view.turn} />
        </div>
        <div className="cp-col cp-col--magic">
          <SlotsPanel slots={view.slots} slotsLeft={view.slotsLeft} slotsTotal={view.slotsTotal} />
          <CastPanel cast={view.cast} />
        </div>
      </main>
      <ResourcesStrip resources={view.resources} />
      <LatestLine latest={view.latest} />
    </div>
  )
}
