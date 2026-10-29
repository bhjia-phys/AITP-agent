/** Real material service composition, source refresh and native Session tool authority. */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter, ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import SandboxPolicy, { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import ResearchResources, { sourceIdForPath, sourceRootId } from '@deepseek-ai/dsh-research-resources'
import { afterEach, expect, it, vi } from 'vitest'
import ResearchMemory from '../src/index.ts'
import { MaterialWriter } from '../src/material-writes.ts'
import { ScratchWriter } from '../src/writer.ts'
import { topicIdForPath } from '../src/markdown-files.ts'
import type { Result } from '../src/types.ts'
import type { ResearchOrigin } from '../src/working-types.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const dispose of cleanup.splice(0).reverse()) await dispose() })
const workspaceId = 'material-service-workspace' as WorkspaceId
const topicId = topicIdForPath('a/b/c/research.md')
const origin = { workspaceId, topicId }
const signal = (): AbortSignal => new AbortController().signal
function value<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value }
function text(result: ToolExecutionResult): string { return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n') }
function human(selected: ResearchOrigin = origin) {
  return createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: selected },
    content: [{ type: 'text', text: 'Preserve the finite-size condition while saving this material.' }] })
}
const save = { operationId: 'saved-note', relativePath: 'a/b/c/notes/condition.md', text: '# Conditional explanation\n\nOnly for finite N.\n',
  association: { accountPath: 'a/b/c/research.md', title: 'Finite-size explanation', description: 'Records the finite N premise; the limit remains open.' } }

class MaterialAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  override async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    const index = this.requests.length
    if (index <= 2) {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(`material-${index}`),
        name: index === 1 ? 'research_material_location' : 'research_save_material', arguments: JSON.stringify(index === 1 ? {} : save) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
    } else {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'The note and its link were saved; the scientific limit remains open.' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
}

async function fixture(options: {
  writable?: boolean
  policy?: boolean
  mode?: 'read-only' | 'workspace-write' | 'danger-full-access'
  resultLimit?: number
  outsideSession?: boolean
  selectedOrigin?: ResearchOrigin | null
} = {}) {
  const temporary = await mkdtemp(join(tmpdir(), 'material-service-'))
  cleanup.push(() => rm(temporary, { recursive: true, force: true }))
  const root = join(temporary, 'project')
  const library = join(temporary, 'originals')
  await mkdir(join(root, 'a/b/c'), { recursive: true })
  await mkdir(library)
  for (const [path, body] of [
    ['research.md', '# Project\n\n## Topics\n[A](a/research.md)\n'],
    ['a/research.md', '# A\n\n## Subtopics\n[B](b/research.md)\n'],
    ['a/b/research.md', '# B\n\n## Subtopics\n[C](c/research.md)\n'],
    ['a/b/c/research.md', '# C\n\n## Current work\nPreserve the original failed-route condition.\n'],
  ] as const) await writeFile(join(root, path), body)
  const pdf = await readFile(new URL('../../research-literature/tests/fixtures/two-pages.pdf', import.meta.url))
  await writeFile(join(library, 'selected.pdf'), pdf)
  await writeFile(join(library, 'not-pdf.md'), '# Original note\n')
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(TypertRegistry)
  if (options.policy !== false) await ctx.plugin(SandboxPolicy, { mode: options.mode ?? 'danger-full-access', workspaceRoot: root })
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(ResearchResources, { roots: [{ id: 'selected-originals', path: library }], watchSources: false })
  const memoryPlugin = await ctx.plugin(ResearchMemory, { roots: [{ id: workspaceId, path: root,
    writable: options.writable ?? true, stateDirectory: join(temporary, 'operations') }],
  watchSources: false, maxResultCharacters: options.resultLimit ?? 4000 })
  await ctx.fiber.await()
  const service = ctx.researchMaterialFiles
  expect(service).toBeDefined()
  const adapter = new MaterialAdapter()
  ctx.llm.registerAdapter(['material-model'], adapter)
  const agent = await ctx.agentLoop.create(SessionId('material-agent'), { provider: 'material-model', model: 'material-model' },
    { cwd: options.outsideSession ? library : root })
  if (options.selectedOrigin !== null) agent.session.append('user/message', human(options.selectedOrigin ?? origin), { surfaceOp: 'append' })
  let calls = 0
  const call = (name: string, args: unknown, target: Agent = agent) => ctx.tools.execute({ name, arguments: args,
    agent: target, callId: ToolCallId(`direct-material-${++calls}`), signal: signal() })
  return { temporary, root, library, pdf, ctx, service, agent, adapter, call, dispose: () => memoryPlugin.dispose() }
}

