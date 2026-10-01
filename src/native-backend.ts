import { access, mkdir, mkdtemp, readFile, rm, open } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { ApplicationRequest, DesktopAction, DesktopBackend, Frame, NativePaths } from './types.ts'
import { DesktopError, object } from './validation.ts'

export type Spawn = (spec: SubprocessSpawnSpec) => SubprocessHandle
interface BackendOptions {
  runtimeRoot: string
  stateRoot: string
  cwd: string
  width: number
  height: number
  startTerminal: boolean
  spawn: Spawn
  workerPath?: string
}
interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  detach: () => void
}
const MAX_LINE = 24 * 1024 * 1024

export async function readNativePaths(root: string): Promise<NativePaths> {
  let value: Record<string, unknown>
  try { value = object(JSON.parse(await readFile(join(root, 'native.json'), 'utf8'))) }
  catch { throw new DesktopError(`Native runtime is not configured at ${root}. Run the documented setup-native command first.`, 'runtime-missing', 503) }
  for (const key of ['python', 'xvfb'] as const) {
    if (typeof value[key] !== 'string' || !isAbsolute(value[key])) throw new DesktopError(`Invalid runtime executable: ${key}`, 'runtime-invalid', 503)
    await access(value[key], constants.X_OK)
  }
  for (const key of ['windowManager', 'terminal', 'libraryPath', 'binaryPath', 'dataDirs'] as const) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') throw new DesktopError(`Invalid runtime field: ${key}`, 'runtime-invalid', 503)
  }
  if (value.windowManagerArgs !== undefined && (!Array.isArray(value.windowManagerArgs) || value.windowManagerArgs.some(v => typeof v !== 'string'))) throw new DesktopError('Invalid window manager argv', 'runtime-invalid', 503)
  return {
    python: value.python as string, xvfb: value.xvfb as string,
    ...(typeof value.windowManager === 'string' ? { windowManager: value.windowManager } : {}),
    ...(Array.isArray(value.windowManagerArgs) ? { windowManagerArgs: value.windowManagerArgs as string[] } : {}),
    ...(typeof value.dataDirs === 'string' ? { dataDirs: value.dataDirs } : {}),
    ...(typeof value.terminal === 'string' ? { terminal: value.terminal } : {}),
    ...(typeof value.libraryPath === 'string' ? { libraryPath: value.libraryPath } : {}),
    ...(typeof value.binaryPath === 'string' ? { binaryPath: value.binaryPath } : {}),
    ...(typeof value.selkies === 'string' ? { selkies: value.selkies } : {}),
  }
}

