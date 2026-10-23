import { afterEach, describe, expect, it } from 'vitest'
import type { AssistantMessageEvent, Model } from '@earendil-works/pi-ai'
import { stream as streamAnthropic } from '@earendil-works/pi-ai/api/anthropic-messages'
import { stream as streamCompletions } from '@earendil-works/pi-ai/api/openai-completions'
import { stream as streamResponses } from '@earendil-works/pi-ai/api/openai-responses'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import { toStreamChunks } from '../src/stream.ts'
import { normalizeContext } from '@earendil-works/pi-ai/utils/transcript'
import { anthropicFrame as frame, anthropicMessageStart, closeMockServers, mockServer } from './mock-server.ts'

afterEach(closeMockServers)

/** A write call whose arguments arrive in many small deltas. */
const args = { file_path: 'notes.md', content: 'x'.repeat(2048) }
const argsJson = JSON.stringify(args)
const fragments = argsJson.match(/.{1,7}/gs) ?? []

function model<A extends 'anthropic-messages' | 'openai-completions' | 'openai-responses'>(api: A, baseUrl: string): Model<A> {
  return {
    id: 'm', name: 'm', api, provider: 'test', baseUrl, reasoning: false, input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 8192, maxTokens: 1024,
  }
}

/** The arguments each `toolcall_delta` partial carries, and the finalized arguments. */
async function collect(events: AsyncIterable<AssistantMessageEvent>): Promise<{ partials: unknown[]; final: unknown }> {
  const partials: unknown[] = []
  let final: unknown
  for await (const event of events) {
    if (event.type === 'toolcall_delta' && event.delta.length > 0) {
      const block = event.partial.content[event.contentIndex]
      partials.push(block?.type === 'toolCall' ? block.arguments : undefined)
    } else if (event.type === 'toolcall_end') {
      final = event.toolCall.arguments
    } else if (event.type === 'error') {
      throw new Error(event.error.errorMessage)
    }
  }
  return { partials, final }
}

const context = normalizeContext({ messages: [{ role: 'user', content: 'hi', timestamp: 0 }] })

type OpenAiApi = 'openai-completions' | 'openai-responses'

/** Interleave separate tool calls at the provider wire, including escaped Unicode. */
function openAiFrames(api: OpenAiApi, values: typeof args[], terminal: 'complete' | 'length' | 'missing'): string[] {
  const json = values.map(value => JSON.stringify(value))
  const pieces = json.map(value => value.match(/.{1,17}/gs) ?? [])
  const items = values.map((_, index) => ({
    type: 'function_call', call_id: `call_${index}`, id: `item_${index}`, name: 'write', arguments: '',
  }))
  const events = api === 'openai-responses'
    ? [JSON.stringify({ type: 'response.created', response: { id: 'response_stress' } }),
      ...items.map((item, output_index) => JSON.stringify({ type: 'response.output_item.added', output_index, item }))]
    : [JSON.stringify({ choices: [{ index: 0, finish_reason: null, delta: {
      role: 'assistant', tool_calls: items.map((item, index) => ({
        index, id: item.call_id, type: 'function', function: { name: item.name, arguments: '' },
      })),
    } }] })]
  for (let part = 0; part < Math.max(...pieces.map(value => value.length)); part++) {
    for (let index = 0; index < pieces.length; index++) {
      const delta = pieces[index]?.[part]
      if (delta === undefined) continue
      events.push(api === 'openai-responses'
        ? JSON.stringify({ type: 'response.function_call_arguments.delta', output_index: index, delta })
        : JSON.stringify({ choices: [{ index: 0, finish_reason: null, delta: {
          tool_calls: [{ index, function: { arguments: delta } }],
        } }] }))
    }
  }
  if (terminal === 'missing') return events
  if (api === 'openai-completions') {
    events.push(JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: terminal === 'length' ? 'length' : 'tool_calls' }] }), '[DONE]')
  } else {
    for (let index = 0; index < items.length; index++) {
      events.push(JSON.stringify({ type: 'response.output_item.done', output_index: index, item: { ...items[index], arguments: json[index] } }))
    }
    events.push(JSON.stringify({ type: terminal === 'length' ? 'response.incomplete' : 'response.completed', response: {
      id: 'response_stress', status: terminal === 'length' ? 'incomplete' : 'completed', output: [],
      ...(terminal === 'length' ? { incomplete_details: { reason: 'max_output_tokens' } } : {}),
      usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
    } }))
  }
  return events
}

