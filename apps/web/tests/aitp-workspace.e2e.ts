/** The research client uses the shipped shell and an explicitly synthetic async provider. */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { describe, expect, it, onTestFailed, onTestFinished } from 'vitest'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden, launchWebScaffold,
  watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, pinBrowserClock, saveFailureShot } from './support.ts'

const EXPECTED = fileURLToPath(new URL('./expected/aitp-workspace', import.meta.url))
const SCREENSHOTS = fileURLToPath(new URL('../../../.artifacts/screenshots/aitp-workspace', import.meta.url))
const MODE = webSnapshotMode()
const PANEL = 'section[aria-label="Research"]'
const SCOPE = 'Keep the same spectral grid and compare only the explicitly matched finite systems.'
const ANSWER = 'The finite reference agrees with the independent evolution on the selected grid.'
const LIMIT = 'This demonstration does not establish a large-system chaos result.'
const PROJECT = 'Interaction, chaos and correlation in finite systems'
const LONG_RANGE = 'Long-range chains: which comparisons survive a change of interaction exponent?'
const CONTROL = 'Small-system control (N ≤ 12)'

async function heading(panel: Locator, title: string): Promise<void> {
  await panel.getByRole('heading', { name: title, exact: true, level: 2 }).waitFor()
}

function trail(panel: Locator): Locator {
  return panel.getByRole('navigation', { name: 'Research location' })
}

async function back(panel: Locator): Promise<void> {
  await trail(panel).getByRole('button', { name: 'Back', exact: true }).click()
}

/** A map node is named by its title followed by its work state and any recorded relation. */
function node(panel: Locator, title: string): Locator {
  return panel.locator('[data-map-node]').filter({ hasText: title }).first()
}

async function applyEdit(panel: Locator, kind: 'scope' | 'answer'): Promise<void> {
  const title = kind === 'scope' ? 'Edit scope' : 'Update understanding'
  await panel.getByRole('button', { name: title, exact: true }).click()
  const editor = panel.getByRole('region', { name: title, exact: true })
  await editor.getByRole('textbox', { name: kind === 'scope' ? 'Scope' : 'Answer', exact: true }).fill(kind === 'scope' ? SCOPE : ANSWER)
  if (kind === 'answer') await editor.getByRole('textbox', { name: 'Conditions and limitations', exact: true }).fill(LIMIT)
  await editor.getByRole('button', { name: 'Preview change', exact: true }).click()
  await editor.getByText('Proposed version', { exact: true }).waitFor()
  await editor.getByRole('button', { name: 'Apply change', exact: true }).click()
  await editor.getByRole('status').filter({ hasText: 'Change applied to demo data. Research files are unchanged.' }).waitFor()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
}

