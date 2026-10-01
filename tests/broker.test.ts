import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopBroker } from '../src/broker.ts'
import { action, application, sessionId } from '../src/validation.ts'
import type { DesktopBackend } from '../src/types.ts'

const brokers: DesktopBroker[] = []
afterEach(async () => { await Promise.all(brokers.splice(0).map(b => b.dispose())) })
function fixture() {
  let now = 1000
  const native: DesktopBackend = {
    start: vi.fn(async () => ({ display: ':99' })), frame: vi.fn(async () => ({ data: Buffer.from('test'), width: 1280, height: 800, timestamp: new Date(now).toISOString() })),
    input: vi.fn(async () => {}), release: vi.fn(async () => {}), launch: vi.fn(async () => ({ id: 'a', pid: 1 })), stop: vi.fn(async () => {}),
  }
  const broker = new DesktopBroker({ width: 1280, height: 800, maxSessions: 1, humanLeaseMs: 10_000, frameCacheMs: 100, createBackend: () => native, now: () => now })
  brokers.push(broker)
  return { broker, native, advance: (n: number) => { now += n } }
}
describe('desktop ownership', () => {
  it('starts agent-owned, viewing does not take ownership, and repeated start does not resume a paused session', async () => {
    const { broker, native } = fixture()
    expect(broker.status('s').state).toBe('stopped')
    const running = await broker.control('s', 'start', '/')
    expect(running.owner).toBe('agent')
    await broker.frame('s', running.epoch)
    expect(broker.status('s').owner).toBe('agent')
    await broker.control('s', 'pause', '/', running.epoch)
    expect((await broker.control('s', 'start', '/')).owner).toBe('none')
    expect(native.start).toHaveBeenCalledTimes(1)
  })
  it('invalidates old agent and human epochs on each takeover and requires an explicit resume', async () => {
    const { broker, native } = fixture()
    const a = await broker.control('s', 'start', '/')
    const h = await broker.control('s', 'takeover', '/', a.epoch)
    await expect(broker.input('s', 'agent', a.epoch, { type: 'move', x: 1, y: 2 })).rejects.toMatchObject({ code: 'stale-epoch' })
    await expect(broker.input('s', 'agent', h.epoch, { type: 'move', x: 1, y: 2 })).rejects.toMatchObject({ code: 'not-owner' })
    await expect(broker.input('s', 'human', h.epoch, { type: 'move', x: 1, y: 2 })).rejects.toMatchObject({ code: 'not-controller' })
    expect(broker.status('s')).not.toHaveProperty('controlToken')
    await broker.input('s', 'human', h.epoch, { type: 'move', x: 1, y: 2 }, undefined, h.controlToken)
    const h2 = await broker.control('s', 'takeover', '/', h.epoch)
    expect(h2.epoch).toBeGreaterThan(h.epoch)
    await expect(broker.input('s', 'human', h.epoch, { type: 'key', key: 'Shift', down: true })).rejects.toThrow()
    const paused = await broker.control('s', 'release', '/', h2.epoch)
    expect(paused.owner).toBe('none')
    expect((await broker.control('s', 'resume', '/', paused.epoch)).owner).toBe('agent')
    expect(native.release).toHaveBeenCalledTimes(4)
  })
  it('revokes a human lease without a live viewer; no automatic agent resume', async () => {
    const { broker, native, advance } = fixture()
    await broker.control('s', 'start', '/')
    const h = await broker.control('s', 'takeover', '/')
    advance(5000); broker.status('s', h.epoch, h.controlToken)
    advance(9000); await broker.expireLeases()
    expect(broker.status('s').owner).toBe('human')
    advance(1001); await broker.expireLeases()
    expect(broker.status('s').owner).toBe('none')
    expect(native.release).toHaveBeenCalledTimes(2)
  })
  it('waits for current input but rejects queued old-epoch input before completing takeover', async () => {
    const { broker, native } = fixture()
    let finish!: () => void
    const started = await broker.control('s', 'start', '/')
    native.input = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const first = broker.input('s', 'agent', started.epoch, { type: 'move', x: 1, y: 1 })
    const firstCancelled = expect(first).rejects.toThrow('cancelled')
    await Promise.resolve()
    const second = broker.input('s', 'agent', started.epoch, { type: 'move', x: 2, y: 2 })
    const secondRejected = expect(second).rejects.toMatchObject({ code: 'stale-epoch' })
    const takeover = broker.control('s', 'takeover', '/', started.epoch)
    expect(broker.status('s').owner).toBe('none')
    finish(); await firstCancelled; await secondRejected
    expect((await takeover).owner).toBe('human')
    expect(native.input).toHaveBeenCalledTimes(1)
  })
  it('enforces session count and target separation', async () => {
    const { broker } = fixture()
    await broker.control('a', 'start', '/')
    await expect(broker.control('b', 'start', '/')).rejects.toMatchObject({ code: 'session-limit' })
    await expect(broker.frame('b')).rejects.toMatchObject({ code: 'not-running' })
    await broker.control('a', 'stop', '/')
    expect((await broker.control('b', 'start', '/')).state).toBe('running')
  })
  it('keeps input disabled and stops backend if held-input release fails', async () => {
    const { broker, native } = fixture()
    await broker.control('s', 'start', '/')
    native.release = vi.fn(async () => { throw new Error('broken channel') })
    await expect(broker.control('s', 'takeover', '/')).rejects.toThrow('broken')
    expect(broker.status('s')).toMatchObject({ state: 'error', owner: 'none' })
    expect(native.stop).toHaveBeenCalled()
  })
})
describe('wire validation', () => {
  it('rejects unsafe coordinates, stale shapes and reserved launch routing', () => {
    expect(() => action({ type: 'click', x: 1280, y: 0 }, 1280, 800)).toThrow()
    expect(() => action({ type: 'move', x: NaN, y: 0 }, 1280, 800)).toThrow()
    expect(() => action({ type: 'button', button: 'left', down: 'true' }, 1280, 800)).toThrow()
    expect(() => action({ type: 'text', text: 'x'.repeat(4001) }, 1280, 800)).toThrow()
    expect(() => sessionId('../other')).toThrow()
    expect(() => application({ command: 'xterm', env: { DISPLAY: ':1' } }, '/')).toThrow()
    expect(application({ command: 'python', env: { CONDA_PREFIX: '/existing' } }, '/project')).toMatchObject({ cwd: '/project', env: { CONDA_PREFIX: '/existing' } })
  })
})
