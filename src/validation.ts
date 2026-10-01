import type { ApplicationRequest, ControlAction, DesktopAction, DesktopRegion, DesktopSize } from './types.ts'

export class DesktopError extends Error {
  constructor(message: string, readonly code = 'desktop-error', readonly httpStatus = 409) {
    super(message)
    this.name = 'DesktopError'
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DesktopError('Expected a JSON object', 'bad-request', 400)
  return value as Record<string, unknown>
}
export function sessionId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value)) throw new DesktopError('Invalid sessionId', 'bad-session', 400)
  return value
}
export function epoch(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new DesktopError('A valid epoch is required; refresh status', 'bad-epoch', 400)
  return value as number
}
function number(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new DesktopError(`${name} must be ${min}..${max}`, 'bad-input', 400)
  return value
}
function button(value: unknown): 'left' | 'middle' | 'right' {
  if (value !== 'left' && value !== 'middle' && value !== 'right') throw new DesktopError('Invalid mouse button', 'bad-input', 400)
  return value
}
export function controlAction(value: unknown): ControlAction {
  if (typeof value !== 'string' || !['start', 'stop', 'pause', 'takeover', 'release', 'resume'].includes(value)) throw new DesktopError('Invalid control action', 'bad-request', 400)
  return value as ControlAction
}
export function action(value: unknown, width: number, height: number): DesktopAction {
  const v = object(value)
  const point = () => ({ x: Math.round(number(v.x, 'x', 0, width - 1)), y: Math.round(number(v.y, 'y', 0, height - 1)) })
  const optionalPoint = () => v.x === undefined && v.y === undefined ? {} : point()
  switch (v.type) {
    case 'move': return { type: 'move', ...point() }
    case 'click': {
      const count = v.count ?? 1
      if (count !== 1 && count !== 2) throw new DesktopError('click count must be 1 or 2', 'bad-input', 400)
      return { type: 'click', ...point(), button: button(v.button ?? 'left'), count }
    }
    case 'button':
      if (typeof v.down !== 'boolean') throw new DesktopError('down must be boolean', 'bad-input', 400)
      return { type: 'button', ...optionalPoint(), button: button(v.button), down: v.down }
    case 'scroll': return { type: 'scroll', ...optionalPoint(), deltaY: number(v.deltaY, 'deltaY', -2000, 2000), deltaX: number(v.deltaX ?? 0, 'deltaX', -2000, 2000) }
    case 'press':
    case 'key': {
      if (typeof v.key !== 'string' || v.key.length < 1 || v.key.length > 64 || /[\u0000-\u001f]/.test(v.key)) throw new DesktopError('Invalid key event', 'bad-input', 400)
      if (v.type === 'key' && v.down !== undefined) {
        if (typeof v.down !== 'boolean' || v.modifiers !== undefined) throw new DesktopError('Raw key needs boolean down and no modifiers; prefer press', 'bad-input', 400)
        return { type: 'key', key: v.key, down: v.down }
      }
      if (v.type === 'press' && v.down !== undefined) throw new DesktopError('press is already a complete down/up pair; omit down', 'bad-input', 400)
      const modifiers = v.modifiers ?? []
      if (!Array.isArray(modifiers) || modifiers.length > 4 || modifiers.some(m => !['Control', 'Alt', 'Shift', 'Meta'].includes(m)) || new Set(modifiers).size !== modifiers.length) throw new DesktopError('Invalid press modifiers', 'bad-input', 400)
      return { type: 'press', key: v.key, modifiers: modifiers as Array<'Control' | 'Alt' | 'Shift' | 'Meta'> }
    }
    case 'release': return { type: 'release' }
    case 'text':
      if (typeof v.text !== 'string' || v.text.length < 1 || v.text.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(v.text)) throw new DesktopError('text must contain 1..4000 valid Unicode characters without unsupported control codes', 'bad-input', 400)
      return { type: 'text', text: v.text }
    default: throw new DesktopError('Unsupported input action', 'bad-input', 400)
  }
}
export function desktopSize(value: unknown): DesktopSize | undefined {
  const v = object(value)
  if (v.width === undefined && v.height === undefined) return undefined
  const width = number(v.width, 'width', 320, 2560), height = number(v.height, 'height', 240, 1600)
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new DesktopError('Desktop dimensions must be integers', 'bad-size', 400)
  return { width, height }
}
export function region(value: unknown, width: number, height: number): DesktopRegion | undefined {
  if (value === undefined) return undefined
  const v = object(value)
  const x = number(v.x, 'region.x', 0, width - 1), y = number(v.y, 'region.y', 0, height - 1)
  const w = number(v.width, 'region.width', 1, width - x), h = number(v.height, 'region.height', 1, height - y)
  if (![x, y, w, h].every(Number.isInteger)) throw new DesktopError('Region must use integer desktop pixels', 'bad-region', 400)
  return { x, y, width: w, height: h }
}
export function probePoints(value: unknown, width: number, height: number): Array<{ x: number; y: number }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw new DesktopError('Provide 1..32 probe points', 'bad-probe', 400)
  return value.map(point => {
    const p = object(point), x = number(p.x, 'x', 0, width - 1), y = number(p.y, 'y', 0, height - 1)
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new DesktopError('Probe points must be integer pixels', 'bad-probe', 400)
    return { x, y }
  })
}
export function windowId(value: unknown): number {
  const id = number(value, 'windowId', 2, 0xffffffff)
  if (!Number.isInteger(id)) throw new DesktopError('windowId must be an integer from desktop_windows', 'bad-window', 400)
  return id
}
const ROUTING_ENV = /^(DISPLAY|WAYLAND_DISPLAY|XAUTHORITY|XDG_RUNTIME_DIR|DBUS_.*|SESSION_MANAGER|PULSE_.*|PIPEWIRE_.*|LD_PRELOAD|DSH_.*|SELKIES_.*|PIXELFLUX_.*|GDK_BACKEND|QT_QPA_PLATFORM)$/i
export function application(value: unknown, defaultCwd: string): ApplicationRequest {
  const v = object(value)
  if (typeof v.command !== 'string' || !v.command.trim() || v.command.length > 4096 || v.command.includes('\0')) throw new DesktopError('command must be an executable, not a shell snippet', 'bad-launch', 400)
  const args = v.args ?? []
  if (!Array.isArray(args) || args.length > 128 || args.some(a => typeof a !== 'string' || a.length > 8192 || a.includes('\0'))) throw new DesktopError('Invalid argv', 'bad-launch', 400)
  const cwd = v.cwd ?? defaultCwd
  if (typeof cwd !== 'string' || !cwd.startsWith('/') || cwd.includes('\0')) throw new DesktopError('cwd must be an absolute directory', 'bad-launch', 400)
  const env = object(v.env ?? {})
  if (Object.keys(env).length > 80) throw new DesktopError('Too many environment overrides', 'bad-launch', 400)
  const clean: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || ROUTING_ENV.test(key) || typeof value !== 'string' || value.includes('\0') || value.length > 16384) throw new DesktopError(`Invalid or reserved environment key: ${key}`, 'bad-launch', 400)
    clean[key] = value
  }
  return { command: v.command, args: args as string[], cwd, env: clean }
}
