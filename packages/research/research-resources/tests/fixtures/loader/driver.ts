/** Real Cordis Loader boot, local source reads, domain disposal and reload without any model services. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import * as Include from '@deepseek-ai/cordis-plugin-include'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import ResearchResources from '../../../src/index.ts'
import type { ResourceResult } from '../../../src/types.ts'
import * as catalog from './catalog.ts'

const suppliedConfig = process.argv[2]
if (suppliedConfig === undefined) throw new Error('The Loader fixture requires a configuration path.')
// Loader writes entry identities and HMR state; all such writes belong to this test's isolated directory.
const config = join(process.cwd(), 'cordis.yml')
await writeFile(config, await readFile(suppliedConfig))
const root = join(process.cwd(), 'sources')
await mkdir(root)
const original = '# Local source\n\nThe claim holds only at finite N.\n'
await writeFile(join(root, 'note.md'), original)
const ctx = new Context()
const workspaceId = 'loader-workspace' as WorkspaceId
ctx.provide('dshHomePath', (...parts: string[]) => join(process.cwd(), 'host-home', ...parts))
ctx.provide('workspaceRegistry', { get: (id: WorkspaceId) => id === workspaceId ? { path: root } : undefined } as never)
ctx.baseUrl = `${pathToFileURL(dirname(config)).href}/`
function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
try {
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, typert: TypertRegistry, resources: ResearchResources, catalog })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  const service = ctx.get('researchResources')
  if (service === undefined) throw new Error('The actual research-resources service did not activate.')
  if (ctx.get('agents') !== undefined || ctx.get('llm') !== undefined) throw new Error('Source browsing unexpectedly depends on model services.')
  const signal = new AbortController().signal
  const initial = await service.listResources({ domain: 'knowledge' }, signal)
  if (!initial.ok) throw new Error(`Initial catalog failed: ${JSON.stringify({ initial,
    entries: [...ctx.loader.entries()].map(entry => ({ name: entry.options.name, state: entry.fiber?.state })) })}`)
  const before = initial.value
  const item = before.items[0]
  if (item === undefined) throw new Error(`The actual local source was absent from the catalog: ${JSON.stringify({ before, roots: await service.listRoots({}, signal) })}`)
  const reading = value(await service.readResource({ ref: item.ref }, signal))
  const provider = [...ctx.loader.entries()].find(entry => entry.options.name === 'cordis:catalog')
  if (provider?.fiber === undefined) throw new Error('The domain provider has no live Loader fiber.')
  await provider.fiber.dispose()
  const afterDispose = await service.listResources({ domain: 'knowledge' }, signal)
  await ctx.loader.create({ name: 'cordis:catalog' })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  const afterReload = value(await service.listResources({ domain: 'knowledge' }, signal))
  value(await service.connectWorkspace({ workspaceId }, signal))
  const savedRequest = { operationId: 'loader-saved-set', title: 'Original finite-size evidence', selections: [{ ref: item.ref }] }
  const saved = value(await service.saveSourceSet(savedRequest, signal))
  const resources = [...ctx.loader.entries()].find(entry => entry.options.name === 'cordis:resources')
  if (resources?.fiber === undefined) throw new Error('The source service has no live Loader fiber.')
  await resources.fiber.dispose()
  // Restore only the explicit runtime connection; the former configured grant is intentionally absent.
  await ctx.loader.create({ name: 'cordis:resources' })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  const reloaded = ctx.get('researchResources')
  if (reloaded === undefined) throw new Error('The shared source service failed to reload.')
  const persisted = value(await reloaded.getSourceSet({ id: saved.id }, signal))
  const repeatedReceipt = value(await reloaded.saveSourceSet(savedRequest, signal))
  const readingAfterServiceReload = value(await reloaded.readResource({ ref: item.ref }, signal))
  await writeFile('observations.json', JSON.stringify({ before, reading, afterDispose, afterReload,
    persisted, repeatedReceipt, saved, readingAfterServiceReload,
    sourcePreserved: await readFile(join(root, 'note.md'), 'utf8') === original,
    withoutModelServices: ctx.get('agents') === undefined && ctx.get('llm') === undefined }))
} finally { await ctx.fiber.dispose() }
