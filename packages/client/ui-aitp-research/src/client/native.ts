/** Research browsing through the public main-panel and sidebar interfaces in standard DSH. */
import type { Context } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-research-memory/remote'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { IconThinkOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { en, zh } from './locales.ts'
import { sidebarEn, sidebarZh } from './sidebar-locales.ts'
import { ResearchPanel, type ResearchPanelFace } from './ResearchPanel.tsx'
import { WorkspaceSidebar, type WorkspaceSidebarFace } from './WorkspaceSidebar.tsx'
import { ResearchWorkspaceRegistry } from './workspace-service.ts'
import { registerWorkspaceResources } from './workspace-resources.ts'
import { createResearchPanelStore } from './store.ts'
import { createTopicCreationJournal } from './topic-creation-journal.ts'
import { ResearchNavigationController } from './research-navigation.ts'
import { TopicLibraries } from './TopicLibraries.tsx'
import { ResearchNavigation } from './ResearchNavigation.tsx'
import { createWorkflowStore } from './workflow-store.ts'
import { ResearchWorkflowControl, ResearchWorkflowStatus } from './ResearchWorkflow.tsx'
import { registerResearchDiscussions } from './discussion-registration.ts'
import type { ResearchDiscussionScope } from './discussion-contract.ts'
import type { ResearchOrigin, ResourceId, TopicId } from '@deepseek-ai/dsh-research-memory/types'
import { brandString } from '@deepseek-ai/dsh-brand'
import { registerNoteTabs } from './NoteTab.tsx'

/**
 * Register existing research views without requiring the fork's composer or root-sidebar services.
 * @param ctx - native DSH client services shared with the ordinary workbench.
 */
