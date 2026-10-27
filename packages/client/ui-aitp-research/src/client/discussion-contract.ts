/** Shared discussion navigation: the research location and the conversation keep distinct identities. */
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchOrigin } from '@deepseek-ai/dsh-research-memory/types'
import type { SessionPromptRequest } from '@deepseek-ai/dsh-api-session-controller/types'

/** A scientific location; opening it does not create a Session or send a prompt. */
export interface ResearchDiscussionScope {
  readonly workspaceId: WorkspaceId
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

/** Shared right-hand discussion used by topic and scoped-library pages. */
export interface ResearchDiscussions {
  /**
   * @param scope - selected scientific scope. @param origin - optional explicitly selected sources.
   * @param prompt - optional suggested draft; existing drafts are retained. @returns pane readiness.
   */
  open(scope: ResearchDiscussionScope, origin?: ResearchOrigin, prompt?: string): Promise<void>
  /** @param scope - selected scientific scope. @param sessionId - existing matching discussion. @returns pane readiness. */
  select(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void>
  /** @param scope - selected scientific scope. @returns a new blank discussion, created only for this explicit action. */
  newDiscussion(scope: ResearchDiscussionScope): Promise<void>
  /** @param scope - selected scientific scope. @param sessionId - newly admitted matching discussion. @returns pane readiness. */
  showSession(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void>
  /**
   * @param scope - explicit selected scope.
   * @param origin - source selection for a later submission; never changes an in-flight request.
   */
  setSource(scope: ResearchDiscussionScope, origin: ResearchOrigin): void
  /** @param scope - location whose right pane should close while retaining its discussion and draft. */
  collapse(scope: ResearchDiscussionScope): void
  /** @param scope - discussion temporarily covered by a catalogue. @returns restores its prior presentation without opening a Session. */
  suspend(scope: ResearchDiscussionScope): () => void
  /** @param submit - the installed library's immutable per-message admission. @returns registration release. */
  registerStudySubmission(submit: DiscussionStudyAdmission): () => void
  /** @param open - one independently installed reader's navigation. @returns registration release. */
  registerResourceNavigation(open: DiscussionReaderNavigation): () => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Research discussion selection shared by reading surfaces. */
    researchDiscussions: ResearchDiscussions
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
      props: { readonly scope: ResearchDiscussionScope; readonly onActivate?: () => void; readonly active?: boolean }
      locale: 'aitp.research.discussion'
      inject: import('./discussion-controller.ts').DiscussionFace
    }
  }
  interface SlotMap {
    /**
     * Replace the scoped discussion's conversation body using its real Session binding and supplied Workspace id.
     * Absence renders no conversation content.
     */
    'aitp.research.discussion.conversation': { kind: 'single'; scope: 'session'; owner: { readonly workspaceId: WorkspaceId } }
  }
}
