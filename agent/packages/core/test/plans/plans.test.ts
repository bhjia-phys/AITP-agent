import { expect, it } from 'vitest';
import { parseNote } from '../../src/notes/index.ts';
import { parsePlan } from '../../src/plans/index.ts';
it('recognizes the operative heading or first bold sentence and retains full phases', () => {
  const version = { hash: `sha256:${'0'.repeat(64)}` as const, observedAt: '2026-10-21T00:00:00Z' };
  const text = '# Plan\n\n## One\nDone.\n\n## Operative two\nContinue.\n\n## Three\nDeferred.\n';
  const note = parseNote('plan.md', text, 'markdown', version);
  const plan = parsePlan(note, text, { kind: 'note', address: { kind: 'workspace', path: 'plan.md' }, version });
  expect(plan.operative).toBe(1); expect(plan.phases.map(p => text.split('\n').slice(p.span.startLine - 1, p.span.endLine).join('\n'))).toEqual(['## One\nDone.\n', '## Operative two\nContinue.\n', '## Three\nDeferred.\n']);
});
