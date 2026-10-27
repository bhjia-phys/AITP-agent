import { describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { acceptHumanInput, emptyWorkingState, originPointer, originSchema, scopeKey } from '../src/working-state.ts'

const selection = {
  ref: { rootId: 'papers', sourceId: 'source:paper.md' },
  locator: { kind: 'text', start: 2, end: 7, quote: '条件仍在。' },
  selectedText: '条件仍在。',
}

describe('durable source-study scope', () => {
  it('recovers Global with its own study identity instead of a fabricated topic or Workspace', () => {
    const origin = originSchema.parse({ scope: 'global', studyId: 'set-a', selections: [selection] })
    expect(origin.workspaceId).toBeUndefined()
    expect(origin.topicId).toBeUndefined()
    expect(origin.selections?.[0]).toEqual(selection)
    expect(originSchema.safeParse({ scope: 'global', selections: [selection] }).success).toBe(false)
    expect(originSchema.safeParse({ scope: 'global', studyId: 'set-a', topicId: 'topic:wrong' }).success).toBe(false)
  })

  it('keeps separate global source sets apart while allowing selection changes within one study', () => {
    const first = originSchema.parse({ scope: 'global', studyId: 'set-a', selections: [selection] })
    const another = originSchema.parse({ scope: 'global', studyId: 'set-b', selections: [selection] })
    const changed = originSchema.parse({ scope: 'global', studyId: 'set-a', selections: [] })
    expect(scopeKey(first)).not.toBe(scopeKey(another))
    expect(scopeKey(first)).toBe(scopeKey(changed))
  })

  it('retains the existing topic namespace when evidence comes from a different root', () => {
    const plain = originSchema.parse({ workspaceId: 'project', topicId: 'topic:branch.md' })
    const selected = originSchema.parse({ workspaceId: 'project', topicId: 'topic:branch.md', selections: [selection] })
    expect(scopeKey(selected)).toBe(scopeKey(plain))
    expect(scopeKey(plain)).toBe(JSON.stringify(['project', 'topic:branch.md']))
    expect(originSchema.safeParse({ topicId: 'topic:branch.md', selections: [selection] }).success).toBe(false)
  })

  it('rejects invalid persisted locators instead of inventing a matching passage', () => {
    const parse = (locator: object): boolean => originSchema.safeParse({ scope: 'global', studyId: 'set-a',
      selections: [{ ref: selection.ref, locator }] }).success
    expect(parse({ kind: 'text', start: 2, end: 6, quote: selection.selectedText })).toBe(false)
    expect(parse({ kind: 'pdf-page', page: 0 })).toBe(false)
    expect(parse({ kind: 'code', startLine: 8, endLine: 3 })).toBe(false)
    expect(parse({ kind: 'pdf-page', page: 1, region: { x: 0, y: 0, width: -1, height: 1 } })).toBe(false)
  })

  it('retains exact excerpts in the original input while derived pointers keep only source addressing', () => {
    const origin = originSchema.parse({ scope: 'global', studyId: 'set-a', selections: [selection] })
    const message = createUserMessage({ content: [{ type: 'text', text: '请保留这个条件，比较两份推导。' }],
      source: { kind: 'aitp-research', actor: 'human', origin } })
    const state = acceptHumanInput(emptyWorkingState(), message, 1)
    expect(state.origin?.selections?.[0]?.selectedText).toBe(selection.selectedText)
    expect(state.humans[0]?.origin.selections).toEqual([{ ref: selection.ref }])
    expect(originPointer(origin).selections).toEqual([{ ref: selection.ref }])
    expect(state.ownerOrigin).toBe(true)
  })
})
