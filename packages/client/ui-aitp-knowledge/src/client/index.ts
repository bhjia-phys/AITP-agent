/** Independently composed knowledge library presentation. */
import type { Context } from '@deepseek-ai/cordis'
import type { LibraryModule } from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en, zh, type LibraryKey } from './locales.ts'
import { KnowledgeCatalog } from './KnowledgeCatalog.tsx'
import { KnowledgeHeader } from './KnowledgeHeader.tsx'
import { KnowledgeBody } from './KnowledgeBody.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'aitp.materials.knowledge': LibraryKey }
}

export const inject = ['researchMaterials', 'locale', 'slots']

/**
 * Register this library without owning source roots, a chat runtime or another index.
 * @param ctx - shared material composition and application locale.
 */
export function apply(ctx: Context): void {
  const namespace = 'aitp.materials.knowledge'
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }))
  ctx.slots.inject('aitp.materials.catalog.body', () => ctx.slots.register({
    name: 'aitp.materials.catalog.body', key: 'knowledge', locale: namespace,
  }, KnowledgeCatalog))
  ctx.slots.inject('aitp.materials.reader.header', () => ctx.slots.register({
    name: 'aitp.materials.reader.header', key: 'knowledge', locale: namespace,
  }, KnowledgeHeader))
  ctx.slots.inject('aitp.materials.reader.body', () => ctx.slots.register({
    name: 'aitp.materials.reader.body', key: 'knowledge', locale: namespace,
  }, KnowledgeBody))
  const t = ctx.locale.bind(namespace)
  ctx.effect(() => ctx.researchMaterials.registerModule({
    domain: 'knowledge', panelId: 'aitp-knowledge' as LibraryModule['panelId'], order: -28,
    labels: () => ({ title: t('title'), description: t('description'), fields: [
      { key: 'entryKind', label: t('kind') },
      { key: 'support', label: t('support') },
      { key: 'review', label: t('review') },
      { key: 'reading_depth', label: t('depth') },
      { key: 'origin', label: t('origin') },
    ] }),
  }))
}
