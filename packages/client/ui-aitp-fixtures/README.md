---
description: "Labelled synthetic providers for the aitp-agent research views; development only."
kind: "package-reference"
---

# AITP UI development fixture

## Summary

Build and check the aitp-agent research views before the research runtime serves their data. Use this package only in development: it provides a small synthetic research Workspace and demonstration Session memory through the same resource protocols the views read, and every value it serves is labelled as fixture data on screen.

## Use and behavior

The shipped Web composition keeps this plugin disabled. Enable it with the development overlay after the AITP Web overlay:

```sh
pnpm aitp-agent web --patch apps/cli/config/aitp-ui-fixtures.cordis.patch.yml
```

The plugin registers an asynchronous `ResearchWorkspaceAdapter` through `researchWorkspaces`. Each Harness Workspace receives independent demonstration state: a project with a recorded summary, three research directions and two ideas to explore; four top-level topics, one without a direction; and branches to four levels with long titles, recorded contributions, an alternative route, superseded, dormant and paused work, and one choice awaiting the researcher. Materials include generated Markdown accounts, a control report and a derivation with mathematics, a plain-text data table, an unavailable paper and a linked-only code resource. Parent-scoped lists use a page size of three, so the topic and branch lists continue on request; one parent names a branch that cannot be read, and its list is marked partial with the reason. Reads support cancellation, observed revisions and explicit missing/unsupported results. The fixed fixture clock advances with operations, so a retained read keeps its original observation time.

Scope and qualified-answer changes pass through preview and apply. The adapter checks the original revision, reuses an acknowledged result for an identical operation retry, rejects identity reuse with different intent, and emits invalidations after application. Full accounts and topic cards derive from the same owning topic. Other mutation commands return `unsupported`. Preview identities belong to one adapter lifetime; an old preview is not accepted after provider replacement. Reload discards every demonstration change.

The original `aitp-topics`, `aitp-topic`, `aitp-note` and `aitp-session` fixture protocols remain available for legacy readers. They retain their separate note-projection example, including a family map and a long-titled learning story. Every Session receives the same explicitly labelled demonstration memory; it is not the real model context.

The workspace bridge follows actual fixture invalidations through the framework resource service. Legacy streams yield one frame and remain open until release. Neither route reads real files or sends a model request.

## Further Exploration

- [Research views](../ui-aitp-research/README.md)
- [Session research memory views](../ui-aitp-session/README.md)

## Model Experience

None, as this package serves display data to browser views and does not contribute to model requests.

#### KV Cache effect

None; this package does not assemble model requests.

## Known Limitations and Deferred Work

- Never enable this plugin with real research work: its topics and memory are invented, and every Session shows the same demonstration memory.
- The provider implements no durable journal, backend permission service, network reconnect recovery or production write semantics.
- Browser plugins receive no row configuration; the explicit overlay selects the fixture. It is disabled by default and registers both workspace and legacy demonstration routes when enabled.
