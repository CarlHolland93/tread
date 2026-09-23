export type ZoneScore = {
  name: string
  score: number
  note: string
  /** Index into Scan.capturePhotos this zone was observed in. */
  photoIndex?: number
  /** Normalised 0–1 region in capturePhotos[photoIndex] where this finding sits. */
  bbox?: { x: number; y: number; w: number; h: number }
}

export type ScanIdentification = {
  brand: string | null
  model: string | null
  /** Verbatim text Claude could read off the shoe. Empty if none was legible. */
  visibleText: string
}

export type Scan = {
  at: string
  /** False when Claude found no shoe in any photo; the scores are then meaningless. */
  shoeVisible: boolean
  overallScore: number
  status: 'good' | 'watch' | 'retire'
  summary: string
  zones: ZoneScore[]
  identification?: ScanIdentification
  /** Captures from this scan as data URLs, ~480px max edge. */
  capturePhotos: string[]
}
