/** Validate metadata returned over the native worker's JSON boundary. */
import type { DesktopInventory, PixelProbe, WindowOperation } from './types.ts'
import { object } from './validation.ts'

function invalid(field: string): never { throw new Error(`Invalid native ${field} response`) }
export function integer(value: unknown, field: string, min = 0, max = 0xffffffff): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) invalid(field)
  return value as number
}
function bool(value: unknown, field: string): boolean { if (typeof value !== 'boolean') invalid(field); return value }
function nullableId(value: unknown, field: string): number | null { return value === null ? null : integer(value, field, 1) }
function text(value: unknown, field: string, max = 250): string { if (typeof value !== 'string' || value.length > max * 2) invalid(field); return value as string }
export function isoTime(value: unknown, field: string): string {
  const time = text(value, field, 64)
  if (!Number.isFinite(Date.parse(time))) invalid(field)
  return time
}
export function frameId(value: unknown): string {
  const id = text(value, 'frameId', 128)
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(id)) invalid('frameId')
  return id
}
export function inventory(value: unknown): DesktopInventory {
  const v = object(value)
  if (!Array.isArray(v.applications) || v.applications.length > 1024 || !Array.isArray(v.windows) || v.windows.length > 64) invalid('inventory')
  const observedAt = isoTime(v.observedAt, 'observedAt')
  const input = object(v.input)
  if (!Array.isArray(input.heldKeys) || input.heldKeys.length > 256 || !Array.isArray(input.heldButtons) || input.heldButtons.length > 3) invalid('held input')
  return {
    observedAt,
    applications: v.applications.map(row => {
      const a = object(row)
      if (!Array.isArray(a.windowIds) || a.windowIds.length > 64) invalid('application windows')
      return { id: text(a.id, 'application id', 128), command: text(a.command, 'command', 4096), pid: integer(a.pid, 'pid', 1), running: bool(a.running, 'running'), exitCode: a.exitCode === null ? null : integer(a.exitCode, 'exitCode', -0x80000000, 0x7fffffff), observedAt: isoTime(a.observedAt, 'application time'), windowIds: a.windowIds.map(id => integer(id, 'windowId', 1)) }
    }),
    windows: v.windows.map(row => {
      const w = object(row), g = object(w.geometry)
      return { id: integer(w.id, 'windowId', 1), title: text(w.title, 'window title'), pid: nullableId(w.pid, 'window pid'), mapped: bool(w.mapped, 'mapped'), focusable: w.focusable === null ? null : bool(w.focusable, 'focusable'), focused: bool(w.focused, 'focused'), active: bool(w.active, 'active'), modal: bool(w.modal, 'modal'), transientFor: nullableId(w.transientFor, 'transientFor'), supportsDelete: bool(w.supportsDelete, 'supportsDelete'), geometry: { x: integer(g.x, 'geometry.x', -0x80000000, 0x7fffffff), y: integer(g.y, 'geometry.y', -0x80000000, 0x7fffffff), width: integer(g.width, 'geometry.width', 0, 65535), height: integer(g.height, 'geometry.height', 0, 65535) } }
    }),
    focusedWindowId: nullableId(v.focusedWindowId, 'focusedWindowId'),
    activeWindowId: nullableId(v.activeWindowId, 'activeWindowId'),
    input: { heldKeys: input.heldKeys.map(key => text(key, 'held key', 64)), heldButtons: input.heldButtons.map(button => { if (!['left', 'middle', 'right'].includes(String(button))) invalid('held button'); return button as string }), ...(input.lastAutoReleaseAt == null ? {} : { lastAutoReleaseAt: isoTime(input.lastAutoReleaseAt, 'auto release time') }) },
  }
}
export function pixelProbe(value: unknown, points: Array<{ x: number; y: number }>): PixelProbe {
  const v = object(value)
  if (v.coordinateSpace !== 'desktop' || v.cursorOverlay !== false || !Array.isArray(v.samples) || v.samples.length !== points.length) invalid('probe')
  const samples = v.samples.map((row, index) => {
    const sample = object(row), expected = points[index]!
    if (sample.x !== expected.x || sample.y !== expected.y || !Array.isArray(sample.rgba) || sample.rgba.length !== 4) invalid('probe sample')
    const rgba = sample.rgba.map(channel => integer(channel, 'RGBA channel', 0, 255)) as [number, number, number, number]
    return { x: expected.x, y: expected.y, rgba }
  })
  return { frameId: frameId(v.frameId), capturedAt: isoTime(v.capturedAt, 'probe time'), coordinateSpace: 'desktop', cursorOverlay: false, samples }
}
export function windowOperation(value: unknown, expected: number): WindowOperation {
  const v = object(value)
  if (v.windowId !== expected) invalid('window operation target')
  return { windowId: expected, requested: bool(v.requested, 'requested'), ...(v.confirmed === undefined ? {} : { confirmed: bool(v.confirmed, 'confirmed') }), ...(v.focusedWindowId === undefined ? {} : { focusedWindowId: nullableId(v.focusedWindowId, 'focusedWindowId') }), ...(v.reason === undefined ? {} : { reason: text(v.reason, 'window operation reason', 1000) }) }
}
