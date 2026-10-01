import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment/types'
import { DesktopBroker } from '../src/broker.ts'
import { captureObservation } from '../src/observations.ts'
import { action, desktopSize, probePoints, region, windowId } from '../src/validation.ts'
import type { DesktopBackend, DesktopInventory, FrameOptions } from '../src/types.ts'

const brokers: DesktopBroker[] = []
afterEach(async () => { await Promise.all(brokers.splice(0).map(b => b.dispose())) })
function fixture() {
  let seq = 0
  const inventory: DesktopInventory = {
    applications: [], windows: [], observedAt: '2026-01-01T00:00:00Z', focusedWindowId: null, activeWindowId: null, input: { heldKeys: [], heldButtons: [] },
  }
  const native: DesktopBackend = {
    start: async () => ({ display: ':99' }), stop: vi.fn(async () => {}), release: vi.fn(async () => {}),
    input: vi.fn(async () => {}), launch: async () => ({ id: 'app', pid: 123 }),
    inspect: vi.fn(async () => structuredClone(inventory)),
    frame: vi.fn(async (_signal?: AbortSignal, options: FrameOptions = {}) => ({ data: Buffer.from('same-static-pixels'), width: options.region?.width ?? 1280, height: options.region?.height ?? 800, region: options.region ?? { x: 0, y: 0, width: 1280, height: 800 }, timestamp: '2026-01-01T00:00:00Z', frameId: `frame-${++seq}` })),
    focus: vi.fn(async id => ({ windowId: id, requested: true, confirmed: false, focusedWindowId: 99, reason: 'modal retains focus' })),
    closeWindow: vi.fn(async id => ({ windowId: id, requested: true })),
    probe: vi.fn(async (points: Array<{ x: number; y: number }>) => ({ frameId: 'probe-1', capturedAt: '2026-01-01T00:00:00Z', coordinateSpace: 'desktop' as const, cursorOverlay: false as const, samples: points.map(point => ({ ...point, rgba: [18, 52, 86, 255] as [number, number, number, number] })) })),
  }
  const factory = vi.fn(() => native)
  const broker = new DesktopBroker({ width: 1280, height: 800, maxSessions: 2, humanLeaseMs: 10000, frameCacheMs: 300, createBackend: factory })
  brokers.push(broker)
  return { broker, native, inventory, factory }
}
const save = async (f: { width: number; height: number }): Promise<ImageAttachmentRef> => ({ attachmentId: 'mock-image' as ImageAttachmentRef['attachmentId'], mediaType: 'image/png', width: f.width / 2, height: f.height / 2, bytes: 20 })

describe('safe keyboard normalization', () => {
  it('defaults key without down to atomic press, not a hold', () => {
    expect(action({ type: 'key', key: 'Return' }, 1280, 800)).toEqual({ type: 'press', key: 'Return', modifiers: [] })
    expect(action({ type: 'press', key: 's', modifiers: ['Control'] }, 1280, 800)).toEqual({ type: 'press', key: 's', modifiers: ['Control'] })
    expect(action({ type: 'release' }, 1280, 800)).toEqual({ type: 'release' })
  })
  it('preserves explicit raw pairing and rejects ambiguous modifiers', () => {
    expect(action({ type: 'key', key: 'Return', down: false }, 1280, 800)).toEqual({ type: 'key', key: 'Return', down: false })
    expect(() => action({ type: 'press', key: 'Return', down: true }, 1280, 800)).toThrow()
    expect(() => action({ type: 'key', key: 's', down: true, modifiers: ['Control'] }, 1280, 800)).toThrow()
    expect(() => action({ type: 'press', key: 's', modifiers: ['Control', 'Control'] }, 1280, 800)).toThrow()
  })
  it('quarantines the owned backend if input and release both fail', async () => {
    const { broker, native } = fixture()
    const s = await broker.control('s', 'start', '/')
    native.input = async () => { throw new Error('partial press failed') }
    native.release = async () => { throw new Error('release unconfirmed') }
    await expect(broker.input('s', 'agent', s.epoch, { type: 'press', key: 'Return' })).rejects.toThrow('partial press failed')
    expect(broker.status('s')).toMatchObject({ state: 'error', owner: 'none' })
    expect(native.stop).toHaveBeenCalledOnce()
    await expect(broker.input('s', 'agent', broker.status('s').epoch, { type: 'press', key: 'Return' })).rejects.toMatchObject({ code: 'not-running' })
  })
  it('tags human versus agent input only from broker authority', async () => {
    const { broker, native } = fixture()
    const s = await broker.control('s', 'start', '/')
    await broker.input('s', 'agent', s.epoch, { type: 'press', key: 'Return' })
    expect(native.input).toHaveBeenLastCalledWith({ type: 'press', key: 'Return' }, expect.any(AbortSignal), 'agent')
    const human = await broker.control('s', 'takeover', '/', s.epoch)
    await broker.input('s', 'human', human.epoch, { type: 'key', key: 'Return', down: true }, undefined, human.controlToken)
    expect(native.input).toHaveBeenLastCalledWith({ type: 'key', key: 'Return', down: true }, expect.any(AbortSignal), 'human')
  })
})

