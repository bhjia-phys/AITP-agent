/** Independently composed literature library presentation. */
import type { Context } from '@deepseek-ai/cordis'
import type { LibraryModule } from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en, zh, type LibraryKey } from './locales.ts'
import { LiteratureCatalog } from './LiteratureCatalog.tsx'
import { LiteratureHeader } from './LiteratureHeader.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'aitp.materials.literature': LibraryKey }
}

export const inject = ['researchMaterials', 'locale', 'slots']

/**
 * Register this library without owning source roots, a chat runtime or another index.
 * @param ctx - shared material composition and application locale.
 */
export function apply(ctx: Context): void {
  const namespace = 'aitp.materials.literature'
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }))
  ctx.slots.inject('aitp.materials.catalog.body', () => ctx.slots.register({
    name: 'aitp.materials.catalog.body', key: 'literature', locale: namespace,
  }, LiteratureCatalog))
  ctx.slots.inject('aitp.materials.reader.header', () => ctx.slots.register({
    name: 'aitp.materials.reader.header', key: 'literature', locale: namespace,
  }, LiteratureHeader))
  const t = ctx.locale.bind(namespace)
  ctx.effect(() => ctx.researchMaterials.registerModule({
    domain: 'literature', panelId: 'aitp-literature' as LibraryModule['panelId'], order: -29,
    labels: () => ({ title: t('title'), description: t('description'), fields: [
      { key: 'authors', label: t('authors') },
      { key: 'year', label: t('year') },
      { key: 'edition', label: t('edition') },
      { key: 'format', label: t('format') },
      { key: 'reading_depth', label: t('depth') },
    ] }),
  }))
}
