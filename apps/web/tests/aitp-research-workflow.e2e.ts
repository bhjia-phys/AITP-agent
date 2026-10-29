/** Default Research is exercised through the shipped composer and native human question UI. */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect, it, onTestFinished, onTestFailed } from 'vitest'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SourceRootId } from '@deepseek-ai/dsh-research-resources/types'
import { LlmAdapter, ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold, watchConsole, captureStableAria, compareOrRefreshGolden, webSnapshotMode } from './scaffold.ts'
import { newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'

class WorkflowCapture extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  initialize = false
  understanding = false
  override async listModels(provider: string) { return [{ provider, id: 'capture', name: 'Workflow capture' }] }
  override async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    if (this.understanding) {
      this.understanding = false
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('understanding'),
        name: 'research_working_update', arguments: JSON.stringify({ operation: 'upsert', id: 'current-approach',
          kind: 'next-step', text: 'Check perturbative order with the retained finite-system assumptions.',
          condition: 'Finite example; no thermodynamic claim.', sourceIds: [] }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    if (this.initialize) {
      this.initialize = false
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('initialize-browser'), name: 'research_initialize_project',
        arguments: JSON.stringify({ title: 'Finite boundary control', question: 'What does the N=6 control establish?', scope: 'No thermodynamic conclusion.', language: 'en', libraries: [{ rootId: 'workflow-knowledge', domain: 'knowledge' }] }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'The finite control remains conditional.' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'The finite control remains conditional.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

it('defaults new native drafts to Research, confirms missing accounts and preserves ordinary off conversations', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'aitp-workflow-browser-'))
  const root = join(temp, 'new-research'); await mkdir(root)
  const collection = join(temp, 'shared-explanations'); await mkdir(collection)
  await writeFile(join(collection, 'index.md'), '# Shared explanations\n\nReading guidance, with no accepted scientific conclusion.\n\n[Collection guide](guide.md)\n')
  await writeFile(join(collection, 'guide.md'), `# Collection guide\n\nGLOBAL_READING_ASSUMPTION_A holds only for the finite control.\n\n[Shared explanations](<${collection.split(sep).map(encodeURIComponent).join('/')}>)\n`)
  await mkdir(join(collection, 'branch'))
  await writeFile(join(collection, 'branch/continuation.tex'),
    '\\section{Our notation}\nThe degenerate subspace condition applies only at first perturbative order.\n')
  const scaffold = await launchWebScaffold({ extraOverlayPath: ['aitp-agent', 'aitp-web'].map(name =>
    fileURLToPath(new URL(`../../cli/config/${name}.cordis.patch.yml`, import.meta.url))) })
  await scaffold.ctx.researchResources.registerRoot({ id: 'workflow-knowledge', path: collection, title: 'Shared explanations', domains: ['knowledge'] })
  const bodySearch = await scaffold.hostFetch('/api/researchResources/searchBodies', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'body-search', method: 'researchResources/searchBodies',
      payload: { args: { request: { query: 'degenerate subspace' } } } }),
  })
  expect(bodySearch.status).toBe(200)
  const bodyResult = await bodySearch.text()
  expect(bodyResult).toContain('continuation.tex')
  expect(bodyResult).toContain('only at first perturbative order')
  const browser = await chromium.launch()
  onTestFinished(async () => {
    try { await browser.close() }
    finally { try { await scaffold.close() } finally { await rm(temp, { recursive: true, force: true }) } }
  })
  const capture = new WorkflowCapture()
  scaffold.ctx.effect(() => scaffold.ctx.llm.registerAdapter(['workflow-capture'], capture), 'workflow: request capture')
  await scaffold.ctx.agentDefaultModel.saveSelection({ provider: 'workflow-capture', model: 'capture' })
  const registered = await scaffold.hostFetch('/api/workspace/create', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'workflow-workspace', method: 'workspace/create', payload: { args: { request: { path: root } } } }) })
  expect(registered.status).toBe(200)
  const workspace = scaffold.ctx.workspaceRegistry.list().find(item => item.path === root)
  if (workspace === undefined) throw new Error('The research Workspace was not registered.')
  const readLocation = async (sessionId: SessionId) => {
    const result = await scaffold.ctx.researchMemory.getSessionMemory({ sessionId }, new AbortController().signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value?.researchLocation
  }
  const page = await newEnglishPage(browser)
  const console = watchConsole(page)
  onTestFailed(() => saveFailureShot(page, 'web-e2e-aitp-workflow'))
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  const choice = page.getByRole('checkbox', { name: 'Research', exact: true })
  await choice.waitFor()
  expect(await choice.isChecked()).toBe(true)
  expect(await choice.count()).toBe(1)
  await compareOrRefreshGolden(fileURLToPath(new URL('./expected/aitp-research-workflow/options.expected.md', import.meta.url)),
    await captureStableAria(page, '[data-slot="conversation.input.dock"]', scaffold.workspaceCwd), webSnapshotMode())
  await choice.focus(); await choice.press('Space'); expect(await choice.isChecked()).toBe(false)
  await choice.press('Space'); expect(await choice.isChecked()).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 1440, height: 1000 })
  const input = page.locator('[data-composer-input][contenteditable="true"]').filter({ visible: true }).first()
  await input.waitFor()
  await writeComposerDraft(page, input, 'Help me formulate a finite boundary research question.')
  const settled = scaffold.whenTurnSettled()
  await input.press('Enter'); const researchSessionId = await settled
  expect(await readdir(root)).toEqual([])
  expect(JSON.stringify(capture.requests[0])).toContain('Research workflow is enabled')
  expect(JSON.stringify(capture.requests[0])).toContain('Direct folder entries')
  expect(capture.requests[0]?.tools?.some(tool => tool.name === 'research_initialize_project')).toBe(true)
  capture.initialize = true
  await writeComposerDraft(page, input, 'Create the account with the finite N=6 scope we discussed.')
  const nextSettled = scaffold.whenTurnSettled()
  await input.press('Enter')
  const confirmation = page.locator('[data-question-key]').filter({ visible: true })
  await confirmation.getByText('Confirm and create project', { exact: true }).waitFor()
  const confirmationEvidence = fileURLToPath(new URL('../../../.artifacts/', import.meta.url)); await mkdir(confirmationEvidence, { recursive: true })
  await page.screenshot({ path: join(confirmationEvidence, 'aitp-research-workflow-confirmation.png'), fullPage: true, animations: 'disabled' })
  await confirmation.getByText('Confirm and create project', { exact: true }).click()
  await confirmation.getByRole('button', { name: /submit|send|confirm/i }).click()
  expect(await nextSettled).toBe(researchSessionId)
  expect(await readdir(root)).toEqual(['research.md'])
  const account = await readFile(join(root, 'research.md'), 'utf8')
  expect(account).toContain('What does the N=6 control establish?')
  expect(account).toContain('No thermodynamic conclusion.')
  expect(JSON.stringify(capture.requests.at(-1))).toContain('What does the N=6 control establish?')
  await page.getByText('Research · Finite boundary control', { exact: true }).waitFor()
  const evidence = fileURLToPath(new URL('../../../.artifacts/', import.meta.url)); await mkdir(evidence, { recursive: true })
  await page.screenshot({ path: join(evidence, 'aitp-research-workflow-confirmed.png'), fullPage: true, animations: 'disabled' })
  const session = scaffold.ctx.agents.get(researchSessionId)?.session
  if (session === undefined) throw new Error('The research conversation has no retained Session.')
  const initialOrigin = scaffold.ctx.sessionProjections.stateOf(session, 'researchWorking')?.origin
  const beforeModeEvents = session.snapshotEvents()
  const beforeModeRequests = capture.requests.length
  await choice.click()
  await expect.poll(() => readLocation(researchSessionId)).toMatchObject({ workflow: false, automaticResearch: true })
  await expect.poll(() => choice.isChecked()).toBe(false)
  expect(capture.requests).toHaveLength(beforeModeRequests)
  expect(session.snapshotEvents().slice(0, beforeModeEvents.length)).toEqual(beforeModeEvents)
  expect(scaffold.ctx.sessionProjections.stateOf(session, 'researchWorking')?.origin).toEqual({ ...initialOrigin, workflow: 'ordinary' })
  await page.getByText('Research · off · Finite boundary control', { exact: true }).waitFor()
  const taskLabel = page.getByRole('region', { name: 'Task', exact: true }).getByText('Task', { exact: true })
  await expect.poll(async () => Math.abs((await choice.boundingBox())!.x - (await taskLabel.boundingBox())!.x)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: join(evidence, 'aitp-research-mode-off.png'), fullPage: true, animations: 'disabled' })
  await writeFile(join(root, 'research.md'), account + '\nNEW_ACCOUNT_AFTER_BROWSER_RESEARCH_OFF\n')
  await scaffold.ctx.researchMemory.refresh({ workspaceId: workspace.id }, new AbortController().signal)
  await writeComposerDraft(page, input, 'Continue this same conversation with Research switched off.')
  const offSettled = scaffold.whenTurnSettled(); await input.press('Enter'); expect(await offSettled).toBe(researchSessionId)
  expect(JSON.stringify(capture.requests.at(-1))).not.toContain('NEW_ACCOUNT_AFTER_BROWSER_RESEARCH_OFF')
  expect(JSON.stringify(capture.requests.at(-1))).toContain('What does the N=6 control establish?')
  const afterOffRequests = capture.requests.length
  await choice.click()
  await expect.poll(() => readLocation(researchSessionId)).toMatchObject({ workflow: true, automaticResearch: true })
  await expect.poll(() => choice.isChecked()).toBe(true)
  expect(capture.requests).toHaveLength(afterOffRequests)
  expect(scaffold.ctx.sessionProjections.stateOf(session, 'researchWorking')?.origin).toEqual(initialOrigin)
  await writeFile(join(root, 'research.md'), account + '\nNEW_ACCOUNT_AFTER_BROWSER_RESEARCH_ON\n')
  await scaffold.ctx.researchMemory.refresh({ workspaceId: workspace.id }, new AbortController().signal)
  await writeComposerDraft(page, input, 'Continue this same conversation with Research enabled again.')
  const onSettled = scaffold.whenTurnSettled(); await input.press('Enter'); expect(await onSettled).toBe(researchSessionId)
  expect(JSON.stringify(capture.requests.at(-1))).toContain('NEW_ACCOUNT_AFTER_BROWSER_RESEARCH_ON')
  await page.screenshot({ path: join(evidence, 'aitp-research-mode-on.png'), fullPage: true, animations: 'disabled' })
  await writeFile(join(root, 'research.md'), account)
  await scaffold.ctx.researchMemory.refresh({ workspaceId: workspace.id }, new AbortController().signal)
  await page.getByRole('button', { name: 'Knowledge library', exact: true }).click()
  const catalog = page.locator('section[aria-label="Knowledge library"]').first()
  await catalog.getByRole('textbox', { name: 'Search this library', exact: true }).fill('Collection guide')
  await catalog.getByRole('button', { name: 'Collection guide', exact: true }).first().click()
  const reading = page.locator('[data-material-ready]').filter({ visible: true })
  await reading.getByRole('button', { name: 'Shared explanations', exact: true }).click()
  await expect.poll(() => catalog.getByRole('combobox', { name: 'Source folders' }).inputValue()).toBe('workflow-knowledge')
  expect(await catalog.getByRole('textbox', { name: 'Search this library', exact: true }).inputValue()).toBe('')
  await catalog.getByRole('button', { name: 'Collection guide', exact: true }).first().waitFor()
  expect(await readFile(join(collection, 'index.md'), 'utf8')).toContain('no accepted scientific conclusion')
  await catalog.getByRole('button', { name: 'Collection guide', exact: true }).first().click()
  const sourceTab = page.locator('[data-material-source]').filter({ visible: true })
  await sourceTab.getByRole('button', { name: 'Discuss this source', exact: true }).click()
  const discussion = page.locator('[data-research-discussion]').filter({ visible: true })
  await discussion.getByText('Independent reading', { exact: true }).waitFor()
  const studyInput = discussion.locator('[data-composer-input][contenteditable="true"]')
  await writeComposerDraft(page, studyInput, 'Explain the finite scope of GLOBAL_READING_ASSUMPTION_A.')
  const studySettled = scaffold.whenTurnSettled(); await studyInput.press('Enter'); const studySessionId = await studySettled
  expect(JSON.stringify(capture.requests.at(-1))).toContain('GLOBAL_READING_ASSUMPTION_A holds only for the finite control.')
  expect(capture.requests.at(-1)?.tools?.some(tool => tool.name === 'research_search_sources')).toBe(true)
  expect(capture.requests.at(-1)?.tools?.some(tool => tool.name === 'research_read_local_source')).toBe(true)
  const studySession = scaffold.ctx.agents.get(studySessionId)?.session
  if (studySession === undefined) throw new Error('The reading conversation has no retained Session.')
  const studyOrigin = scaffold.ctx.sessionProjections.stateOf(studySession, 'researchWorking')?.origin
  expect(studyOrigin).toMatchObject({ scope: 'global', workflow: 'research', selections: [{ ref: { rootId: 'workflow-knowledge' } }] })
  const studyMode = discussion.getByRole('checkbox', { name: 'Research', exact: true })
  await studyMode.waitFor()
  expect(await studyMode.count()).toBe(1)
  const beforeStudyOff = capture.requests.length
  await studyMode.click()
  await expect.poll(() => readLocation(studySessionId)).toMatchObject({ global: true, workflow: false })
  await expect.poll(() => studyMode.isChecked()).toBe(false)
  expect(capture.requests).toHaveLength(beforeStudyOff)
  expect(scaffold.ctx.sessionProjections.stateOf(studySession, 'researchWorking')?.origin).toEqual({ ...studyOrigin, workflow: 'ordinary' })
  const sourceSummary = discussion.locator('summary').filter({ hasText: 'Sources for the next question' })
  await sourceSummary.click()
  await discussion.getByText('workflow-knowledge / guide.md', { exact: true }).waitFor()
  await discussion.getByRole('button', { name: 'Full conversation', exact: true }).click()
  await page.getByRole('button', { name: 'Back to reading', exact: true }).waitFor()
  const nativeSourceSummary = page.locator('summary').filter({ hasText: 'Sources for the next question' }).filter({ visible: true })
  if (await nativeSourceSummary.locator('..').getAttribute('open') === null) await nativeSourceSummary.click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await input.boundingBox())?.width ?? 0).toBeGreaterThan(280)
  expect(await choice.isChecked()).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: join(evidence, 'aitp-research-mode-global-off-narrow.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Back to reading', exact: true }).click()
  if (await sourceSummary.locator('..').getAttribute('open') !== null) await sourceSummary.click()
  const guide = await readFile(join(collection, 'guide.md'), 'utf8')
  await writeFile(join(collection, 'guide.md'), guide + '\nEXPLICIT_SOURCE_AFTER_BROWSER_RESEARCH_OFF\n')
  await scaffold.ctx.researchResources.refresh({ rootId: brandString<SourceRootId>('workflow-knowledge') }, new AbortController().signal)
  await writeComposerDraft(page, studyInput, 'Continue with this explicitly selected evidence while Research is off.')
  const studyOffSettled = scaffold.whenTurnSettled(); await studyInput.press('Enter'); expect(await studyOffSettled).toBe(studySessionId)
  expect(JSON.stringify(capture.requests.at(-1))).toContain('EXPLICIT_SOURCE_AFTER_BROWSER_RESEARCH_OFF')
  const beforeStudyOn = capture.requests.length
  await studyMode.click()
  await expect.poll(() => readLocation(studySessionId)).toMatchObject({ global: true, workflow: true })
  await expect.poll(() => studyMode.isChecked()).toBe(true)
  expect(capture.requests).toHaveLength(beforeStudyOn)
  expect(scaffold.ctx.sessionProjections.stateOf(studySession, 'researchWorking')?.origin).toEqual(studyOrigin)
  await writeComposerDraft(page, studyInput, 'Keep this unsent comparison while I inspect the source.')
  await discussion.getByRole('button', { name: 'Full conversation', exact: true }).click()
  await page.getByRole('button', { name: 'Back to reading', exact: true }).waitFor()
  expect(await input.innerText()).toContain('Keep this unsent comparison')
  await page.screenshot({ path: join(evidence, 'aitp-coordination-global-native.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await input.boundingBox())?.width ?? 0).toBeGreaterThan(280)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: join(evidence, 'aitp-coordination-global-narrow.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Back to reading', exact: true }).click()
  expect(await studyInput.innerText()).toContain('Keep this unsent comparison')
  await discussion.locator('summary').filter({ hasText: 'Sources for the next question' }).click()
  await discussion.getByRole('button', { name: 'Remove sources from next message', exact: true }).click()
  await writeComposerDraft(page, studyInput, 'Continue the same discussion without selecting another source.')
  const clearedSettled = scaffold.whenTurnSettled(); await studyInput.press('Enter'); await clearedSettled
  expect(JSON.stringify(capture.requests.at(-1))).toContain('Continue the same discussion without selecting another source.')
  capture.understanding = true
  await writeComposerDraft(page, studyInput, 'Retain the current goal: check perturbative order under our finite-system assumptions.')
  const understood = scaffold.whenTurnSettled(); await studyInput.press('Enter'); await understood
  const task = discussion.getByRole('region', { name: 'Task', exact: true })
  await task.getByText('Current approach · provisional', { exact: true }).waitFor()
  await task.getByText('Finite example; no thermodynamic claim.', { exact: true }).waitFor()
  await writeComposerDraft(page, studyInput, 'Preserve this existing draft.')
  const requestsBeforeCorrection = capture.requests.length
  await task.getByRole('button', { name: 'Clarify or correct', exact: true }).click()
  expect(await studyInput.innerText()).toBe('Preserve this existing draft.')
  await task.getByRole('status').filter({ hasText: 'Your existing draft was kept.' }).waitFor()
  await writeComposerDraft(page, studyInput, '')
  await task.getByRole('button', { name: 'Clarify or correct', exact: true }).click()
  expect(await task.getByRole('status').count()).toBe(0)
  expect(await studyInput.innerText()).toContain('Check perturbative order')
  expect(await studyInput.innerText()).toContain('Finite example; no thermodynamic claim.')
  expect(capture.requests).toHaveLength(requestsBeforeCorrection)
  await writeComposerDraft(page, studyInput, 'My correction: include the order-two normalization term; keep the finite-system scope.')
  const corrected = scaffold.whenTurnSettled(); await studyInput.press('Enter'); await corrected
  expect(JSON.stringify(capture.requests.at(-1))).toContain('include the order-two normalization term')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: join(evidence, 'aitp-coordination-global-dark.png'), fullPage: true, animations: 'disabled' })
  await page.emulateMedia({ colorScheme: 'light' })
  await scaffold.ctx.settings.mutate('locale', [{ op: 'set', path: ['preference'], value: 'zh' }])
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('zh-CN')
  const correctionButton = page.getByRole('button', { name: '补充或纠正', exact: true })
  await correctionButton.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => studyInput.innerText()).toContain('我的补充或修正是')
  expect(capture.requests).toHaveLength(requestsBeforeCorrection + 1)
  await page.getByRole('button', { name: '完整对话', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const chineseInput = page.locator('[data-composer-input]').filter({ visible: true })
  await expect.poll(() => chineseInput.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(280)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: join(evidence, 'aitp-coordination-chinese-narrow.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await scaffold.ctx.settings.mutate('locale', [{ op: 'set', path: ['preference'], value: 'en' }])
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en')
  await page.getByRole('button', { name: 'New session', exact: true }).last().click()
  await choice.waitFor(); await choice.uncheck()
  await writeComposerDraft(page, input, 'An ordinary conversation, without a research scope.')
  const ordinarySettled = scaffold.whenTurnSettled(); await input.press('Enter'); await ordinarySettled
  expect(JSON.stringify(capture.requests.at(-1))).not.toContain('Research workflow is enabled')
  expect(await readFile(join(root, 'research.md'), 'utf8')).toBe(account)
  expect(console.pageErrors).toEqual([])
}, 120_000)
