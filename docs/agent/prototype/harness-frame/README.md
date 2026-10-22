# Harness-frame interaction prototype

This is an isolated, static **design artifact** for the AITP-agent interface specified in [12 Desktop interface](../../12-desktop-interface.md). It places the proposed research views inside the actual frame of the selected DeepSeek Harness Web client: the Harness left sidebar (panel list, Workspaces and Sessions), the main column (AITP global panels or the Harness conversation) and the per-Session right dock. It is not the application and does not use Harness code.

Every topic, note, paper, knowledge entry, checkout, Skill, session and agent reply is synthetic. No model, file, Git, network or Harness service is used. Nothing here is a scientific result, a demonstration that a backend exists or evidence of researcher usability. The earlier [standalone-shell prototype](../README.md) is retained beside it for comparison; its explorer/editor-group shell is superseded by this frame.

## Open it

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/docs/agent/prototype/harness-frame/>. The page needs no build or install and uses no storage, cookie, service worker or external request; system fonts are used when the design fonts are absent.

The striped bar at the top and the striped guide at the bottom are prototype chrome, not product UI. **Walkthroughs** opens seven deep-linkable scenario walkthroughs (`#s1.1` … `#s7.3`; ←/→ step through them). **Label parts** marks each region as an existing Harness surface (blue), a proposed AITP contribution (green) or synthetic content (amber). **Dark** switches theme. `?theme=dark` and `?annotate=1` select the same options from the URL.

| Walkthrough | Cases | What it demonstrates |
| --- | --- | --- |
| s1 Return after interruption and compaction | C01, C16, C02 | Topic home from note passages; session row hover card; task card; Sources & memory with researcher/agent/source/summary provenance; disconnected state |
| s2 Paper and knowledge prerequisite | C04, C05, C19, C21 | Session-free library, edition and page labels, comparison with a knowledge entry, local draft with Global origin, attached → sent → in context |
| s3 Formula, code and diagnostic evidence | C08, C10 | Checkout identity, dirty files with unknown attribution, three capability tiers, comparison tab, retained log as a file |
| s4 Borrow part of a Skill | C22, C10 | Relationship to the task, borrowed step with dependency and travelling instruction, unused steps, same-name source mismatch, changed text |
| s5 Distillation proposal | C14, C22 | Status cells for draft / evaluation / file / installed / published, failed transfer, pending note integration kept separate |
| s6 Writing rule changed during a task | C16, C12 | Scope, destination, effect timing, conflict, saved-not-yet-used, used-by-request, save failure |
| s7 Empty and coverage states | C18, C21, C22 | No root note, missing edition file, Skill discovery report |

## Browser check

`check.mjs` serves only this directory on 127.0.0.1, drives every walkthrough step in an existing Chrome or Chromium, asserts the visible state texts and provenance labels, checks horizontal overflow, the 400-pixel centre column, transcript height and reading width at 1024 × 768, measures text contrast in both themes and exercises seven free interactions. It records browser-context HTTP requests and permits only GET requests to that local server; other requests are blocked and fail the check, and service workers are disabled. It installs nothing and loads Playwright from the existing `apps/web` dependencies.

```sh
AITP_CHROME=/path/to/chrome node docs/agent/prototype/harness-frame/check.mjs
```

`AITP_BROWSER_LIBS` optionally prepends extra library directories; `AITP_SHOT_DIR` changes where screenshots and `check-report.json` are written (default `screenshots/`). The integration rerun on 2026-10-22 used Chrome for Testing 149 headless shell: 21 walkthrough steps, 7 interactions and 5 compact views passed. Browser-context observation and the local server each recorded 24 GET requests to the local origin, with no page errors or failed assertions and minimum measured text contrast 5.25:1. This rerun follows corrections to model-versus-source item counts, the missing note's optional requirement level, illustrative Skill precedence and browser-origin checking. These checks exercise a synthetic mock; they do not test Harness integration, real data, screen-reader behaviour or researcher usability.

The committed screenshots are the full-colour PNGs from that integration rerun. The earlier local-server-only request count did not establish browser-origin coverage; use the corrected check for that claim.

Representative screens (1440 × 900 unless noted):

- [Topic home](screenshots/s1-1.png), [session with task card](screenshots/s1-2.png), [Sources & memory](screenshots/s1-3.png), [offline topic home](screenshots/s1-4.png), [labelled parts](screenshots/annotated-s1-3.png)
- [Library edition and page](screenshots/s2-1.png), [paper beside knowledge prerequisite](screenshots/s2-2.png), [Global draft](screenshots/s2-3.png), [paper session](screenshots/s2-4.png)
- [Code with capability tiers](screenshots/s3-1.png), [rule ↔ code comparison](screenshots/s3-2.png)
- [Borrowed Skill step](screenshots/s4-1.png), [same-name source mismatch](screenshots/s4-2.png), [dark](screenshots/dark-s4-1.png)
- [Distillation](screenshots/s5-1.png), [catalog with pending proposal](screenshots/s5-2.png)
- [Rule editor](screenshots/s6-1.png), [saved, not yet used](screenshots/s6-2.png), [used by request](screenshots/s6-3.png), [save failure](screenshots/s6-4.png)
- [No root note](screenshots/s7-1.png), [edition without file](screenshots/s7-2.png), [Skill discovery report](screenshots/s7-3.png)
- 1024 × 768: [topic home](screenshots/compact-s1-1.png), [session and dock](screenshots/compact-s1-3.png), [paper comparison](screenshots/compact-s2-2.png), [code comparison](screenshots/compact-s3-2.png), [Skill use](screenshots/compact-s4-1.png)

## Limits

- Widths and behaviour imitate the documented Harness frame; they are not rendered by Harness components, themes or slot code.
- Agent replies, working notes, method-use rows, relationship reasons, evaluations and outcomes are fixed text. No agent produced them.
- Static paper pages, code lines and logs stand in for real readers; there is no PDF, Markdown, LaTeX or LSP renderer.
- State changes (draft, save, relationship choice) are in-memory and reset on reload. Walkthrough steps set state directly.
- Long equations, 200 % zoom, keyboard-only operation of every control and screen-reader announcements remain unchecked.
