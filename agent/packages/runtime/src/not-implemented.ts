// S1: a stand-in for a service its stream has not implemented yet. Composition succeeds; any use throws a
// `NotImplementedError` naming what is missing. Placeholders return it so that partial systems can start
// (docs/agent/08 §3), and callers can report an unavailable source instead of failing. The error is
// recognized by its `code`, so errors from the core's stand-ins are recognized too.
export class NotImplementedError extends Error {
  readonly code = "not_implemented";
}

export function isNotImplemented(error: unknown): boolean {
  return error instanceof Error && (error as { code?: unknown }).code === "not_implemented";
}

export function notImplemented<T extends object>(what: string): T {
  const fail = (path: string) => () => {
    throw new NotImplementedError(`not implemented: ${path}`);
  };
  const member = (path: string): unknown =>
    new Proxy(fail(path), {
      get: (_target, property) => (property === "then" || typeof property === "symbol" ? undefined : member(`${path}.${String(property)}`)),
    });
  return new Proxy({} as T, {
    get: (_target, property) => (property === "then" || typeof property === "symbol" ? undefined : member(`${what}.${String(property)}`)),
  });
}
