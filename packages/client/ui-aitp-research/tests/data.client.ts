/** Small research views for the component specs; every value is synthetic. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { NoteView, TopicHomeView, TopicIndexView } from '../src/client/protocol.ts'

export const WS = 'w1' as WorkspaceId
export const OBSERVED = '2026-10-22T10:31:00.000Z'

export const INDEX: TopicIndexView = {
  origin: 'runtime',
  observedAt: OBSERVED,
  root: { kind: 'note', path: 'research.md' },
  topics: [
    { id: 'spectra', title: 'Damped spectra', kind: 'topic', notePath: 'spectra/research.md', disposition: 'active', waiting: 1 },
    { id: 'chain', title: 'Chain diagnostics', kind: 'family', notePath: 'chain/research.md', waiting: 2 },
    { id: 'algebras', title: 'Operator algebras', kind: 'learning', notePath: 'learning/research.md', disposition: 'reading', waiting: 0 },
  ],
  unmapped: 2,
}

export const HOME: TopicHomeView = {
  origin: 'fixture',
  id: 'spectra',
  title: 'Damped spectra',
  kind: 'topic',
  notePath: 'spectra/research.md',
  observedAt: OBSERVED,
  opening: {
    kind: 'parsed',
    question: { text: 'Does damping reach the fixed point?', locator: { path: 'spectra/research.md', lines: [3, 4] } },
    answer: { text: 'Only for systems A and B.', locator: { path: 'spectra/research.md', lines: [6, 9] } },
    gap: { text: 'System C residual is unevaluated.', locator: { path: 'spectra/research.md', lines: [11, 11] } },
  },
  pending: [
    {
      title: 'Root selection',
      passage: { text: 'Overlap or energy window.', locator: { path: 'spectra/research.md', anchor: 'root' } },
      decider: 'the researcher',
      sessionId: 's-root' as SessionId,
    },
    { title: 'Norm choice', passage: { text: 'Euclidean or max norm.', locator: { path: 'spectra/research.md', lines: [20, 21] } } },
  ],
  threads: [
    { title: 'Third system', disposition: 'active', clause: { kind: 'next', text: 'evaluate the residual' }, locator: { path: 'spectra/research.md', anchor: 'third' }, sessionIds: [] },
    { title: 'Basis', disposition: 'paused', locator: { path: 'spectra/research.md', lines: [30, 32] }, sessionIds: ['s-old' as SessionId, 's-basis' as SessionId] },
  ],
  failedRoutes: [{ text: 'Anderson mixing diverged.', locator: { path: 'spectra/research.md', lines: [41, 42] } }],
  branches: [{ title: 'Boundary', passage: { text: 'Supplies the boundary condition.', locator: { path: 'spectra/boundary/research.md' } }, notePath: 'spectra/boundary/research.md' }],
  materials: [
    { kind: 'method', title: 'residual-diagnostics', reason: 'listed in the README' },
    { kind: 'paper', title: 'Paper A', reason: 'cited in the answer' },
  ],
  sessions: { kind: 'recorded', ids: ['s-basis' as SessionId, 's-gone' as SessionId] },
}

/** A topic home with a raw opening and no optional sections. */
export const BARE: TopicHomeView = {
  ...HOME,
  origin: 'runtime',
  opening: { kind: 'raw', passage: { text: 'Unstructured opening.', locator: { path: 'spectra/research.md' } } },
  pending: [],
  threads: [],
  failedRoutes: [],
  branches: [],
  materials: [],
  sessions: { kind: 'unrecorded' },
}

export const NOTE: NoteView = {
  origin: 'fixture',
  path: 'spectra/research.md',
  title: 'Damped spectra',
  markdown: '# Damped spectra\n\nThe residual $r_k$ decides.',
  observedAt: OBSERVED,
}
