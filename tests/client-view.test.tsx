// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, type ButtonHTMLAttributes } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DesktopBody, type DesktopBodyProps } from '../src/client/DesktopBody.tsx'
import type { DesktopViewState } from '../src/client/DesktopController.ts'
import { zh, type DesktopLocaleKey } from '../src/client/locales.ts'

// These tests exercise the feature, not the shell's separately tested shared Button implementation.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ variant: _variant, size: _size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => <button type="button" {...props} />,
}))

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function fixture(human = false) {
  let snapshot: DesktopViewState = {
    status: { sessionId: 's1', state: 'running', owner: human ? 'human' : 'agent', epoch: 2,
      backend: 'native-x11', width: 1280, height: 720 },
    frame: { url: 'blob:frame', epoch: 2, width: 1280, height: 720, receivedAt: Date.now() },
    connected: true, watching: true, checkedAt: Date.now(), pending: undefined,
    humanTabId: human ? 'tab1' : undefined, inputReady: human, problem: undefined,
  }
  let visible = true
  const cleanup = vi.fn()
  const mount = vi.fn(() => cleanup)
  const setVisible = vi.fn()
  const control = vi.fn<DesktopBodyProps['control']>().mockResolvedValue(true)
  const input = vi.fn<DesktopBodyProps['input']>().mockReturnValue(true)
  const releaseHeld = vi.fn()
  const suspend = vi.fn()
  const frameLoaded = vi.fn()
  const signal = new AbortController()
  // Unused framework seats are omitted. All seats read by this presentation are real callback/hook fakes.
  const props = {
    sessionId: 's1', mount, setVisible, control, input, releaseHeld, suspend, frameLoaded,
    frameFailed: vi.fn(), refresh: vi.fn(),
    useDesktopState: <S,>(selector: (value: DesktopViewState) => S) => selector(snapshot),
    useTabInfo: () => ({ sidebar: { expanded: true, fullscreen: false }, panel: { id: 'pane1' },
      tab: { id: 'tab1', title: '智能体桌面', kind: 'agent-desktop', contentId: 'sidebar://agent-desktop', visible,
        signal: signal.signal, navigation: { address: 'sidebar://agent-desktop', params: undefined, revision: 0 },
        actions: { bindCommands: () => () => {}, openTab: () => {}, openResource: () => {}, close: () => {} } } }),
    t: (key: string, params?: Record<string, unknown>) => {
      let text: string = zh[key as DesktopLocaleKey] ?? key
      for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, String(value))
      return text
    },
  } as DesktopBodyProps
  const render = async () => { await act(async () => { root.render(<DesktopBody {...props} />) }) }
  return { props, render, mount, setVisible, cleanup, control, input, releaseHeld, suspend, frameLoaded,
    setSnapshot: (patch: Partial<DesktopViewState>) => { snapshot = { ...snapshot, ...patch } },
    setVisibleValue: (value: boolean) => { visible = value }, state: () => snapshot }
}
function button(label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll('button')].find(item => item.textContent === label)
  if (result === undefined) throw new Error(`Missing button: ${label}`)
  return result
}
async function click(element: HTMLElement) { await act(async () => { element.click() }) }
function preview(): HTMLDivElement { return container.querySelector('[role="application"], [role="img"]')! }
async function key(target: Element, type: string, keyValue: string, init: KeyboardEventInit = {}) {
  await act(async () => { target.dispatchEvent(new KeyboardEvent(type, { key: keyValue, bubbles: true, cancelable: true, ...init })) })
}
function geometry(element: Element): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0,
    width: 640, height: 480, right: 640, bottom: 480, toJSON: () => ({}) })
}
async function pointer(target: Element, type: string, x: number, y: number) {
  await act(async () => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
    target.dispatchEvent(event)
  })
}

describe('Chinese desktop tab controls', () => {
  it('presents a useful read-only preview without any automatic start or input', async () => {
    const f = fixture()
    await f.render()
    expect(container.textContent).toContain('只读监看')
    expect(container.textContent).toContain('暂停仅禁用输入')
    expect(container.querySelector('iframe')).toBeNull()
    expect(f.control).not.toHaveBeenCalled()
    geometry(preview())
    await pointer(preview(), 'pointerdown', 320, 240)
    await key(preview(), 'keydown', 'a', { code: 'KeyA' })
    expect(f.input).not.toHaveBeenCalled()
    expect(container.querySelector('textarea')?.disabled).toBe(true)
  })
  it('sends takeover only after a human click, without optimistic input enablement', async () => {
    const f = fixture()
    await f.render()
    await click(button('人工接管'))
    expect(f.control).toHaveBeenCalledWith('tab1', 'takeover', undefined)
    expect(container.querySelector('textarea')?.disabled).toBe(true)
    expect(f.input).not.toHaveBeenCalled()
  })
  it('requires explicit unsaved-app acknowledgement before sending stop at the confirmed epoch', async () => {
    const f = fixture()
    await f.render()
    await click(button('停止桌面'))
    expect(container.textContent).toContain('未保存的内容可能丢失')
    expect(button('确认停止并关闭应用').disabled).toBe(true)
    expect(f.control).not.toHaveBeenCalled()
    await click(container.querySelector('input[type="checkbox"]')!)
    await click(button('确认停止并关闭应用'))
    expect(f.control).toHaveBeenCalledWith('tab1', 'stop', 2)
  })
  it('cancels confirmation locally and invalidates it on an epoch change', async () => {
    const f = fixture()
    await f.render()
    await click(button('停止桌面'))
    await click(button('取消'))
    expect(f.control).not.toHaveBeenCalled()
    await click(button('停止桌面'))
    await click(container.querySelector('input[type="checkbox"]')!)
    f.setSnapshot({ status: { ...f.state().status!, epoch: 3 } })
    await f.render()
    expect(button('确认停止并关闭应用').disabled).toBe(true)
    expect(container.textContent).toContain('桌面状态已变化')
    expect(f.control).not.toHaveBeenCalled()
  })
  it('does not release another viewer human capability using public status alone', async () => {
    const f = fixture()
    f.setSnapshot({ status: { ...f.state().status!, owner: 'human' } })
    await f.render()
    expect(button('释放接管').disabled).toBe(true)
    expect(button('暂停输入').disabled).toBe(false)
    expect(container.textContent).toContain('人工所有权不属于本页')
  })
  it('suspends visibility and detaches without sending stop', async () => {
    const f = fixture(true)
    await f.render()
    f.setVisibleValue(false)
    await f.render()
    expect(f.setVisible).toHaveBeenLastCalledWith('tab1', false)
    await act(async () => { root.unmount() })
    expect(f.cleanup).toHaveBeenCalled()
    expect(f.control).not.toHaveBeenCalled()
    root = createRoot(container)
  })
})

