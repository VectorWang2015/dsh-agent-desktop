import type { ApplicationRequest, ControlAction, DesktopAction } from './types.ts'

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
    case 'key':
      if (typeof v.down !== 'boolean' || typeof v.key !== 'string' || v.key.length < 1 || v.key.length > 64 || /[\u0000-\u001f]/.test(v.key)) throw new DesktopError('Invalid key event', 'bad-input', 400)
      return { type: 'key', key: v.key, down: v.down }
    case 'text':
      if (typeof v.text !== 'string' || v.text.length < 1 || v.text.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(v.text)) throw new DesktopError('text must contain 1..4000 valid Unicode characters without unsupported control codes', 'bad-input', 400)
      return { type: 'text', text: v.text }
    default: throw new DesktopError('Unsupported input action', 'bad-input', 400)
  }
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
