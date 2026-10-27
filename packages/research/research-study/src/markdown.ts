/** Portable Markdown export of explicitly saved drafts, with source selections kept distinct. */
import { materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import type { StudyArtifact } from './types.ts'

function label(value: string): string { return value.replace(/[\[\]\\]/gu, character => `\\${character}`) }

/**
 * Export actual saved content and recorded references without inventing model output or review status.
 * @param artifact - complete plugin-owned draft.
 * @returns Markdown retaining its provisional status, origin and exact selected quotations.
 */
export function exportStudyMarkdown(artifact: StudyArtifact): string {
  const capture = artifact.capture
  const lines = [`# ${artifact.title}`, '', `Study draft: ${artifact.kind}; provisional; ${artifact.origin}${artifact.edited ? '; edited after saving' : ''}.`,
    `Saved by host owner. Artifact ${artifact.id}; version ${artifact.version}.`, '', artifact.markdown]
  if (capture !== undefined) lines.push('', '## Saved answer', '',
    `Model ${capture.provider}/${capture.model}; Session ${capture.sessionId}; assistant sequence ${capture.seq}; message ${capture.messageId}.`)
  if (artifact.citations.length > 0) {
    lines.push('', '## Source references', '')
    for (const citation of artifact.citations) {
      const selection = citation.selection
      lines.push(`- [${label(`${selection.ref.rootId}/${selection.ref.sourceId}`)}](${materialSourceAddress(selection.ref, selection.locator)}) — ${citation.basis}${citation.seq === undefined ? '' : `; Session ${citation.sessionId}; sequence ${citation.seq}`}.`)
      const quote = selection.selectedText ?? (selection.locator?.kind === 'text' || selection.locator?.kind === 'pdf-page' ? selection.locator.quote : undefined)
      if (quote !== undefined) lines.push('', ...quote.split(/\r?\n/gu).map(line => `  > ${line}`), '')
    }
  }
  if (capture?.contexts.length) lines.push('', '## Recorded context', '',
    'These are recorded context and tool-result references, not evidence that every selected source or page was read.', '',
    ...capture.contexts.flatMap(context => [`### ${context.name} — sequence ${context.seq}`, '', context.text, '']))
  return `${lines.join('\n').trimEnd()}\n`
}
