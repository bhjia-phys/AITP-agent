/** Per-Session admission providers; each capture belongs to one explicit composer send. */
import type { SessionPromptTransport } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ComposerSubmissions } from '../contract/submissions.ts'

/** One provider per Session prevents competing owners from silently changing source scope. */
export class ComposerSubmissionRegistry implements ComposerSubmissions {
  private readonly fallbacks = new Map<string, (sessionId: SessionId) => SessionPromptTransport | undefined>()
  private readonly providers = new Map<SessionId, () => SessionPromptTransport | undefined>()

  /** @inheritdoc */
  register(sessionId: SessionId, capture: () => SessionPromptTransport | undefined): () => void {
    if (this.providers.has(sessionId)) throw new Error('A composer admission provider is already registered for this Session.')
    this.providers.set(sessionId, capture)
    return () => { if (this.providers.get(sessionId) === capture) this.providers.delete(sessionId) }
  }

  /** @inheritdoc */
  registerFallback(id: string, capture: (sessionId: SessionId) => SessionPromptTransport | undefined): () => void {
    if (this.fallbacks.has(id)) throw new Error(`Composer admission fallback already registered: ${id}`)
    this.fallbacks.set(id, capture)
    return () => { if (this.fallbacks.get(id) === capture) this.fallbacks.delete(id) }
  }

  /** @inheritdoc */
  capture(sessionId: SessionId): SessionPromptTransport | undefined {
    const provider = this.providers.get(sessionId)
    if (provider !== undefined) return provider()
    for (const fallback of this.fallbacks.values()) {
      const captured = fallback(sessionId)
      if (captured !== undefined) return captured
    }
    return undefined
  }
}
