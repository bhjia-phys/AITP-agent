import { describe, expect, it } from 'vitest'
import { latestResearchChange } from '../src/client/research-change-model.ts'

function tool(seq: number, state: string, extra: object = {}) {
  return { kind: 'tool-result', seq, name: 'research_apply_change', isError: false,
    meta: { researchWrite: { operationId: `operation-${seq}`, state } }, subCalls: [], ...extra }
}
function node(root: unknown) { return { kind: 'tool-call', data: { root } } }

describe('native research change feedback', () => {
  it('only accepts research writer metadata, never model prose or generic file edits', () => {
    expect(latestResearchChange([
      { kind: 'assistant-step', data: { content: 'All research records were saved.' } },
      node(tool(2, 'applied', { name: 'edit_file' })),
      node(tool(3, 'applied', { name: 'bash' })),
    ])).toBeNull()
  })
  it('keeps partial, unknown, and prepared results distinct from a confirmed save', () => {
    for (const state of ['partial', 'unknown', 'prepared', 'not-applied', 'pending', 'no-change', 'applied']) {
      expect(latestResearchChange([node(tool(1, state))])).toEqual({ operationId: 'operation-1', seq: 1, state })
    }
  })
  it('selects the newest nested writer result and reuses its identity across unrelated updates', () => {
    const child = tool(8, 'partial')
    const nested = node({ kind: 'tool-result', name: 'ptc', subCalls: [tool(3, 'applied'), { subCalls: [child] }] })
    const first = latestResearchChange([node(tool(1, 'applied')), nested])
    expect(first).toEqual({ operationId: 'operation-8', state: 'partial', seq: 8 })
    expect(latestResearchChange([nested, { kind: 'assistant-step', data: { text: 'Streaming…' } }])).toBe(first)
  })
  it('ignores failed tools and malformed or unknown result metadata', () => {
    expect(latestResearchChange([
      node(tool(1, 'applied', { isError: true })), node(tool(2, 'invented')),
      node(tool(3, 'applied', { meta: { researchWrite: { operationId: 12, state: 'applied' } } })),
      node({}), { kind: 'tool-call', data: null },
    ])).toBeNull()
  })
})
