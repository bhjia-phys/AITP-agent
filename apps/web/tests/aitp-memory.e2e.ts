/** Built Research UI over the production Markdown backend and an owned scratch root. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator } from 'playwright'
import { describe, expect, it, onTestFailed, onTestFinished } from 'vitest'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold } from './scaffold.ts'
import { newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'

const ROOT_ACCOUNT = '# Scratch research project\n\nCan the finite control support a broader claim?\n\n## Topics\n\n[Conditional finite bound](child/research.md) supplies a finite control only; the parent question remains open.\n\n[Independent sibling](sibling/research.md) concerns another question.\n'
const CHILD_ACCOUNT = '# Conditional finite bound\n\nDoes the bound hold on the selected finite system?\n\n## Scope\n\nFinite N only.\n\n## Current answer\n\nAt N=6, B holds only under A.\n\n## Limitations\n\nNo thermodynamic claim.\n\n## Current work\n\nThe failed open-boundary route can reopen only after its boundary condition changes.\n\n## Materials\n\n[Finite control report](../report.md) records the assumption and the finite-size check.\n'
const SIBLING_ACCOUNT = '# Independent sibling\n\nUnrelated sibling-specific condition: C requires an independent control.\n'
const REPORT_PROSE = 'The **finite bound** uses [the matched control](https://example.test/control) at `N=6` only under **A**.'
const REPORT_QUOTE = 'The finite bound uses the matched control at N=6 only under A.'
const REPORT_CONDITION = 'This finite-size check does not establish a thermodynamic bound.'
const REPORT = `# Finite control report\n\n${REPORT_PROSE}\n\n${REPORT_CONDITION}\n`
const LATER_OBSERVATION = 'Current disk observation: the independent boundary check is still missing.'
const UPDATED_SCOPE = 'Only the matched N=6 control under assumption A.'
const QUESTION = 'Why does this report still require A after the scope edit? Preserve its finite-size limitation.'
const REPLY = 'The captured material question remains scoped to the matched N=6 control.'
const ENVIRONMENT = ['AITP_RESEARCH_ROOT', 'AITP_RESEARCH_STATE', 'AITP_RESEARCH_WRITE'] as const

/** Only the external model transport is substituted; the request is the real AgentLoop input. */
class ResearchCapture extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  override async listModels(provider: string) {
    return [{ provider, id: 'capture', name: 'Research browser capture' }]
  }

  override async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: REPLY }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: REPLY } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function heading(panel: Locator, title: string): Promise<void> {
  await panel.getByRole('heading', { name: title, exact: true, level: 2 }).waitFor()
}

async function selectRenderedPassage(passage: Locator): Promise<string> {
  return passage.evaluate((element) => {
    const selection = element.ownerDocument.getSelection()
    if (selection === null) throw new Error('The browser has no document selection.')
    const range = element.ownerDocument.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)
    return selection.toString()
  })
}

