import { otherFeatureMatches, searchTokens } from '@/domain/search'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'

/** Read-only reference for features without a tile (DM homebrew like the Circle Spell options). The search box reaches it too. */
export function OtherFeatures(): React.JSX.Element | null {
  const query = useUiStore((s) => s.filters.query)
  const tokens = searchTokens(query)
  const searching = tokens.length > 0
  const features = searching ? catalog.otherFeatures.filter((f) => otherFeatureMatches(f, tokens)) : catalog.otherFeatures
  if (features.length === 0) return null

  return (
    // While a search is running the matches are shown open, since they are what the player asked for.
    <details className="other-features" open={searching || undefined}>
      <summary>
        {searching ? 'Other features that match' : 'Other features'} ({features.length})
      </summary>
      <ul>
        {features.map((feature) => (
          <li key={feature.name}>
            <h3>{feature.name}</h3>
            {feature.text
              .split('\n')
              .filter((line) => line.trim() !== '')
              .map((line, i) => (
                <p key={i}>{line}</p>
              ))}
          </li>
        ))}
      </ul>
    </details>
  )
}
