import { randomUUID } from 'node:crypto'
import { lstat, mkdir, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { MarkdownWorkspace } from './markdown.ts'
import type { Result } from './types.ts'
import { PublicationFailure, publishText, readBoundedText } from './writer-storage.ts'
import type {
  ScratchWriterConfig, SourceEdit, WriteDiagnostic, WriteFileOutcome,
  WriteOperation, WriteProposal,
} from './writer-types.ts'

export type * from './writer-types.ts'

type SourceReader = Pick<MarkdownWorkspace, 'root' | 'readSource' | 'refresh'>
type FailureCode = 'invalid-request' | 'read-only' | 'not-found' | 'unavailable' | 'operation-reused' | 'permission-denied'

class WriteFailure extends Error {
  constructor(readonly code: FailureCode, message: string, readonly diagnostic?: WriteDiagnostic) {
    super(message)
  }
}

function failure(error: unknown): Result<never> {
  return {
    ok: false,
    error: {
      code: error instanceof WriteFailure ? error.code : 'unavailable',
      message: error instanceof Error ? error.message : 'The scratch operation could not be inspected.',
      retryable: false,
    },
  }
}

function inside(root: string, path: string): boolean {
  const suffix = relative(root, path)
  return suffix === '' || (!suffix.startsWith(`..${sep}`) && suffix !== '..' && !isAbsolute(suffix))
}

async function prospectivePath(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    const parent = dirname(path)
    if (parent === path) throw error
    return join(await prospectivePath(parent), basename(path))
  }
}

