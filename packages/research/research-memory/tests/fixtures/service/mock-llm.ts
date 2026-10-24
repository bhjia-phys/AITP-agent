/** The only substituted service: deterministic model responses with actual request capture. */
import { appendFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'

class Model extends LlmAdapter {
  private calls = 0
  override async * stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.calls++
    await appendFile('service-requests.jsonl', `${JSON.stringify(request)}\n`)
    const history = JSON.stringify(request.messages)
    const resume = history.includes('Resume the same child after restart.')
    let name: string | undefined
    let args: object = {}
    if (!resume && this.calls === 1) {
      name = 'research_prepare_change'
      args = { disposition: 'edit', rationale: 'A conditional finite-size result is now supported.',
        edits: [{ resourceId: 'resource:child%2Fresearch.md', originalText: 'No accepted bound.',
          replacementText: 'At N=6, B holds only under A.', rationale: 'Retain the finite-size and assumption boundary.',
          sourceRefs: ['resource:report.md#control'] }],
        remainingUses: ['Assess whether this finite result changes the parent use.'],
      }
    } else if (!resume && this.calls === 4) {
      const childOperationId = /Operation ([0-9a-f-]+): prepared/.exec(history)?.[1]
      if (childOperationId === undefined) throw new Error('The parent assessment has no child operation locator.')
      name = 'research_prepare_change'
      args = { disposition: 'edit',
        rationale: `Assessed the parent use left by child operation ${childOperationId}: its finite-size control supports only the conditional N=6 statement. This repair completes that identified parent-use assessment; the independent sibling was not assessed.`,
        edits: [{ resourceId: 'resource:research.md',
          originalText: 'supplies finite-size controls only; it does not settle the root question.',
          replacementText: 'establishes B at N=6 only under A; no thermodynamic or root conclusion follows.',
          rationale: 'Repair the explicitly assessed parent use while retaining every scope limit.',
          sourceRefs: [`operation:${childOperationId}`, 'resource:child%2Fresearch.md#current-answer', 'resource:report.md#control'] }],
        remainingUses: [],
      }
    } else if (!resume && (this.calls === 2 || this.calls === 5)) {
      name = 'research_apply_change'
      const operationId = [...history.matchAll(/Operation ([0-9a-f-]+): prepared/g)].at(-1)?.[1]
      if (operationId === undefined) throw new Error('The actual model request has no prepared operation locator.')
      args = { operationId }
    }
    if (name !== undefined) {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(`service-${this.calls}`), name, arguments: JSON.stringify(args) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    const answer = !resume && this.calls === 3
      ? 'The finite result is conditional. Its parent use still needs assessment.'
      : 'The finite result remains conditional, and its identified parent use was explicitly repaired. The sibling question remains unassessed.'
    yield { type: 'block-end', index: 0, block: { type: 'text', text: answer } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

export const name = 'research-service-model'
export const inject = ['llm']
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['research-service-model'], new Model())
}
