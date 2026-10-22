import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InstructionSource } from '@aitp/protocol';
import { expect, it } from 'vitest';
import { fixture } from '../locations/support.ts';
it('resolves every instruction projection in fixed order with exact source passages', async () => {
  const f = await fixture();
  try {
    for (const [target, expected] of Object.entries(f.expected.instructions as Record<string, { kind: string; path: string; heading?: string }[]>)) {
      const code = target.startsWith('code:');
      const result = await f.workspace.instructions(code ? { checkout: { id: 'demo', address: { kind: 'workspace', path: target.slice(5) } } } : { location: target });
      expect(result.map(r => ({ kind: r.kind, path: 'path' in r.ref.address ? r.ref.address.path : '' }))).toEqual(expected.map(e => ({ kind: e.kind, path: e.path })));
      for (const [i, source] of result.entries()) {
        InstructionSource.parse(source);
        const original = await readFile(join(f.root, expected[i]!.path), 'utf8');
        const loc = source.ref.locator;
        expect(loc?.kind).toBe('lines');
        if (loc?.kind !== 'lines') throw new Error('missing source span');
        expect(source.text).toBe(original.split('\n').slice(loc.start - 1, loc.end).join('\n'));
        if (expected[i]?.heading) { const line = original.split('\n').slice(0, loc.start).reverse().find(l => /^## /.test(l)); expect(line?.slice(3)).toBe(expected[i]!.heading); }
      }
    }
    const both = await f.workspace.instructions({ location: 'topics/spectra/selfconsistent/research.md', checkout: { id: 'demo', address: { kind: 'absolute', path: f.checkout } } });
    expect(both.map(s => s.kind)).toEqual(['workspace', 'family-readme', 'root-agreement', 'repository', 'method-guidance']);
  } finally { await f.cleanup(); }
});
