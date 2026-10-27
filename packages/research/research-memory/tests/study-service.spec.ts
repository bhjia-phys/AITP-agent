/** Admission is isolated here; the browser suite covers the real SessionController route. */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter, ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import ResearchResources, { resourceEntryId, sourceIdForPath, sourceRootId } from '@deepseek-ai/dsh-research-resources'
import type { ResourceResult, SourceLocator, SourceSelection, StudyRequest } from '@deepseek-ai/dsh-research-resources/types'
import { materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import ResearchMemory from '../src/index.ts'
import { promptAdmission } from './fixtures/admission.ts'
import ExactSessionQuery from './fixtures/runtime/query-plugin.ts'
import { topicIdForPath } from '../src/markdown.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose() })
const signal = (): AbortSignal => new AbortController().signal
const workspaceId = 'study-project' as WorkspaceId

function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

class Capture extends LlmAdapter {
  requests: GenerateOptions[] = []
  constructor(private readonly readSecond: boolean) { super() }
  override async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    if (this.readSecond && this.requests.length === 1) {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('study-read'),
        name: 'research_read_source', arguments: '{"sourceIndex":2}' } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'The selected evidence retains its stated conditions.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function fixture(readSecond = false) {
  const path = await mkdtemp(join(tmpdir(), 'source-study-'))
  cleanup.push(() => rm(path, { recursive: true, force: true }))
  for (const name of ['project/a', 'project/b', 'first', 'second']) await mkdir(join(path, name), { recursive: true })
  await writeFile(join(path, 'project/research.md'), '# Project\n\n## Topics\n\n[A](a/research.md)\n[B](b/research.md)\n')
  await writeFile(join(path, 'project/a/research.md'), '# Alpha\n\n## Question\n\nThe ALPHA_RESEARCH_QUESTION.\n\n## Scope\n\nFinite systems only.\n')
  await writeFile(join(path, 'project/b/research.md'), '# Beta\n\n## Question\n\nThe BETA_UNRELATED_QUESTION.\n')
  await writeFile(join(path, 'first/note.md'), '# First\n\n条件甲只用于有限系统。\n')
  await writeFile(join(path, 'second/note.md'), '# Second\n\nThe SECOND_SOURCE_CONDITION requires convention B.\n')
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(ExactSessionQuery)
  await ctx.plugin(AgentLoop, { agents: [] })
  const model = new Capture(readSecond)
  ctx.llm.registerAdapter(['study-capture'], model)
  const create = vi.fn(async (request: { workspaceId?: WorkspaceId }) => {
    const agent = await ctx.agentLoop.create(SessionId(`source-study-${create.mock.calls.length}`),
      { provider: 'study-capture', model: 'study-capture' }, { cwd: request.workspaceId === undefined ? path : join(path, 'project') })
    return { sessionId: agent.id }
  })
  // Only creation is substituted; accepted inputs, tools, source reads and model requests use production services.
  ctx.provide('sessionController', { create, ...promptAdmission(ctx) } as never)
  await ctx.plugin(ResearchResources, { roots: [
    { id: 'first', path: join(path, 'first') }, { id: 'second', path: join(path, 'second') },
  ] })
  const resources = ctx.researchResources
  await ctx.plugin(ResearchMemory, { roots: [{ id: workspaceId,
    path: join(path, 'project'), writable: false }] })
  await ctx.fiber.await()
  const memory = ctx.researchMemory
  const selections: SourceSelection[] = ['first', 'second'].map(id => ({
    ref: { rootId: sourceRootId(id), sourceId: sourceIdForPath('note.md') },
  }))
  const ask = async (request: StudyRequest) => {
    const receipt = value(await resources.askStudy(request, signal()))
    const agent = ctx.agents.get(receipt.sessionId)
    if (agent === undefined) throw new Error('The actual Agent was not created.')
    await agent.whenIdle()
    return agent
  }
  return { path, ctx, resources, memory, selections, create, model, ask }
}

async function pdfFixture() {
  const source = await fixture()
  const firstQuote = 'FIRST_PAGE_SELECTED_QUOTE'
  const quote = 'The TAIL_PDF_CONDITION requires convention D.\nOnly the finite-system argument is established.'
  const pages = [{ page: 1, text: firstQuote }, { page: 2,
    text: 'PAGE_TWO_INTRO_ONLY: unrelated background.\n'.repeat(800) + quote + '\nPAGE_TWO_AFTER_QUOTE' }]
  source.resources.registerProvider({ id: 'pdf-tool-fixture', domain: 'literature', list: async context => context.paths.map((path) => {
    const ref = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
    return { id: resourceEntryId(ref), ref, title: path, domain: 'literature', kind: 'literature', providerId: 'pdf-tool-fixture',
      metadata: {}, links: [], topics: [] }
  }), read: async (_context, _ref, locator) => locator?.kind !== 'pdf-page' ? undefined
    // The actual PDF provider validates a quote but returns its complete extracted page for native reading.
    : { kind: 'pdf', pageCount: pages.length, pages: pages.filter(page => page.page === locator.page) } })
  return { ...source, firstQuote, quote, locator: { kind: 'pdf-page' as const, page: 2, quote } }
}

it('delivers two same-named cross-root sources to a genuine Global scope and permits bounded follow-up source reads', async () => {
  const { ask, selections, model, ctx, create } = await fixture(true)
  const agent = await ask({ question: '请保留两份材料各自的条件，对比这些约定。', selections })
  expect(create).toHaveBeenCalledWith({})
  expect(model.requests).toHaveLength(2)
  expect(JSON.stringify(model.requests[0]?.tools)).toContain('research_read_source')
  const delivered = JSON.stringify(model.requests[0]?.messages)
  expect(delivered).toContain('条件甲只用于有限系统')
  expect(delivered).toContain('SECOND_SOURCE_CONDITION')
  expect(delivered).toContain('global')
  expect(delivered).not.toContain('ALPHA_RESEARCH_QUESTION')
  expect(JSON.stringify(model.requests[1]?.messages.find(message => message.role === 'tool' && message.toolCallId === 'study-read')))
    .toContain('SECOND_SOURCE_CONDITION')
  const state = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')
  expect(state?.origin).toMatchObject({ scope: 'global', selections })
  expect(state?.origin?.workspaceId).toBeUndefined()
  expect(state?.origin?.topicId).toBeUndefined()
})

it('keeps the explicitly selected research direction when its evidence lives in another library root', async () => {
  const { ask, selections, model, create } = await fixture()
  await ask({ workspaceId, topicId: topicIdForPath('a/research.md'), question: '这些材料怎样帮助当前子方向？', selections })
  expect(create).toHaveBeenCalledWith({ workspaceId })
  const delivered = JSON.stringify(model.requests[0]?.messages)
  expect(delivered).toContain('ALPHA_RESEARCH_QUESTION')
  expect(delivered).toContain('Finite systems only.')
  expect(delivered).toContain('SECOND_SOURCE_CONDITION')
  expect(delivered).not.toContain('BETA_UNRELATED_QUESTION')
})

it('reports an image observation as undelivered instead of claiming text or visual evidence in a follow-up tool read', async () => {
  const { ask, selections, ctx, resources } = await fixture()
  const agent = await ask({ question: 'Retain the selected source conditions.', selections })
  const original = value(await resources.readResource({ ref: selections[0]!.ref }, signal()))
  const read = vi.spyOn(resources, 'readResource').mockResolvedValue({ ok: true,
    value: { ...original, body: { kind: 'image', mediaType: 'image/png' } } })
  const result = await ctx.tools.execute({ name: 'research_read_source', arguments: { sourceIndex: 1 }, agent,
    callId: ToolCallId('image-read'), signal: signal() })
  read.mockRestore()
  expect(result.isError).toBe(true)
  const delivered = JSON.stringify(result.content)
  expect(delivered).toContain('no image content, OCR text or visual interpretation was delivered')
  expect(delivered).not.toContain('条件甲只用于有限系统')
  expect(delivered).not.toContain('PDF physical page')
})

it.each(['anchor', 'H1-anchor', 'text'] as const)('reads a late %s passage before applying follow-up character offsets', async (kind) => {
  const { ask, selections, ctx, path } = await fixture()
  const introduction = '# Introduction\n\n' + 'INTRO_ONLY: unrelated background.\n'.repeat(800)
  const passage = 'The TAIL_SOURCE_CONDITION requires convention C.\nA second line retains the finite-system limit.'
  const level = kind === 'H1-anchor' ? '#' : '##'
  const heading = `\n${level} Tail evidence\n\n`
  const text = introduction + heading + passage + `\n\n${level} Appendix\n\nAPPENDIX_ONLY\n`
  await writeFile(join(path, 'first/note.md'), text)
  const start = text.indexOf(passage)
  const locator: SourceLocator = kind === 'text' ? { kind, start, end: start + passage.length, quote: passage }
    : { kind: 'anchor', anchor: 'tail-evidence' }
  // A new requested location must not inherit an earlier human-selected quote elsewhere in the source.
  const agent = await ask({ question: 'Keep the source selected for later reading.',
    selections: [{ ...selections[0]!, selectedText: '# Introduction' }] })
  const expected = kind === 'text' ? passage : `${level} Tail evidence\n\n` + passage + '\n\n'
  for (const offset of [0, 23]) {
    const result = await ctx.tools.execute({ name: 'research_read_source',
      arguments: { sourceIndex: 1, location: JSON.stringify(locator), offset }, agent,
      callId: ToolCallId(`late-${kind}-${offset}`), signal: signal() })
    expect(result.isError).not.toBe(true)
    const delivered = result.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
    expect(delivered).toContain(`window starts at character ${offset} of ${expected.length}`)
    expect(delivered.endsWith(expected.slice(offset))).toBe(true)
    expect(delivered).not.toContain('INTRO_ONLY')
    expect(delivered).not.toContain('APPENDIX_ONLY')
    expect(JSON.stringify({ text: delivered }).length).toBeLessThanOrEqual(12_000)
  }
  const beyond = await ctx.tools.execute({ name: 'research_read_source',
    arguments: { sourceIndex: 1, location: JSON.stringify(locator), offset: expected.length + 1 }, agent,
    callId: ToolCallId(`late-${kind}-beyond`), signal: signal() })
  expect(beyond.isError).toBe(true)
  expect(JSON.stringify(beyond.content)).toContain('offset is beyond the current source reading')
})

it.each(['selected', 'requested'] as const)('reads a late %s PDF quote before applying follow-up character offsets', async (location) => {
  const { ask, selections, ctx, quote, firstQuote, locator } = await pdfFixture()
  const selected = selections[0]!
  const agent = await ask({ question: 'Keep this source selected for later reading.', selections: [{ ...selected,
    ...(location === 'selected' ? { locator } : { locator: { kind: 'pdf-page' as const, page: 1 }, selectedText: firstQuote }) }] })
  for (const offset of [0, 23]) {
    const result = await ctx.tools.execute({ name: 'research_read_source',
      arguments: { sourceIndex: 1, ...(location === 'selected' ? {} : { location: JSON.stringify(locator) }), offset }, agent,
      callId: ToolCallId(`late-pdf-${location}-${offset}`), signal: signal() })
    expect(result.isError).not.toBe(true)
    const delivered = result.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
    expect(delivered).toContain(`Current reading: ${materialSourceAddress(selected.ref, locator)}`)
    expect(delivered).toContain(`window starts at character ${offset} of ${quote.length}`)
    expect(delivered.endsWith(quote.slice(offset))).toBe(true)
    expect(delivered).not.toContain('PAGE_TWO_INTRO_ONLY')
    expect(delivered).not.toContain('PAGE_TWO_AFTER_QUOTE')
    expect(delivered).not.toContain(firstQuote)
    expect(JSON.stringify({ text: delivered }).length).toBeLessThanOrEqual(12_000)
  }
  // Follow-up reads may still request the full page explicitly, without inheriting a previous quote.
  const wholePage = await ctx.tools.execute({ name: 'research_read_source',
    arguments: { sourceIndex: 1, location: JSON.stringify({ kind: 'pdf-page', page: 2 }) }, agent,
    callId: ToolCallId(`whole-pdf-${location}`), signal: signal() })
  expect(wholePage.isError).not.toBe(true)
  expect(JSON.stringify(wholePage.content)).toContain('PDF physical page 2')
  expect(JSON.stringify(wholePage.content)).toContain('PAGE_TWO_INTRO_ONLY')
})

it('rejects a follow-up offset beyond the PDF quote even when it remains inside the full page', async () => {
  const { ask, selections, ctx, quote, locator } = await pdfFixture()
  const agent = await ask({ question: 'Retain this exact PDF quote.', selections: [{ ...selections[0]!, locator }] })
  const beyond = await ctx.tools.execute({ name: 'research_read_source',
    arguments: { sourceIndex: 1, offset: quote.length + 1 }, agent,
    callId: ToolCallId('late-pdf-beyond'), signal: signal() })
  expect(beyond.isError).toBe(true)
  expect(JSON.stringify(beyond.content)).toContain('offset is beyond the current source reading')
})

it('retains a historical human-selected quote separately from a changed current source', async () => {
  const { ask, selections, model, path } = await fixture()
  const quote = '条件甲只用于有限系统。'
  const agent = await ask({ question: '请记住这个选段的限制。', selections: [{ ...selections[0]!, selectedText: quote }] })
  await writeFile(join(path, 'first/note.md'), '# First\n\nThe original selected passage was removed.\n')
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '继续；不要把旧选段当成目前原文。' }] }))
  await agent.whenIdle()
  const context = JSON.stringify(model.requests.at(-1)?.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context'))
  expect(context).toContain(quote)
  expect(context).toContain('historical source text')
  expect(context).toContain('missing or repeated')
  expect(context).toContain('不要把旧选段当成目前原文')
})

