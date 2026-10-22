/* Synthetic fixtures for the Harness-frame design prototype.
   Every topic, note, paper, code line, session and Skill below is invented for interaction review.
   Nothing here is a research result, a real publication or output from a model. */
'use strict';

window.AITP_FIXTURES = {
  workspaces: [
    {
      id: 'ws-research', name: 'research-workspace', host: 'WSL · Ubuntu', path: '~/research',
      sessions: [
        { id: 's-root', title: 'Root selection options', updated: '1d', pending: 'Waiting for answer',
          topic: 'Self-consistent spectra', thread: 'Root selection', task: 'Compare overlap and energy-window branch selection; do not choose for me.' },
        { id: 's-third', title: 'Third-system residual check', updated: '2h',
          topic: 'Self-consistent spectra', thread: 'Third-system comparison',
          task: 'Compare the damped and undamped schedules on system C with the same tolerance.' },
        { id: 's-paper', title: 'Reading · Synthetic Paper A', updated: '1d',
          topic: 'Global (no topic)', thread: null, task: 'Explain Eq. (7) in edition 2 and its stopping condition.' },
      ],
    },
    {
      id: 'ws-code', name: 'scf-solver', host: 'WSL · Ubuntu', path: '~/code/scf-solver',
      sessions: [
        { id: 's-fix', title: 'Stopping test vs agreed rule', updated: '3d',
          topic: 'Self-consistent spectra', thread: 'Third-system comparison',
          task: 'Locate why the run stops before the agreed residual tolerance; inspect only.' },
      ],
    },
  ],

  topics: [
    { id: 't-spectra', title: 'Self-consistent spectra', kind: 'Topic', disposition: 'active · 1 choice waiting', note: 'spectra/research.md' },
    { id: 't-chain', title: 'Chain diagnostics', kind: 'Family map', disposition: 'two branches · paused', note: 'chain/README.md' },
    { id: 't-algebra', title: 'Operator algebra notes', kind: 'Learning story', disposition: 'reading', note: 'learning/operator-algebras/research.md' },
  ],

  topicHome: {
    title: 'Self-consistent spectra',
    note: 'spectra/research.md',
    observed: 'read 10:31 today · current',
    question: {
      loc: 'research.md · L3–5',
      text: 'Does damped linear mixing reach the agreed fixed point for all three test systems, and does the reached point select the physical quasiparticle branch?',
    },
    answer: {
      loc: 'research.md · L7–11',
      text: 'For systems A and B the damped schedule (α = 0.1) meets the agreed stopping rule within 40 iterations, while the undamped schedule oscillates. This is established only for the two small systems with the frozen-core basis. It does not establish that the reached point is the physical branch, and system C has not been checked against the same rule.',
    },
    gap: {
      loc: 'research.md · L13–14',
      text: 'On system C the update step becomes small, but the agreed residual ‖F(xₖ) − xₖ‖ has not been evaluated; a small damped step can coexist with a large residual.',
    },
    pending: [
      { title: 'Root selection', text: 'Pending choice: fix the branch by overlap with the reference state, or by an energy window. The researcher decides.', loc: 'research.md · Current work', session: 's-root', sessionState: 'Waiting for your answer' },
    ],
    threads: [
      { title: 'Third-system comparison', disposition: 'active', clause: 'Next: evaluate ‖F(xₖ) − xₖ‖ on system C with τ = 10⁻⁶ in the same norm.', loc: 'research.md#third-system', sessions: 2 },
      { title: 'Root selection', disposition: 'waiting on researcher', clause: 'Pending choice: overlap or energy window.', loc: 'research.md#root-selection', sessions: 1 },
      { title: 'Basis convergence', disposition: 'paused', clause: 'Resume when: the system-C residual is known.', loc: 'research.md#basis', sessions: 0 },
    ],
    failed: [
      { text: 'Anderson mixing with history 8 diverged on system B (sign oscillation in the diagonal block). Reopen only if the preconditioner changes.', loc: 'research.md · Failed routes' },
    ],
    branches: [
      { title: 'Boundary construction', text: 'supplies the frozen-core boundary condition; its convergence on A/B does not establish the system-C behaviour.', loc: 'boundary/research.md' },
    ],
    materials: [
      { group: 'Papers', items: [{ title: 'Synthetic Paper A — Residual-based stopping (edition 2)', why: 'cited in the answer passage', open: 'paper-a' }] },
      { group: 'Knowledge', items: [{ title: 'Fixed-point residual versus step size', why: 'linked from the gap passage', open: 'k-residual' }, { title: 'Contraction mapping theorem', why: 'prerequisite of the entry above', open: 'k-contraction' }] },
      { group: 'Code', items: [{ title: 'scf-solver · branch damped-mixing', why: 'linked from Current work', open: 'code' }] },
      { group: 'Methods', items: [{ title: 'residual-diagnostics', why: 'listed in the topic README', open: 'sk-residual' }, { title: 'anderson-mixing-solver', why: 'listed in the topic README', open: 'sk-anderson' }] },
    ],
  },

  note: {
    path: 'spectra/research.md',
    blocks: [
      { h: 'Self-consistent spectra' },
      { p: 'Does damped linear mixing reach the agreed fixed point for all three test systems, and does the reached point select the physical quasiparticle branch?', loc: 'L3–5' },
      { p: 'For systems A and B the damped schedule (α = 0.1) meets the agreed stopping rule within 40 iterations, while the undamped schedule oscillates. This is established only for the two small systems with the frozen-core basis. It does not establish that the reached point is the physical branch, and system C has not been checked against the same rule.', loc: 'L7–11' },
      { h2: 'Agreed stopping rule', anchor: 'stopping-rule' },
      { eq: 'stop when ‖F(xₖ) − xₖ‖ < τ,   τ = 10⁻⁶ (Euclidean norm)', loc: 'L19', id: 'eq-stop' },
      { p: 'The damped update is xₖ₊₁ = xₖ + α (F(xₖ) − xₖ), so the step norm equals α times the residual norm.', loc: 'L21–22' },
      { h2: 'Current work', anchor: 'current-work' },
      { li: 'Third-system comparison — active. Next: evaluate ‖F(xₖ) − xₖ‖ on system C with τ = 10⁻⁶ in the same norm. [run log](../runs/systemC/out.log)', loc: 'L27–29', anchor: 'third-system' },
      { li: 'Root selection — waiting on researcher. Pending choice: overlap or energy window.', loc: 'L31', anchor: 'root-selection' },
      { li: 'Basis convergence — paused. Resume when: the system-C residual is known. [notes](notes/basis-convergence.md)', loc: 'L33', anchor: 'basis' },
    ],
  },

  /* Synthetic conversation for "Third-system residual check". */
  transcript: [
    { kind: 'summary', n: 1, turn: 18, text: 'Turns 1–17 condensed at turn 18.' },
    { kind: 'summary', n: 2, turn: 31, text: 'Turns 18–30 condensed at turn 31.' },
    { kind: 'user', id: 'm34', text: 'Where are we on system C? Keep it to code inspection.' },
    { kind: 'activity', text: 'Read 3 passages', items: ['research.md · Agreed stopping rule (L19–22)', 'scf-solver/mixing.py · L36–46', 'notes/basis-convergence.md · not found'] },
    { kind: 'memory', label: 'Working note updated', text: 'Gap: the code stops on the damped step, so the residual at stop is about step / α.' },
    { kind: 'agent', text: 'The stopping test on line 43 compares the damped step ‖xₖ₊₁ − xₖ‖ = α‖F(xₖ) − xₖ‖ with τ. With α = 0.1 the run can stop while the agreed residual is ten times larger than τ. This shows the test differs from the agreed rule; it does not show whether system C converges. I could not open notes/basis-convergence.md (linked from the paused thread); it is not needed for this comparison, so I continued.' },
  ],

  task: {
    statement: { text: 'Compare the damped and undamped schedules on system C with the same tolerance.', where: 'your message · turn 1' },
    corrections: [
      { text: 'Analytic work and code inspection only — do not run new calculations.', where: 'your message · turn 9' },
      { text: 'Chose: “report both schedules even if one fails”', where: 'your answer to the agent’s question · turn 12', choice: 'Q: If the undamped schedule fails on C, report it or drop it?' },
    ],
    agent: [
      { kind: 'gap', text: 'The code stops on the damped step; residual at stop ≈ step / α.', where: 'agent · turn 34' },
      { kind: 'next', text: 'Next: derive the residual bound implied by the logged step; no new runs (per your turn 9).', where: 'agent · turn 34' },
      { kind: 'failed', text: 'Anderson history 8 diverged on B — not retrying unless the preconditioner changes.', where: 'from research.md · Failed routes', source: true },
    ],
    gaps: [
      { text: 'notes/basis-convergence.md not found', level: 'Optional background', origin: 'Linked from a paused thread', effect: 'Not needed for the current comparison' },
    ],
  },

  sources: [
    { res: 'research.md', loc: 'Agreed stopping rule · L19–22', why: 'You selected this passage', req: 'Required by you', state: 'In context now', stateKind: 'ok' },
    { res: 'research.md', loc: 'Opening · L3–14', why: 'Owning note of the task', req: 'Required by the note', state: 'Read at turn 2 · condensed since · re-read at turn 32', stateKind: 'ok' },
    { res: 'scf-solver/mixing.py', loc: 'L36–46', why: 'Agent read it', req: 'Agent says needed', state: 'In context now', stateKind: 'ok' },
    { res: 'runs/systemC/out.log', loc: 'last 20 lines', why: 'Linked from Current work', req: 'Required by the note', state: 'Read at turn 6 · condensed since · not re-read', stateKind: 'warn' },
    { res: 'notes/basis-convergence.md', loc: 'whole file', why: 'Linked from a paused thread', req: 'Optional background', state: 'Missing — file not found', stateKind: 'missing' },
    { res: 'Synthetic Paper A (ed. 2)', loc: 'p. 112, Eq. (7)', why: 'Linked from the answer passage', req: 'Optional background', state: 'Found, not read', stateKind: 'muted' },
  ],

  rulesInEffect: [
    { text: 'Give the derivation before its interpretation.', scope: 'This topic', source: 'Your rule (app rules)', state: 'Used by the latest request (turn 34)' },
    { text: 'AITP research cycle (aitp-memory)', scope: 'Default method', source: 'Portable AITP Skill', state: 'Loaded at turn 1 · condensed since · reload pending' },
    { text: 'Workspace instructions file', scope: 'Workspace', source: 'AGENTS.md in ~/research', state: 'Delivered at turn 1 (whole file)' },
  ],

  paper: {
    id: 'paper-a',
    title: 'Synthetic Paper A — Residual-based stopping for fixed-point maps',
    authors: 'A. Author, B. Author (synthetic)',
    editions: [
      { id: 'e1', label: 'Edition 1 · preprint', file: null, note: 'Known bibliography; no local file' },
      { id: 'e2', label: 'Edition 2 · journal', file: 'papers/synthetic-a-ed2.pdf', note: 'Local PDF · 14 pages' },
    ],
    page: { pdf: 4, printed: 112 },
    passage: 'For a damped iteration xₖ₊₁ = xₖ + α rₖ with rₖ = F(xₖ) − xₖ, a test on ‖xₖ₊₁ − xₖ‖ is a test on α‖rₖ‖. Stopping rules should therefore be stated for rₖ itself (7), and the damping factor reported with the tolerance.',
    eq: 'rₖ = F(xₖ) − xₖ,   stop when ‖rₖ‖ < τ          (7)',
    readingNote: 'reading/synthetic-a.md · §Eq. 7 — explained; derivation of the bound in §3 not yet expanded',
  },

  knowledge: {
    'k-residual': { title: 'Fixed-point residual versus step size', support: 'derived', review: 'unchecked', prereq: ['k-contraction'],
      text: 'For a damped update the step is α times the residual. A small step therefore bounds the residual only through α; it says nothing about distance to the fixed point unless the map is a contraction with known constant.',
      assumptions: 'Linear damping with constant α; Euclidean norm.', source: 'Synthetic Paper A, ed. 2, p. 112, Eq. (7)' },
    'k-contraction': { title: 'Contraction mapping theorem', support: 'source', review: 'reviewed', prereq: [],
      text: 'If F is a contraction with constant q < 1 on a complete metric space, then F has a unique fixed point x*, and ‖xₖ − x*‖ ≤ ‖F(xₖ) − xₖ‖ / (1 − q).',
      assumptions: 'q < 1 must be shown for the map in use; it is not implied by a decreasing step.', source: 'Standard text (synthetic citation)' },
  },

  code: {
    checkout: { host: 'WSL · Ubuntu', path: '~/code/scf-solver', branch: 'damped-mixing', revision: 'working tree (base 4f2c… synthetic)', dirty: ['mixing.py (modified)', 'tests/test_mixing.py (modified)'] },
    file: 'mixing.py',
    lines: [
      [36, 'def scf(x0, F, alpha=0.1, tol=1e-6, max_iter=200):'],
      [37, '    x = x0'],
      [38, '    for k in range(max_iter):'],
      [39, '        r = F(x) - x                 # unmixed residual'],
      [40, '        x_new = x + alpha * r        # damped linear mixing'],
      [41, '        step = np.linalg.norm(x_new - x)'],
      [42, '        log.info("iter %d step=%.1e", k, step)'],
      [43, '        if step < tol:               # stops on the damped step'],
      [44, '            return x_new, k'],
      [45, '        x = x_new'],
      [46, '    raise NotConverged(k)'],
    ],
    highlight: [41, 43],
    log: ['iter 35 step=1.1e-06', 'iter 36 step=9.6e-07', 'iter 37 step=8.2e-07', 'converged after 37 iterations'],
  },

  skills: {
    'sk-anderson': {
      name: 'anderson-mixing-solver',
      source: 'spectra/skills/anderson-mixing-solver/SKILL.md', sourceKind: 'Topic method',
      also: [],
      purpose: 'Replace linear mixing by Anderson mixing with history m, and check convergence on the unmixed residual.',
      pre: [
        { text: 'The solver may be changed to Anderson mixing', status: 'unmet', why: 'You fixed damped linear mixing (research.md · Decisions)' },
        { text: 'The unmixed map F(xₖ) can be evaluated each iteration', status: 'met', why: 'mixing.py line 39' },
        { text: 'A preconditioner is available for history m > 4', status: 'unknown', why: 'Not stated in the topic' },
      ],
      steps: [
        { n: 1, text: 'Store the last m residuals and iterates.', use: 'not used', why: 'Part of the Anderson update' },
        { n: 2, text: 'Solve the least-squares problem for mixing coefficients.', use: 'not used', why: 'Would replace your fixed solver' },
        { n: 3, text: 'Evaluate the unmixed residual rₖ = F(xₖ) − xₖ and stop on ‖rₖ‖ < τ, never on ‖xₖ₊₁ − xₖ‖.', use: 'borrowed', why: 'Matches your agreed stopping rule' },
        { n: 4, text: 'Restart the history when the residual grows twice in a row.', use: 'not used', why: 'Depends on steps 1–2' },
      ],
      mandatory: [{ text: 'Report the residual in the same norm as the tolerance.', applies: 'Applies to step 3' }],
      limits: 'Its convergence-rate claims were demonstrated only for Anderson updates; they do not transfer to damped linear mixing.',
      loaded: 'Loaded at turn 12 · text retained in the session',
      changed: false,
    },
    'sk-residual': {
      name: 'residual-diagnostics',
      source: 'spectra/skills/residual-diagnostics/SKILL.md', sourceKind: 'Topic method',
      also: [{ source: '~/.agents/skills/residual-diagnostics/SKILL.md', kind: 'Personal copy (older)', note: 'Illustrative name winner in this fixture; topic association alone does not determine lookup priority' }],
      purpose: 'Distinguish apparent convergence (small step) from actual convergence (small residual in the agreed norm).',
      pre: [{ text: 'The agreed residual and norm are stated', status: 'met', why: 'research.md L19' }],
      steps: [
        { n: 1, text: 'Recover the agreed residual definition and tolerance.', use: 'used', why: '' },
        { n: 2, text: 'Compare it with the quantity the code actually tests.', use: 'used', why: '' },
        { n: 3, text: 'Report the residual at stop, not the iteration count.', use: 'used', why: '' },
      ],
      mandatory: [],
      limits: 'Does not address branch selection.',
      loaded: 'Shown as file text at turn 20 · not invoked as instructions',
      changed: true,
    },
  },

  distill: {
    evidence: [
      { kind: 'session', text: 'Turn 34: the stopping test compares the damped step α‖r‖ with τ.', loc: 'Third-system residual check · turn 34' },
      { kind: 'code', text: 'if step < tol:  # stops on the damped step', loc: 'scf-solver/mixing.py · L43' },
      { kind: 'note', text: 'stop when ‖F(xₖ) − xₖ‖ < τ', loc: 'research.md · L19' },
    ],
    existing: 'residual-diagnostics · step 2 “Compare it with the quantity the code actually tests.”',
    diff: [
      ['ctx', '2. Compare it with the quantity the code actually tests.'],
      ['add', '   If updates are damped by a constant α, a test on ‖xₖ₊₁ − xₖ‖ is a test on α‖rₖ‖:'],
      ['add', '   report ‖rₖ‖ = step / α or evaluate rₖ directly before comparing with τ.'],
      ['add', '   Scope: constant linear damping only (see failed transfer below).'],
      ['ctx', '3. Report the residual at stop, not the iteration count.'],
    ],
    evals: [
      { name: 'Motivating case (replay)', result: 'replay', text: 'Reproduces the system-C finding. Replay only — not evidence of transfer.' },
      { name: 'Changed instance: Broyden update (synthetic)', result: 'failed', text: 'Step is not proportional to the residual; the added rule gives a wrong bound. Draft narrowed to constant linear damping.' },
      { name: 'Changed instance: Pulay/DIIS (synthetic)', result: 'untested', text: 'No evaluation run yet.' },
    ],
  },

  rules: [
    { group: 'Writing and explanation', items: [
      { id: 'r1', text: 'Give the derivation before its interpretation.', scope: 'This topic', source: 'App rules · topic “Self-consistent spectra”', state: 'Used by the latest request (turn 34)' },
      { id: 'r2', text: 'Prefer energies in eV in prose.', scope: 'All my work', source: 'App rules · personal', state: 'Used by the latest request (turn 34)' },
    ] },
    { group: 'Research collaboration', items: [
      { id: 'r3', text: 'Ask before changing a solver or physical model I fixed; choose routine reads, derivations and checks yourself.', scope: 'All my work', source: 'Portable AITP default (aitp-memory) · not edited', state: 'Default method guidance' },
    ] },
    { group: 'Recording and recovery', items: [
      { id: 'r4', text: 'Keep failed routes with the condition that would justify reopening them.', scope: 'All my work', source: 'Portable AITP default (aitp-memory) · not edited', state: 'Default method guidance' },
    ] },
  ],
};
