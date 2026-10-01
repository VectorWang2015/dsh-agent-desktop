import { PassThrough, Writable } from 'node:stream'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { NativeBackend, type Spawn } from '../src/native-backend.ts'

vi.mock('node:fs/promises', () => ({
  access: vi.fn(async () => {}), mkdir: vi.fn(async () => {}), mkdtemp: vi.fn(async () => '/private/test'), rm: vi.fn(async () => {}),
  readFile: vi.fn(async () => JSON.stringify({ python: '/test/python', xvfb: '/test/Xvfb' })),
}))
function fixture(errorOn: 'input' | 'cancel') {
  const stdout = new PassThrough()
  let resolveDone!: (value: { exitCode: number; signal: null }) => void
  const done = new Promise<{ exitCode: number; signal: null }>(resolve => { resolveDone = resolve })
  const terminate = vi.fn(() => resolveDone({ exitCode: 1, signal: null }))
  const stdin = new Writable({
    write(chunk, _encoding, callback) {
      const request = JSON.parse(String(chunk))
      if (request.op === errorOn) { callback(Object.assign(new Error('EPIPE fixture'), { code: 'EPIPE' })); return }
      callback()
      if (request.op === 'start') queueMicrotask(() => stdout.write(JSON.stringify({ id: request.id, ok: true, result: { display: ':99' } }) + '\n'))
    },
  })
  const spawn: Spawn = () => ({ stdin, stdout, stderr: undefined, control: undefined, collected: {}, done, terminate, waitForExit: async () => { await done; return true } })
  const backend = new NativeBackend({ spawn, cwd: '/', runtimeRoot: '/runtime', stateRoot: '/state', width: 1280, height: 800, startTerminal: false, workerPath: '/worker.py' })
  return { backend, terminate, stdin }
}
describe('owned worker stream failure', () => {
  it('handles an EPIPE event as well as the write callback without crashing Host', async () => {
    const { backend, terminate, stdin } = fixture('input')
    await backend.start()
    expect(stdin.listenerCount('error')).toBeGreaterThan(0)
    await expect(backend.input({ type: 'move', x: 1, y: 1 })).rejects.toThrow('EPIPE')
    await nextTurn()
    expect(terminate).toHaveBeenCalledTimes(1)
    await backend.stop()
  })
  it('handles a broken cancellation write and settles the pending input', async () => {
    const { backend, terminate } = fixture('cancel')
    await backend.start()
    const abort = new AbortController()
    const pending = backend.input({ type: 'text', text: 'test' }, abort.signal)
    const refused = expect(pending).rejects.toThrow('EPIPE')
    abort.abort(new Error('Cancelled'))
    await refused
    await nextTurn()
    expect(terminate).toHaveBeenCalledTimes(1)
    await backend.stop()
  })
})