describe('element-scoped human input', () => {
  it('maps letterboxes and clamps captured drag releases without duplicate clicks', async () => {
    const f = fixture(true)
    await f.render()
    const area = preview()
    geometry(area)
    await pointer(area, 'pointerdown', 320, 20)
    expect(f.input).not.toHaveBeenCalled()
    await pointer(area, 'pointerdown', 320, 240)
    expect(f.input).toHaveBeenCalledWith('tab1', { type: 'button', button: 'left', down: true, x: 640, y: 360 })
    await pointer(area, 'pointerup', 1000, 700)
    expect(f.input).toHaveBeenLastCalledWith('tab1', { type: 'button', button: 'left', down: false, x: 1279, y: 719 })
    expect(f.input.mock.calls.some(call => call[1].type === 'click')).toBe(false)
  })
  it('captures keyboard on the focused preview only and has an explicit escape from capture', async () => {
    const addDocument = vi.spyOn(document, 'addEventListener')
    const addWindow = vi.spyOn(window, 'addEventListener')
    const f = fixture(true)
    await f.render()
    await key(document.body, 'keydown', 'a', { code: 'KeyA' })
    expect(f.input).not.toHaveBeenCalled()
    const area = preview()
    await act(async () => { area.focus() })
    await key(area, 'keydown', 'Control', { code: 'ControlLeft' })
    await key(area, 'keyup', 'Control', { code: 'ControlLeft' })
    expect(f.input.mock.calls.map(call => call[1])).toEqual([
      { type: 'key', key: 'Control', down: true }, { type: 'key', key: 'Control', down: false },
    ])
    await key(area, 'keydown', 'Escape', { code: 'Escape', shiftKey: true })
    expect(f.suspend).toHaveBeenCalledWith('tab1')
    expect(f.releaseHeld).toHaveBeenCalledWith('tab1')
    expect([...addDocument.mock.calls, ...addWindow.mock.calls].some(call => ['keydown', 'keyup', 'paste', 'copy'].includes(call[0]))).toBe(false)
  })
  it('uses a local non-passive wheel handler only on a mapped human-controlled image', async () => {
    const f = fixture(true)
    await f.render()
    const area = preview()
    geometry(area)
    const event = new WheelEvent('wheel', { clientX: 320, clientY: 240, deltaY: 2, deltaMode: 1, cancelable: true, bubbles: true })
    await act(async () => { area.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    expect(f.input).toHaveBeenCalledWith('tab1', { type: 'scroll', x: 640, y: 360, deltaY: 32, deltaX: 0 })
  })
  it('keeps composition local and sends Chinese text once, after explicit completion', async () => {
    const f = fixture(true)
    await f.render()
    const text = container.querySelector('textarea')!
    await act(async () => {
      text.focus()
      text.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(text, '你好，世界')
      text.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await key(text, 'keydown', 'Enter', { ctrlKey: true, isComposing: true, keyCode: 229 })
    expect(f.input).not.toHaveBeenCalled()
    expect(button('发送文本').disabled).toBe(true)
    await act(async () => { text.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好，世界' })) })
    await click(button('发送文本'))
    expect(f.input).toHaveBeenCalledTimes(1)
    expect(f.input).toHaveBeenCalledWith('tab1', { type: 'text', text: '你好，世界' })
    expect(text.value).toBe('你好，世界')
  })
  it('reports actual image dimensions before input and releases focus when leaving the tab', async () => {
    const f = fixture(true)
    await f.render()
    const image = container.querySelector('img')!
    Object.defineProperties(image, { naturalWidth: { value: 1280 }, naturalHeight: { value: 720 } })
    await act(async () => { image.dispatchEvent(new Event('load')) })
    expect(f.frameLoaded).toHaveBeenCalledWith('tab1', 'blob:frame', 1280, 720)
    const outside = document.createElement('button')
    document.body.append(outside)
    await act(async () => { preview().focus(); outside.focus() })
    expect(f.suspend).toHaveBeenCalledWith('tab1')
    outside.remove()
  })
})
