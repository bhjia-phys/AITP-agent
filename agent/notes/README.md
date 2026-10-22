# Implementation notes

[14 Development plan](../../docs/agent/14-implementation-blueprint.md) owns current
progress and stage priority. These notes retain implementation details, deviations
and exact validation receipts; link them from the plan and affected
[research cases](../../docs/agent/13-research-journeys.md). Do not create a second
status ledger or per-turn log here. The stream-report conventions below describe
the retained implementation evidence and apply when those streams are used.

Each stream part ends with `notes/<stream>-<part>.md` (for example `S2-A.md`), owned by that stream. The
integrator keeps `integration.md` and the cross-cutting `review-*.md` evidence records.
The [2026-10-22 design review](review-2026-10-22.md) records synthetic reproductions
imported from the original worktree, with its availability and evidence limits.

A part's notes state:

1. **What was implemented**, by module.
2. **Deviations** from `docs/agent/`, each with its reason.
3. **Integration requests**: contract changes, exports, dependencies or changes in another stream's paths that
   the part needed. Name the temporary mock used meanwhile.
4. **Commands run** and their results, copied, not summarized.
5. **Known gaps.**
6. **Acceptance.** For each acceptance item of the part (`docs/agent/08` §5), what demonstrates it:
   - a fixture test;
   - a scripted faux session;
   - a walkthrough;
   - an independent session;
   - live researcher use.

Passing packaging tests does not establish scientific correctness; the notes never claim it.
