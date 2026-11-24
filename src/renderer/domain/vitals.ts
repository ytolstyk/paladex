/** At or below this share of maximum hit points the character is in a bad way: the bar throbs and the status reads "Critical". */
export const LOW_HP_PERCENT = 25
/** At or below half the maximum a character is "bloodied" (the table's word for it). */
export const BLOODIED_PERCENT = 50

/** How full the hit-point bar is, 0 to 100. Hit points below zero or above the maximum are held to the ends. */
export function hpPercent(hp: number, hpMax: number): number {
  if (hpMax <= 0) return 0
  return Math.max(0, Math.min(100, (hp / hpMax) * 100))
}

export type HealthState = 'healthy' | 'bloodied' | 'critical' | 'down'

/** How the table would describe the character's health at a glance. */
export function healthState(hp: number, hpMax: number): HealthState {
  if (hp <= 0) return 'down'
  const percent = hpPercent(hp, hpMax)
  if (percent <= LOW_HP_PERCENT) return 'critical'
  if (percent <= BLOODIED_PERCENT) return 'bloodied'
  return 'healthy'
}

export const HEALTH_LABEL: Record<HealthState, string> = {
  healthy: 'Healthy',
  bloodied: 'Bloodied',
  critical: 'Critical',
  down: 'Down'
}
