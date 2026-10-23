/** Credential references and endpoint choices for the real-provider smoke tests. */
export interface ProviderCase {
  provider: 'openai' | 'anthropic' | 'openai-codex'
  api: 'openai-responses' | 'anthropic-messages' | 'openai-codex-responses'
  model: string
  apiKeyEnv?: 'OPENAI_API_KEY' | 'AZURE_OPENAI_API_KEY' | 'ANTHROPIC_API_KEY'
  baseURL?: string
  /** Explicit opt-in path to an AITP/Harness credential store; never imported from Codex. */
  credentialsPath?: string
}

/**
 * Select real-provider cases without retaining secret values in test configuration.
 * @param env - the launch environment, after the e2e runner loads its optional .env.
 * @returns cases enabled by their own credentials, with Azure as the OpenAI fallback.
 */
export function providerApiCases(env: Readonly<Record<string, string | undefined>>): ProviderCase[] {
  const openAIKey = env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : env.AZURE_OPENAI_API_KEY ? 'AZURE_OPENAI_API_KEY' : undefined
  const cases: ProviderCase[] = [
    {
      provider: 'openai',
      api: 'openai-responses',
      model: env.DSH_PI_AI_OPENAI_MODEL ?? 'gpt-5.5',
      ...openAIKey === undefined ? {} : { apiKeyEnv: openAIKey },
      ...env.DSH_PI_AI_OPENAI_BASE_URL ? { baseURL: env.DSH_PI_AI_OPENAI_BASE_URL } : {},
    },
    {
      provider: 'anthropic',
      api: 'anthropic-messages',
      model: env.DSH_PI_AI_ANTHROPIC_MODEL ?? 'claude-opus-4-8',
      ...env.ANTHROPIC_API_KEY ? { apiKeyEnv: 'ANTHROPIC_API_KEY' } : {},
      ...env.DSH_PI_AI_ANTHROPIC_BASE_URL ? { baseURL: env.DSH_PI_AI_ANTHROPIC_BASE_URL } : {},
    },
  ]
  if (env.DSH_PI_AI_CODEX_CREDENTIALS) {
    cases.push({
      provider: 'openai-codex', api: 'openai-codex-responses',
      model: env.DSH_PI_AI_CODEX_MODEL ?? 'gpt-6.1-sol',
      credentialsPath: env.DSH_PI_AI_CODEX_CREDENTIALS,
    })
  }
  return cases
}
