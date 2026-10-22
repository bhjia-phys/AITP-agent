/** Fork-owned documents stay outside upstream pairing and wrap enforcement without widening the exception. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  isManuallyMaintainedDocument,
  isTranslationPairingManifestExcluded,
  parseTranslationPairingManifest,
  translationPairSourcePredicate,
} from './translation-pairing.ts'

const manifest = parseTranslationPairingManifest(readFileSync(new URL('./translation-pairing.manifest.json', import.meta.url), 'utf8'))

describe('AITP documentation ownership', () => {
  it.each([
    'README.md',
    'README.zh.md',
    'README.i18n.yaml',
    'current.md',
    'docs/agent/10-project-workspace.md',
    'docs/agent/prototype/README.md',
    'agent/notes/integration.md',
    'aitp/plugins/aitp/README.md',
    'packages/client/ui-brand-aitp/README.md',
    'packages/client/ui-brand-aitp/README.zh.md',
    'docs\\agent\\README.md',
  ])('leaves %s to manual review without pairing records', (file) => {
    expect(isManuallyMaintainedDocument(file, manifest)).toBe(true)
    expect(translationPairSourcePredicate(manifest)(file)).toBe(false)
  })

  it.each([
    'docs/architecture.md',
    'docs/agent-guide.md',
    'docs/agent-guide/README.md',
    'agent-other/README.md',
    'aitp-other/README.md',
    'packages/client/ui-brand-official/README.md',
    'packages/client/ui-brand-aitp-other/README.md',
    'packages/client/ui-brand-aitp/other.md',
    'apps/web/README.md',
  ])('keeps the upstream rule for neighboring %s', (file) => {
    expect(isManuallyMaintainedDocument(file, manifest)).toBe(false)
  })

  it('retains existing upstream pairing and generated/instructional exclusions', () => {
    expect(translationPairSourcePredicate(manifest)('docs/architecture.md')).toBe(true)
    expect(translationPairSourcePredicate(manifest)('packages/client/ui-brand-official/README.md')).toBe(true)
    expect(isTranslationPairingManifestExcluded('docs/AGENTS.md', manifest)).toBe(true)
    expect(isManuallyMaintainedDocument('docs/AGENTS.md', manifest)).toBe(false)
  })

  it('rejects malformed manual scope instead of silently changing discovery', () => {
    expect(() => parseTranslationPairingManifest('{"excluded":[],"manual":[42]}')).toThrow('manual must be an array of strings')
    expect(parseTranslationPairingManifest('{"excluded":[]}')).toEqual({ excluded: [] })
  })
})
