// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { brandString } from '@deepseek-ai/dsh-brand'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { ResearchChangeReceipt } from '../src/client/ResearchChangeNotice.tsx'
import { changeEn } from '../src/client/research-change-locales.ts'
import type { ResearchChangeView, ResourceId } from '../src/client/workspace-contract.ts'

afterEach(cleanup)
const receipt: ResearchChangeView = {
  operationId: 'operation', workspaceId: brandString<WorkspaceId>('workspace'), sessionId: brandString<SessionId>('session'),
  state: 'applied', updatedAt: '2026-10-27T03:00:00Z', completeness: 'complete',
  omittedFiles: 0, omittedDiffs: 0, omittedUses: 0, remainingUses: [],
  files: [{ resourceId: brandString<ResourceId>('research'), relativePath: 'branch/research.md', state: 'applied',
    beforeText: 'Old assumption\n', afterText: 'Corrected assumption\n' }],
}

describe('research change receipt', () => {
  it('renders the native before and after diff for confirmed published files', () => {
    render(<ResearchChangeReceipt receipt={receipt} t={makeTranslate(changeEn)} />)
    expect(screen.getByText('Research record updated')).toBeDefined()
    expect(screen.getByText('Confirmed saved change')).toBeDefined()
    expect(screen.getByText(/Old assumption/)).toBeDefined()
    expect(screen.getByText(/Corrected assumption/)).toBeDefined()
  })
  it('does not label uncertain planned output as a saved change, and states omitted data explicitly', () => {
    render(<ResearchChangeReceipt receipt={{ ...receipt, state: 'partial', completeness: 'partial', omittedDiffs: 1,
      files: [{ resourceId: brandString<ResourceId>('research'), relativePath: 'branch/research.md', state: 'unknown',
        current: { state: 'different', observedAt: receipt.updatedAt } }], remainingUses: ['Check the dependent calculation.'],
    }} t={makeTranslate(changeEn)} />)
    expect(screen.getByText('Only part of the change was saved')).toBeDefined()
    expect(screen.queryByText('Confirmed saved change')).toBeNull()
    expect(screen.getByText('Planned changes; publication is not confirmed')).toBeDefined()
    expect(screen.getByText(/complete before and after texts exceed/)).toBeDefined()
    expect(screen.getByText(/1 file diffs/)).toBeDefined()
    expect(screen.getByText(/file has changed since this operation/)).toBeDefined()
    expect(screen.getByText('Check the dependent calculation.')).toBeDefined()
  })
})
