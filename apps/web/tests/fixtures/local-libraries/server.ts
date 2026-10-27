/** Restart the actual CLI Web profile and substitute only its external model endpoint. */
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { materialSourceAddress, parseMaterialSource } from '@deepseek-ai/dsh-research-resources/protocol'
import type { SourceId } from '@deepseek-ai/dsh-research-resources/types'
import { REPO_ROOT } from '../../support.ts'

function strings(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(strings).join('\n')
  if (value !== null && typeof value === 'object') return Object.values(value).map(strings).join('\n')
  return ''
}

/** Existing adapter receives deterministic text with source URLs derived from its actual request. */
export class LibraryModel {
  readonly requests: string[] = []
  readonly answers: string[] = []
  private readonly server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    request.once('end', () => {
      const raw = Buffer.concat(chunks).toString()
      this.requests.push(raw)
      const text = strings(JSON.parse(raw))
      const addresses = [...text.matchAll(/dsh-resource:\/\/aitp-material-source\/[^\s\]<>"`]+/gu)].map(item => item[0])
      const cited = addresses.find(address => address.includes('pdf-page')) ?? addresses[0]
      const code = addresses.find(address => address.includes('source%3Amodel.py'))
      const reference = code === undefined ? undefined : parseMaterialSource(code)
      const diff = reference === undefined ? undefined : materialSourceAddress({ rootId: reference.ref.rootId,
        sourceId: 'git:checkout' as SourceId }, { kind: 'git', view: 'diff', scope: 'working-tree' })
      const answer = cited === undefined ? 'No located source passage was delivered; reopen the source before drawing a conclusion.'
        : `The selected source states: Only under A. [Source passage](${cited}). Other pages remain unread.`
          + (diff === undefined ? '' : ` [Inspect the current checkout diff](${diff}).`)
      this.answers.push(answer)
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      const events = [
        { type: 'message_start', message: { id: `local-libraries-${this.answers.length}`, model: 'fixture', usage: { input_tokens: 20, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: answer } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 15 } },
        { type: 'message_stop' },
      ]
      response.end(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''))
    })
  })

  /** @returns the isolated Anthropic-compatible endpoint used by the real provider. */
  async start(): Promise<string> {
    await new Promise<void>((resolve, reject) => { this.server.once('error', reject); this.server.listen(0, '127.0.0.1', resolve) })
    const address = this.server.address()
    if (address === null || typeof address === 'string') throw new Error('The model fixture did not bind a TCP port.')
    return `http://127.0.0.1:${address.port}`
  }

  /** @returns after fixture sockets are closed. */
  close(): Promise<void> {
    if (!this.server.listening) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.server.close((error) => { if (error) reject(error); else resolve() })
      this.server.closeAllConnections()
    })
  }
}

/** Real production CLI profile with one durable fixture home across process restarts. */
export class LibraryApp {
  private child: ChildProcess | undefined
  private closed: Promise<void> | undefined
  private output = ''
  private cookie = ''
  private url = ''

  /** @param world - private fixture root. @param modelUrl - local deterministic external provider. */
  constructor(private readonly world: string, private readonly modelUrl: string) {}

  /** @param port - zero for the first start or the same bound port for recovery. @returns an owner-authenticated URL. */
  async start(port = 0): Promise<string> {
    if (this.child !== undefined) throw new Error('The library app is already running.')
    this.output = ''
    const ready = Promise.withResolvers<string>()
    const patches = [
      join(REPO_ROOT, 'apps/cli/config/aitp-agent.cordis.patch.yml'),
      join(REPO_ROOT, 'apps/cli/config/aitp-web.cordis.patch.yml'),
      join(REPO_ROOT, 'apps/web/tests/pin-browse-picker.overlay.yml'),
      fileURLToPath(new URL('./cordis.patch.yml', import.meta.url)),
    ]
    const child = spawn(process.execPath, [join(REPO_ROOT, 'apps/cli/lib/bin.js'), '--profile', 'web',
      ...patches.flatMap(path => ['--patch', path]), '--no-open', '--port', String(port)], {
      cwd: this.world, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '', DSH_HOME: join(this.world, 'home'), DSH_AGENTS_HOME: join(this.world, 'agents'),
        DSH_LOCAL_LIBRARIES_WORLD: this.world, DSH_TELEMETRY_DISABLED: '1',
        DEEPSEEK_API_KEY: 'keyless-local-library-fixture', DEEPSEEK_BASE_URL: this.modelUrl },
    })
    this.child = child
    const output = (chunk: Buffer): void => {
      this.output += chunk.toString()
      const url = /dsh web: (http:\/\/[^\s]+)/u.exec(this.output)?.[1]
      if (url !== undefined) ready.resolve(url)
    }
    child.stdout?.on('data', output); child.stderr?.on('data', output)
    child.once('error', (error) => { ready.reject(error) })
    this.closed = new Promise((resolve) => {
      child.once('close', (code, signal) => {
        ready.reject(new Error(`The library app exited before readiness (${code}, ${signal}).\n${this.logs()}`))
        resolve()
      })
    })
    const timer = setTimeout(() => { ready.reject(new Error(`The library app did not start.\n${this.logs()}`)) }, 40_000)
    try {
      this.url = await ready.promise
      const login = await fetch(this.url, { redirect: 'manual' })
      this.cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
      if (!this.cookie) throw new Error('The actual app did not issue its owner authentication cookie.')
      return this.url
    } finally { clearTimeout(timer) }
  }

  /** @param endpoint - real Remote endpoint. @param args - declared Host argument names. @returns the actual decoded RPC result. */
  async rpc<T>(endpoint: string, args: object): Promise<T> {
    const response = await fetch(new URL(`/api/${endpoint}`, this.url), { method: 'POST',
      headers: { cookie: this.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method: endpoint, payload: { args } }),
    })
    const payload = await response.json() as { result: { ok: boolean; value: T; error?: { message: string } } }
    if (!payload.result.ok) throw new Error(`${endpoint}: ${payload.result.error?.message ?? JSON.stringify(payload)}`)
    return payload.result.value
  }

  /** @returns logs with owner URL tokens removed. */
  logs(): string { return this.output.replace(/([?&]token=)[A-Za-z0-9_-]+/gu, '$1<redacted>') }

  /** @returns after the real process has drained and exited. */
  async stop(): Promise<void> {
    const child = this.child
    if (child === undefined) return
    let forced = false
    const timer = setTimeout(() => { forced = true; child.kill('SIGKILL') }, 15_000)
    try { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); await this.closed }
    finally { clearTimeout(timer); this.child = undefined }
    if (forced) throw new Error(`The actual library app did not drain before shutdown.\n${this.logs()}`)
  }
}
