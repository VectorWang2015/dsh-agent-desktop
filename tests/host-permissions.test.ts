import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import * as plugin from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  vi.restoreAllMocks()
})

async function boot(initialMode = 'read-only') {
  const ctx = new Context()
  contexts.push(ctx)
  const tools = new Map<string, ToolDefinition>()
  let mode = initialMode
  const spawn = vi.fn(() => { throw new Error('Unit tests must not launch native workers') })
  const resolve = vi.fn(() => ({ mode }))
  // Real Cordis activation with narrow services; no GUI, process, runtime or live profile access.
  ctx.provide('tools', { register(definition: ToolDefinition) { tools.set(definition.name, definition); return () => tools.delete(definition.name) } } as never)
  ctx.provide('sessions', {} as never)
  ctx.provide('subprocess', { spawn } as never)
  ctx.provide('sandboxPolicy', { resolve } as never)
  const fiber = ctx.plugin(plugin)
  await fiber.await()
  const session = { id: 'test-session', header: { cwd: '/tmp' } }
  const execute = (name: string, args: Record<string, unknown> = {}, liveSession: typeof session | undefined = session, signal = new AbortController().signal) => {
    const definition = tools.get(name)
    if (!definition) throw new Error(`Tool not registered: ${name}`)
    return definition.execute(args, { agent: { session: liveSession }, signal } as never)
  }
  return { execute, session, resolve, spawn, setMode: (value: string) => { mode = value } }
}

const mutations = ['desktop_start', 'desktop_action', 'desktop_launch', 'desktop_stop', 'desktop_focus', 'desktop_close_window']

describe('DSH session permission admission', () => {
  for (const mode of ['read-only', 'workspace-write']) {
    for (const tool of mutations) {
      it(`rejects ${tool} under ${mode} before native work`, async () => {
        const f = await boot(mode)
        await expect(f.execute(tool)).rejects.toMatchObject({ code: 'permission-denied', httpStatus: 403 })
        expect(f.resolve).toHaveBeenCalledWith({ session: f.session })
        expect(f.spawn).not.toHaveBeenCalled()
      })
    }
  }
  it('resolves the current session policy for every mutation, not at activation', async () => {
    const f = await boot('danger-full-access')
    await expect(f.execute('desktop_start', { cwd: 'relative' })).rejects.toMatchObject({ code: 'bad-cwd' })
    f.setMode('read-only')
    await expect(f.execute('desktop_start', { cwd: '/tmp' })).rejects.toMatchObject({ code: 'permission-denied' })
    expect(f.resolve).toHaveBeenCalledTimes(2)
    expect(f.spawn).not.toHaveBeenCalled()
  })
  it('reads status without obtaining write permission or starting a desktop', async () => {
    const f = await boot()
    for (const name of ['desktop_status', 'desktop_windows']) {
      await expect(f.execute(name)).resolves.toMatchObject({ state: 'stopped', owner: 'none' })
    }
    expect(f.resolve).not.toHaveBeenCalled()
    expect(f.spawn).not.toHaveBeenCalled()
  })
  it('rejects an absent working directory before policy or native access', async () => {
    const f = await boot('danger-full-access')
    await expect(f.execute('desktop_start', {}, { id: 'test-session', header: { cwd: '' } })).rejects.toMatchObject({ code: 'session-required' })
    expect(f.resolve).not.toHaveBeenCalled()
    expect(f.spawn).not.toHaveBeenCalled()
  })
  it('honors cancellation before starting a native worker', async () => {
    const f = await boot('danger-full-access')
    const controller = new AbortController()
    controller.abort(new Error('cancelled admission'))
    await expect(f.execute('desktop_start', {}, f.session, controller.signal)).rejects.toThrow('cancelled admission')
    expect(f.spawn).not.toHaveBeenCalled()
  })
})
