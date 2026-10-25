/** Deterministic external-model substitute retaining exact request envelopes. */
import type { Context } from '@deepseek-ai/cordis'
import { appendFile } from 'node:fs/promises'
import { LlmAdapter, ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'

class ResearchAdapter extends LlmAdapter {
  private calls = 0
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.calls++
    await appendFile('runtime-requests.jsonl', `${JSON.stringify(options)}\n`)
    const recovering = JSON.stringify(options.messages).includes('resume now')
    if (this.calls === 1 && !recovering) {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: {
        type: 'tool-call', id: ToolCallId('fixture-working'), name: 'research_working_update',
        arguments: JSON.stringify({ operation: 'upsert', id: 'failed-route', kind: 'failed-route', text: 'This route failed for open boundaries.', condition: 'Reopen only after the boundary condition changes.' }),
      } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    const text = 'Short generated summary. Details deliberately omitted.'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 10 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
export const name = 'research-runtime-mock'
export const inject = ['llm']
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['research-runtime-mock'], new ResearchAdapter())
}
