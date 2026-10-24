/** Synthetic research objects for the workspace adapter; never read from real notes. */
import type {
  ParentContribution, Project, QualifiedAnswer, Resource, ResourceId, SourceAttribution, Statement, Topic, TopicId, WorkItem, WorkSummary,
} from '@deepseek-ai/dsh-client-ui-aitp-research/client'

/** Fresh records give each Workspace its own independent demonstration state. */
export interface WorkspaceFixtureData {
  readonly project: Project
  readonly topics: readonly Topic[]
  readonly resources: readonly Resource[]
  /** Page size of parent-scoped topic lists, so the demonstration includes continued lists. */
  readonly pageSize: number
  /** Child lists the demonstration reports as partial, by parent, with the provider's reason. */
  readonly incomplete: ReadonlyMap<TopicId, string>
}

const topicId = (value: string): TopicId => value as TopicId
const resourceId = (value: string): ResourceId => value as ResourceId
const attribution: SourceAttribution = { sourceResourceIds: [], explanation: 'Synthetic demonstration; not evidence about an actual research project.' }
const answer = (text: string, qualification: string): QualifiedAnswer => ({ text, qualification, attribution })
const work = (state: WorkSummary['state'], label: string, nextAction?: string): WorkSummary => (
  nextAction === undefined ? { state, label } : { state, label, nextAction }
)

interface TopicSeed {
  readonly id: TopicId
  readonly title: string
  readonly shortTitle?: string
  readonly directionId?: string
  readonly parentId: TopicId | null
  readonly childIds?: readonly TopicId[]
  readonly contribution?: ParentContribution
  readonly question: string
  readonly scope: string
  readonly answer: QualifiedAnswer | null
  readonly gap: string | null
  readonly work: WorkSummary
  readonly resources?: readonly Resource[]
  readonly workItems?: readonly WorkItem[]
  readonly statements?: readonly Statement[]
}

/**
 * Create the topic hierarchy and the material owners shown by the opt-in fixture.
 * @returns independent objects for one adapter instance.
 */
