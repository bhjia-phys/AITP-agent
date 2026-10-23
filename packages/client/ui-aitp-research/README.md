---
description: "Topic workspace views and the asynchronous adapter boundary for aitp-agent."
kind: "package-reference"
---

# AITP Research views

## Summary

Browse a Workspace's project, topics, subtopics and materials without opening a Session. Each topic owns its qualified answer, gap, work and material destinations. The panel, contextual sidebar and material reader consume one asynchronous adapter through Harness resources. The optional development provider uses labelled synthetic data; real storage and model-context delivery belong to separately developed backend services.

## Use and behavior

The plugin adds Research to the global panel list. Selecting it shows the project overview and replaces the sidebar's conversation browser with a topic tree through `sidebar.context`. Conversations returns to the existing host browser. Both placements share viewing state; content remains in the resource service. The header selects among the host's Workspaces. Cards, breadcrumbs and Back support project → topic → child → material → return, including nested children.

Topic tabs show Overview, Work & choices, Claims & routes, Materials and Activity. Work status never substitutes for scientific assessment. Readable materials retain their complete text; linked-only or unsupported resources show the actual missing-content state. Source time, fixture origin and retained readings remain visible. A missing provider is reported as disconnected; a failed refresh retains the original observed value.

### Backend connection

The application owns the [typed contract](src/client/workspace-contract.ts), exported type-only from this package's `/client` entry. `WorkspaceTopicSummary` names the hierarchical topic summary there; the older `TopicSummary` export remains the legacy note projection. The contract imposes no filename, database or migration. Stable IDs identify objects; revisions are opaque equality tokens.

A browser provider injects `researchWorkspaces` and registers a factory with `ctx.researchWorkspaces.register(factory)`, returning its disposer through the provider's effect. The factory binds one `ResearchWorkspaceAdapter` to the requested Harness Workspace and the authenticated transport. The registry owns provider lifetime and adapter subscriptions. The [development provider](../ui-aitp-fixtures/README.md) is a complete in-memory example of this registration; replacing it does not require editing components.

The bridge registers these client resource protocols. Every successful frame is `WorkspaceRead<T>`: the adapter's unchanged read envelope plus provider capabilities. Each address segment is URI-encoded; topic pagination is carried in the query string.

| Protocol | Address | Value |
| --- | --- | --- |
| `aitp-workspace-project` | `dsh-resource://aitp-workspace-project/workspace/<workspace>` | Project title, directions and seeds |
| `aitp-workspace-topics` | `dsh-resource://aitp-workspace-topics/workspace/<workspace>` | A page of topic summaries, with parent/child identity and completeness |
| `aitp-workspace-topic` | `dsh-resource://aitp-workspace-topic/workspace/<workspace>/topic/<topic>` | One topic's own question, qualified answer, work, statements and resources |
| `aitp-workspace-resource` | `dsh-resource://aitp-workspace-resource/workspace/<workspace>/resource/<resource>` | Exact material content or explicit unavailability |
| `aitp-workspace-activity` | `dsh-resource://aitp-workspace-activity/workspace/<workspace>/topic/<topic>` | Recorded changes, proposals and references to host Sessions |

Expected adapter failures use `WorkspaceError`, carried by the resource bridge as `aitp/workspace` with the original structured details. Abort ends a read subscription. Invalidation and resync events cause authoritative rereads, not optimistic content replacement. A disconnected provider retains the last successful reading beside its failure; a later provider registration wakes existing readers.

Scope and answer edits use `previewChange` then `applyChange` only when the provider advertises both capabilities and the command. The UI keeps qualifications separate from answer text, displays the preview and pending integration, and claims application only after a receipt. The backend owns identity, permission, revision checks, idempotency and recovery. A lost receipt is an unknown outcome, not a confirmed failure; retry uses the same operation identity. Drafts and unresolved operations live in the shared interaction store, so closing the editor, changing topics or leaving the panel preserves recovery within the loaded client. A browser reload resets that view state; durable operation lookup and reconnect reconciliation belong to the backend. The fixture's acknowledgement explicitly means an in-memory demonstration, reset on reload.

`readContext` returns bounded source material, not proof of delivery to a model. The browser provider does not create a second agent loop or implement research-memory persistence. Backend work can implement reads and memory independently, then supply this adapter once its transport is ready.

### Existing note and Session views

The previous `aitp-topics`, `aitp-topic` and `aitp-note` types remain available for the original note projections. They are not the hierarchical workspace adapter. The `aitp-note` dock tab still opens its existing reader beside a Session, including references from Sources & memory. A host Session draft reaches the model only if the researcher sends it; the research views do not report attachments as delivered context.

## Further Exploration

- [Session research memory views](../ui-aitp-session/README.md)
- [Development fixture](../ui-aitp-fixtures/README.md)
- [Interface design](../../../docs/agent/12-desktop-interface.md)
- [Implementation plan and progress](../../../docs/agent/14-implementation-blueprint.md)

## Model Experience

None, as this package reads research content for display and does not contribute to model requests. A Session draft it opens reaches the model only when the researcher sends it, as ordinary user text.

#### KV Cache effect

None; this package does not assemble model requests.

## Known Limitations and Deferred Work

- The development fixture is the only workspace adapter shipped here. Real filesystem access, durable writing, reconnect recovery and model-context delivery require backend integration and separate acceptance.
- PDF, code and data readers need their own providers; an available locator does not establish that its contents were read.
- Activity lists host Sessions only when supplied by the provider; the fixture does not invent real Session identities.
- The legacy note reader opens at the document top; exact line scrolling needs located content from its provider.
