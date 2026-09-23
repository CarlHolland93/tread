import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CameraOff,
  RefreshCw,
  Upload,
  Video,
  Camera as CameraIcon,
  Zap,
  ZapOff,
} from 'lucide-react'
import { useCameraStream, type Facing } from '@/lib/camera/useCameraStream'
import { capturePhoto } from '@/lib/camera/capturePhoto'
import { useVideoRecorder } from '@/lib/camera/useVideoRecorder'
import { setTorch, torchSupported } from '@/lib/camera/torch'
import { useScanStore, type CaptureMode } from '@/stores/useScanStore'
import { LiveFindings } from '@/components/tread/LiveFindings'
import { Button } from '@/components/ui/button'
import { useLiveScout } from '@/lib/vision/useLiveScout'
import { cn } from '@/lib/utils/cn'

const PHOTO_ANGLES = ['Sole', 'Heel', 'Side', 'Toe and upper']
const PHOTO_COUNT = PHOTO_ANGLES.length

export function Scan() {
  const navigate = useNavigate()
  const { mode, setMode, captures, addCapture, reset } = useScanStore()

  const [facing, setFacing] = useState<Facing>('environment')
  const [torchOn, setTorchOn] = useState(false)
  const { videoRef, streamRef, error, ready, retry } = useCameraStream(facing, true)
  const recorder = useVideoRecorder()
  const flashRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    reset()
  }, [reset])

  // Live scout: keep polling Claude for the entire scan session — including
  // between photo captures and during video recording — so the user always
  // sees live context while filming. Stops only when the camera is gone.
  const scoutActive = ready
  const scout = useLiveScout(videoRef, { active: scoutActive })

  // Torch capability is only knowable once the stream is live — resolve it in
  // an effect rather than reading the ref during render.
  const [canTorch, setCanTorch] = useState(false)
  useEffect(() => {
    setCanTorch(ready ? torchSupported(streamRef.current) : false)
  }, [ready, streamRef])

  const flash = () => {
    const el = flashRef.current
    if (!el) return
    el.style.opacity = '1'
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 320ms ease-out'
      el.style.opacity = '0'
    })
  }

  const handlePhoto = async () => {
    if (!videoRef.current || !ready) return
    const blob = await capturePhoto(videoRef.current)
    if (!blob) return
    flash()
    addCapture(blob)
    if (captures.length + 1 >= PHOTO_COUNT) navigate('/processing')
  }

  const handleVideo = () => {
    if (!streamRef.current) return
    if (recorder.recording) {
      recorder.stop()
    } else {
      recorder.start(streamRef.current, (blob) => {
        addCapture(blob)
        navigate('/processing')
      })
    }
  }

  const toggleTorch = async () => {
    const next = !torchOn
    const ok = await setTorch(streamRef.current, next)
    if (ok) setTorchOn(next)
  }

  // ---- Fallback states -------------------------------------------------

  if (error?.kind === 'unsupported') {
    return (
      <Fallback
        title="Camera not available"
        body="Tread needs a camera to scan your shoes. Try Safari or Chrome on a recent device."
      >
        <label className="w-full">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                addCapture(file)
                navigate('/processing')
              }
            }}
          />
          <span className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent font-semibold text-bg">
            <Upload className="size-4" /> Upload a photo instead
          </span>
        </label>
      </Fallback>
    )
  }

  if (error?.kind === 'denied' || error?.kind === 'notfound' || error?.kind === 'other') {
    const body =
      error.kind === 'denied'
        ? 'Camera access was blocked. Enable it in your browser settings, then try again.'
        : error.kind === 'notfound'
          ? 'No camera was found on this device.'
          : error.message
    return (
      <Fallback title="Can't reach the camera" body={body}>
        <Button className="w-full" onClick={retry}>
          <RefreshCw className="size-4" /> Allow camera
        </Button>
      </Fallback>
    )
  }

  // ---- Live camera -----------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="size-full object-cover"
      />

      {/* Shutter flash */}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 bg-white opacity-0"
        aria-hidden
      />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Starting camera…
        </div>
      )}

      {/* Live wear detection — subtle chips top-left only. */}
      {scoutActive && !scout.missingKey && (
        <LiveFindings
          findings={scout.findings}
          identification={scout.identification}
          inFlight={scout.inFlight}
          failed={scout.error !== null}
          checked={scout.checked}
        />
      )}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <RoundBtn
          label="Toggle torch"
          onClick={toggleTorch}
          disabled={!canTorch}
          className={cn(!canTorch && 'opacity-40')}
        >
          {torchOn ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
        </RoundBtn>
      </div>

      {/* Recording indicator */}
      {recorder.recording && (
        <div className="absolute left-1/2 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-sm">
          <span className="size-2.5 animate-pulse rounded-full bg-bad" />
          <span className="font-mono text-xs text-white">
            {String(Math.floor(recorder.elapsed / 60)).padStart(2, '0')}:
            {String(recorder.elapsed % 60).padStart(2, '0')} / 00:{recorder.maxSeconds}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {mode === 'photo' && captures.length < PHOTO_COUNT && (
          <p
            aria-live="polite"
            className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
          >
            Photo {captures.length + 1} of {PHOTO_COUNT} · {PHOTO_ANGLES[captures.length]}
          </p>
        )}

        {/* Locked once a photo is taken, so one scan never mixes photos and video. */}
        {!recorder.recording && captures.length === 0 && (
          <ModeToggle mode={mode} onChange={setMode} />
        )}

        <div className="flex w-full items-center justify-around px-10">
          <RoundBtn
            label="Switch camera"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            disabled={recorder.recording}
            className={cn(recorder.recording && 'opacity-40')}
          >
            <RefreshCw className="size-5" />
          </RoundBtn>

          <button
            type="button"
            aria-label={mode === 'photo' ? 'Take photo' : recorder.recording ? 'Stop recording' : 'Start recording'}
            disabled={!ready}
            onClick={mode === 'photo' ? handlePhoto : handleVideo}
            className="flex size-20 items-center justify-center rounded-full border-4 border-white/90 disabled:opacity-50"
          >
            {mode === 'photo' ? (
              <span className="size-16 rounded-full bg-white" />
            ) : recorder.recording ? (
              <span className="size-7 rounded-md bg-bad" />
            ) : (
              <span className="size-16 rounded-full bg-bad" />
            )}
          </button>

          {/* Spacer to balance the switch-camera button */}
          <span className="size-11" aria-hidden />
        </div>
      </div>
    </div>
  )
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: CaptureMode
  onChange: (m: CaptureMode) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/45 p-1 backdrop-blur-sm">
      {(['photo', 'video'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
            mode === m ? 'bg-white text-black' : 'text-white/80',
          )}
        >
          {m === 'photo' ? <CameraIcon className="size-3.5" /> : <Video className="size-3.5" />}
          {m === 'photo' ? 'Photo' : 'Video'}
        </button>
      ))}
    </div>
  )
}

function RoundBtn({
  children,
  label,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function Fallback({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg px-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-dim">
        <CameraOff className="size-8" />
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-xs text-sm text-text-dim">{body}</p>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">{children}</div>
    </div>
  )
}
