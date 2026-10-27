---
description: "Session task card, origin and Sources & memory page for aitp-agent, read from the aitp-session resource."
kind: "package-reference"
---

# AITP Session research memory views

## Summary

See what a Session's research work rests on while you work in it. Use this package in the aitp-agent Web application to keep the task in view above the composer, to see where the Session started, and to open a page that separates your instructions, the agent's provisional notes, gaps, rules in effect, sources and generated summaries. The views only read; they change neither the Session nor its requests.

## Use and behavior

The plugin contributes three Session views, all fed by the `aitp-session` resource at `dsh-resource://aitp-session/session/<session>`:

- A header action shows where the Session started (topic and thread, a source, or global) and opens Sources & memory. The origin text yields first when the title row narrows.
- A task card joins the composer's context stack ahead of Todo and Goal. It shows the task in one line, counts of the researcher's other items and active agent notes, the first gap, a saved rule not yet used, and the number of generated summaries. Details expands the researcher's words, active agent notes and gaps.
- The Sources & memory dock page lists the researcher's instructions verbatim with their turns, gaps with their requirement level, rules with their actual adoption, agent working notes (superseded ones stay visible and labelled), sources with their availability, and generated summaries.

Provenance is shown by both label and rule style: researcher items use a solid accent rule and the reading face, agent items a dashed rule labelled provisional, summaries a dotted rule, and gaps the warning color. Source availability keeps found, attached, in context now, condensed, missing and link-only distinct, and each source states why it is present. Opening a note source uses the `aitp-note` dock tab from the Research views package.

With no provider or no research origin, the header action and task card render nothing, so Harness is unchanged, and an open page says research memory is not connected. A failed first read shows its code in place; a later failure keeps the last value beside a notice. Fixture values are labelled.

Opening Sources & memory from an embedded research discussion navigates to that same Session's ordinary Conversation and opens its memory tab when the native dock is ready. The button remains bound to the Session it describes. A later open request or plugin unload cancels an earlier request that has not yet reached its dock.

## Further Exploration

- [Research views](../ui-aitp-research/README.md)
- [Development fixture](../ui-aitp-fixtures/README.md)
- [Research memory semantics](../../../docs/agent/11-research-memory.md)
- [Interface design](../../../docs/agent/12-desktop-interface.md)

## Model Experience

None, as this package displays a projection of the Session's research memory and does not contribute to model requests.

#### KV Cache effect

None; this package does not assemble model requests.

## Known Limitations and Deferred Work

- The optional real `ui-aitp-backend` provider projects existing Session events and registered message projections, including cold persisted Sessions. Exact request-context snapshots stay separate from current source files; a source link alone has unknown availability. Empty or ordinary Sessions publish explicit null values, and bounded output reports omissions. No rule adoption is inferred from prose.
- The underlying history API is not paginated and can load a complete cold Session before projected output is bounded.
- The views are read-only: adopting, editing or retiring a rule, answering a gap and correcting an agent note have no actions yet.
- How the task card and the Goal bar coexist when a Session has both is an open design decision recorded in the interface design.
