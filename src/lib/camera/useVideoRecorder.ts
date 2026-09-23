import { useRef, useState } from 'react'

const PREFERRED_MIME = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]

const MAX_SECONDS = 30

/** MediaRecorder wrapper with elapsed timer and 30s auto-stop. */
export function useVideoRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function start(stream: MediaStream, onComplete: (blob: Blob) => void) {
    chunksRef.current = []
    const mime = PREFERRED_MIME.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)

    rec.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' })
      onComplete(blob)
      setRecording(false)
      setElapsed(0)
      if (timerRef.current) window.clearInterval(timerRef.current)
    }

    rec.start(250)
    recorderRef.current = rec
    setRecording(true)

    const startedAt = Date.now()
    timerRef.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(s)
      if (s >= MAX_SECONDS) stop()
    }, 200)
  }

  return { start, stop, recording, elapsed, maxSeconds: MAX_SECONDS }
}
