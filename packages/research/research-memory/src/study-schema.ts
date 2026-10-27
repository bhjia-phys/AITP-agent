/** Durable selected-source validation, shared by original human input and study tools. */
import { z } from 'zod'
import type { SourceId, SourceLocator, SourceRootId, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'

const locator = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), start: z.number().int().nonnegative(), end: z.number().int().positive(), quote: z.string() })
    .refine(value => value.end > value.start && value.end - value.start === value.quote.length),
  z.object({ kind: z.literal('anchor'), anchor: z.string().min(1) }),
  z.object({ kind: z.literal('pdf-page'), page: z.number().int().positive(), quote: z.string().optional(),
    region: z.object({ x: z.number(), y: z.number(), width: z.number().nonnegative(),
      height: z.number().nonnegative() }).optional() }),
  z.object({ kind: z.literal('code'), startLine: z.number().int().positive(), endLine: z.number().int().positive(),
    revision: z.string().optional() }).refine(value => value.endLine >= value.startLine),
  z.object({ kind: z.literal('git'), view: z.enum(['status', 'diff', 'history']),
    scope: z.enum(['working-tree', 'staged', 'commit']).optional(), revision: z.string().optional(), path: z.string().optional() }),
]).transform((value): SourceLocator => {
  switch (value.kind) {
    case 'text': return value
    case 'anchor': return value
    case 'pdf-page': return { kind: value.kind, page: value.page,
      ...(value.quote === undefined ? {} : { quote: value.quote }),
      ...(value.region === undefined ? {} : { region: value.region }) }
    case 'code': return { kind: value.kind, startLine: value.startLine, endLine: value.endLine,
      ...(value.revision === undefined ? {} : { revision: value.revision }) }
    case 'git': return { kind: value.kind, view: value.view,
      ...(value.scope === undefined ? {} : { scope: value.scope }),
      ...(value.revision === undefined ? {} : { revision: value.revision }),
      ...(value.path === undefined ? {} : { path: value.path }) }
  }
})

/** A root-qualified source with an optional exact observation; retained text never grants access. */
export const sourceSelectionSchema = z.object({
  ref: z.object({ rootId: z.string().min(1), sourceId: z.string().min(1) }),
  locator: locator.optional(), selectedText: z.string().optional(),
}).transform((value): SourceSelection => ({
  ref: { rootId: value.ref.rootId as SourceRootId, sourceId: value.ref.sourceId as SourceId },
  ...(value.locator === undefined ? {} : { locator: value.locator }),
  ...(value.selectedText === undefined ? {} : { selectedText: value.selectedText }),
}))
