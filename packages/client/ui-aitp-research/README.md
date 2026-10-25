---
description: "Topic workspace views and the asynchronous adapter boundary for aitp-agent."
kind: "package-reference"
---

# AITP Research views

## Summary

Browse a Workspace's project, topics, subtopics and materials without opening a Session. Each topic owns its qualified answer, gap, work and material destinations. The panel, contextual sidebar and material reader consume one asynchronous adapter through Harness resources. The optional development provider uses labelled synthetic data; the optional [research backend](../ui-aitp-backend/README.md) connects configured Markdown roots and normal Harness conversations.

## Use and behavior

The plugin adds Research to the global panel list. Selecting it shows the research map and replaces the sidebar's conversation browser with a topic outline through `sidebar.context`. Conversations returns to the existing host browser. Both placements share viewing state; content remains in the resource service. The header selects among the host's Workspaces.

With the research backend connected, an unenrolled Workspace offers **Enable research project** before source reads. The researcher chooses read-only access or explicitly allows saving in the current directory. Read-only enrollment does not create a missing project account; writable initialization creates it if needed and preserves an existing one. An app-enrolled read-only project can later enable saving; a statically configured read-only root cannot be upgraded here. Browsing never enrolls a directory. Without a Workspace, **Show workspaces** returns to the host's existing browser without creating a Session.

A writable project offers **New topic** at project level and **New subdirection** for a focused or open topic. The form asks for a title, research question, optional scope and parent placement. Creation writes through the provider, retains entered text after failure, and reuses the operation identity for an unchanged retry. Drafts and pending or unconfirmed requests belong to the Workspace's shared view store, surviving topic navigation, Workspace switches and panel unmounts within the loaded client. A versioned, validated `sessionStorage` journal also preserves these attempts across reloads of the same tab: interrupted dispatches restore as uncertain, never auto-submit, and require an explicit retry of the original request. Acknowledged completion clears the journal. A partial result retains the provider's inspection guidance and opens the actual created account; hiding an unresolved form offers **Resume topic creation** instead of starting another request. Success refreshes authoritative reads, opens the new topic and focuses its question composer; creating a topic alone sends no model request. Legacy providers without setup support keep their existing reader UI.

The map has two levels of detail. The overview shows the project, its recorded summary, one lane per research direction with its top-level topics, and the ideas to explore; nodes carry only the title, work state, recorded relation and branch count, and a node's branches open in place. Selecting a node focuses the map on that topic: its question and recorded role in the parent, a summary of the current answer with its conditions, what remains open, the next step and its materials, its branches, and the other topics at the same level. Open topic shows the topic page, which leads with the question, scope and qualified answer and keeps branches, materials, claims and routes, work and choices, and activity in sections. Materials open in a reading column. The location trail and Back connect the levels; Back restores the scroll offset and the focused control, and node, section and loaded-page choices are kept for the return. The sidebar outline opens along the current path and keeps the branches the reader opens or closes.

A topic list shows what the provider has not delivered: a further page is offered on request, children named by a parent but absent from the reading are counted, and partial pages show the provider's reason. Superseded, dormant and paused topics are drawn quietly; work status never substitutes for scientific assessment. Readable materials retain their complete text; linked-only or unsupported resources show the actual missing-content state. Fixture origin and retained readings remain visible, and each page ends with its reading time. A missing provider is reported as disconnected; a failed refresh retains the original observed value. Arrow, Home and End keys move between map nodes; motion is limited to short fades and is removed when reduced motion is requested.

### Backend connection

The [typed contract](../../research/research-memory/src/types.ts) is shared with the backend and re-exported type-only from this package's `/client` entry. `WorkspaceTopicSummary` names the hierarchical topic summary there; the older `TopicSummary` export remains the legacy note projection. The contract imposes no filename, database or migration. Provider-owned IDs identify objects; the first Markdown provider uses path IDs and cannot resolve unknown renames. Revisions are opaque observations, with provider-specific edit semantics.

Structure comes only from provider records: a topic's `directionId`, its one `parentId` with `childIds`, and the optional `parentContribution`. That field states how the topic serves its parent, as recorded at the parent, with an optional `relation` of prerequisite, alternative route, control or application. Providers supply it only from an explicit record; the views show nothing when it is absent and never infer support, proof or dependency from parenthood, order or chronology. `Project.summary` is likewise optional and omitted when absent.

A browser provider injects `researchWorkspaces` and registers a factory with `ctx.researchWorkspaces.register(factory)`, returning its disposer through the provider's effect. The factory binds one `ResearchWorkspaceAdapter` to the requested Harness Workspace and the authenticated transport. The registry owns provider lifetime and adapter subscriptions. The [development provider](../ui-aitp-fixtures/README.md) is a complete in-memory example of this registration; replacing it does not require editing components.

