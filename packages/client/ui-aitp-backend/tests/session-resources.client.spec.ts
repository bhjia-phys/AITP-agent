import { describe, expect, it, vi } from 'vitest'
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { observedFrames } from '../src/client/session-resources.ts'

function notifications() {
  const listeners = new Set<() => void>()
  return { listeners, subscribe: (changed: () => void) => { listeners.add(changed); return () => { listeners.delete(changed) } },
    change: () => { for (const changed of listeners) changed() } }
}

describe('Session memory resource lifetime', () => {
  it('rereads current data and releases the existing subscription while paused at a yielded frame', async () => {
    const feed = notifications(), signal = new AbortController()
    const read = vi.fn(async (): Promise<RemoteResult<string | null>> => ({ ok: true, value: 'original' }))
    const frames = observedFrames(read, feed.subscribe, signal.signal)[Symbol.asyncIterator]()
    expect(await frames.next()).toEqual({ done: false, value: { ok: true, value: 'original' } })
    read.mockResolvedValue({ ok: true, value: 'updated' })
    feed.change()
    expect(await frames.next()).toEqual({ done: false, value: { ok: true, value: 'updated' } })
    signal.abort()
    expect(feed.listeners.size).toBe(0)
    expect((await frames.next()).done).toBe(true)
  })

  it('keeps an empty observation subscribed until a later Session event binds research memory', async () => {
    const feed = notifications(), signal = new AbortController()
    const read = vi.fn(async (): Promise<RemoteResult<string | null>> => ({ ok: true, value: null }))
    const empty = observedFrames(read, feed.subscribe, signal.signal)[Symbol.asyncIterator]()
    expect(await empty.next()).toEqual({ done: false, value: { ok: true, value: null } })
    expect(feed.listeners.size).toBe(1)
    read.mockResolvedValue({ ok: true, value: 'Research origin committed after the first observation.' })
    feed.change()
    expect(await empty.next()).toEqual({ done: false, value: { ok: true, value: 'Research origin committed after the first observation.' } })
    signal.abort()
    expect((await empty.next()).done).toBe(true)
    expect(feed.listeners.size).toBe(0)
  })

  it('keeps actual failure frames explicit', async () => {
    const feed = notifications(), signal = new AbortController()
    const error = new RemoteError('aitp/workspace', 'Denied', { code: 'permission-denied', message: 'Denied', retryable: false })
    const failed = observedFrames(async () => ({ ok: false, error }), feed.subscribe, signal.signal)[Symbol.asyncIterator]()
    expect(await failed.next()).toEqual({ done: false, value: { ok: false, error } })
    signal.abort()
    await failed.return?.()
  })

  it('discards invalidated in-flight results and cancels an uncooperative reader on release', async () => {
    const feed = notifications(), signal = new AbortController()
    let resolveOld: ((value: RemoteResult<string>) => void) | undefined
    const read = vi.fn<((signal: AbortSignal) => Promise<RemoteResult<string | null>>)>()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValue({ ok: true, value: 'fresh' })
    const frames = observedFrames(read, feed.subscribe, signal.signal)[Symbol.asyncIterator]()
    const next = frames.next()
    await vi.waitFor(() => { expect(read).toHaveBeenCalledOnce() })
    feed.change()
    expect(await next).toEqual({ done: false, value: { ok: true, value: 'fresh' } })
    resolveOld?.({ ok: true, value: 'stale' })
    signal.abort()
    await frames.return?.()
    const pendingSignal = new AbortController()
    const pending = observedFrames<string>(() => new Promise(() => {}), feed.subscribe, pendingSignal.signal)[Symbol.asyncIterator]()
    const waiting = pending.next()
    pendingSignal.abort()
    expect((await waiting).done).toBe(true)
    expect(feed.listeners.size).toBe(0)
  })
})
