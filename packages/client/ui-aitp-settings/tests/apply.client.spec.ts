/** Real settings/locale/slot composition stays reachable without any research backend. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject } from '../src/client/index.ts'
import { ResearchSettingsSection } from '../src/client/ResearchSettingsSection.tsx'
import type { ResearchSettingsFace } from '../src/client/research-settings-controller.ts'
import { Preferences } from '../src/preferences.ts'

const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

async function bench(served = true) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('en')
  ctx.provide('locale', locale)
  new TestRemote(ctx, { settings: { describe: vi.fn(async () => ({ ok: true, value: { writable: true, hasDocument: true,
    namespaces: served ? [{ ns: 'ui-aitp-settings', schema: Preferences.toJSON(), applies: 'live', secrets: [], revision: 3,
      value: { suite: 'skills', literature: true, knowledge: false, code: false } }] : [],
  } })) } })
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({ name: 'root', children: { 'settings.section': { kind: 'list', scope: 'root' } } } as never, () => null)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, locale, fiber }
}

it('keeps a localized Research entry available in Skills mode without a research or inventory service', async () => {
  const { slots, locale, fiber } = await bench()
  const entry = slots.entries('settings.section')[0]!
  expect(entry.options.id).toBe('research')
  expect(entry.component).toBe(ResearchSettingsSection)
  expect(resolveSlotLabel(entry.options.label)).toBe('Research')
  locale.setLocale('zh')
  expect(resolveSlotLabel(entry.options.label)).toBe('科研')
  const face = (entry.inject as unknown as () => ResearchSettingsFace)()
  await vi.waitFor(() => { expect(face.hooks.researchSettings.getSnapshot().value?.suite).toBe('skills') })
  face.refresh()
  await vi.waitFor(() => { expect(face.hooks.researchSettings.getSnapshot().inventoryFailed).toBe(true) })
  expect(face.hooks.researchSettings.getSnapshot().available).toBe(true)
  await fiber.dispose()
  expect(slots.entries('settings.section')).toHaveLength(0)
})

it('retains the native settings entry with an unavailable form state when preferences are not served', async () => {
  const { slots } = await bench(false)
  const entry = slots.entries('settings.section')[0]!
  const face = (entry.inject as unknown as () => ResearchSettingsFace)()
  await vi.waitFor(() => { expect(face.hooks.researchSettings.getSnapshot().loading).toBe(false) })
  expect(face.hooks.researchSettings.getSnapshot()).toMatchObject({ available: false, value: undefined, dirty: false })
})
