// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { ConnectionGeneration } from '@deepseek-ai/dsh-client-connection/client'
import type { DesktopInjected } from '../src/client/DesktopController.ts'
import * as plugin from '../src/client/index.ts'
import { DesktopBody } from '../src/client/DesktopBody.tsx'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Button: () => null }))

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(context => context.fiber.dispose()))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
interface Entry {
  readonly name: string
  readonly key: string
  readonly locale: string
  readonly inject: (sessionId: string) => DesktopInjected
  readonly component: unknown
}
async function boot() {
  vi.stubGlobal('fetch', vi.fn())
  const ctx = new Context()
  contexts.push(ctx)
  const definitions = new Map<string, SidebarRightTabDefinition>()
  const tabs = {
    register: (definition: SidebarRightTabDefinition) => {
      definitions.set(definition.kind, definition)
      return () => { definitions.delete(definition.kind) }
    },
    get: (kind: string) => definitions.get(kind),
  }
  const entries: Entry[] = []
  const slots = {
    inject: vi.fn((_name: string, install: () => () => void) => install()),
    register: vi.fn((options: Omit<Entry, 'component'>, component: unknown) => {
      const entry = { ...options, component }
      entries.push(entry)
      return () => { entries.splice(entries.indexOf(entry), 1) }
    }),
  }
  const dictionaries = new Map<string, unknown>()
  const generation = createSnapshotStore<ConnectionGeneration | undefined>(undefined)
  const locale = {
    bind: () => (key: string) => key,
    register: (namespace: string, values: unknown) => {
      dictionaries.set(namespace, values)
      return () => { dictionaries.delete(namespace) }
    },
  }
  // Cordis's real fiber owns all disposers; these narrow registry/transport doubles expose only used methods.
  ctx.provide('slots', slots as never)
  ctx.provide('locale', locale as never)
  ctx.provide('sidebarRightTabs', tabs as never)
  ctx.provide('connection', { generation } as never)
  const fiber = ctx.plugin(plugin)
  await fiber.await()
  return { fiber, entries, slots, dictionaries, tabs, generation }
}

describe('official sidebar plugin composition', () => {
  it('has only named Cordis exports and registers under the tab definition id', async () => {
    expect(Object.keys(plugin).sort()).toEqual(['apply', 'inject'])
    const f = await boot()
    expect(f.tabs.get('agent-desktop')).toMatchObject({ id: 'dsh-agent-desktop', keepMounted: true })
    expect(f.tabs.get('agent-desktop')?.multiple).not.toBe(true)
    expect(f.slots.inject).toHaveBeenCalledWith('sidebar.right.pane.tab', expect.any(Function))
    expect(f.entries).toHaveLength(1)
    expect(f.entries[0]).toMatchObject({ name: 'sidebar.right.pane.tab', key: 'dsh-agent-desktop', locale: 'agentDesktop', component: DesktopBody })
    expect(f.dictionaries.get('agentDesktop')).toMatchObject({ zh: { title: '智能体桌面' } })
    expect(document.querySelector('link[href="/api/agent-desktop/style.css"]')).not.toBeNull()
  })
  it('reuses a controller only within its injected session and never starts one on mount', async () => {
    const f = await boot()
    const entry = f.entries[0]!
    const first = entry.inject('session-one')
    expect(entry.inject('session-one')).toBe(first)
    expect(entry.inject('session-two')).not.toBe(first)
    const signal = new AbortController()
    const detach = first.mount('tab1', signal.signal)
    first.setVisible('tab1', true)
    expect(first.hooks.desktopState.getSnapshot().connected).toBe(false)
    expect(window.fetch).not.toHaveBeenCalled()
    detach()
    expect(window.fetch).not.toHaveBeenCalled()
  })
  it('disposes tab/slot/locale/style and visibility listeners without stopping a backend', async () => {
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const addWindow = vi.spyOn(window, 'addEventListener')
    const addDocument = vi.spyOn(document, 'addEventListener')
    const f = await boot()
    const callbacks = f.entries[0]!.inject('session-one')
    callbacks.mount('tab1', new AbortController().signal)
    await f.fiber.dispose()
    expect(f.tabs.get('agent-desktop')).toBeUndefined()
    expect(f.entries).toEqual([])
    expect(f.dictionaries.size).toBe(0)
    expect(document.querySelector('link[href="/api/agent-desktop/style.css"]')).toBeNull()
    expect(removeWindow.mock.calls.some(call => call[0] === 'blur')).toBe(true)
    expect(removeDocument.mock.calls.some(call => call[0] === 'visibilitychange')).toBe(true)
    expect([...addWindow.mock.calls, ...addDocument.mock.calls].some(call => ['keydown', 'keyup', 'paste', 'copy'].includes(call[0]))).toBe(false)
    expect(window.fetch).not.toHaveBeenCalled()
    expect(callbacks.input('tab1', { type: 'text', text: 'after disposal' })).toBe(false)
  })
})
