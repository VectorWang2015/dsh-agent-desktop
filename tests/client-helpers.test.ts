import { describe, expect, it } from 'vitest'
import { imageRect, remotePoint } from '../src/client/coordinates.ts'
import { LocalKeys, remoteButton, remoteKey, validText, wheelDelta } from '../src/client/input.ts'
import { DesktopRequestError, parseControlResult, parseHttpError, parseStatus, pngSize } from '../src/client/protocol.ts'
import type { DesktopStatus } from '../src/types.ts'

const status: DesktopStatus = { sessionId: 's1', state: 'running', owner: 'agent', epoch: 4,
  backend: 'native-x11', width: 1280, height: 720 }

function png(width: number, height: number): Blob {
  const bytes = new Uint8Array(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return new Blob([bytes], { type: 'image/png' })
}

describe('fixed resolution coordinates', () => {
  it('accounts for pillarboxes and offset without device-pixel scaling', () => {
    const bounds = { left: 20, top: 30, width: 1000, height: 500 }
    expect(imageRect(bounds, 800, 800)).toEqual({ left: 270, top: 30, width: 500, height: 500, scale: 0.625 })
    expect(remotePoint(bounds, 800, 800, 520, 280)).toEqual({ x: 400, y: 400 })
    expect(remotePoint(bounds, 800, 800, 30, 200)).toBeUndefined()
    expect(remotePoint(bounds, 800, 800, 1000, 200)).toBeUndefined()
  })
  it('rejects top/bottom letterboxes and the exclusive right/bottom image edge', () => {
    const bounds = { left: 0, top: 0, width: 640, height: 480 }
    expect(remotePoint(bounds, 1280, 720, 320, 59)).toBeUndefined()
    expect(remotePoint(bounds, 1280, 720, 0, 60)).toEqual({ x: 0, y: 0 })
    expect(remotePoint(bounds, 1280, 720, 639.9, 419.9)).toEqual({ x: 1279, y: 719 })
    expect(remotePoint(bounds, 1280, 720, 640, 300)).toBeUndefined()
    expect(remotePoint(bounds, 1280, 720, 300, 420)).toBeUndefined()
  })
  it('clamps only explicitly captured drags to legal final pixels', () => {
    const bounds = { left: 10, top: 20, width: 640, height: 360 }
    expect(remotePoint(bounds, 1280, 720, -100, 800, true)).toEqual({ x: 0, y: 719 })
    expect(remotePoint(bounds, 1280, 720, 9999, -2, true)).toEqual({ x: 1279, y: 0 })
  })
  it.each([0, -1, Infinity, NaN])('rejects unmeasured/invalid dimensions %s', dimension => {
    expect(imageRect({ left: 0, top: 0, width: dimension, height: 400 }, 1280, 720)).toBeUndefined()
    expect(remotePoint({ left: 0, top: 0, width: 400, height: 400 }, dimension, 720, 0, 0, true)).toBeUndefined()
  })
  it('rejects nonfinite pointers and fractional remote resolution', () => {
    const bounds = { left: 0, top: 0, width: 640, height: 360 }
    expect(remotePoint(bounds, 1280, 720, NaN, 0, true)).toBeUndefined()
    expect(imageRect(bounds, 1280.5, 720)).toBeUndefined()
  })
})

describe('local human input helpers', () => {
  it.each(['Dead', 'Process', 'Unidentified', 'Compose', '中文', '你'])('does not turn %s into key packets', key => {
    expect(remoteKey({ key, code: 'KeyA' })).toBeUndefined()
  })
  it('ignores IME and legacy keyCode 229 while accepting named keys', () => {
    expect(remoteKey({ key: 'Enter', code: 'Enter', isComposing: true })).toBeUndefined()
    expect(remoteKey({ key: 'a', code: 'KeyA', keyCode: 229 })).toBeUndefined()
    expect(remoteKey({ key: 'ArrowLeft', code: 'ArrowLeft' })).toBe('ArrowLeft')
    expect(remoteKey({ key: 'F12', code: 'F12' })).toBe('F12')
    expect(remoteKey({ key: ' ', code: 'Space' })).toBe(' ')
  })
  it('preserves the down key through modifier changes and ignores repeats/unknown ups', () => {
    const keys = new LocalKeys()
    expect(keys.down({ key: 'A', code: 'KeyA' })).toEqual({ type: 'key', key: 'A', down: true })
    expect(keys.down({ key: 'A', code: 'KeyA', repeat: true })).toBeUndefined()
    expect(keys.up({ key: 'a', code: 'KeyA' })).toEqual({ type: 'key', key: 'A', down: false })
    expect(keys.up({ key: 'a', code: 'KeyA' })).toBeUndefined()
    keys.down({ key: 'Control', code: 'ControlLeft' })
    keys.clear()
    expect(keys.up({ key: 'Control', code: 'ControlLeft' })).toBeUndefined()
  })
  it('limits buttons and converts/clamps all wheel delta modes', () => {
    expect([0, 1, 2, 3, -1].map(remoteButton)).toEqual(['left', 'middle', 'right', undefined, undefined])
    expect(wheelDelta(3, 1, 720)).toBe(48)
    expect(wheelDelta(-1, 2, 720)).toBe(-720)
    expect(wheelDelta(50000, 0, 720)).toBe(2000)
    expect(wheelDelta(NaN, 0, 720)).toBe(0)
  })
  it('matches Host UTF-16 text and NUL bounds without truncating Chinese/emoji', () => {
    expect(validText('你好，世界\n😀')).toBe(true)
    expect(validText('a'.repeat(4000))).toBe(true)
    expect(validText('😀'.repeat(2001))).toBe(false)
    expect(validText('')).toBe(false)
    expect(validText('a\0b')).toBe(false)
  })
})

describe('wire response validation', () => {
  it('preserves optional app/viewer metadata without opening a viewer', () => {
    const value = { ...status, viewerUrl: 'https://invalid.example/viewer', applications: [{ id: '1', command: 'xterm', running: true }] }
    expect(parseStatus(value, 's1')).toEqual(value)
  })
  it.each([
    { sessionId: 's2' }, { owner: 'observer' }, { state: ['running'] }, { epoch: -1 }, { epoch: 1.5 },
    { width: 0 }, { height: Infinity }, { applications: [{ id: '1', command: 0, running: true }] },
  ])('rejects malformed or cross-session status %j', invalid => {
    expect(() => parseStatus({ ...status, ...invalid }, 's1')).toThrow(DesktopRequestError)
  })
  it('retains an authoritative error status and rejects invalid error attachments', () => {
    const error = parseHttpError({ error: 'epoch changed', status }, 's1', 409)
    expect(error.status).toEqual(status)
    expect(error.httpStatus).toBe(409)
    expect(() => parseHttpError({ error: 'denied', status: { ...status, sessionId: 's2' } }, 's1', 409)).toThrow()
  })
  it('projects tokens out of status/error data and validates one-shot capabilities separately', () => {
    const value = { ...status, controlToken: 'one-shot-secret-capability', extra: 'discard' }
    expect(parseStatus(value, 's1')).not.toHaveProperty('controlToken')
    expect(parseStatus(value, 's1')).not.toHaveProperty('extra')
    expect(parseHttpError({ error: 'stale', status: value }, 's1', 409).status).not.toHaveProperty('controlToken')
    expect(parseControlResult(value, 's1').controlToken).toBe(value.controlToken)
    expect(() => parseControlResult({ ...status, controlToken: 'bad\r\nheader' }, 's1')).toThrow(DesktopRequestError)
  })
  it('extracts PNG geometry and rejects arbitrary data before preview', async () => {
    await expect(pngSize(png(1280, 720))).resolves.toEqual({ width: 1280, height: 720 })
    await expect(pngSize(new Blob(['not a PNG']))).rejects.toThrow('Invalid PNG')
  })
})
