import { useEffect, useMemo, useRef } from 'react'
import { attacksPerAttackAction } from '@/domain/attacks'
import { buildTurnChart, type ChartLeaf, type ChartNode } from '@/domain/turnChart'
import { NO_TURN_OPTIONS, turnOptions } from '@/domain/turnOptions'
import { selectConcentration } from '@/state/selectors'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { TURN_CHART_BUTTON_ID, TURN_CHART_ID } from './ids'

function Leaf({ leaf }: { leaf: ChartLeaf }): React.JSX.Element {
  const openDetail = useUiStore((s) => s.openDetail)
  const id = leaf.id
  return (
    <li className="chart-leaf" data-ready={leaf.ready === false ? 'false' : undefined}>
      {id ? (
        <button type="button" className="name-button" title={leaf.ready === false ? 'Cannot be used right now' : 'Show details'} onClick={() => openDetail(id)}>
          {leaf.text}
        </button>
      ) : (
        leaf.text
      )}
    </li>
  )
}

function Node({ node }: { node: ChartNode }): React.JSX.Element {
  const setStageTab = useUiStore((s) => s.setStageTab)
  const { status, link } = node
  return (
    // Only a step the player marks is struck through when used; a status line (the slot) just changes its word and color.
    <li className="chart-node" data-used={(node.step && status?.used) || undefined}>
      <div className="chart-node__head">
        <span className="chart-node__label">{node.label}</span>
        {status && (
          <span className="chart-node__status" data-used={status.used || undefined}>
            {status.text}
          </span>
        )}
      </div>
      {node.hint && <p className="chart-node__hint">{node.hint}</p>}
      {link && (
        <button type="button" className="btn chart-node__link" onClick={() => setStageTab(link.to)}>
          {link.label}
        </button>
      )}
      {node.leaves.length > 0 && (
        <ul className="chart-leaves">
          {node.leaves.map((leaf) => (
            <Leaf key={leaf.id ?? leaf.text} leaf={leaf} />
          ))}
        </ul>
      )}
      {node.children.length > 0 && (
        <ul className="chart-children">
          {node.children.map((child) => (
            <Node key={child.key} node={child} />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * The turn as a chart, docked beside the stage and left open while you play. It only reads: the four steps are marked on the
 * TurnPanel (always on screen beside it), and casting marks them too. Its bonus action and reaction lists come from the
 * character's own spells and features. A detail opened from a leaf covers the chart (same edge, same width) until it is closed.
 */
export function TurnChart({ hidden }: { hidden: boolean }): React.JSX.Element {
  const turn = usePlayStore((s) => s.play?.turn)
  const prepared = usePlayStore((s) => s.play?.prepared)
  const slotsUsed = usePlayStore((s) => s.play?.slotsUsed)
  const counters = usePlayStore((s) => s.play?.counters)
  const concentration = usePlayStore(selectConcentration)
  const detailOpen = useUiStore((s) => s.detailId !== null)
  const closeChart = useUiStore((s) => s.closeChart)
  const heading = useRef<HTMLHeadingElement>(null)

  // The options depend on these three slices of the save, not on hit points or the turn, so they are not rebuilt for those.
  const options = useMemo(
    () => (prepared && slotsUsed && counters ? turnOptions(catalog, { prepared, slotsUsed, counters }) : NO_TURN_OPTIONS),
    [prepared, slotsUsed, counters]
  )
  const chart = useMemo(
    () =>
      turn
        ? buildTurnChart({
            attacksPerAction: attacksPerAttackAction(catalog.character.level),
            turn,
            concentrationName: concentration ? catalog.nameOf(concentration) : null,
            options
          })
        : [],
    [turn, concentration, options]
  )

  // Opening moves focus in, so Esc works at once; closing hands it back to the button that opens the chart.
  useEffect(() => {
    heading.current?.focus()
    return () => {
      const active = document.activeElement
      if (!active || active === document.body) document.getElementById(TURN_CHART_BUTTON_ID)?.focus()
    }
  }, [])

  // When the detail that covered the chart goes and focus has nowhere to be (Esc closed it), the chart takes it back, so the next
  // Escape closes the chart. Focus that landed on a control is left alone.
  const detailWasOpen = useRef(false)
  useEffect(() => {
    const focusLost = !document.activeElement || document.activeElement === document.body
    if (detailWasOpen.current && !detailOpen && focusLost) heading.current?.focus()
    detailWasOpen.current = detailOpen
  }, [detailOpen])

  return (
    <aside
      id={TURN_CHART_ID}
      className="turn-chart"
      aria-label="Turn chart"
      tabIndex={-1}
      // Kept mounted but hidden on the settings page, so coming back neither remounts the chart nor takes focus.
      hidden={hidden}
      // While a detail covers the chart its controls must not take focus or be read out.
      inert={detailOpen}
      // Escape closes the chart when focus is inside it. With a detail open the chart is inert, so focus cannot be here and the detail's
      // own Escape closes it first; the chart then takes focus back (see the effect above), so the next Escape closes the chart.
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeChart()
      }}
    >
      <header className="turn-chart__head">
        <h2 ref={heading} tabIndex={-1} className="turn-chart__title">
          Turn chart
        </h2>
        <button type="button" className="btn btn--quiet" onClick={closeChart} aria-label="Close turn chart">
          Close
        </button>
      </header>
      <ul className="chart-root">
        {chart.map((node) => (
          <Node key={node.key} node={node} />
        ))}
      </ul>
    </aside>
  )
}
