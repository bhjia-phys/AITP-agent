/** Actual Host+Client local libraries, source-grounded conversation and draft reuse across a process restart. */
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { expect, it, onTestFailed, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import type { ResourceReading, ResourceResult, SourceSetPage } from '@deepseek-ai/dsh-research-resources/types'
import type { StudyArtifact, StudyArtifactPage, StudyResult } from '@deepseek-ai/dsh-research-study/types'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const execFile = promisify(execFileCallback)
const QUESTION = 'Compare the selected condition, exact PDF page and source implementation. State all reading limits.'
const SET = 'Three-source bounded reading'
const NOTE = 'Captured bounded comparison'
const TOPIC = 'Bounded direction'

function value<T>(result: StudyResult<T> | ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function panel(page: Page, title: string): Promise<Locator> {
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: title, exact: true }).click()
  const result = page.locator(`section[aria-label="${title}"]`)
  await result.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor()
  return result
}

async function selectPdfText(panel: Locator, text: string): Promise<void> {
  await panel.locator('[data-pdf-text] span').filter({ hasText: text }).first().evaluate((element) => {
    const range = element.ownerDocument.createRange()
    range.selectNodeContents(element)
    const selection = element.ownerDocument.defaultView?.getSelection()
    selection?.removeAllRanges(); selection?.addRange(range)
  })
  await panel.getByRole('button', { name: 'Use selected passage', exact: true }).click()
}

