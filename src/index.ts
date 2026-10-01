import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment/types'
import Schema from 'schemastery'
import { homedir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { DesktopBroker } from './broker.ts'
import { captureObservation } from './observations.ts'
import { NativeBackend } from './native-backend.ts'
import { action, application, controlAction, DesktopError, desktopSize, epoch, object, probePoints, region, sessionId, windowId } from './validation.ts'

export const name = 'agent-desktop'
export const inject = ['tools', 'subprocess', 'sessions', 'sandboxPolicy']
export const Config = Schema.object({
  runtimeRoot: Schema.string().description('User-local runtime directory containing native.json.'),
  stateRoot: Schema.string().description('Private owned session state/log directory.'),
  width: Schema.natural().min(320).max(2560).default(1280),
  height: Schema.natural().min(240).max(1600).default(800),
  maxSessions: Schema.natural().min(1).max(4).default(2),
  humanLeaseMs: Schema.natural().min(3000).max(60000).default(10000),
  frameCacheMs: Schema.natural().min(100).max(2000).default(300),
  agentKeyHoldMs: Schema.natural().min(100).max(10000).default(1500).description('Maximum raw agent key hold; atomic press is recommended.'),
  startTerminal: Schema.boolean().default(true),
})
/** User-supplied Cordis configuration; the same-named schema validates deployment values. */
export interface Config { runtimeRoot?: string; stateRoot?: string; width?: number; height?: number; maxSessions?: number; humanLeaseMs?: number; frameCacheMs?: number; agentKeyHoldMs?: number; startTerminal?: boolean }

export function apply(ctx: Context, config: Config = {}): void {
  const runtimeRoot = config.runtimeRoot ?? fileURLToPath(new URL('../.runtime/', import.meta.url))
  const stateRoot = config.stateRoot ?? join(homedir(), '.local/state/dsh-agent-desktop')
  if (!isAbsolute(runtimeRoot) || !isAbsolute(stateRoot)) throw new Error('agent-desktop runtimeRoot/stateRoot must be absolute')
  const width = config.width ?? 1280, height = config.height ?? 800
  const broker = new DesktopBroker({
    width, height, maxSessions: config.maxSessions ?? 2, humanLeaseMs: config.humanLeaseMs ?? 10000, frameCacheMs: config.frameCacheMs ?? 300,
    createBackend: (_id, cwd, size) => new NativeBackend({ runtimeRoot, stateRoot, cwd, width: size.width, height: size.height, startTerminal: config.startTerminal ?? true, agentKeyHoldMs: config.agentKeyHoldMs ?? 1500, spawn: spec => ctx.subprocess.spawn(spec) }),
  })
  ctx.effect(() => () => broker.dispose(), 'agent-desktop.native-lifetime')
  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'idle') void broker.releaseAgentInput(String(agent.session.id)).catch(() => {})
  })
  const metadata = (exec: ToolRunContext, mutate: boolean) => {
    const session = exec.agent?.session
    if (!session?.header.cwd) throw new DesktopError('A live DSH session with a working directory is required', 'session-required', 400)
    if (mutate && ctx.sandboxPolicy.resolve({ session }).mode !== 'danger-full-access') throw new DesktopError('Host-native desktop actions require danger-full-access. 请在当前会话的权限/访问模式菜单中选择“完全权限”。No automatic escalation is performed.', 'permission-denied', 403)
    exec.signal.throwIfAborted()
    return { id: String(session.id), cwd: session.header.cwd }
  }
  const register = (definition: ToolDefinition) => ctx.tools.register(definition)
  const textOutput: ToolDefinition['output'] = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] }
  const params = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })
  const epochProperty = { type: 'integer', description: 'Current desktop epoch from status/screenshot; old epochs are rejected.' }
  register({
    name: 'desktop_start', description: 'Start this session’s private Linux desktop using host-installed software, not the user’s physical screen. Requires danger-full-access. Existing paused or human-owned desktops are not resumed by this tool.',
    parameters: params({ cwd: { type: 'string', description: 'Optional absolute initial directory; defaults to this DSH session directory.' }, width: { type: 'integer', description: 'Optional desktop width 320..2560. Supply together with height. Applied only to a new/stopped desktop; e.g. 1600 for drawing/IDE.' }, height: { type: 'integer', description: 'Optional height 240..1600, paired with width. Live desktops are never automatically resized.' } }), output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args), cwd = v.cwd ?? meta.cwd
      if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new DesktopError('cwd must be absolute', 'bad-cwd', 400)
      return broker.control(meta.id, 'start', cwd, undefined, exec.signal, desktopSize(v))
    },
  })
  register({
    name: 'desktop_status', description: 'Read this session’s desktop owner/epoch and refresh window focus, held input and tracked launch-process state. running describes the launch process, not all descendant GUI windows. No input control is acquired.',
    parameters: params({}), output: textOutput, async execute(_args, exec) { return broker.inspect(metadata(exec, false).id, exec.signal) },
  })
  register({
    name: 'desktop_action', description: 'Prefer press for one atomic down/up key or shortcut, e.g. {type:"press",key:"Enter"} or key:"s",modifiers:["Control"]. Raw key down:true HOLDS a key: pair immediately with down:false; agent holds suppress repeat and expire. Use release to clear only this worker’s held input. Observe first and use current epoch; paused/human control is not bypassed. text maps newline to Enter and tab to Tab, each paired, without clipboard sync.',
    parameters: params({ epoch: epochProperty, action: { type: 'object', description: 'move/click/button/scroll/press/key/release/text. Use press for single keys/shortcuts; key without down also means press. Explicit key down is an advanced hold, not a complete keystroke. Coordinates are absolute desktop pixels: apply screenshot offsets and multipliers for a crop/downscale. button needs down; text max 4000 UTF-16 characters.', properties: { type: { type: 'string', enum: ['move', 'click', 'button', 'scroll', 'press', 'key', 'release', 'text'] }, x: { type: 'number' }, y: { type: 'number' }, button: { type: 'string', enum: ['left', 'middle', 'right'] }, count: { type: 'integer', enum: [1, 2] }, deltaX: { type: 'number' }, deltaY: { type: 'number' }, key: { type: 'string' }, modifiers: { type: 'array', items: { type: 'string', enum: ['Control', 'Alt', 'Shift', 'Meta'] }, description: 'Atomic press modifiers; do not combine with raw down/up.' }, down: { type: 'boolean' }, text: { type: 'string' } }, required: ['type'], additionalProperties: false } }, ['epoch', 'action']), output: textOutput,
    async execute(args, exec) { const { id } = metadata(exec, true), v = object(args), current = broker.status(id); return broker.input(id, 'agent', epoch(v.epoch), action(v.action, current.width, current.height), exec.signal) },
  })
  register({
    name: 'desktop_launch', description: 'Launch an already-installed host executable in this session’s private desktop. Reuses existing application/development paths. Use argv, not a shell command. cwd selects the actual application working directory; relative file paths resolve there. Graphical routing env is reserved; single-instance apps may need a separate UI profile. Requires agent control and danger-full-access.',
    parameters: params({ epoch: epochProperty, command: { type: 'string' }, args: { type: 'array', items: { type: 'string' } }, cwd: { type: 'string' }, env: { type: 'object', additionalProperties: { type: 'string' } } }, ['epoch', 'command']), output: textOutput,
    async execute(args, exec) { const meta = metadata(exec, true), v = object(args); return broker.launch(meta.id, epoch(v.epoch), application(v, meta.cwd), exec.signal) },
  })
  register({
    name: 'desktop_stop', description: 'Stop only this session’s owned private desktop and its applications. Unsaved work is lost. Use only when the user requested stopping and confirm is true; refused during human ownership or pause. Closing the preview does not require this tool.',
    parameters: params({ epoch: epochProperty, confirm: { type: 'boolean', description: 'True only when stopping these applications is intended.' } }, ['epoch', 'confirm']), output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args)
      if (v.confirm !== true) throw new DesktopError('Explicit stop confirmation is required', 'confirmation-required', 400)
      if (broker.status(meta.id).owner !== 'agent') throw new DesktopError('Use the human desktop panel to stop a paused or human-owned session', 'not-owner', 423)
      return broker.control(meta.id, 'stop', meta.cwd, epoch(v.epoch), exec.signal)
    },
  })
  register({
    name: 'desktop_windows', description: 'Refresh this session’s managed windows, current X input focus, modal/transient hints, worker-held keys/buttons and exact launch-process states. Focusable is a hint, not proof that no application grab exists. Does not acquire control or capture the physical desktop.',
    parameters: params({}), output: textOutput,
    async execute(_args, exec) { return broker.inspect(metadata(exec, false).id, exec.signal) },
  })
  register({
    name: 'desktop_focus', description: 'Request normal window-manager activation for an id from a fresh desktop_windows result. Requires agent ownership and current epoch. Does not force focus past modal dialogs or defeat input grabs; inspect confirmed/current focus and capture again before typing.',
    parameters: params({ epoch: epochProperty, windowId: { type: 'integer' } }, ['epoch', 'windowId']), output: textOutput,
    async execute(args, exec) { const meta = metadata(exec, true), v = object(args); return broker.windowOperation(meta.id, epoch(v.epoch), 'focus', windowId(v.windowId), exec.signal) },
  })
  register({
    name: 'desktop_close_window', description: 'Ask one current managed window to close using WM_DELETE_WINDOW only. confirm=true means the user authorized that close and its unsaved-data risk. No process kill, no forced close, no automatic discard. The application may show a save dialog or close multiple documents; requested does not mean closed. Requires agent ownership.',
    parameters: params({ epoch: epochProperty, windowId: { type: 'integer' }, confirm: { type: 'boolean' } }, ['epoch', 'windowId', 'confirm']), output: textOutput,
    async execute(args, exec) { const meta = metadata(exec, true), v = object(args); if (v.confirm !== true) throw new DesktopError('Explicit window-close confirmation is required', 'confirmation-required', 400); return broker.windowOperation(meta.id, epoch(v.epoch), 'closeWindow', windowId(v.windowId), exec.signal) },
  })
  register({
    name: 'desktop_probe', description: 'Sample 1..32 absolute desktop-pixel points from one fresh private capture, without the synthetic pointer overlay. Returns RGBA, frame id and capture time. These are composited screen colors (alpha 255), NOT source-file/layer pixels; a few colors cannot prove visual semantics. Read-only even while paused/human-owned.',
    parameters: params({ epoch: epochProperty, points: { type: 'array', items: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false } } }, ['epoch', 'points']), output: textOutput,
    async execute(args, exec) { const { id } = metadata(exec, false), v = object(args), current = broker.status(id); const sampled = await broker.probe(id, epoch(v.epoch), probePoints(v.points, current.width, current.height), exec.signal); return { status: broker.status(id), ...sampled } },
  })
  ctx.inject(['attachments'], scope => {
    scope.tools.register({
      name: 'desktop_screenshot', description: 'Capture this private desktop, fresh by default, with frame id/time/cache flag. Optional region crops absolute desktop pixels; apply coordinate offsets AND multipliers before input. cursor=false excludes the synthetic pointer. Identical pixels/hashes may be correct for an unchanged screen. fresh=false permits the short UI cache. Works without a viewer and never acquires control.', parameters: params({ fresh: { type: 'boolean', description: 'Default true; false explicitly permits the frame cache.' }, cursor: { type: 'boolean', description: 'Default true; false removes the synthetic pointer overlay.' }, region: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } }, required: ['x', 'y', 'width', 'height'], additionalProperties: false } }),
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => {
          const result = object(value)
          return [{ type: 'text', text: JSON.stringify({ status: result.status, frame: result.frame, coordinates: result.coordinates }) }, { type: 'image', attachment: result.image as ImageAttachmentRef }]
        },
      },
      async execute(args, exec) {
        const { id } = metadata(exec, false), v = object(args), current = broker.status(id)
        if ((v.fresh !== undefined && typeof v.fresh !== 'boolean') || (v.cursor !== undefined && typeof v.cursor !== 'boolean')) throw new DesktopError('fresh/cursor must be boolean', 'bad-request', 400)
        const route = exec.agent?.session.requestHeader()?.config
        const provider = route?.provider ?? exec.agent?.options.provider, model = route?.model ?? exec.agent?.options.model
        const llm = scope.get('llm')
        if (!provider || !model || !llm || !(await llm.resolveModelInfo(provider, model, exec.signal)).inputModalities?.includes('image')) throw new DesktopError('Select an image-capable model before requesting a desktop screenshot', 'image-route-required', 400)
        return captureObservation(broker, id, frame => scope.attachments.saveImage({ data: frame.data, mediaType: 'image/png', name: 'agent-desktop.png' }), exec.signal, { fresh: v.fresh as boolean | undefined, cursor: v.cursor as boolean | undefined, region: region(v.region, current.width, current.height) })
      },
    })
  })
  ctx.inject(['webServer', 'connection'], scope => {
    const route = createHandler({ broker, width, height,
      reject: req => scope.connection.requestRejection(req),
      directory: id => {
        const attached = ctx.sessions.get(id as SessionId)
        if (!attached?.header.cwd) throw new DesktopError('Open this DSH session before using its desktop panel', 'session-not-loaded', 404)
        return attached.header.cwd
      },
      stylePath: fileURLToPath(new URL('./client.css', import.meta.url)),
    })
    scope.effect(() => scope.webServer.register({ kind: 'prefix', path: '/api/agent-desktop', handler: route }), 'agent-desktop.http')
  })
  ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({ name: 'agent-desktop', order: scope.systemPrompt.getSectionOrder('TOOL_COMPUTER_USE'), text: 'desktop_* tools operate your session’s independent host-native Linux display, not the user’s physical desktop. Use desktop_start, desktop_screenshot, then desktop_action with the latest epoch; check results from a fresh screenshot. Reuse host-installed tools via desktop_launch. A paused or human-owned desktop must stay untouched until the human explicitly resumes it. No sandbox: files, network and GPU resources are shared. Never bypass control ownership with shell, another DISPLAY or raw input API. Stop only with explicit intent because unsaved applications close. GUI profiles/single-instance apps need care. Prefer atomic press (including modifiers) over raw key holds; Return/Enter down:true alone is not a complete keystroke. release clears only our held input. Use desktop_windows/focus to diagnose activation; do not blindly double-click or force grabs. Close-window only sends a confirmed WM_DELETE request and may show save dialogs. Model screenshots are fresh by default and include capture time, id, crop offsets and scale. desktop_probe samples raw composited desktop RGB, not source-file pixels or semantic correctness. Screenshots may include a small green virtual-pointer marker.' }))
}

