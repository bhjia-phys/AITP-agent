// @vitest-environment jsdom
/**
 * Session research-memory views over stubbed resources: without a provider
 * nothing renders and the page says so; the task card keeps the task in one
 * line with counts and the first gap, and expands to the researcher's words
 * and provisional agent notes; the Sources & memory page separates the
 * researcher's instructions, gaps, rules with their adoption, agent notes,
 * sources by availability and generated summaries.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { en } from '../src/client/locales.ts'
import { MemoryPage, MemoryPageTitle, type MemoryPageProps } from '../src/client/MemoryPage.tsx'
import { OriginAction, originText, type OriginActionProps } from '../src/client/OriginAction.tsx'
import { memoryAddress, type SessionMemoryView } from '../src/client/protocol.ts'
import { TaskCard, type TaskCardProps } from '../src/client/TaskCard.tsx'

afterEach(cleanup)

const t = makeTranslate(en) as TranslateNS<'aitp.session'>
const SID = 's1' as SessionId

const MEMORY: SessionMemoryView = {
  origin: 'fixture',
  sessionId: SID,
  sessionOrigin: { kind: 'topic', topic: 'Damped spectra', thread: 'Third system', notePath: 'spectra/research.md' },
  researcher: [
    { id: 'r1', kind: 'task', text: 'Compare both schedules on system C.', turn: 1 },
    { id: 'r2', kind: 'instruction', text: 'Code inspection only.', turn: 9 },
    { id: 'r3', kind: 'choice', text: 'Report both.', question: 'Report or drop?', turn: 12 },
  ],
  agent: [
    { id: 'a1', kind: 'gap', text: 'Residual at stop is step / alpha.', turn: 34, status: 'active' },
    { id: 'a2', kind: 'next-step', text: 'Rerun with a tighter tolerance.', turn: 7, status: 'superseded' },
  ],
  gaps: [
    { id: 'g1', text: 'basis-convergence.md is missing.', requirement: 'optional', effect: 'Not needed for this comparison.' },
    { id: 'g2', text: 'Reference energies unknown.', requirement: 'owner' },
  ],
  sources: [
    { id: 'x1', label: 'research.md', range: 'L19–22', address: 'dsh-resource://aitp-note/workspace/w/note/research.md', reason: 'selected', requirement: 'researcher', state: { kind: 'available', sentTurn: 32 } },
    { id: 'x2', label: 'opening', reason: 'owner', requirement: 'owner', state: { kind: 'condensed', sentTurn: 2, rereadTurn: 32 } },
    { id: 'x3', label: 'out.log', reason: 'linked', requirement: 'owner', state: { kind: 'condensed', sentTurn: 6 } },
    { id: 'x4', label: 'basis.md', reason: 'linked', requirement: 'optional', state: { kind: 'missing', reason: 'file not found' } },
    { id: 'x5', label: 'Paper A', reason: 'linked', requirement: 'optional', state: { kind: 'located' } },
    { id: 'x6', label: 'mixing.py', reason: 'agent-read', requirement: 'agent', state: { kind: 'attached' } },
    { id: 'x7', label: 'wiki', reason: 'linked', requirement: 'optional', state: { kind: 'pointer' } },
  ],
  rules: [
    { id: 'u1', text: 'Derivation before interpretation.', source: 'Your rule · this topic', adoption: { kind: 'used', turn: 34 } },
    { id: 'u2', text: 'State units.', source: 'Your rule · global', adoption: { kind: 'saved-not-used' } },
    { id: 'u3', text: 'AITP research cycle.', source: 'AITP Skill', adoption: { kind: 'condensed', loadedTurn: 1 } },
  ],
  summaries: [{ id: 'm1', turn: 18, covers: [1, 17] }, { id: 'm2', turn: 31, covers: [18, 30] }],
}

const EMPTY: SessionMemoryView = { origin: 'runtime', sessionId: SID, researcher: [], agent: [], gaps: [], sources: [], rules: [], summaries: [] }

const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }
const live = (value: SessionMemoryView): ResourceSnapshot<SessionMemoryView> => ({ status: 'live', value, failure: undefined })
const failed = (value?: SessionMemoryView): ResourceSnapshot<SessionMemoryView> => ({
  status: 'failed', value, failure: new RemoteError('aitp/stale' as 'aitp/note-missing', 'stale', { path: '' }),
})

/**
 * Slot runtime shared by the three views: copy, the Session, and the memory resource.
 * @param snapshot - what `aitp-session` reads for the Session.
 * @returns the shared props.
 */