/** Child-only stdio protocol: there is no unauthenticated native input HTTP port. */
export class NativeBackend implements DesktopBackend {
  private handle?: SubprocessHandle
  private counter = 0
  private readonly pending = new Map<number, Pending>()
  private buffer = ''
  private intentionalStop = false
  private failed = false
  private exitHandler?: (error: Error) => void
  private paths?: NativePaths
  private stateDir?: string
  constructor(private readonly options: BackendOptions) {}
  onExit(handler: (error: Error) => void): void { this.exitHandler = handler }
  async start(signal?: AbortSignal): Promise<{ display: string }> {
    signal?.throwIfAborted()
    this.paths = await readNativePaths(this.options.runtimeRoot)
    await mkdir(this.options.stateRoot, { recursive: true, mode: 0o700 })
    const stateDir = this.stateDir = await mkdtemp(join(this.options.stateRoot, 'desktop-'))
    const worker = this.options.workerPath ?? fileURLToPath(new URL('../runtime/desktop_worker.py', import.meta.url))
    const env: NodeJS.ProcessEnv = {
      PYTHONUNBUFFERED: '1', PYTHONNOUSERSITE: '1', PYTHONPATH: undefined, PYTHONHOME: undefined,
      LD_PRELOAD: undefined, LD_LIBRARY_PATH: undefined,
    }
    this.handle = this.options.spawn({
      argv: [this.paths.python, '-u', worker], cwd: this.options.cwd,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: 16_384 } }, graceMs: 5000, env,
    })
    if (!this.handle.stdout || !this.handle.stdin) throw new Error('Native runtime requires local stdio pipes')
    this.handle.stdin.on('error', error => this.exited(error))
    this.handle.stdout.on('error', error => this.exited(error))
    this.handle.stdout.setEncoding('utf8')
    this.handle.stdout.on('data', (data: string) => this.consume(data))
    void this.handle.done.then(outcome => this.exited(new Error(`Desktop worker exited (${outcome.exitCode ?? outcome.signal})`)), error => this.exited(error instanceof Error ? error : new Error(String(error))))
    const result = object(await this.call('start', { config: { paths: this.paths, stateDir, cwd: this.options.cwd, width: this.options.width, height: this.options.height, startTerminal: this.options.startTerminal } }, signal, 25_000))
    if (typeof result.display !== 'string' || !/^:\d+$/.test(result.display)) throw new Error('Worker did not return its owned display')
    return { display: result.display }
  }
  private exited(error: Error): void {
    if (this.failed) return
    this.failed = true
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.detach(); p.reject(error) }
    this.pending.clear()
    if (!this.intentionalStop) {
      this.handle?.terminate()
      this.exitHandler?.(error)
    }
  }
  private consume(chunk: string): void {
    this.buffer += chunk
    if (this.buffer.length > MAX_LINE) { this.handle?.terminate(); this.exited(new Error('Native response exceeded byte limit')); return }
    let index: number
    while ((index = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1)
      let response: Record<string, unknown>
      try { response = object(JSON.parse(line)) } catch { this.handle?.terminate(); this.exited(new Error('Invalid desktop worker protocol')); return }
      const p = this.pending.get(Number(response.id))
      if (!p) continue
      this.pending.delete(Number(response.id)); clearTimeout(p.timer); p.detach()
      if (response.ok === true) p.resolve(response.result)
      else p.reject(new Error(typeof response.error === 'string' ? response.error : 'Native operation failed'))
    }
  }
  private call(op: string, payload: Record<string, unknown> = {}, signal?: AbortSignal, timeout = 15_000): Promise<unknown> {
    signal?.throwIfAborted()
    const handle = this.handle
    if (this.failed || !handle?.stdin || handle.stdin.destroyed) return Promise.reject(new Error('Desktop worker is unavailable'))
    const id = ++this.counter
    return new Promise((resolve, reject) => {
      const abort = () => {
        if (!handle.stdin?.destroyed) handle.stdin?.write(JSON.stringify({ op: 'cancel', id }) + '\n', error => { if (error) this.exited(error) })
      }
      const timer = setTimeout(() => {
        this.pending.delete(id); signal?.removeEventListener('abort', abort)
        handle.terminate()
        const diagnostic = handle.collected.stderr?.readFrom(0).text.slice(-2000) ?? ''
        reject(new Error(`Native ${op} timed out; desktop stopped to prevent late input${diagnostic ? '\n' + diagnostic : ''}`))
      }, timeout)
      const detach = () => signal?.removeEventListener('abort', abort)
      this.pending.set(id, { resolve: value => { if (signal?.aborted) reject(signal.reason instanceof Error ? signal.reason : new Error('Cancelled')); else resolve(value) }, reject, timer, detach })
      signal?.addEventListener('abort', abort, { once: true })
      handle.stdin!.write(JSON.stringify({ id, op, ...payload }) + '\n', error => {
        if (!error) return
        const p = this.pending.get(id)
        if (p) { this.pending.delete(id); clearTimeout(p.timer); p.detach(); p.reject(error) }
      })
    })
  }
  async frame(signal?: AbortSignal): Promise<Frame> {
    const result = object(await this.call('frame', {}, signal))
    if (result.imageFile !== 'frame.png' || !this.stateDir) throw new Error('Worker returned no owned PNG frame')
    const file = await open(join(this.stateDir, 'frame.png'), constants.O_RDONLY | constants.O_NOFOLLOW)
    let data: Buffer
    try {
      const info = await file.stat()
      if (!info.isFile() || info.size < 24 || info.size > 16 * 1024 * 1024) throw new Error('Invalid or oversized owned frame file')
      data = await file.readFile()
    } finally { await file.close() }
    if (data.length > 16 * 1024 * 1024 || data.length < 24 || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid or oversized desktop frame')
    const width = data.readUInt32BE(16), height = data.readUInt32BE(20)
    if (width !== this.options.width || height !== this.options.height) throw new Error('Desktop resolution changed unexpectedly; input remains fixed')
    const windows = Array.isArray(result.windows) ? result.windows.slice(0, 32).flatMap(value => { const w = object(value); return typeof w.title === 'string' && Number.isSafeInteger(w.id) ? [{ id: w.id as number, title: w.title.slice(0, 250) }] : [] }) : []
    return { data, width, height, timestamp: new Date().toISOString(), windows }
  }
  async input(action: DesktopAction, signal?: AbortSignal): Promise<void> { await this.call('input', { action }, signal) }
  async release(): Promise<void> { await this.call('release') }
  async launch(request: ApplicationRequest, signal?: AbortSignal): Promise<{ id: string; pid: number }> {
    const result = object(await this.call('launch', { request }, signal))
    if (typeof result.id !== 'string' || !Number.isSafeInteger(result.pid)) throw new Error('Invalid application launch response')
    return { id: result.id, pid: result.pid as number }
  }
  async stop(): Promise<void> {
    this.intentionalStop = true
    if (!this.handle) return
    try { await this.call('stop', {}, undefined, 6000) } catch { /* The managed termination below is the final cleanup path. */ }
    this.handle.terminate()
    const stopped = await this.handle.waitForExit(AbortSignal.timeout(8000))
    if (!stopped) throw new Error('Desktop worker did not stop within the cleanup budget')
    await this.handle.done.catch(() => {})
    if (this.stateDir) await rm(join(this.stateDir, 'Xauthority'), { force: true })
    this.handle = undefined
  }
}
