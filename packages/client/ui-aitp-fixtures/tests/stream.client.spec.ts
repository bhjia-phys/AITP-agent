/**
 * Fixture plumbing: address segments decode or are absent, a held stream
 * yields its frame and ends on release, and the Host entry stays inert.
 */
import { describe, expect, it } from 'vitest'
import { hold, segmentAfter } from '../src/client/stream.ts'
import { demoMemory } from '../src/client/data.ts'
import { apply as fixturesNode } from '../src/index.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

describe('fixture streams', () => {
  it('reads the decoded segment after a key, or nothing', () => {
    expect(segmentAfter('dsh-resource://aitp-note/workspace/w/note/a%2Fb.md', 'note')).toBe('a/b.md')
    expect(segmentAfter('dsh-resource://aitp-topic/workspace/w', 'topic')).toBeUndefined()
  })

  it('yields one frame and ends once released, at once when already released', async () => {
    const controller = new AbortController()
    const frames: unknown[] = []
    const reading = (async () => { for await (const frame of hold({ ok: true, value: 1 }, controller.signal)) frames.push(frame) })()
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(frames).toEqual([{ ok: true, value: 1 }])
    controller.abort()
    await reading
    const released = AbortSignal.abort()
    const seen: unknown[] = []
    for await (const frame of hold({ ok: true, value: 2 }, released)) seen.push(frame)
    expect(seen).toEqual([{ ok: true, value: 2 }])
  })

  it('labels the demonstration memory as fixture data for the requested Session', () => {
    expect(demoMemory('s9' as SessionId)).toMatchObject({ origin: 'fixture', sessionId: 's9' })
  })

  it('keeps the Host entry inert', () => {
    expect(() => { fixturesNode() }).not.toThrow()
  })
})
