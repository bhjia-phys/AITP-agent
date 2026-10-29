/** Explicit material publication with recoverable receipts outside scientific records. */
import { dirname, join, posix } from 'node:path'
import { z } from 'zod'
import { normalizedPath, pathForTopicId, resourceIdForPath, sourceFailure } from './markdown-files.ts'
import type { MarkdownWorkspace } from './markdown.ts'
import type { Result, TopicId } from './types.ts'
import type { MaterialReadBack, MaterialTopicLocation, MaterialWriteGrant, MaterialWriteReceipt, MaterialWriteRequest } from './material-types.ts'
import { appendMaterialLink, createMaterialFile, materialDirectory, readMaterialBytes } from './material-files.ts'
import { claim, missing, OnboardingFailure, onboardingFailure, outsideState, safeSource } from './onboarding-files.ts'
import { publishText, readBoundedText } from './writer-storage.ts'

const requestSchema = z.object({ relativePath: z.string(), kind: z.enum(['text', 'pdf']), association: z.object({
  accountPath: z.string(), title: z.string(), description: z.string().optional(),
}).optional() })
const operationSchema = z.object({ format: z.literal(1), root: z.string(), operationId: z.string(), request: requestSchema,
  file: z.enum(['planned', 'publishing', 'saved', 'conflict', 'unknown']),
  association: z.enum(['not-requested', 'planned', 'linking', 'linked', 'conflict', 'unknown']),
})
type Operation = z.infer<typeof operationSchema>

/**
 * Resolve a recognized topic's actual main account without guessing from directory depth.
 * @param reader - existing authorized workspace reader.
 * @param topicId - requested topic; omission selects the existing project root account.
 * @returns the account and directory locations, or the reader's missing/ambiguous/access failure.
 */
export async function resolveMaterialTopic(reader: MarkdownWorkspace, topicId?: TopicId): Promise<Result<MaterialTopicLocation>> {
  try {
    const accountPath = topicId === undefined ? 'research.md' : pathForTopicId(topicId)
    if (topicId !== undefined) {
      const selected = await reader.getTopic(topicId)
      if (!selected.ok) return selected
    } else {
      const selected = await reader.getResource(resourceIdForPath(accountPath))
      if (!selected.ok) return selected
    }
    await safeSource(reader.root, join(reader.root, accountPath), 'file')
    const directory = posix.dirname(accountPath)
    return { ok: true, value: { ...(topicId === undefined ? {} : { topicId }), accountPath,
      directory: directory === '.' ? '' : directory, resourceId: resourceIdForPath(accountPath) } }
  } catch (error) { return { ok: false, error: sourceFailure(error) } }
}

