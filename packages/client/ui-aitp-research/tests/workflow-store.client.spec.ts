// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createWorkflowStore } from '../src/client/workflow-store.ts'

afterEach(() => { localStorage.removeItem('aitp.research.workflow.v1') })

it('keeps a captured Session choice when another draft changes the new-session default', () => {
  const store = createWorkflowStore().create()
  const first = brandString<SessionId>('captured-first')
  const second = brandString<SessionId>('new-second')
  store.actions.capture(first)
  expect(store.getSnapshot().drafts[first]).toBe(true)
  store.actions.choose(second, false)
  store.actions.capture(first)
  expect(store.getSnapshot()).toMatchObject({ enabledByDefault: false, drafts: { [first]: true, [second]: false } })
  store.actions.choose(first, false)
  expect(store.getSnapshot().drafts[first]).toBe(false)
  store.actions.choose(second, true)
  store.actions.capture(first)
  expect(store.getSnapshot().drafts[first]).toBe(false)
})
