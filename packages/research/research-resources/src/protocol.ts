/** Pure source-address encoding shared by Host context and browser readers. */
import type { ResourceDomain, ResourceReadRequest, SourceLocator, SourceRef, SourceRootId, SourceId } from './types.ts'

const enc = encodeURIComponent

/**
 * Display a path identity as a readable relative path without granting file access.
 * @param id - provider-owned source identity; virtual drafts and Git views are not paths.
 * @returns a safely decoded root-relative path, or undefined for virtual or malformed identities.
 */
export function materialSourcePath(id: SourceId): string | undefined {
  if (!id.startsWith('source:')) return undefined
  try {
    const path = decodeURIComponent(id.slice(7))
    if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || /^[a-z]:/iu.test(path)
      || path.split('/').some(part => part === '..' || part === '.')) return undefined
    return path
  } catch { return undefined }
}

/**
 * Build a current-source address that retains the requested location.
 * @param ref - root-qualified source identity.
 * @param locator - optional checked source location.
 * @param domain - optional library projection; source identity and permission stay unchanged.
 * @returns the framework resource address, also usable in a Session dock.
 */
export function materialSourceAddress(ref: SourceRef, locator?: SourceLocator, domain?: ResourceDomain): string {
  const params: string[] = []
  if (locator !== undefined) params.push(`location=${enc(JSON.stringify(locator))}`)
  if (domain !== undefined) params.push(`domain=${enc(domain)}`)
  const suffix = params.length === 0 ? '' : `?${params.join('&')}`
  return `dsh-resource://aitp-material-source/root/${enc(ref.rootId)}/source/${enc(ref.sourceId)}${suffix}`
}

/**
 * Address complete authorized preview bytes independently from bounded extracted source text.
 * @param ref - the same root-qualified source identity used by readings and selections.
 * @returns the transient binary resource address; opening it creates no model attachment.
 */
export function materialBytesAddress(ref: SourceRef): string {
  return `dsh-resource://aitp-material-bytes/root/${enc(ref.rootId)}/source/${enc(ref.sourceId)}`
}

/**
 * Validate a native source-byte address without accepting locations or arbitrary filesystem paths.
 * @param address - binary preview resource address.
 * @returns its root-qualified local-file reference, or undefined.
 */
export function parseMaterialBytes(address: string): { readonly ref: SourceRef } | undefined {
  try {
    const url = new URL(address)
    if (url.hostname !== 'aitp-material-bytes' || url.search !== '' || url.hash !== '') return undefined
    url.hostname = 'aitp-material-source'
    const parsed = parseMaterialSource(url.href)
    if (parsed === undefined || materialSourcePath(parsed.ref.sourceId) === undefined) return undefined
    return { ref: parsed.ref }
  } catch { return undefined }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/**
 * Validate a location crossing a URL/parser boundary.
 * @param raw - optional JSON query value.
 * @returns the supported locator, or throws on malformed input.
 */
export function parseMaterialLocator(raw: string | null): SourceLocator | undefined {
  if (raw === null) return undefined
  const value: unknown = JSON.parse(raw)
  const v = record(value)
  const integer = (n: unknown, min = 0): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min
  if (v?.['kind'] === 'anchor' && typeof v['anchor'] === 'string') return { kind: 'anchor', anchor: v['anchor'] }
  if (v?.['kind'] === 'text' && integer(v['start']) && integer(v['end']) && v['end'] > v['start'] && typeof v['quote'] === 'string' && v['end'] - v['start'] === v['quote'].length) return { kind: 'text', start: v['start'], end: v['end'], quote: v['quote'] }
  if (v?.['kind'] === 'code' && integer(v['startLine'], 1) && integer(v['endLine'], 1) && v['endLine'] >= v['startLine'] && (v['revision'] === undefined || typeof v['revision'] === 'string')) return { kind: 'code', startLine: v['startLine'], endLine: v['endLine'], ...v['revision'] === undefined ? {} : { revision: v['revision'] } }
  if (v?.['kind'] === 'pdf-page' && integer(v['page'], 1) && (v['quote'] === undefined || typeof v['quote'] === 'string')) {
    const region = record(v['region'])
    let area: Extract<SourceLocator, { kind: 'pdf-page' }>['region']
    if (v['region'] !== undefined) {
      const fraction = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1
      const x = region?.['x'], y = region?.['y'], width = region?.['width'], height = region?.['height']
      if (!fraction(x) || !fraction(y) || !fraction(width) || !fraction(height) || width <= 0 || height <= 0
        || x + width > 1 || y + height > 1) throw new Error('Invalid PDF selection region')
      area = { x, y, width, height }
    }
    return { kind: 'pdf-page', page: v['page'], ...v['quote'] === undefined ? {} : { quote: v['quote'] },
      ...area === undefined ? {} : { region: area } }
  }
  if (v?.['kind'] === 'git' && (v['view'] === 'status' || v['view'] === 'diff' || v['view'] === 'history') && (v['scope'] === undefined || v['scope'] === 'working-tree' || v['scope'] === 'staged' || v['scope'] === 'commit') && (v['revision'] === undefined || typeof v['revision'] === 'string') && (v['path'] === undefined || typeof v['path'] === 'string')) return { kind: 'git', view: v['view'], ...v['scope'] === undefined ? {} : { scope: v['scope'] }, ...v['revision'] === undefined ? {} : { revision: v['revision'] }, ...v['path'] === undefined ? {} : { path: v['path'] } }
  throw new Error('Invalid source location')
}

/**
 * Parse a source address before using its identifiers in a Remote request.
 * @param address - browser or stored dock address.
 * @returns the root-qualified source and requested location, or undefined.
 */
export function parseMaterialSource(address: string): ResourceReadRequest | undefined {
  try {
    const url = new URL(address)
    const parts = url.pathname.split('/')
    if (url.protocol !== 'dsh-resource:' || url.hostname !== 'aitp-material-source' || parts.length !== 5 || parts[1] !== 'root' || parts[3] !== 'source' || !parts[2] || !parts[4]) return undefined
    const ref = { rootId: decodeURIComponent(parts[2]) as SourceRootId, sourceId: decodeURIComponent(parts[4]) as SourceId }
    if (!ref.rootId || !ref.sourceId || ref.rootId.includes('\0') || ref.sourceId.includes('\0')) return undefined
    const locator = parseMaterialLocator(url.searchParams.get('location'))
    const domain = url.searchParams.get('domain')
    if (domain !== null && domain !== 'knowledge' && domain !== 'literature' && domain !== 'code') return undefined
    const specializedDomain = locator?.kind === 'code' || locator?.kind === 'git' ? 'code'
      : locator?.kind === 'pdf-page' ? 'literature' : undefined
    if (domain !== null && specializedDomain !== undefined && specializedDomain !== domain) return undefined
    return { ref, ...locator === undefined ? {} : { locator }, ...domain === null ? {} : { domain } }
  } catch (_error) { return undefined }
}
