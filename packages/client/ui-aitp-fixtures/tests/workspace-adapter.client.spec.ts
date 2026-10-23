/** Async fixture behavior, ownership and qualified source boundaries. */
import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ChangeIntent, ReadEnvelope, Result, Topic, TopicId } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import { FixtureWorkspaceAdapter } from '../src/client/workspace-adapter.ts'

const WS = 'fixture-workspace' as WorkspaceId
const CHAOS = 'quantum-chaos' as TopicId
const KRYLOV = 'operator-krylov' as TopicId

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function scopePreview(adapter: FixtureWorkspaceAdapter, topic: ReadEnvelope<Topic>, scope: string) {
  return value(await adapter.previewChange({ topicId: topic.value.id, expectedRevision: topic.revision, command: { kind: 'update-scope', scope } }))
}

describe('research workspace fixture', () => {
  it('reads roots, nested children and complete materials asynchronously with explicit origin', async () => {
    const adapter = new FixtureWorkspaceAdapter(WS)
    expect(value(await adapter.getProject())).toMatchObject({ origin: 'fixture', value: { title: 'Research workspace' } })
    const roots = value(await adapter.listTopics({ parentId: null })).value.items
    expect(roots.map(root => root.value.id)).toEqual(['quantum-chaos', 'electronic-structure'])
    const child = value(await adapter.listTopics({ parentId: CHAOS })).value.items[0]!
    const leaf = value(await adapter.getTopic(child.value.childIds[0]!))
    expect(leaf.value.id).toBe(KRYLOV)
    const account = value(await adapter.getResource(leaf.value.accountResourceId!))
    expect(account.value.content).toMatchObject({ kind: 'markdown', text: expect.stringContaining('## Argument and limits') as string })
    const chains = value(await adapter.getTopic(child.value.id)).value
    expect(value(await adapter.getResource(chains.resources[1]!.id)).value.content).toMatchObject({ kind: 'unavailable', reason: 'unsupported-format' })
    expect(await adapter.getTopic('missing' as TopicId)).toMatchObject({ ok: false, error: { code: 'not-found' } })
  })

  it('previews without mutation, then refreshes the same owner and full account on apply', async () => {
    const adapter = new FixtureWorkspaceAdapter(WS)
    const topic = value(await adapter.getTopic(CHAOS))
    const preview = await scopePreview(adapter, topic, 'Only compare the selected finite reference.')
    expect(value(await adapter.getTopic(CHAOS)).value.scope).toBe(topic.value.scope)
    const event = vi.fn(), unsubscribe = adapter.subscribeChanges({}, event)
    const applied = value(await adapter.applyChange({ previewId: preview.value.previewId, operationId: 'edit-1' }))
    const current = value(await adapter.getTopic(CHAOS))
    expect(current.revision).toBe(applied.value.changed[0]!.revision)
    expect(current.value.scope).toBe('Only compare the selected finite reference.')
    const account = value(await adapter.getResource(current.value.accountResourceId!))
    expect(account.value.content).toMatchObject({ text: expect.stringContaining(current.value.scope) as string })
    expect(value(await adapter.getActivity({ topicId: CHAOS })).value.items).toHaveLength(1)
    expect(event).toHaveBeenCalledWith(expect.objectContaining({ kind: 'invalidate' }))
    unsubscribe()
    adapter.setConnected(false)
    expect(event).toHaveBeenCalledTimes(1)
  })

  it('keeps child answers, qualifications, attribution and project cards consistent', async () => {
    const adapter = new FixtureWorkspaceAdapter(WS)
    const topic = value(await adapter.getTopic(KRYLOV))
    const preview = value(await adapter.previewChange({
      topicId: KRYLOV, expectedRevision: topic.revision,
      command: { kind: 'record-answer', text: 'The reference conserves normalization.', qualification: 'This is a synthetic small-system statement, not a chaos result.', sourceResourceIds: [topic.value.resources[1]!.id] },
    }))
    value(await adapter.applyChange({ previewId: preview.value.previewId, operationId: 'answer-1' }))
    const card = value(await adapter.listTopics({})).value.items.find(item => item.value.id === KRYLOV)!
    expect(card.value.currentAnswer).toMatchObject({ text: 'The reference conserves normalization.', qualification: expect.stringContaining('not a chaos result') as string, attribution: { actor: { kind: 'researcher' } } })
    expect(card.revision).toBe(value(await adapter.getTopic(KRYLOV)).revision)
  })

  it('rejects stale previews, retries one operation idempotently and refuses identity reuse', async () => {
    const adapter = new FixtureWorkspaceAdapter(WS)
    const topic = value(await adapter.getTopic(CHAOS))
    const first = await scopePreview(adapter, topic, 'First scope'), other = await scopePreview(adapter, topic, 'Other scope')
    const request = { previewId: first.value.previewId, operationId: 'same-operation' }
    const receipt = await adapter.applyChange(request)
    expect(await adapter.applyChange(request)).toEqual(receipt)
    expect(value(await adapter.getActivity({ topicId: CHAOS })).value.items).toHaveLength(1)
    expect(await adapter.applyChange({ previewId: other.value.previewId, operationId: 'other-operation' })).toMatchObject({ ok: false, error: { code: 'revision-conflict' } })
    expect(await adapter.applyChange({ previewId: other.value.previewId, operationId: 'same-operation' })).toMatchObject({ ok: false, error: { code: 'operation-reused' } })
    expect(await adapter.previewChange({ topicId: CHAOS, expectedRevision: topic.revision, command: { kind: 'update-scope', scope: 'Stale' } })).toMatchObject({ ok: false, error: { code: 'revision-conflict' } })
  })

  it('keeps Workspace state and returned objects isolated', async () => {
    const a = new FixtureWorkspaceAdapter(WS), b = new FixtureWorkspaceAdapter('other' as WorkspaceId)
    const topic = value(await a.getTopic(CHAOS))
    const preview = await scopePreview(a, topic, 'Changed only here')
    value(await a.applyChange({ previewId: preview.value.previewId, operationId: 'one' }))
    expect(value(await b.getTopic(CHAOS)).value.scope).toBe(topic.value.scope)
    // Wire-shaped returned data can be manipulated by its caller without changing the owner.
    const mutable = structuredClone(topic) as { value: { scope: string } }
    mutable.value.scope = 'Caller copy'
    expect(value(await b.getTopic(CHAOS)).value.scope).not.toBe('Caller copy')
  })


  it('does not accept a preview from a previous provider lifetime', async () => {
    const previous = new FixtureWorkspaceAdapter(WS), replacement = new FixtureWorkspaceAdapter(WS)
    const oldPreview = await scopePreview(previous, value(await previous.getTopic(CHAOS)), 'Old provider scope')
    const newPreview = await scopePreview(replacement, value(await replacement.getTopic(CHAOS)), 'New provider scope')
    expect(newPreview.value.previewId).not.toBe(oldPreview.value.previewId)
    expect(await replacement.applyChange({ previewId: oldPreview.value.previewId, operationId: 'old-editor' })).toMatchObject({ ok: false, error: { code: 'preview-expired' } })
    expect(value(await replacement.getTopic(CHAOS)).value.scope).not.toBe('New provider scope')
  })

  it('preserves bounded context as whole qualified units without fabricating model delivery', async () => {
    const adapter = new FixtureWorkspaceAdapter(WS)
    const context = value(await adapter.readContext({ topicId: KRYLOV, maxItems: 1, maxCharacters: 5000 }))
    expect(context.value.entries).toHaveLength(1)
    expect(context.value.entries[0]!.text).toContain('larger research question remains open')
    expect(context.value.omissions).toHaveLength(2)
    expect(context.value.completeness).toBe('partial')
    const tiny = value(await adapter.readContext({ topicId: KRYLOV, maxCharacters: 1 }))
    expect(tiny.value.entries).toEqual([])
    expect(tiny.value.omissions.length).toBeGreaterThan(0)
    expect(value(await adapter.getActivity({ topicId: KRYLOV })).value.items).toEqual([])
    expect(await adapter.readContext({ topicId: KRYLOV, maxItems: 0 })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  })

  it('binds pagination to its selection and observed snapshot', async () => {
    const adapter = new FixtureWorkspaceAdapter(WS)
    const first = value(await adapter.listTopics({ limit: 2 })).value
    const second = value(await adapter.listTopics({ limit: 2, cursor: first.nextCursor! })).value
    expect(first.items.map(item => item.value.id)).not.toEqual(second.items.map(item => item.value.id))
    expect(await adapter.listTopics({ parentId: null, cursor: first.nextCursor! })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const topic = value(await adapter.getTopic(CHAOS)), preview = await scopePreview(adapter, topic, 'Invalidates the list cursor')
    value(await adapter.applyChange({ previewId: preview.value.previewId, operationId: 'page-change' }))
    expect(await adapter.listTopics({ cursor: first.nextCursor! })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  })

  it('reports cancellation, disconnected reads, unsupported operations and unavailable previews explicitly', async () => {
    const adapter = new FixtureWorkspaceAdapter(WS), controller = new AbortController()
    const pending = adapter.getProject({ signal: controller.signal })
    controller.abort()
    expect(await pending).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    expect(await adapter.getProject({ signal: controller.signal })).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    const topic = value(await adapter.getTopic(CHAOS))
    const intent: ChangeIntent = { topicId: CHAOS, expectedRevision: topic.revision, command: { kind: 'revert-change', changeId: 'unknown' } }
    expect(await adapter.previewChange(intent)).toMatchObject({ ok: false, error: { code: 'unsupported' } })
    expect(await adapter.applyChange({ previewId: 'missing', operationId: 'one' })).toMatchObject({ ok: false, error: { code: 'preview-expired' } })
    adapter.setConnected(false)
    expect(await adapter.getProject()).toMatchObject({ ok: false, error: { code: 'not-connected' } })
    expect(await adapter.previewChange(intent)).toMatchObject({ ok: false, error: { code: 'not-connected' } })
    adapter.setConnected(true)
    expect((await adapter.getProject()).ok).toBe(true)
    const event = vi.fn()
    adapter.subscribeChanges({ afterEventId: 'old' }, event)()
    expect(event).toHaveBeenCalledWith(expect.objectContaining({ kind: 'resync-required' }))
  })
})
