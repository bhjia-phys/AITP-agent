/** Domain dispatch with a usable shared fallback while a presentation plugin is absent. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import { FileTypeIcon, extractMarkdownPlainText } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './materials.module.css'

/**
 * Keep selection and source navigation identical across independently composed catalogs.
 * @param props - observed rows and shared owner commands.
 * @returns the installed domain view or an accessible plain source list.
 */
export function MaterialsCatalog(props: FactoryComponentPropsOf<'aitp.materials.catalog'>): ReactNode {
  const { domain, items, roots, rootId, folderPath, query, topicFiltered, selected, disabled,
    isSelected, onOpen, onSelect, onRoot, onFolder } = props
  return props.renderSlot('aitp.materials.catalog.body', { domain, items, roots, rootId, folderPath, query, ...topicFiltered === undefined ? {} : { topicFiltered }, selected, disabled, isSelected, onOpen, onSelect, onRoot, onFolder }, { entryKey: props.domain,
    fallback: <ul className={css.list}>{props.items.map((resource) => {
      const selection = { ref: resource.ref, ...resource.locator === undefined ? {} : { locator: resource.locator } }
      return <li key={resource.id} className={css.row}>
        <input type="checkbox" aria-label={props.t('select', { title: resource.title })}
          disabled={props.disabled} checked={props.isSelected(resource)}
          onChange={(event) => { props.onSelect(resource, event.currentTarget.checked) }} />
        <FileTypeIcon path={resource.title} size={18} />
        <div className={css.rowBody}><button className={css.rowTitle} type="button" onClick={() => { props.onOpen(selection) }}>{resource.title}</button>
          {resource.description !== undefined && resource.description !== resource.title
            && <p className={css.muted}>{resource.description}</p>}
          {resource.topics.length > 0 && <ul className={css.links}>{resource.topics.map(topic => <li key={`${topic.workspaceId}:${topic.topicId}`} className={css.muted}>{extractMarkdownPlainText(topic.reason)}</li>)}</ul>}
        </div>
      </li>
    })}</ul>,
  })
}
