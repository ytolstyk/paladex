import { catalog } from '@/state/session'

/** Read-only reference for features without a tile (DM homebrew like the Circle Spell options). */
export function OtherFeatures(): React.JSX.Element | null {
  if (catalog.otherFeatures.length === 0) return null
  return (
    <details className="other-features">
      <summary>Other features ({catalog.otherFeatures.length})</summary>
      <ul>
        {catalog.otherFeatures.map((feature) => (
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
