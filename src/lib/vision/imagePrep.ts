/**
 * Resize a captured frame to fit within `maxEdge` and re-encode as JPEG, then
 * return the raw base64 payload (no data-URL prefix) ready for the Anthropic
 * image content block. Keeps requests small + fast on cellular.
 */
export async function blobToBase64Jpeg(
  blob: Blob,
  maxEdge = 1024,
  quality = 0.85,
): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const jpeg = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', quality),
  )
  if (!jpeg) throw new Error('JPEG encoding failed')

  const buf = await jpeg.arrayBuffer()
  // btoa needs a binary string; chunk to avoid call-stack blowups on big frames.
  let bin = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/**
 * Like blobToBase64Jpeg but returns a full data: URL ready to drop into an
 * <img src>. Used to persist a viewable copy of the capture on the scan.
 */
export async function blobToDataUrl(
  blob: Blob,
  maxEdge = 480,
  quality = 0.82,
): Promise<string> {
  const b64 = await blobToBase64Jpeg(blob, maxEdge, quality)
  return `data:image/jpeg;base64,${b64}`
}

/**
 * Pull a single still out of a recorded video blob at the given timestamp.
 * Used so video-mode captures can still feed the (image-only) vision API.
 *
 * iOS Safari quirks handled here:
 *   - An off-DOM <video> refuses to decode, so we attach it hidden first.
 *   - `seeked` fires before the pixel buffer updates, producing black frames.
 *     Two requestAnimationFrame ticks force the renderer to settle before we draw.
 */
export async function videoBlobToFrame(blob: Blob, atSeconds = 1): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  Object.assign(video.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    pointerEvents: 'none',
  })
  video.src = url
  document.body.appendChild(video)

  try {
    await new Promise<void>((res, rej) => {
      const onReady = () => {
        video.removeEventListener('loadeddata', onReady)
        res()
      }
      video.addEventListener('loadeddata', onReady)
      video.addEventListener('error', () => rej(new Error('Video load failed')), { once: true })
      video.load()
    })

    const target = Math.min(atSeconds, Math.max(0, video.duration - 0.05))
    await new Promise<void>((res, rej) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        res()
      }
      video.addEventListener('seeked', onSeeked)
      video.addEventListener('error', () => rej(new Error('Video seek failed')), { once: true })
      video.currentTime = target
    })
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(video, 0, 0)
    const frame = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', 0.9),
    )
    if (!frame) throw new Error('Frame encode failed')
    return frame
  } finally {
    video.remove()
    URL.revokeObjectURL(url)
  }
}
