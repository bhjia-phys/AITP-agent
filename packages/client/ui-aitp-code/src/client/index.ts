/** Independently composed code library presentation. */
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { LibraryModule } from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en, zh, type LibraryKey } from './locales.ts'
import { CodeCatalog } from './CodeCatalog.tsx'
import { CodeHeader, CodeBody } from './CodeReader.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'aitp.materials.code': LibraryKey }
}

export const inject = ['researchMaterials', 'locale', 'slots']

/**
 * Register this library without owning source roots, a chat runtime or another index.
 * @param ctx - shared material composition and application locale.
 */
export function apply(ctx: Context): void {
  const namespace = 'aitp.materials.code'
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }))
  ctx.slots.inject('aitp.materials.catalog.body', () => ctx.slots.register({ name: 'aitp.materials.catalog.body', key: 'code', locale: namespace }, CodeCatalog))
  ctx.slots.inject('aitp.materials.reader.header', () => ctx.slots.register({ name: 'aitp.materials.reader.header', key: 'code', locale: namespace }, CodeHeader))
  ctx.slots.inject('aitp.materials.reader.body', () => ctx.slots.register({ name: 'aitp.materials.reader.body', key: 'code', locale: namespace }, CodeBody))
  const t = ctx.locale.bind(namespace)
  ctx.effect(() => ctx.researchMaterials.registerModule({
    domain: 'code', panelId: brandString<LibraryModule['panelId']>('aitp-code'), order: -27,
    labels: () => ({ title: t('title'), description: t('description'), fields: [
      { key: 'checkoutPath', label: t('checkout') },
      { key: 'branch', label: t('branch') },
      { key: 'head', label: t('head') },
      { key: 'dirtyCount', label: t('dirty') },
      { key: 'revision', label: t('revision') },
    ] }),
  }))
}
