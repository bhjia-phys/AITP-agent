/** Exercise actual suite selections with production Loader services and an isolated persistent Session. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { dump } from 'js-yaml'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include, { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { composeEntries, loadOptionalPatches, loadOverlayPatches, loadProfile } from '@deepseek-ai/dsh-app-boot'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import ResearchMemory from '@deepseek-ai/dsh-research-memory'
import ResearchResources from '@deepseek-ai/dsh-research-resources'
import * as Literature from '@deepseek-ai/dsh-research-literature'
import * as Knowledge from '@deepseek-ai/dsh-research-knowledge'
import * as Code from '@deepseek-ai/dsh-research-code'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { TopicId } from '@deepseek-ai/dsh-research-memory'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import { parseDshArgs } from '../../apps/cli/src/args.ts'
import { prepareAitpStartup } from '../aitp-agent.ts'
import ExactSessionQuery from '../../packages/research/research-memory/tests/fixtures/runtime/query-plugin.ts'
import * as mock from './aitp-composition-model.ts'

const configuredFixture = process.argv[2]
if (configuredFixture === undefined) throw new Error('A Loader fixture path is required.')
const fixture = configuredFixture
const repository = resolve(import.meta.dirname, '../..')
const home = resolve('.app-home')
const notes = resolve('notes')
const workspaceId = 'suite-scratch' as WorkspaceId
const topicId = 'topic:child%2Fresearch.md' as TopicId
const id = SessionId('suite-persisted-research')
const signal = new AbortController().signal
await mkdir(home)
await mkdir(join(notes, 'child'), { recursive: true })
const sources = {
  'research.md': '# Project\n\n[Finite control](child/research.md) assesses the finite-size bound.\n',
  'child/research.md': '# Research\n\nCan the finite control settle the question?\n\n## Current answer\n\nFIXTURE_ACCEPTED_FINITE_BOUND applies only at N=6.\n',
  'index.md': '# Existing material index\n\n[Paper](paper.pdf)\n\n[Code](control.py)\n',
  'control.py': 'print("finite control")\n',
  'paper.pdf': '%PDF-1.4\nExisting scientific bytes retained by plugin switches.\n',
}
for (const [name, text] of Object.entries(sources)) await writeFile(join(notes, name), text)
// Include a whole-config expression to prove native !!js survives the generated browse override.
const storedConfig = dump([
  { id: 'research-memory', config: { __jsExpr: '({ roots: [{ id: "suite-scratch", path: process.cwd() + "/notes", writable: true }],'
    + ' watchSources: false, watchMode: "bounded", automaticResearch: true, maxContextCharacters: 12000 })' } },
  { id: 'research-resources', config: { roots: [{ id: 'suite-sources', path: notes }], watchSources: false } },
], { schema: entryListSchema })
await writeFile(join(home, 'cordis.patch.yml'), storedConfig)
const productionIds = new Set(['research-memory', 'research-resources', 'research-literature', 'research-knowledge', 'research-code'])

async function boot(label: string, options: readonly string[]): Promise<{ ctx: Context; release: () => void }> {
  const startup = await prepareAitpStartup(repository, options, home)
  const ctx = new Context()
  try {
    const invocation = parseDshArgs(startup.args, 'fixture')
    if (invocation.mode !== 'profile') throw new Error('Expected profile invocation')
    const profile = loadProfile('fixture', 'web', join(repository, 'apps/cli/package.json'), home, { readOnly: true })
    const entries = composeEntries([...profile.layers.map(layer => layer.patches), profile.patches,
      loadOptionalPatches('fixture', join(home, 'cordis.patch.yml')) ?? [],
      ...invocation.patches.map(path => loadOverlayPatches('fixture', path)),
    ]).filter(entry => productionIds.has(entry.id))
      .map(entry => ({ ...entry, name: `cordis:${entry.id}` }))
    if (entries.length !== productionIds.size) throw new Error('The shipped bundle omitted a research plugin.')
    const config = resolve(`${label}.cordis.yml`)
    await writeFile(config, `${await readFile(fixture, 'utf8')}\n${dump(entries, { schema: entryListSchema })}`)
    ctx.provide('dshHomePath', (...parts: string[]) => join(home, ...parts))
    ctx.baseUrl = `${pathToFileURL(dirname(config)).href}/`
    await ctx.plugin(Loader)
    Object.assign(ctx.loader.builtins, { include: Include, llm: LlmRuntime, sessions: SessionStore,
      projections: SessionProjectionRegistry, persistence: JsonlPersistence, query: ExactSessionQuery,
      prompt: SystemPrompt, tools: ToolRuntime, agents: AgentRegistry, loop: AgentLoop,
      typert: TypertRegistry, policy: SandboxPolicy, mock, 'research-memory': ResearchMemory,
      'research-resources': ResearchResources, 'research-literature': Literature,
      'research-knowledge': Knowledge, 'research-code': Code })
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
    await ctx.loader.await()
    for (const entry of ctx.loader.entries()) await entry.fiber?.await()
    return { ctx, release: startup.release }
  } catch (error) { await ctx.fiber.dispose(); startup.release(); throw error }
}

const observations: object[] = []
let savedHistory: SessionLogSnapshot | undefined
const combinations = [
  { label: 'full', args: ['--research-suite=full'] },
  { label: 'without-literature', args: ['--research-suite=full', '--research-libraries=knowledge,code'] },
  { label: 'without-knowledge', args: ['--research-suite=full', '--research-libraries=literature,code'] },
  { label: 'without-code', args: ['--research-suite=full', '--research-libraries=literature,knowledge'] },
  { label: 'without-libraries', args: ['--research-suite=full', '--research-libraries=none'] },
  { label: 'browse', args: ['--research-suite=browse'] },
  { label: 'skills', args: ['--research-suite=skills'] },
  { label: 'restored', args: ['--research-suite=full'] },
]
for (const combination of combinations) {
  const { ctx, release } = await boot(combination.label, combination.args)
  try {
    const memory = ctx.get('researchMemory')
    const resources = ctx.get('researchResources')
    const provider = await memory?.provider({ workspaceId }, signal)
    const topic = await memory?.getTopic({ workspaceId, topicId }, signal)
    const domains: Record<string, unknown> = {}
    for (const domain of ['literature', 'knowledge', 'code'] as const) {
      domains[domain] = await resources?.listResources({ domain }, signal)
    }
    if (combination.label === 'full' || combination.label === 'browse' || combination.label === 'skills') {
      const sessionId = combination.label === 'full' ? id : SessionId(`suite-${combination.label}`)
      const agent = await ctx.agentLoop.create(sessionId, { provider: 'aitp-composition-model', model: 'aitp-composition-model' }, { cwd: notes })
      agent.followup(createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: { workspaceId, topicId } },
        content: [{ type: 'text', text: `Continue the existing finite control (${combination.label}).` }] }))
      await agent.whenIdle()
      await ctx.sessions.flush(agent.session)
    }
    const history = await ctx.sessionQuery.readSession(id)
    // The cold JSONL reader materializes the Session format's omitted depth default.
    const comparable = { ...history, session: { ...history.session, delegationDepth: history.session.delegationDepth ?? 0 } }
    savedHistory ??= comparable
    observations.push({ label: combination.label, memory: memory !== undefined, resources: resources !== undefined,
      provider, topic, domains, historyPreserved: isDeepStrictEqual(comparable, savedHistory),
      sourcesPreserved: (await Promise.all(Object.entries(sources).map(async ([name, text]) => await readFile(join(notes, name), 'utf8') === text))).every(Boolean),
      storedConfigPreserved: await readFile(join(home, 'cordis.patch.yml'), 'utf8') === storedConfig })
  } finally { await ctx.fiber.dispose(); release() }
}
await writeFile('composition-observations.json', JSON.stringify(observations))
