import { spawn } from 'node:child_process'
import type { Spawn } from '../src/native-backend.ts'

/** Test-only adapter; production uses the DSH managed subprocess service. */
export const nodeSpawn: Spawn = spec => {
  const env = { ...process.env, ...spec.env }
  for (const key of Object.keys(env)) if (env[key] === undefined || /KEY|SECRET|TOKEN|PASSWORD/i.test(key) || key.startsWith('DSH_')) delete env[key]
  const child = spawn(spec.argv[0]!, spec.argv.slice(1), { cwd: spec.cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: true })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-16384) })
  const done = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal }))
  })
  void done.catch(() => {})
  let stopping = false
  return {
    stdin: child.stdin, stdout: child.stdout, stderr: child.stderr, control: undefined,
    collected: { stderr: { readFrom: () => ({ text: stderr, nextOffset: stderr.length, lossy: false }) } },
    done,
    terminate() {
      if (stopping || !child.pid || child.exitCode !== null) return
      stopping = true
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* already exited */ }
      const timer = setTimeout(() => { if (child.exitCode === null) try { process.kill(-child.pid!, 'SIGKILL') } catch { /* already exited */ } }, 6000)
      timer.unref()
      void done.finally(() => clearTimeout(timer)).catch(() => {})
    },
    async waitForExit(signal) {
      if (!signal) { await done; return true }
      if (signal.aborted) return false
      return new Promise<boolean>(resolve => {
        const abort = () => resolve(false)
        signal.addEventListener('abort', abort, { once: true })
        void done.finally(() => { signal.removeEventListener('abort', abort); resolve(true) }).catch(() => {})
      })
    },
  }
}
