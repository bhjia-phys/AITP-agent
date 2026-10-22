// An in-memory implementation of the runtime state contract for unit tests: transactions are serialized and
// all-or-nothing like the real port's, and a handle rejects every operation once its callback has ended.
import type { AuditEvent, JsonObject } from "@aitp/protocol";
import type { StateAddress, StateFamily, StateReader, StateTransaction, TaskStart, Transact } from "@aitp/runtime/contracts";

export type MemoryState = {
  transact: Transact;
  read: StateReader;
  /** Audit entries appended by committed transactions, in order. */
  audit: { conversation: string; event: AuditEvent }[];
  /** Tasks started by committed transactions; the id derives from the request id, so a repeat returns it. */
  tasks: { id: string; spec: TaskStart }[];
};

const keyOf = (a: StateAddress) => `${a.family}\u0000${a.key}`;

export function createMemoryState(): MemoryState {
  let docs = new Map<string, JsonObject>();
  const audit: { conversation: string; event: AuditEvent }[] = [];
  const tasks: { id: string; spec: TaskStart }[] = [];
  let chain: Promise<unknown> = Promise.resolve();

  const reader = (source: () => Map<string, JsonObject>): StateReader => ({
    async get<T extends JsonObject>(address: StateAddress) {
      const value = source().get(keyOf(address));
      return value === undefined ? undefined : (structuredClone(value) as T);
    },
    async list<T extends JsonObject>(family: StateFamily, options: { prefix?: string; after?: string; limit?: number } = {}) {
      const prefix = `${family}\u0000${options.prefix ?? ""}`;
      const after = options.after === undefined ? undefined : `${family}\u0000${options.after}`;
      const keys = [...source().keys()].filter((k) => k.startsWith(prefix) && (after === undefined || k > after)).sort();
      const limit = options.limit ?? 100;
      const items = keys
        .slice(0, limit)
        .map((k) => ({ key: k.slice(family.length + 1), value: structuredClone(source().get(k)) as T }));
      return keys.length > limit ? { items, next: items[items.length - 1]!.key } : { items };
    },
  });

  const transact: Transact = (change) => {
    const run = chain.then(async () => {
      const working = new Map([...docs].map(([k, v]) => [k, structuredClone(v)]));
      const appended: { conversation: string; event: AuditEvent }[] = [];
      const started: { id: string; spec: TaskStart }[] = [];
      let active = true;
      const check = () => {
        if (!active) throw new Error("transaction handle used after its callback ended");
      };
      const inner = reader(() => working);
      const tx: StateTransaction = {
        async get<T extends JsonObject>(address: StateAddress) {
          check();
          return inner.get<T>(address);
        },
        async list<T extends JsonObject>(family: StateFamily, options?: { prefix?: string; after?: string; limit?: number }) {
          check();
          return inner.list<T>(family, options);
        },
        async put(address, value) {
          check();
          working.set(keyOf(address), structuredClone(value));
        },
        async delete(address) {
          check();
          working.delete(keyOf(address));
        },
        async appendAudit(conversation, event) {
          check();
          appended.push({ conversation, event: structuredClone(event) });
        },
        async startTask(spec) {
          check();
          const existing = [...tasks, ...started].find((t) => t.spec.requestId === spec.requestId);
          if (existing) return existing.id;
          const id = `task-${spec.requestId}`;
          started.push({ id, spec: structuredClone(spec) });
          return id;
        },
      };
      try {
        const result = await change(tx);
        docs = working;
        audit.push(...appended);
        tasks.push(...started);
        return result;
      } finally {
        active = false;
      }
    });
    chain = run.catch(() => undefined);
    return run;
  };

  return { transact, read: reader(() => docs), audit, tasks };
}
