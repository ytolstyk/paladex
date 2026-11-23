import { TURN_STEPS } from '@shared/constants'
import { SLOT_TURN_LABEL, TURN_STEP_LABEL } from '@/domain/labels'
import { TURN_STEP_FLAG } from '@/domain/turn'
import { selectConcentration } from '@/state/selectors'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { TURN_CHART_BUTTON_ID, TURN_CHART_ID } from './ids'
import { HourglassIcon, RuneRing } from './Ornaments'

/**
 * What you have used this turn, and the only place it is marked by hand. Rules (2024): one action, one bonus action, one
 * reaction, and one spell slot per turn. Nothing is hidden or blocked, because the table's ruling wins. Casting a spell or using a
 * feature marks its step by itself; the chart beside the stage reads the same state.
 */
export function TurnPanel(): React.JSX.Element {
  const concentration = usePlayStore(selectConcentration)
  const turn = usePlayStore((s) => s.play?.turn)
  const dropConcentration = usePlayStore((s) => s.dropConcentration)
  const newTurn = usePlayStore((s) => s.newTurn)
  const toggleTurnStep = usePlayStore((s) => s.toggleTurnStep)
  const chartOpen = useUiStore((s) => s.chartOpen)
  const toggleChart = useUiStore((s) => s.toggleChart)
  const slotSpent = turn?.slotSpellCast ?? false
  const casts = turn?.castsSinceNewTurn ?? 0

  return (
    <section className="panel turn-panel" aria-label="This turn">
      <h2 className="panel__title">
        <HourglassIcon />
        This turn
      </h2>
      <div className="turn-line" data-active={concentration ? true : undefined}>
        {concentration ? (
          <>
            <span className="turn-line__concentrating">
              <RuneRing />
              <span>
                Concentrating on <strong>{catalog.nameOf(concentration)}</strong>
              </span>
            </span>
            <button type="button" className="btn btn--action" onClick={dropConcentration}>
              Drop
            </button>
          </>
        ) : (
          <span className="muted">Not concentrating</span>
        )}
      </div>
      <div className="turn-line" data-active={slotSpent ? true : undefined}>
        {slotSpent ? (
          <span>
            {SLOT_TURN_LABEL.spent}
            <span className="muted turn-line__age">One slotted spell per turn. Cantrips and free casts are still fine.</span>
          </span>
        ) : (
          <span className="muted">{SLOT_TURN_LABEL.free}</span>
        )}
      </div>
      <div className="turn-steps" role="group" aria-label="Used this turn">
        {TURN_STEPS.map((step) => {
          const used = turn?.[TURN_STEP_FLAG[step]] ?? false
          const label = TURN_STEP_LABEL[step]
          return (
            <button
              key={step}
              type="button"
              className="turn-step"
              data-used={used || undefined}
              title={`${used ? label.on : label.off}. Press to mark it ${used ? 'ready' : 'used'}.`}
              onClick={() => toggleTurnStep(step)}
            >
              <span className="turn-step__name">{label.name}</span>
              <span className="turn-step__state">{label.short[used ? 'on' : 'off']}</span>
            </button>
          )
        })}
      </div>
      <div className="turn-line">
        <span className="muted">
          {casts} {casts === 1 ? 'cast' : 'casts'} since new turn
        </span>
        <button
          type="button"
          className="btn btn--action"
          onClick={newTurn}
          title="Start your turn (N): clears the turn and readies your reaction"
        >
          New turn
        </button>
      </div>
      <button
        id={TURN_CHART_BUTTON_ID}
        type="button"
        className="btn turn-chart-toggle"
        aria-expanded={chartOpen}
        aria-controls={TURN_CHART_ID}
        onClick={toggleChart}
        title="Show the turn as a chart (T)"
      >
        Turn chart
      </button>
    </section>
  )
}
