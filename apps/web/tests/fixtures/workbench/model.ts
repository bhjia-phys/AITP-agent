/** Deterministic external model transport; native Session, tools, source readers and writes remain real. */
import { createServer, type ServerResponse } from 'node:http'

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textOf).join('\n')
  if (value !== null && typeof value === 'object') return Object.values(value).map(textOf).join('\n')
  return ''
}

interface WritePlan {
  readonly resourceId: string
  readonly before: string
  readonly after: string
  stage: number
  operationId?: string
}

/** Script only the provider response; every browser question and tool outcome comes from the real app. */
export class WorkbenchModel {
  readonly requests: string[] = []
  readonly answers: string[] = []
  readonly failures: string[] = []
  private hold: { received: () => void; wait: Promise<void> } | undefined
  private readonly releases = new Set<() => void>()
  private write: WritePlan | undefined
  private readonly server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    request.once('end', () => { void this.reply(Buffer.concat(chunks).toString(), response).catch((error: unknown) => {
      this.failures.push(String(error))
      if (!response.headersSent) response.writeHead(500)
      response.end(String(error))
    }) })
  })

  /** @returns the actual Anthropic-compatible endpoint for the production provider adapter. */
  async start(): Promise<string> {
    await new Promise<void>((resolve, reject) => { this.server.once('error', reject); this.server.listen(0, '127.0.0.1', resolve) })
    const address = this.server.address()
    if (address === null || typeof address === 'string') throw new Error('The workbench model did not bind a TCP port.')
    return `http://127.0.0.1:${address.port}`
  }

  /** @returns control over one in-flight native request, with no timer-based assumption about admission. */
  holdNext(): { readonly received: Promise<void>; readonly release: () => void } {
    if (this.hold !== undefined) throw new Error('A held model request is already pending.')
    const received = Promise.withResolvers<undefined>()
    const waiting = Promise.withResolvers<undefined>()
    const release = (): void => { waiting.resolve(undefined); this.releases.delete(release) }
    this.releases.add(release)
    this.hold = { received: () => { received.resolve(undefined) }, wait: waiting.promise }
    return { received: received.promise, release }
  }

  /**
   * Require actual prepare/apply tool receipts before replying that a synthetic scope was saved.
   * @param resourceId - Exact research locator in the temporary fixture.
   * @param before - Unique old source passage.
   * @param after - Explicitly requested replacement.
   */
  writeNext(resourceId: string, before: string, after: string): void {
    if (this.write !== undefined) throw new Error('A source-write scenario is already running.')
    this.write = { resourceId, before, after, stage: 0 }
  }

  private async reply(raw: string, response: ServerResponse): Promise<void> {
    this.requests.push(raw)
    const number = this.requests.length
    const text = textOf(JSON.parse(raw))
    const hold = this.hold
    this.hold = undefined
    hold?.received()
    await hold?.wait
    const write = this.write
    if (write?.stage === 0) {
      write.stage = 1
      this.stream(response, number, { type: 'tool_use', id: 'workbench-prepare', name: 'research_prepare_change', input: {
        disposition: 'edit', rationale: 'The human explicitly requested this synthetic scope correction.',
        edits: [{ resourceId: write.resourceId, originalText: write.before, replacementText: write.after,
          rationale: 'Keep the stated synthetic finite-system boundary.', sourceRefs: ['fixture:explicit-human-scope'] }],
        remainingUses: [],
      } })
      return
    }
    if (write?.stage === 1) {
      const id = /Operation ([0-9a-f-]+): prepared/u.exec(text)?.[1]
      if (id === undefined) throw new Error('The actual prepare tool returned no prepared operation; refusing a fictitious save.')
      write.operationId = id
      write.stage = 2
      this.stream(response, number, { type: 'tool_use', id: 'workbench-apply', name: 'research_apply_change', input: { operationId: id } })
      return
    }
    if (write?.stage === 2) {
      if (!text.includes(`Operation ${write.operationId}: applied`)) throw new Error('The actual apply receipt did not confirm saved files.')
      this.write = undefined
      const answer = 'WORKBENCH_CONFIRMED_SAVE: the synthetic source edit was confirmed; the parent scientific question remains open.'
      this.answers.push(answer)
      this.stream(response, number, { type: 'text', text: answer })
      return
    }
    const addresses = [...text.matchAll(/dsh-resource:\/\/aitp-material-source\/[^\s\]<>"`]+/gu)].map(item => item[0])
    const citation = addresses.find(address => address.includes('source%3Acondition.md')) ?? addresses[0]
    const answer = `Workbench reply ${number}. The stated conditions remain in force.`
      + (citation === undefined ? '' : ` [Source passage](${citation}).`)
    this.answers.push(answer)
    this.stream(response, number, { type: 'text', text: answer })
  }

  private stream(response: ServerResponse, number: number, block:
    { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: object }): void {
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    const events: unknown[] = [
      { type: 'message_start', message: { id: `workbench-${number}`, model: 'fixture', usage: { input_tokens: 30, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: block.type === 'text' ? block : { ...block, input: {} } },
      ...(block.type === 'text' ? [] : [{ type: 'content_block_delta', index: 0,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } }]),
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: block.type === 'text' ? 'end_turn' : 'tool_use' }, usage: { output_tokens: 20 } },
      { type: 'message_stop' },
    ]
    response.end(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''))
  }

  /** @returns after all held calls and owned fixture sockets have been released. */
  close(): Promise<void> {
    for (const release of this.releases) release()
    if (!this.server.listening) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.server.close((error) => { if (error) reject(error); else resolve() })
      this.server.closeAllConnections()
    })
  }
}
