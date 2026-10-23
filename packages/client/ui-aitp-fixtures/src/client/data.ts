/**
 * Synthetic research workspace for interface development. Every topic, note,
 * number and Session item here is invented; values carry `origin: 'fixture'`
 * so the views label them. Nothing is read from disk or a model.
 */
import type { NoteView, TopicHomeView, TopicIndexView } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type { SessionMemoryView } from '@deepseek-ai/dsh-client-ui-aitp-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Fixed observation instant so screenshots stay stable. */
export const OBSERVED_AT = '2026-10-22T10:31:00.000Z'

const MAIN = 'spectra/research.md'

/** The topic index every Workspace receives from the fixture. */
export const TOPIC_INDEX: TopicIndexView = {
  origin: 'fixture',
  observedAt: OBSERVED_AT,
  root: { kind: 'note', path: 'research.md' },
  topics: [
    { id: 'spectra', title: 'Self-consistent spectra of damped fixed-point maps', kind: 'topic', notePath: MAIN, disposition: 'active', waiting: 1 },
    { id: 'chain', title: 'Chain diagnostics', kind: 'family', notePath: 'chain/README.md', disposition: 'two branches paused', waiting: 0 },
    {
      id: 'algebras',
      title: 'Operator algebras and type III factors in holographic quantum error correction — learning notes',
      kind: 'learning',
      notePath: 'learning/operator-algebras/research.md',
      disposition: 'reading',
      waiting: 0,
    },
  ],
  unmapped: 2,
}

const QUESTION = 'Does damped linear mixing reach the agreed fixed point for all three test systems, and does the reached point select the physical quasiparticle branch?'
const ANSWER = 'For systems A and B the damped schedule ($\\alpha = 0.1$) meets the agreed stopping rule within 40 iterations, while the undamped schedule oscillates. This is established only for the two small systems with the frozen-core basis. It does not establish that the reached point is the physical branch, and system C has not been checked against the same rule.'
const GAP = 'On system C the update step becomes small, but the agreed residual $\\lVert F(x_k) - x_k \\rVert$ has not been evaluated; a small damped step can coexist with a large residual.'

/** Topic homes by topic id. */
export const TOPICS: Readonly<Record<string, TopicHomeView>> = {
  spectra: {
    origin: 'fixture',
    id: 'spectra',
    title: 'Self-consistent spectra of damped fixed-point maps',
    kind: 'topic',
    notePath: MAIN,
    observedAt: OBSERVED_AT,
    opening: {
      kind: 'parsed',
      question: { text: QUESTION, locator: { path: MAIN, lines: [3, 4] } },
      answer: { text: ANSWER, locator: { path: MAIN, lines: [6, 9] } },
      gap: { text: GAP, locator: { path: MAIN, lines: [11, 12] } },
    },
    pending: [{
      title: 'Root selection',
      passage: { text: 'Fix the quasiparticle branch by overlap with the reference state, or by an energy window.', locator: { path: MAIN, anchor: 'root-selection' } },
      decider: 'the researcher',
    }],
    threads: [
      {
        title: 'Third-system comparison',
        disposition: 'active',
        clause: { kind: 'next', text: 'evaluate ‖F(xₖ) − xₖ‖ on system C with τ = 10⁻⁶ in the same norm.' },
        locator: { path: MAIN, anchor: 'third-system' },
        sessionIds: [],
      },
      {
        title: 'Root selection',
        disposition: 'waiting on the researcher',
        clause: { kind: 'pending-choice', text: 'overlap with the reference state, or an energy window.' },
        locator: { path: MAIN, anchor: 'root-selection' },
        sessionIds: [],
      },
      {
        title: 'Basis convergence',
        disposition: 'paused',
        clause: { kind: 'resume-when', text: 'the system-C residual is known.' },
        locator: { path: MAIN, anchor: 'basis' },
        sessionIds: [],
      },
    ],
    failedRoutes: [{
      text: 'Anderson mixing with history 8 diverged on system B (sign oscillation in the diagonal block). Reopen only if the preconditioner changes.',
      locator: { path: MAIN, lines: [41, 42] },
    }],
    branches: [{
      title: 'Boundary construction',
      passage: {
        text: 'Supplies the frozen-core boundary condition. Its convergence on A and B does not establish the system-C behaviour.',
        locator: { path: MAIN, lines: [45, 46] },
      },
      notePath: 'spectra/boundary/research.md',
    }],
    materials: [
      { kind: 'paper', title: 'Synthetic Paper A — Residual-based stopping (edition 2)', reason: 'cited in the answer passage' },
      { kind: 'knowledge', title: 'Fixed-point residual versus step size', reason: 'linked from the gap passage' },
      { kind: 'code', title: 'scf-solver · branch damped-mixing', reason: 'linked from Current work' },
      { kind: 'method', title: 'residual-diagnostics', reason: 'listed in the topic README' },
    ],
    sessions: { kind: 'unrecorded' },
  },
  chain: {
    origin: 'fixture',
    id: 'chain',
    title: 'Chain diagnostics',
    kind: 'family',
    notePath: 'chain/README.md',
    observedAt: OBSERVED_AT,
    opening: {
      kind: 'raw',
      passage: {
        text: 'This family groups two branches that share the chain model and grid: spectral statistics and operator growth. Each branch owns its ensembles, sizes and reliable windows; this map states only how they relate.',
        locator: { path: 'chain/README.md', lines: [1, 4] },
      },
    },
    pending: [],
    threads: [],
    failedRoutes: [],
    branches: [],
    materials: [],
    sessions: { kind: 'unrecorded' },
  },
  algebras: {
    origin: 'fixture',
    id: 'algebras',
    title: 'Operator algebras and type III factors in holographic quantum error correction — learning notes',
    kind: 'learning',
    notePath: 'learning/operator-algebras/research.md',
    observedAt: OBSERVED_AT,
    opening: {
      kind: 'parsed',
      question: { text: 'Why does the boundary algebra of a subregion become a type III₁ factor in the large-N limit, and what replaces the density matrix there?', locator: { path: 'learning/operator-algebras/research.md', lines: [3, 4] } },
    },
    pending: [],
    threads: [{
      title: 'Modular theory, first pass',
      disposition: 'reading',
      clause: { kind: 'next', text: 'work through the Tomita–Takesaki construction for a cyclic separating vector.' },
      locator: { path: 'learning/operator-algebras/research.md', anchor: 'modular' },
      sessionIds: [],
    }],
    failedRoutes: [],
    branches: [],
    materials: [],
    sessions: { kind: 'unrecorded' },
  },
}

