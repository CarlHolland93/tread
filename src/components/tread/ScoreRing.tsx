import { scoreColorVar, scoreLabel } from '@/lib/utils/score'
import { cn } from '@/lib/utils/cn'

type ScoreRingProps = {
  score: number
  size?: number
  strokeWidth?: number
  /** Show the "Good/Watch/Retire" label under the number. */
  showLabel?: boolean
  className?: string
}

/** Circular condition-score gauge. Colour follows the score band. */
export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 4,
  showLabel = true,
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference - (clamped / 100) * circumference
  const color = scoreColorVar(score)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Condition score ${clamped} out of 100, ${scoreLabel(score)}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-light leading-none tracking-tight"
          style={{ color, fontSize: size * 0.32 }}
        >
          {clamped}
        </span>
        {showLabel && (
          <span
            className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim"
          >
            {scoreLabel(score)}
          </span>
        )}
      </div>
    </div>
  )
}
