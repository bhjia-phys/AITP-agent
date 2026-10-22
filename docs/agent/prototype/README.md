# AITP research workbench — interaction prototype

This is an isolated, static **design artifact**, not the AITP application. It makes the desktop research workflow reviewable before implementation: project → qualified research thread → source passage → scoped conversation → proposed note change.

All research records, conversation history, run labels, commits and diffs are synthetic. Nothing in this interface establishes a scientific result. The static teaching pages and residual definition are explicitly authored UI illustrations; they are not publication excerpts or additions to the source notes. The unverified trace argument in the input fixture is deliberately not rendered.

## Open locally

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/docs/agent/prototype/>. Stop the server with Ctrl+C when finished. Serve the repository root so the already installed fonts under `agent/node_modules` resolve. No install or build is required; system font fallbacks work if those font assets are absent.

`index.html` loads the existing `data.js`, the existing `app.css`, and the prototype's `app.js` / `prototype.css`. The prototype does not modify `app.css`, `build-data.ts`, `data.js` or `illustrative.json`. It does not connect to the application server, a model provider or an external service. All interaction state lives in the page's memory and resets on reload; resource URL-fragment links can be reopened directly. It uses no browser storage, cookies or service worker.

## Review the main route

1. Start in **Spectra research**. The overview retains the two source openings, including their uncertainty and qualification. Open **Mixing schedule**; its full Current work passage includes the two-case result and third-case continuation boundary.
2. Open **Read source note**. The original opening remains visible. A separate, explicitly synthetic teaching passage defines the residual and distinguishes a stopping condition from grid refinement.
3. Choose **Work on this passage**. Inspect the exact selected text, source locator, task and project owner before opening a simulated session.
4. The session opens beside the source. Its original task and selection stay visible. Open **Preview proposal** to inspect the deterministic illustrative note addition. **Mark reviewed · demo** changes only a local label; no apply, write or execution operation exists.
5. Open the **Library** and its paper illustration. The actual fixture PDF is unavailable. The interface instead supplies two clearly labelled static pages with edition, page and named passages. Use **Discuss definition 1**, **Discuss passage A**, or select text and choose **Ask about selection**. A paper or knowledge draft defaults to **Global collection**, with an explicit optional project selector; it never inherits the last visited project.

The side rail independently opens Explorer, Library, Knowledge, Notes, Code & Git, and Conversations. Source notes, paper illustrations, knowledge metadata, code samples and conversations are editor tabs. The inspector is closed initially; use the upper-right control to reveal provenance and related conversations. The illustration supports two editor groups and a toggleable activity panel.

| Interaction | Control |
| --- | --- |
| Search resources and commands | Ctrl/⌘ K; ↑/↓; Enter; Escape |
| Split editor / focus other group | Ctrl/⌘ Backslash |
| Navigation history | Alt Left / Alt Right; titlebar arrows |
| Sidebar | Ctrl/⌘ B |
| Activity panel | Ctrl/⌘ J |
| Add a simulated message | Ctrl/⌘ Enter in the composer |
| Light / dark appearance | Moon/sun in the rail; Settings |

Dialogs trap focus and Escape closes them. Buttons have accessible labels; focus indicators and reduced-motion behavior are present. This is not a complete screen-reader or browser compatibility audit.

## Browser check and screenshots

The smoke script serves only local static files, launches the already installed Chrome, saves synthetic screenshots, and closes both browser and server in `finally`. It installs nothing. It asserts that all page requests are local GETs and records page/network errors.

```sh
NODE_OPTIONS=--max-old-space-size=1024 \
  flock "${AITP_HEAVY_LOCK:-/tmp/aitp-agent-heavy.lock}" \
  node docs/agent/prototype/smoke.mjs
```

Set `AITP_CHROME=/path/to/chrome` to an existing Chrome/Chromium executable before running the command. `AITP_BROWSER_LIBS` optionally supplies extra library directories; no workstation-specific default is used. Puppeteer is loaded from the existing `agent/node_modules`; this static UI itself has no runtime dependency on Puppeteer.

The browser check exercises the qualified project/thread displays, thread-owned task creation, two-group navigation, simulated composer, themes, independent resource views, exact paper edition/page/passage context with global ownership, note selection and proposed-change preview, code files/diffs/history, local review marking, search and navigation history, and empty search/filter states. It rejects a selection made in the left note when a right-paper action is clicked, then accepts a selection from the matching paper. At 1024 pixels it checks usable editor widths and visible headings/source passages in both groups, not merely absence of overflow, and verifies that closing the split restores the sidebar. It also checks that the invalid illustrative trace explanation is absent.

Representative screens:

- [Project · light](screenshots/01-project-light.png), [thread/session split](screenshots/03-thread-session-split.png), [session · dark](screenshots/04-session-dark.png)
- [Static source reader](screenshots/05-library-paper.png), [precise selection draft](screenshots/10-paper-selection-draft.png), [global source session](screenshots/11-paper-global-session.png)
- [Note selection and proposal](screenshots/12-note-selection-session.png), [code diff](screenshots/06-code-diff.png), [command palette](screenshots/07-command-palette.png)
- [1024-pixel overview](screenshots/08-project-1024.png), [1024-pixel split](screenshots/09-split-1024.png)

The desktop screenshots are 1440 × 900; compact screenshots are 1024 × 768. They contain fixture data only.

## Design scope and limits

- Linen / Forest colors use `#346b59` / `#a4c799` accents; UI text uses Inter, reading uses Source Serif 4, and code uses JetBrains Mono. The inspector starts closed and captions/source/state labels are at least 12px in the prototype rules.
- There is no real PDF renderer, ingestion, source parser, Git operation, terminal, tool execution, model stream, change application, scientific verification or persistent session restore. Code and proposed diffs are separate fixture snapshots, explicitly labelled as such.
- Session replies and proposal cards are deterministic demonstrations. No claim is made that an agent generated, executed or verified their content. New sessions, messages, review labels and appearance changes disappear on reload.
- The prototype exposes two equal-width editor groups. It does not implement arbitrary resizing, three groups, drag-and-drop tab placement or production editor undo. Stable URL-fragment links and back/forward navigation cover resource navigation; they do not recover in-memory local sessions after reload.
- The static paper reader implements named and text selections, not a PDF coordinate/annotation adapter. Edition and page markers belong only to its explicitly synthetic pages.
- The simple residual example does not establish readable layout for long realistic equations or at 200% zoom. Those visual checks remain pending. Similar automatically named sessions would also benefit from an origin subtitle in the conversation list.

At compact widths, splitting temporarily hides the Explorer to preserve reading width; closing the split restores the existing sidebar preference. The session draft keeps its submission footer visible while its context body scrolls. The titlebar shows the focused resource's project or explicit Global collection ownership.

The design contract is [Desktop interface](../12-desktop-interface.md); this mockup is evidence for interaction review, not evidence of production readiness.

The interface has since been rebound to the Harness Web/Electron frame. Its current design prototype is the separate [Harness-frame prototype](harness-frame/README.md); this standalone shell remains for comparison and for its reader and selection-provenance checks.