function markdownText(text: string): string {
  return text.replace(/[\\`*_{}[\]<>#!|]/g, '\\$&')
}

function associationLine(request: Operation['request']): string | undefined {
  const association = request.association
  if (association === undefined) return undefined
  const href = posix.relative(posix.dirname(association.accountPath), request.relativePath).split('/').map(encodeURIComponent).join('/')
  return `- [${markdownText(association.title)}](<${href}>)${association.description === undefined ? '' : ` — ${markdownText(association.description)}`}`
}

function diagnostic(error: unknown): string {
  return error instanceof OnboardingFailure ? error.message : 'Storage stopped before all material outcomes could be confirmed. Inspect the reported file and account before another operation.'
}

/** Private writer; its caller retains authority checks, source serialization and observed-change notifications. */
export class MaterialWriter {
  constructor(private readonly grant: MaterialWriteGrant) {}

  /**
   * Save explicitly supplied bytes and optionally link them from an ordinary account or index.
   * @param request - selected target, already authorized content and stable operation identity; retries must match exactly.
   * @returns separate file and association outcomes with current read-back; conflicts never overwrite existing files.
   */
  async save(request: MaterialWriteRequest): Promise<Result<MaterialWriteReceipt>> {
    let operation: Operation | undefined
    let payload: Buffer | undefined
    try {
      if (!this.grant.writable) throw new OnboardingFailure('read-only', 'This destination is registered for reading only. An explicit write grant is required.')
      const bytes = this.validate(request)
      payload = bytes
      const metadata: Operation['request'] = { relativePath: request.relativePath, kind: request.content.kind,
        ...(request.association === undefined ? {} : { association: { accountPath: request.association.accountPath,
          title: request.association.title,
          ...(request.association.description === undefined ? {} : { description: request.association.description }) } }) }
      const planned: Operation = { format: 1, root: this.grant.root, operationId: request.operationId, request: metadata,
        file: 'planned', association: metadata.association === undefined ? 'not-requested' : 'planned' }
      this.serialize(planned)
      const state = await outsideState(this.grant.root, join(this.grant.stateDirectory, 'materials'), true)
      return await claim(state, `${request.operationId}.lock`, async () => {
        const recordPath = join(state, `${request.operationId}.json`)
        const payloadPath = join(state, `${request.operationId}.payload`)
        let previous: Operation | undefined
        try { previous = operationSchema.parse(JSON.parse(await readBoundedText(recordPath, this.grant.maxOperationBytes))) }
        catch (error) { if (!missing(error)) throw error }
        if (previous !== undefined && (previous.root !== this.grant.root || previous.operationId !== request.operationId
          || JSON.stringify(previous.request) !== JSON.stringify(metadata))) {
          throw new OnboardingFailure('operation-reused', 'This operation identity already belongs to a different material request.')
        }
        try {
          const staged = await readMaterialBytes(state, payloadPath, this.grant.maxContentBytes)
          if (!staged.equals(bytes)) throw new OnboardingFailure('operation-reused', 'The material content changed since this operation was reserved. Inspect the earlier outcome and use a new operation identity for different content.')
        } catch (error) {
          if (!missing(error)) throw error
          if (previous !== undefined) throw new OnboardingFailure('unavailable', 'The saved operation payload is missing; inspect the source outcome before retrying.')
          await createMaterialFile(state, payloadPath, bytes)
        }
        operation = previous ?? planned
        const current = operation
        const persist = async (): Promise<void> => { await publishText(recordPath, this.serialize(current), 0o600) }
        if (previous === undefined) await persist()
        const issues: string[] = []
        const target = join(this.grant.root, metadata.relativePath)
        if (current.file === 'planned') {
          await materialDirectory(this.grant.root, dirname(target))
          current.file = 'publishing'
          await persist()
          try {
            await createMaterialFile(this.grant.root, target, bytes)
            current.file = 'saved'
          } catch (error) {
            current.file = error instanceof Error && 'code' in error && error.code === 'EEXIST' ? 'conflict' : 'unknown'
            issues.push(current.file === 'conflict' ? 'The selected name already exists; its bytes were preserved. Choose another name or explicitly edit the existing file.' : diagnostic(error))
          }
          await persist()
        } else if (current.file === 'publishing') {
          current.file = 'unknown'
          issues.push('Publication was interrupted. Read-back describes the current file, but does not identify who saved it. This retry will not overwrite or recreate it.')
          await persist()
        }
        const observed = await this.observe(metadata.relativePath, bytes)
        const line = associationLine(metadata)
        const association = metadata.association
        if (line !== undefined && association !== undefined && current.file === 'saved' && observed.state === 'matches') {
          const account = join(this.grant.root, association.accountPath)
          if (current.association === 'linking' || current.association === 'unknown' || current.association === 'linked') {
            try {
              await safeSource(this.grant.root, account, 'file')
              const text = await readBoundedText(account, this.grant.maxAccountBytes)
              current.association = text.split(/\r?\n/).includes(line) ? 'linked' : current.association === 'linked' ? 'conflict' : 'unknown'
            } catch (error) { issues.push(diagnostic(error)); current.association = 'unknown' }
            await persist()
          } else if (current.association === 'planned') {
            current.association = 'linking'
            await persist()
            try {
              await appendMaterialLink(this.grant.root, account, line, this.grant.maxAccountBytes)
              current.association = 'linked'
            } catch (error) {
              current.association = error instanceof OnboardingFailure || missing(error) ? 'planned' : 'unknown'
              issues.push(diagnostic(error))
            }
            await persist()
          }
        } else if (current.file === 'saved' && observed.state !== 'matches') {
          issues.push('The saved material no longer matches its reserved bytes. Association writes stopped; inspect the external change.')
        }
        return { ok: true, value: this.receipt(current, bytes, observed, issues) }
      })
    } catch (error) {
      if (operation === undefined || payload === undefined) return { ok: false, error: onboardingFailure(error) }
      if (operation.file === 'publishing') operation.file = 'unknown'
      if (operation.association === 'linking') operation.association = 'unknown'
      const observed = await this.observe(operation.request.relativePath, payload)
      return { ok: true, value: this.receipt(operation, payload, observed, [diagnostic(error)], true) }
    }
  }

  private validate(request: MaterialWriteRequest): Buffer {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(request.operationId)) throw new OnboardingFailure('invalid-request', 'A material operation identity must contain 1–128 letters, digits, underscores or hyphens.')
    try {
      normalizedPath(request.relativePath)
      if (request.association !== undefined) normalizedPath(request.association.accountPath)
    } catch (error) { throw new OnboardingFailure('invalid-request', error instanceof Error ? error.message : 'The material destination is invalid.') }
    if ([request.relativePath, ...(request.association === undefined ? [] : [request.association.accountPath])].some(path =>
      /[<>:"|?*\x00-\x1f]/.test(path) || path.split('/').some(part => part === '.git' || part === '.research-memory' || part === 'node_modules'
        || part.endsWith('.') || part.endsWith(' ') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))) {
      throw new OnboardingFailure('invalid-request', 'Choose an ordinary material path outside application and repository metadata.')
    }
    const association = request.association
    if (association !== undefined && (association.accountPath === request.relativePath || !/\.md$/i.test(association.accountPath)
      || !association.title.trim() || /[\r\n\0]/.test(association.title) || /[\r\n\0]/.test(association.description ?? ''))) {
      throw new OnboardingFailure('invalid-request', 'A material association requires a different Markdown account and a one-line title and using passage.')
    }
    const bytes = request.content.kind === 'text' ? Buffer.from(request.content.text, 'utf8') : Buffer.from(request.content.bytes)
    if (bytes.length > this.grant.maxContentBytes || (request.content.kind === 'text' && request.content.text.includes('\0'))) {
      throw new OnboardingFailure('invalid-request', 'The material exceeds its content bound or contains invalid text bytes.')
    }
    if (request.content.kind === 'pdf' && (!/\.pdf$/i.test(request.relativePath) || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))) {
      throw new OnboardingFailure('invalid-request', 'A PDF import requires original PDF bytes and a .pdf destination.')
    }
    if (request.content.kind === 'text' && /\.pdf$/i.test(request.relativePath)) throw new OnboardingFailure('invalid-request', 'Use original PDF bytes to create a PDF file; text is not a PDF.')
    return bytes
  }

  private serialize(operation: Operation): string {
    const text = `${JSON.stringify(operation)}\n`
    if (Buffer.byteLength(text, 'utf8') > this.grant.maxOperationBytes) throw new OnboardingFailure('invalid-request', 'The complete material operation exceeds its application-storage byte bound.')
    return text
  }

  private async observe(relativePath: string, bytes: Buffer): Promise<MaterialReadBack> {
    try {
      const current = await readMaterialBytes(this.grant.root, join(this.grant.root, relativePath), this.grant.maxContentBytes)
      return { state: current.equals(bytes) ? 'matches' : 'different', byteLength: current.length, observedAt: new Date().toISOString() }
    } catch (error) { return { state: missing(error) ? 'missing' : 'unavailable', observedAt: new Date().toISOString() } }
  }

  private receipt(operation: Operation, bytes: Buffer, readBack: MaterialReadBack,
    issues: string[], storageUncertain = false): MaterialWriteReceipt {
    const file = operation.file === 'planned' ? 'not-saved' : operation.file === 'publishing' ? 'unknown' : operation.file
    const association = operation.association === 'planned' ? 'not-linked' : operation.association === 'linking' ? 'unknown' : operation.association
    const retry = storageUncertain || file === 'unknown' || association === 'unknown' || (file === 'saved' && readBack.state !== 'matches') ? 'inspect'
      : file === 'conflict' || association === 'conflict' ? 'new-operation' : file === 'not-saved' || association === 'not-linked' ? 'same-request' : 'none'
    return { operationId: operation.operationId, relativePath: operation.request.relativePath,
      resourceId: resourceIdForPath(operation.request.relativePath), mediaType: operation.request.kind === 'pdf' ? 'application/pdf' : 'text/plain',
      byteLength: bytes.length, file: { state: file, readBack }, association: { state: association,
        ...(operation.request.association === undefined ? {} : { accountPath: operation.request.association.accountPath }) },
      retry, issues }
  }
}
