import type { Scan } from './types'
import { blobToBase64Jpeg } from './imagePrep'
import { parseCoreIdentification } from './identification'

export type AnalysisResult = Omit<Scan, 'id' | 'at' | 'capturePhotos'>

export class MissingApiKeyError extends Error {
  constructor() {
    super('VITE_ANTHROPIC_API_KEY is not set. Add it to .env.local and restart `pnpm dev`.')
    this.name = 'MissingApiKeyError'
  }
}

export class AnalysisError extends Error {
  cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'AnalysisError'
    this.cause = cause
  }
}

const MODEL = 'claude-sonnet-4-6'
const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are an expert running-shoe condition inspector. You are shown one or more photos of a single pair (or single shoe) and must produce a structured wear assessment.

Score each zone 0–100 where:
- 100 = brand new, no visible wear
- 70 = light wear, still safe and performant
- 40 = noticeable wear, watch closely
- 20 = heavily worn, replace soon
- 0 = unsafe / completely worn out

Ground every score in something you can actually see in the photos: smooth/bald rubber patches, exposed midsole foam, midsole creasing or compression, asymmetric wear, upper tears or separation, lacing eyelet damage. If a zone is not visible in any photo, score it 60 and say "not visible in photos" in the note.

Be honest. A clearly worn-out shoe should score in the teens or twenties, not the forties. A barely-used shoe should score in the 90s.

First decide whether a shoe is visible in any photo at all. If none is, set shoeVisible to false and say in the summary what the photos show instead. The scores are then ignored.

Write every note and the summary as plain sentences. Use full stops and commas, never dashes.`

const USER_PROMPT = `Analyse these shoe photos and call the \`report_wear\` tool with your assessment.

Cover these four zones (use these exact names):
- "Outsole · heel"
- "Outsole · forefoot"
- "Midsole foam"
- "Upper / mesh"

For each zone, set "photoIndex" to the 0-based index of the photo where you most clearly observed that zone. The photos are provided in order: index 0 is the first image, index 1 the second, and so on. If multiple photos show the zone, pick the clearest.

For each zone also set "bbox" to a normalised rectangle (0–1 coords, top-left origin) covering the region of that chosen photo where the zone is most visible. x and y are the top-left corner; w and h are the width and height. Keep the box tight — typically 0.15–0.35 across. If you cannot locate the zone in the photo, set bbox to null.

For the summary, write ONE short, plain-English sentence a runner would understand. No hedging. Examples:
- "Retire this pair. The heel rubber is bald and the midsole has bottomed out."
- "Still in good shape, but the forefoot rubber is starting to thin."
- "Brand new, nothing to flag."

Set status based on overallScore: ≥75 "good", 50–74 "watch", <50 "retire".

Identification — STRICT RULES:
- Look across all the photos and set "visibleText" to the EXACT characters you can read on the shoe (e.g. "PEGASUS", "GEL-NIMBUS 25", "FRESH FOAM", "HOKA"). Empty string if nothing is legible across any photo.
- "brand" must ONLY contain text that actually appears in visibleText. A logo, stripe or tread pattern on its own is not enough.
- "model" must ONLY contain text that actually appears in visibleText. Do not infer the model from silhouette, colourway, or "looks like". If the model name is not readable in any photo, set model to null.
- Do not assume the shoe matches any specific brand or model unless you can see it. If no text is readable, return identification: null.`

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    shoeVisible: { type: 'boolean' },
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    status: { type: 'string', enum: ['good', 'watch', 'retire'] },
    summary: { type: 'string' },
    zones: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          note: { type: 'string' },
          photoIndex: { type: 'integer', minimum: 0 },
          bbox: {
            type: ['object', 'null'],
            properties: {
              x: { type: 'number', minimum: 0, maximum: 1 },
              y: { type: 'number', minimum: 0, maximum: 1 },
              w: { type: 'number', minimum: 0, maximum: 1 },
              h: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['x', 'y', 'w', 'h'],
          },
        },
        required: ['name', 'score', 'note', 'photoIndex', 'bbox'],
      },
    },
    identification: {
      type: ['object', 'null'],
      properties: {
        visibleText: { type: 'string' },
        brand: { type: ['string', 'null'] },
        model: { type: ['string', 'null'] },
      },
      required: ['visibleText', 'brand', 'model'],
    },
  },
  required: ['shoeVisible', 'overallScore', 'status', 'summary', 'zones', 'identification'],
} as const