describe('observations and dimensions', () => {
  it('keeps UI cache but makes model screenshots fresh by default', async () => {
    const { broker, native } = fixture()
    const s = await broker.control('s', 'start', '/')
    const first = await broker.frame('s', s.epoch)
    const cached = await broker.frame('s', s.epoch)
    expect(cached.frameId).toBe(first.frameId)
    expect(cached.cached).toBe(true)
    const observed = await captureObservation(broker, 's', save, new AbortController().signal)
    expect(observed.frame.id).not.toBe(first.frameId)
    expect(observed.frame.cached).toBe(false)
    expect(observed.frame.capturedAt).toBe('2026-01-01T00:00:00Z')
    expect(native.frame).toHaveBeenCalledTimes(2)
  })
  it('maps cropped and downscaled coordinates with offsets', async () => {
    const { broker } = fixture()
    await broker.control('s', 'start', '/')
    const observed = await captureObservation(broker, 's', save, new AbortController().signal, { region: { x: 300, y: 200, width: 400, height: 200 }, cursor: false })
    expect(observed.coordinates).toMatchObject({ desktopWidth: 1280, desktopHeight: 800, imageWidth: 200, imageHeight: 100, multiplyImageXBy: 2, multiplyImageYBy: 2, offsetX: 300, offsetY: 200 })
    expect(observed.frame.cursorOverlay).toBe(false)
  })
  it('accepts requested size only for a new/stopped desktop', async () => {
    const { broker, factory } = fixture()
    const size = desktopSize({ width: 1600, height: 1000 })!
    const initial = await broker.control('s', 'start', '/', undefined, undefined, size)
    expect(initial).toMatchObject(size)
    expect(factory).toHaveBeenCalledWith('s', '/', size)
    await expect(broker.control('s', 'start', '/', initial.epoch, undefined, { width: 1920, height: 1080 })).rejects.toMatchObject({ code: 'already-running' })
    await broker.control('s', 'stop', '/', initial.epoch)
    expect(await broker.control('s', 'start', '/')).toMatchObject(size)
  })
  it('rejects malformed sizes, regions, points and window ids', () => {
    expect(() => desktopSize({ width: 1600 })).toThrow()
    expect(() => desktopSize({ width: 1600.5, height: 1000 })).toThrow()
    expect(() => region({ x: 1200, y: 0, width: 100, height: 50 }, 1280, 800)).toThrow()
    expect(() => probePoints([{ x: 1280, y: 0 }], 1280, 800)).toThrow()
    expect(() => probePoints(Array(33).fill({ x: 0, y: 0 }), 1280, 800)).toThrow()
    expect(() => windowId(-1)).toThrow()
  })
})

describe('live state and non-forcing window operations', () => {
  it('refreshes an exited launch process even when other windows remain', async () => {
    const { broker, inventory } = fixture()
    const s = await broker.control('s', 'start', '/')
    await broker.launch('s', s.epoch, { command: 'wrapper', args: [], env: {}, cwd: '/' })
    inventory.applications = [{ id: 'app', command: 'wrapper', pid: 123, running: false, exitCode: 0, observedAt: inventory.observedAt, windowIds: [] }]
    inventory.windows = [{ id: 77, title: 'GUI child', pid: 124, mapped: true, focusable: true, focused: true, active: true, modal: false, transientFor: null, supportsDelete: true, geometry: { x: 0, y: 0, width: 100, height: 100 } }]
    expect(await broker.inspect('s')).toMatchObject({ applications: [{ running: false, exitCode: 0 }], windows: [{ id: 77 }] })
  })
  it('returns focus refusal and close request without pretending success', async () => {
    const { broker, native } = fixture()
    const s = await broker.control('s', 'start', '/')
    expect((await broker.windowOperation('s', s.epoch, 'focus', 77)).result).toMatchObject({ confirmed: false, focusedWindowId: 99 })
    expect((await broker.windowOperation('s', s.epoch, 'closeWindow', 77)).result).toEqual({ windowId: 77, requested: true })
    expect(native.stop).not.toHaveBeenCalled()
    const human = await broker.control('s', 'takeover', '/')
    await expect(broker.windowOperation('s', human.epoch, 'closeWindow', 77)).rejects.toMatchObject({ code: 'not-owner' })
    expect((await broker.probe('s', human.epoch, [{ x: 1, y: 2 }])).samples[0]?.rgba).toEqual([18, 52, 86, 255])
  })
  it('reports stale inspection rather than inventing fresh application state', async () => {
    const { broker, native } = fixture()
    await broker.control('s', 'start', '/')
    native.inspect = async () => { throw new Error('inspection failed') }
    expect(await broker.inspect('s')).toMatchObject({ owner: 'agent', inspectionError: 'inspection failed' })
  })
})
