import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Markdown from './Markdown.tsx';

afterEach(cleanup);
it('opens a citation to the current main note from a topic or conversation view', () => {
  const open = vi.fn();
  render(<Markdown text="[Source](topics/example/research.md)" path="topics/example/research.md" open={open} />);
  fireEvent.click(screen.getByRole('link', { name: 'Source' }));
  expect(open).toHaveBeenCalledWith('topics/example/research.md');
});
