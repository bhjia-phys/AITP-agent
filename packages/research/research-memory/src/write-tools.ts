import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { ResourceId, Result } from './types.ts'
import type { ResearchOrigin } from './working-types.ts'
import type { ScratchWriter, WriteOperation, WriteProposal } from './writer.ts'

/** Host-selected writer and its explicit source-write grant. */
export interface ResearchWriteTarget {
  /** Writer selected by the host for this origin, with its own durable scope checks. */
  readonly writer: ScratchWriter
  /** Source root used to check the operation and the session workspace boundary. */
  readonly root: string
  /** Explicit host grant; the current session file policy is checked separately. */
  readonly writable: boolean
}

/** Runtime callbacks do not receive model-selected root or authority fields. */
export interface WriteToolsOptions {
  /** Bound serialized tool results, including structured operation metadata. */
  readonly maxResultCharacters: number
  /**
   * Select configured source authority from the real conversation, never model arguments.
   * @param origin Current human-selected research direction from the Session projection.
   * @param session Actual executing Session, whose current file policy remains authoritative.
   * @returns The configured target, or undefined when no writer serves this origin.
   */
  readonly resolveTarget: (origin: ResearchOrigin, session: Session) => Promise<ResearchWriteTarget | undefined>
  /**
   * Notify derived views after a publication or uncertain outcome; failures cannot undo a receipt.
   * @param origin Research direction associated with the operation's owning conversation.
   * @param operation Actual durable outcome, including partial or unknown file states.
   * @returns Resolves once host notification work finishes.
   */
  readonly onApplied?: (origin: ResearchOrigin, operation: WriteOperation) => Promise<void>
}

function bounded(lines: readonly string[], maxCharacters: number): string {
  const included: string[] = []
  let omitted = lines.length
  const footer = (): string => `Details omitted: ${omitted}. Read source passages separately; do not infer complete scientific integration.`
  for (const line of lines) {
    if (JSON.stringify({ text: [...included, line, footer()].join('\n') }).length > maxCharacters) continue
    included.push(line)
    omitted--
  }
  return [...included, footer()].join('\n')
}

function summary(operation: WriteOperation, maxCharacters: number, notificationFailed = false): string {
  const states = new Map<string, number>()
  for (const file of operation.files) states.set(file.state, (states.get(file.state) ?? 0) + 1)
  const lines = [
    `Operation ${operation.operationId}: ${operation.state}.`,
    `Files: ${JSON.stringify(Object.fromEntries(states))}. Remaining scientific uses: ${operation.proposal.remainingUses.length}.`,
    'This is a model-prepared proposal, not an original human decision. Original human inputs remain unchanged.',
    'Scratch writing requires cooperative editing; arbitrary external edits are not globally coordinated.',
    ...(notificationFailed ? ['The source outcome is retained, but view notification failed. Reopen the affected sources.'] : []),
    ...operation.files.map(file => `${file.relativePath}: ${file.state}; current observation: ${file.current?.state ?? 'not rechecked'}.`),
    ...operation.proposal.remainingUses.map(use => `Remaining use: ${use}`),
    ...operation.proposal.edits.flatMap(edit => edit.sourceRefs.map(reference => `Supporting reference: ${reference}`)),
    ...operation.refreshWarnings.map(warning => `Refresh warning: ${warning}`),
  ]
  const metadata = { operationId: operation.operationId, state: operation.state }
  const reserved = JSON.stringify({ ...metadata, meta: { researchWrite: metadata } }).length - 1
  return bounded(lines, maxCharacters - reserved)
}

function unwrap<T>(result: Result<T>, maxCharacters: number): T {
  if (!result.ok) throw new Error(bounded([`Research operation refused (${result.error.code}).`, result.error.message], maxCharacters))
  return result.value
}

