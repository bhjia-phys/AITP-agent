/** aitp-agent identity on the existing, replaceable browser brand slot. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { BrandName } from './BrandName.tsx'
import { en, zh } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** aitp-agent product identity. */
    'aitp.brand': keyof typeof en
  }
}

/** Slot declarations and localized product text. */
export const inject = ['slots', 'locale']

/**
 * Register identity and remove it when the plugin or declaring slot unloads.
 * @param ctx - Client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('aitp.brand', { en, zh }), 'aitp-brand: dictionaries')
  ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({
    name: 'sidebar.brand.name', locale: 'aitp.brand',
  }, BrandName))
}
