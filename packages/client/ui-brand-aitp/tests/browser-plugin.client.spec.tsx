// @vitest-environment jsdom
/** Real Web roster exercises identity registration, declarer reload, and plugin removal. */
import { expect } from 'vitest'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { BrandName } from '../src/client/BrandName.tsx'

const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.without(['@deepseek-ai/dsh-client-ui-brand-official']).rows,
  { name: '@deepseek-ai/dsh-client-ui-brand-aitp',
    inject: ['@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-locale'],
    immediately: false },
]) })
const SELF = '@deepseek-ai/dsh-client-ui-brand-aitp'

it('shows aitp-agent through the shipped roster and removes its effects on unload', async ({ start }) => {
  const client = await start()
  expect(client.ctx.slots.entries('sidebar.brand.name').map(entry => entry.component)).toEqual([BrandName])
  expect(client.ctx.locale.bind('aitp.brand')('name')).toBe('aitp-agent')
  await client.reload('@deepseek-ai/dsh-client-ui-sidebar')
  await client.flush()
  expect(client.ctx.slots.entries('sidebar.brand.name').map(entry => entry.component)).toEqual([BrandName])
  await client.unload(SELF)
  await client.flush()
  expect(client.ctx.slots.entries('sidebar.brand.name')).toHaveLength(0)
  expect(client.ctx.locale.bind('aitp.brand')('name')).toBe('name')
}, 60_000)
