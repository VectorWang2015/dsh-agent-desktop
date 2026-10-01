/** Session-owned preview, polling, and local human capability; React owns none of this lifetime. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ControlAction, DesktopAction, DesktopStatus } from '../types.ts'
import type { DesktopTransport } from './http.ts'
import { DesktopRequestError, pngSize } from './protocol.ts'

/** Visible frame metadata contains only an owned object URL, never backend credentials. */
export interface PreviewFrame {
  readonly url: string
  readonly epoch: number
  readonly width: number
  readonly height: number
  readonly receivedAt: number
}

/** Private observable exposed through the framework's inject.hooks compartment. */
export interface DesktopViewState {
  readonly status: DesktopStatus | undefined
  readonly frame: PreviewFrame | undefined
  readonly connected: boolean
  readonly watching: boolean
  readonly checkedAt: number | undefined
  readonly pending: ControlAction | undefined
  readonly humanTabId: string | undefined
  readonly inputReady: boolean
  readonly problem: { readonly kind: 'network' | 'http' | 'protocol' | 'frame' | 'input'; readonly detail: string } | undefined
}

interface View {
  visible: boolean
  readonly signal: AbortSignal
  readonly detach: () => void
  loadedEpoch: number | undefined
  loadedAt: number
}
interface QueuedInput { readonly tabId: string; readonly epoch: number; readonly action: DesktopAction }

const statusInterval = 1500
const frameInterval = 500
const maxFreshAge = 5000
const maxPendingInput = 64

/** Callbacks/data only; components do not receive a controller or a service object. */
export interface DesktopInjected {
  readonly hooks: { readonly desktopState: HostObservable<DesktopViewState> }
  mount(tabId: string, signal: AbortSignal): () => void
  setVisible(tabId: string, visible: boolean): void
  refresh(): void
  control(tabId: string, action: ControlAction, expectedEpoch?: number): Promise<boolean>
  input(tabId: string, action: DesktopAction): boolean
  releaseHeld(tabId: string): void
  suspend(tabId: string): void
  frameLoaded(tabId: string, url: string, width: number, height: number): void
  frameFailed(tabId: string, url: string): void
}

/** Owns one DSH session, including several pane occurrences without sharing an input grant. */
export class DesktopController {
  private readonly state = createSnapshotStore<DesktopViewState>({ status: undefined, frame: undefined,
    connected: false, watching: false, checkedAt: undefined, pending: undefined, humanTabId: undefined,
    inputReady: false, problem: undefined })
  private readonly views = new Map<string, View>()
  private readonly tasks = new Set<Promise<unknown>>()
  private readonly requests = new Set<AbortController>()
  private readonly keys = new Set<string>()
  private readonly buttons = new Set<'left' | 'middle' | 'right'>()
  private queue: QueuedInput[] = []
  private inputRunning = false
  private grant: { tabId: string; epoch: number; acquiredAt: number; token: string } | undefined
  private interactionRevision = 0
  private pendingTab: string | undefined
  private connection: number | undefined
  private generation = 0
  private pageVisible = true
  private disposed = false
  private disposal: Promise<void> | undefined
  private sequence = 0
  private acceptedSequence = 0
  private loop: AbortController | undefined
  private statusTimer: ReturnType<typeof setTimeout> | undefined
  private frameTimer: ReturnType<typeof setTimeout> | undefined
  private frameRunning = false
  private lastMoveAt = -Infinity
  private pendingControl = false

  readonly injected: DesktopInjected

  constructor(readonly sessionId: string, private readonly transport: DesktopTransport,
    private readonly objectUrls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL) {
    this.injected = {
      hooks: { desktopState: this.state },
      mount: (id, signal) => this.mount(id, signal),
      setVisible: (id, visible) => this.setVisible(id, visible),
      refresh: () => this.refresh(),
      control: (id, action, epoch) => this.track(this.control(id, action, epoch)),
      input: (id, action) => this.input(id, action),
      releaseHeld: id => this.releaseHeld(id),
      suspend: id => this.suspend(id),
      frameLoaded: (id, url, width, height) => this.frameLoaded(id, url, width, height),
      frameFailed: (id, url) => {
        if (!this.views.has(id) || this.state.getSnapshot().frame?.url !== url) return
        this.fail(new DesktopRequestError('frame', 'The preview image could not be decoded'))
      },
    }
  }

  /** Connection replacement withdraws local authority and requires a fresh status baseline. */
  setConnection(id: number | undefined): void {
    if (this.disposed || id === this.connection) return
    this.suspend()
    this.stopPolling()
    this.connection = id
    this.generation++
    this.acceptedSequence = 0
    this.clearFrame()
    this.publish({ connected: id !== undefined, status: undefined, checkedAt: undefined })
    this.reconcilePolling()
  }