function inside(root: string, target: string): boolean {
  const suffix = relative(root, target)
  return suffix === '' || (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${sep}`))
}

/**
 * Register model tools on the existing Harness tool log and active research scope.
 * @param ctx Harness context with tools, researchWorking projection and sandboxPolicy.
 * @param options Host callbacks and complete result bound.
 * @returns Disposes all three tool registrations.
 * @throws If the result bound is invalid or tool registration fails. During execution,
 * tools reject missing authority, foreign operations and forbidden session write scopes.
 */
export function installWriteTools(ctx: Context, options: WriteToolsOptions): () => void {
  if (!Number.isSafeInteger(options.maxResultCharacters) || options.maxResultCharacters < 1024) {
    throw new Error('Research write tool results need maxResultCharacters of at least 1024.')
  }
  const active = async (exec: ToolExecution): Promise<{
    session: Session
    origin: ResearchOrigin
    target: ResearchWriteTarget
    binding: NonNullable<WriteProposal['binding']>
  }> => {
    exec.signal.throwIfAborted()
    if (exec.agent === undefined) throw new Error('Research writing needs an active agent conversation.')
    const session = exec.agent.session
    const origin = ctx.sessionProjections.stateOf(session, 'researchWorking')?.origin
    if (origin === null || origin === undefined) throw new Error('No human-selected research location is bound to this conversation.')
    if (ctx.get('sandboxPolicy') === undefined) throw new Error('The session file policy is unavailable; research writing is disabled.')
    const target = await options.resolveTarget(origin, session)
    if (target === undefined) throw new Error('No scratch writer is configured for this research location.')
    const binding = { sessionId: session.id, workspaceId: origin.workspaceId,
      ...(origin.topicId === undefined ? {} : { topicId: origin.topicId }) }
    return { session, origin, target, binding }
  }
  const boundOperation = async (target: ResearchWriteTarget, binding: NonNullable<WriteProposal['binding']>, id: string): Promise<WriteOperation> => {
    const operation = unwrap(await target.writer.recover(id, binding), options.maxResultCharacters)
    if (operation.sourceRoot !== await realpath(target.root)) throw new Error('This operation belongs to another research root.')
    return operation
  }
  const authorize = async (session: Session, target: ResearchWriteTarget, operation: WriteOperation): Promise<void> => {
    if (!target.writable) throw new Error('The host has not enabled source writing for this research root.')
    const service = ctx.get('sandboxPolicy')
    if (service === undefined) throw new Error('The session file policy is unavailable; research writing is disabled.')
    const policy = service.resolve({ session })
    if (policy.mode === 'read-only') throw new Error('The current session file policy is read-only; the proposal remains unapplied.')
    if (policy.mode === 'workspace-write') {
      const boundary = await realpath(policy.workspaceRoot)
      for (const file of operation.files) {
        const path = await realpath(resolve(target.root, file.relativePath))
        if (!inside(boundary, path)) throw new Error('The proposed source edit is outside this session workspace-write boundary.')
      }
    }
  }
  const output = {
    schema: { type: 'object' as const, additionalProperties: false as const,
      properties: {
        text: { type: 'string' as const, required: true as const },
        operationId: { type: 'string' as const, required: true as const },
        state: { type: 'string' as const, required: true as const },
      } },
    render: (_args: unknown, value: { text: string }) => [{ type: 'text' as const, text: value.text }],
    presentationMeta: (_args: unknown, value: { operationId: string; state: string }) => ({
      researchWrite: { operationId: value.operationId, state: value.state },
    }),
  }
  const present = (operation: WriteOperation, notificationFailed = false) => ({
    text: summary(operation, options.maxResultCharacters, notificationFailed),
    operationId: operation.operationId, state: operation.state,
  })
  const disposers = [ctx.tools.register(defineTool({
    name: 'research_prepare_change',
    description: 'Decide whether the current research work warrants an edit, no change, or a pending outcome. Prepare exact source-passage replacements with rationale, supporting references and remaining affected uses. This does not apply the changes or turn your interpretation into a human decision. Parent uses change only when you explicitly include their affected passages.',
    parameters: {
      disposition: { type: 'string', required: true, enum: ['edit', 'no-change', 'pending'] },
      rationale: { type: 'string', required: true },
      edits: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: {
        resourceId: { type: 'string', required: true,
          description: 'Copy the exact resource: locator shown beside a Source passage in research_read_context. This is not a topic: ID, file path or original human input sourceId; a locator does not grant write permission.' },
        originalText: { type: 'string', required: true },
        replacementText: { type: 'string', required: true }, rationale: { type: 'string', required: true },
        sourceRefs: { type: 'array', required: true, items: { type: 'string' } },
      } } },
      remainingUses: { type: 'array', required: true, items: { type: 'string' } },
    },
    output,
    async execute(args, exec) {
      const { target, binding } = await active(exec)
      const proposal: WriteProposal = {
        disposition: args.disposition, rationale: args.rationale, remainingUses: args.remainingUses, binding,
        edits: args.edits.map(edit => ({ ...edit, resourceId: edit.resourceId as ResourceId })),
      }
      exec.signal.throwIfAborted()
      const operation = unwrap(await target.writer.prepare(proposal), options.maxResultCharacters)
      return present(operation)
    },
  })), ctx.tools.register(defineTool({
    name: 'research_apply_change',
    description: 'Apply a prepared source edit from this conversation and research direction. Existing host write scope and current session file policy must permit it. Reuse the same operationId for a retry; partial or unknown operations are inspected, never automatically replayed. A file save is not complete scientific integration.',
    parameters: { operationId: { type: 'string', required: true } }, output,
    async execute(args, exec) {
      const { session, origin, target, binding } = await active(exec)
      const prepared = await boundOperation(target, binding, args.operationId)
      await authorize(session, target, prepared)
      exec.signal.throwIfAborted()
      const operation = unwrap(await target.writer.apply(args.operationId, undefined, binding), options.maxResultCharacters)
      let notificationFailed = false
      if (options.onApplied !== undefined && operation.files.some(file => file.state === 'applied' || file.state === 'unknown')) {
        try { await options.onApplied(origin, operation) } catch (error) {
          // File receipts already own the outcome; notification failure cannot roll it back.
          if (!(error instanceof Error)) throw error
          notificationFailed = true
        }
      }
      return present(operation, notificationFailed)
    },
  })), ctx.tools.register(defineTool({
    name: 'research_recover_change',
    description: 'Inspect an operation from this conversation and research direction without applying it. Distinguish its historical file outcomes from current source observations. Matching text never makes an interrupted operation successful. Read the named sources before deciding on a new proposal.',
    parameters: { operationId: { type: 'string', required: true } }, output,
    async execute(args, exec) {
      const { target, binding } = await active(exec)
      const operation = await boundOperation(target, binding, args.operationId)
      return present(operation)
    },
  }))]
  return () => { for (const dispose of disposers.toReversed()) dispose() }
}
