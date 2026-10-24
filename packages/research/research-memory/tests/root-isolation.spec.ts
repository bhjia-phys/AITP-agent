/** Unavailable roots cannot change the access or write scope of another project. */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import ResearchMemory from '../src/index.ts'
import { topicIdForPath } from '../src/markdown.ts'
import type { Result } from '../src/types.ts'

const disposers: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })
const workspaceId = 'healthy' as WorkspaceId
const signal = (): AbortSignal => new AbortController().signal
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
async function fixture(writable = true, stateInside = false) {
  const temporary = await mkdtemp(join(tmpdir(), 'research-root-isolation-'))
  disposers.push(() => rm(temporary, { recursive: true, force: true }))
  const root = join(temporary, 'notes')
  await mkdir(join(root, 'child'), { recursive: true })
  await writeFile(join(root, 'research.md'), '# Project\n\nThe project question.\n')
  const source = join(root, 'child/research.md')
  const original = '# Child\n\nThe finite question.\n\n## Scope\n\nFinite N only.\n'
  await writeFile(source, original)
  const unknown = join(temporary, 'unknown')
  await mkdir(unknown)
  const missing = join(temporary, 'unavailable')
  const ctx = new Context()
  disposers.push(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  // The Workspace registry is the authority for this otherwise unconfigured address.
  ctx.provide('workspaceRegistry', { get: (id: WorkspaceId) => id === 'unknown' ? { path: unknown } : undefined } as never)
  const stateDirectory = join(stateInside ? root : temporary, 'operations')
  const service = new ResearchMemory(ctx, { roots: [
    { path: `${root}/.`, id: workspaceId, writable, stateDirectory },
    { path: missing, id: 'offline', writable: true, stateDirectory: join(temporary, 'offline-operations') },
  ] })
  const topicId = topicIdForPath('child/research.md')
  const preview = async () => {
    const current = value(await service.getTopic({ workspaceId, topicId }, signal()))
    return service.previewChange({ workspaceId, intent: { topicId, expectedRevision: current.revision,
      command: { kind: 'update-scope', scope: 'Only the matched N=6 control.' } } })
  }
  return { service, ctx, root, source, original, preview, topicId }
}

it('reads a healthy canonical match and applies its scratch preview despite an unavailable configured root', async () => {
  const { service, source, preview, topicId } = await fixture()
  expect(await service.getProject({ workspaceId }, signal())).toMatchObject({ ok: true })
  expect(await service.getTopic({ workspaceId, topicId }, signal())).toMatchObject({ ok: true })
  expect(await service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: {
    read: true, readContext: true, previewChanges: true, applyChanges: true, commands: ['update-scope', 'record-answer'],
  } })
  const prepared = value(await preview())
  expect(await readFile(source, 'utf8')).toContain('Finite N only.')
  expect(await service.applyChange({ workspaceId, request: { previewId: prepared.value.previewId, operationId: 'healthy-edit' } }))
    .toMatchObject({ ok: true })
  expect(await readFile(source, 'utf8')).toContain('Only the matched N=6 control.')
})

it('still rejects the requested missing root, an unconfigured registered root, and an unknown workspace', async () => {
  const { service } = await fixture()
  await expect(service.getProject({ workspaceId: 'offline' as WorkspaceId }, signal())).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(service.provider({ workspaceId: 'unknown' as WorkspaceId }, signal())).rejects.toThrow('has not been configured for access')
  await expect(service.getProject({ workspaceId: 'absent' as WorkspaceId }, signal())).rejects.toThrow('Workspace is unavailable')
})

it('keeps the healthy root read-only and refuses non-owner writes despite another configured writable root', async () => {
  const { service, ctx, source, original, preview } = await fixture(false)
  expect(await service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { applyChanges: false, commands: [] } })
  const prepared = value(await preview())
  expect(await service.applyChange({ workspaceId, request: { previewId: prepared.value.previewId, operationId: 'readonly-edit' } }))
    .toMatchObject({ ok: false, error: { code: 'read-only' } })
  const caller = ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  expect(await caller.researchMemory.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { applyChanges: false } })
  await expect(caller.researchMemory.applyChange({ workspaceId,
    request: { previewId: prepared.value.previewId, operationId: 'external-edit' } })).rejects.toThrow('available to the workspace owner')
  expect(await readFile(source, 'utf8')).toBe(original)
})

it('refuses receipts inside the healthy source root even when another configured root is unavailable', async () => {
  const { source, original, preview } = await fixture(true, true)
  expect(await preview()).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await readFile(source, 'utf8')).toBe(original)
})
