/** Same-origin DSH-authenticated image/JSON transport; mutations are never retried. */
import type { ControlAction, DesktopAction, DesktopControlResult, DesktopStatus } from '../types.ts'
import { DesktopRequestError, parseControlResult, parseHttpError, parseStatus } from './protocol.ts'

/** A session-bound transport owned by the React-free controller. */
export interface DesktopTransport {
  status(signal: AbortSignal, human?: { readonly epoch: number; readonly token: string }): Promise<DesktopStatus>
  frame(epoch: number, signal: AbortSignal): Promise<Blob>
  control(action: ControlAction, expectedEpoch: number | undefined, signal: AbortSignal, keepalive?: boolean,
    token?: string): Promise<DesktopControlResult>
  input(epoch: number, action: DesktopAction, signal: AbortSignal, token: string): Promise<DesktopStatus>
}

const base = '/api/agent-desktop'
const maxFrameBytes = 32 * 1024 * 1024
const maxJsonBytes = 512 * 1024

async function boundedBody(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const announced = Number(response.headers.get('content-length'))
  if (announced > maxBytes) {
    await response.body?.cancel()
    throw new DesktopRequestError('protocol', 'Desktop response exceeds the byte limit')
  }
  if (response.body === null) throw new DesktopRequestError('protocol', 'Empty desktop response')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new DesktopRequestError('protocol', 'Desktop response exceeds the byte limit')
      }
      chunks.push(part.value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const part of chunks) { result.set(part, offset); offset += part.byteLength }
  return result
}

/**
 * Bind the Host path to the slot's session, not a globally selected conversation.
 * @param fetcher - browser Fetch carrier (tests supply a deterministic fake).
 * @returns callbacks that use same-origin cookies and refuse redirects.
 */
export function createDesktopTransport(sessionId: string, fetcher: typeof fetch): DesktopTransport {
  let frameSequence = 0
  const request = async <T>(path: string, options: RequestInit, signal: AbortSignal,
    consume: (response: Response) => Promise<T>): Promise<T> => {
    const controller = new AbortController()
    const abort = (): void => { controller.abort(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    const timer = setTimeout(() => { controller.abort(new Error('Desktop request timed out')) }, options.keepalive ? 2500 : 8000)
    try {
      const response = await fetcher(`${base}${path}`, {
        ...options, signal: controller.signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      })
      return await consume(response)
    } catch (error) {
      if (error instanceof DesktopRequestError || signal.aborted) throw error
      throw new DesktopRequestError('network', error instanceof Error ? error.message : 'Desktop request failed')
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
  }
  const json = async (response: Response): Promise<unknown> => {
    const bytes = await boundedBody(response, maxJsonBytes)
    let value: unknown
    try { value = JSON.parse(new TextDecoder().decode(bytes)) } catch (error) {
      throw new DesktopRequestError('protocol', error instanceof Error ? error.message : 'Invalid desktop JSON')
    }
    if (!response.ok) throw parseHttpError(value, sessionId, response.status)
    return value
  }
  const post = (path: string, payload: object, signal: AbortSignal, keepalive = false, token?: string): Promise<unknown> => request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token === undefined ? {} : { 'X-Desktop-Control': token }) },
    body: JSON.stringify({ sessionId, ...payload }), keepalive,
  }, signal, json)
  return {
    status: (signal, human) => {
      const query = new URLSearchParams({ sessionId })
      if (human !== undefined) { query.set('epoch', String(human.epoch)); query.set('human', 'true') }
      return request(`/status?${query}`, {
        headers: human === undefined ? {} : { 'X-Desktop-Control': human.token },
      }, signal, async response => parseStatus(await json(response), sessionId))
    },
    frame: (epoch, signal) => request(`/frame?${new URLSearchParams({
      sessionId, epoch: String(epoch), t: `${Date.now()}-${++frameSequence}`,
    })}`, {}, signal, async response => {
      if (!response.ok) { await json(response); throw new DesktopRequestError('frame', 'Frame request failed') }
      if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'image/png') {
        await response.body?.cancel()
        throw new DesktopRequestError('frame', 'Desktop frame is not a PNG')
      }
      return new Blob([await boundedBody(response, maxFrameBytes)], { type: 'image/png' })
    }),
    control: async (action, expectedEpoch, signal, keepalive, token) => parseControlResult(await post('/control', {
      action, ...(expectedEpoch === undefined ? {} : { expectedEpoch }),
    }, signal, keepalive, token), sessionId),
    input: async (epoch, action, signal, token) => {
      const response = await post('/input', { epoch, action }, signal, false, token)
      if (typeof response !== 'object' || response === null || !('ok' in response) || response.ok !== true || !('status' in response)) {
        throw new DesktopRequestError('protocol', 'Invalid input acknowledgement')
      }
      return parseStatus(response.status, sessionId)
    },
  }
}
