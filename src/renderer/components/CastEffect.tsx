import { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import type { Role } from '@shared/types'
import type { EffectChoice, EffectId } from '@/domain/effects'
import { buildShow, type Particle } from '@/domain/particles'
import { prefersReducedMotion } from '@/hooks/prefersReducedMotion'

/** Time to let the last animation finish its fade before the layer is removed. */
const CLEANUP_SLACK_MS = 120

/** A particle's numbers, handed to the stylesheet as custom properties. */
function particleStyle(p: Particle): React.CSSProperties {
  // React's style type has no custom properties, hence the cast; every value is a number from `buildShow`.
  return {
    '--x': `${p.x}%`,
    '--y': `${p.y}%`,
    '--cx': `${p.cx}px`,
    '--cy': `${p.cy}px`,
    '--dx': `${p.dx}px`,
    '--dy': `${p.dy}px`,
    '--angle': `${p.angle}deg`,
    '--reach': `${p.reach}px`,
    '--size': `${p.size}px`,
    '--delay': `${p.delay}ms`,
    '--dur': `${p.dur}ms`
  } as React.CSSProperties
}

/** The show behind a card: pieces that start on the card's edge and fly out, so they appear to come from behind it. */
function CastEffect({
  effect,
  seed,
  role,
  onDone
}: {
  effect: EffectId
  /** Makes each show differ a little from the last. */
  seed: number
  role: Role | undefined
  onDone(): void
}): React.JSX.Element {
  const { particles, totalMs } = useMemo(() => buildShow(effect, seed), [effect, seed])
  const styles = useMemo(() => particles.map(particleStyle), [particles])

  useEffect(() => {
    const timer = window.setTimeout(onDone, totalMs + CLEANUP_SLACK_MS)
    return () => window.clearTimeout(timer)
  }, [totalMs, onDone])

  return (
    <div className="fx-layer" data-effect={effect} data-role={role} aria-hidden="true">
      {styles.map((style, i) => (
        <i key={i} className="fx-piece" style={style} />
      ))}
    </div>
  )
}

/** What a host's owner can do to it. */
export interface FxHandle {
  /** Plays a show behind the host's content. A new call restarts it. `'none'`, hidden windows and reduced motion play nothing. */
  play(effect: EffectChoice): void
}

interface FxHostProps {
  /** Tints the show with a spell's role color; gold when omitted. */
  role?: Role
  as?: 'div' | 'li'
  className?: string
  /** The owner's way to call `play`. */
  ref?: React.Ref<FxHandle>
  /** One opaque box: the show plays behind it and is hidden by it, which is what makes it look like it comes from behind. */
  children: React.ReactNode
}

/**
 * A box that can play a cast effect from behind its content. It owns everything the effect needs: the stacking
 * (`.fx-host` isolates it, so the layer paints behind the content yet above neighbours while it plays), the layer's
 * lifetime, and the show's state. That state is kept here, not in the owner, so a show starting or ending re-renders
 * this box only: `children` keeps its identity and React skips it.
 * Purely visual: it never affects the cast.
 */
export function FxHost({ role, as: Tag = 'div', className, ref, children }: FxHostProps): React.JSX.Element {
  const [show, setShow] = useState<{ n: number; seed: number; effect: EffectId } | null>(null)
  const done = useCallback(() => setShow(null), [])

  useImperativeHandle(
    ref,
    () => ({
      play(effect) {
        // With reduced motion every piece is invisible anyway (see app.css), and a hidden window cannot show it.
        if (effect === 'none' || document.hidden || prefersReducedMotion()) return
        // The clock seeds the show so two hosts (or two casts) never repeat each other; `n` remounts the layer on a replay.
        setShow((prev) => ({ n: (prev?.n ?? 0) + 1, seed: Date.now(), effect }))
      }
    }),
    []
  )

  return (
    <Tag className={className ? `fx-host ${className}` : 'fx-host'} data-fx={show ? '' : undefined}>
      {children}
      {show && <CastEffect key={show.n} effect={show.effect} seed={show.seed} role={role} onDone={done} />}
    </Tag>
  )
}
