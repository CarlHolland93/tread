import { useEffect, useRef, useState } from 'react'

export type Facing = 'environment' | 'user'

export type CameraError =
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'notfound' }
  | { kind: 'other'; message: string }

/**
 * Owns a getUserMedia stream bound to a <video> element. Restarts when `facing`
 * changes, and tears the stream down on unmount or when disabled — no zombies.
 */
export function useCameraStream(facing: Facing, enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<CameraError | null>(null)
  const [ready, setReady] = useState(false)
  // Bumped by retry() to force the effect to re-run after a permission prompt.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const start = async () => {
      setReady(false)
      setError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError({ kind: 'unsupported' })
        return
      }

      try {
        streamRef.current?.getTracks().forEach((t) => t.stop())

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch (e) {
        if (cancelled) return
        const err = e as DOMException
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError')
          setError({ kind: 'denied' })
        else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')
          setError({ kind: 'notfound' })
        else setError({ kind: 'other', message: err.message ?? 'Unknown camera error' })
      }
    }

    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setReady(false)
    }
  }, [facing, enabled, attempt])

  const retry = () => setAttempt((n) => n + 1)

  return { videoRef, streamRef, error, ready, retry }
}
