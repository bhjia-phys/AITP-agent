/* Harness-frame design prototype for AITP-agent.
   Static and synthetic: no network, model, file access, storage or Harness runtime is used.
   Walkthrough steps are addressable as #s1.2 so screenshots and checks are reproducible. */
'use strict';
(() => {
  const F = window.AITP_FIXTURES;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const BASE = {
    view: 'research', topic: 't-spectra', researchSub: 'home', researchUnavailable: false,
    matTab: 'library', libEdition: 'e2', libCompare: false, libDraft: false, knowSel: 'k-residual',
    codeTab: 'source', skillSel: 'sk-anderson',
    ruleEdit: false, ruleState: 'none', ruleConflict: false,
    session: 's-third', taskOpen: false, dock: null, disconnected: false,
    hoverRow: null, methodLine: false, outcomeLine: false, ruleAdoptedLine: false, paperSession: false, fixSession: false,
    skillRel: 'borrow', sideCollapsed: false, emptyResearch: false, catalogReport: false,
  };
  let S = { ...BASE, theme: 'light', annotate: false, menu: false, guide: null };

  /* ---------- walkthroughs ---------- */
  const W = [
    { id: 's1', title: 'Return to a topic after interruption and compaction', cases: 'C01 · C16 · C02', steps: [
      { st: { view: 'research', hoverRow: 's-third' },
        entry: 'Research in the left sidebar. Opening it sends no prompt and creates no session.',
        visible: 'Question, current answer and decisive gap as written in research.md, with their locators; one pending choice; live threads; failed route; sessions on this topic. The hover card shows a Harness session’s topic, thread and task.',
        action: 'Continue “Third-system comparison” in its existing session.',
        feedback: 'None yet: browsing is local and read-only.',
        failure: 'A missing or moved main note shows the last observed passages with their observation time; nothing is re-synthesized.' },
      { st: { view: 'conversation', session: 's-third', taskOpen: false },
        entry: 'The existing session, reached from the topic home or the sidebar row.',
        visible: 'Two generated checkpoints are labelled as summaries. The task card above the composer keeps the task, your two later instructions, the agent’s provisional notes and one gap in one line each.',
        action: 'Ask where the work stands; the reply cites what it used.',
        feedback: 'The agent states the code finding, its limit, and that a linked note was missing but not needed.',
        failure: 'The missing note appears as an “Optional background” gap, with its origin in a paused thread stated separately; the session continues.' },
      { st: { view: 'conversation', session: 's-third', taskOpen: false, dock: { panes: [{ tabs: ['mem', 'note'], active: 'mem' }] } },
        entry: 'Expand the task card, or Sources & memory in the session header.',
        visible: 'Your words verbatim (turns 1, 9, 12), agent notes marked provisional, sources with Found / Sent / In context now / Condensed / Missing states and their requirement level, and the two generated summaries kept apart from your instructions.',
        action: 'Mark an agent note wrong, open a source, or re-attach the condensed log.',
        feedback: 'A correction becomes your own instruction for this task; the agent note stays visible as superseded.',
        failure: 'The run log was read at turn 6 and condensed since: it is not described as currently in context.' },
      { st: { view: 'research', disconnected: true },
        entry: 'Same topic home while the backend is unreachable.',
        visible: 'Last observed passages and time; no live session state is invented.',
        action: 'Reconnect from the Harness connection indicator; read the retained page meanwhile.',
        feedback: 'After reconnection the page re-reads the note and session states before offering Continue.',
        failure: 'Running work is not reported as cancelled; its state is shown as unknown until the backend answers.' },
    ] },
    { id: 's2', title: 'Read a paper and consult a knowledge prerequisite', cases: 'C04 · C05 · C19 · C21', steps: [
      { st: { view: 'materials', matTab: 'library', libEdition: 'e2' },
        entry: 'Materials › Library, without a project or a conversation.',
        visible: 'Two editions of one work (only edition 2 has a local PDF), the printed and PDF page labels, the reading note, where the paper is used, and three separate reading states.',
        action: 'Select Eq. (7) on printed p. 112 and open the linked knowledge entry beside it.',
        feedback: 'None: browsing does not mark anything read or attach it to a model.',
        failure: 'The index covers 2 of 3 configured folders; the library never presents that as “no results”.' },
      { st: { view: 'materials', matTab: 'library', libEdition: 'e2', libCompare: true },
        entry: 'Compare from the paper toolbar.',
        visible: 'Paper passage and knowledge entry side by side. The entry shows its support and review labels separately, its assumptions, and the prerequisite chain (contraction mapping).',
        action: 'Follow the prerequisite, then return to the same paper position.',
        feedback: 'None: still browsing.',
        failure: 'A same-titled entry with different conventions is listed as a separate candidate, never substituted.' },
      { st: { view: 'materials', matTab: 'library', libEdition: 'e2', libDraft: true },
        entry: 'Ask about selection.',
        visible: 'A draft with origin Global, the exact edition/page/equation locator and an optional topic selector left empty. The passage is attached but not yet sent.',
        action: 'Start the session; or add the passage to an existing session (it is queued with the next message).',
        feedback: 'The draft is local until Start; no session exists before that.',
        failure: 'Discarding the draft leaves no session and no attachment.' },
      { st: { view: 'conversation', session: 's-paper', paperSession: true, dock: { panes: [{ tabs: ['paper', 'mem'], active: 'paper' }] } },
        entry: 'The new session opens with the paper in the session dock.',
        visible: 'The attachment chip changes from Attached to Sent at turn 1 and In context now. The reply cites edition 2, printed p. 112.',
        action: 'Ask a follow-up or open the cited excerpt.',
        feedback: 'Citations open the excerpt as it was delivered; Open current source is a separate action.',
        failure: 'Edition 1 numbers the equation differently; a request for “Eq. (7) in edition 1” shows candidates instead of jumping.' },
    ] },
    { id: 's3', title: 'Compare a formula with code and diagnostic evidence', cases: 'C08 · C10', steps: [
      { st: { view: 'materials', matTab: 'code', codeTab: 'source' },
        entry: 'Materials › Code, or the code link on the topic home.',
        visible: 'The actual checkout (host, path, branch, working tree), two dirty files that predate this work, the stopping test highlighted, and three capability tiers labelled as existing, existing-generic and future.',
        action: 'Compare with the agreed stopping rule.',
        feedback: 'None: reading code does not run it.',
        failure: 'Another worktree of the same repository is listed separately and never substituted.' },
      { st: { view: 'conversation', session: 's-fix', fixSession: true, dock: { panes: [{ tabs: ['compare', 'code', 'mem'], active: 'compare' }] } },
        entry: 'Work on this comparison (from the code view or the thread).',
        visible: 'Note equation and code side by side in one dock tab, the retained log tail labelled as a file (not an execution record), and the agent’s bound labelled provisional.',
        action: 'Ask for the residual implied by the logged step.',
        feedback: 'The agent localizes the mismatch to line 43 and states what this does not establish.',
        failure: 'Attribution of the two dirty files is unknown; branch selection cannot be inferred from the residual.' },
    ] },
    { id: 's4', title: 'Borrow only a justified part of a Skill', cases: 'C22 · C10', steps: [
      { st: { view: 'conversation', session: 's-third', methodLine: true, dock: { panes: [{ tabs: ['skill', 'mem'], active: 'skill' }] }, skillSel: 'sk-anderson', skillRel: 'borrow' },
        entry: 'The one-line method use in the transcript, or Materials › Skills.',
        visible: 'Relationship “Borrow steps”, the borrowed step 3, its dependency (F(xₖ) available at mixing.py:39), the mandatory instruction that travels with it, the steps not used and why, and the limit that does not transfer.',
        action: 'Keep, or change the relationship (Use whole / Reference only / Not used / Unresolved) with a short reason.',
        feedback: 'Choosing “Use whole” would replace the solver you fixed: the agent asks before acting on it rather than switching silently.',
        failure: 'An unmet precondition stays visible; partial use is never shown as having executed the whole Skill.' },
      { st: { view: 'conversation', session: 's-third', methodLine: true, dock: { panes: [{ tabs: ['skill', 'mem'], active: 'skill' }] }, skillSel: 'sk-residual', skillRel: 'unresolved' },
        entry: 'You select residual-diagnostics from the topic’s method list.',
        visible: 'Two sources share the name. The selected topic method differs from the personal copy that would load by name; the body changed after it was first shown.',
        action: 'Use the selected source, or ask the agent to reload it.',
        feedback: 'Until source-qualified loading exists, the mismatch is reported and the adoption stays unresolved.',
        failure: 'Silent substitution is the failure this view exists to prevent.' },
    ] },
    { id: 's5', title: 'Turn a demonstrated correction into a distillation proposal', cases: 'C14 · C22', steps: [
      { st: { view: 'conversation', session: 's-third', outcomeLine: true, dock: { panes: [{ tabs: ['distill', 'mem'], active: 'distill' }] } },
        entry: 'The outcome row “Possible method correction”, or Distill from evidence in a Skill view.',
        visible: 'Evidence with locators, the existing step it would change, a focused diff, three evaluations (replay, failed transfer, untested), and five separate status cells.',
        action: 'Keep the narrow draft, mark No change needed, or discard.',
        feedback: 'The draft lives in this session; the Skill file, installation and publication all read “no”.',
        failure: 'The failed Broyden transfer narrows the draft; it is not hidden or retried until it passes.' },
      { st: { view: 'materials', matTab: 'skills', skillSel: 'sk-residual' },
        entry: 'Materials › Skills › residual-diagnostics.',
        visible: 'The catalog entry shows one pending, unapplied proposal with its evaluation state, beside the current text.',
        action: 'Open the proposal or the motivating session.',
        feedback: 'None: the catalog does not install, run or change the Skill.',
        failure: 'The system-C finding itself is a pending note integration, not part of the Skill.' },
    ] },
    { id: 's6', title: 'Change a writing rule while a task is active', cases: 'C16 · C12', steps: [
      { st: { view: 'rules', ruleEdit: true, ruleState: 'draft', ruleConflict: true },
        entry: 'Rules in the left sidebar while the session is running.',
        visible: 'The draft, its scope and destination, when it takes effect, and a conflict with an existing personal rule shown with both sources.',
        action: 'Choose scope “This topic”, keep destination “App rules”, save once.',
        feedback: 'No approval dialog: a preference edit is one save.',
        failure: 'Leaving with an unsaved draft keeps it as Draft; nothing is applied.' },
      { st: { view: 'rules', ruleEdit: false, ruleState: 'saved' },
        entry: 'After Save.',
        visible: '“Saved · not yet used by this task”: the running step began before the save.',
        action: 'Return to the session.',
        feedback: 'The running step is not interrupted or relabelled.',
        failure: 'A failed save keeps the draft and never shows Active (see step 4).' },
      { st: { view: 'conversation', session: 's-third', ruleAdoptedLine: true, taskOpen: true },
        entry: 'The session after its next request.',
        visible: 'The task card reports the rule as used by the request at turn 35, with its scope.',
        action: 'Continue.',
        feedback: 'The reply follows the new notation; earlier replies and notes are not rewritten.',
        failure: 'If the rule conflicts with a task instruction, both stay visible and the agent says which it followed.' },
      { st: { view: 'rules', ruleEdit: true, ruleState: 'failed' },
        entry: 'Save when the rule store cannot be written.',
        visible: 'Couldn’t save; draft preserved; nothing used.',
        action: 'Retry or copy the text.',
        feedback: 'None.',
        failure: 'This is the failure state itself.' },
    ] },
    { id: 's7', title: 'Empty, unavailable and catalog-coverage states', cases: 'C18 · C21 · C22', steps: [
      { st: { view: 'research', emptyResearch: true },
        entry: 'Research with a workspace that has no root research note.',
        visible: 'An explanation and a choice of workspace; no invented topics.',
        action: 'Choose a workspace or open a note directly.',
        feedback: 'None.',
        failure: 'Harness Workspaces remain the only project list; topics never appear as a second one.' },
      { st: { view: 'materials', matTab: 'library', libEdition: 'e1' },
        entry: 'Library › edition 1 of a work.',
        visible: 'Known bibliography without a local file; locate an existing file; fetching is a later, separately scoped capability.',
        action: 'Locate an existing file, or switch to edition 2.',
        feedback: 'None.',
        failure: 'Edition 2 is never silently substituted for edition 1.' },
      { st: { view: 'materials', matTab: 'skills', skillSel: 'sk-residual', catalogReport: true },
        entry: 'Materials › Skills › Discovery report.',
        visible: 'Roots searched, nested methods reachable only by link, and shadowed same-named Skills.',
        action: 'Open the shadowed source.',
        feedback: 'None.',
        failure: 'No result means no match in the searched roots, not that no method exists.' },
    ] },
  ];

  /* ---------- helpers ---------- */
  const anno = (kind, text, pos = 'tr') => `<span class="anno ${kind} ${pos}">${esc(text)}</span>`;
  const pill = (kind, text) => `<span class="pill ${kind}">${esc(text)}</span>`;
  const stateKind = { ok: 'ok', warn: 'warn', missing: 'miss', muted: '' };
  const sessionById = (id) => F.workspaces.flatMap((w) => w.sessions).find((s) => s.id === id);
  const dockOpen = () => !!S.dock && S.view === 'conversation';

  /* ---------- left sidebar (Harness shell) ---------- */
  function side() {
    if (S.sideCollapsed || dockOpen()) {
      const nav = [['research', '◎', 'Research'], ['materials', '▤', 'Materials'], ['rules', '✎', 'Rules']];
      return `<aside class="side rel" aria-label="Sidebar (collapsed)">${anno('h', 'Harness rail', 'tl')}
        <div class="brand" style="justify-content:center;padding:0"><span class="mark" aria-hidden="true">a</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:center;padding-top:6px">
          <button class="navrow" style="justify-content:center;width:40px" aria-label="New session">＋</button>
          ${nav.map(([v, ic, l]) => `<button class="navrow" style="justify-content:center;width:40px" data-act="nav:${v}" aria-label="${l}" ${S.view === v ? 'aria-current="page"' : ''}>${ic}</button>`).join('')}
          <button class="navrow" style="justify-content:center;width:40px" data-act="expand-side" aria-label="Expand sidebar">»</button>
        </div></aside>`;
    }
    const nav = [['research', '◎', 'Research', '1'], ['materials', '▤', 'Materials', ''], ['rules', '✎', 'Rules', '']];
    const rows = F.workspaces.map((w) => `<div class="ws"><div class="wsname" title="${esc(w.host)} · ${esc(w.path)}">▾ ${esc(w.name)}</div>
      ${w.sessions.map((s) => `<button class="srow ${S.hoverRow === s.id ? 'hovered' : ''}" data-act="open-session:${s.id}" ${S.view === 'conversation' && S.session === s.id ? 'aria-current="page"' : ''}>
        ${s.pending ? '<span class="dot" aria-hidden="true"></span>' : ''}<span class="t">${esc(s.title)}</span>${s.pending ? `<span class="pend">${esc(s.pending.replace('Waiting for ', ''))}</span>` : `<span class="u">${esc(s.updated)}</span>`}
      </button>`).join('')}</div>`).join('');
    const hs = S.hoverRow && sessionById(S.hoverRow);
    const hover = hs ? `<div class="hovercard" style="top:300px" role="tooltip">${anno('a', 'AITP · row hover seat')}
        <h4>${esc(hs.title)}</h4><dl><dt>Topic</dt><dd>${esc(hs.topic)}</dd><dt>Thread</dt><dd>${esc(hs.thread || '—')}</dd>
        <dt>Task</dt><dd>${esc(hs.task)}</dd><dt>Since</dt><dd>2 generated checkpoints · 1 gap</dd></dl></div>` : '';
    return `<aside class="side rel" aria-label="Sidebar">${anno('h', 'Harness sidebar', 'tl')}
      <div class="brand"><span class="mark" aria-hidden="true">a</span>aitp-agent<button class="collapse" data-act="collapse-side" aria-label="Collapse sidebar">«</button></div>
      <button class="newsess">＋ New session</button>
      <nav class="panellist rel" aria-label="Panels">${anno('a', 'AITP panels', 'br')}
        ${nav.map(([v, ic, l, c]) => `<button class="navrow" data-act="nav:${v}" ${S.view === v ? 'aria-current="page"' : ''}><span class="ic" aria-hidden="true">${ic}</span>${l}${c ? `<span class="count" aria-label="${c} waiting for you">${c}</span>` : ''}</button>`).join('')}
        <button class="navrow"><span class="ic" aria-hidden="true">⧉</span>Plugins</button>
      </nav>
      <div class="wshead"><span>Workspaces</span><button aria-label="Search sessions">⌕</button><button aria-label="View options">≡</button><button aria-label="Add workspace">＋</button></div>
      <div class="wslist">${rows}</div>${hover}
      <div class="sfoot"><button class="navrow"><span class="ic" aria-hidden="true">⚙</span>Settings</button></div></aside>`;
  }

  /* ---------- Research panel ---------- */
  function research() {
    const T = F.topicHome;
    const head = `<div class="phead rel">${anno('a', 'AITP global panel · main slot')}<h1>Research</h1><span class="ctx">research-workspace · WSL · Ubuntu · ~/research</span><span class="sp"></span>
      <label class="search"><span aria-hidden="true">⌕</span><input aria-label="Search topics and notes" placeholder="Search topics, notes, threads"></label></div>`;
    if (S.emptyResearch) {
      return `${head}<div class="pbody"><div class="navcol"><h3>Topics</h3><p class="meta" style="padding:0 8px">None found</p></div>
        <div class="reader"><div class="empty" style="max-width:560px;margin:40px auto;text-align:left">
          <b>This workspace has no root research note.</b><p>Topics are read from a workspace’s root <span class="mono">research.md</span> and the notes it links. This workspace (<span class="mono">~/code/scf-solver</span>) is a code checkout.</p>
          <div class="actions"><button class="btn primary">Choose another workspace</button><button class="btn">Open a note directly</button></div>
          <p class="meta">Workspaces come from the Harness sidebar; Research adds no second project list.</p></div></div></div>`;
    }
    const nav = `<div class="navcol" aria-label="Topics"><h3>Root note</h3><button class="navitem">research.md<small>directions · standing agreements</small></button>
      <h3>Topics</h3>${F.topics.map((t) => `<button class="navitem" data-act="topic:${t.id}" aria-current="${S.topic === t.id}">${esc(t.title)}<small>${esc(t.kind)} · ${esc(t.disposition)}</small></button>`).join('')}
      <h3>Unmapped</h3><button class="navitem">2 note candidates<small>not linked from the root note</small></button></div>`;
    if (S.researchSub === 'note') return `${head}<div class="pbody">${nav}<div class="reader">${noteReader(false)}</div></div>`;
    const disc = S.disconnected ? `<div class="callout miss" role="status" style="margin-bottom:12px"><b>Backend unreachable.</b> Showing the passages observed at 10:31. Session states below are the last known; running work is not assumed stopped.</div>` : '';
    const home = `${disc}<div class="crumb"><a>research-workspace</a> › ${esc(T.title)} · <button class="link" data-act="research-note">Open main note</button></div>
      <h2 class="title">${esc(T.title)}</h2>
      <div class="meta"><span>Topic · <span class="mono">${esc(T.note)}</span></span><span>${S.disconnected ? 'last observed 10:31' : esc(T.observed)}</span>${pill('', 'Assembled from the note · edit the note to change it')}</div>
      <section class="sec"><h3>Question</h3><div class="passage">${esc(T.question.text)}</div><div class="srcline"><span class="mono">${esc(T.question.loc)}</span><button class="link" data-act="research-note">Open in note</button></div></section>
      <div class="grid2 sec"><section><h3 style="font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px">Current answer, as written</h3><div class="passage">${esc(T.answer.text)}</div><div class="srcline"><span class="mono">${esc(T.answer.loc)}</span></div></section>
      <section><h3 style="font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px">Decisive gap</h3><div class="passage">${esc(T.gap.text)}</div><div class="srcline"><span class="mono">${esc(T.gap.loc)}</span></div></section></div>
      <section class="sec"><h3>Needs your input <span class="n">· ${T.pending.length}</span></h3>${T.pending.map((p) => `<div class="card" style="border-left:3px solid var(--warn)"><b>${esc(p.title)}</b><div style="margin-top:3px">${esc(p.text)}</div>
        <div class="srcline"><span class="mono">${esc(p.loc)}</span><span>Session “Root selection options”: ${S.disconnected ? 'state unknown (offline)' : esc(p.sessionState)}</span></div>
        <div class="actions"><button class="btn sm" data-act="open-session:s-root">Answer in session</button><button class="btn sm" data-act="research-note">Open passage</button></div></div>`).join('')}</section>
      <section class="sec"><h3>Current work <span class="n">· disposition as written</span></h3><div class="rowlist">${T.threads.map((t) => `<div><span class="nm">${esc(t.title)}</span><span class="ds">${esc(t.disposition)}</span><span class="cl">${esc(t.clause)}</span>
        ${t.sessions ? `<button class="btn sm" data-act="open-session:${t.title === 'Root selection' ? 's-root' : 's-third'}">Continue</button>` : '<button class="btn sm">New session</button>'}</div>`).join('')}</div></section>
      <div class="grid2 sec"><section><h3 style="font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px">Failed routes kept in the note</h3>${T.failed.map((f) => `<div class="prov src"><div class="who">▤ Source · ${esc(f.loc)}</div><div class="tx">${esc(f.text)}</div></div>`).join('')}</section>
      <section><h3 style="font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px">Branches</h3>${T.branches.map((b) => `<div class="card"><b>${esc(b.title)}</b> — ${esc(b.text)}<div class="srcline"><span class="mono">${esc(b.loc)}</span></div></div>`).join('')}</section></div>
      <section class="sec"><h3>Relevant materials <span class="n">· linked from the note; nothing is copied into the topic</span></h3><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">${T.materials.map((g) => `<div class="card"><div class="meta" style="font-weight:600;color:var(--ink-2)">${esc(g.group)}</div>${g.items.map((i) => `<div style="margin-top:6px"><button class="link" data-act="open-mat:${i.open}">${esc(i.title)}</button><div class="meta">${esc(i.why)}</div></div>`).join('')}</div>`).join('')}</div></section>
      <section class="sec"><h3>Sessions on this topic <span class="n">· Harness sessions whose origin is this topic</span></h3><div class="rowlist">${F.workspaces.flatMap((w) => w.sessions.filter((s) => s.topic === T.title).map((s) => `<div><span class="nm">${esc(s.title)}</span><span class="ds">${esc(w.name)}</span><span class="cl">${esc(s.task)}</span>${s.pending ? (S.disconnected ? pill('', 'state unknown') : pill('warn', s.pending)) : `<span class="meta">${esc(s.updated)}</span>`}</div>`)).join('')}</div></section>
      <p class="meta" style="margin-top:20px">Generated orientation is not shown on this page. Every passage above is the note’s own text at the cited lines.</p>`;
    return `${head}<div class="pbody">${nav}<div class="reader rel">${anno('m', 'Synthetic note', 'tr')}${home}</div></div>`;
  }

  function noteReader(inDock) {
    const N = F.note;
    const body = N.blocks.map((b) => {
      if (b.h) return `<h2 class="title">${esc(b.h)}</h2>`;
      if (b.h2) return `<h3 id="${inDock ? 'd-' : 'm-'}${b.anchor}" style="font:600 17px/1.3 var(--font-read);margin:20px 0 6px">${esc(b.h2)}</h3>`;
      if (b.eq) return `<div class="eq" ${b.id === 'eq-stop' && S.libDraft === false ? 'style="outline:2px solid var(--accent);outline-offset:2px"' : ''}>${esc(b.eq)}</div><div class="srcline"><span class="mono">${esc(b.loc)}</span>${inDock ? '' : '<button class="link" data-act="work-on-passage">Work on this passage</button>'}</div>`;
      if (b.li) return `<div class="passage" style="margin:6px 0 2px;padding-left:14px;border-left:2px solid var(--line)">${esc(b.li)}</div><div class="srcline"><span class="mono">#${esc(b.anchor)} · ${esc(b.loc)}</span></div>`;
      return `<p class="passage">${esc(b.p)}</p>`;
    }).join('');
    return `<div class="crumb">${inDock ? '' : '<button class="link" data-act="research-home">‹ Topic home</button> · '}<span class="mono">${esc(N.path)}</span> · current file, read 10:31</div>${body}`;
  }

  /* ---------- Materials panel ---------- */
  function materials() {
    const tabs = [['library', 'Library'], ['knowledge', 'Knowledge'], ['code', 'Code'], ['skills', 'Skills']];
    const head = `<div class="phead rel">${anno('a', 'AITP global panel · main slot')}<h1>Materials</h1><span class="ctx">browse without a session</span><span class="sp"></span>
      <label class="search"><span aria-hidden="true">⌕</span><input aria-label="Search materials" placeholder="Search papers, knowledge, code, methods"></label></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-act="mat:${k}" aria-selected="${S.matTab === k}">${l}</button>`).join('')}</div>`;
    const body = { library, knowledge, code: codeView, skills: skillsCatalog }[S.matTab]();
    return head + body;
  }

  function library() {
    const P = F.paper; const ed = P.editions.find((e) => e.id === S.libEdition);
    const nav = `<div class="navcol"><div class="callout" style="margin:0 4px 8px">Index covers 2 of 3 configured folders. <span class="mono">papers/inbox</span> is not indexed.</div>
      <h3>Works</h3><button class="navitem" aria-current="true">Synthetic Paper A<small>2 editions · 1 local file</small></button>
      <button class="navitem">Synthetic Paper B<small>metadata only</small></button>
      <button class="navitem">“Residual-based stopping…” (2019)<small>possible duplicate of Paper A · unresolved</small></button>
      <h3>Recent reading</h3><button class="navitem">Synthetic Paper A · p. 112<small>Eq. (7)</small></button></div>`;
    const editions = `<div class="opts" role="radiogroup" aria-label="Edition">${P.editions.map((e) => `<label class="${e.file ? '' : ''}"><input type="radio" name="ed" data-act="edition:${e.id}" ${S.libEdition === e.id ? 'checked' : ''}>${esc(e.label)} · <span class="meta">${esc(e.note)}</span></label>`).join('')}</div>`;
    let reader;
    if (!ed.file) {
      reader = `<div class="card"><b>${esc(ed.label)}</b><p>No local file is known for this edition. Bibliography: ${esc(P.authors)}, preprint (synthetic).</p>
        <div class="actions"><button class="btn">Locate existing file…</button><button class="btn" disabled title="Separately scoped later capability">Fetch (not available)</button><button class="btn" data-act="edition:e2">Open edition 2 instead</button></div>
        <p class="meta">Equation numbers differ between editions; a locator from edition 2 is not applied here.</p></div>`;
    } else {
      reader = `<div class="card rel" style="padding:18px 22px">${anno('m', 'Static page · not a PDF renderer')}
        <div class="meta"><b style="color:var(--ink-2)">Edition 2</b><span>PDF p. ${P.page.pdf} · printed p. ${P.page.printed}</span><span class="mono">${esc(ed.file)}</span></div>
        <p class="passage" style="margin-top:10px">${esc(P.passage)}</p><div class="eq" style="outline:2px solid var(--accent);outline-offset:2px">${esc(P.eq)}</div>
        <div class="actions"><button class="btn primary" data-act="lib-draft">Ask about selection</button><button class="btn" data-act="lib-compare">Compare with knowledge entry</button><button class="btn">Open reading note</button></div></div>
        <section class="sec"><h3>Reading state <span class="n">· three separate facts</span></h3>
          <div class="rowlist"><div><span class="nm">You</span><span class="cl">Not marked read (only you can set this)</span></div>
          <div><span class="nm">Agent</span><span class="cl">Explained Eq. (7) in “Reading · Synthetic Paper A”, turn 3 (delivered excerpt p. 112)</span></div>
          <div><span class="nm">Derivation</span><span class="cl">${esc(P.readingNote)}</span></div></div></section>
        <section class="sec"><h3>Used in</h3><div class="rowlist"><div><span class="nm">spectra/research.md</span><span class="cl">answer passage L7–11 cites edition 2</span></div></div></section>`;
    }
    const draft = S.libDraft ? `<div class="card rel" style="margin-top:14px;border:1px solid var(--accent)">${anno('a', 'Session draft · local until Start')}
        <b>New session draft</b><dl class="kv" style="margin-top:8px"><dt>Origin</dt><dd>Global · Synthetic Paper A, edition 2, printed p. 112, Eq. (7)</dd>
        <dt>Topic</dt><dd><select aria-label="Optional topic"><option>None (Global)</option><option>Self-consistent spectra</option></select> <span class="meta">optional; not inherited from the last topic</span></dd>
        <dt>Workspace</dt><dd>research-workspace (Harness)</dd><dt>Attached</dt><dd><span class="chip attach">▤ Eq. (7) · p. 112 · attached, not sent</span></dd></dl>
        <textarea aria-label="Task" style="width:100%;margin-top:8px;min-height:46px;border:1px solid var(--line-strong);border-radius:5px;padding:6px;background:var(--paper)">Explain the stopping condition in Eq. (7) and how it relates to the damping factor.</textarea>
        <div class="actions"><button class="btn primary" data-act="start-paper-session">Start session</button><button class="btn">Add to existing session…</button><button class="btn" data-act="lib-draft-cancel">Discard draft</button></div></div>` : '';
    const main = `<div class="reader"><div class="crumb">Library › Synthetic Paper A</div><h2 class="title">${esc(P.title)}</h2><div class="meta">${esc(P.authors)}</div>
      <section class="sec"><h3>Edition</h3>${editions}</section><section class="sec">${reader}</section>${draft}</div>`;
    if (S.libCompare && ed.file) {
      return `<div class="pbody cmp">${nav}${main}<div class="reader">${knowledgeEntry('k-residual', true)}</div></div>`;
    }
    return `<div class="pbody">${nav}${main}</div>`;
  }

  function knowledgeEntry(id, inCompare) {
    const K = F.knowledge[id];
    return `<div class="crumb">${inCompare ? '<button class="link" data-act="lib-compare-close">✕ Close comparison</button> · ' : ''}Knowledge</div>
      <h2 class="title" style="font-size:20px">${esc(K.title)}</h2>
      <div class="meta">${pill('', 'Support: ' + K.support)}${pill('', 'Review: ' + K.review)}<span>labels as written in the entry</span></div>
      <p class="passage" style="margin-top:10px">${esc(K.text)}</p>
      <dl class="kv"><dt>Assumptions</dt><dd>${esc(K.assumptions)}</dd><dt>Source</dt><dd>${esc(K.source)} · <button class="link">Open source</button></dd>
      <dt>Prerequisites</dt><dd>${K.prereq.length ? K.prereq.map((p) => `<button class="link" data-act="know:${p}">${esc(F.knowledge[p].title)}</button>`).join(', ') : 'none listed'}</dd>
      <dt>Used in</dt><dd>spectra/research.md (gap passage) · <span class="meta">search covered ~/research notes only</span></dd></dl>
      ${id === 'k-residual' ? `<div class="card" style="margin-top:12px"><div class="meta">Prerequisite</div><b>${esc(F.knowledge['k-contraction'].title)}</b><p class="passage" style="font-size:14.5px">${esc(F.knowledge['k-contraction'].text)}</p><div class="meta">${esc(F.knowledge['k-contraction'].assumptions)}</div></div>` : ''}`;
  }

  function knowledge() {
    const nav = `<div class="navcol"><h3>Subjects</h3><button class="navitem">Numerical methods<small>4 entries</small></button><button class="navitem">Operator algebras<small>learning story · 6 entries</small></button>
      <h3>Entries</h3>${Object.entries(F.knowledge).map(([k, v]) => `<button class="navitem" data-act="know:${k}" aria-current="${S.knowSel === k}">${esc(v.title)}<small>${esc(v.support)} · ${esc(v.review)}</small></button>`).join('')}</div>`;
    return `<div class="pbody">${nav}<div class="reader">${knowledgeEntry(S.knowSel, false)}</div></div>`;
  }

  function codeLines(lines, hl) {
    return `<div class="codeblk" role="region" aria-label="Source code">${lines.map(([n, t]) => `<div class="${hl.includes(n) ? 'hl' : ''}"><span class="ln">${n}</span><span>${esc(t)}</span></div>`).join('')}</div>`;
  }

  function tiers() {
    return `<div class="tiers"><div class="tier now"><b>Viewing · exists</b>Harness file preview and LSP navigation. Reading never runs code.</div>
      <div class="tier gen"><b>Agent edits and commands · exists, generic</b>Harness tools under the session’s permission mode; changes appear in Harness’s changed-files card.</div>
      <div class="tier fut"><b>Research run record · proposed</b>Linking a command, inputs and outputs to the thread it tests. Not available.</div></div>`;
  }

  function codeView() {
    const C = F.code.checkout;
    const nav = `<div class="navcol"><h3>Checkouts</h3><button class="navitem" aria-current="true">scf-solver<small>WSL · damped-mixing · 2 dirty</small></button><button class="navitem">scf-solver<small>WSL · ~/wt/scf-main · main · clean</small></button>
      <h3>Files</h3><button class="navitem" aria-current="true">mixing.py<small>modified</small></button><button class="navitem">tests/test_mixing.py<small>modified</small></button><button class="navitem">README.md</button></div>`;
    const tabs = `<div class="opts" role="tablist">${['source', 'changes', 'history'].map((t) => `<label><input type="radio" name="ct" data-act="codetab:${t}" ${S.codeTab === t ? 'checked' : ''}>${t[0].toUpperCase() + t.slice(1)}</label>`).join('')}</div>`;
    let body;
    if (S.codeTab === 'changes') {
      body = `<div class="opts" style="margin:8px 0">${['Unstaged', 'Staged', 'Commit', 'Branch'].map((s, i) => `<label><input type="radio" name="sc" ${i === 0 ? 'checked' : ''}>${s}</label>`).join('')}</div>
        <div class="callout">2 files changed before this session; who changed them is unknown.</div>
        <div class="diff card" style="padding:6px 0;margin-top:8px"><div class="ctx">        x_new = x + alpha * r</div><div class="add">        step = np.linalg.norm(x_new - x)</div><div class="ctx">        if step < tol:</div></div>`;
    } else if (S.codeTab === 'history') {
      body = `<div class="rowlist" style="margin-top:8px"><div><span class="nm mono">a91e… (synthetic)</span><span class="cl">Add damped mixing · 5 days ago</span></div><div><span class="nm mono">4f2c… (synthetic)</span><span class="cl">Initial solver</span></div></div>`;
    } else {
      body = `<div class="meta" style="margin:8px 0"><span class="mono">mixing.py · L36–46</span><span>working tree · read 10:29</span></div>${codeLines(F.code.lines, F.code.highlight)}
        <section class="sec"><h3>Retained output <span class="n">· a file, not an execution record</span></h3><div class="codeblk">${F.code.log.map((l, i) => `<div><span class="ln">${i + 1}</span><span>${esc(l)}</span></div>`).join('')}</div><div class="srcline"><span class="mono">runs/systemC/out.log · observed 10:29</span></div></section>
        <div class="actions"><button class="btn primary" data-act="start-fix-session">Compare with the agreed stopping rule</button><button class="btn">Open in VS Code (host)</button></div>`;
    }
    return `<div class="pbody">${nav}<div class="reader rel">${anno('m', 'Synthetic checkout')}<div class="crumb">Code › scf-solver</div><h2 class="title" style="font-size:20px">mixing.py</h2>
      <dl class="kv"><dt>Host · path</dt><dd>${esc(C.host)} · <span class="mono">${esc(C.path)}</span></dd><dt>Branch · revision</dt><dd>${esc(C.branch)} · ${esc(C.revision)}</dd><dt>Dirty</dt><dd>${C.dirty.map(esc).join(', ')} · attribution unknown</dd></dl>
      ${tiers()}${tabs}${body}</div></div>`;
  }

  /* ---------- Skills ---------- */
  function skillCore(id, withTask) {
    const K = F.skills[id];
    const relNames = [['use', 'Use whole procedure'], ['borrow', 'Borrow steps'], ['reference', 'Reference only'], ['not', 'Not used'], ['unresolved', 'Unresolved']];
    const pre = K.pre.map((p) => `<div style="display:flex;gap:8px;align-items:baseline;margin-top:4px">${pill(p.status === 'met' ? 'ok' : p.status === 'unmet' ? 'miss' : 'warn', p.status)}<span>${esc(p.text)} <span class="meta">— ${esc(p.why)}</span></span></div>`).join('');
    const steps = K.steps.map((s) => `<li class="${s.use === 'borrowed' ? 'borrowed' : s.use === 'not used' ? 'notused' : ''}"><span class="num">${s.n}</span><span>${esc(s.text)}${s.why ? `<div class="meta">${esc(s.why)}</div>` : ''}</span><span>${withTask ? pill(s.use === 'borrowed' ? 'ok' : s.use === 'not used' ? '' : 'ok', s.use) : ''}</span></li>`).join('');
    const also = K.also.length ? `<div class="callout ${S.skillSel === 'sk-residual' && withTask ? 'miss' : ''}" style="margin-top:10px"><b>Same name, ${K.also.length + 1} sources.</b> Selected: <span class="mono">${esc(K.source)}</span> (${esc(K.sourceKind)}).
        ${K.also.map((a) => `<div>Also: <span class="mono">${esc(a.source)}</span> — ${esc(a.kind)}. ${esc(a.note)}.</div>`).join('')}
        ${withTask ? '<div style="margin-top:4px"><b>The selected source is not what the agent would load by name.</b> Adoption stays unresolved until the selected file is delivered.</div><div class="actions"><button class="btn sm">Deliver selected source (needs source-qualified load)</button><button class="btn sm">Compare the two texts</button></div>' : ''}</div>` : '';
    const changed = K.changed && withTask ? `<div class="callout" style="margin-top:8px"><b>Changed since it was shown.</b> The session holds the text read at turn 20; the file was edited at 10:40. <button class="link">Show differences</button> · <button class="link">Ask the agent to reload</button></div>` : '';
    const rel = withTask ? `<section class="sec"><h3>Relationship to this task</h3><div class="relpick" role="radiogroup" aria-label="Relationship to this task">${relNames.map(([k, l]) => `<button role="radio" aria-pressed="${S.skillRel === k}" aria-checked="${S.skillRel === k}" data-act="rel:${k}">${l}</button>`).join('')}</div>
      <div class="prov agent" style="margin-top:8px"><div class="who">✦ Agent · provisional reason</div><div class="tx">${id === 'sk-residual' && S.skillRel === 'unresolved' ? 'You selected the topic method, but loading by name would deliver the personal copy. I have not followed either as instructions; use stays unresolved until the selected file is delivered.' : S.skillRel === 'borrow' ? 'Borrowing step 3 only: it states your agreed stopping rule. Steps 1, 2 and 4 would replace damped linear mixing, which you fixed.' : S.skillRel === 'use' ? 'You selected this method for the stopping comparison; its steps apply as written.' : 'Changed by you; the agent will follow this choice and explain any conflict.'}</div><div class="wh">turn 34 · you can change this; your choice is kept as your instruction</div></div>
      ${S.skillRel === 'use' && id === 'sk-anderson' ? '<div class="callout miss" style="margin-top:8px">Using the whole procedure would change the solver you fixed. The agent will ask before acting on it.</div>' : ''}
      ${id === 'sk-anderson' && S.skillRel === 'borrow' ? `<div class="usecard"><dl><dt>Borrowed</dt><dd>Step 3 — evaluate rₖ = F(xₖ) − xₖ and stop on ‖rₖ‖ &lt; τ</dd>
        <dt>Depends on</dt><dd>F(xₖ) each iteration ${pill('ok', 'available · mixing.py:39')}</dd>
        <dt>Travels with it</dt><dd>“Report the residual in the same norm as the tolerance.”</dd>
        <dt>Not used</dt><dd>Steps 1, 2, 4 — they replace damped linear mixing, which you fixed</dd>
        <dt>Does not transfer</dt><dd>Its convergence-rate claims (shown only for Anderson updates)</dd></dl></div>` : ''}</section>` : '';
    return `<div class="crumb">Skill · ${esc(K.sourceKind)}</div><h2 class="title" style="font-size:20px">${esc(K.name)}</h2>
      <div class="meta"><span class="mono">${esc(K.source)}</span><span>${esc(K.loaded)}</span></div>${also}${changed}${rel}
      <section class="sec"><h3>Purpose</h3><div>${esc(K.purpose)}</div></section>
      <section class="sec"><h3>Preconditions ${withTask ? '<span class="n">· against this task</span>' : ''}</h3>${pre}</section>
      <section class="sec"><h3>Steps</h3><ol class="steps">${steps}</ol></section>
      ${K.mandatory.length ? `<section class="sec"><h3>Instructions that travel with borrowed steps</h3>${K.mandatory.map((m) => `<div class="prov src"><div class="who">▤ Skill text</div><div class="tx">${esc(m.text)}</div><div class="wh">${esc(m.applies)}</div></div>`).join('')}</section>` : ''}
      <section class="sec"><h3>Limits</h3><div>${esc(K.limits)}</div></section>`;
  }

  function skillsCatalog() {
    const list = [['sk-residual', 'residual-diagnostics', 'Topic method · also a personal copy'], ['sk-anderson', 'anderson-mixing-solver', 'Topic method'], ['', 'aitp-memory', 'Portable AITP · bundled'], ['', 'aitp-distill', 'Portable AITP · bundled'], ['', 'developing-librpa', 'Portable AITP · nested · link only']];
    const nav = `<div class="navcol"><h3>Sources</h3><div class="opts" style="padding:0 6px"><label><input type="checkbox" checked>Portable AITP</label><label><input type="checkbox" checked>Topic</label><label><input type="checkbox" checked>Personal</label></div>
      <h3>Methods</h3>${list.map(([id, n, k]) => `<button class="navitem" ${id ? `data-act="skill:${id}"` : ''} aria-current="${S.skillSel === id && !S.catalogReport}">${esc(n)}<small>${esc(k)}</small></button>`).join('')}
      <h3>Diagnostics</h3><button class="navitem" data-act="catalog-report" aria-current="${S.catalogReport}">Discovery report<small>roots searched · shadowed names</small></button></div>`;
    if (S.catalogReport) {
      return `<div class="pbody">${nav}<div class="reader"><div class="crumb">Skills › Discovery report</div><h2 class="title" style="font-size:20px">Where methods were looked for</h2>
        <div class="rowlist"><div><span class="nm mono">aitp/plugins/aitp/skills</span><span class="cl">7 portable Skills · lowest precedence (bundled)</span></div>
        <div><span class="nm mono">spectra/skills</span><span class="cl">2 topic methods · listed in the topic README</span></div>
        <div><span class="nm mono">~/.agents/skills</span><span class="cl">1 personal Skill · outranks topic and bundled sources</span></div>
        <div><span class="nm mono">…/methods/librpa/developing-librpa</span><span class="cl">nested · reachable through the domain index link; not in the agent’s catalog</span></div></div>
        <section class="sec"><h3>Same-named Skills</h3><div class="callout miss">residual-diagnostics: the personal copy shadows the topic method when loaded by name.</div></section>
        <p class="meta">No result means no match in these roots, not that no method exists.</p></div></div>`;
    }
    const pendingProposal = S.skillSel === 'sk-residual' ? `<div class="card" style="margin-top:12px;border-left:3px solid var(--warn)"><b>1 proposal from evidence · not applied</b><div class="meta">Draft in “Third-system residual check” · transfer: 1 failed, 1 untested · Skill file unchanged</div><div class="actions"><button class="btn sm" data-act="open-distill">Open proposal</button><button class="btn sm" data-act="open-session:s-third">Open motivating session</button></div></div>` : '';
    return `<div class="pbody">${nav}<div class="reader rel">${anno('m', 'Synthetic Skill text')}${skillCore(S.skillSel, false)}${pendingProposal}</div></div>`;
  }

  /* ---------- Rules ---------- */
  function rules() {
    const head = `<div class="phead rel">${anno('a', 'AITP global panel · main slot')}<h1>Rules</h1><span class="ctx">how the agent should work · guidance, not tool permissions</span><span class="sp"></span>
      <label class="opts"><span class="meta">Showing</span><select aria-label="Rule scope"><option>Rules for Self-consistent spectra</option><option>All my rules</option></select></label></div>`;
    const stateLine = { none: '', draft: pill('warn', 'Draft · not saved'), saved: pill('warn', 'Saved · not yet used by this task'), failed: pill('miss', 'Couldn’t save · draft kept'), adopted: pill('ok', 'Used by the request at turn 35') }[S.ruleState];
    const oldRule = 'Give the derivation before its interpretation.';
    const newRule = 'Give the derivation before its interpretation. Keep the existing notation (xₖ, F, α, τ) and state units in the first equation.';
    const editor = S.ruleEdit ? `<div class="editor rel" style="margin-bottom:10px">${anno('a', 'Proposed rule editor')}
        <div class="meta">Editing a rule in Writing and explanation · current text: “${esc(oldRule)}”</div>
        <label class="meta" for="rule-text" style="display:block;margin-top:6px">New text (saved verbatim; the agent never rewrites it)</label><textarea id="rule-text">${esc(newRule)}</textarea>
        <div class="affected">Affects sessions on this topic: <b>Third-system residual check</b> (a step is running now) · Stopping test vs agreed rule (idle)</div>
        <div class="sec" style="margin-top:10px"><div class="meta">Scope</div><div class="opts"><label><input type="radio" name="sc">This task only</label><label><input type="radio" name="sc" checked>This topic</label><label><input type="radio" name="sc">All my work</label></div></div>
        <div class="sec" style="margin-top:10px"><div class="meta">Saved to</div><div class="opts"><label><input type="radio" name="ds" checked>App rules for this topic <span class="meta">· this app only</span></label>
          <label class="dis"><input type="radio" name="ds" disabled>research.md › Standing agreements <span class="meta">· portable; note writes not enabled</span></label>
          <label class="dis"><input type="radio" name="ds" disabled>Portable AITP Skill <span class="meta">· separate upstream change</span></label></div></div>
        <div class="callout info" style="margin-top:10px">Takes effect from the agent’s next request in sessions on this topic. The step now running keeps its current rules. Earlier replies and notes are not rewritten.</div>
        ${S.ruleConflict ? `<div class="callout" style="margin-top:8px"><b>Possible conflict.</b> “Prefer energies in eV in prose” (personal, all work) and “state units in the first equation” can both apply. Both stay visible; the agent will say which it followed, or ask if the choice matters.</div>` : ''}
        ${S.ruleState === 'failed' ? '<div class="callout miss" style="margin-top:8px"><b>Couldn’t save.</b> The app rule store did not accept the write. Your draft is kept here; nothing was applied.</div>' : ''}
        <div class="actions"><button class="btn primary" data-act="rule-save">${S.ruleState === 'failed' ? 'Retry save' : 'Save'}</button><button class="btn" data-act="rule-cancel">Cancel</button>${stateLine}</div></div>` : '';
    const card = (r) => {
      if (r.id === 'r1' && S.ruleEdit) return editor;
      if (r.id === 'r1' && S.ruleState === 'saved') return `<div class="rulecard" style="border-left:3px solid var(--warn)"><div class="rt">${esc(newRule)}</div><div class="rm"><span>This topic</span><span>Your rule (app rules)</span>${stateLine}<span>the running step began before the save</span><button class="link">Previous text</button></div></div>`;
      return `<div class="rulecard"><div class="rt">${esc(r.text)}</div><div class="rm"><span>${esc(r.scope)}</span><span>${esc(r.source)}</span>${pill(r.state.startsWith('Used') ? 'ok' : '', r.state)}<button class="link" ${r.id === 'r1' ? 'data-act="rule-edit"' : ''}>${r.source.startsWith('Portable') ? 'Override for my work' : 'Edit'}</button><button class="link">Why this rule?</button></div></div>`;
    };
    const groups = F.rules.map((g) => `<section class="sec"><h3>${esc(g.group)}</h3>${g.items.map(card).join('')}</section>`).join('');
    return `${head}<div class="reader" style="max-width:900px">${groups}
      <p class="meta" style="margin-top:18px">Tool permissions for a session (for example Read only) are Harness controls in the composer, not rules here. Editing a rule does not grant or remove a tool.</p></div>`;
  }

  /* ---------- Conversation (Harness surface with AITP contributions) ---------- */
  function conversation() {
    const s = sessionById(S.session);
    const origin = s.id === 's-paper' ? 'Global · Synthetic Paper A ed. 2 · p. 112' : `Topic · ${s.topic}${s.thread ? ' › ' + s.thread : ''}`;
    const memOn = !!S.dock && S.dock.panes.some((p) => p.tabs.includes('mem') && p.active === 'mem');
    const head = `<div class="chead rel">${anno('h', 'Harness header · AITP header actions')}<span class="ttl" title="${esc(s.title)}">${esc(s.title)}</span>
      <span class="acts"><button class="hbtn" data-act="toggle-mem" aria-pressed="${memOn}">Sources &amp; memory</button><button class="hbtn" aria-label="Toggle right sidebar" data-act="toggle-dock">◨</button></span>
      <span class="origin" title="${esc(origin)}">◎ ${esc(origin)}</span></div>`;
    let flow;
    if (s.id === 's-paper') {
      flow = `<div class="msg-user"><div class="b">Explain the stopping condition in Eq. (7) and how it relates to the damping factor.<div style="margin-top:4px"><span class="chip attach">▤ Eq. (7) · ed. 2 · p. 112 · sent at turn 1 · in context now</span></div></div></div>
        <div class="toolrow"><div class="tr">▤ Read 1 passage · Synthetic Paper A ed. 2 · printed p. 112</div></div>
        <div class="msg-agent">Eq. (7) states the stopping test on the residual rₖ itself. With damping α the step is α‖rₖ‖, so a tolerance on the step is a looser test by a factor 1/α <button class="link">[ed. 2, p. 112]</button>. The paper does not bound the distance to the fixed point; that needs a contraction constant (see the linked knowledge entry).</div>`;
    } else if (s.id === 's-fix') {
      flow = `<div class="msg-user"><div class="b">Why does the run stop before the agreed tolerance? Inspect only.</div></div>
        <div class="toolrow"><div class="tr">▤ Read 3 passages · research.md L19–22 · mixing.py L36–46 · runs/systemC/out.log (last 20 lines)</div></div>
        <div class="toolrow"><div class="tr agentnote">✦ Working note added · provisional — “Line 43 tests the damped step, not the residual.”</div></div>
        <div class="msg-agent">Line 43 compares <span class="mono">step = ‖x_new − x‖ = α‖r‖</span> with τ, while the agreed rule (research.md L19) tests ‖r‖. With α = 0.1 the logged stop at step 8.2×10⁻⁷ corresponds to ‖r‖ ≈ 8.2×10⁻⁶, above τ. This localizes the mismatch; it does not show whether system C converges or which branch it reached. Two files were modified before this session and I have not attributed them.</div>`;
    } else {
      flow = F.transcript.map((n) => {
        if (n.kind === 'summary') return `<div class="checkpoint"><div class="cp">⋯ <b>Context compacted</b> (Harness marker) · ${esc(n.text)} Messages above it stay visible here but are no longer in the agent’s context; the generated summary is not your words, and your instructions are kept verbatim in the task card. <button class="link">Open summary</button></div></div>`;
        if (n.kind === 'user') return `<div class="msg-user"><div class="b">${esc(n.text)}</div></div>`;
        if (n.kind === 'activity') return `<div class="toolrow"><div class="tr">▤ ${esc(n.text)} <button class="link" style="margin-left:auto">details</button></div><ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
        if (n.kind === 'memory') return `<div class="toolrow"><div class="tr agentnote">✦ ${esc(n.label)} · provisional — “${esc(n.text)}”</div></div>`;
        return `<div class="msg-agent">${esc(n.text)}</div>`;
      }).join('');
      if (S.methodLine) flow += `<div class="toolrow"><div class="tr agentnote">✦ Method use · borrowing step 3 of <button class="link" data-act="dock-skill:sk-anderson">anderson-mixing-solver</button>; keeping your damped linear mixing <button class="link" style="margin-left:auto" data-act="dock-skill:sk-anderson">why</button></div></div>`;
      if (S.outcomeLine) flow += `<div class="toolrow"><div class="tr outcome">◇ <b>Outcomes</b> · Pending integration: the system-C stopping finding → research.md (not written; note writes are not enabled). · Possible method correction → <button class="link" data-act="dock-distill">open distillation</button></div></div>`;
      if (S.ruleAdoptedLine) flow += `<div class="msg-user"><div class="b">Continue with the residual bound.</div></div><div class="msg-agent">Using your notation (xₖ, F, α, τ), with the residual stated in the same units as F: ‖rₖ‖ = ‖xₖ₊₁ − xₖ‖ / α ≈ 8.2 × 10⁻⁶ at stop. Interpretation follows the derivation: the stopping test is looser than the agreed rule by 1/α.</div>`;
    }
    const banner = S.disconnected ? '<div class="banner miss">Backend unreachable · last known state shown · the agent may still be running</div>' : '';
    return `${head}${banner}<div class="flow" tabindex="0" aria-label="Conversation">${flow}</div>${s.id === 's-third' ? taskCard() : ''}
      <div class="composer rel">${anno('h', 'Harness composer', 'br')}<div class="box ${s.id === 's-third' ? '' : 'alone'}"><textarea aria-label="Message" placeholder="Continue this task"></textarea>
      <div class="bar"><span class="chip">＋</span>${s.id === 's-third' ? '<span class="chip" title="Proposed AITP chip: a message continues the current task; a new task is a separate choice">Sends into this task</span>' : ''}<span class="sp"></span><span class="chip" title="Harness permission control">Read only</span><span class="chip" title="Harness model selector">model · synthetic</span><button class="btn primary sm">Send</button></div></div></div>`;
  }

  function taskCard() {
    const T = F.task;
    const sum = `<div class="row1"><span class="lbl">Task</span><span style="flex:1">${esc(T.statement.text)}</span><button class="link" data-act="toggle-task" aria-expanded="${S.taskOpen}">${S.taskOpen ? 'Collapse' : 'Details'}</button></div>
      <div class="sum">${pill('ok', 'From you · ' + (T.corrections.length + 1))}${pill('agent', 'Agent notes · provisional · ' + T.agent.filter((a) => !a.source).length)}${pill('warn', 'Gap · ' + T.gaps[0].text)}${S.ruleAdoptedLine ? pill('ok', 'Topic rule changed 10:44 · used at turn 35') : ''}${pill('sum', '2 generated summaries')}</div>`;
    const memShown = !!S.dock && S.dock.panes.some((p) => p.active === 'mem');
    const detail = S.taskOpen && memShown ? '<div class="meta" style="margin-top:6px">Details are open in Sources &amp; memory.</div>' : S.taskOpen ? `<div class="detail">
      <div class="prov you"><div class="who">● You · task</div><div class="tx">${esc(T.statement.text)}</div><div class="wh">${esc(T.statement.where)}</div></div>
      ${T.corrections.map((c) => `<div class="prov you"><div class="who">● You · ${c.choice ? 'choice' : 'instruction'}</div>${c.choice ? `<div class="wh">${esc(c.choice)}</div>` : ''}<div class="tx">${esc(c.text)}</div><div class="wh">${esc(c.where)}</div></div>`).join('')}
      ${T.agent.map((a) => `<div class="prov ${a.source ? 'src' : 'agent'}"><div class="who">${a.source ? '▤ Source' : '✦ Agent · provisional'} · ${esc(a.kind)}</div><div class="tx">${esc(a.text)}</div><div class="wh">${esc(a.where)}${a.source ? '' : ' · <button class="link">Mark wrong</button>'}</div></div>`).join('')}
      ${T.gaps.map((g) => `<div class="prov gap"><div class="who">◌ Gap · ${esc(g.level)}</div><div class="tx">${esc(g.text)}</div><div class="wh">${esc(g.origin)} · ${esc(g.effect)} · the session continues</div></div>`).join('')}
      ${S.ruleAdoptedLine ? '<div class="prov you"><div class="who">● Your rule · this topic</div><div class="tx">Give the derivation before its interpretation. Keep the existing notation (xₖ, F, α, τ) and state units in the first equation.</div><div class="wh">edited 10:44 · used by the request at turn 35</div></div>' : ''}
      </div>` : '';
    return `<div class="ctxstack rel">${anno('a', 'AITP task card · composer-context stack')}<div class="taskcard">${sum}${detail}</div></div>`;
  }

  /* ---------- Dock (Harness right sidebar; AITP tab types) ---------- */
  const TABS = {
    mem: 'Sources & memory', note: 'research.md', paper: 'Paper A · ed. 2', code: 'mixing.py', compare: 'Rule ↔ code', skill: 'Skill', distill: 'Distillation',
  };
  function dock() {
    if (!dockOpen()) return '';
    return `<section class="dock rel ${S.dock.panes.length > 1 ? 'two' : ''}" aria-label="Right sidebar">${anno('h', 'Harness dock · AITP tab types')}${S.dock.panes.map((p, i) => `<div class="pane">
      <div class="dtabs" role="tablist">${p.tabs.map((t) => `<button role="tab" aria-selected="${p.active === t}" data-act="dtab:${i}:${t}">${esc(t === 'skill' ? F.skills[S.skillSel].name : TABS[t])}</button>`).join('')}</div>
      <div class="dbody">${dockBody(p.active)}</div></div>`).join('')}</section>`;
  }

  function dockBody(t) {
    if (t === 'mem') return memoryPage();
    if (t === 'note') return noteReader(true);
    if (t === 'paper') {
      const P = F.paper;
      return `<div class="meta">${pill('ok', 'Attached · sent at turn 1 · in context now')}<span>Edition 2 · PDF p. 4 · printed p. 112</span></div><h2 class="title" style="font-size:18px">${esc(P.title)}</h2><p class="passage">${esc(P.passage)}</p><div class="eq">${esc(P.eq)}</div>
        <div class="actions"><button class="btn sm">Open current file</button><button class="btn sm">Open reading note</button></div><p class="meta">Browsing other pages here does not attach them. Attach a selection explicitly.</p>`;
    }
    if (t === 'code') return `<div class="meta"><span class="mono">scf-solver · damped-mixing · mixing.py</span><span>working tree · 2 dirty files (attribution unknown)</span></div>${codeLines(F.code.lines, F.code.highlight)}`;
    if (t === 'compare') {
      return `<div class="meta" style="margin-bottom:8px">${pill('', 'Comparison tab · two resources in one dock pane')}</div><div class="compare" style="height:auto">
        <div><div class="meta">research.md · Agreed stopping rule · L19</div><div class="eq">${esc(F.note.blocks[4].eq)}</div><p class="passage" style="font-size:14px">${esc(F.note.blocks[5].p)}</p></div>
        <div><div class="meta">mixing.py · L39–44 · working tree</div>${codeLines(F.code.lines.filter(([n]) => n >= 39 && n <= 44), F.code.highlight)}</div></div>
        <section class="sec"><h3>Diagnostic evidence</h3><div class="codeblk" style="padding:4px 10px">${F.code.log.slice(1).map((l) => `<div>${esc(l)}</div>`).join('')}</div><div class="srcline">runs/systemC/out.log · retained file observed 10:29 · not an execution record</div>
        <div class="prov agent" style="margin-top:8px"><div class="who">✦ Agent · provisional derivation</div><div class="tx">‖r‖ at stop ≈ 8.2×10⁻⁷ / 0.1 = 8.2×10⁻⁶ &gt; τ = 10⁻⁶</div><div class="wh">derived from the log and line 40; no new run</div></div></section>`;
    }
    if (t === 'skill') return skillCore(S.skillSel, true);
    if (t === 'distill') return distillPage();
    return '';
  }

  function memoryPage() {
    const T = F.task;
    const src = F.sources.map((r) => `<div style="display:grid;grid-template-columns:1fr;gap:2px;padding:8px 10px"><div><b>${esc(r.res)}</b> <span class="meta mono">${esc(r.loc)}</span></div>
      <div class="meta" style="display:flex;gap:6px;flex-wrap:wrap">${pill(stateKind[r.stateKind], r.state)}${pill(r.req === 'Optional background' ? '' : 'warn', r.req)}<span>${esc(r.why)}</span></div></div>`).join('');
    const n = (k) => F.sources.filter((r) => r.stateKind === k).length;
    return `<div class="rel">${anno('a', 'AITP session page')}<h2 class="title" style="font-size:19px">Sources &amp; memory</h2><div class="meta">This session · task since turn 1 · 2 generated checkpoints · read only</div>
      <div class="sum" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${pill('ok', `${n('ok')} sources in context now`)}${pill('warn', `${n('warn')} condensed, not re-read`)}${pill('miss', `${n('missing')} missing`)}${pill('', `${n('muted')} found, not read`)}${pill('agent', `${T.agent.filter((a) => !a.source).length} agent notes`)}</div>
      <section class="sec"><h3>Your instructions <span class="n">· verbatim</span></h3>
        <div class="prov you"><div class="who">● You · task</div><div class="tx">${esc(T.statement.text)}</div><div class="wh">${esc(T.statement.where)}</div></div>
        ${T.corrections.map((c) => `<div class="prov you"><div class="who">● You · ${c.choice ? 'choice' : 'instruction'}</div>${c.choice ? `<div class="wh">${esc(c.choice)}</div>` : ''}<div class="tx">${esc(c.text)}</div><div class="wh">${esc(c.where)}</div></div>`).join('')}</section>
      <section class="sec"><h3>Rules and methods in effect</h3>${F.rulesInEffect.map((r) => `<div class="prov src"><div class="who">▤ ${esc(r.source)} · ${esc(r.scope)}</div><div class="tx">${esc(r.text)}</div><div class="wh">${esc(r.state)}</div></div>`).join('')}</section>
      <section class="sec"><h3>Agent working notes <span class="n">· provisional, not your decisions</span></h3>${T.agent.filter((a) => !a.source).map((a) => `<div class="prov agent"><div class="who">✦ Agent · ${esc(a.kind)}</div><div class="tx">${esc(a.text)}</div><div class="wh">${esc(a.where)} · <button class="link">Mark wrong</button> · <button class="link">Retire</button></div></div>`).join('')}</section>
      <section class="sec"><h3>Sources <span class="n">· found, sent and currently in context are different</span></h3><div class="rowlist" style="display:block">${src}</div></section>
      <section class="sec"><h3>Generated summaries</h3><div class="prov sum"><div class="who">⋯ Generated · not authoritative</div><div class="tx">Checkpoints at turns 18 and 31 condense earlier turns. They may paraphrase; the items above are kept separately.</div><div class="wh"><button class="link">Open checkpoint text</button></div></div></section>
      <details class="sec"><summary class="meta">Diagnostics</summary><p class="meta mono">event ids, token accounting and delivery records</p></details></div>`;
  }

  function distillPage() {
    const D = F.distill;
    const res = { replay: ['', 'replay'], failed: ['miss', 'failed transfer'], untested: ['warn', 'untested'] };
    return `<div class="rel">${anno('a', 'AITP distillation page')}<div class="crumb">Distillation · residual-diagnostics</div><h2 class="title" style="font-size:19px">Proposed correction from demonstrated use</h2>
      <div class="status-rail" role="list" aria-label="Status">
        <div class="y" role="listitem"><b>Draft</b>Exists in this session (not a file)</div>
        <div class="p" role="listitem"><b>Evaluation</b>Narrowed · 1 failed, 1 untested</div>
        <div class="n" role="listitem"><b>Skill file</b>Unchanged · writes not enabled</div>
        <div class="n" role="listitem"><b>Installed</b>No</div>
        <div class="n" role="listitem"><b>Published</b>No</div></div>
      <section class="sec"><h3>Proposed revision <span class="n">· to ${esc(D.existing.split(' · ')[0])}, step 2</span></h3><div class="diff card" style="padding:6px 0">${D.diff.map(([k, t]) => `<div class="${k}">${esc(t)}</div>`).join('')}</div></section>
      <section class="sec"><h3>Evaluation</h3>${D.evals.map((e) => `<div class="card eval"><b>${esc(e.name)}</b>${pill(res[e.result][0], res[e.result][1])}<span class="meta" style="grid-column:1/-1">${esc(e.text)}</span></div>`).join('')}</section>
      <section class="sec"><h3>Evidence <span class="n">· what the draft is based on</span></h3>${D.evidence.map((e) => `<div class="prov src"><div class="who">▤ ${esc(e.kind)} · ${esc(e.loc)}</div><div class="tx">${esc(e.text)}</div></div>`).join('')}</section>
      <div class="callout info sec">The system-C finding itself belongs in research.md; it is listed as pending integration there and is not part of this Skill.</div>
      <div class="actions"><button class="btn primary">Keep narrow draft</button><button class="btn">No change needed</button><button class="btn">Discard</button><button class="btn" disabled title="Writes are not enabled">Apply to Skill file</button></div></div>`;
  }

  /* ---------- guide and chrome ---------- */
  function guide() {
    if (!S.guide) return '';
    const w = W.find((x) => x.id === S.guide.w); const st = w.steps[S.guide.i];
    return `<aside class="guide" aria-label="Prototype walkthrough"><div><h4>${esc(w.title)}</h4><div class="cases">${esc(w.cases)} · step ${S.guide.i + 1} of ${w.steps.length}</div><div class="cases" style="margin-top:6px">Prototype guide — not part of the product</div></div>
      <dl><dt>Entry point</dt><dd>${esc(st.entry)}</dd><dt>Visible</dt><dd>${esc(st.visible)}</dd><dt>Researcher</dt><dd>${esc(st.action)}</dd><dt>Agent / system</dt><dd>${esc(st.feedback)}</dd><dt>Failure or doubt</dt><dd>${esc(st.failure)}</dd></dl>
      <div class="nav"><button data-act="g-prev" ${S.guide.i === 0 ? 'disabled' : ''}>‹ Previous</button><button data-act="g-next" ${S.guide.i === w.steps.length - 1 ? 'disabled' : ''}>Next ›</button><button data-act="g-exit">Exit</button></div></aside>`;
  }

  function protoBar() {
    return `<div class="proto-bar" role="banner"><b>DESIGN PROTOTYPE</b><span>Synthetic data · no model, files or Harness runtime</span><span class="sp"></span>
      <button data-act="menu" aria-expanded="${S.menu}">Walkthroughs ▾</button><button data-act="annotate" aria-pressed="${S.annotate}">Label parts</button><button data-act="theme" aria-pressed="${S.theme === 'dark'}">Dark</button></div>
      ${S.menu ? `<div class="menu" role="menu">${W.map((w) => `<button role="menuitem" data-act="go:${w.id}.1">${esc(w.title)}<br><small>${esc(w.cases)} · ${w.steps.length} steps</small></button>`).join('')}</div>` : ''}`;
  }

  function render() {
    document.documentElement.dataset.theme = S.theme;
    document.body.classList.toggle('annotate', S.annotate);
    const sideW = S.sideCollapsed || dockOpen() ? '56px' : '264px';
    const dockW = dockOpen() ? (S.dock.panes.length > 1 ? '58%' : '46%') : '0px';
    const main = { research, materials, rules, conversation }[S.view]();
    $('#app').innerHTML = `${protoBar()}<div class="frame ${S.guide ? 'has-guide' : ''}" style="--side-w:${sideW};--dock-w:${dockW}">${side()}<main class="main">${main}</main>${dock()}</div>${guide()}`;
    const flow = $('.flow'); if (flow) flow.scrollTop = flow.scrollHeight; // conversations follow their tail, as Harness chat does
  }

  /* ---------- state changes ---------- */
  function apply(patch) { S = { ...S, ...patch }; render(); }
  function goStep(wid, i) {
    const w = W.find((x) => x.id === wid); if (!w) return;
    i = Math.max(0, Math.min(i, w.steps.length - 1));
    S = { ...S, ...BASE, ...w.steps[i].st, guide: { w: wid, i }, menu: false };
    if (location.hash !== `#${wid}.${i + 1}`) history.replaceState(null, '', `#${wid}.${i + 1}`);
    render();
  }
  function openDockTab(tab) {
    const panes = S.dock ? S.dock.panes.map((p) => ({ ...p, tabs: [...p.tabs] })) : [{ tabs: [], active: tab }];
    if (!panes[0].tabs.includes(tab)) panes[0].tabs.unshift(tab);
    panes[0].active = tab; apply({ dock: { panes } });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const [a, b, c] = el.dataset.act.split(':');
    const act = {
      nav: () => apply({ view: b, guide: null, researchSub: 'home', ruleEdit: false, catalogReport: false }),
      'open-session': () => apply({ view: 'conversation', session: b, guide: null, paperSession: b === 's-paper', fixSession: b === 's-fix' }),
      topic: () => apply({ topic: b, researchSub: 'home' }),
      'research-note': () => apply({ researchSub: 'note' }),
      'research-home': () => apply({ researchSub: 'home' }),
      'work-on-passage': () => apply({ view: 'conversation', session: 's-third', dock: { panes: [{ tabs: ['note', 'mem'], active: 'note' }] } }),
      'open-mat': () => { const m = { 'paper-a': ['library'], 'k-residual': ['knowledge', 'k-residual'], 'k-contraction': ['knowledge', 'k-contraction'], code: ['code'], 'sk-residual': ['skills', null, 'sk-residual'], 'sk-anderson': ['skills', null, 'sk-anderson'] }[b];
        apply({ view: 'materials', matTab: m[0], knowSel: m[1] || S.knowSel, skillSel: m[2] || S.skillSel }); },
      mat: () => apply({ matTab: b, catalogReport: false }),
      edition: () => apply({ libEdition: b, libCompare: false }),
      'lib-compare': () => apply({ libCompare: true }),
      'lib-compare-close': () => apply({ libCompare: false }),
      'lib-draft': () => apply({ libDraft: true }),
      'lib-draft-cancel': () => apply({ libDraft: false }),
      'start-paper-session': () => apply({ view: 'conversation', session: 's-paper', libDraft: false, dock: { panes: [{ tabs: ['paper', 'mem'], active: 'paper' }] } }),
      'start-fix-session': () => apply({ view: 'conversation', session: 's-fix', dock: { panes: [{ tabs: ['compare', 'code', 'mem'], active: 'compare' }] } }),
      know: () => apply({ knowSel: b, matTab: S.view === 'materials' && S.matTab === 'library' ? 'knowledge' : S.matTab, libCompare: false }),
      codetab: () => apply({ codeTab: b }),
      skill: () => apply({ skillSel: b, catalogReport: false }),
      'catalog-report': () => apply({ catalogReport: true }),
      'open-distill': () => apply({ view: 'conversation', session: 's-third', outcomeLine: true, dock: { panes: [{ tabs: ['distill', 'mem'], active: 'distill' }] } }),
      'rule-edit': () => apply({ ruleEdit: true, ruleState: 'draft', ruleConflict: true }),
      'rule-save': () => apply({ ruleEdit: false, ruleState: 'saved' }),
      'rule-cancel': () => apply({ ruleEdit: false, ruleState: 'none' }),
      rel: () => apply({ skillRel: b }),
      'toggle-task': () => apply({ taskOpen: !S.taskOpen }),
      'toggle-mem': () => (S.dock && S.dock.panes[0].active === 'mem' ? apply({ dock: null }) : openDockTab('mem')),
      'toggle-dock': () => apply({ dock: S.dock ? null : { panes: [{ tabs: ['mem'], active: 'mem' }] } }),
      'dock-skill': () => { S.skillSel = b; openDockTab('skill'); },
      'dock-distill': () => openDockTab('distill'),
      dtab: () => { const panes = S.dock.panes.map((p) => ({ ...p })); panes[+b].active = c; apply({ dock: { panes } }); },
      'collapse-side': () => apply({ sideCollapsed: true }),
      'expand-side': () => apply({ sideCollapsed: false, dock: null }),
      menu: () => apply({ menu: !S.menu }),
      go: () => { const [w, n] = b.split('.'); goStep(w, +n - 1); },
      'g-next': () => goStep(S.guide.w, S.guide.i + 1),
      'g-prev': () => goStep(S.guide.w, S.guide.i - 1),
      'g-exit': () => { history.replaceState(null, '', location.pathname); apply({ guide: null }); },
      annotate: () => apply({ annotate: !S.annotate }),
      theme: () => apply({ theme: S.theme === 'dark' ? 'light' : 'dark' }),
    }[a];
    if (act) { e.preventDefault(); act(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.menu) apply({ menu: false });
    if (!S.guide || e.target.closest('textarea,input,select')) return;
    if (e.key === 'ArrowRight') goStep(S.guide.w, S.guide.i + 1);
    if (e.key === 'ArrowLeft') goStep(S.guide.w, S.guide.i - 1);
  });
  function fromHash() {
    const m = /^#(s\d)\.(\d+)$/.exec(location.hash);
    const q = new URLSearchParams(location.search);
    if (q.get('theme') === 'dark') S.theme = 'dark';
    if (q.get('annotate') === '1') S.annotate = true;
    if (m) goStep(m[1], +m[2] - 1); else render();
  }
  window.addEventListener('hashchange', fromHash);
  window.AITP_PROTOTYPE = { walkthroughs: W.map((w) => ({ id: w.id, title: w.title, cases: w.cases, steps: w.steps.length })) };
  fromHash();
})();
