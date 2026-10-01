import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment/types'
import type { DesktopBroker } from './broker.ts'
import type { Frame, FrameOptions } from './types.ts'
import { DesktopError } from './validation.ts'

/** Image persistence may await encoding; never relabel old pixels with a newer owner epoch. */
export async function captureObservation(broker: DesktopBroker, id: string, save: (frame: Frame) => Promise<ImageAttachmentRef>, signal: AbortSignal, options: FrameOptions = {}) {
  const expected = broker.status(id).epoch
  const frame = await broker.frame(id, expected, signal, { ...options, fresh: options.fresh ?? true })
  const status = broker.status(id)
  if (status.epoch !== expected) throw new DesktopError('Desktop changed during capture; capture again', 'stale-epoch')
  const image = await save(frame)
  signal.throwIfAborted()
  if (broker.status(id).epoch !== expected) throw new DesktopError('Desktop ownership changed while storing the image; capture again', 'stale-epoch')
  return {
    status,
    frame: { ...(frame.frameId ? { id: frame.frameId } : {}), capturedAt: frame.timestamp, cached: frame.cached === true, cursorOverlay: options.cursor !== false, region: frame.region ?? { x: 0, y: 0, width: frame.width, height: frame.height } },
    coordinates: { desktopWidth: status.width, desktopHeight: status.height, imageWidth: image.width, imageHeight: image.height, multiplyImageXBy: frame.width / image.width, multiplyImageYBy: frame.height / image.height, offsetX: frame.region?.x ?? 0, offsetY: frame.region?.y ?? 0 },
    image,
  }
}
