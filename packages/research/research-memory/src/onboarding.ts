/** Explicit owner enrollment and durable creation of ordinary linked research accounts. */
import { randomUUID } from 'node:crypto'
import { lstat, mkdir } from 'node:fs/promises'
import { basename, dirname, join, posix, sep } from 'node:path'
import { z } from 'zod'
import { pathForResourceId, pathForTopicId, resourceIdForPath, topicIdForPath } from './markdown-files.ts'
import type { MarkdownWorkspace } from './markdown.ts'
import type { CreateTopicReceipt, CreateTopicRequest, ResearchInitializeRequest, Result, Revision, TopicId } from './types.ts'
import { appendChild, claim, createAccount, missing, OnboardingFailure, onboardingFailure, outsideState, safeSource, syncDirectory } from './onboarding-files.ts'
import { publishText, readBoundedText } from './writer-storage.ts'

const enrollmentSchema = z.object({ format: z.literal(1), roots: z.array(z.object({
  path: z.string(), writable: z.boolean(), stateDirectory: z.string(),
})) })
const requestSchema = z.object({ operationId: z.string(), title: z.string(), question: z.string(),
  scope: z.string().optional(), parentTopicId: z.string().optional(), directory: z.string().optional() })
const operationSchema = z.object({ format: z.literal(1), sourceRoot: z.string(), request: requestSchema,
  // Older receipts always used research.md or the selected topic; preserve their interpretation.
  parentPath: z.string().optional(),
  relativePath: z.string(), state: z.enum(['reserved', 'published', 'complete', 'partial', 'unknown']),
  receipt: z.object({ operationId: z.string(), topicId: z.string(), resourceId: z.string() }),
})
type Operation = z.infer<typeof operationSchema>
/** Persisted source authority, separate from scientific account contents. */
export type EnrolledRoot = z.infer<typeof enrollmentSchema>['roots'][number]

