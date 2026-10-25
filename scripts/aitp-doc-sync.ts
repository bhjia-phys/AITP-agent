/** Run the upstream documentation gates under the researcher's no-hash policy. */

import { defaultConcurrency, gatesForMode, runAggregate, type Gate } from './run-gates.ts'

type DocumentationMode = 'doc-sync' | 'doc-quick'

const HASH_GATES = new Set([
  'translation-pairing',
  'archived-agent-notes',
  'persistence-catalog',
  'persistence-changes',
  'persistence-releases',
  'persistence-formats',
])

/**
 * Keep the upstream documentation checks while excluding digest comparisons.
 * CLI and configuration catalogs still verify both languages without pairing records.
 * @param mode - Full documentation checks or their existing build-free subset.
 * @returns The selected upstream commands with only hash checks excluded.
 */
export function aitpDocumentationGates(mode: DocumentationMode): Gate[] {
  return gatesForMode(mode).filter(gate => !HASH_GATES.has(gate.id)).map((gate) => {
    if (gate.id !== 'cli-help' && gate.id !== 'config-catalog') return gate
    return {
      ...gate,
      args: [...gate.args, '--without-pairing-record'],
      displayCommand: `${gate.displayCommand} --without-pairing-record`,
    }
  })
}

async function main(args: readonly string[]): Promise<number> {
  const mode = args[0]
  if (args.length !== 1 || mode !== 'doc-sync' && mode !== 'doc-quick') {
    throw new Error('aitp-doc-sync: expected exactly one mode: doc-sync | doc-quick')
  }
  const gates = aitpDocumentationGates(mode)
  return runAggregate(mode, gates, defaultConcurrency(mode, gates.length))
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2))
