/** One optional topic entry per installed domain, passing explicit current scope and return state. */
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TopicLibraryOwner } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LibraryLabels } from './contracts.ts'
import type {} from './locales.ts'

export interface TopicLibraryFace {
  readonly labels: () => LibraryLabels
  readonly open: (owner: TopicLibraryOwner) => void
}

/** @param props - current topic supplied by Research and this domain's navigation face. @returns its related-library button. */
export function TopicLibraryLink(props: PropsRuntime<'aitp.research.topic.libraries'> & PropsLocale<'aitp.materials'> & InjectFace<TopicLibraryFace>): ReactNode {
  return <Button variant="outline" size="sm" onClick={() => {
    props.onLeave?.()
    props.open({ workspaceId: props.workspaceId, topicId: props.topicId, title: props.title, returnTo: props.returnTo })
  }}>
    {props.t('relatedLibrary', { library: props.labels().title })}
  </Button>
}
