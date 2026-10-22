import { expect, it } from 'vitest';
import { sourceLink } from './source-link.ts';

it('opens model workspace citations alongside ordinary relative note links', () => {
  const from = 'topics/example/research.md';
  expect(sourceLink('topics/research.md#direction', from)).toEqual({ path: 'topics/research.md', anchor: 'direction' });
  expect(sourceLink('../research.md#direction', from)).toEqual({ path: 'topics/research.md', anchor: 'direction' });
  expect(sourceLink('notes/argument.md', from)).toEqual({ path: 'topics/example/notes/argument.md', anchor: '' });
  expect(sourceLink('#current-work', from)).toEqual({ path: from, anchor: 'current-work' });
  expect(sourceLink('/home/example/notes.md', from)).toEqual({ path: '/home/example/notes.md', anchor: '' });
});
