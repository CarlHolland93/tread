import type { ZoneScore } from '@/lib/vision/types'
import { Progress } from '@/components/ui/progress'
import { scoreColorVar } from '@/lib/utils/score'

/** One wear-zone readout: name, note, and a score-coloured bar. */
export function ZoneBar({ zone }: { zone: ZoneScore }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{zone.name}</span>
        <span className="font-mono text-sm" style={{ color: scoreColorVar(zone.score) }}>
          {zone.score}
        </span>
      </div>
      <Progress value={zone.score} indicatorColor={scoreColorVar(zone.score)} className="h-1" />
      <p className="text-xs text-text-dim">{zone.note}</p>
    </div>
  )
}