it('connects an existing Workspace read-only, reads three libraries and reuses a real saved answer after a full app restart', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-local-library-browser-')), project = join(world, 'research-project')
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  onTestFinished(async () => {
    const failures: unknown[] = []
    if (owned.page !== undefined) {
      await saveFailureShot(owned.page, 'local-research-libraries')
      try {
        await writeFile(fileURLToPath(new URL('../../../.artifacts/local-libraries-body.txt', import.meta.url)),
          await owned.page.locator('body').innerText())
      } catch (error) {
        // A crashed renderer must not prevent Host shutdown or replace the scenario's primary failure.
        void error
      }
    }
    await owned.browser?.close().catch((error: unknown) => failures.push(error))
    await owned.app?.stop().catch((error: unknown) => failures.push(error))
    await model.close().catch((error: unknown) => failures.push(error))
    await rm(world, { recursive: true, force: true }).catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'Library browser cleanup failed.')
  })
  await mkdir(project)
  const sources = new Map<string, string | Buffer>([
    ['research.md', '# Local source project\n\nWhich sources support the bounded condition?\n\n## Topics\n\n[Bounded direction](direction/research.md)\n'],
    ['direction/research.md', '# Bounded direction\n\n## Question\n\nDoes the selected implementation preserve condition A?\n\n## Scope\n\nOnly these local sources; keep unread pages explicit.\n\n## Materials\n\n[Conditional explanation](../atom.md)\n[Exact paper](../paper.pdf)\n[Implementation](../model.py)\n'],
    ['index.md', '# Existing knowledge\n\n| Question | Kind | Note | Support | Review |\n|---|---|---|---|---|\n| Which condition is required? | theorem | [Condition explanation](atom.md) | source | awaiting |\n| Unrelated knowledge | theorem | [Unrelated](unrelated.md) | unchecked | awaiting |\n'],
    ['atom.md', '---\nkind: theorem\nsupport: source\nreview: awaiting\n---\n# Conditional explanation\n\nOnly under A. Other conditions remain unresolved.\n'],
    ['unrelated.md', '---\nkind: theorem\n---\n# Unrelated branch\n\nThis source is not associated with the bounded direction.\n'],
    ['paper.pdf', await readFile(fileURLToPath(new URL('../../../packages/research/research-literature/tests/fixtures/two-pages.pdf', import.meta.url)))],
    ['references.bib', '@article{condition, title={Conditional source}, author={Fixture, A.}, year={2026}}\n'],
    ['model.py', 'def assumption():\n    return "original condition"\n'],
  ])
  await Promise.all([...sources].map(async ([path, bytes]) => {
    await mkdir(dirname(join(project, path)), { recursive: true })
    await writeFile(join(project, path), bytes)
  }))
  const git = (...args: string[]) => execFile('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: project,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' } })
  await git('init', '-q'); await git('add', '.')
  await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Initial sources')
  sources.set('model.py', 'def assumption():\n    return "modified condition under A"\n')
  await writeFile(join(project, 'model.py'), sources.get('model.py') ?? '')
  const originalIndex = await readFile(join(project, '.git/index'))
  const originalNames = (await readdir(project)).sort()
  const app = new LibraryApp(world, await model.start())
  owned.app = app
  let url = await app.start()
  const workspace = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project } })
  const browser = await chromium.launch()
  owned.browser = browser
  const page = await newEnglishPage(browser)
  owned.page = page
  const errors: string[] = []
  const browserDiagnostics: string[] = []
  page.on('pageerror', (error) => { errors.push(String(error)) })
  page.on('crash', () => { browserDiagnostics.push('Chromium renderer crashed') })
  page.on('console', (message) => { if (message.type() === 'error') browserDiagnostics.push(message.text()) })
  page.on('requestfailed', (request) => { browserDiagnostics.push(`${request.url()}: ${request.failure()?.errorText}`) })
  const notFound: string[] = []
  page.on('response', (response) => { if (response.status() === 404) notFound.push(response.url()) })
  onTestFailed(async () => {
    await saveFailureShot(page, 'local-research-libraries')
    await writeFile(fileURLToPath(new URL('../../../.artifacts/local-libraries-app.log', import.meta.url)),
      `${app.logs()}\nBrowser diagnostics:\n${browserDiagnostics.join('\n')}\n${errors.join('\n')}\nHTTP 404:\n${notFound.join('\n')}`)
  })
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })

  let knowledge = await panel(page, 'Knowledge library')
  await knowledge.getByText('Source sets and folders', { exact: true }).click()
  await knowledge.getByRole('combobox', { name: 'Existing Workspace', exact: true }).selectOption(workspace.workspace.workspaceId)
  await knowledge.getByRole('button', { name: 'Connect folder', exact: true }).click()
  await knowledge.getByRole('button', { name: 'Which condition is required?', exact: true }).waitFor()
  expect(model.requests).toHaveLength(0)
  expect((await readdir(project)).sort()).toEqual(originalNames)
  await knowledge.getByRole('button', { name: 'Unrelated knowledge', exact: true }).waitFor()
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Research', exact: true }).click()
  const research = page.locator('section[aria-label="Research"]')
  await research.getByRole('button', { name: 'Enable research project', exact: true }).click()
  await research.locator('[data-map-node]').filter({ hasText: TOPIC }).click()
  await research.getByRole('button', { name: 'Open topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await research.getByRole('button', { name: /Related.*Knowledge library/ }).click()
  knowledge = page.locator('section[aria-label="Knowledge library"]')
  await knowledge.getByText(`Question scope: Current topic: ${TOPIC}`, { exact: true }).waitFor()
  await knowledge.getByRole('button', { name: 'Which condition is required?', exact: true }).waitFor()
  expect(await knowledge.getByRole('button', { name: 'Unrelated knowledge', exact: true }).count()).toBe(0)
  await saveFailureShot(page, 'local-libraries-knowledge-topic')
  await knowledge.getByRole('button', { name: 'Which condition is required?', exact: true }).click()
  await knowledge.getByText('Only under A. Other conditions remain unresolved.', { exact: true }).waitFor()
  await knowledge.getByRole('button', { name: 'Use this source', exact: true }).click()

  await knowledge.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await research.getByRole('button', { name: /Related.*Literature library/ }).click()
  const literature = page.locator('section[aria-label="Literature library"]')
  await literature.getByText(`Question scope: Current topic: ${TOPIC}`, { exact: true }).waitFor()
  const pdfResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/researchResources/readResource'))
  await literature.getByRole('button', { name: 'paper.pdf', exact: true }).click()
  const observedPdf = await (await pdfResponse).json() as { result: { ok: boolean; value: ResourceResult<ResourceReading> } }
  expect(observedPdf.result.ok).toBe(true)
  const pdfReading = value(observedPdf.result.value)
  expect(pdfReading.body.kind).toBe('pdf')
  if (pdfReading.body.kind !== 'pdf') throw new Error('The actual PDF read returned no PDF body.')
  expect(pdfReading.body.dataBase64).toBeDefined()
  await literature.getByRole('img', { name: 'PDF page 1', exact: true }).waitFor({ state: 'visible' })
  await literature.getByRole('button', { name: 'Next PDF page', exact: true }).click()
  const canvas = literature.getByRole('img', { name: 'PDF page 2', exact: true })
  await canvas.waitFor({ state: 'visible' })
  expect(await canvas.evaluate(element => element instanceof HTMLCanvasElement && element.width > 0 && element.height > 0)).toBe(true)
  await saveFailureShot(page, 'local-libraries-pdf-page2')
  await selectPdfText(literature, 'Page two exact text')
  await literature.getByText('Page two exact text', { exact: true }).first().waitFor()

  await literature.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await research.getByRole('button', { name: /Related.*Code librar/ }).click()
  const code = page.locator('section[aria-label="Code libraries"]')
  await code.getByText(`Question scope: Current topic: ${TOPIC}`, { exact: true }).waitFor()
  await code.getByRole('button', { name: 'model.py', exact: true }).click()
  await code.locator('pre').filter({ hasText: 'modified condition under A' }).waitFor()
  await code.getByRole('button', { name: 'Use this source', exact: true }).click()
  await code.getByRole('textbox', { name: 'Source-set name', exact: true }).fill(SET)
  await code.getByRole('button', { name: 'Save source set', exact: true }).click()
  await code.getByRole('status').filter({ hasText: 'Source set saved on this Host.' }).waitFor()
  const sourceSets = value(await app.rpc<ResourceResult<SourceSetPage>>('researchResources/listSourceSets', { request: {} }))
  expect(sourceSets.items).toMatchObject([{ title: SET, selectionCount: 3 }])
  await code.getByRole('textbox', { name: 'Ask about the selected sources', exact: true }).fill(QUESTION)
  await code.getByRole('button', { name: 'Ask in a new conversation', exact: true }).click()
  const chat = page.locator('[data-slot="conversation.chat.flow"]')
  await chat.getByText('The selected source states: Only under A.', { exact: false }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Save this answer as a draft', exact: true }).waitFor()
  expect(model.requests).toHaveLength(1)
  for (const text of [QUESTION, 'Only under A.', 'Page two exact text', 'modified condition under A']) expect(model.requests[0]).toContain(text)
  expect(model.requests[0]).toContain('pdf-page')
  expect(model.requests[0]).toContain('aitp-research-memory')
  expect(model.requests[0]).toContain('topic:direction%2Fresearch.md')
  expect(model.requests[0]).toContain(workspace.workspace.workspaceId)
  await page.getByRole('button', { name: 'Save this answer as a draft', exact: true }).click()
  let study = page.locator('section[aria-label="Study notes"]')
  await study.getByRole('textbox', { name: 'Title', exact: true }).fill(NOTE)
  await study.getByRole('combobox', { name: 'Product', exact: true }).selectOption('comparison')
  await study.getByRole('button', { name: 'Capture selected answer', exact: true }).click()
  await study.getByRole('heading', { name: NOTE, exact: true, level: 2 }).waitFor()
  await study.getByText('Captured model answer', { exact: false }).waitFor()
  const drafts = value(await app.rpc<StudyResult<StudyArtifactPage>>('researchStudy/listArtifacts', { request: {} }))
  const summary = drafts.items.find(item => item.title === NOTE)
  if (summary === undefined) throw new Error('The real answer was not saved as a study draft.')
  const artifact = value(await app.rpc<StudyResult<StudyArtifact>>('researchStudy/getArtifact', { request: { id: summary.id } }))
  expect(artifact.capture?.actor).toBe('model')
  expect(artifact.capture?.sessionId).toBeDefined()
  expect(artifact.citations.some(citation => citation.basis === 'selected')).toBe(true)
  expect(artifact.citations.some(citation => citation.basis === 'recorded-context')).toBe(true)
  expect(artifact.citations.some(citation => citation.basis === 'recorded-source-read')).toBe(false)
  await writeFile(fileURLToPath(new URL('../../../.artifacts/local-libraries-capture-evidence.json', import.meta.url)), JSON.stringify({
    id: artifact.id, artifactCharacters: JSON.stringify(artifact).length, markdownCharacters: artifact.markdown.length,
    contextCharacters: artifact.capture?.contexts.map(context => ({ name: context.name, characters: context.text.length })),
    citations: artifact.citations.map(citation => ({ basis: citation.basis, sourceId: citation.selection.ref.sourceId,
      locatorKind: citation.selection.locator?.kind })),
  }, null, 2))

  const port = Number(new URL(url).port)
  await app.stop()
  url = await app.start(port)
  await page.goto(url, { waitUntil: 'load' })
  study = await panel(page, 'Study notes')
  await study.getByRole('button', { name: NOTE, exact: true }).click()
  await study.getByRole('heading', { name: NOTE, exact: true, level: 2 }).waitFor()
  expect(value(await app.rpc<StudyResult<StudyArtifact>>('researchStudy/getArtifact', { request: { id: summary.id } }))).toEqual(artifact)
  await saveFailureShot(page, 'local-libraries-study-restored')
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  await saveFailureShot(page, 'local-libraries-study-restored-mobile')
  await page.setViewportSize({ width: 1680, height: 1000 })
  knowledge = await panel(page, 'Knowledge library')
  await knowledge.getByText('Source sets and folders', { exact: true }).click()
  await knowledge.getByRole('button', { name: SET, exact: true }).click()
  await knowledge.getByText('Selected sources (3)', { exact: true }).waitFor()
  await knowledge.locator('summary').filter({ hasText: 'Selected passage' }).click()
  await knowledge.getByText('Page two exact text', { exact: true }).waitFor()
  const removals = knowledge.getByRole('button', { name: /^Remove .+ from this question$/u })
  for (let index = await removals.count() - 1; index >= 0; index--) await removals.nth(index).click()
  await knowledge.getByText('Selected sources (0)', { exact: true }).waitFor()
  study = await panel(page, 'Study notes')
  await study.getByRole('button', { name: 'Open as a source', exact: true }).click()
  knowledge = page.locator('section[aria-label="Knowledge library"]')
  await knowledge.getByRole('heading', { name: NOTE, exact: true, level: 2 }).waitFor()
  await knowledge.getByText('Study draft: comparison; provisional; captured-answer.', { exact: false }).waitFor()
  await knowledge.getByRole('button', { name: 'Use this source', exact: true }).click()
  await knowledge.getByRole('textbox', { name: 'Ask about the selected sources', exact: true }).fill('Reopen the saved draft as a provisional source. Preserve its reading limits.')
  await knowledge.getByRole('button', { name: 'Ask in a new conversation', exact: true }).click()
  await page.getByRole('button', { name: 'Save this answer as a draft', exact: true }).waitFor()
  await expect.poll(() => model.requests.length).toBe(2)
  expect(model.requests[1]?.includes('draft%3A')).toBe(true)
  expect(model.requests[1]?.includes('provisional')).toBe(true)
  expect(model.requests[1]?.includes('Other pages remain unread')).toBe(true)
  study = await panel(page, 'Study notes')
  await study.locator('summary').filter({ hasText: 'Recorded model context' }).click()
  await study.getByRole('button', { name: 'Open original conversation', exact: true }).click()
  await chat.getByRole('link', { name: 'Source passage', exact: true }).click()
  await page.locator('canvas[data-rendered-pdf-page="2"]').waitFor({ state: 'visible' })
  await chat.getByRole('link', { name: 'Inspect the current checkout diff', exact: true }).click()
  await page.locator('pre').filter({ hasText: '+    return "modified condition under A"' }).waitFor()
  await saveFailureShot(page, 'local-libraries-checkout-diff')
  expect((await readdir(project)).sort()).toEqual(originalNames)
  for (const [path, bytes] of sources) expect(await readFile(join(project, path))).toEqual(typeof bytes === 'string' ? Buffer.from(bytes) : bytes)
  expect(await readFile(join(project, '.git/index'))).toEqual(originalIndex)
  expect(errors).toEqual([])
  // The native-app icon service documents 404 plus its generic glyph when this headless Host has no file-manager icon.
  expect(notFound.filter(url => new URL(url).pathname !== '/open-in-app/icon/filemanager')).toEqual([])
}, 240_000)
