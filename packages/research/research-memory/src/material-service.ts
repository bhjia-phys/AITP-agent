/** Material publication through the existing authorized research roots. */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService, principalOf } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SourceRef } from '@deepseek-ai/dsh-research-resources/types'
import type {} from '@deepseek-ai/dsh-research-resources'
import type { MarkdownWorkspace } from './markdown.ts'
import type { Result, TopicId } from './types.ts'
import type { MaterialLocation, SaveMaterialRequest, MaterialWriteGrant, MaterialWriteReceipt, MaterialWriteRequest } from './material-types.ts'
import { MaterialWriter, resolveMaterialTopic } from './material-writes.ts'
import { onboardingFailure } from './onboarding-files.ts'
import { installMaterialTools } from './material-tools.ts'

/** A source observation and its separately configured write permission. */
export interface MaterialTarget {
  readonly reader: MarkdownWorkspace
  readonly grant?: MaterialWriteGrant
}

/** Existing memory owner supplies access, serialization and lifecycle; material publication stays here. */
export interface MaterialServiceOptions {
  readonly maxResultCharacters: number
  readonly target: (workspaceId: WorkspaceId, signal: AbortSignal) => Promise<MaterialTarget>
  readonly serialize: <T>(workspaceId: WorkspaceId, operation: () => Promise<Result<T>>) => Promise<Result<T>>
  readonly admit: () => Disposable | undefined
  readonly changed: (workspaceId: WorkspaceId) => Promise<void>
}

declare module '@deepseek-ai/cordis' {
  interface Context { researchMaterialFiles: ResearchMaterialFiles }
}

const addressedWorkspace = (request: { workspaceId: WorkspaceId }): WorkspaceId => request.workspaceId

/** The optional material service neither owns scientific records nor creates source grants. */
export class ResearchMaterialFiles extends TypertRemoteService {
  static inject = ['typert', 'tools', 'sessionProjections']

  constructor(ctx: Context, private readonly options: MaterialServiceOptions) {
    super(ctx, 'researchMaterialFiles', { namespace: 'researchMaterialFiles' })
    ctx.effect(() => installMaterialTools(ctx, { maxResultCharacters: options.maxResultCharacters }), 'research-materials: native material tools')
  }

  private requireOwner(): void {
    if (principalOf(this.ctx.invocation) !== undefined) throw new RemoteError('research/owner-required', 'Material access is available to the workspace owner.', {})
  }

  /**
   * Resolve the existing account at any depth without choosing a new file layout.
   * @param request - admitted Workspace and optional recognized topic.
   * @param signal - cancels source observation.
   * @returns real paths and separately configured write availability.
   */
  @Remote({ name: 'getLocation', resources: { workspace: addressedWorkspace } })
  async getLocation(request: { workspaceId: WorkspaceId; topicId?: TopicId }, signal: AbortSignal): Promise<Result<MaterialLocation>> {
    this.requireOwner()
    const target = await this.options.target(request.workspaceId, signal)
    const location = await resolveMaterialTopic(target.reader, request.topicId)
    signal.throwIfAborted()
    return location.ok ? { ok: true, value: { ...location.value, rootPath: target.reader.root,
      writable: target.grant?.writable === true } } : location
  }

  /**
   * Create a text, code or result file without replacing an existing path.
   * @param request - exact text, explicit destination and stable retry identity.
   * @param signal - cancels before publication admission; an admitted write retains its receipt.
   * @returns file and link outcomes independently, with exact current read-back.
   */
  @Remote({ name: 'saveText', resources: { workspace: addressedWorkspace } })
  async saveText(request: SaveMaterialRequest & { text: string }, signal: AbortSignal): Promise<Result<MaterialWriteReceipt>> {
    this.requireOwner()
    return this.save(request, { kind: 'text', text: request.text }, signal)
  }

  /**
   * Copy an explicitly selected authorized PDF to a new destination.
   * @param request - existing source identity and separately writable destination.
   * @param signal - cancels source reading or waiting before publication admission.
   * @returns separate destination/link outcomes; the original PDF remains in place.
   */
  @Remote({ name: 'importPdf', resources: { workspace: addressedWorkspace } })
  async importPdf(request: SaveMaterialRequest & { source: SourceRef }, signal: AbortSignal): Promise<Result<MaterialWriteReceipt>> {
    this.requireOwner()
    return this.copyPdf(request, signal)
  }

  /**
   * Publish for an actual tool execution, rechecking its Session policy when the source lock is held.
   * @param request - bound destination and authored text or authorized PDF identity.
   * @param authorize - re-reads current scope and file permissions, never supplied by a remote caller.
   * @param signal - cancels before source publication admission.
   * @returns independent material outcomes retained by the writer.
   */
  async publishForAgent(request: SaveMaterialRequest & ({ kind: 'text'; text: string } | { kind: 'pdf'; source: SourceRef }),
    authorize: () => Promise<void>, signal: AbortSignal): Promise<Result<MaterialWriteReceipt>> {
    this.requireOwner()
    await authorize()
    return request.kind === 'text' ? this.save(request, { kind: 'text', text: request.text }, signal, authorize)
      : this.copyPdf(request, signal, authorize)
  }

  private async copyPdf(request: SaveMaterialRequest & { source: SourceRef }, signal: AbortSignal,
    authorize?: () => Promise<void>): Promise<Result<MaterialWriteReceipt>> {
    const resources = this.ctx.get('researchResources')
    if (resources === undefined) return { ok: false, error: { code: 'unavailable', message: 'The selected source service is unavailable.', retryable: true } }
    const read = await resources.readSourceBytes({ ref: request.source }, signal)
    if (!read.ok) return { ok: false, error: { code: 'invalid-request', message: read.error.message, retryable: read.error.retryable } }
    if (read.value.mediaType !== 'application/pdf') return { ok: false, error: { code: 'invalid-request', message: 'Select an authorized PDF source to import.', retryable: false } }
    return this.save(request, { kind: 'pdf', bytes: read.value.data }, signal, authorize)
  }

  private async save(request: SaveMaterialRequest, content: MaterialWriteRequest['content'], signal: AbortSignal,
    authorize?: () => Promise<void>): Promise<Result<MaterialWriteReceipt>> {
    signal.throwIfAborted()
    using operation = this.options.admit()
    if (operation === undefined) return { ok: false, error: { code: 'unavailable', message: 'The research service is stopping; no material write was admitted.', retryable: true } }
    const result = await this.options.serialize(request.workspaceId, async () => {
      signal.throwIfAborted()
      const { grant } = await this.options.target(request.workspaceId, signal)
      if (grant?.writable !== true) return { ok: false, error: { code: 'read-only', message: 'Saving is not enabled for this destination.', retryable: false } } as const
      await authorize?.()
      signal.throwIfAborted()
      return new MaterialWriter(grant).save({ operationId: request.operationId, relativePath: request.relativePath,
        content, ...(request.association === undefined ? {} : { association: request.association }) })
    })
    if (result.ok) {
      try { await this.options.changed(request.workspaceId) }
      catch (error) {
        this.ctx.logger.warn(`Material outcome retained; derived views need refresh: ${onboardingFailure(error).message}`)
        return { ok: true, value: { ...result.value,
          issues: [...result.value.issues, 'The file outcome is retained; refresh material views before relying on their contents.'] } }
      }
    }
    return result
  }
}