function patch(text: string, edits: readonly SourceEdit[]): string {
  let result = text
  for (const edit of edits) {
    if (edit.originalText.length === 0) {
      throw new WriteFailure('invalid-request', 'An edit needs a nonempty original passage.')
    }
    const start = result.indexOf(edit.originalText)
    const code = start < 0 ? 'missing-passage'
      : result.indexOf(edit.originalText, start + 1) >= 0 ? 'ambiguous-passage' : null
    if (code !== null) {
      const message = code === 'missing-passage'
        ? 'The original passage is absent. Reopen the source and prepare a new edit.'
        : 'The original passage occurs more than once. Include enough surrounding text to identify it.'
      throw new WriteFailure('invalid-request', message, { code, message })
    }
    result = result.slice(0, start) + edit.replacementText + result.slice(start + edit.originalText.length)
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isEdit(value: unknown): value is SourceEdit {
  return isRecord(value) && typeof value.resourceId === 'string'
    && typeof value.originalText === 'string' && typeof value.replacementText === 'string'
    && typeof value.rationale === 'string' && strings(value.sourceRefs)
}

function isProposal(value: unknown): value is WriteProposal {
  return isRecord(value) && ['edit', 'no-change', 'pending'].includes(String(value.disposition))
    && typeof value.rationale === 'string' && Array.isArray(value.edits) && value.edits.every(isEdit)
    && strings(value.remainingUses)
    && (value.binding === undefined || (isRecord(value.binding)
      && typeof value.binding.sessionId === 'string' && typeof value.binding.workspaceId === 'string'
      && (value.binding.topicId === undefined || typeof value.binding.topicId === 'string')))
}

function isOutcome(value: unknown): value is WriteFileOutcome {
  if (!isRecord(value) || typeof value.resourceId !== 'string' || typeof value.relativePath !== 'string'
    || !['prepared', 'applying', 'applied', 'not-applied', 'unknown'].includes(String(value.state))
    || typeof value.beforeText !== 'string' || typeof value.afterText !== 'string') return false
  if (value.state === 'applied' && typeof value.appliedAt !== 'string') return false
  if (value.appliedAt !== undefined && typeof value.appliedAt !== 'string') return false
  if (value.diagnostic !== undefined && (!isRecord(value.diagnostic)
    || !['missing-passage', 'ambiguous-passage', 'unavailable-source', 'unsafe-path', 'io-failure',
      'readback-differs', 'interrupted'].includes(String(value.diagnostic.code))
    || typeof value.diagnostic.message !== 'string')) return false
  return value.current === undefined || (isRecord(value.current)
    && ['matches-planned-output', 'different', 'unavailable'].includes(String(value.current.state))
    && typeof value.current.observedAt === 'string')
}

function isOperation(value: unknown): value is WriteOperation {
  if (!(isRecord(value) && value.format === 1 && typeof value.operationId === 'string'
    && typeof value.sourceRoot === 'string' && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string' && isProposal(value.proposal)
    && ['prepared', 'no-change', 'pending', 'applying', 'applied', 'not-applied', 'partial', 'unknown']
      .includes(String(value.state))
    && Array.isArray(value.files) && value.files.every(isOutcome)
    && strings(value.refreshWarnings) && value.concurrency === 'cooperative-single-writer')) return false
  const owners = new Set(value.files.map(file => file.resourceId))
  const editedOwners = new Set(value.proposal.edits.map(edit => edit.resourceId))
  if (owners.size !== value.files.length || owners.size !== editedOwners.size
    || [...owners].some(owner => !editedOwners.has(owner))
    || value.proposal.edits.some(edit => edit.originalText.length === 0)) return false
  if (value.proposal.disposition === 'no-change') return value.state === 'no-change' && value.files.length === 0
  if (value.proposal.disposition === 'pending') return value.state === 'pending' && value.files.every(file => file.state === 'prepared')
  if (value.proposal.edits.length === 0 || value.state === 'no-change' || value.state === 'pending') return false
  return value.state !== 'applied' || value.files.every(file => file.state === 'applied')
}

/**
 * Prepare and apply explicit source edits on a configured local scratch root.
 * Calls sharing this instance serialize per owner. External editors must cooperate;
 * no hash/version gate or global filesystem transaction is provided.
 */
export class ScratchWriter {
  private readonly queues = new Map<string, Promise<void>>()

  /**
   * @param workspace Source reader whose real root must match the writable root.
   * @param config Explicit writable scope, separate runtime receipts and byte bound.
   * @throws If the byte bound is invalid or a configured path is not absolute.
   */
  constructor(private readonly workspace: SourceReader, private readonly config: ScratchWriterConfig) {
    if (!Number.isSafeInteger(config.maxOperationBytes) || config.maxOperationBytes <= 0) {
      throw new Error('maxOperationBytes must be a positive safe integer.')
    }
    if (!isAbsolute(config.stateDirectory) || (config.writableRoot !== null && !isAbsolute(config.writableRoot))) {
      throw new Error('Scratch writer roots and runtime state directories must be absolute paths.')
    }
  }

  /**
   * Persist the caller's edit, no-change or pending judgment without changing sources.
   * @param proposal Exact selected passages, rationale and remaining affected uses.
   * @returns A durable operation and reviewable source changes, or a typed rejection for
   * unsafe sources, missing or ambiguous passages, invalid proposals or storage failure.
   */
  async prepare(proposal: WriteProposal): Promise<Result<WriteOperation>> {
    try {
      const roots = await this.roots()
      if (proposal.rationale.trim().length === 0) {
        throw new WriteFailure('invalid-request', 'The editorial decision needs a rationale.')
      }
      if ((proposal.disposition === 'no-change' && proposal.edits.length !== 0)
        || (proposal.disposition === 'edit' && proposal.edits.length === 0)) {
        throw new WriteFailure('invalid-request', 'No-change decisions contain no edits; edit decisions need an edit.')
      }
      const files: WriteFileOutcome[] = []
      for (const resourceId of new Set(proposal.edits.map(edit => edit.resourceId))) {
        const source = await this.workspace.readSource(resourceId)
        if (!source.ok) return source
        await this.safeTarget(roots.sourceRoot, source.value.relativePath)
        const edits = proposal.edits.filter(edit => edit.resourceId === resourceId)
        const afterText = patch(source.value.text, edits)
        files.push({ resourceId, relativePath: source.value.relativePath, state: 'prepared',
          beforeText: source.value.text, afterText })
      }
      const now = new Date().toISOString()
      const operation: WriteOperation = {
        format: 1, operationId: randomUUID() as WriteOperation['operationId'],
        sourceRoot: roots.sourceRoot, createdAt: now, updatedAt: now,
        proposal: structuredClone(proposal),
        state: proposal.disposition === 'edit' ? 'prepared' : proposal.disposition,
        files, refreshWarnings: [], concurrency: 'cooperative-single-writer',
      }
      await this.save(roots.stateDirectory, operation)
      return { ok: true, value: operation }
    } catch (error) {
      return failure(error)
    }
  }

  /**
   * Apply a prepared operation once. Repeated calls return its recorded outcome.
   * Pending, failed, partial and unknown operations are never automatically retried.
   * @param operationId Identity returned by prepare, reused for an identical retry.
   * @param requestId Optional UI retry identity. When supplied it is durably bound to this
   * operation before application; when omitted the operation identity alone owns retries.
   * @param expectedBinding Required for model-bound operations; omitted for unbound human previews.
   * @returns Per-file durable outcomes, or a typed authority, retry-identity or storage
   * rejection. ok alone does not mean every edit was applied; inspect state and files.
   */
  async apply(operationId: string, requestId?: string, expectedBinding?: WriteProposal['binding']): Promise<Result<WriteOperation>> {
    return this.locked([`operation:${operationId}`], async () => {
      try {
        const roots = await this.roots()
        let operation = await this.load(roots, operationId)
        this.checkBinding(operation, expectedBinding, true)
        if (requestId !== undefined) {
          await this.locked(['request-bindings'], () => this.bindRequest(roots.stateDirectory, operationId, requestId))
        }
        if (operation.state !== 'prepared') return { ok: true, value: await this.inspect(roots, operation) }
        if (this.config.writableRoot === null) {
          throw new WriteFailure('read-only', 'Source application is disabled; the prepared operation remains available.')
        }
        return await this.locked(operation.files.map(file => `source:${resolve(roots.sourceRoot, file.relativePath)}`), async () => {
          for (const [index, before] of operation.files.entries()) {
            let current = before
            let sourceAttempted = false
            try {
              const target = await this.safeTarget(roots.sourceRoot, before.relativePath)
              const text = await readBoundedText(target.path, this.config.maxOperationBytes)
              const afterText = patch(text, operation.proposal.edits.filter(edit => edit.resourceId === before.resourceId))
              current = { ...before, state: 'applying', beforeText: text, afterText }
              operation = this.withFile(operation, index, current, 'applying')
              this.serialized(this.withFile(operation, index, { ...current, state: 'applied', appliedAt: new Date().toISOString() }, 'applied'))
              await this.save(roots.stateDirectory, operation)
              // Recheck path confinement before publication; cooperative editing remains required.
              await this.safeTarget(roots.sourceRoot, before.relativePath)
              sourceAttempted = true
              await publishText(target.path, afterText, target.mode)
              const observed = await readBoundedText(target.path, this.config.maxOperationBytes)
              if (observed !== afterText) {
                throw new WriteFailure('unavailable', 'Source readback differs from the planned edit.', {
                  code: 'readback-differs', message: 'Publication was attempted, but the current source differs. Inspect it before preparing another operation.',
                })
              }
              const applied = this.withFile(operation, index, {
                ...current, state: 'applied', appliedAt: new Date().toISOString(),
              }, index + 1 === operation.files.length ? 'applied' : 'applying')
              await this.save(roots.stateDirectory, applied)
              operation = applied
            } catch (error) {
              const uncertain = sourceAttempted
                && !(error instanceof PublicationFailure && !error.attempted)
              const diagnostic: WriteDiagnostic = error instanceof WriteFailure && error.diagnostic !== undefined
                ? error.diagnostic : { code: 'io-failure', message: 'The source operation stopped. Inspect the receipt and current file before preparing another edit.' }
              operation = this.withFile(operation, index, { ...current, state: uncertain ? 'unknown' : 'not-applied', diagnostic },
                uncertain ? 'unknown' : operation.files.some(file => file.state === 'applied') ? 'partial' : 'not-applied')
              try {
                await this.save(roots.stateDirectory, operation)
              } catch (receiptError) {
                // A previously saved applying state is the durable recovery boundary.
                operation = { ...operation, state: 'unknown', refreshWarnings: [
                  ...operation.refreshWarnings, `The outcome receipt could not be saved: ${receiptError instanceof Error ? receiptError.message : 'storage unavailable'}`,
                ] }
              }
              break
            }
          }
          const warnings: string[] = []
          for (const file of operation.files.filter(file => file.state === 'applied' || file.state === 'unknown')) {
            try {
              const refreshed = await this.workspace.refresh(file.resourceId)
              if (!refreshed.ok) warnings.push(`${file.relativePath}: ${refreshed.error.message}`)
            } catch (error) {
              warnings.push(`${file.relativePath}: ${error instanceof Error ? error.message : 'Refresh unavailable'}`)
            }
          }
          if (warnings.length > 0) {
            operation = { ...operation, refreshWarnings: [...operation.refreshWarnings, ...warnings] }
            try {
              await this.save(roots.stateDirectory, operation)
            } catch (error) {
              // The file outcome was already recorded; a failed warning update cannot undo it.
              if (!(error instanceof Error)) throw error
            }
          }
          return { ok: true, value: operation }
        })
      } catch (error) {
        return failure(error)
      }
    })
  }

  /**
   * Inspect a durable operation and the current source without applying any edit.
   * Interrupted applying states become unknown even if the current text matches.
   * @param operationId Existing operation identity.
   * @param expectedBinding When supplied, require that exact model scope before inspecting.
   * Omission permits host inspection of any operation in the writer's root.
   * @returns Historical outcomes plus current observations, or a typed scope, missing
   * operation or storage rejection. Recovery never writes the scientific sources.
   */
  async recover(operationId: string, expectedBinding?: WriteProposal['binding']): Promise<Result<WriteOperation>> {
    return this.locked([`operation:${operationId}`], async () => {
      try {
        const roots = await this.roots()
        const operation = await this.load(roots, operationId)
        this.checkBinding(operation, expectedBinding, false)
        return { ok: true, value: await this.inspect(roots, operation) }
      } catch (error) {
        return failure(error)
      }
    })
  }

  private async roots(): Promise<{ sourceRoot: string; stateDirectory: string }> {
    const sourceRoot = await realpath(this.workspace.root)
    if (this.config.writableRoot !== null && await realpath(this.config.writableRoot) !== sourceRoot) {
      throw new WriteFailure('invalid-request', 'The writable root differs from the source reader root.')
    }
    const configuredState = resolve(this.config.stateDirectory)
    if (inside(sourceRoot, configuredState) || inside(sourceRoot, await prospectivePath(configuredState))) {
      throw new WriteFailure('invalid-request', 'Operation receipts must be stored outside the research root.')
    }
    await mkdir(configuredState, { recursive: true, mode: 0o700 })
    const stateDirectory = await realpath(configuredState)
    if (inside(sourceRoot, stateDirectory)) {
      throw new WriteFailure('invalid-request', 'The runtime state directory resolves inside the research root.')
    }
    return { sourceRoot, stateDirectory }
  }

  private checkBinding(operation: WriteOperation, expected: WriteProposal['binding'], applying: boolean): void {
    const actual = operation.proposal.binding
    if (expected === undefined && (!applying || actual === undefined)) return
    if (expected === undefined || actual === undefined || actual.sessionId !== expected.sessionId
      || actual.workspaceId !== expected.workspaceId || actual.topicId !== expected.topicId) {
      throw new WriteFailure('permission-denied', 'This operation belongs to a different conversation or research direction. Prepare a new edit in the current scope.')
    }
  }

  private async safeTarget(root: string, relativePath: string): Promise<{ path: string; mode: number }> {
    const parts = relativePath.split('/')
    const path = resolve(root, relativePath)
    if (!inside(root, path) || isAbsolute(relativePath) || relativePath.includes('\\')
      || parts.some(part => part === '' || part === '.' || part === '..')) {
      throw new WriteFailure('invalid-request', 'The source path escapes or does not identify a source inside the configured root.',
        { code: 'unsafe-path', message: 'Only explicit regular files inside the scratch root can be edited.' })
    }
    let current = root
    let mode = 0o600
    for (const [index, part] of parts.entries()) {
      current = join(current, part)
      const info = await lstat(current)
      if (info.isSymbolicLink() || (index + 1 === parts.length ? !info.isFile() || info.nlink !== 1 : !info.isDirectory())) {
        throw new WriteFailure('invalid-request', 'Symlinks, shared hardlinks and non-file targets are outside this scratch writer.',
          { code: 'unsafe-path', message: 'The target must be a regular unaliased file inside the scratch root.' })
      }
      mode = info.mode & 0o777
    }
    return { path, mode }
  }

  private receiptPath(stateDirectory: string, operationId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operationId)) {
      throw new WriteFailure('invalid-request', 'The operation identity is invalid.')
    }
    return join(stateDirectory, `${operationId}.json`)
  }

  private async save(stateDirectory: string, operation: WriteOperation): Promise<void> {
    await publishText(this.receiptPath(stateDirectory, operation.operationId), this.serialized(operation), 0o600)
  }

  private serialized(operation: WriteOperation): string {
    const text = `${JSON.stringify(operation)}\n`
    if (Buffer.byteLength(text, 'utf8') > this.config.maxOperationBytes) {
      throw new WriteFailure('invalid-request', 'The complete operation receipt exceeds maxOperationBytes. Prepare a smaller edit.')
    }
    return text
  }

  private async bindRequest(stateDirectory: string, operationId: string, requestId: string): Promise<void> {
    if (requestId.trim().length === 0) throw new WriteFailure('invalid-request', 'A retry identity must not be empty.')
    const path = join(stateDirectory, 'request-bindings.json')
    let bindings: { requestId: string; operationId: string }[] = []
    try {
      const value: unknown = JSON.parse(await readBoundedText(path, this.config.maxOperationBytes))
      if (!Array.isArray(value) || !value.every((item): item is { requestId: string; operationId: string } =>
        isRecord(item) && typeof item.requestId === 'string' && typeof item.operationId === 'string')) {
        throw new WriteFailure('invalid-request', 'The durable retry bindings are malformed.')
      }
      bindings = value
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    }
    const existing = bindings.find(item => item.requestId === requestId)
    if (existing !== undefined) {
      if (existing.operationId !== operationId) {
        throw new WriteFailure('operation-reused', 'This retry identity already belongs to a different prepared edit.')
      }
      return
    }
    const text = `${JSON.stringify([...bindings, { requestId, operationId }])}\n`
    if (Buffer.byteLength(text, 'utf8') > this.config.maxOperationBytes) {
      throw new WriteFailure('invalid-request', 'The durable retry binding store exceeds maxOperationBytes.')
    }
    await publishText(path, text, 0o600)
  }

  private async load(roots: { sourceRoot: string; stateDirectory: string }, operationId: string): Promise<WriteOperation> {
    const path = this.receiptPath(roots.stateDirectory, operationId)
    const value: unknown = JSON.parse(await readBoundedText(path, this.config.maxOperationBytes))
    if (!isOperation(value) || value.operationId !== operationId || value.sourceRoot !== roots.sourceRoot) {
      throw new WriteFailure('invalid-request', 'The durable operation is malformed or belongs to another research root.')
    }
    return value
  }

  private withFile(operation: WriteOperation, index: number, file: WriteFileOutcome, state: WriteOperation['state']): WriteOperation {
    return { ...operation, state, updatedAt: new Date().toISOString(),
      files: operation.files.map((previous, position) => position === index ? file : previous) }
  }

  private async inspect(roots: { sourceRoot: string; stateDirectory: string }, operation: WriteOperation): Promise<WriteOperation> {
    const interrupted = operation.state === 'applying' || operation.files.some(file => file.state === 'applying')
    if (interrupted) {
      operation = { ...operation, state: 'unknown', updatedAt: new Date().toISOString(),
        files: operation.files.map(file => file.state === 'applying' ? { ...file, state: 'unknown', diagnostic: {
          code: 'interrupted', message: 'Application was interrupted before a durable outcome. Current matching text does not establish whether this operation succeeded.',
        } } : file) }
      await this.save(roots.stateDirectory, operation)
    }
    const files: WriteFileOutcome[] = []
    for (const file of operation.files) {
      let state: 'matches-planned-output' | 'different' | 'unavailable' = 'unavailable'
      try {
        const target = await this.safeTarget(roots.sourceRoot, file.relativePath)
        const text = await readBoundedText(target.path, this.config.maxOperationBytes)
        state = text === file.afterText ? 'matches-planned-output' : 'different'
      } catch (error) {
        // A missing or changed source is separate from the historical application outcome.
        if (!(error instanceof Error)) throw error
      }
      files.push({ ...file, current: { state, observedAt: new Date().toISOString() } })
    }
    return { ...operation, files }
  }

  private async locked<T>(keys: readonly string[], action: () => Promise<T>): Promise<T> {
    const held: { key: string; turn: Promise<void>; release: () => void }[] = []
    try {
      for (const key of [...new Set(keys)].sort()) {
        const previous = this.queues.get(key) ?? Promise.resolve()
        let release: () => void = () => {}
        const turn = new Promise<void>((settled) => { release = settled })
        this.queues.set(key, turn)
        held.push({ key, turn, release })
        await previous
      }
      return await action()
    } finally {
      for (const item of held.reverse()) {
        item.release()
        if (this.queues.get(item.key) === item.turn) this.queues.delete(item.key)
      }
    }
  }
}