export function applyNativeResearch(ctx: Context): void {
  const panelId = 'aitp-research' as MainPanelId
  const namespace = 'aitp.research'
  const workspaces = new ResearchWorkspaceRegistry(ctx)
  const release = ctx.reflect.provide('researchWorkspaces', workspaces)
  ctx.effect(() => () => { workspaces.dispose(); void release() }, 'research: native workspace adapters')
  registerWorkspaceResources(ctx, workspaces)
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }), 'research: native dictionaries')
  ctx.effect(() => ctx.locale.register('aitp.research.sidebar', { en: sidebarEn, zh: sidebarZh }), 'research: native sidebar copy')
  const t = ctx.locale.bind(namespace)
  const lifetime = new AbortController()
  ctx.effect(() => () => { lifetime.abort() }, 'research: native question lifetime')
  let storage: Storage | undefined
  try { storage = globalThis.sessionStorage } catch (_error) {
    // The existing creation form reports unavailable recovery storage if needed.
  }
  const store = createResearchPanelStore(createTopicCreationJournal(storage, t('topic.create.reloaded')))
  const navigation = new ResearchNavigationController(ctx, panelId)
  const workflow = createWorkflowStore()
  const prepare = async (scope: ResearchDiscussionScope, origin: ResearchOrigin, signal: AbortSignal): Promise<SessionId> => {
    const api = ctx.get('remote')?.researchMemory
    if (api === undefined) throw new Error(t('workspace.ask.failed'))
    const result = origin.selections !== undefined || scope.workspaceId === undefined
      ? await api.prepareStudy({ scope: scope.workspaceId === undefined ? 'global' : 'workspace',
        ...(scope.workspaceId === undefined ? {} : { workspaceId: scope.workspaceId }),
        ...(scope.topicId === undefined ? {} : { topicId: brandString<TopicId>(scope.topicId) }),
        selections: origin.selections ?? [], workflow: origin.workflow !== 'ordinary',
      }, signal)
      : await api.prepareDiscussion({ workspaceId: scope.workspaceId,
        ...(scope.topicId === undefined ? {} : { topicId: brandString<TopicId>(scope.topicId) }),
        ...(origin.resourceId === undefined ? {} : { resourceId: brandString<ResourceId>(origin.resourceId) }),
        ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
        ...(origin.selectedText === undefined ? {} : { selectedText: origin.selectedText }),
        ...(origin.selectedTextFormat === undefined ? {} : { selectedTextFormat: origin.selectedTextFormat }),
        ...(origin.selectedRange === undefined ? {} : { selectedRange: origin.selectedRange }),
        workflow: origin.workflow !== 'ordinary',
      }, signal)
    if (!result.ok) throw result.error
    if (!result.value.ok) throw new Error(result.value.error.message)
    return result.value.value.sessionId
  }
  const releasePreparation = ctx.reflect.provide('researchNativePreparation', { prepare })
  ctx.effect(() => () => { void releasePreparation() }, 'research: native source preparation')
  const discussions = registerResearchDiscussions(ctx, workspaces,
    (scope, address) => navigation.open(scope, address), () => true)
  registerNoteTabs(ctx, t)
  const setMode = async (sessionId: SessionId, enabled: boolean): Promise<void> => {
    const api = ctx.get('remote')?.researchMemory
    if (api === undefined) throw new Error(t('workspace.ask.failed'))
    const result = await api.setResearchMode({ sessionId, enabled }, lifetime.signal)
    if (!result.ok) throw result.error
  }
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock',
    id: 'aitp-research-mode', order: -30, locale: namespace, store: workflow,
    inject: () => ({ setMode }),
  }, ResearchWorkflowControl))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'aitp-research-mode-status', order: 39, locale: namespace,
  }, ResearchWorkflowStatus))
  const showResearch = (): void => { ctx.layout.selectPanel(panelId) }
  const face: ResearchPanelFace = {
    showResearch,
    openMaterial: async (scope, resource, isCurrent) => await ctx.get('researchMaterialNavigation')?.open(scope, resource, isCurrent) ?? false,
    showWorkspaces: () => { ctx.layout.selectPanel(null) },
    initializeResearch: (workspaceId, request) => workspaces.initialize(workspaceId, request),
    createTopic: (workspaceId, request) => workspaces.createTopic(workspaceId, request),
    openSession: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
    startDraft: (workspaceId, prompt) => { ctx.uiWorkspace.startSession(workspaceId, { prompt }) },
    askQuestion: async (question) => {
      const api = ctx.get('remote')?.researchMemory
      if (api === undefined) return { ok: false, error: {
        code: 'unsupported', message: t('workspace.ask.failed'), retryable: true,
      } }
      if (question.content !== undefined) return { ok: false, error: {
        code: 'unsupported', message: t('question.nativeAttachments'), retryable: false,
      } }
      try {
        const prepared = await api.prepareDiscussion(question, lifetime.signal)
        if (!prepared.ok) return { ok: false, error: {
          code: 'unavailable', message: prepared.error.message, retryable: true,
        } }
        if (!prepared.value.ok) return prepared.value
        lifetime.signal.throwIfAborted()
        const { sessionId } = prepared.value.value
        const reference = ctx.sessions.retain(sessionId, { source: 'researchDiscussion', signal: lifetime.signal })
        try {
          await reference.ready
          lifetime.signal.throwIfAborted()
          const initialized = ctx.conversation.input.requestDraftInitialization(reference.binding, { prompt: question.question })
          if (initialized !== 'applied') return { ok: false, error: {
            code: 'unavailable', message: t('workspace.ask.failed'), retryable: false,
          } }
          ctx.uiWorkspace.openSession(sessionId)
          await reference.binding.ctx.conversation.send(question.question)
          return { ok: true, value: { sessionId } }
        } finally { reference.release() }
      } catch (error) {
        return { ok: false, error: { code: 'unavailable',
          message: error instanceof Error ? error.message : t('workspace.ask.failed'), retryable: true,
        } }
      }
    },
    previewChange: (workspaceId, intent) => workspaces.previewChange(workspaceId, intent),
    applyChange: (workspaceId, request) => workspaces.applyChange(workspaceId, request),
    retry: (workspaceId) => { workspaces.retry(workspaceId) },
    openDiscussionResource: (scope, address, leave) => navigation.open(scope, address, leave),
  }
  const sidebar: WorkspaceSidebarFace = {
    checkSetup: true, showResearch,
    showConversations: () => { ctx.layout.selectPanel(null) }, retry: face.retry,
    newDiscussion: (workspaceId, topicId, title) => { void discussions.newDiscussion({ workspaceId, topicId, title }) },
  }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: panelId, locale: namespace, store,
    inject: (actions) => { navigation.bind(actions); return face },
  }, ResearchPanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: panelId,
    order: -30, label: () => t('panel'),
  }, IconThinkOutlineRegular))
  ctx.slots.inject('sidebar.context', () => ctx.slots.register({ name: 'sidebar.context', key: panelId,
    locale: 'aitp.research.sidebar', store,
    inject: (actions) => { navigation.bind(actions); return sidebar },
  }, WorkspaceSidebar))
  ctx.slots.registerFactory({ name: 'aitp.research.navigation', scope: 'root', locale: 'aitp.research.sidebar', store,
    inject: (actions) => { navigation.bind(actions); return sidebar },
  }, ResearchNavigation)
  ctx.slots.registerFactory({ name: 'aitp.research.topic-libraries', scope: 'root',
    children: { 'aitp.research.topic.libraries': { kind: 'list', scope: 'root' } },
  }, TopicLibraries)
}
