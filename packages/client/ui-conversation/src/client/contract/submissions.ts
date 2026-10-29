/** Optional source-aware admission captured for one ordinary composer submission. */
import type { SessionPromptTransport } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Providers capture immutable business context before asynchronous draft processing starts. */
export interface ComposerSubmissions {
  /** @param sessionId - native Session. @param capture - snapshots one send's transport. @returns provider release. */
  register(sessionId: SessionId, capture: () => SessionPromptTransport | undefined): () => void
  /**
   * Add a product's default admission without competing with an explicit Session/source owner.
   * @param id - registration identity. @param capture - freezes a route or declines this Session.
   * @returns provider release; explicit Session registrations always take precedence.
   */
  registerFallback(id: string, capture: (sessionId: SessionId) => SessionPromptTransport | undefined): () => void
  /** @param sessionId - native Session. @returns a sender bound to this submission's immutable context. */
  capture(sessionId: SessionId): SessionPromptTransport | undefined
}
