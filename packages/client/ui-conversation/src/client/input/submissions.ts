/** Per-Session admission providers; each capture belongs to one explicit composer send. */
import type { SessionPromptTransport } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ComposerSubmissions } from '../contract/submissions.ts'

/** One provider per Session prevents competing owners from silently changing source scope. */
export class ComposerSubmissionRegistry implements ComposerSubmissions {
  private readonly providers = new Map<SessionId, () => SessionPromptTransport | undefined>()

  /** @inheritdoc */
  register(sessionId: SessionId, capture: () => SessionPromptTransport | undefined): () => void {
    if (this.providers.has(sessionId)) throw new Error('A composer admission provider is already registered for this Session.')
    this.providers.set(sessionId, capture)
    return () => { if (this.providers.get(sessionId) === capture) this.providers.delete(sessionId) }
  }

  /** @inheritdoc */
  capture(sessionId: SessionId): SessionPromptTransport | undefined { return this.providers.get(sessionId)?.() }
}
