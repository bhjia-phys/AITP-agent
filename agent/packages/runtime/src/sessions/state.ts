import { requestBody, sameRequestBody } from "@aitp/protocol";
import type { JsonObject, JsonValue } from "@aitp/protocol";
import type { StateFamily, StateReader } from "../contracts.ts";

export const json = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
export const object = (value: unknown): JsonObject => json(value) as JsonObject;
export const fingerprint = (value: unknown) => requestBody(object(value));
export const sameRequest = sameRequestBody;
export function requestReused(): never { throw Object.assign(new Error("Request id was reused with a different body"), { code: "request_reused" }); }
export async function all<T extends JsonObject>(reader: StateReader, family: StateFamily): Promise<T[]> {
  const values: T[] = []; let after: string | undefined;
  do { const page = await reader.list<T>(family, { after, limit: 200 }); values.push(...page.items.map(i => i.value)); after = page.next; } while (after);
  return values;
}
/** Serialize same-session preparation through admission; there are no external effects in state callbacks. */
export function serialByKey() {
  const lines = new Map<string, Promise<unknown>>();
  return <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const next = (lines.get(key) ?? Promise.resolve()).then(work);
    const settled = next.catch(() => {}); lines.set(key, settled);
    void settled.finally(() => { if (lines.get(key) === settled) lines.delete(key); }); return next;
  };
}
export const asJson = (value: unknown) => json(value) as JsonValue;