it('loads the real service, resolves a deep account, saves and refreshes the same shared source identity', async () => {
  const f = await fixture()
  expect(value(await f.service.getLocation({ workspaceId, topicId }, signal()))).toMatchObject({
    accountPath: 'a/b/c/research.md', directory: 'a/b/c', rootPath: f.root, writable: true,
  })
  const refresh = vi.spyOn(f.ctx.researchResources, 'refresh')
  const saved = value(await f.service.saveText({ workspaceId, ...save }, signal()))
  expect(saved).toMatchObject({ file: { state: 'saved', readBack: { state: 'matches' } }, association: { state: 'linked' } })
  expect(refresh).toHaveBeenCalled()
  const ref = { rootId: sourceRootId(`workspace:${workspaceId}`), sourceId: sourceIdForPath(save.relativePath) }
  const reading = await f.ctx.researchResources.readResource({ ref }, signal())
  expect(reading).toMatchObject({ ok: true, value: { body: { kind: 'text', text: save.text } } })
  const topic = value(await f.ctx.researchMemory.getTopic({ workspaceId, topicId }, signal())).value
  expect(topic.resources.map(item => item.id)).toContain(saved.resourceId)
  expect(await readFile(join(f.root, 'a/b/c/research.md'), 'utf8')).toContain('original failed-route condition')
})

it('imports original PDF bytes through an admitted source grant and preserves source and destination identities', async () => {
  const f = await fixture()
  const source = { rootId: sourceRootId('selected-originals'), sourceId: sourceIdForPath('selected.pdf') }
  const result = value(await f.service.importPdf({ workspaceId, operationId: 'import-selected', relativePath: 'a/b/c/papers/selected.pdf', source,
    association: { accountPath: 'a/b/c/research.md', title: 'Original reference', description: 'Background reading only.' } }, signal()))
  expect(result).toMatchObject({ mediaType: 'application/pdf', file: { state: 'saved', readBack: { state: 'matches' } }, association: { state: 'linked' } })
  expect(await readFile(join(f.library, 'selected.pdf'))).toEqual(f.pdf)
  const copy = await f.ctx.researchResources.readSourceBytes({ ref: { rootId: sourceRootId(`workspace:${workspaceId}`), sourceId: sourceIdForPath(result.relativePath) } }, signal())
  expect(copy.ok).toBe(true)
  if (copy.ok) expect(Buffer.from(copy.value.data)).toEqual(f.pdf)
  expect(await f.service.importPdf({ workspaceId, operationId: 'unadmitted', relativePath: 'denied.pdf', source: { ...source, rootId: sourceRootId('unadmitted') } }, signal()))
    .toMatchObject({ ok: false })
  expect(await f.service.importPdf({ workspaceId, operationId: 'not-pdf', relativePath: 'denied.pdf', source: { ...source, sourceId: sourceIdForPath('not-pdf.md') } }, signal()))
    .toMatchObject({ ok: false })
  expect(await readdir(f.root)).toEqual(['a', 'research.md'])
})

it('does not promote a source read registration or full Session file policy into a target write grant', async () => {
  const f = await fixture({ writable: false })
  expect(value(await f.service.getLocation({ workspaceId, topicId }, signal())).writable).toBe(false)
  expect(await f.service.saveText({ workspaceId, ...save }, signal())).toMatchObject({ ok: false, error: { code: 'read-only' } })
  expect(text(await f.call('research_save_material', save))).toContain('no longer permits writing')
  expect(await readdir(join(f.root, 'a/b/c'))).toEqual(['research.md'])
})

it('routes the PDF tool through authorized source bytes and checks write policy before reading the selected source', async () => {
  const f = await fixture()
  const read = vi.spyOn(f.ctx.researchResources, 'readSourceBytes')
  const input = { operationId: 'tool-pdf', relativePath: 'a/b/c/papers/imported.pdf',
    source: { rootId: sourceRootId('selected-originals'), sourceId: sourceIdForPath('selected.pdf') } }
  const result = await f.call('research_import_pdf', input)
  expect(result.isError).not.toBe(true)
  expect(JSON.parse(text(result))).toMatchObject({ file: { state: 'saved', readBack: { state: 'matches' } }, association: { state: 'not-requested' } })
  expect(read).toHaveBeenCalledTimes(1)
  expect(await readFile(join(f.root, input.relativePath))).toEqual(f.pdf)
  setSandboxMode(f.agent.session, 'read-only')
  expect(text(await f.call('research_import_pdf', { ...input, operationId: 'denied-pdf', relativePath: 'denied.pdf' }))).toContain('read-only')
  expect(read).toHaveBeenCalledTimes(1)
})