function openAiStream(api: OpenAiApi, url: string, signal?: AbortSignal): AsyncIterable<AssistantMessageEvent> {
  const options = { apiKey: 'test-key', ...(signal === undefined ? {} : { signal }) }
  return api === 'openai-responses'
    ? streamResponses(model(api, url), context, options)
    : streamCompletions(model(api, url), context, options)
}

describe('streamed tool-call arguments (patched pi-ai)', () => {
  describe.each<OpenAiApi>(['openai-completions', 'openai-responses'])('%s bounded stress and interruption', (api) => {
    const largeValues = [0, 1].map(index => ({ file_path: `notes-${index}.md`, content: `${index}:物理\\\"\n`.repeat(8192) }))

    it('keeps interleaved large arguments separate and unparsed until finalization', async () => {
      const server = await mockServer([{ events: openAiFrames(api, largeValues, 'complete') }])
      const assembler = new BlockAssembler()
      let deltas = 0
      async function* observed(): AsyncIterable<AssistantMessageEvent> {
        for await (const event of openAiStream(api, server.url)) {
          if (event.type === 'toolcall_delta' && event.delta.length > 0) {
            deltas++
            const block = event.partial.content[event.contentIndex]
            expect(block?.type === 'toolCall' ? block.arguments : undefined).toEqual({})
          }
          yield event
        }
      }
      for await (const chunk of toStreamChunks(observed())) assembler.push(chunk)
      expect(deltas).toBeGreaterThan(8000)
      expect(assembler.finish).toEqual({ kind: 'tool-calls' })
      expect(assembler.blocks()).toEqual(largeValues.map((value, index) => ({
        type: 'tool-call', id: api === 'openai-responses' ? `call_${index}|item_${index}` : `call_${index}`,
        name: 'write', arguments: JSON.stringify(value),
      })))
      expect(server.requests).toHaveLength(1)
    })

    it('reports a truncated large argument stream as transport failure', async () => {
      const events = openAiFrames(api, largeValues, 'missing')
      const server = await mockServer([{ events: events.slice(0, Math.floor(events.length / 2)) }])
      const assembler = new BlockAssembler()
      for await (const chunk of toStreamChunks(openAiStream(api, server.url))) assembler.push(chunk)
      expect(assembler.finish).toMatchObject({ kind: 'error', failure: { code: 'TRANSPORT' } })
      expect(server.requests).toHaveLength(1)
    })

    it('drops tool calls at the token limit instead of accepting repaired arguments', async () => {
      const server = await mockServer([{ events: openAiFrames(api, largeValues, 'length') }])
      const assembler = new BlockAssembler()
      for await (const chunk of toStreamChunks(openAiStream(api, server.url))) assembler.push(chunk)
      expect(assembler.finish).toEqual({ kind: 'max-tokens' })
      expect(assembler.blocks()).toEqual([])
    })

    it('aborts while arguments are incomplete and closes the response', async () => {
      const controller = new AbortController()
      const server = await mockServer([{ events: openAiFrames(api, largeValues, 'missing').slice(0, 100), holdOpen: true }])
      const assembler = new BlockAssembler()
      let sawDelta = false
      try {
        for await (const chunk of toStreamChunks(openAiStream(api, server.url, controller.signal), undefined, controller.signal)) {
          assembler.push(chunk)
          if (chunk.type === 'tool-call-delta' && chunk.argumentsDelta.length > 0 && !sawDelta) {
            sawDelta = true
            controller.abort()
          }
        }
        await server.responseClosed
        expect(sawDelta).toBe(true)
        expect(assembler.finish).toMatchObject({ kind: 'aborted', failure: { code: 'ABORTED' } })
        expect(server.requests).toHaveLength(1)
        expect(server.closedResponses).toBe(1)
      } finally {
        controller.abort()
      }
    })
  })

  it('preserves an empty Responses message after parallel tool calls with its replay metadata', async () => {
    const calls = [0, 1, 2].map(index => ({ type: 'function_call', call_id: `call_${index}`, id: `item_${index}`, name: 'read', arguments: '{}' }))
    const empty = { type: 'message', id: 'message_empty', role: 'assistant', content: [{ type: 'output_text', text: '', annotations: [] }] }
    const server = await mockServer([{ events: [
      '{"type":"response.created","response":{"id":"response_empty_text"}}',
      ...[...calls, empty].flatMap((item, output_index) => [
        JSON.stringify({ type: 'response.output_item.added', output_index, item }),
        JSON.stringify({ type: 'response.output_item.done', output_index, item }),
      ]),
      JSON.stringify({ type: 'response.completed', response: {
        id: 'response_empty_text', status: 'completed', output: [...calls, empty], usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
      } }),
    ] }])
    const assembler = new BlockAssembler()
    for await (const chunk of toStreamChunks(streamResponses(model('openai-responses', server.url), context, { apiKey: 'test-key' }))) {
      assembler.push(chunk)
    }
    expect(assembler.blocks()).toEqual([
      ...calls.map(call => ({ type: 'tool-call', id: `${call.call_id}|${call.id}`, name: 'read', arguments: '{}' })),
      { type: 'text', text: '' },
    ])
    expect(assembler.replayState?.blocks).toEqual([
      ...calls.map(() => ({ type: 'tool-call' })),
      { type: 'text', textSignature: JSON.stringify({ v: 1, id: 'message_empty' }) },
    ])
    expect(assembler.finish).toEqual({ kind: 'tool-calls' })
    expect(server.requests).toHaveLength(1)
  })

  it('openai-completions parses arguments once, at the end of the call', async () => {
    const server = await mockServer([{ events: [
      JSON.stringify({ choices: [{
        delta: {
          role: 'assistant',
          tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'write', arguments: '' } }],
        },
        index: 0, finish_reason: null,
      }] }),
      ...fragments.map(fragment => JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: fragment } }] }, index: 0, finish_reason: null }],
      })),
      '{"choices":[{"delta":{},"index":0,"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}',
      '[DONE]',
    ] }])
    const events = streamCompletions(model('openai-completions', server.url), context, { apiKey: 'test-key' })
    const { partials, final } = await collect(events)
    expect(partials).toHaveLength(fragments.length)
    expect(partials.every(partial => JSON.stringify(partial) === '{}')).toBe(true)
    expect(final).toEqual(args)
  })

  it('anthropic-messages parses arguments once, at the end of the call', async () => {
    const server = await mockServer([{ events: [
      anthropicMessageStart,
      frame({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'write', input: {} } }),
      ...fragments.map(fragment => frame({
        type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: fragment },
      })),
      frame({ type: 'content_block_stop', index: 0 }),
      frame({ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 5 } }),
      frame({ type: 'message_stop' }),
    ] }])
    const events = streamAnthropic(model('anthropic-messages', server.url), context, { apiKey: 'test-key' })
    const { partials, final } = await collect(events)
    expect(partials).toHaveLength(fragments.length)
    expect(partials.every(partial => JSON.stringify(partial) === '{}')).toBe(true)
    expect(final).toEqual(args)
  })

  it('openai-responses parses arguments once, at the end of the call', async () => {
    const item = { type: 'function_call', call_id: 'call_1', id: 'fc_1', name: 'write' }
    const server = await mockServer([{ events: [
      '{"type":"response.created","response":{"id":"resp_1"}}',
      JSON.stringify({ type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '' } }),
      ...fragments.map(fragment => JSON.stringify({ type: 'response.function_call_arguments.delta', output_index: 0, delta: fragment })),
      JSON.stringify({ type: 'response.function_call_arguments.done', output_index: 0, arguments: argsJson }),
      JSON.stringify({ type: 'response.output_item.done', output_index: 0, item: { ...item, arguments: argsJson } }),
      JSON.stringify({ type: 'response.completed', response: {
        id: 'resp_1', status: 'completed', output: [], usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
      } }),
    ] }])
    const events = streamResponses(model('openai-responses', server.url), context, { apiKey: 'test-key' })
    const { partials, final } = await collect(events)
    expect(partials).toHaveLength(fragments.length)
    expect(partials.every(partial => JSON.stringify(partial) === '{}')).toBe(true)
    expect(final).toEqual(args)
  })
})
