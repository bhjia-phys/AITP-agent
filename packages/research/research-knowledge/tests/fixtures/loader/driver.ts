/** Real Loader composition of all three independent domains over one source authority. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import * as Include from '@deepseek-ai/cordis-plugin-include'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import ResearchResources, { sourceIdForPath, sourceRootId } from '@deepseek-ai/dsh-research-resources'
import type { ResourceDomain, ResourceResult, SourceTopicId, TopicAssociation } from '@deepseek-ai/dsh-research-resources'
import * as knowledge from '@deepseek-ai/dsh-research-knowledge'
import * as literature from '@deepseek-ai/dsh-research-literature'
import * as code from '@deepseek-ai/dsh-research-code'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const config = process.argv[2]
if (config === undefined) throw new Error('The domain composition needs its Loader configuration path.')
const root = process.cwd()
const runtimeConfig = join(root, 'libraries.cordis.yml')
await writeFile(runtimeConfig, await readFile(config))
const knowledgePath = join(root, 'knowledge')
const paperPath = join(root, 'papers')
const checkoutPath = join(root, 'checkout')
await Promise.all([mkdir(knowledgePath), mkdir(paperPath), mkdir(checkoutPath)])
const index = '# Index\n\n| Entry | Kind | Note | Support |\n|---|---|---|---|\n| Which condition is needed? | theorem | [Atom](atom.md) | source |\n'
const atom = '---\nkind: theorem\nsupport: source\nreview: awaiting\n---\n# Conditional theorem\n\nOnly under A.\n'
await writeFile(join(knowledgePath, 'index.md'), index)
await writeFile(join(knowledgePath, 'atom.md'), atom)
const pdf = await readFile(new URL('../../../../research-literature/tests/fixtures/two-pages.pdf', import.meta.url))
await writeFile(join(paperPath, 'paper.pdf'), pdf)
const execFile = promisify(execFileCallback)
const git = (...args: string[]) => execFile('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: checkoutPath,
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' } })
await git('init', '-q')
await writeFile(join(checkoutPath, 'model.py'), 'original condition\n')
await git('add', 'model.py')
await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Initial model')
await writeFile(join(checkoutPath, 'model.py'), 'changed condition\n')
const gitIndex = await readFile(join(checkoutPath, '.git/index'))

function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

const ctx = new Context()
ctx.baseUrl = `${pathToFileURL(dirname(runtimeConfig)).href}/`
try {
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, typert: TypertRegistry, resources: ResearchResources,
    knowledge, literature, code })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(runtimeConfig).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  const service = ctx.get('researchResources')
  if (service === undefined) throw new Error('The shared source service did not activate.')
  const signal = new AbortController().signal
  const before = {
    knowledge: value(await service.listResources({ domain: 'knowledge' }, signal)),
    literature: value(await service.listResources({ domain: 'literature' }, signal)),
    code: value(await service.listResources({ domain: 'code' }, signal)),
  }
  const topicPath = join(root, 'large-workspace')
  await mkdir(topicPath)
  await writeFile(join(topicPath, 'proof.md'), '# Selected proof\n\nOnly under A.\n')
  await writeFile(join(topicPath, 'selected.pdf'), pdf)
  await writeFile(join(topicPath, 'archive.pdf'), pdf)
  await writeFile(join(topicPath, 'model.py'), 'first line\nselected line\n')
  const topic: TopicAssociation = { workspaceId: 'workspace:research' as TopicAssociation['workspaceId'],
    topicId: 'topic:question' as SourceTopicId, reason: 'Main note material.' }
  const topicRoot = await service.registerRoot({ id: 'research-workspace', path: topicPath,
    workspaceId: topic.workspaceId, grantKind: 'research-enrollment' })
  const linked = (path: string) => ({ rootId: topicRoot.rootId, sourceId: sourceIdForPath(path) })
  const unlink = service.registerTopicAssociations({ id: 'fixture-main-note', read: async () =>
    ['proof.md', 'selected.pdf', 'model.py'].map(path => ({ ref: linked(path), topic })) })
  const explicit = value(await service.listResources({ topic }, signal))
  const explicitPdf = value(await service.readResource({ ref: linked('selected.pdf'), locator: { kind: 'pdf-page', page: 2 } }, signal))
  const line = await service.resolveLocalLink({ from: linked('proof.md'), href: 'model.py#L2' }, signal)
  if (line === undefined) throw new Error('The explicit code line did not resolve.')
  const explicitCode = value(await service.readResource(line, signal))
  const globalAfterLinks = value(await service.listResources({}, signal))
  unlink()
  const afterUnlink = value(await service.listResources({ topic }, signal))
  const paper = value(await service.readResource({ ref: { rootId: sourceRootId('papers'), sourceId: sourceIdForPath('paper.pdf') }, locator: { kind: 'pdf-page', page: 2 } }, signal))
  const checkout = before.code.items.find(item => item.metadata.entryKind === 'checkout')
  if (checkout === undefined) throw new Error('The actual code checkout was absent.')
  const diff = value(await service.readResource({ ref: checkout.ref, locator: { kind: 'git', view: 'diff', scope: 'working-tree' } }, signal))
  const lifecycle: { domain: ResourceDomain; disconnected: boolean; peersStillReadable: boolean; reloaded: boolean }[] = []
  const domains: ResourceDomain[] = ['knowledge', 'literature', 'code']
  for (const domain of domains) {
    const entry = [...ctx.loader.entries()].find(item => item.options.name === `cordis:${domain}`)
    if (entry?.fiber === undefined) throw new Error(`The ${domain} plugin has no live Loader fiber.`)
    await entry.fiber.dispose()
    const disconnected = !((await service.listResources({ domain }, signal)).ok)
    const peers = await Promise.all(domains.filter(peer => peer !== domain).map(peer => service.listResources({ domain: peer }, signal)))
    await ctx.loader.create({ name: `cordis:${domain}` })
    await ctx.loader.await()
    for (const current of ctx.loader.entries()) await current.fiber?.await()
    const reloaded = value(await service.listResources({ domain }, signal)).items.length === before[domain].items.length
    lifecycle.push({ domain, disconnected, peersStillReadable: peers.every(peer => peer.ok && peer.value.items.length > 0), reloaded })
  }
  await writeFile('domain-observations.json', JSON.stringify({ before, paper, diff, lifecycle,
    explicit, explicitPdf, explicitCode, globalAfterLinks, afterUnlink,
    noModelServices: ctx.get('llm') === undefined && ctx.get('agents') === undefined,
    sourcesPreserved: await readFile(join(knowledgePath, 'index.md'), 'utf8') === index
      && await readFile(join(knowledgePath, 'atom.md'), 'utf8') === atom
      && (await readFile(join(paperPath, 'paper.pdf'))).equals(pdf)
      && (await readFile(join(checkoutPath, '.git/index'))).equals(gitIndex)
      && await readFile(join(checkoutPath, 'model.py'), 'utf8') === 'changed condition\n',
  }))
} finally { await ctx.fiber.dispose() }
