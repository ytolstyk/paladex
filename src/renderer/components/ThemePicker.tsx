import { memo } from 'react'
import { THEMES, type ThemeId } from '@/domain/themes'
import { useThemeStore } from '@/state/themeStore'

/** A miniature of the sheet. It wears the theme through `data-theme`, so it always matches the real thing. */
const ThemePreview = memo(function ThemePreview({ id }: { id: ThemeId }): React.JSX.Element {
  return (
    <div className="theme-preview" data-theme={id} aria-hidden="true">
      <div className="theme-preview__banner">
        <span className="theme-preview__name">Havel</span>
      </div>
      <div className="theme-preview__body">
        <div className="theme-preview__panel">
          <span className="theme-preview__title">Slots</span>
          <span className="theme-preview__gems">
            <i className="theme-preview__gem" />
            <i className="theme-preview__gem" />
            <i className="theme-preview__gem theme-preview__gem--spent" />
          </span>
        </div>
        <div className="theme-preview__card">
          <span className="theme-preview__text">Bless</span>
          <span className="theme-preview__cast" />
        </div>
        <div className="theme-preview__roles">
          <i data-role="offense" />
          <i data-role="control" />
          <i data-role="support" />
          <i data-role="utility" />
          <i data-accent="second" />
          <i data-accent="third" />
        </div>
      </div>
    </div>
  )
})

/** Radio group of themes: native radios, so arrow keys and screen readers work without extra code. */
export function ThemePicker(): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <fieldset className="theme-picker">
      <legend className="settings__heading">Color theme</legend>
      <div className="theme-picker__grid">
        {THEMES.map((t) => (
          <label key={t.id} className="theme-option">
            <input
              type="radio"
              name="theme"
              className="theme-option__input"
              value={t.id}
              checked={theme === t.id}
              onChange={() => setTheme(t.id)}
            />
            <ThemePreview id={t.id} />
            <span className="theme-option__name">{t.name}</span>
            <span className="theme-option__blurb muted">{t.blurb}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
