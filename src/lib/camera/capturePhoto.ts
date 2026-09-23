/** Grab the current video frame as a JPEG blob. Returns null if no frame yet. */
export async function capturePhoto(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth) return null
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.92))
}
