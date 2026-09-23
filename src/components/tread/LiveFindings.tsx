import { AnimatePresence, motion } from 'framer-motion'
import { ScanLine, Sparkles } from 'lucide-react'
import type { LiveFinding, LiveIdentification } from '@/lib/vision/liveScout'
import { STATUS_META } from '@/lib/utils/score'
import { cn } from '@/lib/utils/cn'

type Props = {
  findings: LiveFinding[]
  identification: LiveIdentification | null
  inFlight: boolean
  /** A failed poll must never read as a clean shoe. */
  failed: boolean
  checked: boolean
  className?: string
}

/**
 * Stack of live-scout findings rendered over the camera preview. Each finding
 * fades in/out on its own so chips feel like they're tracking the shoe as the
 * user moves the phone. A pulsing status pill anchors the stack so the user
 * knows the scout is alive even when findings are empty.
 */
export function LiveFindings({ findings, identification, inFlight, failed, checked, className }: Props) {
  const empty = findings.length === 0
  // Only show identification chip when we actually have something legible and
  // the confidence is at least "med" — low-confidence guesses cause more harm
  // than good in a live UI.
  const showId =
    identification &&
    identification.confidence !== 'low' &&
    (identification.brand || identification.model)
  const idLabel = identification
    ? [identification.brand, identification.model].filter(Boolean).join(' ')
    : null

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] flex max-w-[min(20rem,calc(100vw-2rem))] flex-col items-start gap-1.5',
        className,
      )}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {showId && idLabel && (
          <motion.div
            key="identification"
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex max-w-full items-center gap-1.5 rounded-full bg-accent/90 py-1 pl-2 pr-3 text-[12px] font-semibold text-bg backdrop-blur-md"
          >
            <ScanLine className="size-3.5 shrink-0" />
            <span className="truncate">{idLabel}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm transition-opacity',
          empty ? 'opacity-100' : 'opacity-70',
        )}
      >
        <motion.span
          className={cn('size-1.5 rounded-full', failed ? 'bg-bad' : 'bg-accent')}
          animate={inFlight ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <Sparkles className="size-3" />
        {!empty
          ? 'Live scout'
          : failed && !inFlight
            ? 'Live scout offline'
            : checked && !inFlight
              ? 'No issues spotted'
              : 'Scouting…'}
      </div>

      <AnimatePresence initial={false}>
        {findings.map((f) => (
          <motion.div
            key={f.id}
            layout
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex max-w-full items-center gap-2 rounded-full bg-black/65 py-1 pl-2 pr-3 text-[12px] text-white backdrop-blur-md"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_META[f.severity].colorVar }}
            />
            <span className="truncate font-medium">{f.label}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
