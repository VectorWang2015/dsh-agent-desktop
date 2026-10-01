import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { ApplicationRequest, ControlAction, DesktopAction, DesktopBackend, DesktopControlResult, DesktopInventory, DesktopSize, DesktopStatus, Frame, FrameOptions, PixelProbe, WindowOperation } from './types.ts'
import { DesktopError, sessionId as validateSessionId } from './validation.ts'

export interface BrokerOptions {
  width: number
  height: number
  maxSessions: number
  humanLeaseMs: number
  frameCacheMs: number
  createBackend: (id: string, cwd: string, size: DesktopSize) => DesktopBackend
  now?: () => number
}
interface RecordState {
  status: DesktopStatus
  backend?: DesktopBackend
  tail: Promise<unknown>
  startAbort?: AbortController
  inputAbort?: AbortController
  controlToken?: string
  humanUntil: number
  frame?: Frame
  frameAt: number
}

/** Owns one input domain per DSH session. UI viewing never owns the native lifetime. */
export class DesktopBroker {
  private readonly records = new Map<string, RecordState>()
  private readonly now: () => number
  private disposed = false
  private readonly leaseTimer: ReturnType<typeof setInterval>
  constructor(private readonly options: BrokerOptions) {
    this.now = options.now ?? Date.now
    this.leaseTimer = setInterval(() => { void this.expireLeases() }, Math.min(1000, options.humanLeaseMs))
    this.leaseTimer.unref?.()
  }
  private get(id: string): RecordState {
    validateSessionId(id)
    let record = this.records.get(id)
    if (!record) {
      record = { status: { sessionId: id, state: 'stopped', owner: 'none', epoch: 0, backend: 'native-x11', width: this.options.width, height: this.options.height }, tail: Promise.resolve(), humanUntil: 0, frameAt: 0 }
      this.records.set(id, record)
    }
    return record
  }
  status(id: string, humanEpoch?: number, capability?: string): DesktopStatus {
    const r = this.get(id)
    if (humanEpoch !== undefined) {
      this.assertHuman(id, humanEpoch, capability)
      r.humanUntil = this.now() + this.options.humanLeaseMs
    }
    return structuredClone(r.status)
  }
  assertHuman(id: string, expected: number, capability?: string): void {
    const r = this.get(id)
    this.checkEpoch(r, expected)
    if (!capability || !/^[A-Za-z0-9_-]{32}$/.test(capability) || !r.controlToken || !timingSafeEqual(Buffer.from(capability), Buffer.from(r.controlToken))) throw new DesktopError('This viewer has no human input capability; explicitly take over', 'not-controller', 403)
    if (r.status.owner !== 'human' || r.humanUntil <= this.now()) throw new DesktopError('Human input lease expired; take over again', 'lease-expired', 423)
  }
  private queue<T>(r: RecordState, work: () => Promise<T>): Promise<T> {
    const p = r.tail.then(work, work)
    r.tail = p.catch(() => {})
    return p
  }
  private checkEpoch(r: RecordState, expected?: number): void {
    if (expected !== undefined && expected !== r.status.epoch) throw new DesktopError('The desktop changed; refresh status and observe again', 'stale-epoch')
  }
  private requireOwner(r: RecordState, owner: 'agent' | 'human', expected: number): DesktopBackend {
    if (this.disposed) throw new DesktopError('Plugin is shutting down', 'disposed', 503)
    this.checkEpoch(r, expected)
    if (r.status.state !== 'running' || !r.backend) throw new DesktopError('The desktop is not running', 'not-running')
    if (r.status.owner !== owner) throw new DesktopError(`Desktop input belongs to ${r.status.owner}; do not retry until explicitly resumed`, 'not-owner', 423)
    if (owner === 'human' && r.humanUntil <= this.now()) throw new DesktopError('Human input lease expired; take over again', 'lease-expired', 423)
    return r.backend
  }
  /** Invalidates old input immediately; succeeds only after the old queue and held keys settle. */
  async control(id: string, operation: ControlAction, cwd: string, expectedEpoch?: number, signal?: AbortSignal, size?: DesktopSize): Promise<DesktopControlResult> {
    if (this.disposed && operation !== 'stop') throw new DesktopError('Plugin is shutting down', 'disposed', 503)
    signal?.throwIfAborted()
    const r = this.get(id)
    this.checkEpoch(r, expectedEpoch)
    if (operation === 'start') {
      const requestedSize = size ?? { width: r.status.width, height: r.status.height }
      if (!Number.isInteger(requestedSize.width) || !Number.isInteger(requestedSize.height) || requestedSize.width < 320 || requestedSize.width > 2560 || requestedSize.height < 240 || requestedSize.height > 1600) throw new DesktopError('Invalid desktop dimensions', 'bad-size', 400)
      if (r.status.state === 'running' || r.status.state === 'starting') {
        if (size && (size.width !== r.status.width || size.height !== r.status.height)) throw new DesktopError('Live desktop resizing is not supported; save work and explicitly stop first. Human/paused ownership is not bypassed.', 'already-running')
        return this.status(id)
      }
      if (r.status.state === 'stopping') throw new DesktopError('Wait for the desktop to stop', 'stopping')
      const count = [...this.records.values()].filter(v => v !== r && (v.backend || ['starting', 'running', 'stopping'].includes(v.status.state))).length
      if (count >= this.options.maxSessions) throw new DesktopError('Maximum active desktops reached; stop an owned desktop first', 'session-limit')
      const startEpoch = ++r.status.epoch
      r.status.width = requestedSize.width; r.status.height = requestedSize.height
      r.status.windows = []; r.status.applications = []
      delete r.status.lastFrameAt; delete r.status.lastActionAt; delete r.status.observedAt; delete r.status.inspectionError; delete r.status.input
      r.status.focusedWindowId = null; r.status.activeWindowId = null
      r.status.state = 'starting'
      r.status.owner = 'none'
      r.controlToken = undefined
      r.humanUntil = 0
      delete r.status.error
      delete r.status.display
      r.frame = undefined
      r.startAbort = new AbortController()
      const startingSignal = signal ? AbortSignal.any([signal, r.startAbort.signal]) : r.startAbort.signal
      return this.queue(r, async () => {
        if (r.backend) {
          try { await r.backend.stop() } catch (error) {
            r.status.state = 'error'; r.status.error = 'Previous desktop cleanup failed; refusing a replacement'; r.startAbort = undefined
            throw error
          }
          r.backend = undefined
        }
        if (startingSignal.aborted) {
          if (r.status.state !== 'stopping') { r.status.state = 'stopped'; r.status.owner = 'none' }
          r.startAbort = undefined
          startingSignal.throwIfAborted()
        }
        let backend: DesktopBackend
        try { backend = this.options.createBackend(id, cwd, requestedSize) } catch (error) {
          r.status.state = 'error'; r.status.error = error instanceof Error ? error.message : String(error); r.startAbort = undefined
          throw error
        }
        r.backend = backend
        backend.onExit?.(error => {
          if (r.backend !== backend || r.status.state === 'stopping' || r.status.state === 'stopped') return
          r.startAbort?.abort(error)
          r.controlToken = undefined; r.humanUntil = 0
          r.status.owner = 'none'; r.status.epoch += 1; r.status.state = 'error'; r.status.error = error.message; r.frame = undefined
          r.status.applications = r.status.applications?.map(app => ({ ...app, running: false }))
        })
        try {
          const info = await backend.start(startingSignal)
          startingSignal.throwIfAborted()
          if (r.status.state !== 'stopping') r.status.state = 'running'
          r.status.display = info.display
          r.status.startedAt = new Date(this.now()).toISOString()
          r.status.applications = []
          if (r.status.epoch === startEpoch) r.status.owner = 'agent'
          return this.status(id)
        } catch (error) {
          let cleanupFailed = false
          try { await backend.stop(); r.backend = undefined } catch { cleanupFailed = true }
          if (r.status.state !== 'stopping') {
            r.status.state = 'error'; r.status.owner = 'none'; r.status.error = cleanupFailed ? 'Startup and cleanup failed; owned backend retained for cleanup' : (error instanceof Error ? error.message : String(error))
          }
          throw error
        } finally { r.startAbort = undefined }
      })
    }
    if (operation !== 'stop' && !['running', 'starting'].includes(r.status.state)) throw new DesktopError('Start the desktop first', 'not-running')
    const controlEpoch = ++r.status.epoch
    r.inputAbort?.abort(new Error('Input cancelled by desktop control transition'))
    r.status.owner = 'none'
    r.humanUntil = 0
    r.controlToken = undefined
    r.frame = undefined
    if (operation === 'stop') {
      r.status.state = 'stopping'
      r.startAbort?.abort(new Error('Desktop stopped during startup'))
    }
    return this.queue(r, async () => {
      if (operation === 'stop') {
        await r.backend?.stop()
        r.backend = undefined
        r.frame = undefined
        r.status.state = 'stopped'; r.status.owner = 'none'
        delete r.status.display
        delete r.status.error
        r.status.windows = []
        r.status.applications = []
        r.status.input = { heldKeys: [], heldButtons: [] }
        r.status.focusedWindowId = null; r.status.activeWindowId = null
        delete r.status.inspectionError
      } else {
        try { await r.backend?.release(); r.status.input = { ...r.status.input, heldKeys: [], heldButtons: [] } } catch (error) {
          r.status.state = 'error'; r.status.error = 'Could not release held input; desktop remains disabled'
          await r.backend?.stop().catch(() => {})
          throw error
        }
        if (r.status.epoch === controlEpoch && r.status.state === 'running') {
          if (operation === 'takeover') { r.status.owner = 'human'; r.humanUntil = this.now() + this.options.humanLeaseMs; r.controlToken = randomBytes(24).toString('base64url') }
          else if (operation === 'resume') r.status.owner = 'agent'
        }
      }
      return { ...this.status(id), ...(operation === 'takeover' && r.status.epoch === controlEpoch && r.controlToken ? { controlToken: r.controlToken } : {}) }
    })
  }
  async input(id: string, owner: 'agent' | 'human', expected: number, action: DesktopAction, signal?: AbortSignal, capability?: string): Promise<DesktopStatus> {
    const r = this.get(id)
    this.requireOwner(r, owner, expected)
    if (owner === 'human') this.assertHuman(id, expected, capability)
    return this.queue(r, async () => {
      signal?.throwIfAborted()
      const backend = this.requireOwner(r, owner, expected)
      if (owner === 'human') this.assertHuman(id, expected, capability)
      const operation = new AbortController()
      r.inputAbort = operation
      const inputSignal = signal ? AbortSignal.any([signal, operation.signal]) : operation.signal
      try {
        await backend.input(action, inputSignal, owner)
        inputSignal.throwIfAborted()
        r.status.lastActionAt = new Date(this.now()).toISOString()
        r.frame = undefined
        return this.status(id)
      } catch (error) {
        try { await backend.release() }
        catch (releaseError) {
          // Never keep an input lease after an unconfirmed release. Quarantine
          // only this owned backend; retain it if its cleanup cannot finish.
          r.status.owner = 'none'; r.status.epoch++; r.controlToken = undefined; r.humanUntil = 0
          r.status.state = 'error'; r.frame = undefined
          r.status.error = `Input release could not be confirmed: ${releaseError instanceof Error ? releaseError.message : String(releaseError)}`
          try {
            await backend.stop()
            if (r.backend === backend) r.backend = undefined
            r.status.windows = []; r.status.input = { heldKeys: [], heldButtons: [] }
            r.status.focusedWindowId = null; r.status.activeWindowId = null
            r.status.applications = r.status.applications?.map(app => ({ ...app, running: false }))
          } catch (cleanupError) { r.status.error += `; cleanup still required: ${String(cleanupError)}` }
        }
        throw error
      } finally {
        if (r.inputAbort === operation) r.inputAbort = undefined
      }
    })
  }
  async frame(id: string, expected?: number, signal?: AbortSignal, options: FrameOptions = {}): Promise<Frame> {
    const r = this.get(id)
    this.checkEpoch(r, expected)
    return this.queue(r, async () => {
      signal?.throwIfAborted()
      this.checkEpoch(r, expected)
      if (r.status.state !== 'running' || !r.backend) throw new DesktopError('No active desktop to capture', 'not-running')
      const cacheable = options.region === undefined && options.cursor !== false
      if (cacheable && !options.fresh && r.frame && this.now() - r.frameAt < this.options.frameCacheMs) return { ...r.frame, cached: true }
      const result = await r.backend.frame(signal, options)
      this.checkEpoch(r, expected)
      if (cacheable) { r.frame = result; r.frameAt = this.now() }
      r.status.lastFrameAt = result.timestamp
      if (result.inventory) this.installInventory(r, result.inventory)
      else if (result.windows) r.status.windows = result.windows
      return { ...result, cached: false }
    })
  }
  private installInventory(r: RecordState, inventory: DesktopInventory): void {
    r.status.applications = inventory.applications
    r.status.windows = inventory.windows
    r.status.focusedWindowId = inventory.focusedWindowId
    r.status.activeWindowId = inventory.activeWindowId
    r.status.observedAt = inventory.observedAt
    r.status.input = inventory.input
    delete r.status.inspectionError
  }
  /** Refresh launch-process/window facts; reading never acquires control. */
  async inspect(id: string, signal?: AbortSignal): Promise<DesktopStatus> {
    const r = this.get(id)
    if (r.status.state !== 'running' || !r.backend?.inspect) return this.status(id)
    const expected = r.status.epoch, backend = r.backend
    return this.queue(r, async () => {
      signal?.throwIfAborted()
      if (r.status.state !== 'running' || r.backend !== backend || r.status.epoch !== expected) return this.status(id)
      try {
        const inventory = await backend.inspect!(signal)
        if (r.backend === backend && r.status.epoch === expected && r.status.state === 'running') this.installInventory(r, inventory)
      } catch (error) {
        if (signal?.aborted) throw error
        r.status.inspectionError = error instanceof Error ? error.message : String(error)
      }
      return this.status(id)
    })
  }
  async probe(id: string, expected: number, points: Array<{ x: number; y: number }>, signal?: AbortSignal): Promise<PixelProbe> {
    const r = this.get(id)
    this.checkEpoch(r, expected)
    return this.queue(r, async () => {
      signal?.throwIfAborted(); this.checkEpoch(r, expected)
      if (r.status.state !== 'running' || !r.backend?.probe) throw new DesktopError('No running pixel-probe backend', 'not-running')
      const result = await r.backend.probe(points, signal)
      signal?.throwIfAborted(); this.checkEpoch(r, expected)
      return result
    })
  }
  async windowOperation(id: string, expected: number, operation: 'focus' | 'closeWindow', windowId: number, signal?: AbortSignal): Promise<{ status: DesktopStatus; result: WindowOperation }> {
    const r = this.get(id)
    this.requireOwner(r, 'agent', expected)
    return this.queue(r, async () => {
      signal?.throwIfAborted()
      const backend = this.requireOwner(r, 'agent', expected)
      const method = backend[operation]
      if (!method) throw new DesktopError('Window operation is not supported', 'unsupported', 501)
      const abort = new AbortController()
      r.inputAbort = abort
      const combined = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal
      try {
        const result = await method.call(backend, windowId, combined)
        combined.throwIfAborted(); this.checkEpoch(r, expected)
        r.frame = undefined
        r.status.lastActionAt = new Date(this.now()).toISOString()
        if (backend.inspect) {
          try { this.installInventory(r, await backend.inspect(combined)) }
          catch (error) { if (combined.aborted) throw error; r.status.inspectionError = error instanceof Error ? error.message : String(error) }
        }
        combined.throwIfAborted(); this.checkEpoch(r, expected)
        return { status: this.status(id), result }
      } finally {
        if (r.inputAbort === abort) r.inputAbort = undefined
      }
    })
  }
  async launch(id: string, expected: number, request: ApplicationRequest, signal?: AbortSignal): Promise<DesktopStatus> {
    const r = this.get(id)
    this.requireOwner(r, 'agent', expected)
    return this.queue(r, async () => {
      signal?.throwIfAborted()
      const backend = this.requireOwner(r, 'agent', expected)
      const app = await backend.launch(request, signal)
      r.status.applications = [...(r.status.applications ?? []).slice(-31), { ...app, command: request.command, running: true }]
      return this.status(id)
    })
  }
  async releaseAgentInput(id: string): Promise<void> {
    const r = this.records.get(id)
    if (!r || r.status.owner !== 'agent' || r.status.state !== 'running') return
    const expected = r.status.epoch
    await this.queue(r, async () => {
      if (r.status.epoch === expected && r.status.owner === 'agent' && r.status.state === 'running') await r.backend?.release()
    })
  }
  async expireLeases(): Promise<void> {
    await Promise.all([...this.records.entries()].filter(([, r]) => r.status.owner === 'human' && r.humanUntil <= this.now()).map(async ([id, r]) => {
      await this.control(id, 'release', '/', r.status.epoch).catch(() => {})
    }))
  }
  async dispose(): Promise<void> {
    this.disposed = true
    clearInterval(this.leaseTimer)
    const active = [...this.records.entries()].filter(([, r]) => r.backend || r.status.state === 'starting')
    await Promise.allSettled(active.map(([id]) => this.control(id, 'stop', '/')))
    this.disposed = true
  }
}
