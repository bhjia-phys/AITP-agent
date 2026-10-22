# 07. Local API

> **Current researcher instruction (2026-10-21): hash-related checks are disabled, including runtime file-version, conflict and approval-digest checks.** Legacy digest fields are optional historical metadata and never authorize, reject, match or certify content. This supersedes the hash-based requirements below. Current reads and explicit refresh replace checksum freshness checks; authority-bearing writes remain unavailable in the present slice. Stable opaque IDs and provider authentication protocols are separate from content-integrity checks.

The workbench talks to the runtime only through this API. **The route table `ROUTES` in
`@aitp/protocol` (`src/api/routes.ts`) is normative.** For every route it gives the schemas for path
parameters, query, body and response, the error codes, and the stream implementing the service. The tables
below summarize it.

- The server validates every request and response.
- Paths are under `/api`.
- File parameters are workspace-relative or absolute under a configured root, URL-encoded and path-guarded
  (02).
- Every mutating request carries a `requestId` (in the body, or the query for `DELETE`). A repeat with the same
  body fingerprint returns the original result; a repeat with a different body fails with `request_reused`.

## Authentication and health

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/auth/exchange` | Body `{ token }`; sets the `aitp_session` cookie |
| `GET` | `/api/health` | `{ ok, version, faux, uptimeSec }` (unauthenticated) |
| `GET` `PUT` | `/api/config` | Configuration without secrets; validated update |
| `GET` | `/api/doctor` | Checks |

## Research model

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/locations` | `ResearchLocation[]` |
| `GET` | `/api/graph` | Nodes, typed edges and the navigation projection |
| `GET` | `/api/groupings` | Groupings with their source sections |
| `GET` | `/api/locations/outline?path=` | Outline (opening, headings, Current work entries with spans and suggestions, links, plans, scope flags) |
| `GET` | `/api/instructions?path=&task=` | Resolved instruction sources (03 §4) with spans and versions |
| `GET` | `/api/board?state=&grouping=&owner=` | `ThreadRow[]` |
| `GET` | `/api/inbox` | `InboxItem[]` |
| `GET` | `/api/search?q=&scope=&limit=` | Hits with path, heading, snippet, span |
| `GET` | `/api/where-used?ref=` | Uses of a `ResourceRef`, plus unknown relationships |
| `GET` | `/api/files/raw?path=` | Bytes (PDF with range support, images, text), capped |
| `GET` | `/api/files/list?path=` | Entries; refuses directories with more than 2,000 entries unless `force=1` |
| `GET` | `/api/notes?path=` | `{ text, version, format }` |
| `GET` | `/api/notes/history?path=` | Versions AITP observed or wrote, plus the git log when tracked |
| `GET` | `/api/snapshots/:hash` | Snapshot text |

## Change sets

| Method | Path | Body or result |
| --- | --- | --- |
| `POST` | `/api/changes/preview` | `{ ops: DocumentOp[], reason, writer }` → `{ changeSetId, diff, checks: PreservationCheck[], warnings }` |
| `POST` | `/api/changes/:id/apply` | `{ requestId }` → `ApplyResult` (`applied`, `conflict` with base, current and merge, `ambiguous-anchor`, `denied`, `review-required`, `recovery-required`), each with an outcome per file |
| `GET` | `/api/changes/:id` | Change set, its status and, after an interrupted application, its `RecoverySummary` (journals stay internal) |

## Knowledge, works and literature

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/knowledge/areas`, `/api/knowledge/entries?…`, `/api/knowledge/entry?path=` | Areas, entries, an entry with frontmatter and passage labels |
| `GET` | `/api/works/:key`, `/api/editions/:id` | `Work`, `Edition` with artifacts |
| `GET` | `/api/locators/resolve?edition=&locator=` | Typed locator candidates (PDF page, printed page, section, equation, TeX label) |
| `POST` | `/api/literature/search` | `{ query, sources: ("arxiv" \| "inspire" \| "crossref" \| "local")[] }` → results grouped by work, with editions, duplicates and local artifacts |
| `POST` | `/api/literature/import-preview` | `{ edition }` → files to fetch, destinations, map stub; applying it is an action |

## Methods and distillation

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/methods` | `MethodRecord[]` |
| `GET` | `/api/methods/detail?path=` | The record, its use records and its distillation proposals |
| `GET` | `/api/proposals` | `DistillationProposal[]`; deciding one is a card response |

## Code, runs, campaigns, artifacts, episodes

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/checkouts?location=`, `/api/checkouts/state?path=` | Checkout records; fresh state |
| `GET` | `/api/code/tree`, `/api/code/file?path=&from=&to=`, `/api/code/search`, `/api/code/log`, `/api/code/diff`, `/api/code/symbols` | As named; files return `FileVersion`; symbols are labelled approximate |
| `GET` | `/api/receipts?location=&checkout=` | Build and test receipts |
| `GET` | `/api/runs?location=`, `/api/runs/detail?path=` | Run owners |
| `GET` | `/api/campaigns?location=`, `/api/campaigns/detail?path=` | Coverage with source spans, failed cases, read-back evidence |
| `POST` | `/api/clusters/:name/observe` | `{ jobIds? }` → a stamped observation; needs the read default or a grant |
| `GET` | `/api/artifacts?session=&location=`, `/api/artifacts/:id`, `/api/artifacts/:id/file` | Artifacts with provenance |
| `GET` | `/api/episodes?location=&q=` | Episodes (lower authority), with staleness |

## Manuscripts

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/manuscripts`, `/api/manuscripts/:id` | Projects: sources, bibliography, figures, build recipe, outputs |
| `GET` `POST` `PATCH` | `/api/manuscripts/:id/threads` | Paragraph review threads bound to source span hashes |
| `POST` | `/api/manuscripts/:id/build` | Creates a build action; returns the action id |