export function createWorkspaceFixtureData(): WorkspaceFixtureData {
  const chaos = topicId('quantum-chaos'), chains = topicId('long-range-chains'), krylov = topicId('operator-krylov')
  const lanczos = topicId('lanczos-extraction'), control = topicId('krylov-control'), sff = topicId('spectral-form-factor')
  const scaling = topicId('finite-size-scaling'), symmetry = topicId('symmetry-resolution'), entanglement = topicId('entanglement-growth')
  const eth = topicId('eigenstate-thermalisation'), integrable = topicId('integrable-limit')
  const electronic = topicId('electronic-structure'), gw = topicId('gw-diagnostics'), basis = topicId('basis-convergence')
  const grid = topicId('shared-spectral-grid'), reading = topicId('random-matrix-reading')
  const report: Resource = {
    id: resourceId('krylov-control-report'), ownerTopicId: control, title: 'Small-system control report', kind: 'report',
    target: { kind: 'workspace-path', path: 'demo/operator-krylov/control-report.md' },
    content: { kind: 'markdown', text: CONTROL_REPORT }, attribution,
  }
  const derivation: Resource = {
    id: resourceId('lanczos-derivation'), ownerTopicId: lanczos, title: 'Lanczos recursion on a shared grid', kind: 'note',
    target: { kind: 'workspace-path', path: 'demo/operator-krylov/lanczos-recursion.md' },
    content: { kind: 'markdown', text: LANCZOS_NOTE }, attribution,
  }
  const table: Resource = {
    id: resourceId('spacing-ratio-table'), ownerTopicId: scaling, title: 'Mean spacing ratio by system size', kind: 'data',
    target: { kind: 'workspace-path', path: 'demo/finite-size-scaling/spacing-ratio.tsv' },
    content: { kind: 'plain-text', text: SPACING_TABLE }, attribution,
  }
  const paper: Resource = {
    id: resourceId('long-range-paper'), ownerTopicId: chains, title: 'Long-range-chain literature reference', kind: 'paper',
    target: { kind: 'unavailable', reason: 'The PDF provider has not been connected.' },
    content: { kind: 'unavailable', reason: 'unsupported-format', detail: 'This fixture reserves a paper destination. It does not supply a PDF or claim to have read one.' }, attribution,
  }
  const code: Resource = {
    id: resourceId('gw-source'), ownerTopicId: gw, title: 'Self-energy implementation', kind: 'code',
    target: { kind: 'workspace-path', path: 'demo/libgw/self_energy.cpp' },
    content: { kind: 'unavailable', reason: 'linked-only', detail: 'The code reader is not connected; this path is an illustrative locator.' }, attribution,
  }
  const seeds: TopicSeed[] = [
    {
      id: chaos, title: 'Quantum chaos and operator growth in interacting spin chains', shortTitle: 'Quantum chaos', directionId: 'many-body', parentId: null,
      childIds: [chains, eth, integrable],
      question: 'How do interaction range and symmetry change the onset of chaotic dynamics in finite spin chains?',
      scope: 'Finite chains up to $N = 18$ with open boundaries; one disorder realisation per parameter point.',
      answer: answer('Level statistics become chaotic in the matched finite chains once both symmetry sectors are resolved.', 'Shown only for the finite sizes in this demonstration; the thermodynamic limit and other boundary conditions remain open.'),
      gap: 'Whether operator-growth diagnostics agree with level statistics at the same parameters.',
      work: work('active', 'In progress', 'Compare the Krylov results with level statistics on the shared grid.'),
    },
    {
      id: chains, title: 'Long-range chains: which comparisons survive a change of interaction exponent?', shortTitle: 'Long-range chains', directionId: 'many-body', parentId: chaos,
      childIds: [krylov, sff, scaling, symmetry, entanglement],
      contribution: { text: 'Supplies the matched-grid comparison the parent question relies on, for the exponents listed in its scope only.' },
      question: 'Which diagnostics remain comparable when the interaction exponent $\\alpha$ changes?',
      scope: 'Exponents $\\alpha \\in \\{0.8, 1.2, 1.5, 3\\}$ on one spectral grid.',
      answer: answer('Two of the three planned comparisons remain meaningful across the studied exponents.', 'The third comparison changes normalisation between exponents and is not yet reconciled.'),
      gap: 'A symmetry resolution that is consistent across all exponents.',
      work: work('waiting-on-analysis', 'Awaiting analysis', 'Reconcile the normalisation of the third comparison.'),
      resources: [paper],
    },
    {
      id: krylov, title: 'Operator Krylov dynamics', directionId: 'many-body', parentId: chains, childIds: [lanczos, control],
      contribution: { text: 'Tests whether operator spreading separates the interaction regimes on one matched grid.' },
      question: 'What does operator spreading reveal on a matched spectral grid?',
      scope: 'Local spin operators; early and intermediate times before saturation.',
      answer: answer('Krylov complexity grows linearly at early times in both regimes on the matched grid.', 'Observed only up to $N = 16$ with one boundary condition; it does not by itself establish chaos.'),
      gap: 'The small-system control does not cover the production grid.',
      work: work('active', 'In progress', 'Read the control report before increasing the system size.'),
      statements: [{
        id: 'krylov-linear-growth', kind: 'claim', title: 'Linear early-time growth', text: 'Krylov complexity grows linearly before saturation in both regimes.',
        qualification: 'Within the studied sizes; a universal growth rate is not claimed.', origin: 'local', assessment: 'checked',
        checks: [{ kind: 'numerical', scope: 'Free-fermion limit reproduced by the small-system control', outcome: 'passed', resourceIds: [report.id] }], attribution,
      }],
    },
    {
      id: lanczos, title: 'Extracting Lanczos coefficients on a shared spectral grid without loss of orthogonality', shortTitle: 'Lanczos extraction',
      directionId: 'many-body', parentId: krylov,
      contribution: { text: 'The Krylov comparison is meaningful only after the coefficients are extracted on the same grid.', relation: 'prerequisite' },
      question: 'How much reorthogonalisation keeps the recursion stable at the production sizes?',
      scope: 'Full and partial reorthogonalisation for $N \\le 18$.',
      answer: null, gap: 'The cost of full reorthogonalisation at $N = 18$ has not been measured.',
      work: work('active', 'In progress', 'Benchmark partial against full reorthogonalisation at $N = 14$.'),
      resources: [derivation],
    },
    {
      id: control, title: 'Small-system control (N ≤ 12)', directionId: 'many-body', parentId: krylov,
      contribution: { text: 'Separates implementation errors from physical behaviour before larger sizes are interpreted.', relation: 'control' },
      question: 'Does the implementation reproduce a case with a known answer?',
      scope: 'Free-fermion limit, $N \\le 12$.',
      answer: answer('The control reproduces the analytic free-fermion growth rate within 0.5 %.', 'This validates the implementation only; it says nothing about interacting chains at larger sizes.'),
      gap: null, work: work('concluded', 'Concluded'), resources: [report],
    },
    {
      id: sff, title: 'Spectral form factor route', directionId: 'many-body', parentId: chains,
      contribution: { text: 'An alternative diagnostic for the same comparison, set aside because spectral unfolding was ambiguous at these sizes.', relation: 'alternative' },
      question: 'Could the spectral form factor replace level statistics for the comparison?',
      scope: 'Unfolded spectra at the studied exponents.',
      answer: null, gap: 'Kept for reference; it would need a reliable unfolding procedure to be reconsidered.',
      work: work('superseded', 'Superseded'),
      statements: [{
        id: 'sff-declined', kind: 'hypothesis', title: 'Form factor as the primary diagnostic', text: 'The ramp onset could order the interaction regimes.',
        qualification: 'Declined as a route; this is not a finding that the hypothesis is false.', origin: 'local', assessment: 'unchecked', checks: [], disposition: 'declined', attribution,
      }],
    },
    {
      id: scaling, title: 'Finite-size scaling of the level-spacing ratio', shortTitle: 'Spacing-ratio scaling', directionId: 'many-body', parentId: chains,
      question: 'Does the mean spacing ratio approach the GOE value as $N$ grows?',
      scope: 'Four system sizes per exponent.',
      answer: answer('The ratio drifts towards the GOE value with $N$ for $\\alpha < 1.5$.', 'Only four system sizes; the drift could still reverse at larger $N$.'),
      gap: 'One larger size is needed before the trend is interpreted.',
      work: work('waiting-on-run', 'Awaiting a run', 'Queue the $N = 18$ diagonalisation.'), resources: [table],
    },
    {
      id: symmetry, title: 'Resolving reflection and spin-flip sectors consistently across exponents', shortTitle: 'Symmetry resolution',
      directionId: 'many-body', parentId: chains,
      contribution: { text: 'Every comparison in the parent needs the same sector resolution at each exponent.', relation: 'prerequisite' },
      question: 'Which sectors must be separated before spectra at different exponents are compared?',
      scope: 'Reflection and global spin-flip symmetry.',
      answer: answer('Both sectors must be resolved; mixing them produces spurious Poisson statistics.', 'Checked at two exponents; the remaining exponents follow the same construction but are unchecked.'),
      gap: 'The construction is unchecked at $\\alpha = 0.8$ and $\\alpha = 3$.',
      work: work('active', 'In progress', 'Repeat the sector check at the remaining exponents.'),
    },
    {
      id: entanglement, title: 'Entanglement growth after a quench', directionId: 'many-body', parentId: chains,
      question: 'Does entanglement growth distinguish the regimes earlier than spectral diagnostics?',
      scope: 'Not yet set.',
      answer: null, gap: 'Not started; recorded as a possible later check.', work: work('dormant', 'Dormant'),
    },
    {
      id: eth, title: 'Eigenstate thermalisation in the middle of the spectrum', shortTitle: 'Eigenstate thermalisation', directionId: 'many-body', parentId: chaos,
      question: 'Do local observables satisfy the eigenstate thermalisation ansatz in the chaotic regime?',
      scope: 'Diagonal and off-diagonal matrix elements of one local observable.',
      answer: answer('Diagonal matrix elements fluctuate less as $N$ grows.', 'Consistent with eigenstate thermalisation at these sizes but not a demonstration of it; off-diagonal elements are not yet examined.'),
      gap: 'Which off-diagonal statistic to compute first.',
      work: work('waiting-on-researcher', 'Awaiting your choice', 'Choose the first off-diagonal statistic.'),
      workItems: [{
        id: 'eth-route', title: 'Choose the next check', description: 'Two routes would test the off-diagonal part of the ansatz.', state: 'waiting-on-researcher',
        options: [{ id: 'spectral-function', label: 'Compute the off-diagonal spectral function first' }, { id: 'larger-diagonal', label: 'Extend the diagonal analysis to $N = 18$ first' }],
        attribution,
      }],
    },
    {
      id: integrable, title: 'Integrable nearest-neighbour limit', directionId: 'many-body', parentId: chaos,
      contribution: { text: 'Checks that the pipeline recovers Poisson statistics where integrability is known.', relation: 'control' },
      question: 'Does the analysis recover Poisson statistics at $\\alpha \\to \\infty$?',
      scope: 'Nearest-neighbour limit only.',
      answer: answer('Poisson level statistics are recovered in the nearest-neighbour limit.', 'A consistency check of the analysis pipeline, not a new result.'),
      gap: null, work: work('concluded', 'Concluded'),
    },
    {
      id: electronic, title: 'Self-energy approximations for quasiparticle gaps', shortTitle: 'Electronic structure', directionId: 'electronic', parentId: null,
      childIds: [gw, basis, topicId('band-alignment')],
      question: 'Which approximations control the predicted quasiparticle gap of the reference material?',
      scope: 'One reference material; one-shot and partially self-consistent schemes.',
      answer: answer('One-shot GW improves the gap over the semilocal starting point for the reference material.', 'Starting-point dependence is not quantified; the improvement could shrink with another starting functional.'),
      gap: 'Numerical convergence and physical approximation errors are not yet separated.',
      work: work('active', 'In progress', 'Inspect the GW diagnostic branch.'),
    },
    {
      id: gw, title: 'GW diagnostics', directionId: 'electronic', parentId: electronic,
      contribution: { text: 'Separates implementation error from approximation error before starting points are compared.', relation: 'control' },
      question: 'Can the self-energy implementation reproduce a published reference gap?',
      scope: 'Reference conventions for the frequency grid and the plasmon-pole model.',
      answer: null, gap: 'The illustrative source path is not connected, so the conventions cannot be compared yet.',
      work: work('waiting-on-integration', 'Awaiting integration', 'Connect the source reader and compare the reference conventions.'), resources: [code],
    },
    {
      id: basis, title: 'Basis-set convergence of the dielectric matrix', shortTitle: 'Basis convergence', directionId: 'electronic', parentId: electronic,
      question: 'Is the gap converged with respect to the dielectric-matrix basis?',
      scope: 'Two largest bases only.',
      answer: answer('The gap changes by less than 20 meV between the two largest bases.', 'Only two bases were compared; no extrapolation was attempted.'),
      gap: 'An extrapolation in basis size.', work: work('paused', 'Paused'),
    },
    {
      id: grid, title: 'A shared spectral grid for cross-topic comparisons', shortTitle: 'Shared spectral grid', directionId: 'methods', parentId: null,
      question: 'Can one spectral grid serve both the many-body and the electronic-structure comparisons?',
      scope: 'Grid construction and its error budget.',
      answer: null, gap: 'The grid is agreed for the many-body topics but not for electronic structure.',
      work: work('active', 'In progress', 'Estimate the interpolation error on the electronic-structure frequency axis.'),
    },
    {
      id: reading, title: 'Background reading: random-matrix universality', shortTitle: 'Random-matrix reading', parentId: null,
      question: 'Which universality results apply to finite, locally interacting systems?',
      scope: 'Reading notes only.',
      answer: null, gap: 'Not started.', work: work('dormant', 'Dormant'),
    },
  ]
  const accounts = new Map(seeds.map(seed => [seed.id, accountResource(seed.id, seed.title)]))
  const topics = seeds.map((seed): Topic => {
    const owned = [accounts.get(seed.id), ...seed.resources ?? []].filter(resource => resource !== undefined)
    return {
      id: seed.id, title: seed.title, parentId: seed.parentId, childIds: seed.childIds ?? [],
      ...(seed.shortTitle === undefined ? {} : { shortTitle: seed.shortTitle }),
      ...(seed.directionId === undefined ? {} : { directionId: seed.directionId }),
      ...(seed.contribution === undefined ? {} : { parentContribution: seed.contribution }),
      currentAnswer: seed.answer, gap: seed.gap, work: seed.work, resourceCount: owned.length,
      question: seed.question, scope: seed.scope,
      workItems: seed.workItems ?? (seed.work.nextAction === undefined ? [] : [{
        id: `${seed.id}-next`, title: 'Next check', description: seed.work.nextAction, state: seed.work.state,
        continuation: { label: 'Next action', text: seed.work.nextAction }, attribution,
      }]),
      statements: seed.statements ?? [],
      resources: owned.map(({ id, ownerTopicId, title, kind, target }) => ({ id, ownerTopicId, title, kind, target })),
      accountResourceId: resourceId(`${seed.id}-account`),
    }
  })
  return {
    project: {
      id: 'fixture-research-project', title: 'Interaction, chaos and correlation in finite systems',
      summary: 'A synthetic demonstration programme: how interaction range, symmetry and approximation choices limit what finite calculations can establish. It is not an actual research record.',
      directions: [
        { id: 'many-body', title: 'Many-body dynamics' },
        { id: 'electronic', title: 'Electronic structure' },
        { id: 'methods', title: 'Numerical methods' },
      ],
      seeds: [
        { id: 'cross-topic-seed', title: 'Shared numerical controls', summary: 'Compare which verification procedures transfer between topics before reusing a result.', attribution },
        { id: 'open-boundaries-seed', title: 'Boundary conditions as a variable', summary: 'Every current answer assumes open boundaries; a periodic comparison may change several of them.', attribution },
      ],
    },
    topics,
    resources: [...accounts.values(), report, derivation, table, paper, code],
    pageSize: 3,
    incomplete: new Map([[electronic, 'One branch note could not be read in this demonstration.']]),
  }
}

