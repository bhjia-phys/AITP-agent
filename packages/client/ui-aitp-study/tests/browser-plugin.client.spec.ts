// @vitest-environment jsdom
/** Real Loader composition and named generated Remote calls, without synthetic namespace boot rules. */
import { act, fireEvent, within } from '@testing-library/react'
import { expect, vi } from 'vitest'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { ok, openStream } from '@deepseek-ai/dsh-remote-mock'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SaveStudyNoteRequest, StudyArtifact, StudyArtifactId, StudyArtifactVersion } from '@deepseek-ai/dsh-research-study/types'
import type {} from '../src/client/index.ts'

const STUDY = '@deepseek-ai/dsh-client-ui-aitp-study'
const MATERIALS = '@deepseek-ai/dsh-client-ui-aitp-materials'
const KNOWLEDGE = '@deepseek-ai/dsh-client-ui-aitp-knowledge'
const owned = new Set([STUDY, MATERIALS, KNOWLEDGE])
const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.rows.filter(row => !owned.has(row.name)),
  { name: MATERIALS, immediately: false, inject: [
    '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-ui-sidebar-right',
  ] },
  { name: KNOWLEDGE, immediately: false, inject: [MATERIALS, '@deepseek-ai/dsh-client-locale'] },
  { name: STUDY, immediately: false, inject: [
    '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-ui-chat', '@deepseek-ai/dsh-client-ui-sidebar-right',
  ] },
]) }, { mount: true })

const note: StudyArtifact = { id: 'saved-note' as StudyArtifactId, version: 'v1' as StudyArtifactVersion,
  title: 'A real editable note', kind: 'note', status: 'provisional', origin: 'handwritten', edited: false,
  citationCount: 0, citations: [], markdown: 'The unresolved condition remains explicit.', savedBy: 'host-owner', createdAt: 'then', updatedAt: 'now',
}

it('keeps note inspection beside a library, checks an unknown save and preserves the legacy reader', async ({ mock, start }) => {
  const client = await start()
  expect(client.ctx.get('remote.researchStudy')).toBeDefined()
  expect(client.ctx.get('remote.researchResources')).toBeDefined()
  mock.load({ unary: {
    'researchResources/listRoots': ok({ ok: true, value: [] }),
    'researchResources/getSetup': ok({ ok: true, value: { canConnect: false, canSaveSourceSets: false } }),
    'researchResources/listSourceSets': ok({ ok: true, value: { items: [], nextCursor: null } }),
    'researchResources/listResources': ok({ ok: true, value: {
      items: [], nextCursor: null, completeness: 'complete', issues: [], observedAt: 'now',
    } }),
    'researchStudy/getSetup': ok({ canSave: true, canCapture: true, asSources: false }),
    'researchStudy/listArtifacts': ok({ ok: true, value: { items: [note], nextCursor: null } }),
    'researchStudy/getArtifact': ok({ ok: true, value: note }),
    'researchStudy/saveNote': ok({ ok: false, error: { code: 'unknown', message: 'Save acknowledgement lost', retryable: false } }),
  }, stream: { 'researchResources/follow': openStream([]) } })
  const ui = within(client.container!)
  act(() => {
    client.ctx.layout.selectPanel('aitp-knowledge' as MainPanelId)
  })
  await client.flush()
  fireEvent.click(ui.getByRole('button', { name: 'Inspect reading notes' }))
  await client.flush()
  expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBe('aitp-knowledge')
  expect(ui.queryByRole('button', { name: 'Study notes' })).toBeNull()
  fireEvent.click(ui.getByRole('button', { name: note.title }))
  await vi.waitFor(() => { expect(ui.getByRole('heading', { name: note.title })).toBeDefined() })
  expect(mock.log.requests('researchStudy/saveNote')).toEqual([])
  fireEvent.click(ui.getByRole('button', { name: 'Back to study notes' }))
  fireEvent.click(ui.getAllByRole('button', { name: 'New note' })[0]!)
  fireEvent.change(ui.getByRole('textbox', { name: 'Title' }), { target: { value: note.title } })
  fireEvent.change(ui.getByRole('textbox', { name: 'Note text (Markdown)' }), { target: { value: note.markdown } })
  await vi.waitFor(() => { expect(ui.getByRole('button', { name: 'Save draft' }).hasAttribute('disabled')).toBe(false) })
  fireEvent.click(ui.getByRole('button', { name: 'Save draft' }))
  await vi.waitFor(() => { expect(ui.getByText('Save acknowledgement lost')).toBeDefined() })
  const first = mock.log.requests('researchStudy/saveNote')[0] as { request: SaveStudyNoteRequest }
  expect(first).toMatchObject({ request: { title: note.title, kind: 'note', markdown: note.markdown, citations: [] } })
  await client.reload(STUDY)
  act(() => {
    client.ctx.sidebarRightRoots.openResource('aitp-knowledge' as MainPanelId, 'dsh-resource://aitp-study-setup/')
  })
  await client.flush()
  expect(ui.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe(note.title)
  expect(mock.log.requests('researchStudy/saveNote')).toHaveLength(1)
  mock.unary('researchStudy/saveNote', ok({ ok: true, value: { operationId: first.request.operationId,
    id: note.id, version: note.version, state: 'saved', committedAt: 'now' } }))
  fireEvent.click(ui.getByRole('button', { name: 'Check operation result' }))
  await vi.waitFor(() => { expect(ui.getByRole('heading', { name: note.title })).toBeDefined() })
  expect(mock.log.requests('researchStudy/saveNote')).toEqual([first, first])
  expect(mock.log.requests('researchStudy/getArtifact')).toContainEqual({ request: { id: note.id } })
  expect(mock.log.calls('session/prompt')).toEqual([])
  expect(mock.log.calls('researchResources/askStudy')).toEqual([])
  expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBe('aitp-knowledge')
  mock.unary('researchStudy/listArtifacts', ok({ ok: true, value: { items: [], nextCursor: null } }))
  await client.reload(STUDY)
  act(() => { client.ctx.layout.selectPanel('aitp-study' as MainPanelId) })
  await client.flush()
  expect(client.ctx.get('remote.researchResources')).toBeDefined()
  expect(within(ui.getByRole('region', { name: 'Study notes' })).getByText('No study notes are saved.')).toBeDefined()
  await client.unload(KNOWLEDGE)
  await client.unload(MATERIALS)
  await client.flush()
  expect(client.ctx.get('remote.researchResources')).toBeUndefined()
  expect(client.ctx.get('remote.researchStudy')).toBeDefined()
  expect(within(ui.getByRole('region', { name: 'Study notes' })).getByText('No study notes are saved.')).toBeDefined()
  await client.unload(STUDY)
  await client.flush()
  expect(client.ctx.get('remote.researchStudy')).toBeUndefined()
}, 60_000)
