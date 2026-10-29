/** Presentation-only excerpts. Source fields stay intact for editing and located questions. */

/**
 * Omit one recognized section heading already supplied by the surrounding UI.
 * Keep custom headings, nested headings, code and all body text unchanged.
 * @param text - the provider's complete source section.
 * @param label - exact structural heading names recognized by the caller.
 * @returns the section body when its leading heading duplicates the UI label.
 */
export function topicExcerpt(text: string, label: RegExp): string {
  const heading = /^(?:[\t ]*\r?\n)* {0,3}#{1,6}[\t ]+([^\r\n]+?)(?:[\t ]+#+)?[\t ]*(?:\r?\n|$)/.exec(text)
    ?? /^(?:[\t ]*\r?\n)*([^\r\n]+)\r?\n {0,3}(?:=+|-+)[\t ]*(?:\r?\n|$)/.exec(text)
  return heading?.[1] !== undefined && label.test(heading[1].trim()) ? text.slice(heading[0].length).trimStart() : text
}

/** Structural labels recognized by the Markdown research adapter; never inferred from prose. */
export const topicSectionLabels = {
  answer: /^(current answer|current conclusion|当前答案|当前结论|当前认识)$/i,
  gap: /^(limitations?|open questions?|局限|未解决问题|缺口)$/i,
  scope: /^(scope|范围|研究范围)$/i,
}

/**
 * Show the first authored paragraph as an overview, omitting empty HTML anchor markers.
 * The full source remains available from the account reader.
 * @param text - the original question or account opening.
 * @returns its first paragraph without an otherwise visible anchor marker.
 */
export function overviewQuestion(text: string): string {
  const cleaned = omitAnchorMarkers(text).trim()
  return cleaned.split(/\r?\n[\t ]*\r?\n/)[0]?.trim() ?? ''
}

/**
 * Remove legacy anchor markup from an authored overview without changing its prose.
 * @param text - authored Markdown.
 * @returns text without empty legacy anchor elements.
 */
export function omitAnchorMarkers(text: string): string {
  return text.replace(/<a\s+[^>]*(?:id|name)\s*=\s*["'][^"']+["'][^>]*>\s*<\/a>/gi, '')
}

/** Legacy adapter absence messages are UI copy, not researcher-authored qualifications. */
export const absentTopicScope = 'Scope is not separately stated; inspect the full source account.'
/** Legacy adapter message for qualifications not separately stated in the source account. */
export const absentTopicQualification = 'The source does not separately state qualifications; inspect the complete account.'