function shared(snapshot: ResourceSnapshot<unknown>) {
  return { t, sessionId: SID, useResource: (address: string) => (address === memoryAddress(SID) ? snapshot : none) }
}

type Snapshot = ResourceSnapshot<unknown>
const taskProps = (snapshot: Snapshot, openMemory = vi.fn()) => ({ ...shared(snapshot), openMemory, openNote: vi.fn() }) as TaskCardProps
const originProps = (snapshot: Snapshot, openMemory = vi.fn()) =>
  ({ ...shared(snapshot), openMemory, openNote: vi.fn() }) as OriginActionProps
const pageProps = (snapshot: ResourceSnapshot<unknown>, openNote = vi.fn()) => ({ ...shared(snapshot), openNote }) as MemoryPageProps

describe('task card', () => {
  it('renders nothing without a provider or while loading', () => {
    const { container } = render(<TaskCard {...taskProps(none)} />)
    expect(container.innerHTML).toBe('')
    const whileLoading = render(<TaskCard {...taskProps({ status: 'loading', value: undefined, failure: undefined })} />)
    expect(whileLoading.container.innerHTML).toBe('')
  })

  it('reports a failed first read in place', () => {
    render(<TaskCard {...taskProps(failed())} />)
    expect(screen.getByRole('status').textContent).toBe('Couldn’t read this Session’s research memory (aitp/stale).')
  })

  it('keeps the task in one line with counts, the first gap and summaries, labelled as fixture data', () => {
    render(<TaskCard {...taskProps(live(MEMORY))} />)
    const card = screen.getByRole('region', { name: 'Task' })
    expect(within(card).getByText('Fixture data, not this Session’s record')).toBeDefined()
    expect(within(card).getByText('Compare both schedules on system C.')).toBeDefined()
    expect(within(card).getByText('2 from you')).toBeDefined()
    expect(within(card).getByText('1 provisional note')).toBeDefined()
    expect(within(card).getByText('Gap: basis-convergence.md is missing.')).toBeDefined()
    expect(within(card).getByText('Rule saved, not yet used')).toBeDefined()
    expect(within(card).getByText('2 generated summaries')).toBeDefined()
  })

  it('expands to the researcher’s words, active agent notes and gaps, and opens the full page', () => {
    const openMemory = vi.fn()
    render(<TaskCard {...taskProps(live(MEMORY), openMemory)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Asked: Report or drop?')).toBeDefined()
    expect(screen.getByText('Agent · provisional · Gap · Turn 34')).toBeDefined()
    expect(screen.queryByText('Rerun with a tighter tolerance.')).toBeNull()
    expect(screen.getByText('Gap · Optional background')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Open sources and memory' }))
    expect(openMemory).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(screen.queryByText('Asked: Report or drop?')).toBeNull()
  })

  it('says when no task statement is recorded and uses singular and plural counts', () => {
    const memory: SessionMemoryView = {
      ...EMPTY,
      researcher: [{ id: 'r', kind: 'instruction', text: 'Only analytic work.', turn: 2 }],
      agent: [
        { id: 'a', kind: 'method-use', text: 'Used residual-diagnostics.', turn: 3, status: 'active' },
        { id: 'b', kind: 'pending-integration', text: 'Result awaits the note.', turn: 4, status: 'active' },
      ],
      summaries: [{ id: 'm', turn: 9, covers: [1, 8] }],
    }
    render(<TaskCard {...taskProps(live(memory))} />)
    expect(screen.getByText('No task statement recorded')).toBeDefined()
    expect(screen.getByText('1 from you')).toBeDefined()
    expect(screen.getByText('2 provisional notes')).toBeDefined()
    expect(screen.getByText('1 generated summary')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.queryByText(/^Gap ·/u)).toBeNull()
  })

  it('omits the facts line and the agent section when there is nothing to count', () => {
    render(<TaskCard {...taskProps(failed({ ...EMPTY, researcher: [MEMORY.researcher[0]!] }))} />)
    expect(screen.queryByText(/from you/u)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.queryByText(/^Agent ·/u)).toBeNull()
  })
})

describe('header action', () => {
  it('renders nothing without a provider', () => {
    const { container } = render(<OriginAction {...originProps(none)} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows where the Session started and opens Sources & memory', () => {
    const openMemory = vi.fn()
    render(<OriginAction {...originProps(live(MEMORY), openMemory)} />)
    expect(screen.getByText('Damped spectra › Third system').getAttribute('title')).toBe('Started from: Damped spectra › Third system')
    fireEvent.click(screen.getByRole('button', { name: 'Sources & memory' }))
    expect(openMemory).toHaveBeenCalledOnce()
  })

  it('offers the page alone while the memory is loading or has no recorded origin', () => {
    render(<OriginAction {...originProps({ status: 'loading', value: undefined, failure: undefined })} />)
    expect(screen.getByRole('button', { name: 'Sources & memory' })).toBeDefined()
    expect(screen.queryByText(/Started from/u)).toBeNull()
  })

  it('words each kind of origin', () => {
    expect(originText(t, { kind: 'topic', topic: 'A', notePath: 'a.md' })).toBe('A')
    expect(originText(t, { kind: 'source', label: 'Paper A, Eq. 7' })).toBe('Paper A, Eq. 7')
    expect(originText(t, { kind: 'global' })).toBe('Global')
  })
})

describe('Sources & memory page', () => {
  const page = (snapshot: ResourceSnapshot<unknown>, openNote = vi.fn()) => {
    render(<MemoryPage {...pageProps(snapshot, openNote)} />)
    return openNote
  }

  it('says the memory is not connected, is loading, or could not be read', () => {
    page(none)
    expect(screen.getByText(/^Research memory is not connected for this Session\./u)).toBeDefined()
    cleanup()
    page({ status: 'loading', value: undefined, failure: undefined })
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined()
    cleanup()
    page(failed())
    expect(screen.getByText('Couldn’t read this Session’s research memory (aitp/stale).')).toBeDefined()
  })

  it('separates source attribution categories and keeps sources’ availability distinct', () => {
    const openNote = page(live(MEMORY))
    expect(screen.getByText('Synthetic fixture data for interface development — not this Session’s record.')).toBeDefined()
    expect(screen.getByText('1 in context now · 2 condensed · 1 missing')).toBeDefined()
    expect(screen.getByText('Not needed for this comparison.')).toBeDefined()
    expect(screen.getByText('Work that does not depend on it continues.')).toBeDefined()
    expect(screen.getByText('Used by the request at turn 34')).toBeDefined()
    expect(screen.getByText('Saved · not yet used by this Session')).toBeDefined()
    expect(screen.getByText('Loaded at turn 1 · condensed since')).toBeDefined()
    expect(screen.getByText('Agent · provisional · Next step · Turn 7 · Superseded')).toBeDefined()
    expect(screen.getByText('In context now · sent at turn 32 · Required by you · you selected it')).toBeDefined()
    expect(screen.getByText('Condensed after turn 2 · read again at turn 32 · Required by the note · owning note of the task')).toBeDefined()
    expect(screen.getByText('Condensed since turn 6 · Required by the note · linked from the note')).toBeDefined()
    expect(screen.getByText('Missing — file not found · Optional background · linked from the note')).toBeDefined()
    expect(screen.getByText('Found, not read · Optional background · linked from the note')).toBeDefined()
    expect(screen.getByText('Attached, not sent · Agent says needed · the agent read it')).toBeDefined()
    expect(screen.getByText('Link only, not read · Optional background · linked from the note')).toBeDefined()
    expect(screen.getByText('Generated at turn 31 from turns 18–30')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(openNote).toHaveBeenCalledWith('dsh-resource://aitp-note/workspace/w/note/research.md')
  })

  it('keeps the last read beside a later failure and says when nothing is recorded', () => {
    page(failed(EMPTY))
    expect(screen.getByText('Couldn’t read this Session’s research memory (aitp/stale).')).toBeDefined()
    expect(screen.getByText('Nothing is recorded for this Session yet.')).toBeDefined()
    expect(screen.queryByText(/in context now/u)).toBeNull()
    expect(screen.queryByText('Synthetic fixture data for interface development — not this Session’s record.')).toBeNull()
  })

  it('titles the dock tab', () => {
    const props = { t } as Parameters<typeof MemoryPageTitle>[0]
    render(<MemoryPageTitle {...props} />)
    expect(screen.getByText('Sources & memory')).toBeDefined()
  })
})
