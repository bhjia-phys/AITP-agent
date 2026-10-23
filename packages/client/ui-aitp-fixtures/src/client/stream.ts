/** Address parsing and frame streams for the fixture providers. */
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/**
 * The path segment after `key` in a resource address.
 * @param address - a `dsh-resource://` address.
 * @param key - the segment name preceding the value.
 * @returns the decoded value, or undefined.
 */
export function segmentAfter(address: string, key: string): string | undefined {
  const value = new RegExp(`/${key}/([^/]+)`, 'u').exec(address)?.[1]
  return value === undefined ? undefined : decodeURIComponent(value)
}

/**
 * One frame, then hold the stream open until the resource is released.
 * @param frame - the frame to yield.
 * @param signal - release signal.
 * @yields the frame.
 * @returns the stream, which ends once `signal` aborts.
 */
export async function* hold<T>(frame: RemoteResult<T>, signal: AbortSignal): AsyncIterable<RemoteResult<T>> {
  yield frame
  if (signal.aborted) return
  await new Promise<void>((resolve) => { signal.addEventListener('abort', () => { resolve() }, { once: true }) })
}
