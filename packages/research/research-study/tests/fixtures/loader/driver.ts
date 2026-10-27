/** Real Loader lifecycle and restart over plugin-owned draft state and unchanged scientific sources. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import * as Include from '@deepseek-ai/cordis-plugin-include'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import ResearchResources from '@deepseek-ai/dsh-research-resources'
import * as knowledge from '@deepseek-ai/dsh-research-knowledge'
import * as literature from '@deepseek-ai/dsh-research-literature'
import * as code from '@deepseek-ai/dsh-research-code'
import ResearchStudy from '../../../src/index.ts'
import type { StudyArtifactReceipt, StudyResult } from '../../../src/types.ts'

const input = process.argv[2]
if (input === undefined) throw new Error('The study Loader fixture needs its configuration path.')
const cwd = process.cwd(), config = join(cwd, 'study.cordis.yml'), home = join(cwd, 'host-home')
await writeFile(config, await readFile(input))
const scientific = join(cwd, 'scientific'), papers = join(cwd, 'papers'), checkout = join(cwd, 'checkout')
await Promise.all([mkdir(scientific), mkdir(papers), mkdir(checkout)])
const index = '# Knowledge\n\n[Existing note](explanation.md)\n', explanation = '# Explanation\n\nOnly under A.\n'
const tex = '\\documentclass{article}\n\\begin{document}Original source\\end{document}\n'
const source = 'def condition():\n    return "original"\n'
await Promise.all([writeFile(join(scientific, 'index.md'), index), writeFile(join(scientific, 'explanation.md'), explanation),
  writeFile(join(papers, 'paper.tex'), tex), writeFile(join(checkout, 'model.py'), source)])
function value<T>(result: StudyResult<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value }
async function boot() {
  const ctx = new Context()
  ctx.provide('dshHomePath', (...parts: string[]) => join(home, ...parts))
  ctx.baseUrl = `${pathToFileURL(dirname(config)).href}/`
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, typert: TypertRegistry, resources: ResearchResources,
    knowledge, literature, code, study: ResearchStudy })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  const service = ctx.get('researchStudy'), resources = ctx.get('researchResources')
  if (service === undefined || resources === undefined) throw new Error('The real study/source services did not activate.')
  await service.getSetup()
  return { ctx, service, resources }
}
const signal = new AbortController().signal
const first = await boot()
let receipt: StudyArtifactReceipt
let lifecycle: { withdrawn: boolean; peersReadable: boolean }
const request = { operationId: 'stable-note', title: 'Original question', kind: 'note' as const, markdown: 'This draft has not become a knowledge atom.' }
try {
  receipt = value(await first.service.saveNote(request))
  const artifact = value(await first.service.getArtifact({ id: receipt.id }))
  const sourceReference = artifact.source
  if (sourceReference === undefined) throw new Error('The optional synthetic draft source did not register.')
  const reading = await first.resources.readResource({ ref: sourceReference.ref }, signal)
  if (!reading.ok || reading.value.body.kind !== 'text' || !reading.value.body.text.includes(request.markdown)) throw new Error('The saved draft could not be reread as a source.')
  const study = [...first.ctx.loader.entries()].find(entry => entry.options.name === 'cordis:study')
  if (study?.fiber === undefined) throw new Error('The study plugin has no real Loader fiber.')
  await study.fiber.dispose()
  const withdrawn = await first.resources.readResource({ ref: sourceReference.ref }, signal)
  const peers = await Promise.all((['knowledge', 'literature', 'code'] as const).map(domain => first.resources.listResources({ domain }, signal)))
  lifecycle = { withdrawn: !withdrawn.ok, peersReadable: peers.every(page => page.ok && page.value.items.length > 0) }
} finally { await first.ctx.fiber.dispose() }
// A disposed Loader fiber writes disabled:true only into this temporary copy.
await writeFile(config, await readFile(input))
const second = await boot()
try {
  const restored = value(await second.service.getArtifact({ id: receipt.id }))
  const retry = value(await second.service.saveNote(request))
  await writeFile(join(cwd, 'study-observations.json'), JSON.stringify({ lifecycle, receipt, retry, restored,
    pluginSourceDirectory: await readdir(join(home, 'research-study/sources')),
    roots: await second.resources.listRoots({}, signal),
    noModelServices: second.ctx.get('llm') === undefined && second.ctx.get('agents') === undefined,
    scientificUnchanged: await readFile(join(scientific, 'index.md'), 'utf8') === index
      && await readFile(join(scientific, 'explanation.md'), 'utf8') === explanation
      && await readFile(join(papers, 'paper.tex'), 'utf8') === tex
      && await readFile(join(checkout, 'model.py'), 'utf8') === source
      && (await readdir(scientific)).sort().join(',') === 'explanation.md,index.md',
  }))
} finally { await second.ctx.fiber.dispose() }
