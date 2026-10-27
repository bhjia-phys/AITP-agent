---
description: "Topic workspace views and the asynchronous adapter boundary for aitp-agent."
kind: "package-reference"
---

# AITP Research views

English | [中文](README.zh.md)

## Summary

Browse a Workspace's project, topics, subtopics and materials, with its actual Harness conversations grouped under each direction. Reading stays in the centre; choosing or opening a discussion places the native conversation on the right. Browsing alone creates no Session or model request. The panel, contextual sidebar and material reader consume one asynchronous adapter through Harness resources. The optional development provider uses labelled synthetic data; the [research backend](../ui-aitp-backend/README.md) connects configured Markdown roots, saved records and normal Harness conversations.

## Use and behavior

The plugin adds Research to the global panel list. Selecting it shows the research map and uses `sidebar.context` for a topic outline with each direction's conversations beneath it. **All conversations** returns to the host browser. Selecting a conversation in the current direction keeps its reading surface in place; selecting another direction restores that direction's reading location. The header selects among the host's Workspaces. The map, sidebar and scoped library navigation share the existing view store; content remains in framework resources.

The right pane uses the real Conversation and Chat factories, including the native composer, model selection, attachments, queued or steering messages, streaming, stop controls and approvals. Its toolbar switches between a direction's saved conversations, explicitly creates a new blank discussion, expands the pane or closes it while retaining the native Session draft. While a discussion opens or switches, the previous conversation stays visible but cannot receive focus, input or submissions; its draft remains with that Session. A source chosen or cleared while opening remains the next message's source when loading finishes. Switching discussions without a new source choice restores each Session's own source and draft. The discussion menu renames the same native Session; accepted title events update the list without changing its topic or sending an unsent draft. Opening the discussion resumes the selected or latest matching Session when available. A new blank discussion is initially provisional; its first accepted research message records the topic binding. Native Sessions remain visible in the ordinary Harness conversation browser. Narrow windows show the same pane as an overlay that can be closed to return to reading.

Unloading Research stops new discussion openings, cancels its pending discussion-list and Session-readiness waits, and drains admitted opening work before releasing its references. A late list response cannot create a Session or initialize a draft. A native creation request already sent to the Host has no cancellation API; unload waits for its result without adopting or deleting the resulting Session.

The Topic page's Materials section exposes the optional `aitp.research.topic.libraries` extension. Installed literature, knowledge and code libraries receive the current Workspace, topic and title, retain the same topic tree and reuse the right conversation pane. The question scope stays explicit even when a source belongs elsewhere. Leaving captures the reading position; returning restores the topic's scroll offset, focused control and section state. This view state survives panel unmounts within the loaded client, not a browser reload. Research has no runtime dependency on those plugins; unloading one removes its entries and study admission handler while original research material links remain available. Only global material browsing retains the independent legacy question composer.

With the research backend connected, an unenrolled Workspace offers **Enable research project** before source reads. The researcher chooses read-only access or explicitly allows saving in the current directory. Read-only enrollment does not create a missing project account; writable initialization creates it if needed and preserves an existing one. An app-enrolled read-only project can later enable saving; a statically configured read-only root cannot be upgraded here. Browsing never enrolls a directory. Without a Workspace, **Show workspaces** returns to the host's existing browser without creating a Session.

A writable project offers **New topic** at project level and **New subdirection** for a focused or open topic. The form asks for a title, research question, optional scope and parent placement. Creation writes through the provider, retains entered text after failure, and reuses the operation identity for an unchanged retry. Drafts and pending or unconfirmed requests belong to the Workspace's shared view store, surviving topic navigation, Workspace switches and panel unmounts within the loaded client. A versioned, validated `sessionStorage` journal also preserves these attempts across reloads of the same tab: interrupted dispatches restore as uncertain, never auto-submit, and require an explicit retry of the original request. Acknowledged completion clears the journal. A partial result retains the provider's inspection guidance and opens the actual created account; hiding an unresolved form offers **Resume topic creation** instead of starting another request. Success refreshes authoritative reads, opens the new topic and its right-hand discussion; creating a topic alone sends no model request. Legacy providers without setup support keep their existing reader UI.

The map has two levels of detail. The overview shows the project, its recorded summary, one lane per research direction with its top-level topics, and the ideas to explore; nodes carry only the title, work state, recorded relation and branch count, and a node's branches open in place. Selecting a node focuses the map on that topic: its question and recorded role in the parent, a summary of the current answer with its conditions, what remains open, the next step and its materials, its branches, and the other topics at the same level. Open topic shows the topic page: the main ask action opens its native discussion on the right, the qualified answer leads the reading column, and scope sits beside it or stacks below in narrow windows. Related material rows, branches and further detail follow; More actions holds map/edit actions, and topic management and reading metadata expand on request. Materials open in a reading column. The location trail and Back connect the levels; Back restores the scroll offset and the focused control, and node, section and loaded-page choices are kept for the return. The sidebar outline opens along the current path and keeps the branches the reader opens or closes.