function accountResource(id: TopicId, title: string): Resource {
  return {
    id: resourceId(`${id}-account`), ownerTopicId: id, title: `${title}: full account`, kind: 'note',
    target: { kind: 'workspace-path', path: `demo/${id}/research.md` },
    content: { kind: 'markdown', text: '' }, attribution,
  }
}

/**
 * Render the synthetic full account from its one current topic owner.
 * @param topic - current fixture topic; edits update this same object in its adapter.
 * @returns demonstration source Markdown, not interface copy or a real note write.
 */
export function fixtureAccountMarkdown(topic: Topic): string {
  const current = topic.currentAnswer === null ? 'No current answer is recorded.' : `${topic.currentAnswer.text}\n\n${topic.currentAnswer.qualification}`
  const role = topic.parentContribution === undefined ? '' : `## Role in the parent topic\n\n${topic.parentContribution.text}\n\n`
  return `# ${topic.title}\n\n> Synthetic demonstration; not a real research record.\n\n## Question\n\n${topic.question}\n\n## Scope\n\n${topic.scope}\n\n${role}## Current understanding\n\n${current}\n\n## Decisive gap\n\n${topic.gap ?? 'No gap recorded.'}\n\n## Current work\n\n${topic.work.nextAction ?? 'No next action recorded.'}\n\n## Argument and limits\n\nA bounded reference may distinguish an implementation error from an unresolved scientific assumption. It does not establish the whole research question.\n\nEach observation recorded here is assessed only within the scope above. Where a branch reports a result, this account cites it with that branch's own conditions; a result does not become more general by being cited here.\n\n## Evidence\n\n${topic.resources.length === 0 ? 'No materials are linked yet.' : topic.resources.map(resource => `- ${resource.title}`).join('\n')}\n`
}

