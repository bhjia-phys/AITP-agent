/** First-use Research onboarding through the shipped client and actual source files. */
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator } from 'playwright'
import { describe, expect, it, onTestFailed, onTestFinished } from 'vitest'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type { CreateTopicReceipt, Result } from '@deepseek-ai/dsh-research-memory/types'
import { launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold } from './scaffold.ts'
import { newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'

const TITLE = 'Boundary conditions and the finite bound'
const PROBLEM = 'Does the finite control depend on periodic boundary conditions?'
const SCOPE = 'Finite N=6 only; do not infer thermodynamic behavior.'
const BRANCH = 'Open-boundary control'
const BRANCH_PROBLEM = 'Which step fails when the boundary is open?'
const BRANCH_SCOPE = 'Keep the parent claim conditional; a control is not a new result.'
const FOLLOWUP = 'Recover this direction and its parent question. Do not invent a result or a human decision.'
const REPLY = 'The new direction is scoped to the open-boundary control and retains its parent question.'

/** Substitute only the external transport, so the assertion observes the actual AgentLoop request. */
class OnboardingCapture extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  override async listModels(provider: string) {
    return [{ provider, id: 'capture', name: 'Onboarding request capture' }]
  }
  override async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: REPLY }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: REPLY } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function fillTopic(form: Locator, title: string, question: string, scope: string): Promise<void> {
  await form.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
  await form.getByRole('textbox', { name: 'Research question', exact: true }).fill(question)
  await form.getByRole('textbox', { name: 'Scope (optional)', exact: true }).fill(scope)
}

