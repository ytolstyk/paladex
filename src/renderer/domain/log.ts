import type { LogEntry } from '@shared/schema'
import { TURN_STEP_LABEL } from './labels'

const amountOf = (entry: LogEntry): number => Math.abs(entry.amount ?? 0)

const dieName = (entry: LogEntry): string => (entry.die === undefined ? 'a die' : `d${entry.die}`) // hand-edited entries may lack it

function viaSuffix(entry: LogEntry): string {
  switch (entry.via) {
    case 'slot':
      return entry.level ? ` (level ${entry.level} slot)` : ' (slot)' // tolerate hand-edited / older entries
    case 'free':
      return ' (free cast)'
    case 'charge':
      return ' (item charge)'
    default:
      return ''
  }
}

/** "Reaction used" / "Reaction ready". Hand-edited entries may lack either field. */
function turnStepText(entry: LogEntry): string {
  if (!entry.step) return 'A turn step changed'
  return TURN_STEP_LABEL[entry.step][entry.on === false ? 'off' : 'on']
}

/** Render a structured log entry as a sentence. Wording lives here so it can change without touching saved data. */
export function formatLog(entry: LogEntry, nameOf: (id: string) => string = (id) => id): string {
  const name = entry.spellId ? nameOf(entry.spellId) : 'a spell'
  switch (entry.kind) {
    case 'seed':
      return 'Seeded fully rested'
    case 'cast': {
      const ended = entry.endedSpellId ? `; concentration on ${nameOf(entry.endedSpellId)} ends` : ''
      return `Cast ${name}${viaSuffix(entry)}${ended}`
    }
    case 'slot-spend':
      return `Spent a level ${entry.level} slot (manual)`
    case 'slot-restore':
      return `Restored a level ${entry.level} slot (manual)`
    case 'new-turn':
      return 'New turn'
    case 'short-rest':
      return 'Short rest'
    case 'long-rest':
      return 'Long rest'
    case 'counter': {
      const counter = entry.counterId ?? 'a resource'
      return (entry.amount ?? 0) < 0 ? `Spent ${amountOf(entry)} ${counter}` : `Restored ${amountOf(entry)} ${counter}`
    }
    case 'hp':
      return (entry.amount ?? 0) < 0 ? `Took ${amountOf(entry)} damage` : `Healed ${amountOf(entry)}`
    case 'feature': {
      const used = entry.featureId ? nameOf(entry.featureId) : 'a feature'
      return (entry.amount ?? 1) > 1 ? `Used ${used} (${entry.amount})` : `Used ${used}`
    }
    case 'initiative':
      return entry.amount === undefined ? 'Initiative cleared' : `Initiative set to ${entry.amount}`
    case 'inspiration-gain':
      return `Received Bardic Inspiration (${dieName(entry)})`
    case 'inspiration-use':
      return `Used Bardic Inspiration (${dieName(entry)})`
    case 'inspiration-die':
      return `Bardic Inspiration die set to ${dieName(entry)}`
    case 'turn-step':
      return turnStepText(entry)
    case 'timer-end':
      return `${name} has ended`
    case 'prepare':
      return `Prepared ${name}`
    case 'unprepare':
      return `Unprepared ${name}`
    case 'favorite':
      return `Starred ${name}`
    case 'unfavorite':
      return `Unstarred ${name}`
    case 'drop-concentration':
      return `Dropped concentration on ${name}`
  }
}
