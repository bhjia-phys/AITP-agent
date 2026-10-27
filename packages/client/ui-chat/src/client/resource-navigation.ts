/** Presentation-owned source navigation for an embedded ordinary Conversation. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** An address and locator can open in the surrounding reading surface instead of the Session dock. */
export type ChatResourceNavigation = (address: string, params?: Readonly<Record<string, unknown>>) => boolean

/** One presentation owner can override resource navigation for its retained Session. */
export interface ChatNavigation {
  /**
   * Assign a retained Session's resource navigation to its presentation owner.
   * @param sessionId - displayed Session.
   * @param open - presentation-owned navigation.
   * @returns a callback releasing this registration.
   */
  register(sessionId: SessionId, open: ChatResourceNavigation): () => void
  /**
   * Dispatch a resource link to the Session's registered presentation owner.
   * @param sessionId - originating Session.
   * @param address - exact resource.
   * @param params - optional locator.
   * @returns whether the registered owner handled the resource link.
   */
  open(sessionId: SessionId, address: string, params?: Readonly<Record<string, unknown>>): boolean
}

declare module '@deepseek-ai/cordis' {
  interface Context { uiChatNavigation: ChatNavigation }
}

/** The chat plugin owns the registry; presentation plugins contribute only callbacks. */
export class ChatNavigationRegistry implements ChatNavigation {
  private readonly owners = new Map<SessionId, ChatResourceNavigation>()

  /** @inheritdoc */
  register(sessionId: SessionId, open: ChatResourceNavigation): () => void {
    if (this.owners.has(sessionId)) throw new Error('A source-navigation owner already exists for this Session.')
    this.owners.set(sessionId, open)
    return () => { if (this.owners.get(sessionId) === open) this.owners.delete(sessionId) }
  }

  /** @inheritdoc */
  open(sessionId: SessionId, address: string, params?: Readonly<Record<string, unknown>>): boolean {
    return this.owners.get(sessionId)?.(address, params) ?? false
  }
}
