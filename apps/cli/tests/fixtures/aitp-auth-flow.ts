/** Scripted exchange for the real auth profile; never calls a remote provider. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-authorization'
import type {} from '@deepseek-ai/dsh-llm'
import { credentialKey } from '@deepseek-ai/dsh-credentials'

export const name = 'aitp-auth-test-flow'
export const inject = ['authorization', 'credentials', 'llm']

export function apply(ctx: Context): void {
  ctx.authorization.registerFlow({
    key: credentialKey('llm-pi-ai', 'aitp-auth-test'),
    label: 'Scripted test provider',
    methods: [{ id: 'oauth', label: 'Scripted login' }],
    async run(session) {
      session.notify({ message: 'Scripted authorization notice', url: 'https://example.invalid/login' })
      const answer = await session.prompt({ kind: 'secret', message: 'Scripted secret prompt' })
      if (answer === 'fail') throw new Error('raw-provider-error-with-fixture-secret')
      await session.commit({ kind: 'grant', payload: { type: 'api_key', key: answer } })
      await ctx.credentials.modifyRecord(credentialKey('llm-pi-ai', 'openai-codex'), () => Promise.resolve({
        kind: 'grant', payload: { type: 'oauth', access: 'fixture-oauth-access', refresh: 'fixture-oauth-refresh', expires: Date.now() + 60_000 },
      }))
      const providers = ctx.llm.listProviders()
      const models = await ctx.llm.listModels('openai-codex')
      session.notify({ message: `Fixture model count: ${models.length}; providers: ${JSON.stringify(providers)}` })
      if (!providers.some(provider => provider.id === 'openai') || models.length === 0) throw new Error('GPT routes unavailable')
      if (!providers.some(provider => provider.id === 'deepseek' && provider.name === 'Retained user route')) throw new Error('user route lost')
      if (!providers.some(provider => provider.id === 'openai-codex' && provider.name === 'Retained GPT label')) throw new Error('user label lost')
      session.notify({ message: 'GPT models available; user route and label retained.' })
    },
  })
}
