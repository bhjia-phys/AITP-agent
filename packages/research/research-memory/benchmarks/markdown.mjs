/** Synthetic source-index timings; creates and removes its own temporary notes. */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { MarkdownWorkspace, topicIdForPath } from '../src/markdown.ts'
const count = Number(process.argv[2])
if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error('Provide a synthetic topic count from 1 to 10000')
if (global.gc === undefined) throw new Error('Run Node with --expose-gc')
const root = await mkdtemp(join(tmpdir(), 'research-perf-'))
try {
  let map = '# Synthetic programme\nA controlled synthetic question.\n## Topics\n'
  for (let index = 0; index < count; index++) {
    const path = `t${index}/research.md`
    map += `[Topic ${index}](${path})\n`
    await mkdir(join(root, `t${index}`))
    await writeFile(join(root, path), `# Topic ${index}\nQuestion ${index}: the conclusion is conditional on the stated setting.\n## Scope\nOnly the synthetic finite control.\n## Current work\nThe previous ansatz failed. Reopen only if the boundary assumption changes.\n`)
  }
  await writeFile(join(root, 'research.md'), map)
  global.gc()
  const initial = process.memoryUsage()
  const workspace = new MarkdownWorkspace({ root, maxFiles: count * 3 + 10, maxFileBytes: 1_000_000, maxContextCharacters: 8000 })
  let reads = 0, bytes = 0
  const read = workspace.readSource.bind(workspace)
  workspace.readSource = async (...args) => {
    const result = await read(...args)
    if (result.ok) { reads++; bytes += Buffer.byteLength(result.value.text) }
    return result
  }
  async function measured() {
    reads = 0; bytes = 0
    const begin = performance.now()
    const result = await workspace.readContext({ topicId: topicIdForPath(`t${count - 1}/research.md`) })
    if (!result.ok) throw new Error(result.error.message)
    const text = result.value.value.entries.map(entry => entry.text).join('\n')
    if (!text.includes(`Question ${count - 1}:`) || !text.includes('previous ansatz failed')) throw new Error('Source recovery failure')
    return { milliseconds: performance.now() - begin, reads, bytes, contextCharacters: JSON.stringify(result.value).length }
  }
  const cold = await measured()
  const afterCold = process.memoryUsage()
  const runs = []
  for (let at = 0; at < 7; at++) runs.push(await measured())
  runs.sort((left, right) => left.milliseconds - right.milliseconds)
  global.gc()
  const retained = process.memoryUsage()
  console.log(JSON.stringify({ node: process.version, topics: count, cold, warmMedian: runs[3], initialRss: initial.rss, afterColdRss: afterCold.rss, retainedRss: retained.rss, initialHeap: initial.heapUsed, retainedHeap: retained.heapUsed, processPeakRssKiB: process.resourceUsage().maxRSS }))
} finally { await rm(root, { recursive: true, force: true }) }