const CONTROL_REPORT = `# Small-system control report

> Synthetic demonstration; the numbers below are illustrative and were not computed.

This report checks the Krylov implementation against a case with a known answer before any interacting result is interpreted.

## Setup

The control uses the free-fermion limit of the chain with $N \\le 12$ sites and open boundaries. The initial operator is a single-site spin operator $O_0 = \\sigma^z_{1}$, normalised in the infinite-temperature inner product
$$(A|B) = 2^{-N}\\,\\mathrm{Tr}\\,(A^\\dagger B).$$

## Observable

The observable is the operator Krylov complexity
$$K(t) = \\sum_n n\\,|\\varphi_n(t)|^2,$$
where $\\varphi_n(t)$ are the amplitudes of the evolved operator in the Krylov basis generated by the Liouvillian $\\mathcal{L} = [H, \\cdot\\,]$.

## Procedure

1. Generate the Lanczos coefficients $b_n$ with full reorthogonalisation.
2. Integrate the amplitude equations $\\partial_t \\varphi_n = b_n \\varphi_{n-1} - b_{n+1} \\varphi_{n+1}$.
3. Fit the early-time growth rate of $K(t)$ on the window $0.5 \\le t \\le 3$.

| $N$ | Krylov dimension | fitted rate | analytic rate |
| --- | --- | --- | --- |
| 8 | 64 | 0.997 | 1.000 |
| 10 | 100 | 1.003 | 1.000 |
| 12 | 144 | 1.004 | 1.000 |

## Result

The fitted early-time rate agrees with the analytic free-fermion value within 0.5 % at each size.

## Scope and limit

The control checks the construction, normalisation and integration only. It does not establish chaos, it does not test the interacting chain, and it says nothing about convergence of the production grid.

## Next check

Compare an independent time evolution on the same spectral grid before extending the calculation to $N = 16$.
`

