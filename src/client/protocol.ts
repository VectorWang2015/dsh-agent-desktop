/** Validate Host JSON/PNG responses before granting a local input capability. */
import type { DesktopControlResult, DesktopStatus } from '../types.ts'

/** Request/response failures retain optional authoritative status, never an input grant. */
export class DesktopRequestError extends Error {
  constructor(readonly kind: 'network' | 'http' | 'protocol' | 'frame', message: string,
    readonly status?: DesktopStatus, readonly httpStatus?: number) {
    super(message)
    this.name = 'DesktopRequestError'
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function integer(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min
}
function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}
function desktopState(value: unknown): value is DesktopStatus['state'] {
  return typeof value === 'string' && ['stopped', 'starting', 'running', 'stopping', 'error'].includes(value)
}
function desktopOwner(value: unknown): value is DesktopStatus['owner'] {
  return value === 'none' || value === 'agent' || value === 'human'
}
function parseApplication(value: unknown): NonNullable<DesktopStatus['applications']>[number] {
  if (!record(value) || typeof value.id !== 'string' || typeof value.command !== 'string'
    || typeof value.running !== 'boolean' || (value.pid !== undefined && !integer(value.pid, 1))) {
    throw new DesktopRequestError('protocol', 'Invalid desktop applications response')
  }
  return { id: value.id, command: value.command, running: value.running,
    ...(value.pid === undefined ? {} : { pid: value.pid }) }
}

/** @returns validated session-bound status; unknown fields do not confer capabilities. */
export function parseStatus(value: unknown, sessionId: string): DesktopStatus {
  if (!record(value) || value.sessionId !== sessionId
    || !desktopState(value.state) || !desktopOwner(value.owner)
    || !integer(value.epoch, 0) || typeof value.backend !== 'string'
    || !integer(value.width, 1) || !integer(value.height, 1)
    || value.width > 32768 || value.height > 32768
    || !['startedAt', 'lastFrameAt', 'lastActionAt', 'error', 'display', 'viewerUrl'].every(key => optionalString(value[key]))) {
    throw new DesktopRequestError('protocol', 'Invalid desktop status response')
  }
  if (value.applications !== undefined && !Array.isArray(value.applications)) {
    throw new DesktopRequestError('protocol', 'Invalid desktop applications response')
  }
  // Explicit projection prevents one-shot control capabilities/unknown fields reaching an observable.
  return {
    sessionId, state: value.state, owner: value.owner, epoch: value.epoch, backend: value.backend,
    width: value.width, height: value.height,
    ...(typeof value.startedAt === 'string' ? { startedAt: value.startedAt } : {}),
    ...(typeof value.lastFrameAt === 'string' ? { lastFrameAt: value.lastFrameAt } : {}),
    ...(typeof value.lastActionAt === 'string' ? { lastActionAt: value.lastActionAt } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
    ...(typeof value.display === 'string' ? { display: value.display } : {}),
    ...(typeof value.viewerUrl === 'string' ? { viewerUrl: value.viewerUrl } : {}),
    ...(value.applications === undefined ? {} : { applications: value.applications.map(parseApplication) }),
  }
}

/** Parse a one-shot control reply; the caller must keep controlToken out of observable state. */
export function parseControlResult(value: unknown, sessionId: string): DesktopControlResult {
  const status = parseStatus(value, sessionId)
  if (!record(value) || value.controlToken === undefined) return status
  if (typeof value.controlToken !== 'string' || !/^[A-Za-z0-9_-]{16,512}$/.test(value.controlToken)) {
    throw new DesktopRequestError('protocol', 'Invalid desktop control capability')
  }
  return { ...status, controlToken: value.controlToken }
}

/** @returns a useful HTTP error without accepting malformed error-status attachments. */
export function parseHttpError(value: unknown, sessionId: string, httpStatus: number): DesktopRequestError {
  let status: DesktopStatus | undefined
  if (record(value) && value.status !== undefined) status = parseStatus(value.status, sessionId)
  return new DesktopRequestError('http', record(value) && typeof value.error === 'string'
    ? value.error : `HTTP ${httpStatus}`, status, httpStatus)
}

/** @returns the PNG's IHDR dimensions, before any object URL is exposed to React. */
export async function pngSize(blob: Blob): Promise<{ width: number; height: number }> {
  const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer())
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length !== 24 || signature.some((byte, index) => bytes[index] !== byte)
    || bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) {
    throw new DesktopRequestError('frame', 'Invalid PNG response')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