function markdownText(text: string): string {
  return text.replace(/[\\`*_{}[\]<>#!|]/g, '\\$&')
}

/**
 * Build only the confirmed opening and optional collection links for a missing account.
 * @param account - confirmed project choices.
 * @returns the initial account, without invented scientific findings.
 */
export function initialAccountText(account: NonNullable<ResearchInitializeRequest['account']>): string {
  const sources = account.libraries ?? []
  return `# ${markdownText(account.title.trim())}\n\n${markdownText(account.question.trim())}\n`
    + (account.scope?.trim() ? `\n${markdownText(account.scope.trim())}\n` : '')
    + '\n## 当前工作\n\n课题信息已确认，研究结论尚未记录。\n\n## 子方向\n'
    + (['literature', 'knowledge', 'code'] as const).map((domain) => {
      const selected = sources.filter(source => source.domain === domain)
      if (selected.length === 0) return ''
      return `\n## ${domain === 'literature' ? '文献库' : domain === 'knowledge' ? '知识库' : '代码库'}\n\n`
        + selected.map(source => `- [${markdownText(source.title)}](<${source.path.split(sep).map(encodeURIComponent).join('/')}>)\n`).join('')
    }).join('')
}

function sameRequest(left: Operation['request'], right: CreateTopicRequest): boolean {
  return left.operationId === right.operationId && left.title === right.title && left.question === right.question
    && left.scope === right.scope && left.parentTopicId === right.parentTopicId && left.directory === right.directory
}

/** Owns enrollment storage and creation receipts; source writes use the root's shared writer serialization. */
export class ResearchOnboarding {
  constructor(private readonly stateHome: (() => string) | undefined, private readonly maxBytes: number,
    private readonly maxSourceBytes: number) {}

  /**
   * Check the application-state location without creating directories or probing write permission.
   * @param root - canonical scientific root that must not contain application state.
   * @returns whether a home resolver exists and its prospective state location resolves outside the root.
   */
  async available(root: string): Promise<boolean> {
    if (this.stateHome === undefined) return false
    try { await outsideState(root, this.stateHome(), false); return true }
    catch (error) { if (!(error instanceof Error)) throw error; return false }
  }

  /**
   * Read enrollment freshly so restart and other Hosts observe the saved grant.
   * @param root - canonical scientific root whose exact enrollment is requested.
   * @returns its saved enrollment, or undefined when storage or the matching enrollment is absent.
   * @throws when configured storage is unsafe, malformed or unreadable; such failures never grant source access.
   */
  async enrolled(root: string): Promise<EnrolledRoot | undefined> {
    if (this.stateHome === undefined) return undefined
    const state = await outsideState(root, this.stateHome(), false)
    try {
      const record = enrollmentSchema.parse(JSON.parse(await readBoundedText(join(state, 'enrollments.json'), this.maxBytes)))
      return record.roots.find(item => item.path === root)
    } catch (error) { if (missing(error)) return undefined; throw error }
  }

  /**
   * Save explicit root authorization; writable enrollment alone may create a missing minimal root account.
   * Existing account bytes are preserved, and read-only enrollment creates no scientific files.
   * @param root - registered canonical root authorized by the calling owner service.
   * @param request - explicit source-write choice; the caller serializes changes with its existing root writer.
   * @param reader - authorized reader used to recognize an existing family account before initialization.
   * @param existingAccountPath - internally observed account required to remain present; this mode never creates a scientific file.
   * @returns the durably saved enrollment, or a typed storage/access failure; earlier account creation is not rolled back.
   */
  async initialize(root: string, request: ResearchInitializeRequest, reader?: MarkdownWorkspace,
    existingAccountPath?: string): Promise<Result<EnrolledRoot>> {
    if (this.stateHome === undefined) return { ok: false, error: { code: 'unsupported', message: 'This host does not provide application storage for research enrollment.', retryable: false } }
    try {
      const state = await outsideState(root, this.stateHome(), true)
      return await claim(state, 'enrollment.lock', async () => {
        let record: z.infer<typeof enrollmentSchema> = { format: 1, roots: [] }
        try { record = enrollmentSchema.parse(JSON.parse(await readBoundedText(join(state, 'enrollments.json'), this.maxBytes))) }
        catch (error) { if (!missing(error)) throw error }
        await safeSource(root, root, 'directory')
        if (existingAccountPath !== undefined) {
          try { await safeSource(root, join(root, existingAccountPath), 'file') }
          catch (error) {
            if (!missing(error)) throw error
            return { ok: false, error: { code: 'not-found', retryable: false,
              message: 'The previously observed research account is no longer present. No replacement account was created and saving was not enabled.' } }
          }
        } else {
          const account = join(root, 'research.md')
          const planned = request.account === undefined ? undefined : initialAccountText(request.account)
          if (request.account !== undefined && (!request.writable || !request.account.title.trim() || !request.account.question.trim()
            || planned === undefined || Buffer.byteLength(planned, 'utf8') > this.maxSourceBytes)) {
            return { ok: false, error: { code: 'invalid-request', message: 'A new account requires a title, research question and source-write permission within the file limit.', retryable: false } }
          }
          try {
            await safeSource(root, account, 'file')
            if (planned !== undefined && await readBoundedText(account, this.maxSourceBytes) !== planned) {
              return { ok: false, error: { code: 'invalid-request', message: 'A research account already exists. Read it before proposing changes; its contents were preserved.', retryable: false } }
            }
          }
          catch (error) {
            if (!missing(error)) throw error
            const existing = reader === undefined ? undefined : await reader.getProject()
            if (existing !== undefined && !existing.ok) return existing
            const family = existing?.ok && existing.value.value.accountResourceId !== undefined
              && pathForResourceId(existing.value.value.accountResourceId) === 'README.md'
            if (family && planned !== undefined) {
              return { ok: false, error: { code: 'invalid-request', message: 'This research family already has a README map and linked accounts. Open it or create a child direction; no root account was created.', retryable: false } }
            }
            if (request.writable && !family) {
              try { await createAccount(root, account, planned ?? `# ${markdownText(basename(root))}\n\n## Topics\n`) }
              catch (creationError) {
                if (!(creationError instanceof Error && 'code' in creationError && creationError.code === 'EEXIST')) throw creationError
                await safeSource(root, account, 'file')
                if (planned !== undefined && await readBoundedText(account, this.maxSourceBytes) !== planned) {
                  throw new OnboardingFailure('invalid-request', 'Another account appeared during initialization. Its contents were preserved; read it before continuing.')
                }
              }
            }
          }
        }
        const previous = record.roots.find(item => item.path === root)
        const enrolled: EnrolledRoot = { path: root, writable: request.writable,
          stateDirectory: previous?.stateDirectory ?? join(state, randomUUID()) }
        const updated = { format: 1, roots: [...record.roots.filter(item => item.path !== root), enrolled] }
        await publishText(join(state, 'enrollments.json'), this.serialized(updated), 0o600)
        return { ok: true, value: enrolled }
      })
    } catch (error) { return { ok: false, error: onboardingFailure(error) } }
  }

  /**
   * Create a fresh account and explicit parent links, retaining operation outcomes outside scientific sources.
   * Successful identical retries return the saved receipt; incomplete outcomes never reapply source writes.
   * @param reader - authorized root reader; the caller holds that root's shared source-publication serialization.
   * @param stateDirectory - root-specific operation storage outside the scientific tree.
   * @param request - human-authored opening, optional parent and stable retry identity, already authorized for writing.
   * @returns confirmed source identities or a typed rejection, partial publication or unknown outcome; no multi-file atomicity is claimed.
   */
  async create(reader: MarkdownWorkspace, stateDirectory: string, request: CreateTopicRequest): Promise<Result<CreateTopicReceipt>> {
    const publication: { operation?: Operation; attempted: boolean } = { attempted: false }
    let childPublished = false
    let linking = false
    try {
      this.validate(request)
      const state = await outsideState(reader.root, join(stateDirectory, 'onboarding'), true)
      return await claim(state, `${request.operationId}.lock`, async () => {
        const receiptPath = join(state, `${request.operationId}.json`)
        let previous: Operation | undefined
        try { previous = operationSchema.parse(JSON.parse(await readBoundedText(receiptPath, this.maxBytes))) }
        catch (error) { if (!missing(error)) throw error }
        if (previous !== undefined) {
          if (previous.sourceRoot !== reader.root || !sameRequest(previous.request, request)) {
            throw new OnboardingFailure('operation-reused', 'This operation identity already belongs to a different topic request.')
          }
          if (previous.receipt.operationId !== request.operationId
            || previous.receipt.topicId !== topicIdForPath(previous.relativePath)
            || previous.receipt.resourceId !== resourceIdForPath(previous.relativePath)) {
            throw new OnboardingFailure('invalid-request', 'The durable topic creation receipt is malformed.')
          }
          return this.recorded(previous)
        }
        let parentPath = request.parentTopicId === undefined ? 'research.md' : pathForTopicId(request.parentTopicId)
        if (request.parentTopicId !== undefined) {
          const parent = await reader.getTopic(request.parentTopicId)
          if (!parent.ok) return parent
        } else {
          const project = await reader.getProject()
          if (!project.ok) return project
          if (project.value.value.accountResourceId !== undefined) parentPath = pathForResourceId(project.value.value.accountResourceId)
        }
        const parent = join(reader.root, parentPath)
        await safeSource(reader.root, parent, 'file')
        // Validate size before any source mutation, including space for the eventual link.
        const parentText = await readBoundedText(parent, this.maxSourceBytes)
        const directory = request.directory ?? `topic-${randomUUID()}`
        const topicPath = posix.join(posix.dirname(parentPath), directory, 'research.md')
        try {
          await lstat(dirname(join(reader.root, topicPath)))
          throw new OnboardingFailure('invalid-request', 'The chosen topic directory already exists. Choose a new name or open its existing records.')
        } catch (error) { if (!missing(error)) throw error }
        const parentLink = posix.relative(posix.dirname(topicPath), parentPath)
        const text = `# ${markdownText(request.title.trim())}\n\n## Question\n\n${request.question.trim()}\n\n## Scope\n\n${request.scope?.trim() ?? ''}\n\n## Current work\n\n<!-- When useful, add a Current answer, Child topics, and Related materials. Group explicit links under Literature, Knowledge and Code only where relevant; describe why each source matters. Links do not grant access. -->\n\n## Parent\n\n[${request.parentTopicId === undefined ? 'Project' : 'Parent topic'}](${parentLink})\n`
        const childLink = `- [${markdownText(request.title.trim())}](<${posix.relative(posix.dirname(parentPath), topicPath).split('/').map(encodeURIComponent).join('/')}>)`
        if (Buffer.byteLength(text, 'utf8') > this.maxSourceBytes
          || Buffer.byteLength(parentText + childLink + '\r\n\r\n## Child topics\r\n\r\n\r\n', 'utf8') > this.maxSourceBytes) {
          throw new OnboardingFailure('invalid-request', 'The new account or parent link exceeds the source byte bound.')
        }
        const receipt = { operationId: request.operationId, topicId: topicIdForPath(topicPath), resourceId: resourceIdForPath(topicPath) }
        let operation: Operation = { format: 1, sourceRoot: reader.root, request: { ...request }, parentPath, relativePath: topicPath, state: 'reserved', receipt }
        publication.operation = operation
        await publishText(receiptPath, this.serialized(operation), 0o600)
        try {
          await safeSource(reader.root, dirname(parent), 'directory')
          publication.attempted = true
          await mkdir(dirname(join(reader.root, topicPath)), { mode: 0o700 })
          await syncDirectory(dirname(parent))
          await createAccount(reader.root, join(reader.root, topicPath), text)
          childPublished = true
          operation = { ...operation, state: 'published' }
          await publishText(receiptPath, this.serialized(operation), 0o600)
          linking = true
          await appendChild(reader.root, parent, childLink, this.maxSourceBytes)
          operation = { ...operation, state: 'complete' }
          await publishText(receiptPath, this.serialized(operation), 0o600)
          return { ok: true, value: receipt }
        } catch (error) {
          operation = { ...operation, state: childPublished && (!linking || error instanceof OnboardingFailure) ? 'partial' : 'unknown' }
          try { await publishText(receiptPath, this.serialized(operation), 0o600) }
          catch (receiptError) { if (!(receiptError instanceof Error)) throw receiptError; operation = { ...operation, state: 'unknown' } }
          return this.recorded(operation)
        }
      })
    } catch (error) {
      if (publication.attempted && publication.operation !== undefined) return this.recorded({ ...publication.operation, state: 'unknown' })
      return { ok: false, error: onboardingFailure(error) }
    }
  }

  private recorded(operation: Operation): Result<CreateTopicReceipt> {
    const receipt: CreateTopicReceipt = { operationId: operation.receipt.operationId,
      topicId: operation.receipt.topicId as CreateTopicReceipt['topicId'], resourceId: operation.receipt.resourceId as CreateTopicReceipt['resourceId'] }
    if (operation.state === 'complete') return { ok: true, value: receipt }
    if (operation.state === 'partial') return { ok: false, error: { code: 'partial-apply', operationId: operation.request.operationId,
      message: `The new account was created at ${operation.relativePath}, but its parent link is incomplete. Inspect the source before creating another topic.`,
      changed: [{ target: { kind: 'resource', id: receipt.resourceId }, revision: `onboarding:${operation.request.operationId}` as Revision }],
      remaining: [{ kind: 'resource', id: resourceIdForPath(operation.parentPath
        ?? (operation.request.parentTopicId === undefined ? 'research.md' : pathForTopicId(operation.request.parentTopicId as TopicId))) }] } }
    return { ok: false, error: { code: 'outcome-unknown', operationId: operation.request.operationId,
      message: `Topic creation stopped before a confirmed receipt. Inspect ${operation.relativePath} and its parent; this operation will not write again on retry.` } }
  }

  private serialized(value: unknown): string {
    const text = `${JSON.stringify(value)}\n`
    if (Buffer.byteLength(text, 'utf8') > this.maxBytes) throw new OnboardingFailure('invalid-request', 'The complete onboarding receipt exceeds the application storage byte bound.')
    return text
  }

  private validate(request: CreateTopicRequest): void {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(request.operationId) || !request.title.trim() || /[\r\n\0]/.test(request.title)
      || !request.question.trim() || request.question.includes('\0') || request.scope?.includes('\0')) {
      throw new OnboardingFailure('invalid-request', 'Provide a one-line title, a research question and an operation identity of 1–128 letters, digits, underscores or hyphens.')
    }
    if (request.directory !== undefined && (!request.directory.trim() || request.directory !== request.directory.trim()
      || /[/\\\x00-\x1f<>:"|?*]/.test(request.directory) || request.directory === '.' || request.directory === '..'
      || request.directory.startsWith('.') || request.directory.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(request.directory))) {
      throw new OnboardingFailure('invalid-request', 'The topic directory must be a new ordinary folder name without separators, reserved names or surrounding spaces.')
    }
  }
}
