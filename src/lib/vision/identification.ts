/**
 * Shared shoe-identification parsing. Both the live scout (per-frame) and the
 * full analysis call Claude to read brand/model off a shoe; both must apply
 * the same anti-hallucination rules. Anything specific to one call site
 * (e.g. confidence on the live scout) is layered on after this base parse.
 */

export type CoreIdentification = {
  brand: string | null
  model: string | null
  /** Verbatim text Claude says it could read on the shoe. Empty when none was legible. */
  visibleText: string
}

/**
 * Validate and normalise the identification block from a Claude tool-use
 * response. Returns null when there's nothing legible. Brand and model are
 * each dropped unless their text appears in visibleText, which is the
 * anti-hallucination guard.
 */
export function parseCoreIdentification(raw: unknown): CoreIdentification | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as { brand?: unknown; model?: unknown; visibleText?: unknown }
  const visibleText = typeof obj.visibleText === 'string' ? obj.visibleText.trim() : ''
  // A sole's tread pattern once read as "Adidas" on a Salomon, so logos alone don't count.
  const brand = readOnShoe(obj.brand, visibleText)
  const model = readOnShoe(obj.model, visibleText)
  if (!brand && !model) return null
  return { brand, model, visibleText }
}

function readOnShoe(value: unknown, visibleText: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const v = value.trim()
  return visibleText.toLowerCase().includes(v.toLowerCase()) ? v : null
}
