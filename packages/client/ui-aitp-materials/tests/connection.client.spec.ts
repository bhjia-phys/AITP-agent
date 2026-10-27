import { afterEach, describe, expect, it, vi } from 'vitest'
import { MaterialsConnection, type MaterialsTransport } from '../src/client/connection.ts'
import type { ResourceResult } from '@deepseek-ai/dsh-research-resources/types'

const active: { abort: AbortController; close: () => Promise<unknown> }[] = []
const transport = (): MaterialsTransport => ({
  listRoots: async () => ({ ok: true, value: [] }),
  listResources: async () => ({ ok: true, value: { items: [], nextCursor: null, completeness: 'complete', issues: [], observedAt: '' } }),
  readResource: async () => ({ ok: false, error: { code: 'unsupported', message: 'No reader', retryable: false } }),
  askStudy: async () => ({ ok: false, error: { code: 'unsupported', message: 'No study handler', retryable: false } }),
})
afterEach(async () => {
  const owned = active.splice(0)
  for (const item of owned) item.abort.abort()
  await Promise.all(owned.map(item => item.close()))
})

describe('material source connection lifecycle', () => {
  it('distinguishes unavailable storage from an unacknowledged mutation', async () => {
    const report = vi.fn()
    const connection = new MaterialsConnection(() => 'Not connected', report)
    connection.bind(transport())
    expect(await connection.run(current => current.management?.getSetup(new AbortController().signal)))
      .toMatchObject({ ok: false, error: { code: 'unsupported', retryable: false } })
    const lost = new Error('Lost acknowledgement')
    const result = await connection.run(() => Promise.reject(lost), 'stable-save-operation')
    expect(result).toMatchObject({ ok: false, error: { code: 'outcome-unknown', operationId: 'stable-save-operation', retryable: false } })
    expect(report).toHaveBeenCalledExactlyOnceWith(lost)
  })

  it('wakes an unconnected reading on binding, rereads after invalidation and withdraws on unbind', async () => {
    const connection = new MaterialsConnection(() => 'Not connected', vi.fn())
    const abort = new AbortController()
    const frames = connection.frames(abort.signal, async () => ({ ok: true, value: 'source value' }))[Symbol.asyncIterator]()
    active.push({ abort, close: async () => frames.return?.() })
    expect((await frames.next()).value).toMatchObject({ ok: false, error: { code: 'aitp/materials' } })
    const unbind = connection.bind(transport())
    expect((await frames.next()).value).toEqual({ ok: true, value: 'source value' })
    connection.changed()
    expect((await frames.next()).value).toEqual({ ok: true, value: 'source value' })
    unbind()
    expect((await frames.next()).value).toMatchObject({ ok: false, error: { code: 'aitp/materials' } })
  })

  it('lets cancellation release a source even when a superseded read ignores its signal', async () => {
    const connection = new MaterialsConnection(() => 'Not connected', vi.fn())
    connection.bind(transport())
    let entered!: () => void
    let finish!: (result: ResourceResult<string>) => void
    const started = new Promise<void>((resolve) => { entered = resolve })
    const abort = new AbortController()
    const frames = connection.frames(abort.signal, () => {
      entered()
      return new Promise<ResourceResult<string>>((resolve) => { finish = resolve })
    })[Symbol.asyncIterator]()
    active.push({ abort, close: async () => frames.return?.() })
    const pending = frames.next()
    await started
    abort.abort()
    expect(await pending).toEqual({ done: true, value: undefined })
    finish({ ok: true, value: 'Late text must not publish' })
    expect(await frames.next()).toEqual({ done: true, value: undefined })
  })
})
