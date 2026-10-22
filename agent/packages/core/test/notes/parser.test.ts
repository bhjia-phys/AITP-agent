import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Outline } from '@aitp/protocol';
import { expect, it } from 'vitest';
import { fixture } from '../locations/support.ts';
import { parseNote } from '../../src/notes/index.ts';
const version = { hash: `sha256:${'0'.repeat(64)}` as const, observedAt: '2026-10-21T00:00:00Z' };

// Independent line scanner establishes full entry boundaries from the source, without parser positions.
function entrySlices(text: string, tex = false) {
  const lines = text.split('\n');
  const begin = lines.findIndex(l => tex ? /\\section\{Current work\}/i.test(l) : /^## Current work\s*$/i.test(l));
  let end = lines.findIndex((l, i) => i > begin && (tex ? /\\section\{/.test(l) : /^## /.test(l)));
  if (end < 0) end = lines.length;
  const starts: number[] = [];
  for (let i = begin + 1; i < end; i++) if (tex ? /^\\item /.test(lines[i]!) : /^- |^### /.test(lines[i]!)) {
    let start = i;
    if (lines[i]!.startsWith('### ')) while (start > begin + 1 && /^<a /.test(lines[start - 1]!)) start--;
    starts.push(start);
  }
  return starts.map((start, i) => { let stop = starts[i + 1] ?? end; while (stop > start && (!lines[stop - 1]!.trim() || tex && /^\\end\{/.test(lines[stop - 1]!))) stop--; return { span: { startLine: start + 1, endLine: stop }, text: lines.slice(start, stop).join('\n') }; });
}
it('asserts every fixture thread projection, complete entry spans and preserved text', async () => {
  const f = await fixture();
  try {
    for (const [path, expected] of Object.entries(f.expected.threads as Record<string, Record<string, any>[]>)) {
      const text = await readFile(join(f.root, path), 'utf8');
      const actual = await f.workspace.outline(path);
      Outline.parse(actual);
      const entries = actual.currentWork!.entries;
      expect(entries, path).toHaveLength(expected.length);
      const slices = entrySlices(text, path.endsWith('.tex'));
      expect(slices, path).toHaveLength(expected.length);
      for (let i = 0; i < expected.length; i++) {
        const e = expected[i]!, a = entries[i]!;
        expect(a.span, `${path} ${a.name}`).toEqual(slices[i]!.span);
        expect(a.text).toBe(slices[i]!.text);
        for (const [key, value] of Object.entries(e)) {
          if (key === 'pointer') { expect(`${a.pointer?.target}${a.pointer?.anchor ? '#' + a.pointer.anchor : ''}`).toBe(value); expect(a.pointer?.resolved).toBe(true); }
          else if (key === 'continuationStartsWith') { if (value === null) expect(a.continuation).toBeUndefined(); else { expect(a.continuation?.value.toLowerCase().startsWith((value as string).toLowerCase())).toBe(true); expect(a.continuation?.extracted?.kind).toBe('suggestion'); expect(a.continuation?.sources[0]?.version).toEqual(actual.version); } }
          else if (key === 'plan') { expect(a.plan?.ref.address).toEqual({ kind: 'workspace', path: value.path }); expect(a.plan?.phases).toHaveLength(value.phases); expect(a.plan?.operative).toBe(value.operative); }
          else expect(a[key as keyof typeof a], `${path} ${key}`).toEqual(value);
        }
      }
      const pure = parseNote(path, text, actual.format, actual.version);
      expect(pure.links.every(l => l.resolved === null && l.anchorOk === undefined)).toBe(true);
      expect(pure.currentWork?.entries.filter(e => e.pointer).every(e => e.pointer?.resolved === null)).toBe(true);
    }
  } finally { await f.cleanup(); }
});
it('handles duplicate slugs, definitions after use, autolinks, math and pointer prose precedence', () => {
  const text = '# Test\nOpening $a_b$.\n\n## Current work\n- **A** — active · 2026-01-01.\n- **A** — paused · 2026-01-02.\n- **A-1** — deferred.\n- **P → [child][c]** — unresolved and waiting on runs.\n\n## Same\n## Same\n[c]: child/research.md#same\n<https://example.invalid>\n';
  const out = parseNote('topics/research.md', text, 'markdown', version);
  expect(out.currentWork?.entries.map(e => e.key)).toEqual(['a', 'a-1', 'a-1-1', 'p']);
  expect(out.currentWork?.entries[3]?.state).toBe('pointer');
  expect(out.currentWork?.entries[3]?.pointer?.resolved).toBeNull();
  expect(out.headings.slice(-2).map(h => h.slug)).toEqual(['same', 'same-1']);
  expect(out.links.map(l => l.target)).toContain('https://example.invalid');
  expect(out.opening.text).toContain('$a_b$');
});
it('never throws on 3500 deterministic random Markdown-like inputs', () => {
  let seed = 78321;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const tokens = ['*', '**', '[x](', ')', '→', '#', '## Current work\n', '- ', '\n', '中文', '\\label{x}', '$\\frac{a}{b}$', '    - ', '<a id="x">', '[x]: x.md', 'Next:', ' — waiting on independent\n analysis', '\\item \\textbf{X}', '`', '~'];
  for (let i = 0; i < 3500; i++) {
    let text = i % 2 ? '# T\n\n## Current work\n' : '';
    const count = 5 + random() % 90;
    for (let j = 0; j < count; j++) text += tokens[random() % tokens.length];
    const out = parseNote('topics/random/research.md', text, i % 11 === 0 ? 'tex' : 'markdown', version);
    expect(() => Outline.parse(out), `sample ${i}`).not.toThrow();
  }
}, 30000);
it('keeps lists inside a heading entry and gives following anchors to the following entry', () => {
  const text = '# T\n\n## Current work\n### One\n**Active · 2026-01-01.**\nCheck the bound.\n- A detail.\n- Another detail.\n\n<a id="two"></a>\n### Two\n**Deferred · 2026-01-02.**\n';
  const out = parseNote('topics/research.md', text, 'markdown', version);
  expect(out.currentWork?.entries.map(e => e.name)).toEqual(['One', 'Two']);
  expect(out.currentWork?.entries[0]?.text).toBe(text.split('\n').slice(3, 8).join('\n'));
  expect(out.currentWork?.entries[0]?.continuation?.value).toBe('Check the bound');
  expect(out.currentWork?.entries[1]?.anchors).toEqual(['two']);
});
it('extracts the first imperative sentence below a heading even without a status line', () => {
  const out = parseNote('topics/research.md', '# T\n\n## Current work\n### Diagnostic\n\nCompare the control and the candidate. Keep the assumptions fixed.\n', 'markdown', version);
  expect(out.currentWork?.entries[0]?.state).toBe('unknown');
  expect(out.currentWork?.entries[0]?.continuation?.value).toBe('Compare the control and the candidate');
});
