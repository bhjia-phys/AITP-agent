/** The change notice shares native Chat observation and the existing bounded workspace resource adapter. */
import type { Context } from '@deepseek-ai/cordis'
import { ResearchChangeNotice } from './ResearchChangeNotice.tsx'
import { changeEn, changeZh } from './research-change-locales.ts'

/**
 * Register the localized research change notice in native conversations.
 * @param ctx - research client plugin lifetime.
 */
export function registerResearchChangeNotice(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('aitp.research.change', { en: changeEn, zh: changeZh }), 'research: change dictionaries')
  ctx.slots.registerFactory({ name: 'aitp.research.change-notice', scope: 'session', locale: 'aitp.research.change' }, ResearchChangeNotice)
}
