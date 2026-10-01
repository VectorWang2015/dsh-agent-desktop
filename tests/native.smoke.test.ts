import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NativeBackend } from '../src/native-backend.ts'
import { nodeSpawn } from './node-spawn.ts'

const enabled = process.env.DESKTOP_NATIVE_SMOKE === '1'
describe.skipIf(!enabled)('real private X11 runtime', () => {
  it('captures and controls a fresh display without any viewer, then stops it', async () => {
    const backend = new NativeBackend({ runtimeRoot: resolve('.runtime'), stateRoot: resolve('.state/test'), cwd: process.cwd(), width: 1280, height: 800, startTerminal: true, spawn: nodeSpawn, workerPath: resolve('runtime/desktop_worker.py') })
    try {
      const ready = await backend.start()
      expect(ready.display).toMatch(/^:\d+$/)
      expect(ready.display).not.toBe(process.env.DISPLAY)
      await mkdir('artifacts', { recursive: true })
      const fixtureDir = await mkdtemp(resolve('artifacts/native-fixture-'))
      const proof = resolve(fixtureDir, 'proof.txt')
      await backend.input({ type: 'click', x: 250, y: 150 })
      await backend.input({ type: 'text', text: `printf 'AGENT_DESKTOP_NATIVE_OK' > '${proof}'\n` })
      await expect.poll(async () => readFile(proof, 'utf8').catch(() => ''), { timeout: 7000 }).toBe('AGENT_DESKTOP_NATIVE_OK')
      // The proof file is created only by injected keys in the private terminal.
      const first = await backend.frame()
      expect(first.width).toBe(1280)
      expect(first.height).toBe(800)
      expect(first.data.length).toBeGreaterThan(1000)
      await mkdir('artifacts', { recursive: true })
      await writeFile('artifacts/native-smoke.png', first.data)
      await backend.input({ type: 'key', key: 'Shift', down: true })
      await backend.release()
      const second = await backend.frame()
      await writeFile('artifacts/native-smoke-final.png', second.data)
    } catch (error) {
      const failed = await backend.frame().catch(() => undefined)
      if (failed) await writeFile('artifacts/native-smoke-failure.png', failed.data)
      throw error
    } finally { await backend.stop() }
  }, 45_000)
  it('keeps Unicode mappings valid while a client delays event handling across input calls', async () => {
    const backend = new NativeBackend({ runtimeRoot: resolve('.runtime'), stateRoot: resolve('.state/test'), cwd: process.cwd(), width: 1280, height: 800, startTerminal: true, spawn: nodeSpawn, workerPath: resolve('runtime/desktop_worker.py') })
    await mkdir('artifacts', { recursive: true })
    const base = await mkdtemp(resolve('artifacts/unicode-delayed-'))
    try {
      await backend.start()
      await backend.launch({ command: resolve('.runtime/venv/bin/python'), args: [resolve('tests/fixtures/delayed-x11.py'), base], cwd: process.cwd(), env: {} })
      await expect.poll(async () => readFile(resolve(base, 'ready.json'), 'utf8').catch(() => ''), { timeout: 5000 }).not.toBe('')
      await backend.input({ type: 'click', x: 160, y: 655 })
      await backend.input({ type: 'text', text: '你好' })
      await backend.input({ type: 'text', text: '好你✓\n' })
      await new Promise(resolve => setTimeout(resolve, 180))
      await writeFile(resolve(base, 'accept'), 'now')
      await expect.poll(async () => readFile(resolve(base, 'receipt.json'), 'utf8').catch(() => ''), { timeout: 5000 }).toContain('你好好你✓')
    } finally { await backend.stop() }
  }, 30_000)
  it('reaps a detached descendant after its original launcher has exited', async () => {
    const backend = new NativeBackend({ runtimeRoot: resolve('.runtime'), stateRoot: resolve('.state/test'), cwd: process.cwd(), width: 1280, height: 800, startTerminal: true, spawn: nodeSpawn, workerPath: resolve('runtime/desktop_worker.py') })
    await mkdir('artifacts', { recursive: true })
    const base = await mkdtemp(resolve('artifacts/orphan-owned-'))
    const receipt = resolve(base, 'child.json')
    try {
      await backend.start()
      await backend.launch({ command: resolve('.runtime/venv/bin/python'), args: [resolve('tests/fixtures/orphan.py'), receipt], cwd: process.cwd(), env: {} })
      await expect.poll(() => readFile(receipt, 'utf8').catch(() => ''), { timeout: 5000 }).not.toBe('')
      const child = JSON.parse(await readFile(receipt, 'utf8')) as { pid: number; start: string }
      expect(await readFile(`/proc/${child.pid}/stat`, 'utf8')).toContain(String(child.pid))
      await backend.stop()
      await expect.poll(async () => {
        const stat = await readFile(`/proc/${child.pid}/stat`, 'utf8').catch(() => '')
        return stat ? stat.slice(stat.lastIndexOf(')') + 1).trim().split(/\s+/)[19] !== child.start : true
      }, { timeout: 3000 }).toBe(true)
    } finally { await backend.stop() }
  }, 30_000)
})
