// Exercise the synthetic research loop; no real notes, providers or model calls.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  page.setDefaultTimeout(6000);
  const errors = []; const passed = [];
  const check = passed.push.bind(passed); passed.push = message => { console.log('PASS', message); return check(message); };
  page.on('pageerror', e => errors.push(e.message));
  // Core interactions must work without hosted fonts or a math-rendering CDN.
  await page.route(/^https?:/, route => route.abort());
  const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
  let serial = 0;
  const reset = async () => { await page.goto(url + '?case=' + (++serial) + '#topic'); };
  const click = async action => page.locator(`[data-action="${action}"]`).first().click();
  const text = async () => page.locator('body').innerText();
  const tab = async name => page.locator(`.page-tabs [data-action="topic-tab"][data-tab="${name}"]`).click();
  const menu = async (kind, id, item) => {
    if (await page.locator('.page-tabs').count()) await tab(kind === 'stmt' ? 'claims' : 'work');
    else if (kind === 'stmt') {
      const routes = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Routes and statements' }) });
      if (!await routes.evaluate(el => el.open)) await routes.locator('summary').click();
    }
    await page.locator(`[data-action="card-menu"][data-kind="${kind}"][data-id="${id}"]`).click();
    await page.locator(`[data-mi="${item}"]`).click();
  };
  const openZeroSession = async () => {
    await tab('activity');
    await page.locator('[aria-label="Sessions on this topic"] [data-action="open-session"][data-id="zero"]').click();
  };
  const preview = async (scope) => { await click('edit-objective'); await page.locator('#f-scope').fill(scope); await page.locator('[data-form="objective"] button[type="submit"]').click(); };
  const sim = async kind => { await click('sim-menu'); await page.locator(`[data-mi="sim:${kind}"]`).click(); };
  try {
    await reset(); await preview('Human correction: analytical scope only.'); await click('apply');
    await click('open-source'); assert.match(await text(), /Human correction: analytical scope only/);
    await page.locator('.note [data-action="open-topic"]').click(); await click('new-topic-session');
    await page.locator('.context-read summary').click(); assert.match(await page.locator('.context-read').innerText(), /Human correction/);
    passed.push('objective edit, live note projection and fresh-session recovery');

    await reset(); await preview('Pending human objective'); await sim('external'); await click('apply');
    assert.equal(await page.locator('.conflict').count(), 1); await click('conflict-keep');
    assert.match(await text(), /External edit: analytic scope only/); passed.push('overlapping edit keeps the actual external version');

    await reset(); await preview('Pending objective'); await sim('external'); await click('apply'); await click('conflict-mine');
    assert.equal(await page.locator('[aria-label="Change preview"]').count(), 1); await click('apply');
    assert.match(await text(), /Pending objective/); passed.push('conflict resolution prepares a fresh diff before replacement');

    await reset(); await preview('Earlier edit'); await click('apply'); await preview('Later edit'); await click('apply');
    await tab('activity'); await page.locator('[data-action="revert"]').nth(1).click(); assert.match(await text(), /Revert conflict/);
    assert.match(await text(), /Scope: Later edit/); passed.push('out-of-order revert preserves later work');
    await page.locator('[data-action="revert"]').first().click(); assert.match(await text(), /Scope: Earlier edit/); passed.push('latest revert restores the prior state');

    await reset(); await openZeroSession();
    await preview('Updated during a session'); await click('apply'); assert.equal(await page.locator('.stale').count(), 1);
    await page.locator('#composer').fill('Read the current state'); await page.getByRole('button', { name: 'Send', exact: true }).click();
    assert.equal(await page.locator('.stale').count(), 0); assert.match(await page.locator('.context-read').textContent(), /Updated during a session/);
    passed.push('active-session stale notice and refreshed request context');

    await reset(); await menu('stmt', 'imported-th', 'correct:imported-th');
    await page.locator('#f-correct').fill('Corrected interpretation: retain the source conditions and the unresolved response question.');
    await page.locator('[data-form="correct"] button[type="submit"]').click(); await click('apply');
    assert.match(await page.locator('#stmt-imported-th').innerText(), /Corrected interpretation/);
    await click('open-source'); assert.match(await page.locator('.synthetic-note').innerText(), /Corrected interpretation/);
    passed.push('human correction updates the owning passage and shared note');

    await reset(); await menu('stmt', 'zero-crossing', 'unsupported:zero-crossing');
    await page.locator('#f-reason').fill('No discriminating evidence'); await page.locator('[data-form="decline"] button[type="submit"]').click(); await click('apply');
    assert.match(await page.locator('#stmt-zero-crossing').innerText(), /unsupported/);
    assert.doesNotMatch(await page.locator('#stmt-zero-crossing').innerText(), /refuted/); passed.push('unsupported hypothesis is not labelled refuted');

    await reset(); await menu('stmt', 'static-reference', 'invalidate:static-reference');
    await page.locator('#f-why').fill('Applicability condition failed in this synthetic example'); await page.locator('[data-form="invalidate"] button[type="submit"]').click(); await click('apply');
    assert.match(await page.locator('#stmt-static-reference').innerText(), /flagged invalid/); assert.ok(await page.locator('.qual').count());
    const priorInvalidation = await page.locator('#stmt-th-equals .qual').innerText();
    await menu('stmt', 'bare-vertex', 'invalidate:bare-vertex'); await page.locator('#f-why').fill('Second synthetic qualification');
    await page.locator('[data-form="invalidate"] button[type="submit"]').click(); await click('apply'); await tab('activity'); await page.locator('[data-action="revert"]').first().click(); await tab('claims');
    assert.equal(await page.locator('#stmt-th-equals .qual').innerText(), priorInvalidation); assert.ok(await page.locator('.qual').count());
    passed.push('invalid assumption retains qualifications on selected recorded dependents');

    await reset(); await menu('thread', 'freq', 'supersede:freq'); await page.locator('#f-route').fill('Check response applicability');
    await page.locator('[data-form="supersede"] button[type="submit"]').click(); await click('apply');
    assert.match(await text(), /Check response applicability/); await tab('claims'); assert.match(await text(), /superseded/); passed.push('route change retains the old route');

    await reset(); await menu('pointer', 'p-three', 'record:p-three'); await page.locator('#f-value').fill('Synthetic finite-size result; extrapolation unresolved.');
    await page.locator('[data-form="record"] button[type="submit"]').click(); await click('apply');
    await tab('overview');
    const childCard = page.locator('[data-topic-card="three-band"]');
    assert.match(await childCard.innerText(), /Synthetic finite-size result; extrapolation unresolved/);
    await childCard.locator('[data-action="open-topic"]').first().click();
    assert.match(await page.locator('.topic-hero').innerText(), /Synthetic finite-size result; extrapolation unresolved/);
    await click('open-source'); assert.match(await page.locator('.synthetic-note').innerText(), /Synthetic finite-size result; extrapolation unresolved/);
    passed.push('child evidence update is shared by parent card, child overview and Markdown preview');

    await reset(); await menu('stmt', 'static-reference', 'ask:challenge:stmt:static-reference');
    assert.match(await page.locator('#composer').inputValue(), /Challenge the assumptions/); await page.getByRole('button', { name: 'Send', exact: true }).click();
    assert.ok(await page.locator('[data-action="prop-review"]').count()); await click('prop-review'); await click('apply');
    assert.match(await page.locator('#stmt-static-reference').textContent(), /applicability and response remain unchecked/); passed.push('contextual action, scripted proposal and accepted qualification');

    await reset(); await page.keyboard.press('Control+k'); await page.locator('#pal-input').fill('Three-band'); await page.keyboard.press('Enter');
    assert.match(await page.locator('.ts-title').first().textContent(), /Three-band/i); passed.push('keyboard palette reaches a branch');
    await click('go-home'); await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Exploratory ideas' }) }).locator('summary').click(); await page.locator('[data-action="seed-session"]').first().click(); assert.match(await text(), /no topic created/i);
    passed.push('seed exploration stays a seed');

    await reset(); await click('go-home');
    await page.locator('[data-topic-card="topo-ham"] [data-action="open-topic"][data-id="topo-ham"]').first().click();
    assert.match(await page.locator('.topic-hero').innerText(), /Topological Hamiltonian/);
    assert.equal(await page.locator('[aria-label="Subtopics"] [data-topic-card]').count(), 3);
    await page.locator('[data-topic-card="zeros"] [data-action="open-topic"]').first().click();
    assert.match(await page.locator('.topic-hero').innerText(), /SUBTOPIC/);
    await tab('materials'); await page.locator('[data-action="open-resource"][data-id="zeros:0"]').click();
    assert.match(await page.locator('.note').innerText(), /Tracking the zero line/);
    assert.match(await page.locator('.note .path').innerText(), /zeros\/reports\/zeros.md/);
    await click('back-materials');
    assert.equal(await page.locator('#tab-materials').getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('.resource-row').innerText(), /Zero-line report/);
    await page.locator('.topic-hero [data-action="open-topic"][data-id="topo-ham"]').click();
    assert.equal(await page.locator('[aria-label="Subtopics"] [data-topic-card]').count(), 3);
    passed.push('project to topic to subtopic to material and back keeps the owning topic');

    await reset(); await page.locator('#tab-overview').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-work').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#tab-work').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#topic-panel').getAttribute('aria-labelledby'), 'tab-work');
    await page.keyboard.press('End'); assert.equal(await page.locator('#tab-activity').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home'); assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#tab-activity').getAttribute('aria-selected'), 'true');
    passed.push('topic tabs support arrow keys, Home, End and matching panel labels');

    await reset(); assert.equal(await page.locator('aside.host').count(), 1);
    assert.equal(await page.locator('.host-tree').count(), 1); assert.equal(await page.locator('.wslist').count(), 0);
    await page.locator('[data-action="nav-mode"][data-mode="sessions"]').click();
    assert.equal(await page.locator('.host-tree').count(), 0); assert.equal(await page.locator('.wslist').count(), 1);
    assert.equal(await page.locator('[data-mode="sessions"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-action="nav-mode"][data-mode="research"]').click();
    assert.equal(await page.locator('.host-tree').count(), 1); assert.equal(await page.locator('.wslist').count(), 0);
    await page.locator('.host-tree [data-action="open-topic"][data-id="zeros"]').click();
    assert.match(await page.locator('.topic-hero').innerText(), /SUBTOPIC/);
    passed.push('one sidebar switches between topic hierarchy and conversations with direct child navigation');

    for (const scheme of ['light', 'dark']) for (const width of [1920, 1440, 1024, 720, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: scheme }); await reset();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${scheme} ${width}: page overflow`);
      await openZeroSession();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${scheme} ${width}: session overflow`);
      if (process.env.SCREENSHOT_DIR && [1440, 1024, 390].includes(width)) { fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `session-${scheme}-${width}.png`), fullPage: true }); }
    }
    passed.push('topic and session layouts: 1920, 1440, 1024, 720 and 390 CSS px in both themes');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed, pageErrors: errors, limits: ['synthetic in-memory state only', 'no filesystem, model or cross-process recovery test', '720px is a reflow check, not native browser zoom certification'] }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
