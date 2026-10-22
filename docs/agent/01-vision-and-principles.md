# 01. Vision and principles

## What the agent is

A theoretical-physics research partner that works inside the researcher's own projects. It knows each
project's question, current answer, open threads, evidence, code and history because it reads them from the
project's notes, links and files. It acts on them through the AITP research cycle: theory, computation,
literature and learning, knowledge management and writing.

The interface is a research workspace, not a chat window. It has five parts:

- **The research structure:** a topic tree and a board of live threads.
- **The material:** notes with mathematics, papers beside reading notes, code checkouts, runs and figures.
- **The agent:** works on that material in sessions bound to a research location.
- **Live work:** shown as tasks with their evidence.
- **The researcher:** decides at the points where AITP says a human decision is needed, and otherwise
  delegates.

Pi provides the machinery underneath:

- model transport to GPT and other providers;
- durable conversations and tasks that survive crashes;
- task-owned subagents with structured cancellation;
- hooks at the request, tool and compaction boundaries.

AITP provides the method on top:

- the seven Skills;
- the ownership rules of research notes;
- evidence and review labels;
- the agreement boundary;
- independent process review;
- distillation of reusable procedures.

## What is preserved from AITP

These commitments are the product. The runtime must make them easier to keep, never weaker.

1. **The note is the account.** `research.md` (or an established main note) owns its question, argument,
   evidence, limits and continuation. Every summary, board row, index entry and topic page in the workbench is
   a derived view that names its source and can be rebuilt. Nothing in a database competes with a note as a
   scientific record.
2. **One owner per fact.**
   - An observation lives where it was produced.
   - Its interpretation lives where the question is answered.
   - A next action lives only in its thread's Current work entry.
   - A parent keeps a pointer (contribution and limitation), never the child's job state.
3. **No forced writes.** Writing follows AITP's timing rule: durable change in understanding, or a material
   defect in the retained account. An unchanged poll, a status answer or a routine step writes nothing.
   Read-only requests stay read-only.
4. **Agreement boundary.** Routine work within an agreement proceeds without asking. A human choice is needed
   for:
   - a new independent investigation;
   - a material change of objective or route;
   - an expensive campaign;
   - an installation, submission or publication.

   The agent presents options with a recommendation and waits. Historical permissions never authorize new
   actions.
5. **Seeds are not branches.** A new conversation or idea never creates a topic. A branch is created only on
   agreement, with its objective, approach and stopping condition recorded.
6. **Evidence labels are honest.**
   - Support is derived, source or unchecked.
   - Review is the researcher's or an agent's only.
   - Reading depth is located, AI-read or researcher-read.
   - Execution status (prepared, running, executed, independently checked) is never scientific support.
   - Importing, saving or running never advances a label by itself.
7. **Verification by a different route** before a new, changed or disputed consequential claim is relied on.
   Agreement between models is not verification.
8. **Independent process review.** The reviewer reads the session log and the files, not the author's summary.
   - It runs after compaction, at handoff, delegation or outside reliance, and on request; never every turn.
   - A substantial restructuring or migration of a main note is reviewed as a proposed change, against its
     baseline, before it is applied.
   - It edits nothing; the main agent applies valid findings.
9. **Methods live in Skills.** Demonstrated procedures become focused Skills in their established homes,
   revised from use. There is no card format, trial ledger or fixed number of trials. Installation and
   publication are separate decisions.
10. **Ordinary files and links.** Notes stay ordinary Markdown (or an established TeX main note) with relative
    links, readable in Obsidian and by other hosts.

