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
import { action, application, controlAction, DesktopError, epoch, object, sessionId } from './validation.ts'

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
  startTerminal: Schema.boolean().default(true),
})
/** User-supplied Cordis configuration; the same-named schema validates deployment values. */
export interface Config { runtimeRoot?: string; stateRoot?: string; width?: number; height?: number; maxSessions?: number; humanLeaseMs?: number; frameCacheMs?: number; startTerminal?: boolean }

export function apply(ctx: Context, config: Config = {}): void {
  const runtimeRoot = config.runtimeRoot ?? fileURLToPath(new URL('../.runtime/', import.meta.url))
  const stateRoot = config.stateRoot ?? join(homedir(), '.local/state/dsh-agent-desktop')
  if (!isAbsolute(runtimeRoot) || !isAbsolute(stateRoot)) throw new Error('agent-desktop runtimeRoot/stateRoot must be absolute')
  const width = config.width ?? 1280, height = config.height ?? 800
  const broker = new DesktopBroker({
    width, height, maxSessions: config.maxSessions ?? 2, humanLeaseMs: config.humanLeaseMs ?? 10000, frameCacheMs: config.frameCacheMs ?? 300,
    createBackend: (_id, cwd) => new NativeBackend({ runtimeRoot, stateRoot, cwd, width, height, startTerminal: config.startTerminal ?? true, spawn: spec => ctx.subprocess.spawn(spec) }),
  })
  ctx.effect(() => () => broker.dispose(), 'agent-desktop.native-lifetime')
  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'idle') void broker.releaseAgentInput(String(agent.session.id)).catch(() => {})
  })
  const metadata = (exec: ToolRunContext, mutate: boolean) => {
    const session = exec.agent?.session
    if (!session?.header.cwd) throw new DesktopError('A live DSH session with a working directory is required', 'session-required', 400)
    if (mutate && ctx.sandboxPolicy.resolve({ session }).mode !== 'danger-full-access') throw new DesktopError('Host-native desktop actions require danger-full-access; change the session permission explicitly. No automatic escalation is performed.', 'permission-denied', 403)
    exec.signal.throwIfAborted()
    return { id: String(session.id), cwd: session.header.cwd }
  }
  const register = (definition: ToolDefinition) => ctx.tools.register(definition)
  const textOutput: ToolDefinition['output'] = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] }
  const params = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })
  const epochProperty = { type: 'integer', description: 'Current desktop epoch from status/screenshot; old epochs are rejected.' }
  register({
    name: 'desktop_start', description: 'Start this session’s private Linux desktop using host-installed software, not the user’s physical screen. Requires danger-full-access. Existing paused or human-owned desktops are not resumed by this tool.',
    parameters: params({ cwd: { type: 'string', description: 'Optional absolute initial directory; defaults to this DSH session directory.' } }), output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args), cwd = v.cwd ?? meta.cwd
      if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new DesktopError('cwd must be absolute', 'bad-cwd', 400)
      return broker.control(meta.id, 'start', cwd, undefined, exec.signal)
    },
  })
  register({
    name: 'desktop_status', description: 'Read this session’s owned background desktop status, geometry and input owner. Reading status does not acquire input control.',
    parameters: params({}), output: textOutput, async execute(_args, exec) { return broker.status(metadata(exec, false).id) },
  })
  register({
    name: 'desktop_action', description: 'Send one bounded input action to this session’s private desktop, using the current epoch. Never drives the physical user desktop. Observe a screenshot first. Rejects paused/human control; do not retry to bypass that refusal. text inserts literal text without host clipboard synchronization.',
    parameters: params({ epoch: epochProperty, action: { type: 'object', description: 'move/click/button/scroll/key/text. Coordinates in desktop pixels; apply screenshot coordinate multipliers if the attachment was downscaled. key uses browser names (Control, Enter, ArrowLeft); key/button require down boolean. text max 4000 characters.', properties: { type: { type: 'string', enum: ['move', 'click', 'button', 'scroll', 'key', 'text'] }, x: { type: 'number' }, y: { type: 'number' }, button: { type: 'string', enum: ['left', 'middle', 'right'] }, count: { type: 'integer', enum: [1, 2] }, deltaX: { type: 'number' }, deltaY: { type: 'number' }, key: { type: 'string' }, down: { type: 'boolean' }, text: { type: 'string' } }, required: ['type'], additionalProperties: false } }, ['epoch', 'action']), output: textOutput,
    async execute(args, exec) { const { id } = metadata(exec, true), v = object(args); return broker.input(id, 'agent', epoch(v.epoch), action(v.action, width, height), exec.signal) },
  })
  register({
    name: 'desktop_launch', description: 'Launch an already-installed host executable in this session’s private desktop. Reuses existing application/development paths. Use argv, not a shell command. Graphical routing env is reserved; single-instance apps may need a separate UI profile. Requires agent control and danger-full-access.',
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
  ctx.inject(['attachments'], scope => {
    scope.tools.register({
      name: 'desktop_screenshot', description: 'Capture a fresh image of this session’s private desktop, including its virtual pointer, with dimensions and epoch. Works with the viewer closed. Does not capture the physical user screen or acquire control.', parameters: params({}),
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => {
          const result = object(value)
          return [{ type: 'text', text: JSON.stringify({ status: result.status, coordinates: result.coordinates }) }, { type: 'image', attachment: result.image as ImageAttachmentRef }]
        },
      },
      async execute(_args, exec) {
        const { id } = metadata(exec, false)
        const route = exec.agent?.session.requestHeader()?.config
        const provider = route?.provider ?? exec.agent?.options.provider, model = route?.model ?? exec.agent?.options.model
        const llm = scope.get('llm')
        if (!provider || !model || !llm || !(await llm.resolveModelInfo(provider, model, exec.signal)).inputModalities?.includes('image')) throw new DesktopError('Select an image-capable model before requesting a desktop screenshot', 'image-route-required', 400)
        return captureObservation(broker, id, frame => scope.attachments.saveImage({ data: frame.data, mediaType: 'image/png', name: 'agent-desktop.png' }), exec.signal)
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
  ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({ name: 'agent-desktop', order: scope.systemPrompt.getSectionOrder('TOOL_COMPUTER_USE'), text: 'desktop_* tools operate your session’s independent host-native Linux display, not the user’s physical desktop. Use desktop_start, desktop_screenshot, then desktop_action with the latest epoch; check results from a fresh screenshot. Reuse host-installed tools via desktop_launch. A paused or human-owned desktop must stay untouched until the human explicitly resumes it. No sandbox: files, network and GPU resources are shared. Never bypass control ownership with shell, another DISPLAY or raw input API. Stop only with explicit intent because unsaved applications close. GUI profiles/single-instance apps need care. Screenshots contain a small green virtual-pointer marker.' }))
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
        json(res, 200, options.broker.status(id, humanEpoch, capability)); return
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
        json(res, 200, await options.broker.control(id, operation, cwd, v.expectedEpoch === undefined ? undefined : epoch(v.expectedEpoch), abort.signal)); return
      }
      if (route === '/input' && req.method === 'POST') {
        const v = await body(req), id = sessionId(v.sessionId); options.directory(id)
        const status = await options.broker.input(id, 'human', epoch(v.epoch), action(v.action, options.width, options.height), abort.signal, capability)
        json(res, 200, { ok: true, status }); return
      }
      json(res, 404, { error: 'Unknown desktop endpoint', code: 'not-found' })
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(res, error instanceof DesktopError ? error.httpStatus : 500, { error: error instanceof Error ? error.message : String(error), code: error instanceof DesktopError ? error.code : 'desktop-error' })
    } finally { res.removeListener('close', disconnect) }
  }
}