describe.skipIf(webSnapshotMode() === 'record')('web e2e: production AITP research memory', () => {
  it('keeps rendered selections, actual request memory and current source reads distinct through the real browser', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'aitp-memory-browser-'))
    const root = join(temporary, 'notes')
    const state = join(temporary, 'operations')
    const evidence = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))
    await mkdir(evidence, { recursive: true })
    const originalEnvironment = new Map(ENVIRONMENT.map(name => [name, process.env[name]]))
    const owned: { browser?: Browser; scaffold?: WebScaffold } = {}
    onTestFinished(async () => {
      try {
        try { await owned.browser?.close() } finally { await owned.scaffold?.close() }
      } finally {
        for (const name of ENVIRONMENT) {
          const original = originalEnvironment.get(name)
          if (original === undefined) Reflect.deleteProperty(process.env, name)
          else process.env[name] = original
        }
        await rm(temporary, { recursive: true, force: true })
      }
    })
    await mkdir(join(root, 'child'), { recursive: true })
    await mkdir(join(root, 'sibling'), { recursive: true })
    await Promise.all([
      writeFile(join(root, 'research.md'), ROOT_ACCOUNT),
      writeFile(join(root, 'child/research.md'), CHILD_ACCOUNT),
      writeFile(join(root, 'report.md'), REPORT),
      writeFile(join(root, 'sibling/research.md'), SIBLING_ACCOUNT),
    ])
    process.env.AITP_RESEARCH_ROOT = root
    process.env.AITP_RESEARCH_STATE = state
    process.env.AITP_RESEARCH_WRITE = '1'
    // These are the shipped overlays. Supplying Remote schemas or a fixture adapter here
    // would conceal a missing production client registration such as remote.researchMemory.
    const scaffold = await launchWebScaffold({
      extraOverlayPath: ['aitp-agent', 'aitp-web', 'aitp-memory'].map(name =>
        fileURLToPath(new URL(`../../cli/config/${name}.cordis.patch.yml`, import.meta.url))),
    })
    owned.scaffold = scaffold
    const capture = new ResearchCapture()
    scaffold.ctx.effect(() => scaffold.ctx.llm.registerAdapter(['aitp-browser-capture'], capture), 'research browser request capture')
    await scaffold.ctx.agentDefaultModel.saveSelection({ provider: 'aitp-browser-capture', model: 'capture' })
    const registered = await scaffold.hostFetch('/api/workspace/create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'research-memory-browser-workspace',
        method: 'workspace/create', payload: { args: { request: { path: root } } } }),
    })
    expect(registered.status).toBe(200)
    expect(await registered.json()).toMatchObject({ result: { ok: true, value: { workspace: { path: root } } } })
    const workspace = scaffold.ctx.workspaceRegistry.list().find(item => item.path === root)
    if (workspace === undefined) throw new Error('The HTTP-created scratch Workspace was not registered.')

    const browser = await chromium.launch()
    owned.browser = browser
    const page = await newEnglishPage(browser)
    const console = watchConsole(page)
    const activationErrors: string[] = []
    const memoryReads: unknown[] = []
    page.on('response', (response) => {
      if (!new URL(response.url()).pathname.endsWith('/researchMemory/getSessionMemory')) return
      void response.json().then((value: unknown) => { memoryReads.push(value) }, (error: unknown) => { memoryReads.push(String(error)) })
    })
    page.on('console', (message) => {
      if (message.type() === 'error' && /activation|remote\.researchMemory|research-memory|ui-aitp-backend/i.test(message.text())) {
        activationErrors.push(message.text())
      }
    })
    onTestFailed(async () => {
      await saveFailureShot(page, 'web-e2e-aitp-memory')
      await writeFile(join(evidence, 'web-e2e-aitp-memory-failure.json'), JSON.stringify({
        activationErrors, pageErrors: console.pageErrors, body: await page.locator('body').ariaSnapshot(),
      }, null, 2))
    })
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.getByRole('navigation', { name: 'Global panels' })
      .getByRole('button', { name: 'Research', exact: true }).click()
    const panel = page.locator('section[aria-label="Research"]')
    await heading(panel, 'Scratch research project')
    expect(await panel.getByText('Demo workspace', { exact: true }).count()).toBe(0)
    expect(await panel.getByText('Research workspace is not connected', { exact: true }).count()).toBe(0)

    await panel.locator('[data-map-node]').filter({ hasText: 'Conditional finite bound' }).click()
    await heading(panel, 'Conditional finite bound')
    const summary = panel.getByRole('complementary', { name: 'Current understanding', exact: true })
    await summary.getByText('At N=6, B holds only under A.', { exact: true }).waitFor()
    await summary.getByText('No thermodynamic claim.', { exact: true }).waitFor()
    await panel.getByRole('button', { name: 'Open topic', exact: true }).click()
    await heading(panel, 'Conditional finite bound')
    await panel.getByText('At N=6, B holds only under A.', { exact: true }).waitFor()
    await panel.getByText('No thermodynamic claim.', { exact: true }).waitFor()
    expect(await panel.getByRole('button', { name: /^Materials/ }).getAttribute('aria-expanded')).toBe('true')
    await panel.getByRole('button', { name: /report\.md/ }).click()
    await heading(panel, 'report.md')
    await panel.getByRole('heading', { name: 'Finite control report', exact: true }).waitFor()
    await panel.getByText(REPORT_QUOTE, { exact: true }).waitFor()
    await panel.getByText(REPORT_CONDITION, { exact: true }).waitFor()
    await panel.getByRole('navigation', { name: 'Research location' })
      .getByRole('button', { name: 'Back', exact: true }).click()
    await heading(panel, 'Conditional finite bound')
    expect(await panel.getByRole('button', { name: /^Materials/ }).getAttribute('aria-expanded')).toBe('true')
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? '')).toContain('report.md')

    await panel.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit scope', exact: true }).click()
    const editor = panel.getByRole('region', { name: 'Edit scope', exact: true })
    await editor.getByRole('textbox', { name: 'Scope', exact: true }).fill(UPDATED_SCOPE)
    await editor.getByRole('button', { name: 'Preview change', exact: true }).click()
    await editor.getByText('Proposed version', { exact: true }).waitFor()
    // Preview must remain reviewable without publishing any scientific source change.
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(CHILD_ACCOUNT)
    await editor.getByRole('button', { name: 'Apply change', exact: true }).click()
    await editor.getByRole('status').filter({ hasText: 'Change acknowledged. Updated content is being read.' }).waitFor()
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    await panel.getByText(UPDATED_SCOPE, { exact: true }).waitFor()
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(CHILD_ACCOUNT.replace('Finite N only.', UPDATED_SCOPE))
    expect(await readFile(join(root, 'research.md'), 'utf8')).toBe(ROOT_ACCOUNT)
    expect(await readFile(join(root, 'report.md'), 'utf8')).toBe(REPORT)
    expect(await readFile(join(root, 'sibling/research.md'), 'utf8')).toBe(SIBLING_ACCOUNT)

    await panel.getByRole('button', { name: 'Read full account', exact: true }).click()
    await heading(panel, 'Conditional finite bound')
    await panel.getByText(UPDATED_SCOPE, { exact: true }).waitFor()
    await panel.getByText('No thermodynamic claim.', { exact: true }).waitFor()
    await panel.getByRole('navigation', { name: 'Research location' })
      .getByRole('button', { name: 'Back', exact: true }).click()
    await heading(panel, 'Conditional finite bound')
    await panel.getByRole('button', { name: /report\.md/ }).click()
    await heading(panel, 'report.md')
    const passage = panel.getByText(REPORT_QUOTE, { exact: true })
    await passage.waitFor()
    expect(await passage.locator('strong').count()).toBe(2)
    expect(await passage.getByRole('link', { name: 'the matched control', exact: true }).count()).toBe(1)
    expect(await passage.locator('code').textContent()).toBe('N=6')
    // A real rendered DOM range crosses strong, link and code elements; source Markdown is not submitted as the human quote.
    const selectedText = await selectRenderedPassage(passage)
    expect(selectedText).toBe(REPORT_QUOTE)
    const discuss = panel.getByRole('button', { name: 'Discuss this research', exact: true })
    await discuss.click()
    const discussion = panel.locator('[data-research-discussion]')
    const composer = discussion.locator('[data-composer-input]')
    await composer.waitFor()
    const sources = discussion.locator('details').filter({ hasText: 'Sources for the next question' })
    await sources.locator('summary').click()
    expect(await sources.locator('blockquote').textContent()).toBe(REPORT_QUOTE)
    await sources.getByRole('button', { name: 'Use direction only', exact: true }).click()
    await composer.focus()
    expect(await sources.locator('blockquote').count()).toBe(0)
    await discussion.getByRole('button', { name: 'Back to reading', exact: true }).click()
    // Keyboard entry has no pointerdown: a rendered selection must survive native Tab focus into the discussion action.
    await passage.getByRole('link', { name: 'the matched control', exact: true }).focus()
    expect(await selectRenderedPassage(passage)).toBe(REPORT_QUOTE)
    await page.keyboard.press('Shift+Tab')
    await expect.poll(() => discuss.evaluate(element => element.ownerDocument.activeElement === element)).toBe(true)
    await page.keyboard.press('Enter')
    await composer.waitFor()
    if (await sources.getAttribute('open') === null) await sources.locator('summary').click()
    expect(await sources.locator('blockquote').textContent()).toBe(REPORT_QUOTE)
    await writeComposerDraft(page, composer, QUESTION)
    expect(capture.requests).toHaveLength(0)
    const settled = scaffold.whenTurnSettled()
    await composer.press('Enter')
    const sessionId = await settled
    await discussion.locator('[data-slot="conversation.chat.flow"]').getByText(REPLY, { exact: true }).waitFor()
    await heading(panel, 'report.md')
    expect(capture.requests).toHaveLength(1)
    const request = capture.requests[0]
    if (request === undefined) throw new Error('The material question never reached the model transport.')
    const submitted = request.messages.find(message => message.role === 'user'
      && message.content.some(block => block.type === 'text' && block.text === QUESTION))
    const expectedOrigin = {
      workspaceId: workspace.id, topicId: 'topic:child%2Fresearch.md', resourceId: 'resource:report.md',
      selectedText: REPORT_QUOTE, selectedTextFormat: 'rendered',
      selectedRange: { start: REPORT.indexOf(REPORT_PROSE), end: REPORT.indexOf(REPORT_PROSE) + REPORT_PROSE.length, text: REPORT_PROSE },
    }
    expect(submitted).toMatchObject({ source: { kind: 'aitp-research', actor: 'human', origin: expectedOrigin } })
    const context = request.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context').at(-1)
    if (context === undefined) throw new Error('The actual model request omitted research runtime context.')
    const delivered = JSON.stringify(context)
    for (const included of [QUESTION, workspace.id, 'topic:child%2Fresearch.md', 'resource:report.md',
      UPDATED_SCOPE, REPORT_PROSE, REPORT_QUOTE, REPORT_CONDITION, 'No thermodynamic claim.', 'only after its boundary condition changes']) {
      expect(delivered).toContain(included)
    }
    expect(delivered).not.toContain('Unrelated sibling-specific condition')
    if (context.role !== 'user' || context.source?.kind !== 'runtime-context' || context.source.form !== 'snapshot') {
      throw new Error('Research context was not retained as an attributable runtime snapshot.')
    }
    const recordedContext = context.source.sections.find(section => section.name === 'aitp-research-memory')?.text
    if (recordedContext === undefined) throw new Error('The runtime snapshot has no attributed research-memory section.')
    expect(recordedContext).toContain(REPORT)
    const session = scaffold.ctx.agents.get(sessionId)?.session
    if (session === undefined) throw new Error('The opened conversation has no retained Session.')
    const original = session.snapshotEvents().find(event => event.type === 'user/message'
      && event.data.content.some(block => block.type === 'text' && block.text === QUESTION))
    expect(original).toMatchObject({ type: 'user/message', data: {
      source: { kind: 'aitp-research', actor: 'human', origin: expectedOrigin },
    } })

    const task = page.getByRole('region', { name: 'Task', exact: true })
    const memoryResponse = await scaffold.hostFetch('/api/researchMemory/getSessionMemory', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'research-memory-browser-inspect',
        method: 'researchMemory/getSessionMemory', payload: { args: { request: { sessionId } } } }),
    })
    expect(memoryResponse.status).toBe(200)
    const actualMemory: unknown = await memoryResponse.json()
    try {
      expect(actualMemory).toMatchObject({ result: { ok: true, value: { ok: true, value: {
        origin: 'runtime', researcher: [{ text: QUESTION }], contextSnapshots: [{ text: recordedContext }],
      } } } })
      await task.getByText(QUESTION, { exact: true }).waitFor()
    } catch (error) {
      await saveFailureShot(page, 'web-e2e-aitp-memory')
      await writeFile(new URL('../../../.artifacts/web-e2e-aitp-memory-diagnostic.json', import.meta.url), JSON.stringify({
        memoryReads, actualMemory, activationErrors, pageErrors: console.pageErrors, body: await page.locator('body').ariaSnapshot(),
      }, null, 2))
      throw error
    }
    expect(await task.getByText('Fixture data, not this Session’s record', { exact: true }).count()).toBe(0)
    await page.screenshot({ path: join(evidence, 'web-e2e-aitp-memory-taskcard.png'), fullPage: true })
    await task.getByRole('button', { name: 'Details', exact: true }).click()
    await task.getByRole('button', { name: 'Open sources and memory', exact: true }).click()
    const memory = page.getByRole('heading', { name: 'Sources & memory', exact: true, level: 2 }).locator('..')
    await memory.getByRole('heading', { name: /Original human inputs/ }).waitFor()
    expect(await memory.getByText(QUESTION, { exact: true }).textContent()).toBe(QUESTION)
    await memory.getByRole('heading', { name: 'Recorded request context', exact: true }).waitFor()
    await memory.getByText(/In current request history/).waitFor()
    const snapshot = memory.locator('details').filter({ has: page.getByText('Inspect the exact recorded text', { exact: true }) })
    await snapshot.locator('summary').click()
    expect(await snapshot.locator('p').textContent()).toBe(recordedContext)
    const sourceRows = memory.locator('li').filter({ has: page.getByRole('button', { name: 'Open', exact: true }) })
    expect(await sourceRows.count()).toBe(2)
    expect(await sourceRows.getByText(/Per-source delivery is not recorded/).count()).toBe(2)
    expect(await memory.getByText(/in context now · .*condensed · .*missing/).count()).toBe(0)
    expect(await memory.getByText('Synthetic fixture data for interface development — not this Session’s record.', { exact: true }).count()).toBe(0)
    const selectedSource = sourceRows.filter({ has: page.getByText('report.md', { exact: true }) })
    expect(await selectedSource.getByText(/you selected it/).count()).toBe(1)
    await memory.getByRole('heading', { name: 'Recorded request context', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(evidence, 'web-e2e-aitp-memory-panel.png'), fullPage: true })

    // Opening a reference reads today's file; it must not substitute current bytes for the recorded request snapshot.
    await writeFile(join(root, 'report.md'), `${REPORT}\n## Later observation\n\n${LATER_OBSERVATION}\n`)
    await selectedSource.getByRole('button', { name: 'Open', exact: true }).click()
    const openedSource = page.getByRole('heading', { name: 'Finite control report', exact: true })
    await openedSource.waitFor()
    const reader = openedSource.locator('xpath=ancestor::article[1]')
    await reader.getByText(LATER_OBSERVATION, { exact: true }).waitFor()
    await reader.getByText(REPORT_CONDITION, { exact: true }).waitFor()
    expect(await reader.getByText('report.md', { exact: true }).count()).toBe(1)
    expect(await reader.getByText(REPORT_QUOTE, { exact: true }).textContent()).toBe(REPORT_QUOTE)
    await reader.getByText(LATER_OBSERVATION, { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(evidence, 'web-e2e-aitp-memory-current-source.png'), fullPage: true })
    expect(capture.requests).toHaveLength(1)
    await page.getByRole('button', { name: 'Sources & memory', exact: true }).click()
    await memory.getByRole('heading', { name: 'Recorded request context', exact: true }).waitFor()
    if (await snapshot.getAttribute('open') === null) await snapshot.locator('summary').click()
    expect(await snapshot.locator('p').textContent()).toBe(recordedContext)
    expect(await snapshot.locator('p').textContent()).not.toContain(LATER_OBSERVATION)
    expect(await sourceRows.getByText(/Per-source delivery is not recorded/).count()).toBe(2)
    expect(activationErrors).toEqual([])
    expect(console.pageErrors).toEqual([])
    expect(console.warnings).toEqual([])
  })
})
