// @vitest-environment jsdom
/**
 * Research views over stubbed resources: every panel state is honest about
 * what is missing; a topic home shows verbatim passages with their locators,
 * continues recorded Sessions and drafts new ones; the reader keeps retained
 * content beside a failure; navigation returns through Back; the dock tab
 * reads its own address.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { en, zh } from '../src/client/locales.ts'
import { NoteReader } from '../src/client/NoteReader.tsx'
import { NoteTabBody, NoteTabTitle, type NoteTabBodyProps } from '../src/client/NoteTab.tsx'
import { noteAddress, type NoteView, type TopicIndexView } from '../src/client/protocol.ts'
import { ResearchPanelIcon } from '../src/client/ResearchPanelIcon.tsx'
import { TopicHome, type TopicHomeActions } from '../src/client/TopicHome.tsx'
import { TopicNavigator } from '../src/client/TopicNavigator.tsx'
import { WorkStateLabel } from '../src/client/WorkspaceViews.tsx'
import { BARE, HOME, INDEX, NOTE, WS } from './data.client.ts'

afterEach(cleanup)

const t = makeTranslate(en) as TranslateNS<'aitp.research'>
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }
const loading: ResourceSnapshot<never> = { status: 'loading', value: undefined, failure: undefined }
const live = <V,>(value: V): ResourceSnapshot<V> => ({ status: 'live', value, failure: undefined })
const failed = <V,>(code: string, value?: V, message = 'read failed'): ResourceSnapshot<V> => ({
  status: 'failed', value, failure: new RemoteError(code as 'aitp/note-missing', message, { path: 'x' }),
})

it.each([
  { language: 'English', dictionary: en, missing: 'Status not recorded' },
  { language: 'Chinese', dictionary: zh, missing: '未记录状态' },
])('localizes an empty work label in $language and preserves authored labels verbatim', ({ dictionary, missing }) => {
  const translate = makeTranslate(dictionary) as TranslateNS<'aitp.research'>
  const view = render(<WorkStateLabel t={translate} work={{ state: 'unknown', label: '' }} />)
  expect(screen.getByText(missing)).toBeDefined()
  const authored = 'Awaiting N → ∞ comparison; the finite-size conclusion remains conditional.'
  view.rerender(<WorkStateLabel t={translate} work={{ state: 'unknown', label: authored }} />)
  expect(screen.getByText(authored).textContent).toBe(authored)
  expect(screen.queryByText(missing)).toBeNull()
})

describe('Topic home', () => {
  function home(topic = HOME, sessionTitle: (id: SessionId) => string | undefined = () => undefined) {
    const actions: TopicHomeActions = { openSource: vi.fn(), openSession: vi.fn(), startWork: vi.fn() }
    render(<TopicHome t={t} topic={topic} sessionTitle={sessionTitle} actions={actions} />)
    return actions
  }

  it('labels fixture data and quotes the opening passages with their source lines', () => {
    const actions = home()
    expect(screen.getByRole('note').textContent).toBe('Synthetic fixture data for interface development — not read from your notes.')
    expect(screen.getByText('Topic · spectra/research.md')).toBeDefined()
    expect(screen.getByText('Current answer, as written')).toBeDefined()
    expect(screen.getByText('research.md · L11')).toBeDefined()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open in note' })[1]!)
    expect(actions.openSource).toHaveBeenCalledWith({ path: 'spectra/research.md', lines: [6, 9] })
  })

  it('shows what waits for the researcher, with the decider and the Session to answer in', () => {
    const actions = home()
    expect(screen.getByText('Decided by the researcher')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Answer in session' }))
    expect(actions.openSession).toHaveBeenCalledWith('s-root')
    expect(screen.getByText('Norm choice')).toBeDefined()
  })

  it('shows current work with its clause, failed routes, branches, ordered materials and Sessions', () => {
    const actions = home(HOME, id => (id === 's-basis' ? 'Basis run' : undefined))
    expect(screen.getByText('Basis run')).toBeDefined()
    expect(screen.getByText('Next:')).toBeDefined()
    expect(screen.getByText('No recorded next step')).toBeDefined()
    expect(screen.getByText('Anderson mixing diverged.')).toBeDefined()
    expect(screen.getByText('Boundary')).toBeDefined()
    expect(screen.getAllByText(/^(Paper|Method)$/u).map(node => node.textContent)).toEqual(['Paper', 'Method'])
    expect(screen.getByText('Session unavailable')).toBeDefined()
    const sessions = screen.getByText('Sessions on this topic').closest('section')!
    fireEvent.click(within(sessions).getAllByRole('button', { name: 'Continue' })[1]!)
    expect(actions.openSession).toHaveBeenCalledWith('s-gone')
    const basis = screen.getByText('Basis').closest('li')!
    fireEvent.click(within(basis).getByRole('button', { name: 'Continue' }))
    expect(actions.openSession).toHaveBeenCalledWith('s-basis')
  })

  it('starts work on the main note when no thread has a Session, and shows a raw opening as written', () => {
    const actions = home(BARE)
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByText('Source opening')).toBeDefined()
    expect(screen.getByText('Session origins are not recorded yet, so sessions cannot be matched to this topic.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Start work' }))
    expect(actions.startWork).toHaveBeenCalledWith({ path: 'spectra/research.md' })
    fireEvent.click(screen.getByRole('button', { name: 'Open main note' }))
    expect(actions.openSource).toHaveBeenCalledWith({ path: 'spectra/research.md' })
  })

  it('says when recorded origins name no Session, and shows parsed openings with parts missing', () => {
    home({
      ...BARE,
      opening: { kind: 'parsed' },
      sessions: { kind: 'recorded', ids: [] },
      threads: [{ title: 'Plain thread', disposition: 'open', locator: { path: 'x.md' }, sessionIds: [] }],
      failedRoutes: [{ text: 'A route without lines.', locator: { path: 'x.md' } }],
    })
    expect(screen.getByText('Plain thread')).toBeDefined()
    expect(screen.getByText('A route without lines.')).toBeDefined()
    expect(screen.getByText('No session has started from this topic.')).toBeDefined()
    expect(screen.queryByText('Question')).toBeNull()
  })
})

describe('Topic navigator', () => {
  it('omits the root entry without a root note and marks no topic while the root is shown', () => {
    const onTopic = vi.fn()
    const index: TopicIndexView = { ...INDEX, root: { kind: 'none' }, unmapped: 1 }
    render(<TopicNavigator t={t} index={index} selectedTopicId="spectra" rootSelected onTopic={onTopic} onRoot={vi.fn()} />)
    expect(screen.queryByText('Root note')).toBeNull()
    expect(screen.getByText('1 unlinked note')).toBeDefined()
    expect(screen.getByRole('button', { name: /Damped spectra/ }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByText('Learning story · reading')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Chain diagnostics/ }))
    expect(onTopic).toHaveBeenCalledWith('chain')
  })

  it('omits the unlinked count when every note is linked', () => {
    const index = { ...INDEX, unmapped: 0 }
    render(<TopicNavigator t={t} index={index} selectedTopicId={null} rootSelected={false} onTopic={vi.fn()} onRoot={vi.fn()} />)
    expect(screen.queryByText(/unlinked/u)).toBeNull()
  })
})

describe('Note reader', () => {
  const show = (note: ResourceSnapshot<typeof NOTE>, extra: { onBack?: () => void; onWork?: () => void } = {}) =>
    render(<NoteReader t={t} note={note} path="spectra/research.md" placement="panel" {...extra} />)

  it('shows each empty state without inventing content', () => {
    show(none)
    expect(screen.getByText('Research notes are not connected')).toBeDefined()
    cleanup()
    show(loading)
    expect(screen.getByRole('status')).toBeDefined()
    cleanup()
    show(failed<NoteView>('aitp/note-missing'))
    expect(screen.getByText('This note is no longer at spectra/research.md.')).toBeDefined()
    cleanup()
    show(failed<NoteView>('aitp/other', undefined, 'permission denied'))
    expect(screen.getByText('permission denied')).toBeDefined()
  })

  it('renders the note verbatim with its fixture label, path and reading time', () => {
    const onBack = vi.fn(), onWork = vi.fn()
    show(live(NOTE), { onBack, onWork })
    expect(screen.getByRole('note').textContent).toBe('Synthetic fixture data for interface development — not read from your notes.')
    expect(screen.getByRole('heading', { name: 'Damped spectra' })).toBeDefined()
    expect(screen.getByText(/^Current file, read /u)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Work on this note' }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onWork).toHaveBeenCalledOnce()
  })

  it('keeps the last version beside a later failure', () => {
    show(failed('aitp/note-missing', { ...NOTE, origin: 'runtime' }))
    expect(screen.getByRole('note').textContent).toBe('This note is no longer at spectra/research.md.')
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    cleanup()
    show(failed('aitp/stale', { ...NOTE, origin: 'runtime' }))
    expect(screen.getByRole('note').textContent).toBe('Showing the last version read. Reading again failed (aitp/stale).')
  })
})

describe('Note dock tab and sidebar icon', () => {
  it('reads the note named by the tab address and titles the chip', () => {
    const address = noteAddress(WS, 'spectra/research.md')
    const useTabInfo = () => ({ tab: { contentId: address, title: 'research.md' } })
    const props = { t, useTabInfo, useResource: (requested: string) => (requested === address ? live(NOTE) : none) } as NoteTabBodyProps
    render(<NoteTabBody {...props} />)
    expect(screen.getByText('spectra/research.md', { selector: 'p' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    cleanup()
    const titleProps = { useTabInfo } as Parameters<typeof NoteTabTitle>[0]
    render(<NoteTabTitle {...titleProps} />)
    expect(screen.getByText('research.md')).toBeDefined()
  })

  it('falls back to the raw address for a foreign tab content id', () => {
    const useTabInfo = () => ({ tab: { contentId: 'elsewhere', title: 'x' } })
    const props = { t, useTabInfo, useResource: () => failed('aitp/note-missing') } as NoteTabBodyProps
    render(<NoteTabBody {...props} />)
    expect(screen.getByText('This note is no longer at elsewhere.')).toBeDefined()
  })

  it('draws the research glyph at the requested size', () => {
    const props = { size: 18 } as Parameters<typeof ResearchPanelIcon>[0]
    const { container } = render(<ResearchPanelIcon {...props} />)
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('18')
  })
})
