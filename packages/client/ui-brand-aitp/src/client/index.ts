/** aitp-agent identity on the existing, replaceable browser brand slot, and its presentation token layer. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { BrandName } from './BrandName.tsx'
import { en, zh } from './locales.ts'
import { AITP_PALETTE } from './palette.ts'

/** Override-layer identity: one layer per source, named after this package. */
const PALETTE_SOURCE = '@deepseek-ai/dsh-client-ui-brand-aitp'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** aitp-agent product identity. */
    'aitp.brand': keyof typeof en
  }
}

/** Slot declarations, localized product text and the theme override layer. */
export const inject = ['slots', 'locale', 'theme']

/**
 * Register identity and the presentation tokens, and remove both when the plugin or declaring slot unloads.
 * @param ctx - Client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('aitp.brand', { en, zh }), 'aitp-brand: dictionaries')
  ctx.effect(() => ctx.theme.overrideTokens(PALETTE_SOURCE, AITP_PALETTE), 'aitp-brand: presentation tokens')
  ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({
    name: 'sidebar.brand.name', locale: 'aitp.brand',
  }, BrandName))
}
