import { clientBundle } from '../tsdown.client.ts'
import type { UserConfig } from 'tsdown'

const bundle = clientBundle(import.meta.dirname, ['lib/types/index.js'])

export default (options: Parameters<typeof bundle>[0]): UserConfig[] => bundle(options).map((config) => {
  if (!config.name?.endsWith('/client')) return config
  const input = config.inputOptions
  if (typeof input === 'function') throw new Error('The material reader requires the shared client preset with static input options.')
  return {
    ...config,
    inputOptions: {
      ...input,
      resolve: { ...input?.resolve, mainFields: ['browser', 'module', 'main'], aliasFields: [['browser']] },
    },
  }
})
