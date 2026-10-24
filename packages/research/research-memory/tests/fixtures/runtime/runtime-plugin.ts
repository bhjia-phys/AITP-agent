/** Test-only source adapter; the runtime registrations are production code. */
import type { Context } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
import { installRuntime } from '../../../src/runtime.ts'
import { createSessionRecovery } from '../../../src/recovery.ts'

export const name = 'research-runtime-fixture'
export const inject = ['tools', 'agents', 'systemPrompt', 'sessionProjections']
export function apply(ctx: Context): void {
  installRuntime(ctx, {
    maxContextCharacters: 12000, maxWorkingItems: 12, maxItemCharacters: 2000,
    maxHumanInputs: 8, maxHumanCharacters: 6000,
  }, async () => ({
    entries: [{ label: 'Scratch source', source: { target: 'research.md' }, text: await readFile('research.md', 'utf8') }],
    omissions: [],
  }), createSessionRecovery(ctx, { maxRecoverySessions: 8, maxRecoveryEvents: 5000, maxRecoveryCharacters: 8000 }))
}