A topic list shows what the provider has not delivered: a further page is offered on request, children named by a parent but absent from the reading are counted, and partial pages show the provider's reason. Superseded, dormant and paused topics are drawn quietly; work status never substitutes for scientific assessment. Readable materials retain their complete text; linked-only or unsupported resources show the actual missing-content state. Fixture origin and retained readings remain visible; reading times appear at the end of each page, inside Reading details on the topic page. A missing provider is reported as disconnected; a failed refresh retains the original observed value. Arrow, Home and End keys move between map nodes; motion is limited to short fades and is removed when reduced motion is requested.

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
| `aitp-workspace-discussions` | `dsh-resource://aitp-workspace-discussions/workspace/<workspace>?topic=<topic>` | Native Session summaries for exactly this direction; omit `topic` for the project root |
| `aitp-workspace-change` | `dsh-resource://aitp-workspace-change/workspace/<workspace>?session=<session>&operation=<operation>` | Bounded receipt and recorded changes for this Session's research write operation |

Discussion lists use the adapter's optional `listDiscussions` method and return `DiscussionPage` directly. They distinguish project-root discussions from direction discussions and inspect durable binding metadata without activating every Session. A provider without this capability reports unsupported instead of inventing conversations. Expected adapter failures use `WorkspaceError`, carried by the resource bridge as `aitp/workspace` with the original structured details. Abort ends a read subscription. Invalidation and resync events cause authoritative rereads, not optimistic content replacement. Successful authoritative record or source writes invalidate the corresponding readers; streaming model text alone is not a saved scientific record. A disconnected provider retains the last successful reading beside its failure; a later provider registration wakes existing readers.

A compact change notice above the native conversation reads actual research-writer tool metadata. **View changes** loads the authenticated operation receipt on demand and uses the host diff component to show recorded before/after text. The notice distinguishes successful publication, partial or unknown outcomes, planned changes, omitted details and a source changed again since that operation. An assistant's success claim alone cannot produce a saved-record notice. Each plugin registration owns the notice's pointer cache; reload and unload release its observations, while unrelated streaming updates within that lifetime retain stable pointer identity.

Scope and answer edits use `previewChange` then `applyChange` only when the provider advertises both capabilities and the command. The UI keeps qualifications separate from answer text, displays the preview and pending integration, and claims application only after a receipt. The backend owns source mapping, current permissions, operation identity, idempotency and recovery. A lost receipt is an unknown outcome, not a confirmed failure; retry uses the same operation identity. Drafts and unresolved operations live in the shared interaction store, so closing the editor, changing topics or leaving the panel preserves recovery within the loaded client. A browser reload resets that view state; durable operation lookup and reconnect reconciliation belong to the backend. The fixture's acknowledgement explicitly means an in-memory demonstration, reset on reload.

`readContext` returns bounded source material, not proof of delivery to a model. The research backend assembles context in the existing Harness loop. The current topic, material and explicit passage selection prepare the next message in the right native composer. Forward and Back navigation update the automatic reading source; explicitly selected source sets, anchors and passages take precedence and retain the same Session and draft. Submission freezes that source context before command processing and attachment upload, then sends the native request ID, full content and queue/steer mode into the selected Session. Choosing another material afterwards cannot change a message already admitted. Failed admission retains the native draft. Source delivery remains a Host observation, not a claim made from a checkbox. Browsing and text selection alone do not send a request.

Citation clicks are routed back into the centre reader. Research resource and note addresses retain the current question direction and must name the same Workspace. Native file addresses are accepted only when they resolve to a normalized relative path inside the current Workspace; the research provider still checks permission and availability. Optional library readers handle their own address family and preserve the topic return callback. Failed owned references show an error in the discussion pane. The right pane is not replaced by a hidden source dock.

### Existing note and Session views

The previous `aitp-topics`, `aitp-topic` and `aitp-note` types remain available for original note projections. They are not the hierarchical workspace adapter. Outside the integrated research pane, the `aitp-note` dock tab still opens beside an ordinary Session, including references from Sources & memory. A host Session draft reaches the model only when the researcher sends it; the research views do not report attachments as delivered context.

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

- The development fixture and real Markdown backend are alternative providers. Research access requires explicit configured roots or app enrollment; saving remains an explicit project choice. Conversation drafts belong to the native Session input owner and survive reading-panel navigation; pane selection, expansion and reading position are client view state. New-topic recovery survives a same-tab reload when tab storage is available; closing the tab can discard this local journal, while durable operation ownership remains in the backend.
- PDF, code and data readers need their own providers; an available locator does not establish that its contents were read.
- Activity lists host Sessions only when supplied by the provider; the fixture does not invent real Session identities.
- The legacy note reader opens at the document top; exact line scrolling needs located content from its provider.
- Native prompt content, request identity and queue/steer behavior are preserved. Research-attributed messages retain the existing Host-time fallback; carrying the browser timezone into durable research attribution is deferred.
- The map draws only the primary parent hierarchy and recorded contributions. Cross-topic uses, dependencies between siblings and the evidence a topic cites from another need provider records before they can be drawn.
- Return position is restored within the loaded client; reloading the browser starts at the map overview.
