/** Research panel interaction state: scoped navigation and in-flight edit attempts. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ResourceId, TopicId } from './workspace-contract.ts'
import { workspaceEditActions, type WorkspaceEditOwner } from './workspace-edit-state.ts'
import { topicCreationActions, type TopicCreationOwner } from './topic-creation-state.ts'
import type { TopicCreationJournal, TopicRecoveryState } from './topic-creation-journal.ts'

/**
 * What the panel's reading region shows: the research map, centred on the
 * project or on one topic's branches; a topic page; or one material.
 */
export type ResearchLocation =
  | { readonly kind: 'map'; readonly focusId: TopicId | null }
  | { readonly kind: 'topic'; readonly topicId: TopicId }
  | { readonly kind: 'resource'; readonly topicId: TopicId | null; readonly resourceId: ResourceId }

/** Interface regions whose open or closed state the reader chooses; `listing` records a requested next page. */
export type DisclosureScope = 'map' | 'outline' | 'section' | 'listing'

/** Where the reader was in a location they left, so Back can return there. */
export type ResearchReturnPoint = {
  /** Reading-region scroll offset. */
  readonly scrollTop: number
  /** Position of the focused control among the reading region's focusable controls; null when focus was elsewhere. */
  readonly focusIndex: number | null
}

/** A location kept for Back with the point to return to. */
export type ResearchHistoryEntry = {
  readonly location: ResearchLocation
  readonly returnTo: ResearchReturnPoint
}

/**
 * What the reading region does once the current location renders: nothing on
 * first show, start at the top (taking focus only when the trigger was inside
 * the region and is about to unmount), or return to a recorded point.
 */
export type ResearchArrival =
  | { readonly kind: 'none' }
  | { readonly kind: 'enter'; readonly focus: boolean }
  | ({ readonly kind: 'return' } & ResearchReturnPoint)

/** Panel selection plus the locations visited before the current one. */
export type ResearchPanelState = WorkspaceEditOwner & TopicCreationOwner & {
  /** Tab-owned creation recovery availability; scientific records remain provider-owned. */
  topicRecovery: TopicRecoveryState
  /** Chosen or navigated Workspace; null follows Harness order until the first navigation. */
  workspaceId: WorkspaceId | null
  /** The location on screen. */
  location: ResearchLocation
  /** Earlier locations, most recent last. */
  back: ResearchHistoryEntry[]
  /** Arrival behavior for the current location. */
  arrival: ResearchArrival
  /** Increments on every navigation, so arriving at an equal location still settles. */
  visit: number
  /** Open (true) or closed (false) regions by {@link disclosureKey}; absent keys use each view's default. */
  disclosure: Record<string, boolean>
  /** Reading positions retained when switching topic discussions in this client. */
  readingPoints: Record<string, ResearchReturnPoint>
}

/** The panel's complete mutation API. */
export type ResearchPanelActions = typeof workspaceEditActions & typeof topicCreationActions & {
  selectWorkspace: (draft: ResearchPanelState, workspaceId: WorkspaceId) => void
  open: (draft: ResearchPanelState, workspaceId: WorkspaceId, location: ResearchLocation, leave: ResearchReturnPoint) => void
  restore: (draft: ResearchPanelState, workspaceId: WorkspaceId, location: ResearchLocation, returnTo: ResearchReturnPoint) => void
  goBack: (draft: ResearchPanelState, workspaceId: WorkspaceId) => void
  setDisclosed: (draft: ResearchPanelState, key: string, open: boolean) => void
  rememberReading: (draft: ResearchPanelState, workspaceId: WorkspaceId, location: ResearchLocation, point: ResearchReturnPoint) => void
  visitTopic: (draft: ResearchPanelState, workspaceId: WorkspaceId, topicId: TopicId | null) => void
}

/** Locations kept for Back; older entries fall off. */
const BACK_LIMIT = 50
const PROJECT: ResearchLocation = { kind: 'map', focusId: null }
const START: ResearchReturnPoint = { scrollTop: 0, focusIndex: null }

function readingKey(workspaceId: WorkspaceId, location: ResearchLocation): string {
  return JSON.stringify([workspaceId, location])
}

/**
 * Identify one disclosure choice; choices of different Workspaces never collide.
 * @param workspaceId - Workspace that owns the region.
 * @param scope - map node, outline node, topic-page section or topic-list page.
 * @param ids - topic identity followed by the section, or a topic query followed by its page cursor.
 * @returns the key used in {@link ResearchPanelState.disclosure}.
 */