it('rejects invalid selections and topic-less Workspace fabrication before creating any conversation', async () => {
  const { resources, create, selections } = await fixture()
  expect(await resources.askStudy({ topicId: topicIdForPath('a/research.md'), question: 'Which topic?', selections }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await resources.askStudy({ question: 'Read the missing root.', selections: [{ ref: {
    rootId: sourceRootId('not-authorized'), sourceId: sourceIdForPath('note.md'),
  } }] }, signal())).toMatchObject({ ok: false })
  expect(create).not.toHaveBeenCalled()
})


it('projects only authored topic uses across authorized library roots, and removes changed links on refresh', async () => {
  const { path, memory, resources, selections } = await fixture()
  resources.registerProvider({ id: 'relationship-fixture', domain: 'knowledge', list: async context => context.paths
    .filter(path => path.endsWith('.md')).map((path) => {
      const ref = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
      return { id: resourceEntryId(ref), ref, title: path, domain: 'knowledge', kind: 'note', providerId: 'relationship-fixture',
        metadata: {}, links: [], topics: [] }
    }) })
  await writeFile(join(path, 'project/a/research.md'), '# Alpha\n\n## Materials\n\nUse [the finite control](../../first/note.md) to test convention A; this is a control, not a settled result.\n')
  await memory.refresh({ workspaceId }, signal())
  const alpha = value(await resources.listResources({ domain: 'knowledge', topic: { workspaceId, topicId: topicIdForPath('a/research.md') } }, signal()))
  expect(alpha.items.map(item => item.ref)).toContainEqual(selections[0]!.ref)
  expect(alpha.items.map(item => item.ref)).not.toContainEqual(selections[1]!.ref)
  const linked = alpha.items.find(item => item.ref.rootId === selections[0]!.ref.rootId)
  expect(linked?.topics).toContainEqual({ workspaceId, topicId: topicIdForPath('a/research.md'),
    reason: 'Use [the finite control](../../first/note.md) to test convention A; this is a control, not a settled result.' })
  const beta = value(await resources.listResources({ domain: 'knowledge', topic: { workspaceId, topicId: topicIdForPath('b/research.md') } }, signal()))
  expect(beta.items).toEqual([])
  await writeFile(join(path, 'project/a/research.md'), '# Alpha\n\nThe external control has been removed.\n')
  await memory.refresh({ workspaceId }, signal())
  const after = value(await resources.listResources({ domain: 'knowledge', topic: { workspaceId, topicId: topicIdForPath('a/research.md') } }, signal()))
  expect(after.items).toEqual([])
})


it('uses the observed commit in source-tool citations while retaining the human original branch selection', async () => {
  const { resources, selections, ask, model } = await fixture(true)
  const revision = '0123456789abcdef0123456789abcdef01234567'
  resources.registerProvider({ id: 'observed-code-fixture', domain: 'code', list: async context => context.paths.map((path) => {
    const ref = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
    return { id: resourceEntryId(ref), ref, title: path, domain: 'code', kind: 'code', providerId: 'observed-code-fixture',
      metadata: {}, links: [], topics: [] }
  }), read: async (_context, _ref, locator) => locator?.kind !== 'code' ? undefined
    : { kind: 'text', format: 'plain-text', text: 'THE_PINNED_SOURCE_CONDITION', revision } })
  const selected = { ...selections[1]!, locator: { kind: 'code' as const, startLine: 1, endLine: 1, revision: 'HEAD' } }
  await ask({ question: 'Keep the observed source version.', selections: [selections[0]!, selected] })
  const tool = JSON.stringify(model.requests[1]?.messages.find(message => message.role === 'tool' && message.toolCallId === 'study-read'))
  expect(tool).toContain(revision)
  expect(tool).not.toContain('HEAD')
  expect(selected.locator.revision).toBe('HEAD')
})


it('delivers a long provisional draft in the actual complete request budget instead of omitting its only evidence unit', async () => {
  const { ask, path, selections, model } = await fixture()
  const body = '# Provisional saved comparison\n\n' + Array.from({ length: 700 }, (_, index) =>
    `Condition ${index}: only under A. Other pages remain unread. Preserve the original source limits.\n`).join('')
  await writeFile(join(path, 'first/note.md'), body)
  await ask({ question: 'Reopen this provisional saved comparison and preserve its source limits.', selections: [selections[0]!] })
  const context = model.requests[0]?.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context')
  const delivered = JSON.stringify(context)
  expect(delivered).toContain('dsh-resource://aitp-material-source')
  expect(delivered).toContain('only under A')
  expect(delivered).toContain('Other pages remain unread')
  expect(delivered).toContain('Reading coverage: only this located excerpt')
})


it('continues global source study with its original durable scope and fresh per-message selections', async () => {
  const { ask, selections, resources, ctx, create, model } = await fixture()
  const first = await ask({ question: 'Study the first source.', selections: selections.slice(0, 1) })
  const before = ctx.sessionProjections.stateOf(first.session, 'researchWorking')?.origin
  const second = await ask({ sessionId: first.id, question: 'Now compare the second source.', selections: selections.slice(1) })
  expect(second.id).toBe(first.id)
  expect(create).toHaveBeenCalledTimes(1)
  const after = ctx.sessionProjections.stateOf(second.session, 'researchWorking')?.origin
  expect(after?.scope).toBe('global')
  expect(after?.studyId).toBe(before?.studyId)
  expect(after?.selections?.[0]?.ref).toEqual(selections[1]?.ref)
  expect(JSON.stringify(model.requests.at(-1))).toContain('SECOND_SOURCE_CONDITION')
  expect(await resources.askStudy({ sessionId: first.id, sourceSetId: 'unrelated-source-set', question: 'Rebind?', selections }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  await expect(resources.askStudy({ sessionId: first.id, workspaceId, topicId: topicIdForPath('a/research.md'),
    question: 'Implicit global-to-topic change?', selections }, signal())).rejects.toMatchObject({ code: 'research/session-unavailable' })
})


it('keeps explicit Workspace-root material questions in root research rather than a global study', async () => {
  const { memory, resources, selections, ctx, create } = await fixture()
  const initial = await memory.ask({ workspaceId, question: 'Root research question.' }, signal())
  if (!initial.ok) throw new Error(initial.error.message)
  await ctx.agents.get(initial.value.sessionId)!.whenIdle()
  const continuation = await resources.askStudy({ scope: 'workspace', workspaceId, sessionId: initial.value.sessionId,
    question: 'Relate this material to the project.', selections }, signal())
  expect(continuation).toMatchObject({ ok: true, value: { sessionId: initial.value.sessionId } })
  const agent = ctx.agents.get(initial.value.sessionId)!
  await agent.whenIdle()
  expect(ctx.sessionProjections.stateOf(agent.session, 'researchWorking')?.origin).toMatchObject({ workspaceId })
  expect(ctx.sessionProjections.stateOf(agent.session, 'researchWorking')?.origin).not.toHaveProperty('scope')
  expect(create).toHaveBeenCalledTimes(1)
})

it.each([undefined, ['code'] as const])('associates an explicitly linked source with its code checkout for domains %s without claiming unrelated topics', async (domains) => {
  const { path, resources, memory } = await fixture()
  const repo = join(path, 'repo')
  await mkdir(join(repo, 'src'), { recursive: true })
  await writeFile(join(repo, 'src/driver.cpp'), 'int driver = 1;\n')
  const checkout = await resources.registerRoot({ id: 'code-checkout', path: repo, ...(domains === undefined ? {} : { domains }) })
  resources.registerProvider({ id: 'code-checkout-test', domain: 'code', list: async (context) => {
    const ref = { rootId: context.root.id, sourceId: 'git:checkout' as SourceSelection['ref']['sourceId'] }
    return [{ id: resourceEntryId(ref), ref, title: 'Checkout', domain: 'code', kind: 'code',
      providerId: 'code-checkout-test', metadata: {}, links: [], topics: [] }]
  } })
  await writeFile(join(path, 'project/a/research.md'), '# Alpha\n\n[Driver](../../repo/src/driver.cpp) is the cited implementation.\n')
  await memory.refresh({ workspaceId }, signal())
  const alpha = value(await resources.listResources({ domain: 'code', rootId: checkout.rootId,
    topic: { workspaceId, topicId: topicIdForPath('a/research.md') } }, signal()))
  expect(alpha.items.map(item => item.ref)).toContainEqual({ rootId: checkout.rootId, sourceId: 'git:checkout' })
  expect(alpha.items[0]?.topics[0]?.reason).toContain('cited implementation')
  const beta = value(await resources.listResources({ domain: 'code', rootId: checkout.rootId,
    topic: { workspaceId, topicId: topicIdForPath('b/research.md') } }, signal()))
  expect(beta.items).toEqual([])
})