const MAIN_NOTE = `# Self-consistent spectra of damped fixed-point maps

${QUESTION}

${ANSWER}

${GAP}

## Agreed stopping rule

Stop when

$$
\\lVert r_k \\rVert = \\lVert F(x_k) - x_k \\rVert < \\tau, \\qquad \\tau = 10^{-6}
$$

in the Euclidean norm. The damped update is $x_{k+1} = x_k + \\alpha\\,(F(x_k) - x_k)$, so the step norm is $\\alpha$ times the residual norm:

$$
\\lVert x_{k+1} - x_k \\rVert = \\alpha \\lVert r_k \\rVert, \\qquad \\text{hence} \\qquad \\lVert r_k \\rVert = \\frac{\\lVert x_{k+1} - x_k \\rVert}{\\alpha}.
$$

A contraction bound would relate the residual to the distance from the fixed point,

$$
\\lVert x_k - x^{\\ast} \\rVert \\le \\frac{\\lVert F(x_k) - x_k \\rVert}{1 - q}, \\qquad q = \\sup_{x \\ne y} \\frac{\\lVert F(x) - F(y) \\rVert}{\\lVert x - y \\rVert} < 1, \\qquad x^{\\ast} = F(x^{\\ast}) \\in \\mathbb{R}^{N_{\\mathrm{aux}} \\times N_{\\omega}},
$$

but no constant $q < 1$ has been shown for the quasiparticle map on system C.

## Current work

- **Third-system comparison** — active. Next: evaluate $\\lVert F(x_k) - x_k \\rVert$ on system C with $\\tau = 10^{-6}$ in the same norm.
- **Root selection** — waiting on the researcher. Pending choice: fix the branch by overlap with the reference state, or by an energy window.
- **Basis convergence** — paused. Resume when: the system-C residual is known. Details in notes/basis-convergence.md.

## Comparison

| System | Schedule | Iterations | Step at stop | Residual at stop |
|---|---|---|---|---|
| A | damped, α = 0.1 | 31 | 7.4 × 10⁻⁸ | 7.4 × 10⁻⁷ |
| B | damped, α = 0.1 | 38 | 9.1 × 10⁻⁸ | 9.1 × 10⁻⁷ |
| C | damped, α = 0.1 | 37 | 8.2 × 10⁻⁷ | not evaluated |

## Failed routes

Anderson mixing with history 8 diverged on system B (sign oscillation in the diagonal block). Reopen only if the preconditioner changes.

## Boundary construction

Supplies the frozen-core boundary condition. Its convergence on A and B does not establish the system-C behaviour.

\`\`\`python
def scf(x0, F, alpha=0.1, tol=1e-6, max_iter=200):
    x = x0
    for k in range(max_iter):
        r = F(x) - x                 # unmixed residual
        x_new = x + alpha * r        # damped linear mixing
        if np.linalg.norm(x_new - x) < tol:   # stops on the damped step
            return x_new, k
        x = x_new
\`\`\`
`

