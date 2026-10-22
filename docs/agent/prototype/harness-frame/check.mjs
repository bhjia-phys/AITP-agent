// Browser check for the Harness-frame design prototype.
// Serves only this directory on 127.0.0.1, drives the synthetic walkthroughs in an existing
// Chrome/Chromium, asserts visible states, and writes screenshots plus a JSON report.
// It installs nothing. Usage (from the repository root):
//   AITP_CHROME=/path/to/chrome [AITP_BROWSER_LIBS=/extra/libs] [AITP_SHOT_DIR=dir] \
//     node docs/agent/prototype/harness-frame/check.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';

const here = resolve(import.meta.dirname);
const repo = resolve(process.env.AITP_REPO ?? resolve(here, '../../../..'));
const executablePath = process.env.AITP_CHROME;
if (!executablePath) throw new Error('Set AITP_CHROME to an installed Chrome or Chromium executable.');
const shotDir = resolve(process.env.AITP_SHOT_DIR ?? join(here, 'screenshots'));
const { chromium } = createRequire(join(repo, 'apps/web/package.json'))('playwright');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const requests = [];
const server = createServer(async (req, res) => {
  requests.push(`${req.method} ${req.url}`);
  const path = normalize(join(here, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (req.method !== 'GET' || !(path === here || path.startsWith(here + sep))) { res.writeHead(403).end(); return; }
  const file = path.endsWith(sep) || path === here ? join(path, 'index.html') : path;
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}/`;

const expect = {
  's1.1': ['Current answer, as written', 'Decisive gap', 'Needs your input', 'Assembled from the note', 'Sessions on this topic', 'Thread'],
  's1.2': ['Context compacted', 'no longer in the agent', 'not your words', 'From you · 3', 'Agent notes · provisional · 2', 'not found'],
  's1.3': ['Your instructions', 'Agent working notes', 'Generated summaries', 'In context now', 'Missing — file not found', 'condensed since', 'Required by the note', 'Optional background'],
  's1.4': ['Backend unreachable', 'last observed 10:31', 'state unknown'],
  's2.1': ['printed p. 112', 'Index covers 2 of 3', 'Not marked read', 'Edition 1 · preprint'],
  's2.2': ['Close comparison', 'Support: derived', 'Contraction mapping theorem'],
  's2.3': ['attached, not sent', 'None (Global)', 'Discard draft'],
  's2.4': ['sent at turn 1', 'in context now', 'Global · Synthetic Paper A'],
  's3.1': ['Research run record · proposed', 'Agent edits and commands · exists, generic', 'attribution unknown', 'not an execution record'],
  's3.2': ['Comparison tab', 'not an execution record', 'provisional derivation', 'does not show whether system C converges'],
  's4.1': ['Relationship to this task', 'Travels with it', 'Does not transfer', 'borrowed', 'Instructions that travel with borrowed steps', 'keeping your damped linear mixing'],
  's4.2': ['not what the agent would load by name', 'Changed since it was shown', 'Personal copy (older)'],
  's5.1': ['Skill file', 'Unchanged · writes not enabled', 'failed transfer', 'untested', 'Published', 'pending integration'],
  's5.2': ['1 proposal from evidence · not applied'],
  's6.1': ['Affects sessions on this topic', 'Draft · not saved', 'Takes effect from the agent’s next request', 'Possible conflict', 'note writes not enabled'],
  's6.2': ['Saved · not yet used by this task', 'the running step began before the save'],
  's6.3': ['used at turn 35', 'Using your notation'],
  's6.4': ['Couldn’t save', 'draft is kept'],
  's7.1': ['no root research note', 'no second project list'],
  's7.2': ['No local file is known', 'Fetch (not available)'],
  's7.3': ['Where methods were looked for', 'not in the agent’s catalog', 'shadows the topic method'],
};

const report = { origin, steps: [], interactions: [], compact: [], contrast: {}, errors: [] };
const browser = await chromium.launch({ executablePath, headless: true,
  env: { ...process.env, ...(process.env.AITP_BROWSER_LIBS ? { LD_LIBRARY_PATH: [process.env.AITP_BROWSER_LIBS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : {}) } });
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };
const browserRequests = [];
const localOrigin = new URL(origin).origin;
const allowedRequest = (request) => request.method() === 'GET' && new URL(request.url()).origin === localOrigin;
try {
  await mkdir(shotDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  context.on('request', (request) => browserRequests.push({ method: request.method(), url: request.url(), allowed: allowedRequest(request) }));
  await context.route('**/*', (route) => allowedRequest(route.request()) ? route.continue() : route.abort('blockedbyclient'));
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`console ${m.text()}`); });
  await page.goto(origin);
  const walks = await page.evaluate(() => window.AITP_PROTOTYPE.walkthroughs);

  const metrics = () => page.evaluate(() => {
    const main = document.querySelector('.main').getBoundingClientRect();
    const de = document.documentElement;
    const flow = document.querySelector('.flow');
    return { text: document.body.innerText, mainWidth: Math.round(main.width), overflowX: de.scrollWidth > de.clientWidth, flowH: flow ? Math.round(flow.getBoundingClientRect().height) : null,
      prov: ['you', 'agent', 'src', 'sum', 'gap'].map((k) => [k, [...document.querySelectorAll(`.prov.${k} .who`)].every((w) => w.textContent.trim().length > 3), document.querySelectorAll(`.prov.${k}`).length]) };
  });

  for (const w of walks) for (let i = 1; i <= w.steps; i++) {
    const key = `${w.id}.${i}`;
    await page.goto(`${origin}#${key}`); await page.waitForTimeout(60);
    const m = await metrics();
    const low = m.text.toLowerCase();
    const missing = (expect[key] ?? []).filter((t) => !low.includes(t.toLowerCase()));
    check(missing.length === 0, `${key} missing text: ${missing.join(' | ')}`);
    check(!m.overflowX, `${key} horizontal overflow at 1440`);
    check(m.mainWidth >= 400, `${key} main column ${m.mainWidth}px < 400px`);
    check(m.flowH === null || m.flowH >= 180, `${key} transcript region only ${m.flowH}px tall`);
    for (const [k, labelled, n] of m.prov) check(labelled, `${key} provenance ${k} item without a text label`);
    await page.screenshot({ path: join(shotDir, `${w.id}-${i}.png`) });
    report.steps.push({ key, mainWidth: m.mainWidth, missing, prov: Object.fromEntries(m.prov.map(([k, , n]) => [k, n])) });
  }
  check(report.steps.length === Object.keys(expect).length, `expected ${Object.keys(expect).length} steps, saw ${report.steps.length}`);

  // s1.3 must show all four provenance kinds at once.
  await page.goto(`${origin}#s1.3`); await page.waitForTimeout(60);
  const kinds = await page.evaluate(() => ['you', 'agent', 'src', 'sum'].map((k) => document.querySelectorAll(`.prov.${k}`).length));
  check(kinds.every((n) => n > 0), `s1.3 provenance kinds present: ${kinds.join(',')}`);

  // Free interactions: browsing creates no session; draft is local; rule save; relationship change.
  const step = async (label, fn) => { try { await fn(); report.interactions.push(`${label}: ok`); } catch (e) { failures.push(`${label}: ${e.message}`); } };
  await page.goto(origin); await page.waitForTimeout(60);
  await step('research home opens without a session', async () => {
    const t = (await page.innerText('.main')).toLowerCase(); if (!t.includes('current answer, as written')) throw new Error('topic home not shown');
    if (await page.$('.chead')) throw new Error('conversation rendered while browsing');
  });
  await step('note → work on passage opens session with note in dock', async () => {
    await page.click('[data-act="research-note"]'); await page.click('[data-act="work-on-passage"]');
    if (!(await page.$('.chead'))) throw new Error('no conversation'); if (!(await page.$('.dock'))) throw new Error('no dock');
    if (!(await page.innerText('.dock')).includes('Agreed stopping rule')) throw new Error('note not in dock');
  });
  await step('dock open collapses sidebar to rail', async () => { const w = await page.evaluate(() => document.querySelector('.side').getBoundingClientRect().width); if (w > 60) throw new Error(`sidebar ${w}px`); });
  await step('library draft is local and discardable', async () => {
    await page.click('[data-act="expand-side"]'); await page.click('[data-act="nav:materials"]'); await page.click('[data-act="lib-draft"]');
    if (!(await page.innerText('.main')).includes('attached, not sent')) throw new Error('draft missing');
    await page.click('[data-act="lib-draft-cancel"]'); if ((await page.innerText('.main')).includes('attached, not sent')) throw new Error('draft persisted');
    if (await page.$('.chead')) throw new Error('session created by draft');
  });
  await step('relationship change is reflected', async () => {
    await page.goto(`${origin}#s4.1`); await page.waitForTimeout(60); await page.click('[data-act="rel:use"]');
    if (!(await page.innerText('.dock')).includes('would change the solver you fixed')) throw new Error('no fixed-solver warning');
  });
  await step('rule save shows saved-not-used', async () => {
    await page.goto(origin); await page.click('[data-act="nav:rules"]'); await page.click('[data-act="rule-edit"]'); await page.click('[data-act="rule-save"]');
    if (!(await page.innerText('.main')).includes('Saved · not yet used by this task')) throw new Error('state missing');
  });
  await step('walkthrough keyboard navigation', async () => {
    await page.goto(`${origin}#s2.1`); await page.waitForTimeout(60); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60);
    if (!page.url().endsWith('#s2.2')) throw new Error(`url ${page.url()}`);
  });

  // Compact width: editor content must stay usable, not just free of overflow.
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const key of ['s1.1', 's1.3', 's2.2', 's3.2', 's4.1']) {
    await page.goto(`${origin}#${key}`); await page.waitForTimeout(60);
    const c = await page.evaluate(() => {
      const de = document.documentElement; const main = document.querySelector('.main').getBoundingClientRect();
      const readers = [...document.querySelectorAll('.reader, .dbody, .flow')].map((r) => Math.round(r.getBoundingClientRect().width)).filter((x) => x > 0);
      const flow = document.querySelector('.flow');
      return { overflowX: de.scrollWidth > de.clientWidth, main: Math.round(main.width), minReader: Math.min(...readers), flowH: flow ? Math.round(flow.getBoundingClientRect().height) : null };
    });
    check(!c.overflowX, `${key} overflow at 1024`); check(c.flowH === null || c.flowH >= 160, `${key} transcript only ${c.flowH}px tall at 1024`); check(c.minReader >= 280, `${key} narrowest reading region ${c.minReader}px at 1024`);
    report.compact.push({ key, ...c });
    await page.screenshot({ path: join(shotDir, `compact-${key.replace('.', '-')}.png`) });
  }

  // Dark theme screenshots and contrast for representative text.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark']) {
    await page.goto(`${origin}?theme=${theme}#s1.3`); await page.waitForTimeout(60);
    if (theme === 'dark') { await page.screenshot({ path: join(shotDir, 'dark-s1-3.png') }); }
    report.contrast[theme] = await page.evaluate(() => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bg = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !c.endsWith(', 0)') && c !== 'transparent') return c; el = el.parentElement; } return 'rgb(255,255,255)'; };
      const out = {};
      for (const sel of ['.passage', '.meta', '.pill.ok', '.pill.warn', '.pill.miss', '.pill.agent', '.pill.sum', '.prov.you .who', '.prov.agent .who', '.prov.sum .who', '.prov.src .who', '.chip', '.taskcard .lbl']) {
        const el = document.querySelector(sel); if (!el) continue;
        const a = lum(rgb(getComputedStyle(el).color)); const b = lum(rgb(bg(el)));
        out[sel] = Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
      }
      return out;
    });
    for (const [sel, r] of Object.entries(report.contrast[theme])) check(r >= 4.5, `${theme} contrast ${sel} ${r}`);
  }
  await page.goto(`${origin}?theme=dark#s4.1`); await page.waitForTimeout(60); await page.screenshot({ path: join(shotDir, 'dark-s4-1.png') });
  await page.goto(`${origin}?annotate=1#s1.3`); await page.waitForTimeout(60); await page.screenshot({ path: join(shotDir, 'annotated-s1-3.png') });
  await page.goto(`${origin}?annotate=1#s1.1`); await page.waitForTimeout(60); await page.screenshot({ path: join(shotDir, 'annotated-s1-1.png') });
} finally {
  await browser.close();
  server.close();
}
const disallowed = browserRequests.filter((request) => !request.allowed);
check(disallowed.length === 0, `blocked non-GET or external requests: ${disallowed.map((request) => `${request.method} ${request.url}`).join(', ')}`);
check(report.errors.length === 0, `page errors: ${report.errors.join(' | ')}`);
report.requests = requests.length; report.browserRequests = browserRequests; report.failures = failures;
await writeFile(join(shotDir, 'check-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.steps.length} walkthrough steps, ${report.interactions.length} interactions, ${report.compact.length} compact views, ${requests.length} local GET requests`);
if (failures.length) { console.error(`FAILED (${failures.length}):\n- ${failures.join('\n- ')}`); process.exitCode = 1; } else console.log('All checks passed.');