async function expectContained(page: Page, panel: Locator, width: number): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.clientWidth)).toBe(width)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1)
  await expect.poll(() => panel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await expect.poll(() => panel.evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(width + 1)
}

async function captureLayouts(page: Page, scaffold: WebScaffold, name: string): Promise<void> {
  await mkdir(SCREENSHOTS, { recursive: true })
  for (const palette of ['light', 'dark'] as const) {
    await scaffold.ctx.settings.mutate('ui-theme', [{ op: 'set', path: ['preference'], value: palette }])
    await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme'))).toBe(palette === 'dark')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.getByRole('navigation', { name: 'Research navigation' }).waitFor({ state: width === 1440 ? 'visible' : 'hidden' })
      await expectContained(page, page.locator(PANEL), width)
      await page.screenshot({ path: join(SCREENSHOTS, `${name}-${palette}-${width}.png`), animations: 'disabled' })
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await scaffold.ctx.settings.mutate('ui-theme', [{ op: 'set', path: ['preference'], value: 'light' }])
  await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme'))).toBe(false)
}

describe.skipIf(MODE === 'record')('web e2e: AITP topic workspace', () => {
  it('explores the research map, acknowledges mock edits and keeps one contextual sidebar across locales and widths', async () => {
    const scaffold = await launchWebScaffold({
      extraOverlayPath: [
        fileURLToPath(new URL('../../cli/config/aitp-web.cordis.patch.yml', import.meta.url)),
        fileURLToPath(new URL('../../cli/config/aitp-ui-fixtures.cordis.patch.yml', import.meta.url)),
      ],
    })
    const owned: { browser?: Browser } = {}
    onTestFinished(async () => {
      try { await owned.browser?.close() } finally { await scaffold.close() }
    })
    const browser = await chromium.launch()
    owned.browser = browser
    const page = await newEnglishPage(browser)
    await pinBrowserClock(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const console = watchConsole(page)
    onTestFailed(() => saveFailureShot(page, 'web-e2e-aitp-workspace'))
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await connectFreshWorkspace(page, scaffold.workspaceCwd)
    await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Research', exact: true }).click()
    const panel = page.locator(PANEL)
    await heading(panel, PROJECT)
    await panel.getByText('Synthetic data. Changes last only for this preview and do not modify your research files.', { exact: false }).waitFor()
    await panel.getByRole('button', { name: 'Load more topics', exact: true }).waitFor()
    if (MODE === 'refresh') await mkdir(EXPECTED, { recursive: true })
    await compareOrRefreshGolden(join(EXPECTED, 'project.expected.md'),
      await captureStableAria(page, PANEL, scaffold.workspaceCwd), MODE)
    await captureLayouts(page, scaffold, 'project')

    await node(panel, 'Quantum chaos').click()
    await heading(panel, 'Quantum chaos and operator growth in interacting spin chains')
    await node(panel, 'Long-range chains').click()
    await heading(panel, LONG_RANGE)
    await panel.getByText('2 branches are not loaded yet.', { exact: true }).waitFor()
    await panel.getByRole('button', { name: 'Load more branches', exact: true }).click()
    await node(panel, 'Entanglement growth after a quench').waitFor()
    await compareOrRefreshGolden(join(EXPECTED, 'branch.expected.md'),
      await captureStableAria(page, PANEL, scaffold.workspaceCwd), MODE)
    await captureLayouts(page, scaffold, 'branch')

    await node(panel, 'Operator Krylov dynamics').click()
    await heading(panel, 'Operator Krylov dynamics')
    await panel.getByText('The small-system control does not cover the production grid.', { exact: true }).waitFor()
    await node(panel, 'Small-system control (N ≤ 12)').click()
    await heading(panel, CONTROL)
    await panel.getByRole('button', { name: 'Open topic', exact: true }).click()
    await heading(panel, CONTROL)
    await panel.getByRole('region', { name: 'Current understanding', exact: true }).getByText('This validates the implementation only; it says nothing about interacting chains at larger sizes.', { exact: true }).waitFor()
    await compareOrRefreshGolden(join(EXPECTED, 'topic.expected.md'),
      await captureStableAria(page, PANEL, scaffold.workspaceCwd), MODE)
    await captureLayouts(page, scaffold, 'topic')

    await panel.getByRole('button', { name: /Small-system control report/ }).click()
    await heading(panel, 'Small-system control report')
    await panel.getByText('It does not establish chaos, it does not test the interacting chain', { exact: false }).waitFor()
    expect(await panel.locator('.katex').count()).toBeGreaterThan(0)
    await compareOrRefreshGolden(join(EXPECTED, 'material.expected.md'),
      await captureStableAria(page, PANEL, scaffold.workspaceCwd), MODE)
    await captureLayouts(page, scaffold, 'material')
    await back(panel)
    await heading(panel, CONTROL)
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? '')).toContain('Small-system control report')

    await trail(panel).getByRole('button', { name: 'Operator Krylov dynamics', exact: true }).click()
    await heading(panel, 'Operator Krylov dynamics')
    await applyEdit(panel, 'scope')
    await panel.getByText(SCOPE, { exact: true }).waitFor()
    await applyEdit(panel, 'answer')
    await panel.getByText(ANSWER, { exact: true }).waitFor()
    await panel.getByText(LIMIT, { exact: true }).waitFor()
    await panel.getByRole('button', { name: 'Show on map', exact: true }).click()
    const summary = panel.getByRole('complementary', { name: 'Current understanding', exact: true })
    await summary.getByText(ANSWER, { exact: true }).waitFor()
    await summary.getByText(LIMIT, { exact: true }).waitFor()
    await summary.getByRole('button', { name: 'Read full account', exact: true }).click()
    await heading(panel, 'Operator Krylov dynamics: full account')
    await panel.getByText(SCOPE, { exact: true }).waitFor()
    await panel.getByText(ANSWER, { exact: true }).waitFor()
    await panel.getByText(LIMIT, { exact: true }).waitFor()
    await compareOrRefreshGolden(join(EXPECTED, 'updated-account.expected.md'),
      await captureStableAria(page, PANEL, scaffold.workspaceCwd), MODE)
    await back(panel)

    await trail(panel).getByRole('button', { name: 'Long-range chains', exact: true }).click()
    await heading(panel, LONG_RANGE)
    await panel.getByRole('button', { name: /Long-range-chain literature reference/ }).click()
    await heading(panel, 'Long-range-chain literature reference')
    await panel.getByText('Content is not available in this reader', { exact: true }).waitFor()
    await panel.getByText('This fixture reserves a paper destination. It does not supply a PDF or claim to have read one.', { exact: true }).waitFor()
    await compareOrRefreshGolden(join(EXPECTED, 'unavailable-paper.expected.md'),
      await captureStableAria(page, PANEL, scaffold.workspaceCwd), MODE)
    await trail(panel).getByRole('button', { name: 'Research map', exact: true }).click()
    await heading(panel, PROJECT)
    await node(panel, 'Electronic structure').click()
    await panel.getByText('One branch note could not be read in this demonstration.', { exact: true }).waitFor()
    await panel.getByText('1 recorded branch is not available in this reading.', { exact: true }).waitFor()
    await node(panel, 'GW diagnostics').click()
    await heading(panel, 'GW diagnostics')
    await panel.getByRole('button', { name: /Self-energy implementation/ }).click()
    await heading(panel, 'Self-energy implementation')
    await panel.getByText('The code reader is not connected; this path is an illustrative locator.', { exact: true }).waitFor()

    const navigation = page.getByRole('navigation', { name: 'Research navigation' })
    expect(await page.locator('[data-slot="sidebar"]').count()).toBe(1)
    expect(await panel.getByRole('navigation', { name: 'Topics', exact: true }).count()).toBe(0)
    await navigation.getByRole('button', { name: 'Conversations', exact: true }).click()
    await panel.waitFor({ state: 'hidden' })
    await page.locator('[data-slot="sidebar.workspaces"]').waitFor({ state: 'attached' })
    await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Research', exact: true }).click()
    await heading(panel, 'Self-energy implementation')
    await navigation.getByRole('button', { name: 'Show branches of Quantum chaos', exact: true }).click()
    await navigation.getByRole('button', { name: 'Show branches of Long-range chains', exact: true }).click()
    await navigation.getByRole('button', { name: 'Operator Krylov dynamics', exact: true }).click()
    await heading(panel, 'Operator Krylov dynamics')
    await panel.getByText(ANSWER, { exact: true }).waitFor()

    for (const palette of ['light', 'dark'] as const) {
      await scaffold.ctx.settings.mutate('ui-theme', [{ op: 'set', path: ['preference'], value: palette }])
      await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme'))).toBe(palette === 'dark')
      for (const width of [1440, 1024, 720, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        await heading(panel, 'Operator Krylov dynamics')
        await expectContained(page, panel, width)
      }
    }

    await page.setViewportSize({ width: 1440, height: 1000 })
    await scaffold.ctx.settings.mutate('locale', [{ op: 'set', path: ['preference'], value: 'zh' }])
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('zh-CN')
    const chinesePanel = page.getByRole('region', { name: '研究', exact: true })
    await heading(chinesePanel, 'Operator Krylov dynamics')
    await chinesePanel.getByRole('button', { name: '修改范围', exact: true }).waitFor()
    await page.getByRole('navigation', { name: '科研导航' }).getByRole('button', { name: '对话', exact: true }).waitFor()
    await compareOrRefreshGolden(join(EXPECTED, 'topic-zh.expected.md'),
      await captureStableAria(page, 'section[aria-label="研究"]', scaffold.workspaceCwd), MODE)
    await assertFixtureInventory(EXPECTED, [
      'branch.expected.md', 'material.expected.md', 'project.expected.md', 'topic.expected.md', 'topic-zh.expected.md',
      'unavailable-paper.expected.md', 'updated-account.expected.md',
    ])
    expect(console.pageErrors).toEqual([])
    expect(console.warnings).toEqual([])
  })
})
