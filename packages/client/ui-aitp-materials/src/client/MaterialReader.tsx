/** Shared located-source reader used by library panels and normal Session dock tabs. */
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, CodeBlock, languageForPath, extractMarkdownPlainText, IconNewChatOutlineRegular, IconPlusOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import { materialRefKey, materialsScopeKey } from './store.ts'
import { ImageMaterialReader } from './ImageMaterialReader.tsx'
import { PdfMaterialReader } from './PdfMaterialReader.tsx'
import { MaterialReaderHeader, MaterialReaderLinks } from './MaterialReaderHeader.tsx'
import { selectMaterialPassage } from './selection.ts'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import { parseSourceFrontmatter, parseSourceMarkup } from '@deepseek-ai/dsh-research-resources/markup'
import css from './materials.module.css'

/**
 * Read an observed source and its recorded links without sending a model request.
 * @param props - observation, source callbacks and the factory's locale seat.
 * @returns the source with exact text selection or explicit unavailability.
 */
export function MaterialReader(props: FactoryComponentPropsOf<'aitp.materials.reader'>): ReactNode {
  const scope = props.useStore(state => materialsScopeKey(state.scope))
  // A retained dock tab already owns its scope; another foreground topic must not remount its reader.
  const owner = props.presentation === 'dock' ? '' : scope
  const key = `${owner}:${materialRefKey(props.reading.resource.ref)}:${JSON.stringify(props.reading.locator ?? null)}`
  return props.reading.body.kind === 'pdf' ? <PdfMaterialReader key={key} {...props} />
    : props.reading.body.kind === 'image' ? <ImageMaterialReader key={key} {...props} /> : <TextMaterialReader key={key} {...props} />
}

