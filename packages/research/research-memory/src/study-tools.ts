/** Bounded model reads over the human's selected sources, with the existing Session as authority evidence. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ResearchResources } from '@deepseek-ai/dsh-research-resources'
import { materialSourceAddress, parseMaterialLocator } from '@deepseek-ai/dsh-research-resources/protocol'
import { resolveStudyPassages } from './study-context.ts'

function boundedWindow(header: string, text: string, offset: number, bound: number): string {
  if (JSON.stringify({ text: header }).length > bound) throw new Error('The source locator exceeds the complete read-result bound; use a smaller location.')
  let low = 0, high = Math.min(text.length - offset, bound)
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (JSON.stringify({ text: header + text.slice(offset, offset + middle) }).length <= bound) low = middle
    else high = middle - 1
  }
  return header + text.slice(offset, offset + low)
}

/**
 * Allow fresh, located follow-up reads without admitting new roots or another research task's sources.
 * @param ctx - the research-memory lifetime and its existing tools/projection services.
 * @param resources - shared source authority and readers.
 * @param maxResultCharacters - complete serialized result bound, including source metadata.
 * @returns disposer for this selected-source tool.
 */
export function installStudyTools(ctx: Context, resources: Pick<ResearchResources, 'readResource'>,
  maxResultCharacters: number): () => void {
  return ctx.tools.register(defineTool({
    name: 'research_read_source',
    description: 'Read a current source already selected for this research conversation. sourceIndex is its one-based selected-source number. Optionally specify location as JSON: {"kind":"pdf-page","page":2}, {"kind":"anchor","anchor":"proof"}, or {"kind":"code","startLine":10,"endLine":30,"revision":"commit-id"}. PDF pages and code lines are one-based. offset reopens a bounded character window within the requested passage. This reads evidence, not permission to write or a claim that the whole source was inspected.',
    parameters: {
      sourceIndex: { type: 'integer', required: true }, location: { type: 'string' }, offset: { type: 'integer' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', required: true } } },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('A selected-source read requires a research conversation.')
      const state = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')
      if (state === undefined || !state.ownerOrigin || state.restricted) throw new Error('The current human-selected research sources are unavailable to this conversation.')
      if (!Number.isSafeInteger(args.sourceIndex) || args.sourceIndex < 1) throw new Error('Choose a positive selected-source number.')
      const selected = state.origin?.selections?.[args.sourceIndex - 1]
      if (selected === undefined) throw new Error('This source number is not part of the human-selected source set.')
      const offset = args.offset ?? 0
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('The source read offset must be a nonnegative safe integer.')
      const locator = args.location === undefined ? selected.locator : parseMaterialLocator(args.location)
      const result = await resources.readResource({ ref: selected.ref,
        ...(locator === undefined ? {} : { locator }) }, exec.signal)
      if (!result.ok) throw new Error(result.error.message)
      const reading = result.value
      if (reading.body.kind === 'unavailable') throw new Error(reading.body.detail)
      if (reading.body.kind === 'image') {
        throw new Error('This source is an image preview; no image content, OCR text or visual interpretation was delivered by the text source reader.')
      }
      const text = reading.body.kind === 'text' || locator?.kind === 'pdf-page' && locator.quote !== undefined
        ? resolveStudyPassages(reading, { ref: selected.ref,
          ...(locator === undefined ? {} : { locator }) }).map(passage => passage.text).join('\n\n')
        : reading.body.pages.map(page => `PDF physical page ${page.page}${page.printedPage === undefined ? '' : `; printed page ${page.printedPage}`}\n${page.text}`).join('\n\n')
      if (offset > text.length) throw new Error('The read offset is beyond the current source reading.')
      const header = `Selected source ${args.sourceIndex}: ${reading.resource.title}\n`
        + `Current reading: ${materialSourceAddress(selected.ref, reading.locator ?? locator)}\n`
        + `Observed ${reading.observedAt}; window starts at character ${offset} of ${text.length} in this located passage. Reopen with a further offset when needed.\n`
        + (reading.issues.length === 0 ? '' : `Reading limits: ${reading.issues.join('; ')}\n`)
      return { text: boundedWindow(header, text, offset, maxResultCharacters) }
    },
  }))
}
