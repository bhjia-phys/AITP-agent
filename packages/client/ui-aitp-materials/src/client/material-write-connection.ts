/** Optional material-writing presentation over the already mounted research backend. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-research-memory/remote'
import type { MaterialWriteReceipt, Result, TopicId } from '@deepseek-ai/dsh-research-memory/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SourceId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { MaterialsConnection } from './connection.ts'
import type { MaterialsController } from './controller.ts'
import type { MaterialsStore } from './store.ts'
import type { MaterialWriteFace } from './material-write-contracts.ts'
import { MaterialWrite } from './MaterialWrite.tsx'
import { workspaceMaterialRoot } from './resources.ts'

/**
 * Attach and withdraw controls with the existing backend's actual Remote namespace.
 * @param ctx - materials plugin context; no additional memory endpoint is mounted.
 * @param store - existing framework-owned presentation state.
 * @param controller - original source navigation and generation lifetime.
 * @param connection - existing source observations, invalidated after explicit writes.
 */
export function registerMaterialWriting(ctx: Context, store: MaterialsStore,
  controller: MaterialsController, connection: MaterialsConnection): void {
  ctx.inject(['remote.researchMaterialFiles'], (child) => {
    const api = child.remote.researchMaterialFiles
    const t = child.locale.bind('aitp.materials')
    child.effect(() => child.resources.register({ protocol: 'aitp-material-location', open: (address, { signal }) => {
      const url = new URL(address)
      const workspaceId = decodeURIComponent(url.pathname.slice('/workspace/'.length)) as WorkspaceId
      const topicId = url.searchParams.get('topic')
      return connection.frames(signal, async (_transport, current) => {
        const result = await api.getLocation({ workspaceId, ...topicId === null ? {} : { topicId: topicId as TopicId } }, current)
        if (!result.ok) return { ok: false, error: { code: 'unavailable', message: result.error.message, retryable: true } }
        return result.value.ok ? result.value : { ok: false, error: {
          code: result.value.error.code === 'permission-denied' ? 'permission-denied' : 'unavailable',
          message: result.value.error.message, retryable: false,
        } }
      })
    } }))
    child.slots.registerFactory({ name: 'aitp.materials.write', scope: 'root', locale: 'aitp.materials', store,
      inject: (): MaterialWriteFace => ({
        save: async (command) => {
          const request = { workspaceId: command.scope.workspaceId, operationId: command.operationId, relativePath: command.relativePath,
            ...command.association === undefined ? {} : { association: command.association } }
          try {
            return await writeResult(command.kind === 'pdf'
              ? api.importPdf({ ...request, source: command.source }, controller.lifetime.signal)
              : api.saveText({ ...request, text: command.text }, controller.lifetime.signal), command.operationId)
          } catch (error) {
            child.logger.error(error)
            return { ok: false, error: { code: 'outcome-unknown', operationId: command.operationId, message: t('writeUnknownHelp') } }
          }
        },
        refresh: () => { void connection.refresh(controller.lifetime.signal) },
        resolveFile: async (scope, path) => {
          const roots = await connection.run(transport => transport.listRoots(controller.lifetime.signal))
          if (!roots.ok) return undefined
          const root = workspaceMaterialRoot(roots.value, scope.workspaceId)
          return root === undefined ? undefined : { rootId: root.id, sourceId: `source:${encodeURIComponent(path)}` as SourceId }
        },
      }),
    }, MaterialWrite)
  })
}

async function writeResult(operation: Promise<RemoteResult<Result<MaterialWriteReceipt>>>,
  operationId: string): Promise<Result<MaterialWriteReceipt>> {
  const result = await operation
  return result.ok ? result.value : { ok: false, error: result.error.code === 'research/owner-required'
    ? { code: 'permission-denied', message: result.error.message, retryable: false }
    : { code: 'outcome-unknown', message: result.error.message, operationId } }
}
