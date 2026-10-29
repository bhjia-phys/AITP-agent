/** Only the external model is substituted; capture the actual AgentLoop request. */
import { appendFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'

class Model extends LlmAdapter {
  override async * stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    await appendFile('composition-requests.jsonl', `${JSON.stringify(request)}\n`)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Keep the finite-size boundary explicit.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

export const name = 'aitp-composition-model'
export const inject = ['llm']
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['aitp-composition-model'], new Model())
}