const LANCZOS_NOTE = `# Lanczos recursion on a shared spectral grid

> Synthetic demonstration; the derivation is standard and the cost estimates are illustrative.

## Recursion

Starting from $|O_0)$, the recursion
$$|A_n) = \\mathcal{L}|O_{n-1}) - b_{n-1}|O_{n-2}), \\qquad b_n = (A_n|A_n)^{1/2}, \\qquad |O_n) = b_n^{-1}|A_n)$$
generates an orthonormal Krylov basis in exact arithmetic.

## Loss of orthogonality

In floating point, orthogonality decays once a Ritz value converges. Partial reorthogonalisation monitors the estimated overlap $\\omega_{n,k}$ and reorthogonalises only when $|\\omega_{n,k}| > \\sqrt{\\varepsilon}$.

## Shared grid

All exponents use the same energy window and the same number of grid points, so differences between regimes cannot come from the grid itself.

## Open question

The cost of full reorthogonalisation grows as $O(n^2 d)$ for Krylov dimension $n$ and operator dimension $d$; whether partial reorthogonalisation is accurate enough at $N = 18$ is the open question of this topic.
`

const SPACING_TABLE = `# mean spacing ratio <r>, synthetic values
alpha\tN=12\tN=14\tN=16\tN=18
0.8\t0.507\t0.515\t0.521\t(pending)
1.2\t0.498\t0.509\t0.517\t(pending)
1.5\t0.471\t0.479\t0.486\t(pending)
3.0\t0.402\t0.398\t0.395\t(pending)
# GOE reference 0.5307; Poisson reference 0.3863
`
