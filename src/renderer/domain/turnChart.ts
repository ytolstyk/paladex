import type { TurnState, TurnStep } from '@shared/constants'
import { plural } from './describe'
import { SLOT_TURN_LABEL, TURN_STEP_LABEL } from './labels'
import { stillAvailable, TURN_STEP_FLAG } from './turn'
import type { TurnOption, TurnOptions } from './turnOptions'

/**
 * The turn as a chart of short prompts, for the side drawer. Pure: the component hands in the character's numbers and state,
 * and gets back a tree to draw. It holds no rules text beyond one line per step (the point is a glance, not the rulebook), and
 * the character's own bonus action and reaction leaves come from the catalog by casting time.
 */

/** The state of a step the player tracks: `used` is what turns the node from "ready" to "spent". */
export interface ChartStatus {
  text: string
  used: boolean
}

/** One line under a node. With an `id` it is a spell or feature and opens the detail drawer. */
export interface ChartLeaf {
  text: string
  id?: string
  /** False when it cannot be used right now (dimmed). */
  ready?: boolean
}

export interface ChartNode {
  key: string
  label: string
  hint?: string
  status?: ChartStatus
  /** Which step this node is (the TurnPanel chip toggles it). */
  step?: TurnStep
  leaves: ChartLeaf[]
  children: ChartNode[]
  /** A button on the node that switches to another view of the sheet. */
  link?: { label: string; to: 'attacks' }
}

export interface TurnChartInput {
  attacksPerAction: number
  turn: TurnState
  /** The spell being concentrated on, if any. */
  concentrationName: string | null
  options: TurnOptions
}

/** Every character can make an opportunity attack as a reaction, so it is listed whatever their own spells and features are. */
const OPPORTUNITY_ATTACK = 'Opportunity Attack'

function stepStatus(turn: TurnState, step: TurnStep): ChartStatus {
  const used = turn[TURN_STEP_FLAG[step]]
  return { text: TURN_STEP_LABEL[step][used ? 'on' : 'off'], used }
}

const toLeaves = (options: TurnOption[]): ChartLeaf[] => options.map((o) => ({ text: o.name, id: o.id, ready: o.ready }))

export function buildTurnChart({ attacksPerAction, turn, concentrationName, options }: TurnChartInput): ChartNode[] {
  const leaf = (text: string): ChartLeaf => ({ text })
  const left = stillAvailable(turn, options)
  return [
    {
      key: 'start',
      label: 'Your turn begins',
      hint: 'Press New turn (N): it clears the turn and readies your reaction.',
      leaves: concentrationName ? [leaf(`Still concentrating on ${concentrationName}`)] : [],
      children: []
    },
    {
      key: 'move',
      step: 'move',
      label: 'Move',
      hint: 'Up to your speed. You can split it around your action.',
      status: stepStatus(turn, 'move'),
      leaves: [],
      children: []
    },
    {
      key: 'action',
      step: 'action',
      label: 'Action',
      hint: 'Any order: move, act, and use your bonus action when it fits.',
      status: stepStatus(turn, 'action'),
      leaves: [],
      children: [
        {
          key: 'attack',
          label: 'Attack',
          hint: `${plural(attacksPerAction, 'attack', 'attacks')} with the Attack action.`,
          leaves: [],
          children: [],
          link: { label: 'Weapons & attacks', to: 'attacks' }
        },
        {
          key: 'magic',
          label: 'Cast a spell',
          hint: 'A cantrip uses no slot. Only one spell with a slot per turn.',
          status: { text: SLOT_TURN_LABEL[turn.slotSpellCast ? 'spent' : 'free'], used: turn.slotSpellCast },
          leaves: [],
          children: []
        },
        { key: 'skill', label: 'Skill check', hint: 'Influence, Search, Study or Utilize.', leaves: [], children: [] },
        {
          key: 'other',
          label: 'Something else',
          hint: 'Dash, Disengage, Dodge, Help, Hide, or Ready (which uses your reaction).',
          leaves: [],
          children: []
        }
      ]
    },
    {
      key: 'bonus',
      step: 'bonus',
      label: 'Bonus action',
      hint: 'One per turn.',
      status: stepStatus(turn, 'bonus'),
      leaves: options.bonus.length > 0 ? toLeaves(options.bonus) : [leaf('Nothing you have prepared takes a bonus action.')],
      children: []
    },
    { key: 'free', label: 'Free', hint: 'One object interaction, and a few words.', leaves: [], children: [] },
    {
      key: 'reaction',
      step: 'reaction',
      label: 'Reaction',
      hint: 'Once per round, on any creature’s turn. It comes back when your turn begins.',
      status: stepStatus(turn, 'reaction'),
      leaves: [leaf(OPPORTUNITY_ATTACK), ...toLeaves(options.reaction)],
      children: []
    },
    {
      key: 'end',
      label: 'End of turn',
      hint: left.length > 0 ? `Still available: ${left.join(', ')}.` : 'Nothing left to remember.',
      leaves: [],
      children: []
    }
  ]
}