function TextMaterialReader(props: FactoryComponentPropsOf<'aitp.materials.reader'>): ReactNode {
  const { reading, t } = props
  const { resource, body } = reading
  const dock = props.presentation === 'dock'
  const path = materialSourcePath(resource.ref.sourceId)
  const markdown = body.kind === 'text' && reading.locator?.kind !== 'git' && resource.locator?.kind !== 'git'
    && (body.format === 'markdown' || /\.(?:md|markdown)$/iu.test(path ?? ''))
  const source = useRef<HTMLElement>(null)
  const [raw, setRaw] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const frontmatter = useMemo(() => body.kind === 'text' && markdown ? parseSourceFrontmatter(body.text) : undefined, [body, markdown])
  const readingText = useMemo(() => {
    if (body.kind !== 'text') return ''
    const locator = reading.locator
    const located = locator?.kind === 'anchor' ? parseSourceMarkup(body.text).anchors.find(anchor => anchor.anchor === locator.anchor) : undefined
    const text = located === undefined
      ? body.text.slice(dock ? 0 : frontmatter?.bodyOffset ?? 0) : body.text.slice(located.start, located.end)
    if (dock) return text
    if (!markdown) return text
    const heading = /^(?:[ \t]*\r?\n)*# +([^\r\n]+)\r?\n(?:\r?\n)?/.exec(text)
    return heading?.[1] !== undefined && extractMarkdownPlainText(heading[1]).trim() === resource.title.trim()
      ? text.slice(heading[0].length) : text
  }, [body, frontmatter, markdown, resource.title, reading.locator, dock])
  const select = (): void => {
    const selected = globalThis.getSelection()
    if (selected === null || selected.anchorNode === null || selected.focusNode === null || !source.current?.contains(selected.anchorNode) || !source.current.contains(selected.focusNode)) { setFailure(t('unlocated')); return }
    const selection = selectMaterialPassage(reading, selected.toString())
    if (selection === undefined) { setFailure(t('unlocated')); return }
    setFailure(null)
    props.onSelect?.(selection)
  }
  return <article className={dock ? `${css.reader} ${css.dockReader}` : css.reader}
    data-material-presentation={props.presentation} data-material-domain={markdown && (dock || props.libraryDomain !== 'code') ? 'document' : resource.domain}>
    {!dock && <MaterialReaderHeader {...props} />}
    {(props.onDiscuss !== undefined || props.onSelect !== undefined || markdown) && <div className={css.readerActions}>
      {props.onDiscuss !== undefined && <Button size="sm" variant="primary" icon={<IconNewChatOutlineRegular />} onClick={() => {
        props.onDiscuss?.({ ref: resource.ref,
          ...reading.locator === undefined ? {} : { locator: reading.locator },
        })
      }}>{t('discussSource')}</Button>}
      {props.onSelect !== undefined && <Button size="sm" variant="outline" icon={<IconPlusOutlineRegular />} onClick={() => {
        props.onSelect?.({ ref: resource.ref, ...reading.locator === undefined ? {} : { locator: reading.locator } })
      }}>{t('useSource')}</Button>}
      {props.onSelect !== undefined && body.kind !== 'unavailable' && (!markdown || raw)
        && <Button size="sm" variant="ghost" onClick={select}>{t('quote')}</Button>}
      {markdown && <div className={css.readingModes}>
        <Button size="sm" aria-pressed={!raw} variant={raw ? 'ghost' : 'outline'} onClick={() => { setRaw(false) }}>{t('reading')}</Button>
        <Button size="sm" aria-pressed={raw} variant={raw ? 'outline' : 'ghost'} onClick={() => { setRaw(true) }}>{t('raw')}</Button>
      </div>}
    </div>}
    {failure !== null && <p role="alert" className={css.notice}>{failure}</p>}
    <section ref={source} className={dock ? `${css.source} ${css.dockText}` : css.source}>
      {!dock && !raw && body.kind === 'text' && frontmatter !== undefined && frontmatter.issues.length > 0
        && <pre>{body.text.slice(0, frontmatter.bodyOffset)}</pre>}
      {body.kind === 'unavailable' ? <p role="note">{t('noContent')} {body.detail}</p>
        : body.kind !== 'text' ? null : body.text.trim() === '' && reading.locator?.kind !== 'git' && resource.locator?.kind !== 'git' ? <p className={css.muted}>{t('emptySource')}</p>
          : props.renderSlot('aitp.materials.reader.body', {
            reading, text: readingText, raw, onLink: props.onLink,
            onNavigate: (selection) => {
              if (props.onNavigate !== undefined) props.onNavigate(selection)
              else if (!props.onLink({ href: '', label: resource.title, target: selection.ref,
                ...selection.locator === undefined ? {} : { locator: selection.locator } })) setFailure(t('unresolved'))
            },
          }, { entryKey: raw || dock && markdown && resource.domain === 'code' || resource.domain === 'knowledge' && !markdown
              || markdown && resource.domain === 'code' && props.libraryDomain !== 'code' ? '' : resource.domain,
          fallback: markdown && !raw ? props.renderFactorySlot('aitp.materials.markdown', {
            reading, text: readingText, onLink: props.onLink,
          }) : dock ? props.renderFactorySlot('document.code.reader', {
            text: body.text, ...path === undefined ? {} : { path }, lineNumbers: !raw,
          }) : !raw && path !== undefined && languageForPath(path) !== undefined
            ? <CodeBlock code={body.text} lang={languageForPath(path)} copyLabel={t('copy')} copiedLabel={t('copied')} /> : <pre>{body.text}</pre>,
          })}
    </section>
    {!dock && reading.issues.length > 0 && <ul className={css.notice}>{reading.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    {!dock && <MaterialReaderLinks {...props} onFailure={() => { setFailure(t('unresolved')) }} />}
    <details className={css.observation}><summary>{t('readingInfo')}</summary>
      {dock && <>
        <MaterialReaderHeader {...props} />
        {reading.issues.length > 0 && <ul className={css.notice}>{reading.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        <MaterialReaderLinks {...props} onFailure={() => { setFailure(t('unresolved')) }} />
      </>}
      {path !== undefined && <p className={css.muted}>{t('path')}: {path}</p>}
      {frontmatter !== undefined && frontmatter.issues.length === 0 && frontmatter.source.trim() !== '' && <details>
        <summary>{t('metadata')}</summary><pre>{frontmatter.source}</pre>
      </details>}
      <p className={css.muted}>{t('observed', { time: reading.observedAt })}</p>
      <p className={css.muted}>{t('sourceChanged')}</p>
    </details>
  </article>
}
