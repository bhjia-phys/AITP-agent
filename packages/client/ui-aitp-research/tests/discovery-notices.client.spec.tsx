// @vitest-environment jsdom
/** Scan diagnostics stay available without replacing the research overview. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh } from '../src/client/locales.ts'
import { ListingStatus, type TopicListing } from '../src/client/TopicListing.tsx'
import { WorkspaceReadingMeta } from '../src/client/WorkspaceViews.tsx'

afterEach(cleanup)

const diagnostics = [
  'workspace: Excluded by the configured discovery policy.',
  'workspace/__pycache__: Excluded by the configured discovery policy.',
  'backup: Excluded by the configured discovery policy.',
  'provenance: Excluded by the configured discovery policy.',
  'shared/reference: Symbolic link skipped.',
  '.: Discovery reached the configured entry limit.',
].join('\n')

for (const [language, copy] of [['English', en], ['Chinese', zh]] as const) {
  const t = makeTranslate(copy) as TranslateNS<'aitp.research'>
  const listing = (overrides: Partial<TopicListing> = {}): TopicListing => ({
    items: [], partial: true, reason: diagnostics, more: undefined, status: 'ready', ...overrides,
  })
  describe(language, () => {
    it('keeps the incomplete state visible and all diagnostics behind a closed native disclosure', () => {
      render(<ListingStatus t={t} listing={listing()} retry={vi.fn()} moreLabel={copy['map.moreTopics']} />)
      expect(screen.getByRole('note').textContent).toBe(copy['workspace.topicsIncomplete'])
      const summary = screen.getByText(copy['workspace.scanDetails'])
      const details = summary.closest('details')!
      expect(details.open).toBe(false)
      expect(screen.getByRole('note').closest('details')).toBeNull()
      expect(details.textContent).toContain(copy['workspace.scanExclusions'])
      expect(details.querySelector('p:last-child')?.textContent).toBe(diagnostics)
      fireEvent.click(summary)
      expect(details.open).toBe(true)
      fireEvent.click(summary)
      expect(details.open).toBe(false)
    })

    it('does not infer incomplete discovery from a diagnostic string or ordinary pagination', () => {
      const { rerender } = render(<ListingStatus t={t} listing={listing({ partial: false })}
        retry={vi.fn()} moreLabel={copy['map.moreTopics']} />)
      expect(screen.queryByText(copy['workspace.topicsIncomplete'])).toBeNull()
      expect(screen.getByText(copy['workspace.scanDetails'])).toBeTruthy()
      const more = vi.fn()
      rerender(<ListingStatus t={t} listing={listing({ reason: undefined, more })}
        retry={vi.fn()} moreLabel={copy['map.moreTopics']} />)
      expect(screen.queryByText(copy['workspace.topicsIncomplete'])).toBeNull()
      expect(screen.queryByText(copy['workspace.scanDetails'])).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: copy['map.moreTopics'] }))
      expect(more).toHaveBeenCalledOnce()
    })

    it('keeps retained-reading failures visible while routine update coverage starts collapsed', () => {
      const retry = vi.fn()
      render(<WorkspaceReadingMeta t={t} stale retry={retry} read={{ origin: 'runtime', provider: {
        capabilities: { read: true, changeEvents: true },
        notice: 'Automatic updates cover discovered folders and opened sources; undiscovered folders require refresh.',
      } }} />)
      const details = screen.getByText(copy['workspace.updateDetails']).closest('details')!
      expect(details.open).toBe(false)
      expect(details.textContent).toContain(copy['workspace.partialUpdates'])
      expect(screen.getByText(copy['workspace.retained'])).toBeTruthy()
      expect(screen.getByRole('button', { name: copy['workspace.retry'] }).closest('details')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: copy['workspace.retry'] }))
      expect(retry).toHaveBeenCalledOnce()
    })
  })
}
