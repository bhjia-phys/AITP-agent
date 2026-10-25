/** Production exact-session query implementation; this fixture never uses full-text search. */
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'

export default class ExactSessionQuery extends SessionQueryEngine {
  override async searchSessions(): Promise<never> { throw new Error('Full-text search is outside this fixture') }
  override async searchEvents(): Promise<never> { throw new Error('Full-text search is outside this fixture') }
}
