/** Browser-local input conversion; no listeners or access to physical devices. */
import type { DesktopAction } from '../types.ts'

/** Fields consumed from a keyboard event on the focused preview only. */
export interface KeyFacts {
  readonly key: string
  readonly code: string
  readonly isComposing?: boolean
  readonly keyCode?: number
  readonly repeat?: boolean
}

const ignoredKeys = new Set(['Dead', 'Process', 'Unidentified', 'Compose'])
const namedKeys = new Set(['Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End',
  'PageUp', 'PageDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Control', 'Alt', 'Shift',
  'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'Pause', 'PrintScreen'])

/** @returns a browser key supported by the Host, excluding unfinished IME/dead-key events. */
export function remoteKey(event: KeyFacts): string | undefined {
  if (event.isComposing || event.keyCode === 229 || ignoredKeys.has(event.key)) return undefined
  if (namedKeys.has(event.key) || /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.key)) return event.key
  return event.key.length === 1 && event.key >= ' ' && event.key <= '~' ? event.key : undefined
}

/** Tracks physical key identity so Shift changes cannot change the matching key-up value. */
export class LocalKeys {
  private readonly held = new Map<string, string>()

  /** @returns one non-repeating key-down, or undefined for IME/unsupported/repeated keys. */
  down(event: KeyFacts): Extract<DesktopAction, { type: 'key' }> | undefined {
    const key = remoteKey(event)
    const identity = event.code || event.key
    if (key === undefined || event.repeat || this.held.has(identity)) return undefined
    this.held.set(identity, key)
    return { type: 'key', key, down: true }
  }

  /** @returns a release only for a key whose down was observed by this local input surface. */
  up(event: KeyFacts): Extract<DesktopAction, { type: 'key' }> | undefined {
    const identity = event.code || event.key
    const key = this.held.get(identity)
    if (key === undefined) return undefined
    this.held.delete(identity)
    return { type: 'key', key, down: false }
  }

  /** Forget local held state; the controller/Host releases any delivered input. */
  clear(): void { this.held.clear() }
}

/** @returns a supported button; extra browser navigation buttons are never forwarded. */
export function remoteButton(button: number): 'left' | 'middle' | 'right' | undefined {
  return button === 0 ? 'left' : button === 1 ? 'middle' : button === 2 ? 'right' : undefined
}

/** Normalize wheel units to a bounded Host pixel delta without scrolling the DSH page. */
export function wheelDelta(delta: number, mode: number, pagePixels: number): number {
  if (!Number.isFinite(delta) || !Number.isFinite(pagePixels) || pagePixels <= 0) return 0
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pagePixels : 1)
  return Math.max(-2000, Math.min(2000, Math.round(pixels)))
}

/** Host text limit is UTF-16 length, matching the JSON endpoint; drafts are never truncated silently. */
export function validText(text: string): boolean {
  return text.length > 0 && text.length <= 4000 && !text.includes('\0')
}