  /** Browser-tab visibility complements the framework's sidebar-tab visibility. */
  setPageVisible(visible: boolean): void {
    if (this.disposed || visible === this.pageVisible) return
    this.pageVisible = visible
    if (!visible) this.suspend()
    this.reconcilePolling()
  }

  /** Window/root blur releases human ownership; it never stops or resumes the desktop. */
  suspend(tabId?: string): void {
    const grant = this.grant
    if (tabId === undefined || grant?.tabId === tabId || this.pendingTab === tabId) this.interactionRevision++
    if (grant === undefined || (tabId !== undefined && grant.tabId !== tabId)) return
    this.withdrawGrant()
    this.track(this.releaseEpoch(grant.epoch, grant.token))
  }

  /** Stop local resources and await in-flight work; only an explicit control command can stop Host apps. */
  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.suspend()
    this.disposed = true
    this.stopPolling()
    for (const request of this.requests) request.abort()
    for (const [id, view] of this.views) { view.signal.removeEventListener('abort', view.detach); this.views.delete(id) }
    this.clearFrame()
    this.disposal = Promise.allSettled([...this.tasks]).then(() => {})
    return this.disposal
  }

  private track<T>(task: Promise<T>): Promise<T> {
    this.tasks.add(task)
    void task.then(() => { this.tasks.delete(task) }, () => { this.tasks.delete(task) })
    return task
  }

  private publish(patch: Partial<DesktopViewState>): void {
    if (this.disposed) return
    const next = { ...this.state.getSnapshot(), ...patch, humanTabId: this.grant?.tabId }
    this.state.set({ ...next, inputReady: this.grant !== undefined && this.canInput(this.grant.tabId, next) })
  }

  private mount(tabId: string, signal: AbortSignal): () => void {
    if (this.disposed || signal.aborted) return () => {}
    this.views.get(tabId)?.detach()
    const view: View = { visible: false, signal, loadedEpoch: undefined, loadedAt: 0, detach: () => {
      if (this.views.get(tabId) !== view) return
      this.suspend(tabId)
      signal.removeEventListener('abort', view.detach)
      this.views.delete(tabId)
      this.reconcilePolling()
    } }
    this.views.set(tabId, view)
    signal.addEventListener('abort', view.detach, { once: true })
    return view.detach
  }

  private setVisible(tabId: string, visible: boolean): void {
    const view = this.views.get(tabId)
    if (view === undefined || this.disposed) return
    view.visible = visible
    if (!visible) { view.loadedEpoch = undefined; this.suspend(tabId) }
    this.reconcilePolling()
  }

  private active(): boolean {
    return !this.disposed && this.connection !== undefined && this.pageVisible
      && [...this.views.values()].some(view => view.visible && !view.signal.aborted)
  }

  private canInput(tabId: string, state = this.state.getSnapshot()): boolean {
    const view = this.views.get(tabId)
    const status = state.status
    const now = Date.now()
    return this.active() && view?.visible === true && !view.signal.aborted && state.pending === undefined
      && this.grant?.tabId === tabId && this.grant.epoch === status?.epoch
      && status?.state === 'running' && status.owner === 'human'
      && state.checkedAt !== undefined && now - state.checkedAt <= maxFreshAge
      && state.frame?.epoch === status.epoch && now - state.frame.receivedAt <= maxFreshAge
      && view.loadedEpoch === status.epoch && now - view.loadedAt <= maxFreshAge
  }

  private reconcilePolling(): void {
    if (!this.active()) {
      this.stopPolling()
      this.clearFrame()
      this.publish({ watching: false })
      return
    }
    if (this.loop !== undefined) { this.publish({}); return }
    this.loop = new AbortController()
    this.publish({ watching: true })
    this.scheduleStatus(0, this.loop)
  }

  private stopPolling(): void {
    this.loop?.abort()
    this.loop = undefined
    clearTimeout(this.statusTimer)
    clearTimeout(this.frameTimer)
    this.statusTimer = undefined
    this.frameTimer = undefined
  }

  private refresh(): void {
    if (!this.active()) return
    // Re-pull does not restore a lost grant. The user must explicitly take over again.
    this.stopPolling()
    this.reconcilePolling()
  }

  private scheduleStatus(delay: number, loop: AbortController): void {
    if (this.loop !== loop || loop.signal.aborted) return
    clearTimeout(this.statusTimer)
    this.statusTimer = setTimeout(() => {
      this.statusTimer = undefined
      this.track(this.pollStatus(loop))
    }, delay)
  }

  private async pollStatus(loop: AbortController): Promise<void> {
    const sequence = ++this.sequence
    try {
      const snapshot = this.state.getSnapshot()
      const currentGrant = this.grant
      if (currentGrant !== undefined && Date.now() - currentGrant.acquiredAt > maxFreshAge
        && !this.canInput(currentGrant.tabId, snapshot)) this.suspend(currentGrant.tabId)
      const grant = this.grant
      const human = grant !== undefined && this.views.get(grant.tabId)?.visible === true
        ? { epoch: grant.epoch, token: grant.token } : undefined
      const status = await this.transport.status(loop.signal, human)
      if (this.loop !== loop || loop.signal.aborted) return
      if (this.accept(status, sequence)) this.publish({ problem: undefined })
      this.scheduleFrame(0, loop)
    } catch (error) {
      if (this.loop === loop && !loop.signal.aborted && sequence >= this.acceptedSequence) this.fail(error)
    } finally {
      this.scheduleStatus(statusInterval, loop)
    }
  }

  private scheduleFrame(delay: number, loop: AbortController): void {
    if (this.loop !== loop || loop.signal.aborted || this.frameTimer !== undefined || this.frameRunning
      || this.state.getSnapshot().status?.state !== 'running') return
    this.frameTimer = setTimeout(() => { this.frameTimer = undefined; this.track(this.pollFrame(loop)) }, delay)
  }

  private async pollFrame(loop: AbortController): Promise<void> {
    const status = this.state.getSnapshot().status
    if (status?.state !== 'running' || this.loop !== loop) return
    this.frameRunning = true
    try {
      const blob = await this.transport.frame(status.epoch, loop.signal)
      const size = await pngSize(blob)
      if (this.loop !== loop || loop.signal.aborted) return
      const current = this.state.getSnapshot().status
      if (current?.epoch !== status.epoch || current.state !== 'running') return
      if (size.width !== current.width || size.height !== current.height) {
        throw new DesktopRequestError('frame', 'PNG dimensions do not match the fixed desktop resolution')
      }
      const previous = this.state.getSnapshot().frame
      const frame = { url: this.objectUrls.createObjectURL(blob), epoch: current.epoch, ...size, receivedAt: Date.now() }
      this.publish({ frame })
      if (previous !== undefined) this.objectUrls.revokeObjectURL(previous.url)
    } catch (error) {
      if (this.loop === loop && !loop.signal.aborted && this.state.getSnapshot().status?.epoch === status.epoch) this.fail(error)
    } finally {
      this.frameRunning = false
      // An aborted old request can settle after a newly visible tab restarted the loop.
      if (this.loop !== undefined) this.scheduleFrame(frameInterval, this.loop)
    }
  }

  private frameLoaded(tabId: string, url: string, width: number, height: number): void {
    const frame = this.state.getSnapshot().frame
    const view = this.views.get(tabId)
    if (view === undefined || frame?.url !== url || !view.visible) return
    if (width !== frame.width || height !== frame.height) {
      this.fail(new DesktopRequestError('frame', 'Decoded image dimensions do not match the desktop'))
      return
    }
    view.loadedEpoch = frame.epoch
    view.loadedAt = Date.now()
    this.publish({})
  }

  private clearFrame(): void {
    const frame = this.state.getSnapshot().frame
    if (frame !== undefined) this.objectUrls.revokeObjectURL(frame.url)
    for (const view of this.views.values()) view.loadedEpoch = undefined
    this.publish({ frame: undefined })
  }

  private accept(status: DesktopStatus, sequence: number): boolean {
    const current = this.state.getSnapshot().status
    if (this.disposed || status.sessionId !== this.sessionId || (current !== undefined &&
      (status.epoch < current.epoch || (status.epoch === current.epoch && sequence < this.acceptedSequence)))) return false
    this.acceptedSequence = sequence
    if (current !== undefined && current.epoch === status.epoch
      && (current.width !== status.width || current.height !== status.height)) this.suspend()
    if (this.grant !== undefined && (status.epoch !== this.grant.epoch || status.owner !== 'human' || status.state !== 'running')) {
      this.withdrawGrant()
    }
    if (current?.epoch !== status.epoch || current.width !== status.width || current.height !== status.height
      || status.state !== 'running') this.clearFrame()
    this.publish({ status, checkedAt: Date.now() })
    return true
  }

  private withdrawGrant(): void {
    this.grant = undefined
    this.queue = []
    this.keys.clear()
    this.buttons.clear()
    this.publish({})
  }

  private async releaseEpoch(epoch: number, token: string): Promise<void> {
    const generation = this.generation
    const sequence = ++this.sequence
    // This bounded keepalive survives component disposal; Host TTL covers network failure.
    try {
      const { controlToken: _discarded, ...status } = await this.transport.control('release', epoch, new AbortController().signal, true, token)
      if (generation === this.generation) this.accept(status, sequence)
    } catch (error) {
      if (!this.disposed && generation === this.generation && error instanceof DesktopRequestError && error.status !== undefined) {
        this.accept(error.status, sequence)
      }
    }
  }

  private async control(tabId: string, action: ControlAction, expectedEpoch?: number): Promise<boolean> {
    const before = this.state.getSnapshot()
    const view = this.views.get(tabId)
    if (!this.active() || view?.visible !== true || this.pendingControl || before.status === undefined
      || before.checkedAt === undefined || Date.now() - before.checkedAt > maxFreshAge) return false
    if (expectedEpoch !== undefined && expectedEpoch !== before.status.epoch) return false
    if (action === 'release' && this.grant?.tabId !== tabId) return false
    const token = action === 'release' ? this.grant?.token : undefined
    const epoch = before.status.epoch
    const generation = this.generation
    const request = new AbortController()
    const sequence = ++this.sequence
    const interactionRevision = this.interactionRevision
    this.requests.add(request)
    this.pendingControl = true
    this.pendingTab = tabId
    // The transition releases Host-held input. Stop forwarding synchronously before POST.
    this.withdrawGrant()
    this.publish({ pending: action, problem: undefined })
    try {
      const { controlToken, ...status } = await this.transport.control(action, epoch, request.signal, false, token)
      if (generation !== this.generation) return false
      if (this.disposed || !this.active() || this.views.get(tabId) !== view || !view.visible
        || (action === 'takeover' && interactionRevision !== this.interactionRevision)) {
        if (action === 'takeover' && status.owner === 'human' && controlToken !== undefined) await this.releaseEpoch(status.epoch, controlToken)
        return false
      }
      const accepted = this.accept(status, sequence)
      if (action === 'takeover') {
        if (!accepted || status.owner !== 'human' || status.state !== 'running' || status.epoch <= epoch || controlToken === undefined) {
          throw new DesktopRequestError('protocol', 'Takeover was not confirmed with a new human capability')
        }
        this.grant = { tabId, epoch: status.epoch, acquiredAt: Date.now(), token: controlToken }
      }
      if (this.loop !== undefined) this.scheduleFrame(0, this.loop)
      return accepted
    } catch (error) {
      if (!this.disposed && generation === this.generation && !request.signal.aborted) this.fail(error)
      return false
    } finally {
      this.requests.delete(request)
      this.pendingControl = false
      this.pendingTab = undefined
      this.publish({ pending: undefined })
    }
  }

  private input(tabId: string, action: DesktopAction): boolean {
    if (!this.canInput(tabId) || this.grant === undefined) return false
    if (action.type === 'move') {
      const now = Date.now()
      if (now - this.lastMoveAt < 50) return false
      this.lastMoveAt = now
      const last = this.queue.at(-1)
      if (last?.action.type === 'move') this.queue.pop()
    }
    if (this.queue.length >= maxPendingInput) {
      this.suspend(tabId)
      this.publish({ problem: { kind: 'input', detail: '' } })
      return false
    }
    if (action.type === 'key') { if (action.down) this.keys.add(action.key); else this.keys.delete(action.key) }
    if (action.type === 'button') { if (action.down) this.buttons.add(action.button); else this.buttons.delete(action.button) }
    this.queue.push({ tabId, epoch: this.grant.epoch, action })
    if (!this.inputRunning) this.track(this.drainInput())
    return true
  }

  private async drainInput(): Promise<void> {
    this.inputRunning = true
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!
        if (!this.canInput(item.tabId) || this.grant?.epoch !== item.epoch) { this.suspend(item.tabId); break }
        const request = new AbortController()
        const sequence = ++this.sequence
        const generation = this.generation
        this.requests.add(request)
        try {
          const status = await this.transport.input(item.epoch, item.action, request.signal, this.grant.token)
          if (generation === this.generation) this.accept(status, sequence)
        } catch (error) {
          if (!this.disposed && !request.signal.aborted && generation === this.generation
            && this.state.getSnapshot().status?.epoch === item.epoch) this.fail(error)
          break
        } finally { this.requests.delete(request) }
      }
    } finally { this.inputRunning = false }
  }

  private releaseHeld(tabId: string): void {
    if (this.grant?.tabId !== tabId) return
    const keys = [...this.keys]
    const buttons = [...this.buttons]
    this.queue = []
    this.keys.clear()
    this.buttons.clear()
    for (const key of keys) this.input(tabId, { type: 'key', key, down: false })
    for (const button of buttons) this.input(tabId, { type: 'button', button, down: false })
    if (!this.canInput(tabId)) this.suspend(tabId)
  }

  private fail(error: unknown): void {
    if (error instanceof DesktopRequestError && error.status !== undefined) this.accept(error.status, ++this.sequence)
    this.suspend()
    this.publish({ problem: { kind: error instanceof DesktopRequestError ? error.kind : 'network',
      detail: error instanceof Error ? error.message : '' } })
  }
}
