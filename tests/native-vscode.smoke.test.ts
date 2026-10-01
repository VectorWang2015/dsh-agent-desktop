import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { NativeBackend } from '../src/native-backend.ts'
import { nodeSpawn } from './node-spawn.ts'

// Explicit opt-in: starts the already-installed VS Code in a disposable private UI profile.
describe.skipIf(process.env.DESKTOP_VSCODE_SMOKE !== '1')('host IDE in private display', () => {
  it('keeps capture responsive after launching host VS Code', async () => {
    await mkdir('artifacts', { recursive: true })
    const base = await mkdtemp(resolve('artifacts/vscode-native-'))
    await mkdir(resolve(base, 'profile/User'), { recursive: true })
    await writeFile(resolve(base, 'profile/User/settings.json'), JSON.stringify({ 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'workbench.startupEditor': 'none', 'window.restoreWindows': 'none', 'security.workspace.trust.enabled': false }))
    const document = resolve(base, 'proof.txt')
    await writeFile(document, 'Host-native VS Code / independent AI desktop\n中文输入与本机开发环境验证\n')
    const backend = new NativeBackend({ runtimeRoot: resolve('.runtime'), stateRoot: resolve('.state/test'), cwd: process.cwd(), width: 1280, height: 800, startTerminal: true, spawn: nodeSpawn, workerPath: resolve('runtime/desktop_worker.py') })
    try {
      await backend.start()
      await backend.launch({ command: '/usr/bin/code', args: ['--user-data-dir', resolve(base, 'profile'), '--disable-extensions', '--disable-gpu', '--password-store=basic', '--new-window', document], cwd: process.cwd(), env: {} })
      // Readiness is an actual mapped IDE window, not a blind delay or a successful CLI exit.
      let titles: string[] = []
      await expect.poll(async () => {
        const frame = await backend.frame(AbortSignal.timeout(5000))
        expect(frame.width).toBe(1280)
        await writeFile('artifacts/native-vscode.png', frame.data)
        titles = (frame.windows ?? []).map(window => window.title)
        return titles.some(title => /proof\.txt.*Visual Studio Code/i.test(title))
      }, { timeout: 30000, interval: 750 }).toBe(true)
      await writeFile('artifacts/native-vscode-windows.json', JSON.stringify(titles, null, 2))
      await delay(2000)
      await writeFile('artifacts/native-vscode-before-edit.png', (await backend.frame()).data)
      // The installed build shows a first-run sign-in welcome even with startupEditor=none.
      // Dismiss it without signing in; these coordinates are from the inspected 1280x800 fixture.
      await backend.input({ type: 'key', key: 'Escape', down: true })
      await backend.input({ type: 'key', key: 'Escape', down: false })
      await backend.input({ type: 'click', x: 1090, y: 145 })
      await delay(500)
      await backend.frame()
      await backend.input({ type: 'click', x: 350, y: 120 })
      await delay(150)
      await backend.input({ type: 'key', key: 'Control', down: true })
      await backend.input({ type: 'key', key: 'End', down: true })
      await backend.input({ type: 'key', key: 'End', down: false })
      await backend.input({ type: 'key', key: 'Control', down: false })
      await backend.input({ type: 'text', text: '\nDSH_EDIT_OK 中文✓' })
      await backend.input({ type: 'key', key: 'Control', down: true })
      await backend.input({ type: 'key', key: 's', down: true })
      await backend.input({ type: 'key', key: 's', down: false })
      await backend.input({ type: 'key', key: 'Control', down: false })
      await expect.poll(async () => readFile(document, 'utf8'), { timeout: 5000 }).toContain('DSH_EDIT_OK 中文✓')
      await writeFile('artifacts/native-vscode-edit-proof.txt', await readFile(document))
      await delay(120)
      await writeFile('artifacts/native-vscode.png', (await backend.frame()).data)
    } catch (error) {
      const failed = await backend.frame().catch(() => undefined)
      if (failed) await writeFile('artifacts/native-vscode-failure.png', failed.data)
      throw error
    } finally { await backend.stop() }
  }, 45_000)
})
