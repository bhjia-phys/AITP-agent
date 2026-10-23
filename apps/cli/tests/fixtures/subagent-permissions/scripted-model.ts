/** Deterministic requests for real child filesystem and permission execution. */
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'

function* call(id: string, name: string, args: Record<string, unknown>, index = 0): Generator<StreamChunk> {
  const argumentsJson = JSON.stringify(args)
  yield { type: 'block-start', index, blockType: 'tool-call' }
  yield { type: 'tool-call-delta', index, id: ToolCallId(id), name, argumentsDelta: argumentsJson }
  yield { type: 'block-end', index, block: { type: 'tool-call', id: ToolCallId(id), name, arguments: argumentsJson } }
}

function* text(value: string): Generator<StreamChunk> {
  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'text-delta', index: 0, text: value }
  yield { type: 'block-end', index: 0, block: { type: 'text', text: value } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}

class PermissionFixtureModel extends LlmAdapter {
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const results = options.messages.filter(message => message.role === 'tool')
    const userText = options.messages.filter(message => message.role === 'user')
      .flatMap(message => message.content.filter(block => block.type === 'text').map(block => block.text)).join('\n')
    const childLabel = /Child permission probe: (spawn|fork)/.exec(userText)?.[1]
    if (childLabel === undefined) {
      if (!userText.includes('Delegate the permission probes.') || results.length > 0) {
        yield* text('Parent turn complete.')
        return
      }
      yield* call('spawn-probe', 'subagent', { description: 'spawn permission probe', prompt: 'Child permission probe: spawn' })
      yield* call('fork-probe', 'subagent_fork', { description: 'fork permission probe', prompt: 'Child permission probe: fork' }, 1)
    } else {
      const label = childLabel
      const file = `${label}.md`
      switch (results.length) {
        case 0:
          yield* call(`${label}-write`, 'write', { file_path: file, content: 'initial\n', sandbox_permissions: 'workspace-write' })
          break
        case 1:
          yield* call(`${label}-edit`, 'edit', {
            file_path: file, old_string: 'initial', new_string: 'edited', sandbox_permissions: 'workspace-write', justification: '',
          })
          break
        case 2:
          yield* call(`${label}-widen`, 'write', {
            file_path: `${label}-widen.md`, content: 'must not be written',
            sandbox_permissions: 'danger-full-access', justification: 'Exercise an actual request for broader permissions.',
          })
          break
        case 3:
          yield* call(`${label}-unpaired`, 'write', {
            file_path: `${label}-unpaired.md`, content: 'must not be written', sandbox_permissions: 'danger-full-access',
          })
          break
        default:
          yield* text(`${label} child finished.`)
          return
      }
    }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  }
}

export const name = 'permission-fixture-model'
export const inject = ['llm']

/**
 * Register the scripted model while retaining all shipped tool providers.
 * @param ctx - Loader plugin context.
 */
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['permission-fixture'], new PermissionFixtureModel())
}
