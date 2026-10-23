/** Synthetic research objects for the workspace adapter; never read from real notes. */
import type {
  Project, Resource, ResourceId, SourceAttribution, Topic, TopicId,
} from '@deepseek-ai/dsh-client-ui-aitp-research/client'

/** Fresh records give each Workspace its own independent demonstration state. */
export interface WorkspaceFixtureData {
  readonly project: Project
  readonly topics: readonly Topic[]
  readonly resources: readonly Resource[]
}

const topicId = (value: string): TopicId => value as TopicId
const resourceId = (value: string): ResourceId => value as ResourceId
const attribution: SourceAttribution = { sourceResourceIds: [], explanation: 'Synthetic demonstration; not evidence about an actual research project.' }

/**
 * Create the topic hierarchy and the material owners shown by the opt-in fixture.
 * @returns independent objects for one adapter instance.
 */
export function createWorkspaceFixtureData(): WorkspaceFixtureData {
  const chaos = topicId('quantum-chaos'), chains = topicId('long-range-chains'), krylov = topicId('operator-krylov')
  const electronic = topicId('electronic-structure'), gw = topicId('gw-diagnostics')
  const account = (id: TopicId, title: string): Resource => ({
    id: resourceId(`${id}-account`), ownerTopicId: id, title: `${title}: full account`, kind: 'note',
    target: { kind: 'workspace-path', path: `demo/${id}/research.md` },
    content: { kind: 'markdown', text: '' }, attribution,
  })
  const chaosAccount = account(chaos, 'Quantum chaos')
  const chainsAccount = account(chains, 'Long-range chains')
  const krylovAccount = account(krylov, 'Operator Krylov dynamics')
  const electronicAccount = account(electronic, 'Electronic structure')
  const gwAccount = account(gw, 'GW diagnostics')
  const report: Resource = {
    id: resourceId('krylov-control-report'), ownerTopicId: krylov, title: 'Small-system control report', kind: 'report',
    target: { kind: 'workspace-path', path: 'demo/operator-krylov/control-report.md' },
    content: { kind: 'markdown', text: '# Small-system control report\n\nThis is a synthetic control, not a completed physical calculation.\n\n## Observable\n\nThe observable is the operator Krylov complexity $K(t)=\\sum_n n |\\varphi_n(t)|^2$.\n\n## Scope and limit\n\nThe finite reference checks construction and normalization only. It does not establish chaos or convergence of a production grid.\n\n## Next check\n\nCompare independent evolution on the same spectral grid before extending the calculation.' },
    attribution,
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
  const summary = (
    id: TopicId, title: string, parentId: TopicId | null, childIds: readonly TopicId[],
    resources: readonly Resource[], question: string, gap: string, next: string,
  ): Topic => ({
    id, title, parentId, childIds, directionId: parentId === electronic || id === electronic ? 'electronic' : 'many-body',
    currentAnswer: { text: 'A bounded reference route is available for comparison.', qualification: 'Synthetic state only; the larger research question remains open.', attribution },
    gap, work: { state: 'active', label: 'In progress', nextAction: next }, resourceCount: resources.length,
    question, scope: 'Use a controlled reference before interpreting the broader research question.',
    workItems: [{ id: `${id}-control`, title: 'Compare the independent control', description: next, state: 'active', continuation: { label: 'Next action', text: next }, attribution }],
    statements: [{ id: `${id}-claim`, kind: 'claim', title: 'Reference behavior has limited scope', text: 'A successful finite reference checks the implemented observable.', qualification: 'It does not establish a universal physical conclusion.', origin: 'local', assessment: 'unchecked', checks: [], attribution }],
    resources: resources.map(({ id: resourceIdentity, ownerTopicId, title: resourceTitle, kind, target }) => ({
      id: resourceIdentity, ownerTopicId, title: resourceTitle, kind, target,
    })),
    accountResourceId: resourceId(`${id}-account`),
  })
  const topics: Topic[] = [
    summary(chaos, 'Quantum chaos', null, [chains], [chaosAccount], 'How do interaction range and symmetry affect quantum dynamics?', 'Separate numerical completion from a physical interpretation.', 'Open the long-range-chain subtopic and inspect its limits.'),
    summary(chains, 'Long-range chains', chaos, [krylov], [chainsAccount, paper], 'Which comparisons remain meaningful across interaction ranges?', 'A matched grid and consistent symmetry resolution are still needed.', 'Compare the operator Krylov control with the selected reference.'),
    summary(krylov, 'Operator Krylov dynamics', chains, [], [krylovAccount, report], 'What does operator spreading reveal on a matched spectral grid?', 'The small-system control does not cover the production grid.', 'Inspect the control report before increasing system size.'),
    summary(electronic, 'Electronic structure', null, [gw], [electronicAccount], 'Which approximations control the self-energy prediction?', 'Numerical convergence and physical approximation errors remain separate.', 'Inspect the GW diagnostic branch.'),
    summary(gw, 'GW diagnostics', electronic, [], [gwAccount, code], 'Can the chosen self-energy implementation reproduce a reference?', 'The illustrative source path is not connected.', 'Connect the source reader and compare the reference conventions.'),
  ]
  return {
    project: {
      id: 'fixture-research-project', title: 'Research workspace',
      directions: [{ id: 'many-body', title: 'Many-body dynamics' }, { id: 'electronic', title: 'Electronic structure' }],
      seeds: [{ id: 'cross-topic-seed', title: 'Shared numerical controls', summary: 'Compare which verification procedures transfer between topics before reusing a result.', attribution }],
    },
    topics,
    resources: [chaosAccount, chainsAccount, krylovAccount, electronicAccount, gwAccount, report, paper, code],
  }
}

/**
 * Render the synthetic full account from its one current topic owner.
 * @param topic - current fixture topic; edits update this same object in its adapter.
 * @returns demonstration source Markdown, not interface copy or a real note write.
 */
export function fixtureAccountMarkdown(topic: Topic): string {
  const answer = topic.currentAnswer === null ? 'No current answer is recorded.' : `${topic.currentAnswer.text}\n\n${topic.currentAnswer.qualification}`
  return `# ${topic.title}\n\n> Synthetic demonstration; not a real research record.\n\n## Question\n\n${topic.question}\n\n## Scope\n\n${topic.scope}\n\n## Current understanding\n\n${answer}\n\n## Decisive gap\n\n${topic.gap ?? 'No gap recorded.'}\n\n## Current work\n\n${topic.work.nextAction ?? 'No next action recorded.'}\n\n## Argument and limits\n\nA bounded reference may distinguish an implementation error from an unresolved scientific assumption. It does not establish the whole research question. The next observation must be assessed within the scope stated above.\n`
}
