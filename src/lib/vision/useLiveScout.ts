import { useEffect, useRef, useState } from 'react'
import { liveScout, type LiveFinding, type LiveIdentification } from './liveScout'
import { MissingApiKeyError } from './analyseShoe'

type Options = {
  /** Polling only runs while this is true. */
  active: boolean
  /** Milliseconds between polls. Honoured as a floor — next call only starts after the previous resolves. */
  intervalMs?: number
  /** Wait this long after activation before the first call so the user can frame the shoe. */
  warmupMs?: number
}

type State = {
  findings: LiveFinding[]
  identification: LiveIdentification | null
  inFlight: boolean
  /** True once a poll has succeeded, so an empty list means "nothing seen", not "not looked yet". */
  checked: boolean
  missingKey: boolean
  /** Last error message — null if the last successful poll cleared it. */
  error: string | null
}

const INITIAL: State = {
  findings: [],
  identification: null,
  inFlight: false,
  checked: false,
  missingKey: false,
  error: null,
}

/**
 * Drive a polled live-scout against the given video element. Grabs a frame on
 * a fixed cadence (with in-flight guarding), sends it to Claude, surfaces the
 * latest findings. Aborts the in-flight request on unmount or when `active`
 * flips off.
 */
export function useLiveScout(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { active, intervalMs = 2500, warmupMs = 1500 }: Options,
): State {
  const [state, setState] = useState<State>(INITIAL)

  // Stash the latest state in refs so the polling loop can guard without
  // re-subscribing every render.
  const inFlightRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!active) {
      // Reset on deactivate so chips don't linger on re-entry.
      setState(INITIAL)
      return
    }
    let cancelled = false
    let timer: number | null = null

    const grabFrame = async (): Promise<Blob | null> => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || !video.videoWidth) return null
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(video, 0, 0)
      return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    }

    const tick = async () => {
      // Skip when another call is in flight or when the tab is backgrounded —
      // hidden polling burns battery, data, and API spend for no UI gain.
      if (cancelled || inFlightRef.current || document.hidden) return
      const blob = await grabFrame()
      if (!blob || cancelled) return

      const ctrl = new AbortController()
      abortRef.current = ctrl
      inFlightRef.current = true
      setState((s) => ({ ...s, inFlight: true }))

      try {
        const result = await liveScout(blob, ctrl.signal)
        if (cancelled) return
        setState((s) => ({
          findings: result.findings,
          // Keep the last name read: a sole or heel frame has no text, and that isn't new evidence.
          identification: result.identification ?? s.identification,
          inFlight: false,
          checked: true,
          missingKey: false,
          error: null,
        }))
      } catch (e) {
        if ((e as Error).name === 'AbortError' || cancelled) return
        if (e instanceof MissingApiKeyError) {
          setState({ ...INITIAL, missingKey: true })
          cancelled = true // no point retrying without a key
          return
        }
        setState((s) => ({ ...s, inFlight: false, error: (e as Error).message }))
      } finally {
        inFlightRef.current = false
        abortRef.current = null
      }
    }

    const loop = () => {
      void tick()
      timer = window.setTimeout(loop, intervalMs)
    }
    timer = window.setTimeout(loop, warmupMs)

    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [active, intervalMs, warmupMs, videoRef])

  return state
}