it('rejects non-owner Remote callers and pre-aborted publication without creating files', async () => {
  const f = await fixture()
  const caller = f.ctx.extend({ invocation: { peer: { principal: { kind: 'external-material-test' } } } })
  await expect(caller.researchMaterialFiles.getLocation({ workspaceId }, signal())).rejects.toThrow('workspace owner')
  await expect(caller.researchMaterialFiles.saveText({ workspaceId, ...save }, signal())).rejects.toThrow('workspace owner')
  await expect(caller.researchMaterialFiles.publishForAgent({ workspaceId, ...save, kind: 'text' }, async () => {}, signal()))
    .rejects.toThrow('workspace owner')
  const stopped = new AbortController()
  stopped.abort()
  await expect(f.service.saveText({ workspaceId, ...save }, stopped.signal)).rejects.toThrow()
  expect(await readdir(join(f.root, 'a/b/c'))).toEqual(['research.md'])
})

it('records material locations and separate save/link/read-back outcomes in native model history', async () => {
  const f = await fixture({ selectedOrigin: null })
  f.agent.followup(human())
  await f.agent.whenIdle()
  expect(f.adapter.requests).toHaveLength(3)
  const results = f.agent.session.snapshotEvents().filter(event => event.type === 'tool/result')
  expect(results).toHaveLength(2)
  expect(JSON.stringify(f.adapter.requests[1]?.messages)).toContain('a/b/c/research.md')
  expect(JSON.stringify(f.adapter.requests[2]?.messages)).toContain('saved-note')
  const savedText = results[1]?.data.message.content.filter(item => item.type === 'text').map(item => item.text).join('\n')
  expect(savedText?.replace(/"observedAt":"[^"]+"/, '"observedAt":"<time>"')).toMatchInlineSnapshot(`
    "{"operationId":"saved-note","relativePath":"a/b/c/notes/condition.md","resourceId":"resource:a%2Fb%2Fc%2Fnotes%2Fcondition.md","mediaType":"text/plain","byteLength":46,"file":{"state":"saved","readBack":{"state":"matches","byteLength":46,"observedAt":"<time>"}},"association":{"state":"linked","accountPath":"a/b/c/research.md"},"retry":"none","issues":[]}"
  `)
  const parameters = f.adapter.requests[0]?.tools?.find(tool => tool.name === 'research_save_material')?.parameters
  expect(JSON.stringify(parameters)).not.toContain('workspaceId')
  expect(JSON.stringify(parameters)).not.toContain('writable')
  expect(await readFile(join(f.root, save.relativePath), 'utf8')).toBe(save.text)
})

it.each(['read-only', 'outside', 'missing-policy'] as const)('enforces the actual Session file boundary: %s', async (condition) => {
  const f = await fixture({ mode: condition === 'outside' ? 'workspace-write' : 'read-only',
    outsideSession: condition === 'outside', policy: condition !== 'missing-policy' })
  expect((await f.call('research_material_location', {})).isError).not.toBe(true)
  const result = await f.call('research_save_material', save)
  expect(result.isError).toBe(true)
  expect(text(result)).toContain(condition === 'outside' ? 'workspace-write boundary' : condition === 'missing-policy' ? 'file policy is unavailable' : 'read-only')
  expect(await readdir(join(f.root, 'a/b/c'))).toEqual(['research.md'])
})

it('allows a workspace-contained material write and refuses global, missing and non-owner research scope', async () => {
  const allowed = await fixture({ mode: 'workspace-write' })
  expect((await allowed.call('research_save_material', save)).isError).not.toBe(true)
  const global = await fixture({ selectedOrigin: { scope: 'global', studyId: 'shared-reading' } })
  expect(text(await global.call('research_save_material', save))).toContain('Choose the intended research workspace')
  const absent = await fixture({ selectedOrigin: null })
  expect((await absent.call('research_save_material', save)).isError).toBe(true)
  const restricted = await fixture()
  restricted.agent.session.append('user/message', createUserMessage({
    source: { kind: 'user', principal: { kind: 'guest' } } as never,
    content: [{ type: 'text', text: 'External participant' }],
  }), { surfaceOp: 'append' })
  expect(text(await restricted.call('research_save_material', save))).toContain('restricted and delegated')
})

it('does not elevate a delegated Session even when its inherited input names the owner workspace', async () => {
  const f = await fixture()
  const child = await f.ctx.agentLoop.createAgent(f.ctx, { sessionId: SessionId('material-subagent'), parentAgent: f.agent,
    meta: { cwd: f.root, parentSession: f.agent.session.id, origin: 'subagent' }, agentOptions: { provider: 'material-model', model: 'material-model' } })
  child.agent.session.append('user/message', human(), { surfaceOp: 'append' })
  expect(text(await f.call('research_save_material', save, child.agent))).toContain('restricted and delegated')
  expect(await readdir(join(f.root, 'a/b/c'))).toEqual(['research.md'])
})

it.each(['policy', 'topic', 'restricted'] as const)('rechecks %s after the material write waits in the shared source queue', async (changed) => {
  const f = await fixture()
  let release: () => void = () => {}
  let entered: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  // oxlint-disable-next-line typescript/unbound-method -- The wrapper restores the production receiver.
  const serialize = ScratchWriter.prototype.serializeSources
  vi.spyOn(ScratchWriter.prototype, 'serializeSources').mockImplementationOnce(async function (this: ScratchWriter, action) {
    entered(); await gate; return serialize.call(this, action)
  })
  const writing = f.call('research_save_material', save)
  await started
  if (changed === 'policy') setSandboxMode(f.agent.session, 'read-only')
  else if (changed === 'topic') f.agent.session.append('user/message', human({ workspaceId, topicId: topicIdForPath('a/research.md') }), { surfaceOp: 'append' })
  else f.agent.session.append('user/message', createUserMessage({ source: { kind: 'user', principal: { kind: 'guest' } } as never,
    content: [{ type: 'text', text: 'External participant' }] }), { surfaceOp: 'append' })
  release()
  expect(text(await writing)).toContain(changed === 'policy' ? 'read-only' : changed === 'topic' ? 'destination changed' : 'restricted and delegated')
  expect(await readdir(join(f.root, 'a/b/c'))).toEqual(['research.md'])
})

it('honors cancellation while waiting for source serialization without publishing a material', async () => {
  const f = await fixture()
  let release: () => void = () => {}
  let entered: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  // oxlint-disable-next-line typescript/unbound-method -- The wrapper restores the production receiver.
  const serialize = ScratchWriter.prototype.serializeSources
  vi.spyOn(ScratchWriter.prototype, 'serializeSources').mockImplementationOnce(async function (this: ScratchWriter, action) {
    entered(); await gate; return serialize.call(this, action)
  })
  const cancelled = new AbortController()
  const writing = f.service.saveText({ workspaceId, ...save }, cancelled.signal)
  const rejected = expect(writing).rejects.toThrow()
  await started
  cancelled.abort()
  release()
  await rejected
  expect(await readdir(join(f.root, 'a/b/c'))).toEqual(['research.md'])
})

it('bounds complete tool results and refuses an unreportable destination before material publication', async () => {
  const f = await fixture({ resultLimit: 1024 })
  const result = await f.call('research_save_material', save)
  expect(result.isError).not.toBe(true)
  expect(JSON.stringify({ text: text(result) }).length).toBeLessThanOrEqual(1024)
  const oversized = { ...save, operationId: 'too-long', relativePath: `${'资料'.repeat(80)}/new.md` }
  const writer = vi.spyOn(MaterialWriter.prototype, 'save')
  expect(text(await f.call('research_save_material', oversized))).toContain('output bound')
  expect(writer).not.toHaveBeenCalled()
})

it('drains an admitted material save and removes service tools on unload without losing the saved outcome', async () => {
  const f = await fixture()
  let release: () => void = () => {}
  let entered: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  // oxlint-disable-next-line typescript/unbound-method -- The wrapper restores the production receiver.
  const saveMaterial = MaterialWriter.prototype.save
  vi.spyOn(MaterialWriter.prototype, 'save').mockImplementationOnce(async function (this: MaterialWriter, request) {
    entered(); await gate; return saveMaterial.call(this, request)
  })
  const writing = f.service.saveText({ workspaceId, ...save }, signal())
  await started
  let disposed = false
  const disposing = f.dispose().then(() => { disposed = true })
  await Promise.resolve()
  expect(disposed).toBe(false)
  release()
  expect(value(await writing)).toMatchObject({ file: { state: 'saved' } })
  await disposing
  expect(f.ctx.tools.get('research_save_material')).toBeUndefined()
  expect(f.ctx.tools.get('research_import_pdf')).toBeUndefined()
  expect(await f.service.saveText({ workspaceId, ...save, operationId: 'after-unload' }, signal())).toMatchObject({ ok: false, error: { code: 'unavailable' } })
})
