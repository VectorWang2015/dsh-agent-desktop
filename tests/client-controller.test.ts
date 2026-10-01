import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopController } from '../src/client/DesktopController.ts'
import type { DesktopTransport } from '../src/client/http.ts'
import { DesktopRequestError } from '../src/client/protocol.ts'
import type { DesktopControlResult, DesktopStatus } from '../src/types.ts'

const controlToken = 'test-capability-never-published'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
function png(width = 1280, height = 720): Blob {
  const bytes = new Uint8Array(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return new Blob([bytes], { type: 'image/png' })
}

const controllers: DesktopController[] = []
function fixture(initial: Partial<DesktopStatus> = {}) {
  let host: DesktopStatus = { sessionId: 's1', state: 'running', owner: 'agent', epoch: 1,
    backend: 'native-x11', width: 1280, height: 720, ...initial }
  const transport = {
    status: vi.fn<DesktopTransport['status']>().mockImplementation(async () => ({ ...host })),
    frame: vi.fn<DesktopTransport['frame']>().mockImplementation(async () => png(host.width, host.height)),
    control: vi.fn<DesktopTransport['control']>().mockImplementation(async (action, epoch) => {
      if (epoch !== undefined && epoch !== host.epoch) throw new DesktopRequestError('http', 'stale epoch', { ...host }, 409)
      host = { ...host, epoch: host.epoch + 1,
        owner: action === 'takeover' ? 'human' : action === 'start' || action === 'resume' ? 'agent' : 'none',
        state: action === 'stop' ? 'stopped' : 'running' }
      return { ...host, ...(action === 'takeover' ? { controlToken } : {}) }
    }),
    input: vi.fn<DesktopTransport['input']>().mockImplementation(async () => ({ ...host })),
  }
  let frameCount = 0
  const urls = { createObjectURL: vi.fn(() => `blob:frame-${++frameCount}`), revokeObjectURL: vi.fn() }
  const controller = new DesktopController('s1', transport, urls)
  controllers.push(controller)
  const api = controller.injected
  const signal = new AbortController()
  const unmount = api.mount('tab1', signal.signal)
  controller.setConnection(1)
  api.setVisible('tab1', true)
  const state = () => api.hooks.desktopState.getSnapshot()
  const loaded = (id = 'tab1') => {
    const frame = state().frame
    expect(frame).toBeDefined()
    if (frame !== undefined) api.frameLoaded(id, frame.url, frame.width, frame.height)
  }
  return { controller, api, transport, signal, unmount, state, urls, loaded,
    host: () => ({ ...host }), setHost: (patch: Partial<DesktopStatus>) => { host = { ...host, ...patch } } }
}
async function tick(ms = 1) { await vi.advanceTimersByTimeAsync(ms) }
async function human(f: ReturnType<typeof fixture>) {
  await tick()
  await expect(f.api.control('tab1', 'takeover')).resolves.toBe(true)
  await tick(501)
  f.loaded()
  expect(f.state().inputReady).toBe(true)
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T00:00:00Z')) })
afterEach(async () => {
  await Promise.all(controllers.splice(0).map(controller => controller.dispose()))
  vi.useRealTimers()
})

describe('session-owned desktop preview', () => {
  it('stays read-only when Host already reports human ownership', async () => {
    const f = fixture({ owner: 'human' })
    await tick()
    f.loaded()
    expect(f.state().humanTabId).toBeUndefined()
    expect(f.api.input('tab1', { type: 'click', x: 5, y: 5 })).toBe(false)
    expect(f.transport.control).not.toHaveBeenCalled()
    expect(f.transport.status.mock.calls[0]?.[1]).toBeUndefined()
  })
  it('requires an explicit new-epoch takeover and an actually loaded same-epoch image', async () => {
    const f = fixture()
    await tick()
    f.loaded()
    const takeover = deferred<DesktopControlResult>()
    f.transport.control.mockImplementationOnce(() => takeover.promise)
    const action = f.api.control('tab1', 'takeover')
    expect(f.state().pending).toBe('takeover')
    expect(f.api.input('tab1', { type: 'move', x: 1, y: 1 })).toBe(false)
    f.setHost({ owner: 'human', epoch: 2 })
    takeover.resolve({ ...f.host(), controlToken })
    await action
    expect(f.state().humanTabId).toBe('tab1')
    expect(f.state().inputReady).toBe(false)
    f.api.frameLoaded('tab1', 'blob:frame-1', 1280, 720)
    expect(f.state().inputReady).toBe(false)
    await tick(501)
    f.loaded()
    expect(f.api.input('tab1', { type: 'click', x: 1, y: 1 })).toBe(true)
    await tick()
    expect(f.transport.input.mock.calls[0]?.slice(0, 2)).toEqual([2, { type: 'click', x: 1, y: 1 }])
  })
  it('fails closed when takeover does not rotate epoch', async () => {
    const f = fixture({ owner: 'human' })
    await tick()
    f.transport.control.mockResolvedValueOnce(f.host())
    await expect(f.api.control('tab1', 'takeover')).resolves.toBe(false)
    expect(f.state().humanTabId).toBeUndefined()
    expect(f.state().problem?.kind).toBe('protocol')
  })
  it('cannot acquire or release another viewer grant using only its public epoch', async () => {
    const f = fixture({ owner: 'human' })
    await tick()
    await expect(f.api.control('tab1', 'release')).resolves.toBe(false)
    expect(f.transport.control).not.toHaveBeenCalled()
    f.setHost({ epoch: 2 })
    f.transport.control.mockResolvedValueOnce(f.host())
    await expect(f.api.control('tab1', 'takeover')).resolves.toBe(false)
    expect(f.state().inputReady).toBe(false)
    expect(f.state().humanTabId).toBeUndefined()
  })
  it('renews only the current visible local human epoch', async () => {
    const f = fixture()
    await human(f)
    await tick(1000)
    expect(f.transport.status.mock.calls.at(-1)?.[1]).toEqual({ epoch: 2, token: controlToken })
    expect(JSON.stringify(f.state())).not.toContain(controlToken)
    expect(f.state().status).not.toHaveProperty('controlToken')
    f.api.suspend('tab1')
    expect(f.state().inputReady).toBe(false)
    await tick(1500)
    expect(f.transport.status.mock.calls.at(-1)?.[1]).toBeUndefined()
    expect(f.transport.control).toHaveBeenLastCalledWith('release', 2, expect.any(AbortSignal), true, controlToken)
  })
  it('stops all polling while hidden, never stops apps, and returns read-only', async () => {
    const f = fixture()
    await human(f)
    f.api.setVisible('tab1', false)
    await tick()
    const calls = [f.transport.status.mock.calls.length, f.transport.frame.mock.calls.length]
    await tick(10000)
    expect([f.transport.status.mock.calls.length, f.transport.frame.mock.calls.length]).toEqual(calls)
    expect(f.transport.control.mock.calls.map(call => call[0])).toEqual(['takeover', 'release'])
    expect(f.state().frame).toBeUndefined()
    f.api.setVisible('tab1', true)
    await tick()
    expect(f.state().humanTabId).toBeUndefined()
    expect(f.transport.status.mock.calls.length).toBeGreaterThan(calls[0]!)
  })
  it('also suspends for a hidden browser page and releases URLs on disposal', async () => {
    const f = fixture()
    await human(f)
    const lastUrl = f.state().frame?.url
    f.controller.setPageVisible(false)
    expect(f.urls.revokeObjectURL).toHaveBeenCalledWith(lastUrl)
    const frameCalls = f.transport.frame.mock.calls.length
    await tick(2500)
    expect(f.transport.frame).toHaveBeenCalledTimes(frameCalls)
    await f.controller.dispose()
    expect(f.transport.control.mock.calls.some(call => call[0] === 'stop')).toBe(false)
    expect(f.api.input('tab1', { type: 'text', text: 'late' })).toBe(false)
  })
  it('does not forward another pane occurrence through the owner tab capability', async () => {
    const f = fixture()
    const second = new AbortController()
    f.api.mount('tab2', second.signal)
    f.api.setVisible('tab2', true)
    await human(f)
    f.loaded('tab2')
    expect(f.api.input('tab2', { type: 'click', x: 1, y: 1 })).toBe(false)
    expect(f.api.input('tab1', { type: 'click', x: 1, y: 1 })).toBe(true)
  })
  it('bounds preview polling to 2fps after the initial frame with no overlapping request', async () => {
    const f = fixture()
    await tick(2501)
    expect(f.transport.frame.mock.calls.length).toBeLessThanOrEqual(6)
    expect(f.transport.status.mock.calls.length).toBeLessThanOrEqual(2)
    const pending = deferred<Blob>()
    f.transport.frame.mockImplementationOnce(() => pending.promise)
    await tick(500)
    const count = f.transport.frame.mock.calls.length
    await tick(2000)
    expect(f.transport.frame.mock.calls.length).toBe(count)
    pending.resolve(png())
    await tick()
  })
})

describe('late responses and fail-closed input', () => {
  it('releases a takeover that completes after hide or window blur', async () => {
    const f = fixture()
    await tick()
    const pending = deferred<DesktopControlResult>()
    f.transport.control.mockImplementationOnce(() => pending.promise)
    const takeover = f.api.control('tab1', 'takeover')
    f.controller.suspend()
    f.setHost({ epoch: 2, owner: 'human' })
    pending.resolve({ ...f.host(), controlToken })
    await expect(takeover).resolves.toBe(false)
    expect(f.state().humanTabId).toBeUndefined()
    expect(f.transport.control).toHaveBeenLastCalledWith('release', 2, expect.any(AbortSignal), true, controlToken)
  })
  it('ignores a late status of an older epoch instead of restoring its owner', async () => {
    const f = fixture()
    await tick()
    const oldStatus = f.host()
    const read = deferred<DesktopStatus>()
    f.transport.status.mockImplementationOnce(() => read.promise)
    await tick(1500)
    await f.api.control('tab1', 'takeover')
    read.resolve(oldStatus)
    await tick()
    expect(f.state().status?.epoch).toBe(2)
    expect(f.state().humanTabId).toBe('tab1')
  })
  it('ignores stale-epoch frame failures from before a successful takeover', async () => {
    const f = fixture()
    const image = deferred<Blob>()
    f.transport.frame.mockImplementationOnce(() => image.promise)
    await tick()
    await f.api.control('tab1', 'takeover')
    image.reject(new DesktopRequestError('http', 'stale frame', undefined, 409))
    await tick()
    expect(f.state().humanTabId).toBe('tab1')
    expect(f.state().problem).toBeUndefined()
  })
  it('discards old queued input immediately when a control transition begins', async () => {
    const f = fixture()
    await human(f)
    const input = deferred<DesktopStatus>()
    f.transport.input.mockImplementationOnce(() => input.promise)
    const oldStatus = f.host()
    expect(f.api.input('tab1', { type: 'key', key: 'Control', down: true })).toBe(true)
    f.api.input('tab1', { type: 'click', x: 2, y: 2 })
    const pause = f.api.control('tab1', 'pause')
    expect(f.api.input('tab1', { type: 'text', text: 'not sent' })).toBe(false)
    await pause
    input.resolve(oldStatus)
    await tick()
    expect(f.transport.input).toHaveBeenCalledTimes(1)
    expect(f.state().status?.owner).toBe('none')
    expect(f.state().status?.epoch).toBe(3)
  })
  it('releases known held keys/buttons when preview focus moves within the tab', async () => {
    const f = fixture()
    await human(f)
    f.api.input('tab1', { type: 'key', key: 'Control', down: true })
    f.api.input('tab1', { type: 'button', button: 'left', down: true, x: 4, y: 5 })
    await tick()
    f.api.releaseHeld('tab1')
    await tick()
    expect(f.transport.input.mock.calls.map(call => call[1])).toContainEqual({ type: 'key', key: 'Control', down: false })
    expect(f.transport.input.mock.calls.map(call => call[1])).toContainEqual({ type: 'button', button: 'left', down: false })
    expect(f.state().humanTabId).toBe('tab1')
  })
  it('does not retry uncertain input, and a recovery poll never re-grants control', async () => {
    const f = fixture()
    await human(f)
    f.transport.input.mockRejectedValueOnce(new DesktopRequestError('network', 'connection lost'))
    f.api.input('tab1', { type: 'text', text: 'once only' })
    await tick(1500)
    expect(f.transport.input).toHaveBeenCalledTimes(1)
    expect(f.state().humanTabId).toBeUndefined()
    expect(f.api.input('tab1', { type: 'text', text: 'not granted' })).toBe(false)
  })
  it('fails closed on frame resolution mismatch', async () => {
    const f = fixture()
    await human(f)
    f.transport.frame.mockResolvedValueOnce(png(1920, 1080))
    await tick(500)
    expect(f.state().humanTabId).toBeUndefined()
    expect(f.state().problem?.kind).toBe('frame')
  })
  it('withdraws the grant on decoded image errors', async () => {
    const f = fixture()
    await human(f)
    f.api.frameFailed('tab1', f.state().frame!.url)
    expect(f.state().inputReady).toBe(false)
    expect(f.state().humanTabId).toBeUndefined()
  })
  it('ignores expired stop confirmations and requires the current epoch', async () => {
    const f = fixture()
    await tick()
    await expect(f.api.control('tab1', 'stop', 0)).resolves.toBe(false)
    expect(f.transport.control).not.toHaveBeenCalled()
    await expect(f.api.control('tab1', 'stop', 1)).resolves.toBe(true)
    expect(f.state().status?.state).toBe('stopped')
  })
  it('bounds the input queue and relinquishes human ownership on overflow', async () => {
    const f = fixture()
    await human(f)
    const pending = deferred<DesktopStatus>()
    const old = f.host()
    f.transport.input.mockImplementationOnce(() => pending.promise)
    f.api.input('tab1', { type: 'key', key: 'Shift', down: true })
    for (let i = 0; i < 100; i++) f.api.input('tab1', { type: 'text', text: String(i) })
    expect(f.state().humanTabId).toBeUndefined()
    expect(f.state().problem?.kind).toBe('input')
    pending.resolve(old)
    await tick()
    expect(f.transport.input).toHaveBeenCalledTimes(1)
  })
  it('uses a new connection baseline after Host restart but never restores old authority', async () => {
    const f = fixture()
    await human(f)
    f.controller.setConnection(undefined)
    expect(f.state().inputReady).toBe(false)
    f.setHost({ epoch: 0, state: 'stopped', owner: 'none' })
    f.controller.setConnection(2)
    await tick()
    expect(f.state().status?.epoch).toBe(0)
    expect(f.state().status?.state).toBe('stopped')
    expect(f.state().humanTabId).toBeUndefined()
  })
  it('aborts the tab lifecycle without ever stopping the backend', async () => {
    const f = fixture()
    await human(f)
    f.signal.abort()
    const count = f.transport.status.mock.calls.length
    await tick(5000)
    expect(f.transport.status).toHaveBeenCalledTimes(count)
    expect(f.transport.control.mock.calls.map(call => call[0])).toEqual(['takeover', 'release'])
  })
})
