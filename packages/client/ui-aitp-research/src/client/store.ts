/** Research panel interaction state: scoped navigation and in-flight edit attempts. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ResourceId, TopicId } from './workspace-contract.ts'
import { workspaceEditActions, type WorkspaceEditOwner } from './workspace-edit-state.ts'

/** Detail views preserve the selected tab when returning from a material. */
export type TopicTab = 'overview' | 'work' | 'statements' | 'materials' | 'activity'

/** What the panel's reading region shows. */
export type ResearchLocation =
  | { readonly kind: 'project' }
  | { readonly kind: 'topic'; readonly topicId: TopicId; readonly tab: TopicTab }
  | { readonly kind: 'resource'; readonly topicId: TopicId | null; readonly resourceId: ResourceId }

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
export type ResearchPanelState = WorkspaceEditOwner & {
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
}

/** The panel's complete mutation API. */
export type ResearchPanelActions = typeof workspaceEditActions & {
  selectWorkspace: (draft: ResearchPanelState, workspaceId: WorkspaceId) => void
  open: (draft: ResearchPanelState, workspaceId: WorkspaceId, location: ResearchLocation, leave: ResearchReturnPoint) => void
  goBack: (draft: ResearchPanelState, workspaceId: WorkspaceId) => void
  setTab: (draft: ResearchPanelState, workspaceId: WorkspaceId, tab: TopicTab) => void
}

/** Locations kept for Back; older entries fall off. */
const BACK_LIMIT = 50
const PROJECT: ResearchLocation = { kind: 'project' }

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
 * @returns the registration-owned store handle.
 */
export function createResearchPanelStore(): EngineStoreHandle<ResearchPanelState, ResearchPanelActions> {
  return defineStore({
    init: (): ResearchPanelState => ({
      pendingEdits: {},
      workspaceId: null, location: { kind: 'project' }, back: [], arrival: { kind: 'none' }, visit: 0,
    }),
    actions: {
      ...workspaceEditActions,
      selectWorkspace: (draft, workspaceId: WorkspaceId) => {
        if (draft.workspaceId === workspaceId) return
        draft.workspaceId = workspaceId
        draft.location = { kind: 'project' }
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
      goBack: (draft, workspaceId: WorkspaceId) => {
        if (draft.workspaceId !== workspaceId) return
        const previous = draft.back.at(-1)
        if (previous === undefined) return
        draft.back = draft.back.slice(0, -1)
        draft.location = previous.location
        draft.arrival = { kind: 'return', ...previous.returnTo }
        draft.visit += 1
      },
      setTab: (draft, workspaceId: WorkspaceId, tab: TopicTab) => {
        if (draft.workspaceId === workspaceId && draft.location.kind === 'topic') draft.location = { ...draft.location, tab }
      },
    },
  })
}
