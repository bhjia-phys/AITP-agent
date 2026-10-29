/** Located prefixes of already observed sources under complete response/request bounds. */
import type { ResearchContextEntry } from './working-types.ts'

/**
 * Keep a fitting source prefix, preferring a complete line when it retains most text and preserving UTF-16 pairs.
 * @param text - exact observed text, not a generated summary.
 * @param fits - monotonic bound over the complete serialized response or request.
 * @returns an exact nonblank prefix, or undefined when no useful source text fits.
 */
export function fittingSourcePrefix(text: string, fits: (candidate: string) => boolean): string | undefined {
  if (fits(text)) return text.trim() === '' ? undefined : text
  let lower = 0, upper = text.length
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2)
    if (fits(text.slice(0, middle))) lower = middle
    else upper = middle - 1
  }
  if (lower > 0 && /[\uD800-\uDBFF]/.test(text.charAt(lower - 1))) lower--
  const lineEnd = text.lastIndexOf('\n', lower - 1)
  const end = lineEnd >= Math.floor(lower / 2) && text.slice(0, lineEnd + 1).trim() !== '' ? lineEnd + 1 : lower
  const prefix = text.slice(0, end)
  return prefix.trim() === '' || !fits(prefix) ? undefined : prefix
}

/**
 * Retain an observed source range for refitting after original human inputs consume request space.
 * @param entry - source text and owning identity before final request admission.
 * @param start - exact UTF-16 start in that observed file; omission forbids guessed locations.
 * @returns the source entry with a located fallback when the source offset is known.
 */
export function refittableSource(entry: ResearchContextEntry, start?: number): ResearchContextEntry {
  if (start === undefined) return entry
  const part = (text: string): ResearchContextEntry => ({ ...entry, text,
    source: { ...entry.source, locator: `UTF-16 characters [${start}, ${start + text.length}) in the observed source` } })
  return { ...part(entry.text), excerpt: (fits) => {
    const text = fittingSourcePrefix(entry.text, candidate => fits(part(candidate)))
    return text === undefined ? undefined : part(text)
  } }
}
