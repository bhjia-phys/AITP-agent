/** AITP retains documentation and product checks while excluding hash comparisons. */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { aitpDocumentationGates } from './aitp-doc-sync.ts'
import { collectCliHelp, computeCliHelpOutputs } from './gen-cli-help.ts'
import { computeConfigCatalogOutputs } from './gen-config-catalog.ts'
import { gatesForMode } from './run-gates.ts'
import * as pairingRecords from './translation-pairing-record.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('AITP documentation checks', () => {
  it.each(['doc-sync', 'doc-quick'] as const)('retains every non-hash %s gate and its scheduling', (mode) => {
    vi.stubEnv('npm_execpath', '/fixture/pnpm.cjs')
    const upstream = gatesForMode(mode)
    const selected = aitpDocumentationGates(mode)
    const excluded = new Set([
      'translation-pairing', 'archived-agent-notes', 'persistence-catalog',
      'persistence-changes', 'persistence-releases', 'persistence-formats',
    ])
    expect(selected.map(gate => gate.id)).toEqual(upstream.filter(gate => !excluded.has(gate.id)).map(gate => gate.id))
    for (const original of upstream.filter(gate => !excluded.has(gate.id))) {
      const actual = selected.find(gate => gate.id === original.id)
      if (original.id === 'cli-help' || original.id === 'config-catalog') {
        expect(actual).toEqual({
          ...original,
          args: [...original.args, '--without-pairing-record'],
          displayCommand: `${original.displayCommand} --without-pairing-record`,
        })
      } else expect(actual).toEqual(original)
    }
    if (mode === 'doc-sync') expect(selected).toHaveLength(upstream.length - 6)
  })

  it('routes ordinary documentation scripts through the AITP selection', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(manifest.scripts['doc-sync']).toBe('tsx scripts/aitp-doc-sync.ts doc-sync')
    expect(manifest.scripts['test:docs']).toBe('tsx scripts/aitp-doc-sync.ts doc-quick')
  })

  it('retains complete CLI content without computing a pairing record', async () => {
    const compute = vi.spyOn(pairingRecords, 'computeTranslationPairingRecord').mockImplementation(() => {
      throw new Error('Pairing records are disabled')
    })
    const pages = await collectCliHelp(async args => `Usage: dsh ${args.join(' ')}\n\nComplete help text.\n`, ['web'])
    const outputs = computeCliHelpOutputs(pages, { withoutPairingRecord: true })
    expect([...outputs.keys()]).toEqual(['docs/cli-help.md', 'docs/cli-help.zh.md'])
    for (const content of outputs.values()) {
      expect(content).toContain('Complete help text.')
      expect(content).toContain('Usage: dsh --profile web')
    }
    expect(compute).not.toHaveBeenCalled()
  })

  it('retains configuration schema and bilingual content checks without computing a pairing record', () => {
    const compute = vi.spyOn(pairingRecords, 'computeTranslationPairingRecord').mockImplementation(() => {
      throw new Error('Pairing records are disabled')
    })
    const root = mkdtempSync(join(tmpdir(), 'aitp-config-catalog-'))
    onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
    mkdirSync(join(root, 'scripts'), { recursive: true })
    mkdirSync(join(root, 'packages/demo/example/src'), { recursive: true })
    writeFileSync(join(root, 'scripts/translation-pairing.manifest.json'), '{"excluded":[]}\n')
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ include: ['packages/**/*.ts'] }))
    writeFileSync(join(root, 'packages/demo/example/package.json'), JSON.stringify({ name: '@demo/example' }))
    writeFileSync(join(root, 'packages/demo/example/src/index.ts'), 'export function apply(ctx: unknown): void {}\n')
    const outputs = computeConfigCatalogOutputs(root, { withoutPairingRecord: true })
    expect([...outputs.keys()]).toEqual(['docs/config-catalog.md', 'docs/config-catalog.zh.md'])
    for (const content of outputs.values()) expect(content).toContain('@demo/example')
    writeFileSync(join(root, 'packages/demo/example/src/index.ts'), `
import Schema from '@deepseek-ai/schemastery'
export interface Config { known: boolean }
export const Config = Schema.object({ known: Schema.boolean(), undeclared: Schema.string() })
export function apply(ctx: unknown, config: Config): void {}
`)
    expect(() => computeConfigCatalogOutputs(root, { withoutPairingRecord: true }))
      .toThrow("schema validates key 'undeclared'")
    expect(compute).not.toHaveBeenCalled()
  })
})

interface WorkflowJob {
  if?: string
  'runs-on'?: string
  steps?: { name?: string; run?: string }[]
}

describe('AITP CI routing', () => {
  it('keeps the upstream matrix and its original event conditions exclusive to its owning repository', () => {
    const workflow = load(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')) as {
      jobs: Record<string, WorkflowJob>
    }
    expect(Object.keys(workflow.jobs)).toHaveLength(11)
    for (const [id, job] of Object.entries(workflow.jobs)) {
      expect(job.if).toContain("github.repository == 'deepseek-ai/deepseek-harness'")
      expect(job.if).toContain("github.event_name == 'pull_request'")
      if (id === 'all-checks-passed') expect(job.if).toContain('!cancelled()')
    }
  })

  it('keeps complete type programs, keyless GPT, memory, UI and browser checks on hosted AITP CI', () => {
    const workflow = load(readFileSync(new URL('../.github/workflows/aitp-validation.yml', import.meta.url), 'utf8')) as {
      jobs: Record<string, WorkflowJob>
    }
    const job = workflow.jobs['build-and-check']
    expect(job?.['runs-on']).toBe('ubuntu-24.04')
    const commands = job?.steps?.flatMap(step => step.run === undefined ? [] : [step.run]) ?? []
    expect(commands).toContain('pnpm install --frozen-lockfile')
    expect(commands).toContain('pnpm run build:artifacts')
    expect(commands).toContain('node --max-old-space-size=6144 node_modules/typescript/bin/tsc -p tsconfig.host.json')
    expect(commands).toContain('node --max-old-space-size=6144 node_modules/typescript/bin/tsc -p tsconfig.client.json')
    expect(commands).toContain('pnpm run doc-sync')
    const documentation = commands.find(command => command.includes('scripts/translation-pairing.spec.ts'))
    expect(documentation).toContain("-t '^(?!.*translation pairing records)'")
    expect(documentation).toContain('scripts/fork-documentation-scope.spec.ts')
    const memory = commands.find(command => command.includes('packages/research/research-memory/tests'))
    for (const owner of ['backend', 'research', 'session', 'fixtures']) {
      expect(memory).toContain(`packages/client/ui-aitp-${owner}/tests`)
    }
    expect(commands).toContain('pnpm exec playwright install --with-deps chromium')
    const browser = commands.find(command => command.includes('--config vitest.web.config.ts'))
    expect(browser).toContain('apps/web/tests/aitp-memory.e2e.ts')
    expect(browser).toContain('apps/web/tests/aitp-workspace.e2e.ts')
    const gpt = commands.find(command => command.includes('apps/cli/tests/aitp-headless.spec.ts'))
    expect(gpt).toContain('packages/compaction/compaction-basic/tests')
    expect(gpt).toContain('packages/llm/llm-pi-ai/tests/codex-responses.spec.ts')
    expect(gpt).toContain('packages/llm/llm-pi-ai/tests/tool-argument-streaming.spec.ts')
  })
})
