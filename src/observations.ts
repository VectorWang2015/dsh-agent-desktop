import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment/types'
import type { DesktopBroker } from './broker.ts'
import type { Frame } from './types.ts'
import { DesktopError } from './validation.ts'

/** Image persistence may await encoding; never relabel old pixels with a newer owner epoch. */
export async function captureObservation(broker: DesktopBroker, id: string, save: (frame: Frame) => Promise<ImageAttachmentRef>, signal: AbortSignal) {
  const expected = broker.status(id).epoch
  const frame = await broker.frame(id, expected, signal)
  const status = broker.status(id)
  if (status.epoch !== expected) throw new DesktopError('Desktop changed during capture; capture again', 'stale-epoch')
  const image = await save(frame)
  signal.throwIfAborted()
  if (broker.status(id).epoch !== expected) throw new DesktopError('Desktop ownership changed while storing the image; capture again', 'stale-epoch')
  return {
    status,
    coordinates: { desktopWidth: frame.width, desktopHeight: frame.height, imageWidth: image.width, imageHeight: image.height, multiplyImageXBy: frame.width / image.width, multiplyImageYBy: frame.height / image.height },
    image,
  }
}
