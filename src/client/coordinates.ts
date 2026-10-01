/** Coordinate conversion for a fixed-resolution, object-fit: contain preview. */
export interface ViewportRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Actual displayed image rectangle, excluding letterbox bars. */
export interface ImageRect extends ViewportRect { readonly scale: number }

/** @returns the contained image rectangle, or undefined for invalid/unmeasured geometry. */
export function imageRect(bounds: ViewportRect, width: number, height: number): ImageRect | undefined {
  if (![bounds.left, bounds.top, bounds.width, bounds.height, width, height].every(Number.isFinite)
    || bounds.width <= 0 || bounds.height <= 0 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width <= 0 || height <= 0) return undefined
  const scale = Math.min(bounds.width / width, bounds.height / height)
  return {
    left: bounds.left + (bounds.width - width * scale) / 2,
    top: bounds.top + (bounds.height - height * scale) / 2,
    width: width * scale,
    height: height * scale,
    scale,
  }
}

/**
 * Map a CSS-pixel pointer to the immutable remote pixel grid; devicePixelRatio is irrelevant.
 * @param clampDrag - clamp only an already-captured drag; initial clicks in bars must be rejected.
 * @returns integer coordinates or undefined when the pointer is outside the image.
 */
export function remotePoint(bounds: ViewportRect, width: number, height: number,
  clientX: number, clientY: number, clampDrag = false): { x: number; y: number } | undefined {
  const rect = imageRect(bounds, width, height)
  if (rect === undefined || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return undefined
  const x = (clientX - rect.left) / rect.scale
  const y = (clientY - rect.top) / rect.scale
  if (!clampDrag && (x < 0 || y < 0 || x >= width || y >= height)) return undefined
  return { x: Math.max(0, Math.min(width - 1, Math.floor(x))), y: Math.max(0, Math.min(height - 1, Math.floor(y))) }
}
