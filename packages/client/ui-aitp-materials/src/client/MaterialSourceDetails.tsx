/** Source locations and authored research uses shared by the text, PDF and image readers. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import { extractMarkdownPlainText, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import type { SourceRoot } from '@deepseek-ai/dsh-research-resources/types'
import css from './materials.module.css'

/** Reader inputs plus the current root observation; no source permission is inferred from its display path. */
export type LocatedMaterialReaderProps = FactoryComponentPropsOf<'aitp.materials.reader'> & {
  readonly sourceRoot?: SourceRoot
}

/**
 * Identify the original source folder and its recorded research uses without changing question scope.
 * @param props - observed source, optional current folder metadata and localized labels.
 * @returns exact displayed locations and authored using passages, with missing root information explicit.
 */
export function MaterialSourceDetails({ reading, sourceRoot, t }: Pick<LocatedMaterialReaderProps, 'reading' | 'sourceRoot' | 't'>): ReactNode {
  const path = materialSourcePath(reading.resource.ref.sourceId)
  return <details className={css.sourceLocation}>
    <summary><IconChevronRightOutlineRegular size={14} /><span>{t('path')}</span>{sourceRoot !== undefined && <span className={css.sourceRootLabel}>{sourceRoot.title}</span>}
      <code>{path ?? reading.resource.title}</code></summary>
    <dl className={css.metadata} aria-label={t('path')}>
      <div><dt>{t('sourceFolder')}</dt><dd>{sourceRoot?.displayPath ?? t('folderLocationUnavailable')}</dd></div>
      {path !== undefined && <div><dt>{t('relativePath')}</dt><dd>{path}</dd></div>}
    </dl>
    {reading.resource.topics.length > 0 && <section aria-label={t('researchUses')}>
      <h3>{t('researchUses')}</h3>
      <ul className={css.links}>{reading.resource.topics.map((topic, index) =>
        <li key={`${topic.workspaceId}:${topic.topicId}:${index}`}>{extractMarkdownPlainText(topic.reason)}</li>)}</ul>
    </section>}
  </details>
}