interface HandlerOptions { broker: DesktopBroker; width: number; height: number; reject: (req: IncomingMessage) => number | undefined; directory: (id: string) => string; stylePath: string }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new DesktopError('JSON content-type required', 'bad-content-type', 415)
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) { const data = Buffer.from(chunk); size += data.length; if (size > 65536) throw new DesktopError('Request body too large', 'body-too-large', 413); chunks.push(data) }
  try { return object(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (error) { if (error instanceof DesktopError) throw error; throw new DesktopError('Invalid JSON body', 'bad-json', 400) }
}
function json(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(value)) }

/** Exported for composition tests; every route admits before looking up any desktop. */
export function createHandler(options: HandlerOptions) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rejection = options.reject(req)
    if (rejection !== undefined) { json(res, rejection, { error: 'DSH authentication and same-origin access required', code: 'unauthorized' }); return }
    const abort = new AbortController()
    const disconnect = () => { if (!res.writableEnded) abort.abort(new Error('Client disconnected')) }
    res.once('close', disconnect)
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const route = url.pathname.slice('/api/agent-desktop'.length)
      const capability = typeof req.headers['x-desktop-control'] === 'string' ? req.headers['x-desktop-control'] : undefined
      if (route === '/style.css' && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' }); res.end(await readFile(options.stylePath)); return }
      if (route === '/status' && req.method === 'GET') {
        const id = sessionId(url.searchParams.get('sessionId')); options.directory(id)
        const humanEpoch = url.searchParams.get('human') === 'true' ? epoch(Number(url.searchParams.get('epoch'))) : undefined
        options.broker.status(id, humanEpoch, capability)
        json(res, 200, await options.broker.inspect(id, abort.signal)); return
      }
      if (route === '/frame' && req.method === 'GET') {
        const id = sessionId(url.searchParams.get('sessionId')); options.directory(id)
        const expected = epoch(Number(url.searchParams.get('epoch')))
        const frame = await options.broker.frame(id, expected, abort.signal)
        res.writeHead(200, { 'content-type': 'image/png', 'content-length': frame.data.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(frame.data); return
      }
      if (route === '/control' && req.method === 'POST') {
        const v = await body(req), id = sessionId(v.sessionId), cwd = options.directory(id), operation = controlAction(v.action)
        if (operation !== 'start' && v.expectedEpoch === undefined) throw new DesktopError('Refresh status and supply expectedEpoch', 'bad-epoch', 400)
        if (operation === 'release' && options.broker.status(id).owner === 'human') options.broker.assertHuman(id, epoch(v.expectedEpoch), capability)
        json(res, 200, await options.broker.control(id, operation, cwd, v.expectedEpoch === undefined ? undefined : epoch(v.expectedEpoch), abort.signal, operation === 'start' ? desktopSize(v) : undefined)); return
      }
      if (route === '/input' && req.method === 'POST') {
        const v = await body(req), id = sessionId(v.sessionId); options.directory(id)
        const current = options.broker.status(id)
        const status = await options.broker.input(id, 'human', epoch(v.epoch), action(v.action, current.width, current.height), abort.signal, capability)
        json(res, 200, { ok: true, status }); return
      }
      json(res, 404, { error: 'Unknown desktop endpoint', code: 'not-found' })
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(res, error instanceof DesktopError ? error.httpStatus : 500, { error: error instanceof Error ? error.message : String(error), code: error instanceof DesktopError ? error.code : 'desktop-error' })
    } finally { res.removeListener('close', disconnect) }
  }
}
