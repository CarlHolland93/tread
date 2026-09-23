export type ScoreStatus = 'good' | 'watch' | 'retire'

/** Single source of truth for the score → status/colour/label mapping. */
export function scoreStatus(score: number): ScoreStatus {
  if (score >= 80) return 'good'
  if (score >= 50) return 'watch'
  return 'retire'
}

export const STATUS_META: Record<
  ScoreStatus,
  { label: string; colorVar: string; tokenClass: string }
> = {
  good: { label: 'Good', colorVar: 'var(--color-good)', tokenClass: 'text-good' },
  watch: { label: 'Watch', colorVar: 'var(--color-warn)', tokenClass: 'text-warn' },
  retire: { label: 'Retire', colorVar: 'var(--color-bad)', tokenClass: 'text-bad' },
}

export function scoreColorVar(score: number): string {
  return STATUS_META[scoreStatus(score)].colorVar
}

export function scoreLabel(score: number): string {
  return STATUS_META[scoreStatus(score)].label
}
