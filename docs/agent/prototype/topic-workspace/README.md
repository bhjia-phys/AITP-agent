# Topic-centred workspace prototype

This is the interactive design artifact for [16’s redesign proposal](../../16-topic-centred-redesign.md). The revised frontend shows project cards, directly reachable subtopics, topic sections and material readers. One sidebar switches between Topics and Conversations. Topic cards, Markdown previews and simulated session context share one in-memory state. It is independent HTML, not a Harness plugin or a connected research application.

## Open and inspect

Open [index.html](index.html) directly, or serve this directory with `python3 -m http.server 4176 --bind 127.0.0.1` and open `http://localhost:4176/`. `#topic` opens the main topic and `#session` opens a conversation with its topic dock. The browser may fetch hosted fonts and KaTeX; if unavailable, system fonts and readable TeX source remain. No research content is sent to those services.

Start at the project overview, open Topological Hamiltonian, select the Zeros subtopic, then Materials → Tracking the zero line. Return to Materials and the parent through the visible controls. Overview shows children and current understanding; Work & choices, Claims & routes, Materials and Activity reveal the relevant details. The full topic tree stays in the existing sidebar footprint; no second permanent column is added.

Try the six operations listed under the application: change an objective, correct a passage, mark a hypothesis unsupported, supersede a route, invalidate an assumption and record evidence at its child owner. Markdown preview shows the resulting synthetic text; a new Session reads the same state under “Context read from simulated note”. Reload resets research content and Sessions. Only theme preference uses local storage.

To inspect conflict handling, preview an objective edit, choose Simulate → External edit, then Apply. Keep the external version or prepare your version again. Apply two edits and try reverting the older one: the later edit is retained and a conflict is reported. An edit or revert marks existing Sessions stale until they reread the state. Agent replies and proposals are scripted and explicitly labelled.

## Interface for the separately developed backend

The proposed [TypeScript contract](workspace-contract.ts) reserves asynchronous project/topic/resource reads, bounded context reads, change preview and application, and change notifications. Stable topic and resource IDs carry navigation; qualified answers and limits remain separate from work status. The backend chooses storage and how existing research memory maps into these views. The contract does not require a database, a new note format or migration.

Changes cross the proposed boundary as serializable intents and version preconditions, followed by a preview ID and an application receipt. A backend adapter must enforce identity, authorization, concurrency and retry semantics. The frontend must display loading, unavailable, stale and conflict states rather than assume a successful connection. Change events invalidate reads; they do not replace the authoritative response.

This contract is a reviewable integration target, not an implemented production service. The current HTML scenario simulator still uses local mutation/undo callbacks internally and does not implement the asynchronous port. Those callbacks must never be sent over the future interface. Connecting its controller and the real backend adapter is separate work. Existing UI-1 resource protocols are unchanged.

## Browser evidence and limits

The [browser check](browser-check.cjs) exercises objective → Markdown preview → fresh Session recovery, simulated external edits, conflict re-preparation, safe revert, active-session refresh, unsupported versus refuted, assumption qualifications, route retention, shared child-owned evidence, contextual proposals, keyboard search and seed exploration. It also covers project → topic → child → material → return navigation, keyboard topic tabs, and the single sidebar switch. Topic and conversation layouts are checked at 1920, 1440, 1024, 720 and 390 CSS pixels in both themes. The revised 2026-10-23 run passed 18 grouped scenarios with no page JavaScript errors; external font/math requests were blocked. That verifies the fallback and synthetic interactions, not the proposed asynchronous contract, backend integration or scientific validity.

Run `node browser-check.cjs` where Playwright and Chromium are available. `PLAYWRIGHT_MODULE` may select an existing Playwright installation; `BROWSER_EXECUTABLE` selects an existing Chromium binary; `SCREENSHOT_DIR` optionally saves layout captures outside the source tree. This prototype does not add an application dependency or require an artifact build.

Known limits:

- No filesystem or model connection, durable change journal, restart recovery, cross-process concurrency, real provider or research-note writes. Conflict checks conservatively compare the whole synthetic topic; production disjoint rebase remains specified, not demonstrated.
- The Markdown preview shares the synthetic state. Materials open an embedded synthetic excerpt or a details page explicitly saying that file contents are unavailable. Paths alone do not establish access. Excerpts and scripted replies must not be cited as research evidence.
- Dependency suggestions are illustrative. Impact search, scientific verification and propagation are not executed; a manual integration marker is only a demonstration of UI state.
- Statement labels are semantic view data for design review; they do not impose a note template or an adopted upstream protocol requirement.
- Pane resizing, PDF/code adapters, persistent project layouts, all proposed shortcuts and full assistive-technology testing remain unimplemented. The 720 px viewport exercises reflow similar to a narrower window; it is not certification of native 200% browser zoom.
- Previewed writes and safe revert are modeled only within one browser visit. Reload is deliberately a reset, not a demonstration of “research state outlives Sessions”. That principle requires the production storage and recovery tests in 16.

The separate UI-1 implementation branch is a comparison baseline; its historical package checks and incomplete repository-wide typecheck do not certify this prototype. Publication of this design/prototype/interface package to main is authorized; production integration remains separate as described in [16](../../16-topic-centred-redesign.md#decisions).
