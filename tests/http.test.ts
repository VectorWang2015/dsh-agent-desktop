import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopBroker } from '../src/broker.ts'
import { createHandler } from '../src/index.ts'
import type { DesktopBackend } from '../src/types.ts'

const servers: Server[] = []
const brokers: DesktopBroker[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise<void>((resolve, reject) => { s.close(error => error ? reject(error) : resolve()); s.closeAllConnections() })))
  await Promise.all(brokers.splice(0).map(b => b.dispose()))
})
async function fixture() {
  const input = vi.fn(async () => {})
  const backend: DesktopBackend = { start: async () => ({ display: ':99' }), frame: async () => ({ data: Buffer.from('png-fixture'), width: 1280, height: 800, timestamp: '2026-01-01T00:00:00Z' }), input, release: async () => {}, launch: async () => ({ id: 'a', pid: 1 }), stop: async () => {} }
  const broker = new DesktopBroker({ width: 1280, height: 800, humanLeaseMs: 10000, maxSessions: 1, frameCacheMs: 100, createBackend: () => backend })
  brokers.push(broker)
  const directory = vi.fn((id: string) => { if (id !== 'test-session') throw new Error('Unknown session'); return '/' })
  const handler = createHandler({ broker, width: 1280, height: 800, directory, stylePath: '/nonexistent', reject: req => req.headers.authorization === 'Bearer fixture-only' ? undefined : 401 })
  const server = createServer((req, res) => { void handler(req, res) })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  const base = `http://127.0.0.1:${address.port}/api/agent-desktop`
  const request = (path: string, payload?: unknown, capability?: string) => fetch(base + path, { method: payload ? 'POST' : 'GET', headers: { authorization: 'Bearer fixture-only', 'content-type': 'application/json', ...(capability ? { 'x-desktop-control': capability } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) })
  return { broker, input, directory, base, request }
}
describe('authenticated desktop routes', () => {
  it('admits before session lookup and rejects anonymous or cookie-name-only clients', async () => {
    const { base, directory } = await fixture()
    expect((await fetch(base + '/status?sessionId=test-session')).status).toBe(401)
    expect((await fetch(base + '/status?sessionId=test-session', { headers: { cookie: 'dsh-auth-fake=forged' } })).status).toBe(401)
    expect(directory).not.toHaveBeenCalled()
  })
  it('enforces server-side human ownership and stale epochs independently of UI', async () => {
    const { request, input } = await fixture()
    const initial = await (await request('/control', { sessionId: 'test-session', action: 'start' })).json()
    const action = { type: 'click', x: 12, y: 18 }
    expect((await request('/input', { sessionId: 'test-session', epoch: initial.epoch, action })).status).toBe(423)
    const human = await (await request('/control', { sessionId: 'test-session', action: 'takeover', expectedEpoch: initial.epoch })).json()
    expect((await request('/input', { sessionId: 'test-session', epoch: human.epoch, action })).status).toBe(403)
    expect((await request('/input', { sessionId: 'test-session', epoch: human.epoch, action }, human.controlToken)).status).toBe(200)
    expect(await (await request('/status?sessionId=test-session')).json()).not.toHaveProperty('controlToken')
    expect((await request(`/status?sessionId=test-session&human=true&epoch=${human.epoch}`)).status).toBe(403)
    expect(input).toHaveBeenCalledTimes(1)
    const paused = await (await request('/control', { sessionId: 'test-session', action: 'release', expectedEpoch: human.epoch }, human.controlToken)).json()
    expect(paused.owner).toBe('none')
    expect((await request('/input', { sessionId: 'test-session', epoch: human.epoch, action })).status).toBe(409)
    expect((await request(`/frame?sessionId=test-session&epoch=${paused.epoch}`)).headers.get('cache-control')).toBe('no-store')
    expect(input).toHaveBeenCalledTimes(1)
  })
  it('rejects missing control epochs and oversized or invalid action values', async () => {
    const { request } = await fixture()
    await request('/control', { sessionId: 'test-session', action: 'start' })
    expect((await request('/control', { sessionId: 'test-session', action: 'stop' })).status).toBe(400)
    expect((await request('/input', { sessionId: 'test-session', epoch: 1, action: { type: 'text', text: 'x'.repeat(4001) } })).status).toBe(400)
    expect((await request('/input', { sessionId: 'test-session', epoch: 1, action: { type: 'move', x: -1, y: 2 } })).status).toBe(400)
    expect((await request('/not-a-route')).status).toBe(404)
  })
})
