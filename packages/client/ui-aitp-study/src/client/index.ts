/** Independent study products; source browsing and ordinary Harness Sessions keep their owners. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { IconDeliverDocRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-store'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import type { StudyArtifactReceipt, StudyResult } from '@deepseek-ai/dsh-research-study/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import studyRemote from '@deepseek-ai/dsh-research-study/remote'
import { StudyConnection } from './connection.ts'
import { createStudyStore, type StudyStore } from './store.ts'
import { registerStudyResources, STUDY_SETUP } from './resources.ts'
import { StudyPanel, StudySidebar, type StudyFace } from './StudyPanel.tsx'
import { StudyTasks, CaptureAction, type CaptureFace } from './StudyActions.tsx'
import { SessionStudyDock, RootStudyDock } from './StudyDock.tsx'
import { en, zh } from './locales.ts'
import { createStudyJournal } from './operation-journal.ts'

export const inject = ['remote', 'resources', 'slots', 'locale', 'layout', 'uiWorkspace',
  'sidebarRightTabs', 'sidebarRight', 'sidebarRightRoots']
const PANEL = 'aitp-study' as MainPanelId
const TAB = '@deepseek-ai/dsh-client-ui-aitp-study/notes'

/**
 * Compose one ordinary global panel and optional source/message actions without a second chat runtime.
 * @param ctx - standard Harness client services.
 * @returns cleanup that stops operations before withdrawing this plugin's namespace.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register('aitp.study', { en, zh }))
  const t = ctx.locale.bind('aitp.study')
  const connection = new StudyConnection(() => t('unavailable'), (error) => { ctx.logger.error(error) })
  let storage: Storage | undefined
  try { storage = globalThis.sessionStorage } catch { /* Pending writes report unavailable tab storage. */ }
  const store = createStudyStore(createStudyJournal(storage, { unavailable: t('journalUnavailable'), invalid: t('journalInvalid') }))
  const lifetime = new AbortController()
  let actions: BoundActions<StudyStore> | undefined
  let pendingNavigation: ((bound: BoundActions<StudyStore>) => void) | undefined
  const navigate = (callback: (bound: BoundActions<StudyStore>) => void): void => {
    if (actions === undefined) pendingNavigation = callback
    else callback(actions)
    const panel = ctx.layout.panelInfo.getSnapshot().activePanelId
    if (panel === null) ctx.sidebarRight.openResource(STUDY_SETUP)
    else ctx.sidebarRightRoots.openResource(panel, STUDY_SETUP)
  }
  const newNote = (selections: readonly SourceSelection[]): void => { navigate((bound) => { bound.create(selections) }) }
  const openNotes = (): void => { navigate((bound) => { bound.list() }) }
  const face = (bound: BoundActions<StudyStore>): StudyFace => {
    actions = bound
    if (pendingNavigation !== undefined) {
      const navigatePending = pendingNavigation
      pendingNavigation = undefined
      navigatePending(bound)
    }
    return {
      refresh: () => { connection.changed() },
      execute: async (operation, checking = false) => {
        bound.pending(operation, true)
        const result = await connection.run(transport => transport.write(operation, lifetime.signal), operation.request.operationId)
        if (lifetime.signal.aborted) return
        if (result.ok && (result.value.operationId !== operation.request.operationId
          || result.value.state !== (operation.kind === 'remove' ? 'removed' : 'saved'))) {
          bound.pending(operation, false, t('receiptMismatch'))
          return
        }
        if (result.ok) { bound.acknowledged(result.value); connection.changed(); return }
        if (checking || result.error.code === 'unknown') bound.pending(operation, false, result.error.message)
        else bound.rejected(result.error.message)
      },
      exportArtifact: id => connection.run(transport => transport.export(id, lifetime.signal)),
      openSession: (id) => { ctx.uiWorkspace.openSession(id) },
      openSource: async source => ctx.get('researchMaterials')?.openSource({ ref: source.ref,
        ...source.locator === undefined ? {} : { locator: source.locator } }) ?? false,
    }
  }
  registerStudyResources(ctx, connection)
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, locale: 'aitp.study', store, inject: face }, StudyPanel))
  ctx.slots.inject('sidebar.context', () => ctx.slots.register({ name: 'sidebar.context', key: PANEL, locale: 'aitp.study', store }, StudySidebar))
  ctx.slots.registerFactory({ name: 'aitp.study.content', scope: 'root', locale: 'aitp.study', store, inject: face }, StudyPanel)
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: TAB, kind: 'aitp-study', priority: 'builtin',
    patterns: [STUDY_SETUP], title: () => t('dockTitle'),
    guide: [{ id: 'reading-notes', order: 25, title: () => t('dockTitle'),
      description: () => t('dockHelp'), icon: IconDeliverDocRegular }],
  }))
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB }, SessionStudyDock))
  ctx.slots.inject('sidebar.right.root.tab', () => ctx.slots.register({ name: 'sidebar.right.root.tab', key: TAB }, RootStudyDock))
  ctx.slots.inject('aitp.materials.tasks', () => ctx.slots.register({ name: 'aitp.materials.tasks', id: 'aitp-study-tasks',
    locale: 'aitp.study', inject: () => ({ newNote, openNotes }) }, StudyTasks))
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions', id: 'aitp-study-capture', order: 30, locale: 'aitp.study',
    inject: (sessionId): CaptureFace => ({ capture: (seq) => {
      navigate((bound) => { bound.capture(sessionId, seq, t('captureTitle')) })
    } }),
  }, CaptureAction))
  const unmount = await ctx.remote.$mount(studyRemote)
  const remote = ctx.inject(['remote.researchStudy'], (child) => {
    const api = child.remote.researchStudy
    const unbind = connection.bind({
      setup: async (_signal) => {
        const result = await api.getSetup()
        return result.ok ? { ok: true, value: result.value }
          : { ok: false, error: { code: 'unavailable', message: result.error.message, retryable: false } }
      },
      list: (query, _signal) => unwrap(api.listArtifacts(query)),
      read: (id, _signal) => unwrap(api.getArtifact({ id })),
      export: (id, _signal) => unwrap(api.exportMarkdown({ id })),
      write: (operation, signal) => {
        const response: Promise<RemoteResult<StudyResult<StudyArtifactReceipt>>> = operation.kind === 'save'
          ? api.saveNote(operation.request) : operation.kind === 'capture'
            ? api.captureAnswer(operation.request, signal) : api.removeArtifact(operation.request)
        return unwrap(response, operation.request.operationId)
      },
    })
    child.effect(() => unbind)
  })
  return async () => {
    lifetime.abort(); pendingNavigation = undefined; actions = undefined
    if (ctx.layout.panelInfo.getSnapshot().activePanelId === PANEL) ctx.layout.selectPanel(null)
    await remote.dispose(); await unmount()
  }
}

async function unwrap<T>(response: Promise<RemoteResult<StudyResult<T>>>, operationId?: string): Promise<StudyResult<T>> {
  const result = await response
  if (result.ok) return result.value
  return { ok: false, error: { code: operationId === undefined || result.error.code === 'research/study-owner-required' ? 'unavailable' : 'unknown',
    message: result.error.message, retryable: false, ...operationId === undefined ? {} : { operationId } } }
}
