import { ROUTES } from '@aitp/protocol';
import type { RouteName } from '@aitp/protocol';

type Infer<S> = S extends { parse(value: unknown): infer T } ? T : never;
export async function api<N extends RouteName>(name: N, options: { params?: Record<string, string>; query?: Record<string, string | number | undefined>; body?: unknown } = {}): Promise<Infer<(typeof ROUTES)[N]['response']>> {
  const route = ROUTES[name];
  let path: string = route.path;
  for (const [key, value] of Object.entries(options.params ?? {})) path = path.replace(`:${key}`, encodeURIComponent(value));
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined) query.set(key, String(value));
  if (query.size) path += '?' + query;
  const response = await fetch(path, { method: route.method, credentials: 'same-origin', ...(options.body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) }) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error?.message ?? `Request failed (${response.status})`);
  if (typeof route.response === 'string') throw new Error('Use a direct download for this resource');
  return route.response.parse(value) as Infer<(typeof ROUTES)[N]['response']>;
}

export const requestId = () => crypto.randomUUID();

export async function authenticate() {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  if (token) {
    await api('authExchange', { body: { token } });
    history.replaceState(null, '', location.pathname + location.search);
  }
}
