import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, KeyRound, RefreshCw, X } from 'lucide-react'
import { useScanStore } from '@/stores/useScanStore'
import { analyseShoe, MissingApiKeyError } from '@/lib/vision/analyseShoe'
import { blobToDataUrl, videoBlobToFrame } from '@/lib/vision/imagePrep'
import { Button } from '@/components/ui/button'

type Phase = 'analysing' | 'error' | 'missing-key'

export function Processing() {
  const navigate = useNavigate()
  const { captures, mode, setResult, reset } = useScanStore()

  const [phase, setPhase] = useState<Phase>('analysing')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const ranRef = useRef(false)

  const run = useCallback(async () => {
    if (captures.length === 0) {
      navigate('/', { replace: true })
      return
    }

    setPhase('analysing')
    setErrorMessage('')
    try {
      // Stills feed BOTH the analysis and the persisted gallery, so extract
      // the video frame once here rather than letting analyseShoe redo it.
      const stillBlobs: Blob[] =
        mode === 'video'
          ? [await videoBlobToFrame(captures[0].blob)]
          : captures.map((c) => c.blob)

      const [result, capturePhotos] = await Promise.all([
        analyseShoe(stillBlobs),
        Promise.all(stillBlobs.map((b) => blobToDataUrl(b))),
      ])

      setResult({ ...result, at: new Date().toISOString(), capturePhotos })
      navigate('/result', { replace: true })
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        setPhase('missing-key')
      } else {
        setPhase('error')
        setErrorMessage(e instanceof Error ? e.message : 'Unknown error')
      }
    }
  }, [captures, mode, setResult, navigate])

  // Fire once on mount. Strict-mode would otherwise double-invoke the API.
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    void run()
  }, [run])

  const cancel = () => {
    reset()
    navigate('/', { replace: true })
  }

  if (phase === 'missing-key') {
    return (
      <ErrorScreen
        icon={<KeyRound className="size-8" />}
        title="Anthropic API key not set"
        body="Add VITE_ANTHROPIC_API_KEY to .env.local at the project root, then restart pnpm dev. Without a key the scan can't run."
        primary={null}
        onCancel={cancel}
      />
    )
  }

  if (phase === 'error') {
    return (
      <ErrorScreen
        icon={<AlertTriangle className="size-8" />}
        title="Couldn't analyse the shoe"
        body={errorMessage || 'Something went wrong reaching the vision model.'}
        primary={
          <Button
            className="w-full"
            onClick={() => {
              ranRef.current = false
              void run()
            }}
          >
            <RefreshCw className="size-4" /> Try again
          </Button>
        }
        onCancel={cancel}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-bg px-8">
      <div className="relative flex size-40 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-accent/30"
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="absolute inset-3 rounded-full border-t-2 border-accent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />
        <span className="font-mono text-sm text-accent">analysing</span>
      </div>

      <h1 className="text-lg font-semibold">Analysing your shoe</h1>
    </div>
  )
}

function ErrorScreen({
  icon,
  title,
  body,
  primary,
  onCancel,
}: {
  icon: React.ReactNode
  title: string
  body: string
  primary: React.ReactNode | null
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg px-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-dim">
        {icon}
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-xs text-sm text-text-dim">{body}</p>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        {primary}
        <Button variant="ghost" className="w-full" onClick={onCancel}>
          <X className="size-4" /> Cancel
        </Button>
      </div>
    </div>
  )
}
