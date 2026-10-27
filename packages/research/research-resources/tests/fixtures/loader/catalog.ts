/** A domain contribution exercised through the real Loader, shared scan and guarded reader. */
import type { Context } from '@deepseek-ai/cordis'
import { resourceEntryId, sourceIdForPath } from '../../../src/identity.ts'
import type {} from '../../../src/index.ts'

export const name = 'research-resources-test-catalog'
export const inject = ['researchResources']

/** @param ctx - Loader-owned domain fiber; unloading it withdraws its complete contribution. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.researchResources.registerProvider({
    id: 'loader-knowledge', domain: 'knowledge',
    list: async context => context.paths.map((path) => {
      const ref = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
      return { id: resourceEntryId(ref), ref, title: path, kind: 'knowledge', domain: 'knowledge', providerId: 'loader-knowledge',
        metadata: { support: 'source', review: 'awaiting researcher review' }, links: [], topics: [] }
    }),
  }), 'loader fixture: knowledge provider')
}
