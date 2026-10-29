import { expect, it, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionPromptTransport } from '@deepseek-ai/dsh-api-session-controller/client'
import { ComposerSubmissionRegistry } from '../src/client/input/submissions.ts'

it('keeps explicit source admission authoritative, freezes captured routes and restores native admission on unload', () => {
  const registry = new ComposerSubmissionRegistry()
  const session = brandString<SessionId>('source-study')
  const fallback = vi.fn<SessionPromptTransport>()
  const source = vi.fn<SessionPromptTransport>()
  const defaultCapture = vi.fn(() => fallback)
  const releaseDefault = registry.registerFallback('research', defaultCapture)
  expect(registry.capture(session)).toBe(fallback)
  expect(() => registry.registerFallback('research', defaultCapture)).toThrow('already registered')
  const releaseSource = registry.register(session, () => source)
  expect(registry.capture(session)).toBe(source)
  expect(defaultCapture).toHaveBeenCalledTimes(1)
  releaseSource()
  const decline = registry.register(session, () => undefined)
  expect(registry.capture(session)).toBeUndefined()
  expect(defaultCapture).toHaveBeenCalledTimes(1)
  decline()
  const captured = registry.capture(session)
  releaseDefault()
  expect(registry.capture(session)).toBeUndefined()
  expect(captured).toBe(fallback)
})
