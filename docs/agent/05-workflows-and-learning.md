# 05. Workflows and learning

The agent should become more effective by learning from the structure of the research it assists. AITP
already states how a procedure becomes reusable (`aitp-distill`, `method-library.md`):

- use, notice a reusable choice, write or revise one Skill, check it on a concrete different use;
- keep it in its established home;
- no card format, trial ledger, registry or fixed trial count;
- installation and publication are separate decisions.

The survey found that most of the researcher's reusable procedures are already written down. The missing
capability is **use at the point of decision**, and **correction from what actually happened**.

Internalization is therefore measured in *decisions*, not in stored items. The agent has internalized a
workflow when:

1. at a consequential choice it retrieves the relevant method and checks its assumptions against the case;
2. it performs the method's decisive check, or explains the justified adaptation;
3. after a useful failure or correction it repairs the method within the existing authorization;
4. on a suitable different instance, the revised method changes the decision appropriately, including rejecting
   an inapplicable case.

This follows `aitp-distill`'s concrete-use requirement and invents no training protocol.

## 1. Forms

| Form | Home | Notes |
| --- | --- | --- |
| Skill | `plugins/aitp/skills/aitp-research/methods/<domain>/<method>/SKILL.md` (general, shareable) or `<topic or family>/skills/<method>/SKILL.md` (topic-specific or unreviewed) | The procedure: task, required information, decisive steps and choices, checks, limits, a locator to the motivating example and its validation boundary |
| Methodological pattern | Inside the Skill or domain README it qualifies | A short rule; never a separate store |
| External skill set | Its own repository (configured, read-only) | Indexed; used like any Skill; never edited by the workbench |

**Multi-role workflows** (a derivation worker, a code checker, an independent reference, an integrator) are
described in ordinary Skill prose: roles, the checks to fix before running, and the stopping condition. The agent
turns that prose into a reviewable worker plan with `propose_plan` (04 §9). Executable workflow metadata is not
part of version 1. If a concrete workflow later needs it, it will be advisory, versioned, validated strictly
(malformed fields rejected, not ignored), and it will never grant permissions.

## 2. Retrieval at the point of decision

`find_methods(task, location?)` ranks `MethodRecord`s by **applicability first**:

1. **Location fit:** methods linked from the location's family README or living under its topic, then its
   domain's methods, then core Skills.
2. **Task fit:** lexical match of the task and its consequential choice against the name, description and
   headings (BM25 over the index).
3. **Located evidence:** validated uses and corrections in this topic or domain, with locations, raise the
   rank. A `contradicted` or `failed` record against the *current version* of the Skill lowers it and is shown
   beside the result, with the version and conditions.
4. **Never popularity.** Being read or followed often does not raise the rank.

The runtime calls `find_methods` at the points where AITP expects a method to matter: planning a computation,
choosing an algorithm or route, a failed check or discrepancy, a close reading. The results (at most eight) enter
the `skills` instruction section. The agent loads a body with `read_skill` when it decides to use it. The
workbench shows the methods in play as chips in the agent dock.

## 3. Records of use

Use records are runtime evidence about a Skill, never content of it:

- **Recorded automatically:** `read_skill` calls, and plans that cite a method.
- **Recorded at a natural pause:** outcomes the agent reports, each with evidence references and the Skill's
  version.

| Outcome | Meaning |
| --- | --- |
| `followed` | The procedure was applied as written; nothing is claimed about its success |
| `validated` | The procedure's decisive check succeeded on this case, with the located evidence (run, derivation, source passage) |
| `corrected` | A step was wrong or incomplete here, and the correction is identified |
| `contradicted` | The evidence contradicts the procedure under its stated conditions |
| `not-applicable` | Its conditions did not hold; it was set aside |
| `failed` | It did not achieve its purpose, for reasons not yet understood |

Routine recording is automatic. Commentary is exceptional, and only where an outcome is consequential.

## 4. Cues to distill or repair

The agent considers distillation at a natural pause, as `aitp-distill` instructs. The runtime surfaces concrete
cues in the close step's instructions:

- a `corrected`, `contradicted` or `failed` record in this session;
- a changed assumption that a used Skill relied on;
- a validated multi-step procedure in the tool trace with no matching Skill;
- a transfer opportunity: a validated method from another topic whose conditions appear to hold here.

The agent then does one of three things:

- revises the matching Skill within the task's authorization;
- proposes a new Skill;
- keeps the candidate and its missing check in the research note (the distill Skill's preference when the
  evidence is unclear).

A **distillation review** across sessions runs on request, or when cues accumulate. Examples: two `corrected`
or `contradicted` records against one Skill version, or the same unmatched procedure validated in two topics. It
reads episodes (03 §11) and use records, and proposes at most three revisions or new Skills. Each proposal cites
its evidence and arrives in the inbox as a proposal, never as an edit.

## 5. Applying a revision

| Home | How it is applied |
| --- | --- |
| Topic or family `skills/` (private) | Within the research task's authorization, as `aitp-distill` states ("routine retention does not require another request"), through a change set. Shown as an informational edit card with undo |
| AITP general method | Never in the live AITP checkout. It is written in the configured methods branch worktree; merging is the researcher's decision. Private motivating material stays out of the public tree |
| External skill set | Never edited; a local topic Skill can record the adaptation |

After a revision, the method page shows "transfer check pending". A transfer check is a worker session that
applies the revised Skill to a small different instance changing a consequential assumption, plus a plausible
case it should reject. Its outcome is an ordinary use record. Without a feasible transfer check, the Skill
keeps its narrow, stated scope.

## 6. How methods enter reasoning, planning, knowledge and problem solving

- **Planning.** Plan cards list the methods they rely on, by version. A departure from a matching method states
  how and why. If the plan runs, the departure is kept in the use record: `followed` with a note of the
  justified adaptation, or `corrected` when it repairs the method.
- **Problem solving.** A failed check or a discrepancy triggers retrieval of diagnostic methods for the topic and
  domain before the agent improvises.
- **Knowledge organization.**
  - A topic page shows "Methods used here" with their outcomes.
  - A method page shows where it was used, its validated cases, corrections and contradictions, and its
    transfer checks.
  - Concepts and results stay in notes and the knowledge collection, never in Skills.

## 7. Interfaces

This retained design sketch is parameterized by the resource-reference type described in [09](09-contracts.md#2-references). It is not a shipped Harness API.

```ts
type MethodUse<ResourceRef> = {
  skill: string; skillVersion: string; session: string; location: string;
  outcome: "followed" | "validated" | "corrected" | "contradicted" | "not-applicable" | "failed";
  note?: string; evidence: ResourceRef[]; at: string;
};
type DistillationProposal<ResourceRef> = {
  id: string; kind: "revise" | "new"; skill?: string; targetPath: string;
  home: "topic" | "family" | "aitp-branch"; changeSet: string;   // a previewed change set (09 §6)
  rationale: string; evidence: ResourceRef[]; status: "open" | "applied" | "declined";
};
```

## 8. Governance

- **Never by the workbench:** nothing is installed, published, merged or pushed by the workbench. Git commits and
  pushes need explicit grants.
- Writing into the live AITP checkout is never a default.
- A general Skill must be usable without the private evidence that motivated it.
- A Skill is not a store for results, summaries or theorem expositions.
