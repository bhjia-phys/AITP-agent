/**
 * AITP Research, browser half: the sidebar's Research entry, the global panel
 * it opens (topics, topic homes and notes of a Harness Workspace, readable
 * without a Session), and the dock tab type that shows a note beside a
 * conversation. Content arrives through the `aitp-topics`, `aitp-topic` and
 * `aitp-note` resource protocols; this package renders it and owns no
 * research content.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { en, zh, type AitpResearchKey } from './locales.ts'
import { NoteTabBody, NoteTabTitle } from './NoteTab.tsx'
import { parseNoteAddress } from './protocol.ts'
import { ResearchPanel, type ResearchPanelFace } from './ResearchPanel.tsx'
import { ResearchPanelIcon } from './ResearchPanelIcon.tsx'
import { createResearchPanelStore } from './store.ts'
import { sidebarEn, sidebarZh } from './sidebar-locales.ts'
import { WorkspaceSidebar, type WorkspaceSidebarFace } from './WorkspaceSidebar.tsx'
import { registerWorkspaceResources } from './workspace-resources.ts'
import { ResearchWorkspaceRegistry } from './workspace-service.ts'
import { createTopicCreationJournal } from './topic-creation-journal.ts'
import { TopicLibraries } from './TopicLibraries.tsx'
import { registerResearchDiscussions } from './discussion-registration.ts'
import { ResearchNavigationController } from './research-navigation.ts'
import { ResearchNavigation } from './ResearchNavigation.tsx'

export type { AitpResearchKey } from './locales.ts'
export type * from './discussion-contract.ts'
export type {} from './ResearchChangeNotice.tsx'
export type { NoteTabBodyProps } from './NoteTab.tsx'
export type {
  BranchUse, MaterialLink, NoteView, PendingChoice, ResearchDataOrigin, SourceLocator, SourcePassage,
  ThreadEntry, TopicHomeView, TopicIndexView, TopicKind, TopicOpening, TopicSummary,
} from './protocol.ts'
export type { ResearchPanelFace, ResearchPanelProps } from './ResearchPanel.tsx'
export type { ResearchLocation, ResearchPanelActions, ResearchPanelState } from './store.ts'
export type * from './workspace-contract.ts'
export type { TopicSummary as WorkspaceTopicSummary } from './workspace-contract.ts'
export type { WorkspaceAdapterFactory, ResearchWorkspaceRegistry } from './workspace-service.ts'
export type { WorkspaceSidebarFace, WorkspaceSidebarProps } from './WorkspaceSidebar.tsx'
export type {} from './workspace-resources.ts'
export type { TopicLibraryOwner } from './TopicLibraries.tsx'
export type {} from './ResearchNavigation.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Research panel, topic home and note reader copy. */
    'aitp.research': AitpResearchKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'aitp.research'

/** The id shared by the sidebar entry and the main panel it opens. */
const PANEL_ID = 'aitp-research' as MainPanelId

/** This package's identity in the dock tab system, and the key its tab body and title register under. */
const NOTE_TAB_ID = '@deepseek-ai/dsh-client-ui-aitp-research/note'

/** Services read by the registrations. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'uiWorkspace', 'resources', 'layout',
  'workspaces', 'sessions', 'conversation', 'uiConversation', 'uiChatNavigation']

/**
 * Contribute the Research entry, its global panel and the note dock tab type.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const workspaces = new ResearchWorkspaceRegistry(ctx)
  const release = ctx.reflect.provide('researchWorkspaces', workspaces)
  ctx.effect(() => () => {
    workspaces.dispose()
    void release()
  }, 'ui-aitp-research: workspace service')
  registerWorkspaceResources(ctx, workspaces)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-aitp-research: dictionaries')
  ctx.effect(() => ctx.locale.register('aitp.research.sidebar', { zh: sidebarZh, en: sidebarEn }), 'ui-aitp-research: sidebar dictionaries')
  const t = ctx.locale.bind(NS)
  let topicStorage: Storage | undefined
  try { topicStorage = globalThis.sessionStorage } catch (_error) {
    // Browser policy can deny tab storage; the form reports this explicitly.
  }
  const store = createResearchPanelStore(createTopicCreationJournal(topicStorage, t('topic.create.reloaded')))
  const navigation = new ResearchNavigationController(ctx, PANEL_ID)
  const discussions = registerResearchDiscussions(ctx, workspaces, (scope, address) => navigation.open(scope, address))
  const face: ResearchPanelFace = {
    openMaterial: async (scope, resource, isCurrent) => await ctx.get('researchMaterialNavigation')?.open(scope, resource, isCurrent) ?? false,
    beginDiscussion: (scope, origin) => { void discussions.open(scope, origin) },
    updateDiscussionSource: (scope, origin) => { discussions.setReadingSource(scope, origin) },
    openDiscussionResource: (scope, address, leave) => navigation.open(scope, address, leave),
    showResearch: () => { ctx.layout.selectPanel(PANEL_ID) },
    showWorkspaces: () => { ctx.layout.selectPanel(null) },
    initializeResearch: (workspaceId, request) => workspaces.initialize(workspaceId, request),
    createTopic: (workspaceId, request) => workspaces.createTopic(workspaceId, request),
    openSession: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
    startDraft: (workspaceId, prompt) => { ctx.uiWorkspace.startSession(workspaceId, { prompt }) },
    askQuestion: question => workspaces.ask(question),
    previewChange: (workspaceId, intent) => workspaces.previewChange(workspaceId, intent),
    applyChange: (workspaceId, request) => workspaces.applyChange(workspaceId, request),
    retry: (workspaceId) => { workspaces.retry(workspaceId) },
  }
  const sidebarFace: WorkspaceSidebarFace = {
    checkSetup: true, showConversations: () => { ctx.layout.selectPanel(null) },
    showResearch: () => { ctx.layout.selectPanel(PANEL_ID) }, retry: face.retry,
    newDiscussion: (workspaceId, topicId, title) => { void discussions.newDiscussion({ workspaceId, topicId, title }) },
  }
  ctx.slots.registerFactory({ name: 'aitp.research.navigation', scope: 'root', locale: 'aitp.research.sidebar', store,
    inject: (actions) => { navigation.bind(actions); return sidebarFace },
  }, ResearchNavigation)
  ctx.slots.registerFactory({ name: 'aitp.research.topic-libraries', scope: 'root',
    children: { 'aitp.research.topic.libraries': { kind: 'list', scope: 'root' } },
  }, TopicLibraries)
  ctx.slots.inject('main', function* () {
    yield ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, store,
      inject: (actions) => { navigation.bind(actions); return face } }, ResearchPanel)
  })
  ctx.slots.inject('sidebar.context', () => ctx.slots.register({
    name: 'sidebar.context', key: PANEL_ID, locale: 'aitp.research.sidebar', store,
    inject: (actions) => { navigation.bind(actions); return sidebarFace },
  }, WorkspaceSidebar))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: -30,
    label: () => t('panel'),
    locale: NS,
  }, ResearchPanelIcon))
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: NOTE_TAB_ID,
    kind: 'aitp-note',
    priority: 'builtin',
    patterns: ['dsh-resource://aitp-note/**'],
    canOpen: address => parseNoteAddress(address) !== undefined,
    title: address => parseNoteAddress(address)?.path.split('/').at(-1) ?? t('tab.note'),
  }), 'ui-aitp-research: note tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: NOTE_TAB_ID, locale: NS },
    NoteTabBody,
  ))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: NOTE_TAB_ID },
    NoteTabTitle,
  ))
}