/**
 * Send captured frames to Claude vision and get back a structured wear report.
 * Throws MissingApiKeyError if VITE_ANTHROPIC_API_KEY is unset, AnalysisError
 * on any API/parse failure.
 */
export async function analyseShoe(stillBlobs: Blob[]): Promise<AnalysisResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) throw new MissingApiKeyError()
  if (stillBlobs.length === 0) throw new AnalysisError('No captured frames to analyse')

  // 768px is the sweet spot for shoe-wear vision: small enough to keep Sonnet
  // fast (~40% fewer vision tokens vs 1024), still detailed enough to read
  // tread, foam creasing, and upper damage.
  const images = await Promise.all(stillBlobs.map((b) => blobToBase64Jpeg(b, 768, 0.82)))

  const content: Array<Record<string, unknown>> = [
    ...images.map((data) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data },
    })),
    { type: 'text', text: USER_PROMPT },
  ]

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: 'report_wear',
            description: 'Report the structured shoe wear assessment.',
            input_schema: TOOL_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: 'report_wear' },
        messages: [{ role: 'user', content }],
      }),
    })
  } catch (e) {
    throw new AnalysisError('Network error reaching Claude API', e)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AnalysisError(`Claude API ${response.status}: ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>
  }
  const toolUse = json.content?.find((b) => b.type === 'tool_use' && b.name === 'report_wear')
  if (!toolUse?.input) {
    throw new AnalysisError('Claude did not return a structured assessment')
  }

  const input = toolUse.input as Partial<AnalysisResult>
  if (typeof input.overallScore !== 'number' || !Array.isArray(input.zones)) {
    throw new AnalysisError('Claude returned malformed assessment payload')
  }

  const photoCount = stillBlobs.length
  const zones = input.zones.map((z) => {
    const photoIndex =
      typeof z.photoIndex === 'number' && z.photoIndex >= 0 && z.photoIndex < photoCount
        ? z.photoIndex
        : 0
    const rawBbox = z.bbox as unknown
    const bbox =
      rawBbox && typeof rawBbox === 'object'
        ? (() => {
            const b = rawBbox as { x?: unknown; y?: unknown; w?: unknown; h?: unknown }
            const nums = [b.x, b.y, b.w, b.h]
            if (!nums.every((n) => typeof n === 'number' && n >= 0 && n <= 1)) return undefined
            const [x, y, w, h] = nums as number[]
            if (w < 0.02 || h < 0.02) return undefined
            return { x, y, w, h }
          })()
        : undefined
    return { ...z, photoIndex, bbox }
  })

  return {
    // Anything but an explicit false counts as visible, so a schema slip can't blank a real scan.
    shoeVisible: input.shoeVisible !== false,
    overallScore: input.overallScore,
    status: input.status ?? deriveStatus(input.overallScore),
    summary: input.summary ?? '',
    zones,
    identification: parseAnalysisIdentification(
      (input as { identification?: unknown }).identification,
    ),
  }
}

function deriveStatus(score: number): 'good' | 'watch' | 'retire' {
  if (score >= 75) return 'good'
  if (score >= 50) return 'watch'
  return 'retire'
}

/** Convert the shared core parser's null sentinel to undefined to match the Scan shape. */
function parseAnalysisIdentification(raw: unknown) {
  return parseCoreIdentification(raw) ?? undefined
}
