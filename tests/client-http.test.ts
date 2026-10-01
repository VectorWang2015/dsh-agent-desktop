import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesktopTransport } from '../src/client/http.ts'
import type { DesktopStatus } from '../src/types.ts'

const status: DesktopStatus = { sessionId: 's1', state: 'running', owner: 'human', epoch: 7,
  backend: 'native-x11', width: 1280, height: 720 }
const token = 'test-capability-not-in-json'
const signal = (): AbortSignal => new AbortController().signal
const json = (value: unknown, code = 200): Response => new Response(JSON.stringify(value), {
  status: code, headers: { 'Content-Type': 'application/json' },
})

afterEach(() => { vi.useRealTimers() })

describe('authenticated Host image/JSON carrier', () => {
  it('binds status to its session and only renews an explicitly supplied human epoch', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(status))
    const api = createDesktopTransport('s1', fetcher)
    await api.status(signal())
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/agent-desktop/status?sessionId=s1')
    await api.status(signal(), { epoch: 7, token })
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual({ 'X-Desktop-Control': token })
    expect(String(fetcher.mock.calls[1]?.[0])).not.toContain(token)
    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/agent-desktop/status?sessionId=s1&epoch=7&human=true')
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
  })
  it('sends JSON session/epoch for control and input and never includes a viewer URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(status)).mockResolvedValueOnce(json({ ok: true, status }))
    const api = createDesktopTransport('s1', fetcher)
    await api.control('takeover', 6, signal())
    await api.input(7, { type: 'text', text: '你好' }, signal(), token)
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ 'X-Desktop-Control': token })
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ sessionId: 's1', action: 'takeover', expectedEpoch: 6 })
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ sessionId: 's1', epoch: 7, action: { type: 'text', text: '你好' } })
  })
  it('keeps release bounded and uses browser keepalive for view loss', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ ...status, owner: 'none', epoch: 8 }))
    await createDesktopTransport('s1', fetcher).control('release', 7, signal(), true, token)
    expect(fetcher.mock.calls[0]?.[1]?.keepalive).toBe(true)
  })
  it('rejects stale/unauthorized frames as JSON errors and does not retry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ error: 'stale epoch', status: { ...status, epoch: 8 } }, 409))
    await expect(createDesktopTransport('s1', fetcher).frame(7, signal())).rejects.toMatchObject({ httpStatus: 409, status: { epoch: 8 } })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('only accepts image/png and adds a distinct cache-busting query', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(new Uint8Array([137, 80]), { headers: { 'Content-Type': 'image/png' } }))
      .mockResolvedValueOnce(new Response('not png', { headers: { 'Content-Type': 'text/html' } }))
    const api = createDesktopTransport('s1', fetcher)
    const result = await api.frame(7, signal())
    expect(result.type).toBe('image/png')
    await expect(api.frame(7, signal())).rejects.toMatchObject({ kind: 'frame' })
    const first = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost')
    const second = new URL(String(fetcher.mock.calls[1]?.[0]), 'http://localhost')
    expect(first.searchParams.get('epoch')).toBe('7')
    expect(first.searchParams.get('t')).not.toBe(second.searchParams.get('t'))
  })
  it('refuses cross-session JSON and acknowledgements without ok:true', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ...status, sessionId: 's2' }))
      .mockResolvedValueOnce(json({ status }))
    const api = createDesktopTransport('s1', fetcher)
    await expect(api.status(signal())).rejects.toMatchObject({ kind: 'protocol' })
    await expect(api.input(7, { type: 'key', key: 'Enter', down: true }, signal(), token)).rejects.toMatchObject({ kind: 'protocol' })
  })
  it('bounds declared frame and streamed JSON sizes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('x', {
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(33 * 1024 * 1024) },
    })).mockResolvedValueOnce(new Response('x'.repeat(513 * 1024)))
    const api = createDesktopTransport('s1', fetcher)
    await expect(api.frame(7, signal())).rejects.toMatchObject({ kind: 'protocol' })
    await expect(api.status(signal())).rejects.toMatchObject({ kind: 'protocol' })
  })
  it('forwards cancellation and times out without replaying an uncertain mutation', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(init.signal?.reason) }, { once: true })
    }))
    const api = createDesktopTransport('s1', fetcher)
    const timeout = expect(api.input(7, { type: 'button', button: 'left', down: true }, signal(), token)).rejects.toMatchObject({ kind: 'network' })
    await vi.advanceTimersByTimeAsync(8000)
    await timeout
    expect(fetcher).toHaveBeenCalledTimes(1)
    const abort = new AbortController()
    const cancelled = expect(api.status(abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
    abort.abort()
    await cancelled
  })
})
