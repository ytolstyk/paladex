import { describe, expect, it } from 'vitest'
import { EFFECTS } from './effects'
import { BACKDROP_MS, buildShow, seededRandom, type Particle } from './particles'

const onEdge = (p: Particle): boolean => p.x === 0 || p.x === 100 || p.y === 0 || p.y === 100

describe('seededRandom', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    const c = seededRandom(8)
    const first = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(first)
    expect([c(), c(), c()]).not.toEqual(first)
  })

  it('stays within [0, 1)', () => {
    const rand = seededRandom(1)
    for (let i = 0; i < 1000; i++) {
      const n = rand()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
})

describe('buildShow', () => {
  it('is deterministic for the same effect and seed', () => {
    for (const { id } of EFFECTS) expect(buildShow(id, 3)).toEqual(buildShow(id, 3))
  })

  it('varies between casts of the same effect (except the fixed ward)', () => {
    for (const { id } of EFFECTS.filter((e) => e.id !== 'ward')) {
      expect(buildShow(id, 1).particles).not.toEqual(buildShow(id, 2).particles)
    }
  })

  it('gives every effect finite, sane pieces and a total that covers the last one', () => {
    for (const { id } of EFFECTS) {
      const { particles, totalMs } = buildShow(id, 11)
      expect(particles.length, id).toBeGreaterThan(0)
      for (const p of particles) {
        for (const value of Object.values(p)) expect(Number.isFinite(value), id).toBe(true)
        expect(p.delay).toBeGreaterThanOrEqual(0)
        expect(p.dur).toBeGreaterThan(0)
        expect(p.size).toBeGreaterThan(0)
      }
      expect(totalMs).toBe(Math.max(BACKDROP_MS, ...particles.map((p) => p.delay + p.dur)))
      expect(totalMs, id).toBeLessThan(2500) // a flourish, never a wait
    }
  })

  it('starts the flying effects on the card edge, so they emerge from behind it', () => {
    for (const id of ['sparks', 'smoke', 'embers', 'motes', 'fireworks'] as const) {
      for (const p of buildShow(id, 5).particles) expect(onEdge(p), `${id} ${p.x},${p.y}`).toBe(true)
    }
  })

  it('sends sparks and smoke away from the card, not back through it', () => {
    for (const id of ['sparks', 'smoke'] as const) {
      for (const p of buildShow(id, 9).particles) {
        // Outward means the displacement points away from the edge the piece left.
        if (p.y === 0) expect(p.dy, id).toBeLessThan(0)
        if (p.y === 100) expect(p.dy, id).toBeGreaterThan(0)
        if (p.x === 0) expect(p.dx, id).toBeLessThan(0)
        if (p.x === 100) expect(p.dx, id).toBeGreaterThan(0)
      }
    }
  })

  it('makes embers and motes climb', () => {
    for (const id of ['embers', 'motes'] as const) {
      for (const p of buildShow(id, 4).particles) expect(p.dy, id).toBeLessThan(0)
    }
  })

  it('bundles each rocket: pieces of one rocket share an origin and burst point', () => {
    const { particles } = buildShow('fireworks', 2)
    expect(particles).toHaveLength(30)
    const groups = new Map<string, Particle[]>()
    for (const p of particles) {
      const key = `${p.x},${p.y},${p.cx},${p.cy}`
      groups.set(key, [...(groups.get(key) ?? []), p])
    }
    expect(groups.size).toBe(3)
    for (const group of groups.values()) expect(group).toHaveLength(10)
  })

  it('fans the rays out from the center, all the way round', () => {
    const { particles } = buildShow('radiance', 6)
    for (const p of particles) {
      expect([p.x, p.y]).toEqual([50, 50])
      expect(p.reach).toBeGreaterThan(125)
      expect([p.dx, p.dy]).toEqual([0, 0]) // a beam does not travel; it only reaches
    }
    const sideways = particles.filter((p) => Math.abs(Math.cos((p.angle * Math.PI) / 180)) > 0.95)
    const upright = particles.filter((p) => Math.abs(Math.sin((p.angle * Math.PI) / 180)) > 0.95)
    expect(sideways.length).toBeGreaterThan(0)
    expect(upright.length).toBeGreaterThan(0)
    // A card is wider than it is tall, so sideways beams must reach farther to clear it.
    expect(Math.min(...sideways.map((p) => p.reach))).toBeGreaterThan(Math.max(...upright.map((p) => p.reach)))
    const angles = particles.map((p) => ((p.angle % 360) + 360) % 360)
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(270)
  })

  it('covers the stylesheet\'s aura and halo, so the layer is never removed mid-fade', () => {
    expect(BACKDROP_MS).toBeGreaterThanOrEqual(900) // fx-halo, the longer of the two, is 0.9s
    for (const { id } of EFFECTS) expect(buildShow(id, 1).totalMs, id).toBeGreaterThanOrEqual(BACKDROP_MS)
  })

  it('staggers three rings of the ward', () => {
    const { particles } = buildShow('ward', 0)
    expect(particles.map((p) => p.delay)).toEqual([0, 170, 340])
  })
})
