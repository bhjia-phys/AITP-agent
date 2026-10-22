import { describe, expect, it } from 'vitest'
import { providerApiCases } from './provider-api-cases.ts'

describe('real-provider smoke credentials', () => {
  it('enables the Responses smoke with a standard OpenAI key and retains only its reference', () => {
    const cases = providerApiCases({ OPENAI_API_KEY: 'fixture-openai-secret' })
    expect(cases[0]).toMatchObject({ provider: 'openai', apiKeyEnv: 'OPENAI_API_KEY' })
    expect(cases[1]).not.toHaveProperty('apiKeyEnv')
    expect(JSON.stringify(cases)).not.toContain('fixture-openai-secret')
  })

  it('keeps Azure as an explicit fallback and prefers the standard OpenAI key when both exist', () => {
    expect(providerApiCases({ AZURE_OPENAI_API_KEY: 'fixture-azure-secret' })[0])
      .toMatchObject({ apiKeyEnv: 'AZURE_OPENAI_API_KEY' })
    expect(providerApiCases({ OPENAI_API_KEY: 'openai', AZURE_OPENAI_API_KEY: 'azure' })[0])
      .toMatchObject({ apiKeyEnv: 'OPENAI_API_KEY' })
  })

  it('skips absent or empty credentials and never uses a DeepSeek key for another provider', () => {
    for (const env of [{}, { OPENAI_API_KEY: '', AZURE_OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', DEEPSEEK_API_KEY: 'fixture-deepseek-secret' }]) {
      expect(providerApiCases(env).every(profile => profile.apiKeyEnv === undefined)).toBe(true)
    }
  })

  it('retains provider-specific model and endpoint overrides', () => {
    expect(providerApiCases({
      ANTHROPIC_API_KEY: 'fixture-anthropic-secret',
      DSH_PI_AI_OPENAI_MODEL: 'openai-fixture',
      DSH_PI_AI_OPENAI_BASE_URL: 'https://openai.example/v1',
      DSH_PI_AI_ANTHROPIC_MODEL: 'anthropic-fixture',
      DSH_PI_AI_ANTHROPIC_BASE_URL: 'https://anthropic.example',
    })).toEqual([
      { provider: 'openai', api: 'openai-responses', model: 'openai-fixture', baseURL: 'https://openai.example/v1' },
      { provider: 'anthropic', api: 'anthropic-messages', model: 'anthropic-fixture', baseURL: 'https://anthropic.example', apiKeyEnv: 'ANTHROPIC_API_KEY' },
    ])
  })
})
