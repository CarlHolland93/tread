import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ScanLine, SearchX } from 'lucide-react'
import { useScanStore } from '@/stores/useScanStore'
import type { ScanIdentification } from '@/lib/vision/types'
import { ScoreRing } from '@/components/tread/ScoreRing'
import { ScanGallery } from '@/components/tread/ScanGallery'
import { ZoneBar } from '@/components/tread/ZoneBar'
import { Button } from '@/components/ui/button'

export function ScanResult() {
  const navigate = useNavigate()
  const scan = useScanStore((s) => s.result)

  if (!scan) return <Navigate to="/" replace />

  const again = () => navigate('/', { replace: true })

  if (!scan.shoeVisible) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg">
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))]">
          <span className="mx-auto mt-10 flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-dim">
            <SearchX className="size-8" />
          </span>
          <h1 className="mt-4 text-center text-2xl font-bold">No shoe found</h1>
          <p className="mx-auto mt-3 max-w-xs text-center text-[15px] leading-relaxed text-text-dim">
            {scan.summary}
          </p>
          <ScanGallery photos={scan.capturePhotos} zones={[]} className="mt-8" />
        </div>
        <ActionBar label="Try again" onClick={again} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg">
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-center text-sm text-text-dim">
          {scanIdentityLabel(scan.identification)}
        </p>
        <h1 className="mb-6 text-center text-2xl font-bold">Scan complete</h1>

        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          className="flex flex-col items-center"
        >
          <ScoreRing score={scan.overallScore} size={176} strokeWidth={4} />
          <p className="mt-6 max-w-xs text-center text-[15px] leading-relaxed text-text-dim">
            {scan.summary}
          </p>
        </motion.div>

        {scan.capturePhotos.length > 0 && (
          <ScanGallery photos={scan.capturePhotos} zones={scan.zones} className="mt-8" />
        )}

        <h2 className="mb-1 mt-10 text-xs font-medium uppercase tracking-[0.12em] text-text-dimmer">
          Wear by zone
        </h2>
        <div className="flex flex-col gap-6 pt-4">
          {scan.zones.map((z) => (
            <ZoneBar key={z.name} zone={z} />
          ))}
        </div>
      </div>

      <ActionBar label="Scan another shoe" onClick={again} />
    </div>
  )
}

function ActionBar({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-border bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
      <Button className="w-full" onClick={onClick}>
        <ScanLine className="size-4" /> {label}
      </Button>
    </div>
  )
}

/** Only what Claude read off the shoe, never a guess. */
function scanIdentityLabel(id: ScanIdentification | undefined): string {
  if (!id) return 'Unidentified shoe'
  const parts = [id.brand, id.model].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Unidentified shoe'
}
