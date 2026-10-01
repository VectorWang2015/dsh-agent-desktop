import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopBroker } from '../src/broker.ts'
import { captureObservation } from '../src/observations.ts'
import type { DesktopBackend } from '../src/types.ts'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment/types'

const brokers: DesktopBroker[] = []
afterEach(async () => { await Promise.allSettled(brokers.splice(0).map(b => b.dispose())) })
function backend(): DesktopBackend {
  return { start: async () => ({ display: ':99' }), frame: async () => ({ data: Buffer.from('png'), width: 1280, height: 800, timestamp: '2026-01-01T00:00:00Z' }), input: async () => {}, release: async () => {}, launch: async () => ({ id: 'app', pid: 42 }), stop: vi.fn(async () => {}) }
}
function make(factory: () => DesktopBackend) {
  const broker = new DesktopBroker({ createBackend: factory, width: 1280, height: 800, maxSessions: 1, humanLeaseMs: 10000, frameCacheMs: 0 })
  brokers.push(broker)
  return broker
}
describe('startup and observation regressions', () => {
  it('rolls back a pre-spawn abort instead of remaining starting forever', async () => {
    const factory = vi.fn(backend), broker = make(factory), controller = new AbortController()
    const starting = broker.control('s', 'start', '/', undefined, controller.signal)
    controller.abort(new Error('cancelled before spawn'))
    await expect(starting).rejects.toThrow('cancelled')
    expect(broker.status('s').state).toBe('stopped')
    expect(factory).not.toHaveBeenCalled()
    expect((await broker.control('s', 'start', '/')).state).toBe('running')
  })
  it('does not replace an exited backend until its owned range is stopped', async () => {
    const first = backend(), second = backend()
    let onExit!: (error: Error) => void
    first.onExit = callback => { onExit = callback }
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
    const broker = make(factory)
    await broker.control('s', 'start', '/')
    onExit(new Error('worker crashed'))
    first.stop = vi.fn(async () => { throw new Error('survivors') })
    await expect(broker.control('s', 'start', '/')).rejects.toThrow('survivors')
    expect(factory).toHaveBeenCalledTimes(1)
    await expect(broker.control('other', 'start', '/')).rejects.toMatchObject({ code: 'session-limit' })
    first.stop = vi.fn(async () => {})
    await broker.control('s', 'start', '/')
    expect(first.stop).toHaveBeenCalled()
    expect(factory).toHaveBeenCalledTimes(2)
  })
  it('retains a partially started backend when startup cleanup also fails', async () => {
    const broken = backend()
    broken.start = async () => { throw new Error('start failed') }
    broken.stop = async () => { throw new Error('stop failed') }
    const factory = vi.fn(() => broken), broker = make(factory)
    await expect(broker.control('s', 'start', '/')).rejects.toThrow('start failed')
    await expect(broker.control('s', 'start', '/')).rejects.toThrow('stop failed')
    expect(factory).toHaveBeenCalledTimes(1)
    broken.stop = async () => {}
  })
  it('rejects an image if ownership changed while attachment persistence awaited', async () => {
    const broker = make(backend)
    await broker.control('s', 'start', '/')
    let finish!: (image: ImageAttachmentRef) => void
    const saved = vi.fn(() => new Promise<ImageAttachmentRef>(resolve => { finish = resolve }))
    const screenshot = captureObservation(broker, 's', saved, new AbortController().signal)
    const refused = expect(screenshot).rejects.toMatchObject({ code: 'stale-epoch' })
    await vi.waitFor(() => expect(saved).toHaveBeenCalled())
    await broker.control('s', 'takeover', '/')
    await broker.control('s', 'resume', '/')
    finish({ attachmentId: 'test' as ImageAttachmentRef['attachmentId'], mediaType: 'image/png', width: 640, height: 400, bytes: 100 })
    await refused
  })
  it('does not publish running if the worker exits between ready and commit', async () => {
    const failed = backend()
    let onExit!: (error: Error) => void
    failed.onExit = handler => { onExit = handler }
    failed.start = async () => { queueMicrotask(() => onExit(new Error('worker died before commit'))); return { display: ':99' } }
    const broker = make(() => failed)
    await expect(broker.control('s', 'start', '/')).rejects.toThrow('worker died')
    expect(broker.status('s')).toMatchObject({ state: 'error', owner: 'none' })
    expect(failed.stop).toHaveBeenCalled()
  })
  it('reports coordinate multipliers when attachment storage downscales', async () => {
    const broker = make(backend)
    const initial = await broker.control('s', 'start', '/')
    const result = await captureObservation(broker, 's', async () => ({ attachmentId: 'test' as ImageAttachmentRef['attachmentId'], mediaType: 'image/png', width: 640, height: 400, bytes: 100 }), new AbortController().signal)
    expect(result.coordinates.multiplyImageXBy).toBe(2)
    expect(result.status.epoch).toBe(initial.epoch)
  })
})
