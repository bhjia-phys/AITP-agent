/** Research startup choices in the native Settings shell. */
import { useEffect, useId } from 'react'
import { IconLoadingOutlineRegular, SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResearchSettingsFace } from './research-settings-controller.ts'
import css from './research-settings.module.css'

/** Renderer-derived page contract; no settings service enters the component. */
export type ResearchSettingsProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.research'> & InjectFace<ResearchSettingsFace>

/**
 * Render current observations separately from the preference saved for a future launch.
 * @param props - Native Settings slot props, locale and bound preference actions.
 * @returns The Research settings page.
 */
export function ResearchSettingsSection(props: ResearchSettingsProps) {
  const { t } = props
  const state = props.useResearchSettings(value => value)
  const group = useId()
  useEffect(() => { props.refresh() }, [props.refresh])
  if (state.loading) return <div className={css.loading} role="status" aria-label={t('loading')}><IconLoadingOutlineRegular size={20} /></div>
  const value = state.value
  const disabled = !state.writable || state.saving
  const libraryCount = value ? Number(value.literature) + Number(value.knowledge) + Number(value.code) : 0
  return <section className={css.section} aria-label={t('title')}>
    <header className={css.header}>
      <h2>{t('title')}</h2>
      <p>{t('intro')}</p>
    </header>
    <details className={css.current}>
      <summary>{t('current')}<span className={css.currentSummary}>{t('workbench')}: {t(state.running?.workbench ?? 'unknown')}</span></summary>
      <div className={css.currentBody}>
        <dl className={css.capabilities}>
          {(['sourceAccess', 'workbench', 'literature', 'knowledge', 'code', 'automaticResearch'] as const).map(key => <div key={key}>
            <dt>{t(key)}</dt><dd>{t(state.running?.[key] ?? 'unknown')}</dd>
          </div>)}
        </dl>
        <p className={css.hint}>{t('currentHelp')}</p>
        <p className={css.hint}>{t('reloadAutomatic')}</p>
        {state.inventoryFailed ? <p className={css.problem} role="status">{t(state.running ? 'staleInventory' : 'inventoryFailed')}</p> : null}
        <button type="button" className={css.secondary} disabled={state.refreshing} onClick={props.refresh}>{t('refresh')}</button>
      </div>
    </details>
    <SettingsForm state={{ ...state, invalid: state.invalid || state.changedElsewhere }} onSave={props.save} onDiscard={props.discard}
      labels={{ unavailable: t('unavailableForm'), readOnly: t('readOnly'), save: t('save'), saving: t('saving'), saveFailed: t('saveFailed') }}>
      {value ? <>
        <fieldset className={css.suites} disabled={disabled}>
          <legend>{t('nextStart')}</legend>
          <p className={css.editState} role="status">{state.edited && state.dirty ? t('unsaved')
            : !state.hasSavedPreference ? t('notSaved') : state.saved ? t('saved') : '\u00a0'}</p>
          {(['skills', 'browse', 'full'] as const).map(suite => <label key={suite} className={css.suite} data-selected={value.suite === suite ? 'true' : undefined}>
            <input type="radio" name={group} value={suite} checked={value.suite === suite} onChange={() => { props.editSuite(suite) }} />
            <span><strong>{t(suite)}</strong><span className={css.description}>{t(`${suite}Help`)}</span></span>
          </label>)}
        </fieldset>
        {value.suite === 'skills' ? <p className={css.hint}>{t('skillsLibraries')}</p> : <details className={css.libraries}>
          <summary>{t('libraries')}<span className={css.count}>{t('libraryCount', { count: String(libraryCount) })}</span></summary>
          <p className={css.hint}>{t('librariesHelp')}</p>
          <fieldset className={css.libraryFields} disabled={disabled} aria-label={t('libraries')}>
            {(['literature', 'knowledge', 'code'] as const).map(library => <label key={library} className={css.library}>
              <input type="checkbox" checked={value[library]} onChange={(event) => { props.editLibrary(library, event.currentTarget.checked) }} />
              <span><strong>{t(library)}</strong><span className={css.description}>{t(`${library}Help`)}</span></span>
            </label>)}
          </fieldset>
          {libraryCount === 0 ? <p className={css.hint}>{t('noLibraries')}</p> : null}
        </details>}
        <div className={css.restart}>
          <p>{t('restart')}</p>
          <p className={css.hint}>{t('priority')}</p>
        </div>
        {value.suite === 'skills' ? <p className={css.hint}>{t('returnSkills')}</p> : null}
        {state.changedElsewhere ? <p className={css.problem} role="status">{t('changedElsewhere')}</p> : null}
        {state.edited ? <button type="button" className={css.discard} disabled={state.saving} onClick={props.discard}>{t('discard')}</button> : null}
      </> : null}
    </SettingsForm>
  </section>
}