The bridge registers these client resource protocols. Content frames are `WorkspaceRead<T>`: the adapter's unchanged read envelope plus provider capabilities. Setup is the provider's `ResearchSetup`, read before content without requiring content-read capability. Each address segment is URI-encoded; topic pagination is carried in the query string.

| Protocol | Address | Value |
| --- | --- | --- |
| `aitp-workspace-setup` | `dsh-resource://aitp-workspace-setup/workspace/<workspace>` | Enrollment, write permission and whether explicit initialization is available |
| `aitp-workspace-project` | `dsh-resource://aitp-workspace-project/workspace/<workspace>` | Project title, directions and seeds |
| `aitp-workspace-topics` | `dsh-resource://aitp-workspace-topics/workspace/<workspace>` | A page of topic summaries, with parent/child identity and completeness |
| `aitp-workspace-topic` | `dsh-resource://aitp-workspace-topic/workspace/<workspace>/topic/<topic>` | One topic's own question, qualified answer, work, statements and resources |
| `aitp-workspace-resource` | `dsh-resource://aitp-workspace-resource/workspace/<workspace>/resource/<resource>` | Exact material content or explicit unavailability |
| `aitp-workspace-activity` | `dsh-resource://aitp-workspace-activity/workspace/<workspace>/topic/<topic>` | Recorded changes, proposals and references to host Sessions |

Expected adapter failures use `WorkspaceError`, carried by the resource bridge as `aitp/workspace` with the original structured details. Abort ends a read subscription. Invalidation and resync events cause authoritative rereads, not optimistic content replacement. A disconnected provider retains the last successful reading beside its failure; a later provider registration wakes existing readers.

Scope and answer edits use `previewChange` then `applyChange` only when the provider advertises both capabilities and the command. The UI keeps qualifications separate from answer text, displays the preview and pending integration, and claims application only after a receipt. The backend owns source mapping, current permissions, operation identity, idempotency and recovery. A lost receipt is an unknown outcome, not a confirmed failure; retry uses the same operation identity. Drafts and unresolved operations live in the shared interaction store, so closing the editor, changing topics or leaving the panel preserves recovery within the loaded client. A browser reload resets that view state; durable operation lookup and reconnect reconciliation belong to the backend. The fixture's acknowledgement explicitly means an in-memory demonstration, reset on reload.

`readContext` returns bounded source material, not proof of delivery to a model. The optional research backend supplies this adapter and assembles context in the existing Harness loop. The question composer uses the current map focus, topic or material and any explicitly selected passage; submission creates a normal conversation. Its new-conversation icon, selected-passage preview, sending state and retained failed draft use the same presentation as the map. Browsing and text selection alone do not send a request.

### Existing note and Session views

The previous `aitp-topics`, `aitp-topic` and `aitp-note` types remain available for the original note projections. They are not the hierarchical workspace adapter. The `aitp-note` dock tab still opens its existing reader beside a Session, including references from Sources & memory. A host Session draft reaches the model only if the researcher sends it; the research views do not report attachments as delivered context.

## Further Exploration

- [Session research memory views](../ui-aitp-session/README.md)
- [Development fixture](../ui-aitp-fixtures/README.md)
- [Interface design](../../../docs/agent/12-desktop-interface.md)
- [Implementation plan and progress](../../../docs/agent/14-implementation-blueprint.md)

## Model Experience

Indirectly, through the optional backend: an explicitly submitted question carries its displayed topic/material and selected text to a normal Harness conversation. Browsing alone contributes no model context.

#### KV Cache effect

The backend owns request assembly and cache effects; this package supplies explicit user questions only.

## Known Limitations and Deferred Work

- The development fixture and real Markdown backend are alternative providers. Research access requires explicit configured roots or app enrollment; saving remains an explicit project choice. Question drafts remain local to the current view. New-topic recovery survives a same-tab reload when tab storage is available; the form reports unavailable storage and unreadable recovery. Closing the tab can discard this local journal; durable operation ownership remains in the backend.
- PDF, code and data readers need their own providers; an available locator does not establish that its contents were read.
- Activity lists host Sessions only when supplied by the provider; the fixture does not invent real Session identities.
- The legacy note reader opens at the document top; exact line scrolling needs located content from its provider.
- The map draws only the primary parent hierarchy and recorded contributions. Cross-topic uses, dependencies between siblings and the evidence a topic cites from another need provider records before they can be drawn.
- Return position is restored within the loaded client; reloading the browser starts at the map overview.