const ROOT_NOTE = `# Research directions

The workspace follows three lines of work. Each topic owns its argument; this note states how they relate and which agreements hold across them.

- Self-consistent spectra of damped fixed-point maps — whether the damped schedule reaches the physical branch.
- Chain diagnostics — spectral statistics and operator growth on one model and grid.
- Operator algebras — learning notes toward the boundary algebra of a subregion.

## Standing agreements

Ask before changing a solver or physical model that has been fixed; routine reads, derivations and checks proceed.
`

/** Notes by workspace-relative path; any other path is reported missing. */
export const NOTES: Readonly<Record<string, NoteView>> = {
  [MAIN]: { origin: 'fixture', path: MAIN, title: 'Self-consistent spectra of damped fixed-point maps', markdown: MAIN_NOTE, observedAt: OBSERVED_AT },
  'research.md': { origin: 'fixture', path: 'research.md', title: 'Research directions', markdown: ROOT_NOTE, observedAt: OBSERVED_AT },
}

/**
 * Demonstration memory for a Session, labelled as fixture data.
 * @param sessionId - the Session the view is addressed to.
 * @returns the synthetic memory.
 */
export function demoMemory(sessionId: SessionId): SessionMemoryView {
  return {
    origin: 'fixture',
    sessionId,
    sessionOrigin: { kind: 'topic', topic: 'Self-consistent spectra', thread: 'Third-system comparison', notePath: MAIN },
    researcher: [
      { id: 'r1', kind: 'task', text: 'Compare the damped and undamped schedules on system C with the same tolerance.', turn: 1 },
      { id: 'r2', kind: 'instruction', text: 'Analytic work and code inspection only — do not run new calculations.', turn: 9 },
      { id: 'r3', kind: 'choice', question: 'If the undamped schedule fails on C, report it or drop it?', text: 'Report both schedules even if one fails.', turn: 12 },
    ],
    agent: [
      { id: 'a1', kind: 'gap', text: 'The code stops on the damped step, so the residual at stop is about step / α.', turn: 34, status: 'active' },
      { id: 'a2', kind: 'next-step', text: 'Derive the residual bound implied by the logged step; no new runs, per your turn-9 instruction.', turn: 34, status: 'active' },
      { id: 'a3', kind: 'next-step', text: 'Rerun system C with a tighter tolerance.', turn: 7, status: 'superseded' },
    ],
    gaps: [{ id: 'g1', text: 'notes/basis-convergence.md is not at its linked path.', requirement: 'optional', effect: 'Not needed for the current comparison; the paused thread links it.' }],
    sources: [
      { id: 's1', label: MAIN, range: 'Agreed stopping rule · L19–22', address: 'dsh-resource://aitp-note/workspace/fixture/note/spectra%2Fresearch.md', reason: 'selected', requirement: 'researcher', state: { kind: 'available', sentTurn: 32 } },
      { id: 's2', label: MAIN, range: 'Opening · L3–12', address: 'dsh-resource://aitp-note/workspace/fixture/note/spectra%2Fresearch.md', reason: 'owner', requirement: 'owner', state: { kind: 'condensed', sentTurn: 2, rereadTurn: 32 } },
      { id: 's3', label: 'scf-solver/mixing.py', range: 'L36–46', reason: 'agent-read', requirement: 'agent', state: { kind: 'available', sentTurn: 33 } },
      { id: 's4', label: 'runs/systemC/out.log', range: 'last 20 lines', reason: 'linked', requirement: 'owner', state: { kind: 'condensed', sentTurn: 6 } },
      { id: 's5', label: 'spectra/notes/basis-convergence.md', reason: 'linked', requirement: 'optional', state: { kind: 'missing', reason: 'file not found' } },
      { id: 's6', label: 'Synthetic Paper A, edition 2', range: 'p. 112, Eq. (7)', reason: 'linked', requirement: 'optional', state: { kind: 'located' } },
    ],
    rules: [
      { id: 'u1', text: 'Give the derivation before its interpretation.', source: 'Your rule · this topic', adoption: { kind: 'used', turn: 34 } },
      { id: 'u2', text: 'AITP research cycle (aitp-memory)', source: 'AITP Skill · default method', adoption: { kind: 'condensed', loadedTurn: 1 } },
    ],
    summaries: [
      { id: 'c1', turn: 18, covers: [1, 17] },
      { id: 'c2', turn: 31, covers: [18, 30] },
    ],
  }
}
