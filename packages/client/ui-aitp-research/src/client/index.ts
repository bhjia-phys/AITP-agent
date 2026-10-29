export type { ResearchWorkflowChoice } from './workflow-contract.ts'
/** Research Home, project navigation in the native right Sidebar, and Session-independent project reading. */
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
import { IconThinkOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { ConversationSidebar } from './ConversationSidebar.tsx'
import { ResearchHome } from './ResearchHome.tsx'
import { ResearchProjects, SessionProjects, RootProjects } from './ResearchProjects.tsx'
import { workspaceSetupAddress } from './workspace-resources.ts'
import { createResearchPanelStore } from './store.ts'
import { sidebarEn, sidebarZh } from './sidebar-locales.ts'
import { type WorkspaceSidebarFace } from './WorkspaceSidebar.tsx'
import { registerWorkspaceResources } from './workspace-resources.ts'
import { ResearchWorkspaceRegistry } from './workspace-service.ts'
import { createTopicCreationJournal } from './topic-creation-journal.ts'
import { TopicLibraries } from './TopicLibraries.tsx'
import { registerResearchDiscussions } from './discussion-registration.ts'
import { ResearchNavigationController } from './research-navigation.ts'
import { registerResearchWorkflow } from './workflow-registration.ts'
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

/** Internal main-panel identity; project entry points do not expose a mode switch. */
const PANEL_ID = 'aitp-research' as MainPanelId

/** This package's identity in the dock tab system, and the key its tab body and title register under. */
const NOTE_TAB_ID = '@deepseek-ai/dsh-client-ui-aitp-research/note'

/** Services read by the registrations. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'uiWorkspace', 'resources', 'layout',
  'workspaces', 'sessions', 'conversation', 'uiConversation', 'uiChatNavigation', 'sidebarRightRoots']

/**
 * Contribute the research Home, native project navigation, project reader and note tab type.
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
  const workflow = registerResearchWorkflow(ctx)
  const navigation = new ResearchNavigationController(ctx, PANEL_ID)
  const discussions = registerResearchDiscussions(ctx, workspaces, (scope, address) => navigation.open(scope, address), workflow.enabled)
  const showProjects = (workspaceId: import('@deepseek-ai/dsh-workspace/types').WorkspaceId): void => {
    ctx.sidebarRightRoots.openResource(PANEL_ID, workspaceSetupAddress(workspaceId), { title: t('home.projects') })
  }
  const face: ResearchPanelFace = {
    panelId: PANEL_ID, showProjects,
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
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({ name: 'sidebar.workspaces', priority: -10 }, ConversationSidebar))
  ctx.slots.inject('conversation.hero.introduction', () => ctx.slots.register({
    name: 'conversation.hero.introduction', locale: NS, store,
    inject: () => ({ hooks: { discussionSessions: discussions.sessionViews }, retry: face.retry,
      showProject: () => { ctx.layout.selectPanel(PANEL_ID) } }),
  }, ResearchHome))
  ctx.slots.registerFactory({ name: 'aitp.research.projects', scope: 'root', locale: 'aitp.research.sidebar', store,
    inject: (actions) => { navigation.bind(actions); return sidebarFace },
  }, ResearchProjects)
  const projectsId = '@deepseek-ai/dsh-client-ui-aitp-research/projects'
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: projectsId, kind: 'aitp-projects', priority: 'builtin',
    patterns: ['dsh-resource://aitp-workspace-setup/**'], title: () => t('home.projects'),
    guide: [{ id: 'projects', order: 5, title: () => t('home.projects'),
      description: () => t('home.projectsHint'), icon: IconThinkOutlineRegular }],
  }), 'research: native projects tab')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: projectsId }, SessionProjects))
  ctx.slots.inject('sidebar.right.root.tab', () => ctx.slots.register({ name: 'sidebar.right.root.tab', key: projectsId }, RootProjects))
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
