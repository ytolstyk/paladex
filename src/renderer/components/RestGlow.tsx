import { useEffect } from 'react'
import { useUiStore } from '@/state/uiStore'

/** Longer than the CSS animation (1.8s) so the overlay is never removed mid-fade. Also the cleanup when motion is reduced. */
const GLOW_MS = 2000

/** A wash of warm light across the page when the party rests: candle-gold for a short rest, dawn for a long one. */
export function RestGlow(): React.JSX.Element | null {
  const glow = useUiStore((s) => s.restGlow)
  const clear = useUiStore((s) => s.clearRestGlow)

  useEffect(() => {
    if (!glow) return
    const timer = window.setTimeout(clear, GLOW_MS)
    return () => window.clearTimeout(timer)
  }, [glow, clear])

  if (!glow) return null
  return <div className="rest-glow" data-kind={glow.kind} key={glow.n} aria-hidden="true" />
}