Workspace conventions are **policy, not protocol**. Examples are English research notes and the JHEP template for
every PDF (both from this workspace's `topics/AGENTS.md`). The agent reads them as applicable instructions
(04 §3) and does not hard-code them.

## What changes

| Before (protocol) | After (agent and workbench) |
| --- | --- |
| Rules are instructions a host model may or may not follow | Ownership, authorization, scope and write safety are enforced by the runtime; the Skills keep the judgment |
| Context recovery depends on each host's reading | Context is assembled per session by a declared policy, recorded, and visible to the researcher |
| Status is reconstructed by asking | The board shows every live thread with its owner, state and last change, derived from the notes |
| Runs are tracked in prose | Run owners, receipts and job ids are surfaced beside their threads; cluster state is queried read-only on request |
| Parallel work depends on a host's subagent feature | Durable controllers run workers with distinct roles, models and tools; one integrator writes shared notes |
| Review is triggered by a reminder | The runtime owns compaction and starts the reviewer then, with the complete log; a substantial restructuring is reviewed as a proposed change before it is applied |
| Methods are found if the model remembers them | The method library is indexed; matching procedures are offered at use time; corrections flow back into Skills |
| A chat window | A workspace: topic tree, board, notes with mathematics, reading split view, code, runs, figures, agent dock |

## Version 1

Version 1 must be usable on the researcher's real projects. "Usable" means the golden scenarios from the
survey pass. Generic forms of those scenarios:

1. **Projects:** open a project grouping and its topics and see their real structure and live threads; no
   invented summaries.
2. **Status:** ask where a topic stands and get an answer assembled from the records alone, with sources,
   observation times and no edits.
3. **Sessions:** start or resume a session in a branch, with a visible, recorded context: the branch opening
   and Current work, the parent's using passage and the selected materials.
4. **Theory:** in the derivation workspace, open a passage beside its premises, conventions and cited source;
   mark a disputed step and ask for an independent route, a limiting case or a completion audit. Mathematics is
   rendered. In a topic or thread whose scope forbids numerical work, no execution tool is offered.
5. **Computation:**
   - analyse retained outputs with a sandboxed script, with figures and their provenance shown;
   - see a campaign's coverage, failures and read-back evidence separately from scheduler state;
   - query cluster job state read-only;
   - anything that submits, installs or pushes asks first.
6. **Code:**
   - trace a formula to code lines in a specific checkout and working-tree version;
   - make a scoped change, review its diff, and run an authorized build or test with a receipt;
   - see each checkout's branch and state.
7. **Literature:**
   - discover and compare sources (editions, duplicates, citation trails, conventions);
   - read a library PDF at a cited, edition-bound locator beside its paper map;
   - write a section note from the template with honest labels.
8. **Learning:** explanations as requested, with optional reproduction exercises that check the learner's step
   and claim no mastery.
9. **Writing:**
   - edit notes through anchored edits and multi-file change sets, with conflict detection;
   - work on a manuscript project (sources, bibliography, figures, build) with paragraph-level review;
   - build JHEP PDFs where the workspace requires them.
10. **Workflows:** a matching method is offered at the point of decision. After a validated use, a correction
    or a failure, a revision of that Skill is proposed or made within the task's authorization, with the
    instance as evidence. Nothing is installed or published.
11. **Safety:**
    - concurrent external edits are detected, and the version found is preserved where it could be captured;
      the remaining races are documented;
    - a restructuring is reviewed before it is applied;
    - a compaction starts one independent review.
12. **Live GPT first:** the first integrated milestone is a read-only GPT session on a real topic, compared with
    the researcher's existing Codex workflow before the rest is expanded.

## Non-goals for version 1

- Multiple users, accounts or remote hosting.
- Replacing Obsidian, VS Code or Codex; the workbench coexists with them on the same files.
- Autonomous campaigns: no job submission, cancellation, installation, push or publication without an explicit
  grant.
- Vector databases or embedding search; AITP reads by links and bounded search.
- Automatic creation of topics, branches, atoms or installed Skills.
- A general-purpose coding agent beyond what research code work needs.

## Design rules used to settle choices

- **Derived, sourced, rebuildable.** Any structure the runtime extracts from notes carries the source path,
  content hash and line range, and the UI can always show the source text. Semantic extractions ("the current
  answer") are labelled as such and never replace the source passage.
- **Instructions are not data.** The researcher's instructions (AITP Skills, workspace and repository
  instruction files) are delivered as instructions. Research notes, papers, files and web text are delivered as
  data the model reasons about, never as instructions.
- **Honest guarantees.** Each mechanism states what it actually guarantees. For example, writes are serialized
  among AITP writers, while external editors get detection and preservation rather than prevention.
- **Tolerant reading, strict writing.** Parse generously; when structure is uncertain, show the note itself.
  Write only through anchored, hash-checked edits.
- **Bounded by construction.**
  - No full tree walks.
  - Size limits on reads.
  - Large data handled by scripts, never pasted into model context.
- **Record what the model saw.** Every model-visible piece of memory is recorded in the session log with its
  source.
- **Ask at real decision points only.** Consequential choices and outward actions; never ordinary edits within
  an agreement.
- **Prefer the researcher's existing homes.** Notes, READMEs, run owners, Skills and the knowledge collection;
  no parallel stores of research content.
