import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { NativeBackend } from '../src/native-backend.ts'
import { nodeSpawn } from './node-spawn.ts'

interface Events { windowId: number; pid: number; returnDown: number; returnUp: number; controlS: number; deleteRequests: number }
describe.skipIf(process.env.DESKTOP_NATIVE_SMOKE !== '1')('feedback native integration', () => {
  it('pairs keys, bounds agent holds, preserves human repeats and inspects pixels/windows/lifetimes', async () => {
    await mkdir('artifacts', { recursive: true })
    const base = await mkdtemp(resolve('artifacts/feedback-native-'))
    const backend = new NativeBackend({ runtimeRoot: resolve('.runtime'), stateRoot: resolve('.state/test'), cwd: process.cwd(), width: 1600, height: 1000, agentKeyHoldMs: 1500, startTerminal: false, spawn: nodeSpawn, workerPath: resolve('runtime/desktop_worker.py') })
    const events = async () => JSON.parse(await readFile(resolve(base, 'events.json'), 'utf8')) as Events
    try {
      const started = await backend.start()
      expect(started.display).not.toBe(process.env.DISPLAY)
      const launched = await backend.launch({ command: resolve('.runtime/venv/bin/python'), args: [resolve('tests/fixtures/input-window.py'), base], cwd: process.cwd(), env: {} })
      await expect.poll(async () => events().catch(() => null), { timeout: 5000 }).not.toBeNull()
      const id = (await events()).windowId
      await expect.poll(async () => (await backend.inspect()).windows.some(window => window.id === id), { timeout: 5000 }).toBe(true)
      expect((await backend.focus(id)).confirmed).toBe(true)
      const info = await backend.inspect()
      const window = info.windows.find(w => w.id === id)!
      expect(window).toMatchObject({ pid: launched.pid, mapped: true, focusable: true, focused: true, supportsDelete: true })
      expect(info.applications.find(app => app.id === launched.id)?.running).toBe(true)

      await backend.input({ type: 'press', key: 'Return' })
      await expect.poll(async () => (await events()).returnUp).toBe(1)
      await delay(800)
      expect((await events()).returnDown).toBe(1)
      await backend.input({ type: 'press', key: 's', modifiers: ['Control'] })
      await expect.poll(async () => (await events()).controlS).toBe(1)
      expect((await backend.inspect()).input.heldKeys).toEqual([])

      await backend.input({ type: 'key', key: 'Return', down: true })
      await delay(1700)
      expect((await events()).returnDown).toBe(2)
      expect((await backend.inspect()).input).toMatchObject({ heldKeys: [], lastAutoReleaseAt: expect.any(String) })
      await backend.input({ type: 'key', key: 'Return', down: true }, undefined, 'human')
      await delay(1700)
      expect((await events()).returnDown).toBeGreaterThan(3)
      expect((await backend.inspect()).input.heldKeys).toContain('Return')
      await backend.input({ type: 'key', key: 'Return', down: false }, undefined, 'human')
      expect((await backend.inspect()).input.heldKeys).toEqual([])

      const point = { x: window.geometry.x + 40, y: window.geometry.y + 40 }
      await backend.input({ type: 'move', ...point })
      const sampled = await backend.probe([point])
      expect(sampled.samples[0]?.rgba).toEqual([18, 52, 86, 255])
      expect(sampled.cursorOverlay).toBe(false)
      const region = { x: point.x - 10, y: point.y - 10, width: 120, height: 100 }
      const raw = await backend.frame(undefined, { region, cursor: false })
      const marked = await backend.frame(undefined, { region, cursor: true })
      expect(raw).toMatchObject({ width: 120, height: 100, region })
      expect(marked.frameId).not.toBe(raw.frameId)
      expect(marked.data.equals(raw.data)).toBe(false)
      await writeFile(resolve(base, 'region-raw.png'), raw.data)
      await writeFile(resolve(base, 'region-cursor.png'), marked.data)

      const exited = await backend.launch({ command: resolve('.runtime/venv/bin/python'), args: ['-c', 'raise SystemExit(7)'], cwd: process.cwd(), env: {} })
      await expect.poll(async () => (await backend.inspect()).applications.find(app => app.id === exited.id)?.exitCode).toBe(7)
      expect((await backend.inspect()).applications.find(app => app.id === exited.id)?.running).toBe(false)
      expect((await backend.closeWindow(id)).requested).toBe(true)
      await expect.poll(async () => (await events()).deleteRequests).toBe(1)
      expect((await backend.inspect()).windows.some(w => w.id === id)).toBe(true)
      await writeFile(resolve(base, 'verified.json'), JSON.stringify({ events: await events(), probe: sampled, inventory: await backend.inspect() }, null, 2))
    } finally { await backend.stop() }
  }, 40_000)
})
