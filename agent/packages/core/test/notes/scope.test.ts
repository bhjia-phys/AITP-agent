import { expect, it } from 'vitest';
import { parseNote } from '../../src/notes/index.ts';

it.each([
  'The study is analytic-only.',
  'This route is purely analytic.',
  'Analytical work only for this task.',
  'The scope excludes numerical calculations.',
  'No numerical solving or arithmetic verification is allowed.',
])('retains an explicit analytic restriction: %s', scope => {
  const text = `# Example\n\n${scope}\n\n## Current work\n- **Proof** — active.\n`;
  const outline = parseNote('topics/example/research.md', text, 'markdown', { hash: `sha256:${'a'.repeat(64)}`, observedAt: '2026-10-21T00:00:00Z' });
  expect(outline.scope.some(flag => flag.flag === 'analyticOnly' && !flag.thread)).toBe(true);
});

it('does not infer a location restriction from a discussion of numerical methods', () => {
  const outline = parseNote('topics/example/research.md', '# Example\n\nAnalytic and numerical methods are compared.\n\n## Current work\n- **Check** — active.', 'markdown', { hash: `sha256:${'a'.repeat(64)}`, observedAt: '2026-10-21T00:00:00Z' });
  expect(outline.scope).toEqual([]);
});
