import type { ScoreStatus } from '@/lib/utils/score'
import { blobToBase64Jpeg } from './imagePrep'
import { MissingApiKeyError, AnalysisError } from './analyseShoe'
import { parseCoreIdentification, type CoreIdentification } from './identification'

export type LiveFinding = {
  /** Stable across polls so chips don't flicker between identical findings. */
  id: string
  severity: ScoreStatus
  label: string
  note: string
}

export type LiveIdentification = CoreIdentification & {
  confidence: 'low' | 'med' | 'high'
}

export type LiveScoutResult = {
  findings: LiveFinding[]
  identification: LiveIdentification | null
}

const MODEL = 'claude-sonnet-4-6'
const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are a running-shoe inspector watching a live camera feed. The user is pointing their phone at a shoe right now. Your job is to call out only what you can clearly see in THIS frame.

Severity for findings:
- "good" = a feature you can confirm looks healthy (e.g. "Outsole tread intact")
- "watch" = visible early wear or minor issue
- "retire" = clear damage, exposed foam, bald rubber, structural failure

Identification — STRICT RULES:
- First, set "visibleText" to the EXACT characters you can read on the shoe in this frame. Quote them verbatim (e.g. "PEGASUS", "GEL-NIMBUS 25", "FRESH FOAM"). Empty string if nothing is legible.
- "brand" must ONLY contain text that actually appears in visibleText. A logo, stripe or tread pattern on its own is not enough.
- "model" must ONLY contain text that actually appears in visibleText. Never infer a model from silhouette, colourway, or "looks like". If the model name is not printed somewhere readable in this frame, set model to null.
- Do not pattern-match against famous shoes. Do not "fill in" a number you didn't read.
- confidence "high" = brand AND model both grounded in visibleText
- confidence "med" = brand grounded in visibleText, no model
- confidence "low" = uncertain brand, or only partial wordmark
- If there is no readable text: return identification: null.

Be conservative everywhere. Empty findings is a valid answer.`

const USER_PROMPT = `Look at this frame. Return:

1. findings — up to 4 SPECIFIC observations about visible wear or condition. Each label must be ≤4 words (e.g. "Heel rubber smooth", "Midsole creasing", "Toe box scuff"). Each note must be ≤10 words.

2. identification — fill visibleText first with whatever characters you can actually read on the shoe right now. Then take brand and model only from that text. Do NOT supply a brand or model unless those exact words appear in visibleText. Return null if there is no readable text.`

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['good', 'watch', 'retire'] },
          label: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['severity', 'label', 'note'],
      },
    },
    identification: {
      type: ['object', 'null'],
      properties: {
        visibleText: { type: 'string' },
        brand: { type: ['string', 'null'] },
        model: { type: ['string', 'null'] },
        confidence: { type: 'string', enum: ['low', 'med', 'high'] },
      },
      required: ['visibleText', 'brand', 'model', 'confidence'],
    },
  },
  required: ['findings', 'identification'],
} as const

/**
 * Run a single live-scout pass against one frame. Cheaper + faster than
 * analyseShoe: smaller image, tighter schema, lower max_tokens. Pass an
 * AbortSignal so the polling hook can cancel on unmount.
 */
export async function liveScout(blob: Blob, signal?: AbortSignal): Promise<LiveScoutResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) throw new MissingApiKeyError()

  const data = await blobToBase64Jpeg(blob, 512, 0.78)

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: 'report_findings',
            description: 'Report visible wear findings from the current frame.',
            input_schema: TOOL_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: 'report_findings' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data },
              },
              { type: 'text', text: USER_PROMPT },
            ],
          },
        ],
      }),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new AnalysisError('Network error reaching Claude API', e)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AnalysisError(`Claude API ${response.status}: ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>
  }
  const toolUse = json.content?.find((b) => b.type === 'tool_use' && b.name === 'report_findings')
  const input = toolUse?.input as
    | { findings?: unknown; identification?: unknown }
    | undefined

  const rawFindings = Array.isArray(input?.findings) ? input.findings : []
  const findings: LiveFinding[] = rawFindings
    .filter(
      (f): f is { severity: ScoreStatus; label: string; note: string } =>
        !!f &&
        typeof f === 'object' &&
        typeof (f as { label?: unknown }).label === 'string' &&
        typeof (f as { note?: unknown }).note === 'string' &&
        ['good', 'watch', 'retire'].includes((f as { severity?: string }).severity ?? ''),
    )
    .map((f) => ({
      id: f.label.toLowerCase(),
      severity: f.severity,
      label: f.label,
      note: f.note,
    }))

  const identification = parseIdentification(input?.identification)

  return { findings, identification }
}

function parseIdentification(raw: unknown): LiveIdentification | null {
  const core = parseCoreIdentification(raw)
  if (!core) return null
  const confidence = (raw as { confidence?: unknown }).confidence
  if (!['low', 'med', 'high'].includes(confidence as string)) return null
  return { ...core, confidence: confidence as 'low' | 'med' | 'high' }
}
