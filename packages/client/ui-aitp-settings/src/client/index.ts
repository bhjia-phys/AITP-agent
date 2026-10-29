/** Native Research settings, retained in every AITP suite. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { RESEARCH_SETTINGS_ID, RESEARCH_STARTUP_GLOBAL, type ResearchPreferences, type ResearchStartup } from '../preferences.ts'
import { ResearchSettingsController } from './research-settings-controller.ts'
import { ResearchSettingsSection } from './ResearchSettingsSection.tsx'
import { en, zh, type ResearchSettingsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.research': ResearchSettingsLocaleKey }
}

/** Settings remains mounted even if the read-only inventory service is unavailable. */
export const inject = ['slots', 'locale', 'configForms']

/**
 * Register the page through the existing settings form and inventory contracts.
 * @param ctx - Client plugin context owning this settings contribution.
 */
export function apply(ctx: Context): void {
  const namespace = 'settings.research'
  const t = ctx.locale.bind(namespace)
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }), 'ui-aitp-settings: dictionaries')
  const bootstrap: unknown = Reflect.get(globalThis, RESEARCH_STARTUP_GLOBAL)
  const startup: ResearchStartup = { automaticResearch: typeof bootstrap === 'object' && bootstrap !== null
    && 'automaticResearch' in bootstrap && typeof bootstrap.automaticResearch === 'boolean' ? bootstrap.automaticResearch : null }
  const controller = new ResearchSettingsController(ctx.configForms.get<ResearchPreferences>(RESEARCH_SETTINGS_ID), async () => {
    const inventory = ctx.get('remote.pluginInventory', false) as Context['remote']['pluginInventory'] | undefined
    if (!inventory) throw new Error('Plugin inventory is not available.')
    const result = await inventory.list()
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }, startup)
  ctx.effect(() => () => { controller.dispose() }, 'ui-aitp-settings: form subscription')
  const face = controller.inject()
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'research', order: 15, label: () => t('nav'), locale: namespace,
    inject: () => face,
  }, ResearchSettingsSection))
}