describe.skipIf(webSnapshotMode() === 'record')('web e2e: native research onboarding', () => {
  it('enrolls an empty project, creates a topic and branch, and delivers their real context to the first conversation', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'aitp-onboarding-browser-'))
    const root = join(temporary, 'new-project')
    const evidence = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))
    const owned: { browser?: Browser; scaffold?: WebScaffold } = {}
    onTestFinished(async () => {
      try { await owned.browser?.close() }
      finally {
        try { await owned.scaffold?.close() }
        finally { await rm(temporary, { recursive: true, force: true }) }
      }
    })
    await mkdir(root)
    await mkdir(evidence, { recursive: true })
    // No research-root overlay, source fixture or prewritten account: these are normal AITP defaults.
    const scaffold = await launchWebScaffold({ extraOverlayPath: ['aitp-agent', 'aitp-web'].map(name =>
      fileURLToPath(new URL(`../../cli/config/${name}.cordis.patch.yml`, import.meta.url))) })
    owned.scaffold = scaffold
    const capture = new OnboardingCapture()
    scaffold.ctx.effect(() => scaffold.ctx.llm.registerAdapter(['aitp-onboarding-capture'], capture), 'onboarding model request capture')
    await scaffold.ctx.agentDefaultModel.saveSelection({ provider: 'aitp-onboarding-capture', model: 'capture' })
    const registered = await scaffold.hostFetch('/api/workspace/create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'onboarding-workspace', method: 'workspace/create',
        payload: { args: { request: { path: root } } } }),
    })
    expect(registered.status).toBe(200)
    expect(await registered.json()).toMatchObject({ result: { ok: true, value: { workspace: { path: root } } } })
    const workspace = scaffold.ctx.workspaceRegistry.list().find(item => item.path === root)
    if (workspace === undefined) throw new Error('The new project Workspace was not registered.')
    const browser = await chromium.launch()
    owned.browser = browser
    const page = await newEnglishPage(browser)
    const console = watchConsole(page)
    const panel = page.locator('section[aria-label="Research"]')
    const discussion = page.locator('[data-research-discussion]').filter({ visible: true })
    const composer = discussion.locator('[data-composer-input][contenteditable="true"]')
    const horizontalOverflow = (): Promise<number> => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const openResearch = async (): Promise<void> => {
      await page.getByRole('button', { name: 'Browse projects', exact: true }).click()
    }
    onTestFailed(() => saveFailureShot(page, 'web-e2e-aitp-onboarding'))
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await openResearch()
    await panel.getByRole('heading', { name: 'Enable research in this workspace', exact: true }).waitFor()
    expect(await readdir(root)).toEqual([])
    expect(capture.requests).toHaveLength(0)
    // The initial read-only choice enrolls the project without creating any scientific file.
    await panel.getByRole('button', { name: 'Enable research project', exact: true }).click()
    await panel.getByRole('button', { name: 'Enable saving', exact: true }).waitFor()
    expect(await readdir(root)).toEqual([])
    await panel.getByRole('button', { name: 'Enable saving', exact: true }).click()
    const setup = panel.getByRole('region', { name: 'Enable saving for this project', exact: true })
    await setup.getByRole('checkbox', { name: 'Allow saving research changes', exact: true }).check()
    await setup.getByRole('button', { name: 'Enable saving', exact: true }).click()
    await expect.poll(() => readFile(join(root, 'research.md'), 'utf8')).toContain('# new-project')
    await panel.getByRole('button', { name: 'New topic', exact: true }).click()
    const form = panel.getByRole('form', { name: 'New research topic', exact: true })
    await fillTopic(form, TITLE, PROBLEM, SCOPE)
    await page.screenshot({ path: join(evidence, 'aitp-onboarding-form.png'), fullPage: true, animations: 'disabled' })
    await scaffold.ctx.settings.mutate('locale', [{ op: 'set', path: ['preference'], value: 'zh' }])
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('zh-CN')
    await scaffold.ctx.settings.mutate('ui-theme', [{ op: 'set', path: ['preference'], value: 'dark' }])
    await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme'))).toBe(true)
    await page.setViewportSize({ width: 390, height: 1000 })
    await expect.poll(horizontalOverflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: join(evidence, 'aitp-onboarding-form-zh-dark-mobile.png'),
      fullPage: true, animations: 'disabled' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await scaffold.ctx.settings.mutate('ui-theme', [{ op: 'set', path: ['preference'], value: 'light' }])
    await scaffold.ctx.settings.mutate('locale', [{ op: 'set', path: ['preference'], value: 'en' }])
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en')
    expect(await form.getByRole('textbox', { name: 'Research question', exact: true }).inputValue()).toBe(PROBLEM)
    const create = async (): Promise<CreateTopicReceipt> => {
      const response = page.waitForResponse(value => new URL(value.url()).pathname.endsWith('/researchMemory/createTopic'))
      await form.getByRole('button', { name: 'Create topic', exact: true }).click()
      const result = await (await response).json() as { result: { ok: boolean; value: Result<CreateTopicReceipt> } }
      expect(result.result.ok).toBe(true)
      const outcome = result.result.value
      if (!outcome.ok) throw new Error(`Topic creation failed: ${outcome.error.message}`)
      return outcome.value
    }
    const topic = await create()
    await panel.getByRole('heading', { name: TITLE, exact: true, level: 2 }).waitFor()
    await discussion.getByText(TITLE, { exact: true }).waitFor()
    await composer.waitFor()
    expect(await composer.textContent()).toBe('')
    await discussion.getByText('Not sent yet', { exact: true }).waitFor()
    const topicPath = decodeURIComponent(topic.resourceId.slice('resource:'.length))
    const source = await readFile(join(root, topicPath), 'utf8')
    expect(source).toContain(PROBLEM)
    expect(source).toContain(SCOPE)
    expect(await readFile(join(root, 'research.md'), 'utf8')).toContain(topicPath)
    expect(capture.requests).toHaveLength(0)
    const management = panel.locator('details').filter({ has: page.getByText('Manage topics', { exact: true }) })
    if (await management.getAttribute('open') === null) await management.locator('summary').click()
    await panel.getByRole('button', { name: 'New subdirection', exact: true }).click()
    await fillTopic(form, BRANCH, BRANCH_PROBLEM, BRANCH_SCOPE)
    const child = await create()
    await panel.getByRole('heading', { name: BRANCH, exact: true, level: 2 }).waitFor()
    await discussion.getByText(BRANCH, { exact: true }).waitFor()
    await composer.waitFor()
    expect(await composer.textContent()).toBe('')
    const childPath = decodeURIComponent(child.resourceId.slice('resource:'.length))
    const childSource = await readFile(join(root, childPath), 'utf8')
    expect(childSource).toContain(BRANCH_PROBLEM)
    expect(childSource).toContain(BRANCH_SCOPE)
    expect(await readFile(join(root, topicPath), 'utf8')).toContain(PROBLEM)
    expect(await readFile(join(root, topicPath), 'utf8')).toContain(BRANCH)
    expect(capture.requests).toHaveLength(0)
    await page.reload({ waitUntil: 'load' })
    await openResearch()
    // The first render can still be loading setup; wait for the persisted project observation.
    await panel.locator('[data-map-node]').filter({ hasText: TITLE }).waitFor()
    expect(await panel.getByRole('heading', { name: 'Enable research in this workspace', exact: true }).count()).toBe(0)
    await panel.locator('[data-map-node]').filter({ hasText: TITLE }).click()
    await panel.locator('[data-map-node]').filter({ hasText: BRANCH }).click()
    await panel.getByRole('button', { name: 'Open topic', exact: true }).click()
    await panel.getByRole('heading', { name: BRANCH, exact: true, level: 2 }).waitFor()
    await page.setViewportSize({ width: 390, height: 1000 })
    await expect.poll(horizontalOverflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: join(evidence, 'aitp-onboarding-created-mobile.png'),
      fullPage: true, animations: 'disabled' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await panel.getByRole('button', { name: 'Ask about this topic', exact: true }).click()
    await discussion.getByText(BRANCH, { exact: true }).waitFor()
    await writeComposerDraft(page, composer, FOLLOWUP)
    expect(await composer.textContent()).toBe(FOLLOWUP)
    const settled = scaffold.whenTurnSettled()
    await composer.press('Enter')
    await settled
    await discussion.locator('[data-slot="conversation.chat.flow"]').getByText(REPLY, { exact: true }).waitFor()
    expect(capture.requests).toHaveLength(1)
    const request = capture.requests[0]
    if (request === undefined) throw new Error('The created direction never reached a model request.')
    const question = request.messages.find(message => message.role === 'user'
      && message.content.some(block => block.type === 'text' && block.text === FOLLOWUP))
    expect(question).toMatchObject({ source: { kind: 'aitp-research', actor: 'human', origin: { workspaceId: workspace.id, topicId: child.topicId } } })
    const context = request.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context').at(-1)
    if (context === undefined) throw new Error('The first conversation omitted its real research context.')
    const delivered = JSON.stringify(context)
    for (const text of [PROBLEM, SCOPE, BRANCH_PROBLEM, BRANCH_SCOPE, FOLLOWUP]) expect(delivered).toContain(text)
    expect(delivered).not.toContain('Synthetic fixture')
    expect(console.pageErrors).toEqual([])
    expect(console.warnings).toEqual([])
  })
})
