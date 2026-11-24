/** Whether the player asked the system for less motion. Read when an effect starts, so a change in settings applies to the next one. */
export const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches
