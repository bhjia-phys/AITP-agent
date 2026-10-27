/** Citation routing preserves the explicit question scope and refuses foreign or escaping source paths. */
import { expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { absoluteFileAddress, sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { researchCitationLocation } from '../src/client/research-navigation.ts'
import { noteAddress } from '../src/client/protocol.ts'
import { workspaceResourceAddress } from '../src/client/workspace-resources.ts'
import type { ResourceId } from '../src/client/workspace-contract.ts'

const scope = { workspaceId: brandString<WorkspaceId>('project'), topicId: 'topic:direction%2Fresearch.md' }

it('opens note and resource citations in the centre while keeping the discussion direction', () => {
  const resourceId = brandString<ResourceId>('resource:other%2Fnote.md')
  const expected = { kind: 'resource', topicId: scope.topicId, resourceId }
  expect(researchCitationLocation(scope, noteAddress(scope.workspaceId, 'other/note.md'))).toEqual(expected)
  expect(researchCitationLocation(scope, workspaceResourceAddress(scope.workspaceId, resourceId))).toEqual(expected)
  expect(researchCitationLocation(scope, `${noteAddress(scope.workspaceId, 'other/note.md')}#a-result`)).toEqual(expected)
})

it('resolves native Session file links only within the current Workspace', () => {
  const expected = { kind: 'resource', topicId: scope.topicId, resourceId: 'resource:notes%2Fresult.md' }
  expect(researchCitationLocation(scope, sessionFileAddress('session', 'notes/result.md'), '/project')).toEqual(expected)
  expect(researchCitationLocation(scope, absoluteFileAddress('/project/notes/result.md'), '/project')).toEqual(expected)
  expect(researchCitationLocation(scope, absoluteFileAddress('/project-other/notes/result.md'), '/project')).toBeUndefined()
  expect(researchCitationLocation(scope, absoluteFileAddress('/project/notes/result.md'))).toBeUndefined()
})

it('keeps root discussions at project scope and refuses unrelated or malformed references', () => {
  expect(researchCitationLocation({ workspaceId: scope.workspaceId }, noteAddress(scope.workspaceId, 'research.md')))
    .toEqual({ kind: 'resource', topicId: null, resourceId: 'resource:research.md' })
  for (const address of [
    noteAddress(brandString<WorkspaceId>('another-project'), 'research.md'),
    noteAddress(scope.workspaceId, '../private.md'),
    'dsh-resource://aitp-note/workspace/project/note/%ZZ',
    'dsh-resource://aitp-workspace-resource/workspace/project/resource/',
    'dsh-resource://aitp-material-source/root/source',
    'https://example.org/article',
  ]) expect(researchCitationLocation(scope, address, '/project')).toBeUndefined()
})
