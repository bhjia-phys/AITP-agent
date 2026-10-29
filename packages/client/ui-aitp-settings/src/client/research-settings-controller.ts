/** A staged startup preference and a read-only projection of running plugins. */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResearchPreferences, ResearchStartup } from '../preferences.ts'

/** A usable capability requires every constituent plugin to be enabled and active. */
export type CapabilityState = 'on' | 'off' | 'unavailable'
/** Only the capability projection is retained, never a second plugin inventory. */
export interface RunningResearch {
  sourceAccess: CapabilityState
  workbench: CapabilityState
  literature: CapabilityState
  knowledge: CapabilityState
  code: CapabilityState
  automaticResearch: CapabilityState
}
/** Shared presentation state for this settings page. */
export interface ResearchSettingsState extends SettingsFormShell {
  loading: boolean
  value: ResearchPreferences | undefined
  saved: boolean
  hasSavedPreference: boolean
  edited: boolean
  changedElsewhere: boolean
  running: RunningResearch | undefined
  refreshing: boolean
  inventoryFailed: boolean
}
/** The renderer binds the snapshot; component callbacks only stage or explicitly save. */
export interface ResearchSettingsFace {
  hooks: { researchSettings: SnapshotStore<ResearchSettingsState> }
  editSuite: (suite: ResearchPreferences['suite']) => void
  editLibrary: (library: 'literature' | 'knowledge' | 'code', enabled: boolean) => void
  save: () => void
  discard: () => void
  refresh: () => void
}

function capability(snapshot: PluginInventorySnapshot, modules: readonly string[]): CapabilityState {
  const groups = modules.map(moduleName => snapshot.entries.filter(entry => entry.moduleName === moduleName))
  if (groups.every(rows => rows.some(row => row.enabled && row.fiberPhase === 'active'))) return 'on'
  if (groups.some(rows => rows.some(row => row.enabled && row.fiberPhase !== 'active'))) return 'unavailable'
  return 'off'
}

/**
 * Derive observed capabilities without inferring them from saved preferences.
 * @param snapshot - Current Host inventory observation.
 * @param startup - Automatic Research configuration captured at page load.
 * @returns Independently observed capability states.
 */
export function runningResearch(snapshot: PluginInventorySnapshot, startup: ResearchStartup): RunningResearch {
  const core = ['@deepseek-ai/dsh-research-memory', '@deepseek-ai/dsh-research-resources', '@deepseek-ai/dsh-client-ui-aitp-backend']
  const workbench = capability(snapshot, [...core, '@deepseek-ai/dsh-client-ui-aitp-research'])
  const library = (name: string) => capability(snapshot, [...core, '@deepseek-ai/dsh-client-ui-aitp-materials',
    `@deepseek-ai/dsh-research-${name}`, `@deepseek-ai/dsh-client-ui-aitp-${name}`])
  return { sourceAccess: capability(snapshot, ['@deepseek-ai/dsh-research-memory', '@deepseek-ai/dsh-research-resources']),
    workbench, literature: library('literature'), knowledge: library('knowledge'), code: library('code'),
    automaticResearch: workbench !== 'on' ? workbench : startup.automaticResearch === null ? 'unavailable' : startup.automaticResearch ? 'on' : 'off' }
}

/** Owns draft/revision state only; ConfigForm remains the preference authority. */
export class ResearchSettingsController {
  private readonly store: SnapshotStore<ResearchSettingsState>
  private readonly unsubscribe: () => void
  private draft: { value: ResearchPreferences; revision: number | undefined } | undefined
  private saving = false
  private failed = false
  private saved = false
  private refreshing = false
  private inventoryFailed = false
  private running: RunningResearch | undefined
  private disposed = false

  /**
   * Bind the native profile form and the existing inventory reader.
   * @param form - Native revision-fenced preference authority.
   * @param list - Existing read-only Host inventory endpoint.
   * @param startup - Automatic Research configuration captured at page load.
   */
  constructor(private readonly form: ConfigForm<ResearchPreferences>, private readonly list: () => Promise<PluginInventorySnapshot>,
    private readonly startup: ResearchStartup) {
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = form.subscribe(() => { this.publish() })
  }

  private projection(): ResearchSettingsState {
    const snapshot = this.form.getSnapshot()
    const staged = this.draft?.value
    const accepted = snapshot.value
    const value = staged ?? accepted
    const user = snapshot.user
    const hasSavedPreference = typeof user === 'object' && user !== null &&
      ['suite', 'literature', 'knowledge', 'code'].every(key => Object.hasOwn(user, key))
    const dirty = (!hasSavedPreference && value !== undefined) || staged !== undefined && (this.failed || accepted === undefined ||
      (['suite', 'literature', 'knowledge', 'code'] as const).some(key => staged[key] !== accepted[key]))
    return { loading: snapshot.status === 'loading', available: snapshot.status === 'ready', writable: snapshot.writable,
      dirty, invalid: !snapshot.writable, saving: this.saving, failed: this.failed, saved: this.saved, value,
      hasSavedPreference, edited: staged !== undefined,
      changedElsewhere: this.draft !== undefined && this.draft.revision !== snapshot.revision,
      running: this.running, refreshing: this.refreshing, inventoryFailed: this.inventoryFailed }
  }

  private edit(patch: Partial<ResearchPreferences>): void {
    const current = this.form.getSnapshot()
    if (this.saving || !current.writable || current.status !== 'ready' || !current.value) return
    this.draft = { value: { ...(this.draft?.value ?? current.value), ...patch },
      revision: this.draft === undefined ? current.revision : this.draft.revision }
    this.failed = false
    this.saved = false
    this.publish()
  }

  private async save(): Promise<void> {
    const state = this.projection()
    const current = this.form.getSnapshot()
    const draft = this.draft ?? (current.value ? { value: current.value, revision: current.revision } : undefined)
    if (!draft || !state.available || !state.writable || !state.dirty || this.saving) return
    this.draft = draft
    this.saving = true
    this.failed = false
    this.publish()
    try {
      const value = draft.value
      const accepted = await this.form.mutate([
        { op: 'set', path: ['suite'], value: value.suite },
        { op: 'set', path: ['literature'], value: value.literature },
        { op: 'set', path: ['knowledge'], value: value.knowledge },
        { op: 'set', path: ['code'], value: value.code },
      ], draft.revision)
      this.failed = !accepted
      this.saved = accepted
      if (accepted) this.draft = undefined
    } catch (_error) {
      this.failed = true
    } finally {
      this.saving = false
      this.publish()
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshing || this.disposed) return
    this.refreshing = true
    this.publish()
    try {
      const snapshot = await this.list()
      this.running = runningResearch(snapshot, this.startup)
      this.inventoryFailed = false
    } catch (_error) {
      this.inventoryFailed = true
    } finally {
      this.refreshing = false
      this.publish()
    }
  }

  private publish(): void { if (!this.disposed) this.store.set(this.projection()) }

  /**
   * Provide plain callbacks and the framework-owned snapshot hook source.
   * @returns The slot registration's injected face.
   */
  inject(): ResearchSettingsFace {
    return { hooks: { researchSettings: this.store }, editSuite: (suite) => { this.edit({ suite }) },
      editLibrary: (library, enabled) => { this.edit({ [library]: enabled }) }, save: () => { void this.save() },
      discard: () => { this.draft = undefined; this.failed = false; this.saved = false; this.publish() },
      refresh: () => { void this.refresh() } }
  }

  /** Release the native form subscription and stop publishing late inventory responses. */
  dispose(): void { this.disposed = true; this.unsubscribe() }
}
