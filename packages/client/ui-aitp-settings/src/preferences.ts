/** Profile preferences consumed by the AITP launcher on the next start. */
import z from '@deepseek-ai/schemastery'

/** The existing profile row owning the saved research composition. */
export const RESEARCH_SETTINGS_ID = 'ui-aitp-settings'

/** Research capabilities chosen for subsequent AITP launches. */
export interface ResearchPreferences {
  suite: 'skills' | 'browse' | 'full'
  literature: boolean
  knowledge: boolean
  code: boolean
}

/** Shared validation for native profile values and the startup consumer. */
export const Preferences: z<Partial<ResearchPreferences>, ResearchPreferences> = z.object({
  suite: z.union(['skills', 'browse', 'full']).default('full'),
  literature: z.boolean().default(true),
  knowledge: z.boolean().default(true),
  code: z.boolean().default(true),
})

/** Read-only page bootstrap; no research content or credentials are included. */
export const RESEARCH_STARTUP_GLOBAL = '__AITP_RESEARCH_STARTUP__'

/** Capabilities observed when this page is served; saved preferences are separate. */
export interface ResearchStartup {
  automaticResearch: boolean | null
}
