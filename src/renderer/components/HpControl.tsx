import { useEffect, useRef, useState } from 'react'
import { usePlayStore } from '@/state/session'

/** At or below this share of maximum hit points the bar throbs. */
const LOW_HP_PERCENT = 25

/** The hit-point block in the banner. Click it to take damage or heal; the number field takes any amount. */
export function HpControl(): React.JSX.Element | null {
  const vitals = usePlayStore((s) => s.play?.vitals)
  const adjustHp = usePlayStore((s) => s.adjustHp)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!vitals) return null
  const hpPct = Math.max(0, Math.min(100, (vitals.hp / vitals.hpMax) * 100))
  const low = hpPct <= LOW_HP_PERCENT
  const parsed = Number.parseInt(amount, 10)
  const valid = Number.isFinite(parsed) && parsed > 0

  const apply = (sign: 1 | -1): void => {
    if (!valid) return
    adjustHp(sign * parsed)
    setAmount('')
    setOpen(false)
  }

  return (
    <div className="hp" ref={box}>
      <button
        type="button"
        className="vital vital--hp"
        aria-expanded={open}
        aria-label={`Hit points ${vitals.hp} of ${vitals.hpMax}${vitals.tempHp ? `, ${vitals.tempHp} temporary` : ''}. Change hit points`}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="hp-bar" role="img" aria-label={`${Math.round(hpPct)} percent health`} data-low={low || undefined}>
          <div className="hp-bar__fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="vital__value">
          {vitals.hp}
          <span className="vital__of"> of {vitals.hpMax}</span>
          {vitals.tempHp > 0 && <span className="vital__temp"> +{vitals.tempHp}</span>}
        </span>
        <span className="vital__label">Hit points</span>
      </button>
      {open && (
        <div className="hp-popover" role="dialog" aria-label="Change hit points">
          <input
            className="field"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Amount"
            aria-label="Amount"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="hp-popover__actions">
            <button type="button" className="btn btn--danger" disabled={!valid} onClick={() => apply(-1)}>
              Take damage
            </button>
            <button type="button" className="btn" disabled={!valid} onClick={() => apply(1)}>
              Heal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
