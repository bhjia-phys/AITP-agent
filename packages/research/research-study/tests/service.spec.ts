import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'
import ResearchResources from '@deepseek-ai/dsh-research-resources'
import { afterEach, expect, it } from 'vitest'
import ResearchStudy from '../src/index.ts'
import type { StudyResult } from '../src/types.ts'
import { answerFixture, ptcAnswerFixture } from './fixture.ts'

class Query extends SessionQueryEngine {
  override async searchSessions(): Promise<never> { throw new Error('Capture does not perform corpus search') }
  override async searchEvents(): Promise<never> { throw new Error('Capture does not perform corpus search') }
}
const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })
function value<T>(result: StudyResult<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value }
const signal = (): AbortSignal => new AbortController().signal
async function fixture(withResources = false) {
  const home = await mkdtemp(join(tmpdir(), 'research-study-service-'))
  cleanups.push(() => rm(home, { recursive: true, force: true }))
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  ctx.provide('dshHomePath', (...parts: string[]) => join(home, ...parts))
  const sessions = new SessionStore(ctx)
  new Query(ctx)
  const resources = withResources ? new ResearchResources(ctx, {}) : undefined
  const service = new ResearchStudy(ctx)
  await service.getSetup()
  return { home, ctx, sessions, service, resources }
}

it('captures through the real Session observer, preserves original evidence across edits and exports actual Markdown', async () => {
  const f = await fixture(), answer = answerFixture()
  f.sessions.enter(answer.session)
  const request = { operationId: 'capture-first', title: 'Condition and limitation', kind: 'report' as const,
    sessionId: answer.session.id, seq: answer.answer.seq }
  const originalEvents = JSON.stringify(answer.events)
  const receipt = value(await f.service.captureAnswer(request, signal()))
  const captured = value(await f.service.getArtifact({ id: receipt.id }))
  expect(captured).toMatchObject({ origin: 'captured-answer', status: 'provisional', edited: false,
    markdown: 'The conclusion holds only under A. Other pages remain unread.', citationCount: 3,
    capture: { actor: 'model', sessionId: answer.session.id, seq: answer.answer.seq } })
  value(await f.service.saveNote({ operationId: 'edit-answer', id: receipt.id, title: 'Edited report', kind: 'report', markdown: 'My revised explanation.' }))
  const edited = value(await f.service.getArtifact({ id: receipt.id }))
  expect(edited).toMatchObject({ origin: 'captured-answer', edited: true, citationCount: 3, markdown: 'My revised explanation.' })
  expect(edited.capture).toEqual(captured.capture)
  const exported = value(await f.service.exportMarkdown({ id: receipt.id }))
  expect(exported.markdown).toContain('My revised explanation.')
  expect(exported.markdown).toContain('selected')
  expect(exported.markdown).toContain('Unavailable source: other pages not delivered.')
  expect(exported.markdown).toContain(`assistant sequence ${answer.answer.seq}`)
  expect(exported.markdown).toContain('not evidence that every selected source or page was read')
  expect(JSON.stringify(answer.events)).toBe(originalEvents)
  expect(await readdir(f.home)).toEqual(['research-study'])
  expect(await readFile(join(f.home, 'research-study/state.json'), 'utf8')).toContain('capture-first')
})

it('offers saved drafts as explicitly provisional sources and withdraws a removed synthetic source', async () => {
  const f = await fixture(true), resources = f.resources
  if (resources === undefined) throw new Error('The shared source service is missing.')
  expect((await f.service.getSetup()).asSources).toBe(true)
  const saved = value(await f.service.saveNote({ operationId: 'note-source', title: 'A local note', kind: 'note', markdown: '## Claim\n\nThis remains provisional.' }))
  const note = value(await f.service.getArtifact({ id: saved.id }))
  expect(note.source).toBeDefined()
  if (note.source === undefined) throw new Error('The shared draft source is missing.')
  const read = await resources.readResource({ ref: note.source.ref }, signal())
  expect(read).toMatchObject({ ok: true, value: { resource: { kind: 'note', metadata: { support: 'provisional', generated: 'false' } }, body: { kind: 'text' } } })
  value(await f.service.removeArtifact({ operationId: 'remove-source', id: saved.id }))
  expect(await resources.readResource({ ref: note.source.ref }, signal())).toMatchObject({ ok: false, error: { code: 'not-found' } })
})

it('saves verified nested PTC delivery through the existing Session observer', async () => {
  const f = await fixture(), answer = ptcAnswerFixture({ nested: true, output: 'json' })
  f.sessions.enter(answer.session)
  const receipt = value(await f.service.captureAnswer({ operationId: 'capture-ptc', title: 'Returned condition', kind: 'note',
    sessionId: answer.session.id, seq: answer.answer.seq }, signal()))
  const saved = value(await f.service.getArtifact({ id: receipt.id }))
  expect(saved.capture?.contexts).toEqual([{ seq: answer.result!.seq, name: 'research_read_source', text: answer.text }])
  expect(saved.citations).toEqual([{ selection: answer.selection, basis: 'recorded-source-read',
    sessionId: answer.session.id, seq: answer.result!.seq }])
  expect(answer.session.deriveMessages().filter(message => message.role === 'tool')).toHaveLength(1)
})

it('reports absent Host storage and absent Session observation explicitly', async () => {
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  const unsupported = new ResearchStudy(ctx)
  expect(await unsupported.getSetup()).toEqual({ canSave: false, canCapture: false, asSources: false })
  expect(await unsupported.saveNote({ operationId: 'unsupported', title: 'A', kind: 'note', markdown: 'Text' }))
    .toMatchObject({ ok: false, error: { code: 'unsupported' } })
  const f = await fixture(), answer = answerFixture({ complete: false })
  f.sessions.enter(answer.session)
  expect(await f.service.captureAnswer({ operationId: 'not-complete', title: 'A', kind: 'outline', sessionId: answer.session.id, seq: answer.answer.seq }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
})

it('rejects non-owner inspection and mutation before accessing operational drafts', async () => {
  const f = await fixture()
  const caller = f.ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  expect(() => caller.researchStudy.listArtifacts({})).toThrow('Host owner')
  await expect(caller.researchStudy.getSetup()).rejects.toThrow('Host owner')
  expect(() => caller.researchStudy.saveNote({ operationId: 'external', title: 'A', kind: 'note', markdown: 'Text' })).toThrow('Host owner')
  expect(await readdir(f.home)).toEqual([])
})
