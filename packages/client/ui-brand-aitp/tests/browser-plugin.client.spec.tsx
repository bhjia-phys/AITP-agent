// @vitest-environment jsdom
/** Real Web roster exercises identity registration, the presentation palette layer, declarer reload, and plugin removal. */
import { expect } from 'vitest'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { render } from '@testing-library/react'
import { BrandName } from '../src/client/BrandName.tsx'
import type {} from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.without(['@deepseek-ai/dsh-client-ui-brand-official']).rows,
  { name: '@deepseek-ai/dsh-client-ui-brand-aitp',
    inject: ['@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-client-ui-theme'],
    immediately: false },
]) })
const SELF = '@deepseek-ai/dsh-client-ui-brand-aitp'

it('shows aitp-agent through the shipped roster and removes its effects on unload', async ({ start }) => {
  const client = await start()
  expect(client.ctx.slots.entries('sidebar.brand.name').map(entry => entry.component)).toEqual([BrandName])
  expect(client.ctx.locale.bind('aitp.brand')('name')).toBe('aitp-agent')
  const tokens = () => client.ctx.theme.getTheme().active.tokens ?? {}
  expect(tokens()).toMatchObject({ '--dsw-alias-bg-base': '#fbfaf6', '--dsw-alias-brand-primary': '#346b59' })
  expect(tokens()['--aitp-font-reading']).toMatch(/^"Source Serif 4"/u)
  await client.reload('@deepseek-ai/dsh-client-ui-sidebar')
  await client.flush()
  expect(client.ctx.slots.entries('sidebar.brand.name').map(entry => entry.component)).toEqual([BrandName])
  await client.unload(SELF)
  await client.flush()
  expect(client.ctx.slots.entries('sidebar.brand.name')).toHaveLength(0)
  expect(client.ctx.locale.bind('aitp.brand')('name')).toBe('name')
  expect(tokens()['--aitp-font-reading']).toBeUndefined()
  expect(tokens()['--dsw-alias-bg-base']).not.toBe('#fbfaf6')
}, 60_000)

it('renders the localized product name and keeps the Host entry inert', () => {
  const props = { t: (key: string) => (key === 'name' ? 'aitp-agent' : key) } as Parameters<typeof BrandName>[0]
  expect(render(<BrandName {...props} />).getByText('aitp-agent')).toBeDefined()
  expect(() => { hostApply() }).not.toThrow()
})
