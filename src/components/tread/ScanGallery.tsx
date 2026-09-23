import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { ZoneScore } from '@/lib/vision/types'
import { scoreColorVar, scoreStatus } from '@/lib/utils/score'
import { cn } from '@/lib/utils/cn'

type Props = {
  photos: string[]
  zones: ZoneScore[]
  className?: string
}

/**
 * Captured photos with per-zone callouts pinned at the bbox Claude identified.
 * The lead image defaults to whichever photo carries the most retire-tier
 * findings, then the highest-severity ones overall — so the worst news shows
 * up first. Thumbnail strip below lets the user flip between captures.
 */
export function ScanGallery({ photos, zones, className }: Props) {
  const leadDefault = useMemo(() => pickLeadIndex(zones, photos.length), [zones, photos.length])
  const [active, setActive] = useState(leadDefault)
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  if (!photos.length) return null

  const photo = photos[active] ?? photos[0]
  const onPhoto = zones.filter((z) => (z.photoIndex ?? 0) === active && z.bbox)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-surface-2">
        <img src={photo} alt="" className="block w-full" />

        {/* Pin overlay — absolutely positioned by normalised bbox. */}
        <div className="pointer-events-none absolute inset-0">
          {onPhoto.map((z) => {
            const color = scoreColorVar(z.score)
            const status = scoreStatus(z.score)
            const isHover = hoveredZone === z.name
            const b = z.bbox!
            return (
              <motion.div
                key={z.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="pointer-events-auto absolute"
                style={{
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `${b.w * 100}%`,
                  height: `${b.h * 100}%`,
                }}
                onMouseEnter={() => setHoveredZone(z.name)}
                onMouseLeave={() => setHoveredZone(null)}
              >
                <span
                  className="absolute inset-0 rounded-md ring-2"
                  style={{ borderColor: color, boxShadow: `0 0 0 1px ${color}` }}
                />
                <span
                  className={cn(
                    'absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-bg shadow-md',
                    status === 'good' && 'bg-good',
                    status === 'watch' && 'bg-warn',
                    status === 'retire' && 'bg-bad',
                  )}
                >
                  {z.score}
                </span>
                {isHover && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-1/2 top-[calc(100%+6px)] flex max-w-[16rem] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/85 py-1 pl-2 pr-2.5 text-[11px] font-medium text-white"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {z.name}
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Thumbnail strip — only show when there's more than one capture. */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p, i) => {
            const zonesHere = zones.filter((z) => (z.photoIndex ?? 0) === i)
            const worst = zonesHere.reduce(
              (acc, z) => Math.min(acc, z.score),
              100,
            )
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  'relative shrink-0 overflow-hidden rounded-[var(--radius-md)] ring-2 ring-offset-2 ring-offset-bg transition',
                  i === active ? 'ring-accent' : 'ring-transparent',
                )}
                aria-label={`Photo ${i + 1}`}
              >
                <img src={p} alt="" className="block size-16 object-cover" />
                {zonesHere.length > 0 && (
                  <span
                    className="absolute right-1 top-1 size-2 rounded-full"
                    style={{ backgroundColor: scoreColorVar(worst) }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Pick the photo carrying the most concerning findings. */
function pickLeadIndex(zones: ZoneScore[], photoCount: number): number {
  if (photoCount <= 1) return 0
  const buckets = Array.from({ length: photoCount }, () => ({ retire: 0, watch: 0, min: 100 }))
  for (const z of zones) {
    const i = z.photoIndex ?? 0
    const s = scoreStatus(z.score)
    if (s === 'retire') buckets[i].retire += 1
    if (s === 'watch') buckets[i].watch += 1
    if (z.score < buckets[i].min) buckets[i].min = z.score
  }
  let bestIdx = 0
  for (let i = 1; i < buckets.length; i++) {
    const a = buckets[i]
    const b = buckets[bestIdx]
    if (
      a.retire > b.retire ||
      (a.retire === b.retire && a.watch > b.watch) ||
      (a.retire === b.retire && a.watch === b.watch && a.min < b.min)
    ) {
      bestIdx = i
    }
  }
  return bestIdx
}
