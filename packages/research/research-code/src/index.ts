/** Checkout-aware source, diff and history projections over shared source grants. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { normalizedPath, pathForSourceId, resourceEntryId, sourceIdForPath } from '@deepseek-ai/dsh-research-resources'
import type { ResourceBody, ResourceProvider, ResourceSummary, SourceId, SourceProviderContext, SourceRef } from '@deepseek-ai/dsh-research-resources'
import { GitReadError, GitReader } from './git.ts'
import type { CheckoutObservation } from './git.ts'

/** Local Git executable and bounds, supplied to every observation without shell interpolation. */
export interface Config {
  /** Local Git executable invoked directly without a shell. */
  readonly gitExecutable: string
  /** Maximum elapsed milliseconds for one readonly Git process. */
  readonly gitTimeoutMs: number
  /** Maximum complete stdout bytes from one Git observation. */
  readonly maxGitOutputBytes: number
  /** Maximum history entries requested from the local checkout. */
  readonly maxHistoryEntries: number
}

export const Config: z<Partial<Config>, Config> = z.object({
  gitExecutable: z.string().default('git'),
  gitTimeoutMs: z.number().step(1).min(1).max(2147483647).default(15000),
  maxGitOutputBytes: z.number().step(1).min(1).max(268435456).default(1048576),
  maxHistoryEntries: z.number().step(1).min(1).max(10000).default(40),
})
export const name = 'research-code'
export const inject = ['researchResources']

const CHECKOUT_SOURCE = 'git:checkout' as SourceId

function reader(context: SourceProviderContext, config: Config): GitReader {
  return new GitReader(context.rootPath, { executable: config.gitExecutable, timeoutMs: config.gitTimeoutMs,
    maxOutputBytes: config.maxGitOutputBytes, maxHistoryEntries: config.maxHistoryEntries })
}

function metadata(checkout: CheckoutObservation | undefined, path: string): Record<string, string> {
  return { checkoutPath: path, checkoutState: checkout === undefined ? 'not-a-checkout' : 'git',
    ...(checkout === undefined ? {} : { branch: checkout.branch ?? (checkout.head === null ? 'unborn' : 'detached'),
      head: checkout.head ?? 'unborn', dirtyCount: String(checkout.status.length) }) }
}

function selectedLines(text: string, start: number, end: number): ResourceBody {
  const lines = text.split(/(?<=\n)/u)
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length) {
    return { kind: 'unavailable', reason: 'missing', detail: 'The selected code line range does not exist in the observed file.' }
  }
  return { kind: 'text', format: 'code', text: lines.slice(start - 1, end).join(''), startLine: start, endLine: end }
}

/**
 * Contribute actual checkout observations and source ranges without editing or running research code.
 * @param config - complete local Git process limits.
 * @returns a source-catalog and read contribution with no independent root authority.
 */
export function createCodeProvider(config: Config): ResourceProvider {
  return { id: name, domain: 'code',
    async list(context, signal) {
      let checkout: CheckoutObservation | undefined
      try { checkout = await (await reader(context, config).initialize(signal)).inspect(signal) }
      catch (error) {
        if (signal.aborted) throw error
        if (!(error instanceof GitReadError) || error.kind !== 'not-a-checkout') {
          context.reportIssue('', error instanceof GitReadError ? error.message : 'The local checkout could not be inspected.')
        }
      }
      const rootRef: SourceRef = { rootId: context.root.id, sourceId: CHECKOUT_SOURCE }
      const summaries: ResourceSummary[] = [{ id: resourceEntryId(rootRef), ref: rootRef,
        locator: { kind: 'git', view: 'status' }, title: context.root.title,
        kind: 'code', domain: 'code', providerId: name, metadata: { ...metadata(checkout, context.root.displayPath),
          entryKind: 'checkout', ...(checkout === undefined ? {} : { status: JSON.stringify(checkout.status) }),
          attribution: 'unknown' }, links: [], topics: [] }]
      const status = new Map(checkout?.status.map(item => [item.path, item.code]))
      for (const path of context.paths) {
        const reference: SourceRef = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
        const fileStatus = status.get(path)
        summaries.push({ id: resourceEntryId(reference), ref: reference, title: path, kind: 'code', domain: 'code', providerId: name,
          metadata: { ...metadata(checkout, context.root.displayPath), entryKind: 'source-file',
            ...(fileStatus === undefined ? {} : { fileStatus }) }, links: [], topics: [] })
      }
      return summaries
    },
    async read(context, reference, locator, signal) {
      if (reference.sourceId === CHECKOUT_SOURCE || locator?.kind === 'git') {
        try {
          const request = locator?.kind === 'git' ? locator : { kind: 'git' as const, view: 'status' as const }
          const checkoutSource = reference.sourceId === CHECKOUT_SOURCE
          if (!checkoutSource && !reference.sourceId.startsWith('source:')) return undefined
          const selectedPath = checkoutSource ? undefined : pathForSourceId(reference.sourceId)
          const requestedPath = request.path === undefined ? undefined : normalizedPath(request.path)
          if (selectedPath !== undefined && requestedPath !== undefined && selectedPath !== requestedPath) {
            return { kind: 'unavailable', reason: 'unsupported',
              detail: 'This Git location addresses another file. Select that source or the checkout explicitly before reading it.' }
          }
          if (request.revision !== undefined
            && (request.view === 'status' || request.view === 'diff' && (request.scope ?? 'working-tree') !== 'commit')) {
            return { kind: 'unavailable', reason: 'unsupported',
              detail: 'Status and working-tree or staged diffs observe current checkout state. Use commit diff or history for an explicit revision.' }
          }
          const path = selectedPath ?? requestedPath
          const git = await reader(context, config).initialize(signal)
          const revision = request.revision === undefined ? undefined : await git.commit(request.revision, signal)
          if (request.revision !== undefined && revision === undefined) return { kind: 'unavailable', reason: 'missing', detail: 'The requested revision does not resolve to a commit in this checkout.' }
          return { kind: 'text', format: 'plain-text', text: await git.view(request.view, request.scope ?? 'working-tree', revision, path, signal),
            ...(revision === undefined ? {} : { revision }) }
        } catch (error) {
          if (signal.aborted) throw error
          return { kind: 'unavailable', reason: error instanceof GitReadError && error.kind === 'too-large' ? 'too-large' : 'unavailable',
            detail: error instanceof GitReadError ? error.message : 'The requested local Git view is unavailable.' }
        }
      }
      if (!reference.sourceId.startsWith('source:')) return undefined
      if (locator?.kind !== 'code') return undefined
      const path = pathForSourceId(reference.sourceId)
      let text: string
      let revision = 'working-tree'
      if (locator.revision !== undefined && locator.revision !== 'working-tree') {
        const git = await reader(context, config).initialize(signal)
        const resolved = await git.commit(locator.revision, signal)
        if (resolved === undefined) return { kind: 'unavailable', reason: 'missing', detail: 'The requested source revision does not resolve in this checkout.' }
        const content = await git.file(resolved, path, signal)
        if (content === undefined) return { kind: 'unavailable', reason: 'missing', detail: 'The requested normal source file is absent from this commit.' }
        text = content
        revision = resolved
      } else text = await context.files.read(path, signal)
      const body = selectedLines(text, locator.startLine, locator.endLine)
      return body.kind === 'text' ? { ...body, revision } : body
    },
  }
}

/**
 * Mount readonly code and Git views independently of other research domains.
 * @param ctx - Host plugin context with shared source access.
 * @param config - bounded local Git configuration.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.researchResources.registerProvider(createCodeProvider(config)), 'research-code: provider')
}
