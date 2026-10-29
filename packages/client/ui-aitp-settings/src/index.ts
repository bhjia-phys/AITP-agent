/** Native profile preferences for the next AITP launch, with no live composition mutation. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { RESEARCH_STARTUP_GLOBAL, type ResearchPreferences, type ResearchStartup } from './preferences.ts'

/** Volatile means the saved preference can update; running capabilities stay owned by the launcher. */
export interface Config {
  suite: Volatile<ResearchPreferences['suite']>
  literature: Volatile<boolean>
  knowledge: Volatile<boolean>
  code: Volatile<boolean>
}

/** Form fields saved through the existing Settings and ConfigEditor services. */
export const Config = z.object({
  suite: z.union(['skills', 'browse', 'full']).default('full').volatile(),
  literature: z.boolean().default(true).volatile(),
  knowledge: z.boolean().default(true).volatile(),
  code: z.boolean().default(true).volatile(),
})

/** Profile settings and capability inspection require native Loader ownership. */
export const inject = ['loader']

/** Register the custom form and publish only the currently resolved automation flag.
 * @param ctx Host plugin context owning the form presentation and page injection.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], scope => scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber)))
  ctx.on('webserver/index-inject', (table) => {
    const entry = [...ctx.loader.entries()].find(row => row.options.id === 'research-memory')
    const config: unknown = entry?.fiber?.config
    const automaticResearch = typeof config === 'object' && config !== null && 'automaticResearch' in config
      && typeof config.automaticResearch === 'boolean' ? config.automaticResearch : null
    table.push({ kind: 'global', name: RESEARCH_STARTUP_GLOBAL, value: { automaticResearch } satisfies ResearchStartup })
  })
}
