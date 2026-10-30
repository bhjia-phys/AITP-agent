/** Shared discussion navigation: the research location and the conversation keep distinct identities. */
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchOrigin } from '@deepseek-ai/dsh-research-memory/types'
import type { SessionPromptRequest } from '@deepseek-ai/dsh-api-session-controller/types'

/** A scientific location; an absent Workspace denotes independent reading. Browsing submits no prompt. */
export interface ResearchDiscussionScope {
  readonly workspaceId?: WorkspaceId
  readonly topicId?: string
  readonly title?: string
}

/** Source-navigation request from a reply back into the surrounding reading surface. */
export type DiscussionResourceNavigation = (address: string, params?: Readonly<Record<string, unknown>>) => boolean

/** A reader plugin handles only its own source address family and preserves the caller's question scope. */
export type DiscussionReaderNavigation = (
  scope: ResearchDiscussionScope, address: string, params?: Readonly<Record<string, unknown>>,
  returnTo?: () => void,
) => boolean | Promise<boolean>

/** Selected-source admission stays with the library plugin and its existing authenticated transport. */
export type DiscussionStudyAdmission = (origin: ResearchOrigin, request: SessionPromptRequest, signal?: AbortSignal) => Promise<
  { readonly ok: true; readonly value: { readonly sessionId: SessionId } }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }
>

/** Optional bridge to the authorized native material reader. */
export interface ResearchMaterialNavigation {
  /**
   * Open a workspace-relative research reference in the current topic's native dock.
   * @param scope - selected Workspace and topic.
   * @param resource - reference owned by that Workspace.
   * @param isCurrent - whether the originating research visit is still active.
   * @returns Whether the bridge handled the reference.
   */
  open(scope: ResearchDiscussionScope, resource: import('./workspace-contract.ts').ResourceReference, isCurrent?: () => boolean): Promise<boolean>
}

/** Shared discussion used by topic and scoped-library pages. */
export interface ResearchDiscussions {
  /** Freeze the independent Research choice when a library submits a new or existing discussion. */
  readonly workflowEnabled: (sessionId?: SessionId) => boolean
  /**
   * Open or resume the selected scope's discussion without submitting a message.
   * @param scope - selected scientific scope.
   * @param origin - optional explicitly selected sources.
   * @param prompt - optional suggested draft; existing drafts are retained.
   * @returns completion of the pane-opening attempt.
   */
  open(scope: ResearchDiscussionScope, origin?: ResearchOrigin, prompt?: string): Promise<void>
  /**
   * Display an existing discussion belonging to the selected scope.
   * @param scope - selected scientific scope.
   * @param sessionId - existing matching discussion.
   * @returns completion of the discussion-selection attempt.
   */
  select(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void>
  /**
   * Create a blank discussion for an explicit new-conversation action.
   * @param scope - selected scientific scope.
   * @returns completion of the discussion-creation attempt.
   */
  newDiscussion(scope: ResearchDiscussionScope): Promise<void>
  /**
   * Show a newly admitted discussion after checking its scope membership.
   * @param scope - selected scientific scope.
   * @param sessionId - newly admitted matching discussion.
   * @returns completion of the discussion-selection attempt.
   */
  showSession(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void>
  /**
   * Prepare the source selection used by the next message.
   * @param scope - explicit selected scope.
   * @param origin - source selection for a later submission; never changes an in-flight request.
   */
  setSource(scope: ResearchDiscussionScope, origin: ResearchOrigin): void
  /**
   * Hide a discussion while retaining its Session and draft.
   * @param scope - location whose discussion presentation should close.
   */
  collapse(scope: ResearchDiscussionScope): void
  /**
   * Temporarily hide a discussion while its catalogue is shown.
   * @param scope - discussion temporarily covered by a catalogue.
   * @returns a callback restoring its prior presentation without opening a Session.
   */
  suspend(scope: ResearchDiscussionScope): () => void
  /**
   * Register the installed library's selected-source submission handler.
   * @param submit - the installed library's immutable per-message admission.
   * @returns a callback releasing this registration.
   */
  registerStudySubmission(submit: DiscussionStudyAdmission): () => void
  /**
   * Register a reader's handling of its own source addresses.
   * @param open - one independently installed reader's navigation.
   * @returns a callback releasing this registration.
   */
  registerResourceNavigation(open: DiscussionReaderNavigation): () => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Prepares source context only; native DSH retains ownership of subsequent submissions. */
    researchNativePreparation: {
      prepare(scope: ResearchDiscussionScope, origin: ResearchOrigin, signal: AbortSignal): Promise<SessionId>
    }
    /** Research discussion selection shared by reading surfaces. */
    researchDiscussions: ResearchDiscussions
    /** Optional native material reader contributed by the independently installed library. */
    researchMaterialNavigation: ResearchMaterialNavigation
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** Full native Conversation presented beside a research reading surface. */
    'aitp.research.discussion': {
      scope: 'root'
      props: {
        readonly scope: ResearchDiscussionScope
        /** Libraries keep their document dock on the right and show the conversation in the main area. */
        readonly presentation?: 'side' | 'main'
        readonly prepareFullConversation?: () => (() => void)
        readonly openResource?: DiscussionResourceNavigation
        readonly returnTo?: () => void
      }
      locale: 'aitp.research.discussion'
      inject: import('./discussion-controller.ts').DiscussionFace
      children: { 'aitp.research.discussion.conversation': { kind: 'single'; scope: 'session' } }
    }
    /** Existing discussions of one topic, used beneath its navigation row. */
    'aitp.research.topic-discussions': {
      scope: 'root'
      props: {
        readonly scope: ResearchDiscussionScope & { readonly workspaceId: WorkspaceId }
        readonly onActivate?: () => void
        readonly active?: boolean
      }
      locale: 'aitp.research.discussion'
      inject: import('./discussion-controller.ts').DiscussionFace
    }
  }
  interface SlotMap {
    /**
     * Replace the discussion body using its real Session binding and optional research Workspace.
     * Absence renders no conversation content.
     */
    'aitp.research.discussion.conversation': { kind: 'single'; scope: 'session'; owner: { readonly workspaceId?: WorkspaceId } }
  }
}
