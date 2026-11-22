/**
 * The color themes. Colors themselves live in styles/tokens.css (Candlelit Oak) and styles/themes.css (the rest),
 * keyed by `[data-theme='<id>']`; this file is only the registry the settings page and the store read.
 * Whether a theme is light or dark is declared once, as `color-scheme` in its CSS block.
 */
export const THEMES = [
  { id: 'oak', name: 'Candlelit Oak', blurb: 'Warm dark wood and gold leaf. The original look.' },
  { id: 'moon', name: 'Moonlit Steel', blurb: 'Cool slate with a silver accent. Easy on the eyes at night.' },
  { id: 'glade', name: 'Elven Glade', blurb: 'Deep forest green with leaf-gold trim.' },
  { id: 'ember', name: 'Ember Court', blurb: 'Burgundy and banked coals, with a copper accent.' },
  { id: 'parchment', name: 'Parchment & Ink', blurb: 'Light aged paper and dark ink, for bright rooms.' },
  { id: 'contrast', name: 'High Contrast', blurb: 'Black and white with a bold yellow accent, for maximum legibility.' }
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'oak'

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

/** Parses a stored value, falling back to the default for anything unknown (a removed theme, a hand-edited value). */
export function parseTheme(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME
}