## Sessions and tasks

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/api/sessions?location=&kind=&archived=` | — | `SessionMeta[]` |
| `POST` | `/api/sessions` | `{ location, kind, mode, title?, edition?, checkout?, scope? }` | `SessionMeta` |
| `GET` | `/api/sessions/:id` | — | Metadata, active task, current manifest, changes since last seen |
| `PATCH` | `/api/sessions/:id` | `{ title?, mode?, archived?, seen? }` | `SessionMeta` |
| `POST` | `/api/sessions/:id/messages` | `InputSubmission`: `{ purpose: "task" \| "interjection" \| "continue", delivery: "steer" \| "follow-up" \| "reject", content: ContentBlock[], scope?: FrozenRef[], requestId }` | `SubmissionReceipt` (admitted; placement follows on the WebSocket) |
| `POST` | `/api/sessions/:id/continue` | `{ delivery, requestId }` | `SubmissionReceipt` (resumes the active task) |
| `POST` | `/api/sessions/:id/abort` | — | `{ ok }` |
| `GET` | `/api/sessions/:id/context?at=` | — | Model context and manifest as of an entry |
| `POST` | `/api/sessions/:id/compact` | `{ instructions? }` | `{ taskId }` |
| `GET` | `/api/sessions/:id/export` | — | `aitp.workbench-log@1` (09 §11) |
| `POST` | `/api/sessions/:id/cards/:cardId/respond` | `{ response, requestId }` | `{ ok }` (idempotent per card) |
| `POST` | `/api/attachments` | Multipart | `{ attachmentId }` |
| `GET` | `/api/tasks` | — | Task graph (controllers, workers, reviews, compactions, queued admissions) |
| `POST` | `/api/tasks/:id/steer`, `/api/tasks/:id/stop` | `{ text?, requestId }` | `{ ok }` |
| `POST` | `/api/tasks/:id/retry` | `{ requestId }` | `{ task, retryOf }`: a new task (Pi cannot revive a terminal one) |

## Actions, grants, reviews

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/actions?state=&session=` | `ActionRecord[]` |
| `GET` | `/api/actions/:id` | One record with its binding and history |
| `POST` | `/api/actions/:id/decide` | `{ decision: "approve" \| "deny", scope, limits?, requestId }` → updated record (bound to the action's normalized arguments and target versions) |
| `POST` | `/api/actions/:id/reconcile` | `{ requestId }`: the runtime looks for the effect by its operation id. Conclusive evidence moves an `uncertain` record to `done` or `failed`; inconclusive evidence leaves it `uncertain` |
| `GET` `POST` `DELETE` | `/api/grants`, `/api/grants/:id` | List, create, revoke |
| `GET` | `/api/reviews?session=` | Review requests, reports and coverage |

## Models

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/models` | Providers, models, auth state, configured roles |
| `POST` | `/api/auth/login`, `/api/auth/login/:id/respond`, `/api/auth/logout` | pi-ai login flows; events over WebSocket |

## WebSocket `/api/ws`

Envelope: `{ epoch, seq, at, type, payload }`.

- `epoch` changes when the server restarts or when it drops a client's backlog. A client seeing a new epoch
  discards its local state for each subscribed topic and applies the snapshot that follows.
- `seq` increases within an epoch.
- Clients subscribe with `{ type: "subscribe", topics, lastSeq?, epoch? }`.
- Duplicates (the same `seq`) are ignored.

| Event | Payload |
| --- | --- |
| `session.snapshot` | Full view after (re)subscription: entries, live generation, tools, cards, active task, manifest |
| `session.entry`, `session.partial`, `session.tool`, `session.card`, `session.state`, `session.manifest`, `session.active-task`, `session.error` | As named; partial deltas are best-effort, and committed entries are authoritative |
| `reset` | Sent with a new epoch, before the replacement snapshots of the listed topics |
| `action.changed` | `ActionRecord` transition |
| `changes.changed` | Change set status (previewed, review-required, ready, applying, applied, conflict, recovery-required, abandoned) |
| `tasks.graph` | Task graph snapshot or delta |
| `inbox.changed`, `board.changed`, `note.changed`, `instructions.changed` | Invalidations with keys |
| `login.event`, `login.prompt` | pi-ai login events and prompts |
| `server.notice` | Index rebuilds, storage failures, restarts |

## Errors

`{ "error": { "code", "message", "details?" } }`

| Code | HTTP | Meaning |
| --- | --- | --- |
| `unauthorized` | 401 | Missing or invalid cookie or token |
| `forbidden_path` | 403 | Outside the roots, a hidden path, or a write outside policy |
| `denied` | 403 | A grant, scope, ownership or binding check refused the action |
| `not_found` | 404 | No such resource |
| `conflict` | 409 | Version mismatch on write |
| `stale_version` | 409 | A scope item, approval or preview refers to an outdated version |
| `ambiguous_anchor` | 409 | An anchor matched more than once |
| `review_required` | 409 | A restructuring needs its review before application |
| `uncertain_effect` | 409 | An external effect must be reconciled first |
| `busy` | 409 | Admission queue full, or session busy with reject-when-busy |
| `invalid` | 422 | Schema validation failed |
| `unavailable` | 503 | Provider, cluster or tool unavailable |
| `internal` | 500 | Unexpected; logged with a request id |
