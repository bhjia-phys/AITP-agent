/** Shared library transport, normal-Session study submission and reversible reader composition. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type { RemoteStream } from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { ResourceEvent, ResourceResult, SourceId, SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ResearchMaterialNavigation } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import resourcesRemote from '@deepseek-ai/dsh-research-resources/remote'
import { materialSourceAddress, materialSourcePath, parseMaterialSource } from '@deepseek-ai/dsh-research-resources/protocol'
import type { MaterialReaderInput, MaterialMarkdownInput, MaterialStudyTaskOwner, MaterialsCatalogInput } from './contracts.ts'
import type { MaterialsStore } from './store.ts'
import { createMaterialsStore, materialsScopeKey } from './store.ts'
import { MaterialsConnection } from './connection.ts'
import { MaterialsController } from './controller.ts'
import { en, zh } from './locales.ts'
import { registerMaterialResources, workspaceMaterialRoot } from './resources.ts'
import { MaterialReader } from './MaterialReader.tsx'
import { MaterialMarkdown } from './MaterialMarkdown.tsx'
import { MaterialsCatalog } from './MaterialsCatalog.tsx'
import { SourceTab, SourceTabTitle, type SourceTabFace } from './SourceTab.tsx'
import { RootSourceTab, RootSourceTabTitle, type RootSourceTabFace } from './RootSourceTab.tsx'
import { MaterialTasks } from './MaterialTasks.tsx'
import { createSourceSetJournal } from './source-set-journal.ts'
import type { MaterialWriteFace, MaterialWriteInput } from './material-write-contracts.ts'
import { registerMaterialWriting } from './material-write-connection.ts'
import { createMaterialWriteJournal } from './material-write-journal.ts'

export type { LibraryModule, LibraryLabels, MaterialField, MaterialsScope, OpenMaterials, MaterialStudyTaskOwner, MaterialsCatalogInput, MaterialHeaderInput, MaterialBodyInput } from './contracts.ts'
export type { MaterialsLibraryService } from './controller.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    'aitp.materials.write': { scope: 'root'; props: MaterialWriteInput; locale: 'aitp.materials'; store: MaterialsStore; inject: MaterialWriteFace }
    'aitp.materials.catalog': {
      scope: 'root'
      props: MaterialsCatalogInput
      locale: 'aitp.materials'
      children: { 'aitp.materials.catalog.body': { kind: 'keyed'; scope: 'root' } }
    }
    'aitp.materials.markdown': { scope: 'root'; props: MaterialMarkdownInput; locale: 'aitp.materials' }
    'aitp.materials.reader': {
      scope: 'root'
      props: MaterialReaderInput
      locale: 'aitp.materials'
      store: MaterialsStore
      children: {
        'aitp.materials.reader.header': { kind: 'keyed'; scope: 'root' }
        'aitp.materials.reader.body': { kind: 'keyed'; scope: 'root' }
      }
    }
    'aitp.materials.study-tools': {
      scope: 'root'
      props: MaterialStudyTaskOwner
      children: { 'aitp.materials.tasks': { kind: 'list'; scope: 'root' } }
    }
  }
}

export const inject = ['remote', 'resources', 'slots', 'locale', 'layout', 'uiWorkspace', 'sidebarRightTabs', 'sidebarRight']
const TAB = '@deepseek-ai/dsh-client-ui-aitp-materials/source'

/**
 * Mount the authenticated endpoint before consuming its namespace.
 * @param ctx - existing Harness client services.
 * @returns cleanup that stops resource traffic before withdrawing its namespace.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register('aitp.materials', { en, zh }))
  const t = ctx.locale.bind('aitp.materials')
  const connection = new MaterialsConnection(() => t('disconnected'), (error) => { ctx.logger.error(error) })
  let storage: Storage | undefined
  try { storage = globalThis.sessionStorage } catch { /* The first pending write reports unavailable tab storage. */ }
  const handle = createMaterialsStore(createSourceSetJournal(storage, { unavailable: t('journalUnavailable'), invalid: t('journalInvalid') }),
    createMaterialWriteJournal(storage, { unavailable: t('writeRecoveryUnavailable'), invalid: t('writeRecoveryInvalid') }))
  const store: MaterialsStore = { ...handle, create(scopeKey) {
    const instance = handle.create(scopeKey)
    controller.observeState(() => instance.getSnapshot())
    return instance
  } }
  const controller = new MaterialsController(ctx, store, connection)
  registerMaterialWriting(ctx, store, controller, connection)
  const researchNavigation: ResearchMaterialNavigation = {
    async open(scope, resource, isCurrent) {
      if (scope.workspaceId === undefined || resource.target.kind !== 'workspace-path') return false
      const sourceId = `source:${encodeURIComponent(resource.target.path)}` as SourceId
      if (materialSourcePath(sourceId) === undefined) return false
      const signal = AbortSignal.any([ctx.layout.beginNavigation(), controller.lifetime.signal])
      const roots = await connection.run(transport => transport.listRoots(signal))
      if (!roots.ok || signal.aborted || isCurrent?.() === false || ctx.layout.panelInfo.getSnapshot().activePanelId !== 'aitp-research') return false
      const root = workspaceMaterialRoot(roots.value, scope.workspaceId)
      if (root === undefined) return false
      const ref = { rootId: root.id, sourceId }
      const domain = resource.kind === 'paper' ? 'literature' : resource.kind === 'code' ? 'code' : 'knowledge'
      const locator = resource.target.anchor === undefined ? undefined : { kind: 'anchor' as const, anchor: resource.target.anchor }
      const panel = 'aitp-research' as MainPanelId
      const materialScope = { workspaceId: scope.workspaceId, ...scope.title === undefined ? {} : { title: scope.title },
        ...scope.topicId === undefined ? {} : { topicId: scope.topicId as SourceTopicId } }
      const key = materialsScopeKey(materialScope)
      const rootReader = ctx.get('sidebarRightRoots')
      if (rootReader === undefined) return controller.open({ domain, ref, scope: materialScope,
        ...locator === undefined ? {} : { locator }, returnTo: () => { ctx.layout.selectPanel(panel) } })
      rootReader.selectScope(panel, key)
      rootReader.openIn(panel, key, materialSourceAddress(ref, locator, domain),
        { params: { scope: materialScope, libraryDomain: domain } })
      return true
    },
  }
  const releaseResearchNavigation = ctx.reflect.provide('researchMaterialNavigation', researchNavigation)
  ctx.effect(() => () => { void releaseResearchNavigation() })
  const release = ctx.reflect.provide('researchMaterials', controller)
  ctx.effect(() => () => { controller.dispose(); void release() })
  registerMaterialResources(ctx, connection)
  ctx.inject(['researchDiscussions'], (child) => {
    child.slots.inject('sidebar.right.root.tab', () => child.slots.register({
      name: 'sidebar.right.root.tab', key: TAB, priority: -1, locale: 'aitp.materials', store,
      inject: (): RootSourceTabFace => ({
        fields: domain => controller.fields(domain),
        openCollection: (ref, scope, domain) => {
          const panel = ctx.layout.panelInfo.getSnapshot().activePanelId
          return controller.openSource({ ref, scope, ...domain === undefined ? {} : { domain },
            returnTo: () => { ctx.layout.selectPanel(panel) } })
        },
        refresh: () => { void connection.refresh(controller.lifetime.signal) },
        discuss: (scope, selections) => {
          void child.researchDiscussions.open(scope, { ...scope, selections })
        },
        stage: (scope, selections) => {
          child.researchDiscussions.setSource(scope, { ...scope, selections })
        },
      }),
    }, RootSourceTab))
    child.effect(() => child.researchDiscussions.registerStudySubmission((origin, request, signal) => connection.ask({
      ...origin.workspaceId === undefined ? {} : { workspaceId: origin.workspaceId as WorkspaceId },
      ...origin.topicId === undefined ? {} : { topicId: origin.topicId as SourceTopicId },
      ...origin.scope === 'global' ? { scope: 'global' } : {},
      ...origin.scope !== 'global' && origin.workspaceId !== undefined && origin.topicId === undefined ? { scope: 'workspace' } : {},
      question: request.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n'),
      sessionId: request.sessionId, mode: request.mode, requestId: request.requestId, content: request.content,
      ...(request.clientTimeZone === undefined ? {} : { clientTimeZone: request.clientTimeZone }),
      selections: origin.selections ?? [], ...(origin.workflow === undefined ? {} : { workflow: origin.workflow === 'research' }),
    }, signal === undefined ? controller.lifetime.signal : AbortSignal.any([signal, controller.lifetime.signal]))))
    child.effect(() => child.researchDiscussions.registerResourceNavigation((scope, address, _params, returnTo) => {
      const source = parseMaterialSource(address)
      if (source === undefined) return false
      return controller.openSource({ ...source, ...returnTo === undefined ? {} : { returnTo }, scope: {
        ...scope.workspaceId === undefined ? {} : { workspaceId: scope.workspaceId },
        ...scope.title === undefined ? {} : { title: scope.title },
        ...scope.topicId === undefined ? {} : { topicId: scope.topicId as SourceTopicId },
      } }).then((opened) => {
        if (!opened) throw new Error(t('unresolved'))
        return true
      })
    }))
  })
  ctx.slots.registerFactory({ name: 'aitp.materials.catalog', scope: 'root', locale: 'aitp.materials',
    children: { 'aitp.materials.catalog.body': { kind: 'keyed', scope: 'root' } },
  }, MaterialsCatalog)
  ctx.slots.registerFactory({ name: 'aitp.materials.markdown', scope: 'root', locale: 'aitp.materials' }, MaterialMarkdown)
  ctx.slots.registerFactory({ name: 'aitp.materials.reader', scope: 'root', locale: 'aitp.materials', store,
    children: {
      'aitp.materials.reader.header': { kind: 'keyed', scope: 'root' },
      'aitp.materials.reader.body': { kind: 'keyed', scope: 'root' },
    },
  }, MaterialReader)
  ctx.slots.registerFactory({ name: 'aitp.materials.study-tools', scope: 'root',
    children: { 'aitp.materials.tasks': { kind: 'list', scope: 'root' } },
  }, MaterialTasks)
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: TAB, kind: 'aitp-material-source', priority: 'builtin',
    patterns: ['dsh-resource://aitp-material-source/**'], canOpen: address => parseMaterialSource(address) !== undefined,
    title: (address) => {
      const source = parseMaterialSource(address)
      return source === undefined ? t('open') : materialSourcePath(source.ref.sourceId)?.split('/').at(-1) ?? t('open')
    },
  }))
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB, locale: 'aitp.materials',
    inject: (): SourceTabFace => ({ refresh: () => { void connection.refresh(controller.lifetime.signal) }, onLink: (link) => {
      if (link.target === undefined) return false
      ctx.sidebarRight.openResource(materialSourceAddress(link.target, link.locator))
      return true
    } }),
  }, SourceTab))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: TAB }, SourceTabTitle))
  ctx.slots.inject('sidebar.right.root.tab', () => ctx.slots.register({ name: 'sidebar.right.root.tab', key: TAB,
    locale: 'aitp.materials', store, inject: (): RootSourceTabFace => ({ fields: domain => controller.fields(domain),
      openCollection: (ref, scope, domain) => {
        const panel = ctx.layout.panelInfo.getSnapshot().activePanelId
        return controller.openSource({ ref, scope, ...domain === undefined ? {} : { domain },
          returnTo: () => { ctx.layout.selectPanel(panel) } })
      }, refresh: () => { void connection.refresh(controller.lifetime.signal) } }),
  }, RootSourceTab))
  ctx.slots.inject('sidebar.right.root.tab.title', () => ctx.slots.register({ name: 'sidebar.right.root.tab.title', key: TAB }, RootSourceTabTitle))
  const unmount = await ctx.remote.$mount(resourcesRemote)
  const bound = ctx.inject(['remote.researchResources'], (child) => {
    const api = child.remote.researchResources
    const unbind = connection.bind({
      refresh: signal => unwrap(api.refresh({}, signal)),
      management: {
        getSetup: signal => unwrap(api.getSetup({}, signal)),
        connectWorkspace: (workspaceId, signal, domains) => unwrap(api.connectWorkspace({ workspaceId,
          ...(domains === undefined ? {} : { domains }),
        }, signal)),
        disconnectWorkspace: (workspaceId, signal) => unwrap(api.disconnectWorkspace({ workspaceId }, signal)),
        listSourceSets: (query, signal) => unwrap(api.listSourceSets(query, signal)),
        getSourceSet: (id, signal) => unwrap(api.getSourceSet({ id }, signal)),
        saveSourceSet: (request, signal) => unwrapMutation(api.saveSourceSet(request, signal), request.operationId),
        removeSourceSet: (request, signal) => unwrapMutation(api.removeSourceSet(request, signal), request.operationId),
      },
      listRoots: signal => unwrap(api.listRoots({}, signal)),
      listResources: (query, signal) => unwrap(api.listResources(query, signal)),
      readResource: (ref, locator, signal, domain) => unwrap(api.readResource({ ref,
        ...locator === undefined ? {} : { locator }, ...domain === undefined ? {} : { domain },
      }, signal)),
      readSourceBytes: (ref, signal) => unwrap(api.readSourceBytes({ ref }, signal)),
      askStudy: (request, signal) => unwrap(api.askStudy(request, signal)),
    })
    let stream: RemoteStream<ResourceEvent> | undefined
    let following: Promise<void> | undefined
    const stopObserving = connection.observeReads(() => {
      if (stream !== undefined) return
      const current = child.remote.$stream<ResourceEvent>({ name: 'research materials',
        open: signal => api.follow({}, signal), ended: () => new Error(t('disconnected')),
        carrierFailed: () => { connection.changed() },
      })
      stream = current
      following = (async () => {
        try { for await (const item of current) { connection.changed(); item.accept() } }
        catch (error) { if (!controller.lifetime.signal.aborted) child.logger.error(error) }
      })()
    })
    child.effect(() => async () => { stopObserving(); unbind(); await stream?.dispose(); await following })
  })
  return async () => { controller.dispose(); await bound.dispose(); await unmount() }
}

async function unwrap<T>(operation: Promise<RemoteResult<ResourceResult<T>>>): Promise<ResourceResult<T>> {
  const result = await operation
  return result.ok ? result.value : { ok: false, error: { code: result.error.code === 'research/resources-owner-required' ? 'permission-denied' : 'unavailable', message: result.error.message, retryable: result.error.code !== 'research/resources-owner-required' } }
}

async function unwrapMutation<T>(operation: Promise<RemoteResult<ResourceResult<T>>>, operationId: string): Promise<ResourceResult<T>> {
  const result = await operation
  if (result.ok) return result.value
  return { ok: false, error: result.error.code === 'research/resources-owner-required'
    ? { code: 'permission-denied', message: result.error.message, retryable: false }
    : { code: 'outcome-unknown', message: result.error.message, retryable: false, operationId } }
}
