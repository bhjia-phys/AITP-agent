/**
 * AITP Session views, browser half: the header action (origin and Sources &
 * memory), the task card in the composer context stack, and the Sources &
 * memory dock page. Content arrives through the `aitp-session` resource
 * protocol; without a provider every contribution renders nothing, so the
 * Harness conversation is unchanged.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { en, zh, type AitpSessionKey } from './locales.ts'
import { MemoryPage, MemoryPageTitle } from './MemoryPage.tsx'
import { OriginAction } from './OriginAction.tsx'
import { TaskCard, type MemoryActionsFace } from './TaskCard.tsx'

export type { AitpSessionKey } from './locales.ts'
export type { MemoryPageProps } from './MemoryPage.tsx'
export type { OriginActionProps } from './OriginAction.tsx'
export type {
  AgentItem, GapItem, MemoryDataOrigin, Requirement, ResearcherItem, RuleItem, SessionMemoryView, SessionOrigin,
  SourceItem, SummaryItem,
} from './protocol.ts'
export type { MemoryActionsFace, TaskCardProps } from './TaskCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Session research-memory copy. */
    'aitp.session': AitpSessionKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'aitp.session'

/** The page's tab kind. */
const MEMORY_KIND = 'aitp-memory'

/** This package's identity in the dock tab system, and the key its page body and title register under. */
const MEMORY_TAB_ID = '@deepseek-ai/dsh-client-ui-aitp-session/memory'

/** Services read by the registrations. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'uiWorkspace']

/**
 * Contribute the header action, the task card and the Sources & memory page.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-aitp-session: dictionaries')
  const t = ctx.locale.bind(NS)
  let cancelMemoryOpen = (): void => {}
  ctx.effect(() => () => { cancelMemoryOpen() }, 'ui-aitp-session: memory navigation')
  const openNote = (address: string): void => { ctx.sidebarRight.openResource(address) }
  const face = (sessionId: SessionId): MemoryActionsFace => ({
    openMemory: () => {
      cancelMemoryOpen()
      ctx.uiWorkspace.openSession(sessionId)
      cancelMemoryOpen = ctx.sidebarRight.requestOpenTab(sessionId, MEMORY_KIND)
    },
    openNote,
    ...ctx.get('conversation') === undefined || ctx.get('sessions') === undefined ? {} : { correctItem: (text: string) => {
      const binding = ctx.get('sessions')?.binding(sessionId)
      const conversation = ctx.get('conversation')
      if (binding === undefined || conversation === undefined) return
      const quote = text.split(/\r?\n/).map(line => `> ${line}`).join('\n')
      const result = conversation.input.requestDraftInitialization(binding, { prompt: t('task.correctionPrompt', { text: quote }) })
      const input = conversation.input.for(binding.ctx)
      input.focus()
      return result === 'applied' ? 'applied' : 'preserved'
    } },
  })
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'aitp-memory',
    // After the preset label and background work in the header actions band.
    order: 40,
    locale: NS,
    inject: face,
  }, OriginAction))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'aitp-task',
    // Ahead of Todo (0) and Goal (10): the task frames everything below it.
    order: -10,
    locale: NS,
    inject: face,
  }, TaskCard))
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: MEMORY_TAB_ID,
    kind: MEMORY_KIND,
    priority: 'builtin',
    title: () => t('memory'),
  }), 'ui-aitp-session: memory page type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: MEMORY_TAB_ID, locale: NS, inject: () => ({ openNote }) },
    MemoryPage,
  ))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: MEMORY_TAB_ID, locale: NS },
    MemoryPageTitle,
  ))
}