export function disclosureKey(workspaceId: WorkspaceId, scope: DisclosureScope, ...ids: readonly string[]): string {
  return JSON.stringify([workspaceId, scope, ...ids])
}

/**
 * Read navigation only in the Workspace that owns it. A removed selection may
 * fall back to another Workspace, which must start at its own project overview.
 * @param state - declared interaction state.
 * @param workspaceId - Workspace currently displayed by Harness.
 * @returns the location that belongs to this Workspace.
 */
export function workspaceLocation(state: ResearchPanelState, workspaceId: WorkspaceId): ResearchLocation {
  return state.workspaceId === workspaceId ? state.location : PROJECT
}

/**
 * Create the panel state before the first render.
 * @param journal - optional tab-owned topic recovery; omitted by memory-only test hosts.
 * @returns the registration-owned store handle.
 */
export function createResearchPanelStore(journal?: TopicCreationJournal): EngineStoreHandle<ResearchPanelState, ResearchPanelActions> {
  const handle = defineStore({
    init: (): ResearchPanelState => ({
      pendingEdits: {},
      topicDrafts: {},
      topicRecovery: 'available',
      workspaceId: null, location: PROJECT, back: [], arrival: { kind: 'none' }, visit: 0, disclosure: {}, readingPoints: {},
    }),
    actions: {
      ...workspaceEditActions,
      ...topicCreationActions,
      selectWorkspace: (draft, workspaceId: WorkspaceId) => {
        if (draft.workspaceId === workspaceId) return
        draft.workspaceId = workspaceId
        draft.location = PROJECT
        draft.back = []
        draft.arrival = { kind: 'enter', focus: false }
        draft.visit += 1
      },
      open: (draft, workspaceId: WorkspaceId, location: ResearchLocation, leave: ResearchReturnPoint) => {
        const sameWorkspace = draft.workspaceId === workspaceId
        const previous = sameWorkspace ? draft.location : PROJECT
        draft.back = [...(sameWorkspace ? draft.back : []), { location: previous, returnTo: leave }].slice(-BACK_LIMIT)
        draft.workspaceId = workspaceId
        draft.location = location
        draft.arrival = { kind: 'enter', focus: leave.focusIndex !== null }
        draft.visit += 1
      },
      restore: (draft, workspaceId: WorkspaceId, location: ResearchLocation, returnTo: ResearchReturnPoint) => {
        if (draft.workspaceId !== workspaceId) draft.back = []
        draft.workspaceId = workspaceId
        draft.location = location
        draft.arrival = { kind: 'return', ...returnTo }
        draft.visit += 1
      },
      goBack: (draft, workspaceId: WorkspaceId) => {
        if (draft.workspaceId !== workspaceId) return
        const previous = draft.back.at(-1)
        if (previous === undefined) return
        draft.back = draft.back.slice(0, -1)
        draft.location = previous.location
        draft.arrival = { kind: 'return', ...previous.returnTo }
        draft.visit += 1
      },
      setDisclosed: (draft, key: string, open: boolean) => {
        draft.disclosure[key] = open
      },
      rememberReading: (draft, workspaceId: WorkspaceId, location: ResearchLocation, point: ResearchReturnPoint) => {
        draft.readingPoints[readingKey(workspaceId, location)] = point
      },
      visitTopic: (draft, workspaceId: WorkspaceId, topicId: TopicId | null) => {
        const sameWorkspace = draft.workspaceId === workspaceId
        const previous = sameWorkspace ? draft.location : PROJECT
        const location: ResearchLocation = topicId === null ? PROJECT : { kind: 'topic', topicId }
        draft.back = [...(sameWorkspace ? draft.back : []), {
          location: previous, returnTo: draft.readingPoints[readingKey(workspaceId, previous)] ?? START,
        }].slice(-BACK_LIMIT)
        draft.workspaceId = workspaceId
        draft.location = location
        draft.arrival = { kind: 'return', ...draft.readingPoints[readingKey(workspaceId, location)] ?? START }
        draft.visit += 1
      },
    },
  })
  if (journal === undefined) return handle
  return {
    ...handle,
    create(scopeKey) {
      const instance = handle.create(scopeKey)
      const restored = journal.load()
      instance.store.update((draft) => { draft.topicDrafts = restored.drafts; draft.topicRecovery = restored.state })
      if (restored.state !== 'unreadable') instance.subscribe(() => {
        if (!journal.save(instance.getSnapshot().topicDrafts) && instance.getSnapshot().topicRecovery !== 'unavailable') {
          instance.store.update((draft) => { draft.topicRecovery = 'unavailable' })
        }
      })
      return instance
    },
  }
}
