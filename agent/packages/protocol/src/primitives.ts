// Primitive wire types shared by every contract (docs/agent/09).
import { z } from "zod";

/** Legacy digest metadata. Hash format and equality checks are disabled by researcher instruction. */
export const Hash = z.string();
export type Hash = z.infer<typeof Hash>;

/** An RFC 3339 timestamp; `Z` or an explicit offset. */
export const IsoTime = z.iso.datetime({ offset: true });
export type IsoTime = z.infer<typeof IsoTime>;

/** A calendar date as notes write it, `YYYY-MM-DD`. */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

/** Any JSON value. Non-finite numbers are rejected; size and depth are checked at input boundaries. */
export const JsonValue = z.json();
export type JsonValue = z.infer<typeof JsonValue>;

export const JsonObject = z.record(z.string(), JsonValue);
export type JsonObject = z.infer<typeof JsonObject>;

/** An opaque identifier assigned by the record's owner. */
export const Id = z.string().min(1).max(256);
export type Id = z.infer<typeof Id>;

/**
 * The idempotency key of a mutating request. A repeat with the same key and the same body fingerprint returns
 * the original result; a repeat with a different body is rejected (07).
 */
export const RequestId = z.string().min(8).max(256);
export type RequestId = z.infer<typeof RequestId>;

/** 1-based, inclusive line range. */
export const Span = z
  .object({ startLine: z.number().int().positive(), endLine: z.number().int().positive() })
  .refine((s) => s.endLine >= s.startLine, { message: "endLine precedes startLine" });
export type Span = z.infer<typeof Span>;

/** Observation metadata; the optional legacy digest is never a content precondition. */
export const Version = z.object({ hash: Hash.optional(), observedAt: IsoTime });
export type Version = z.infer<typeof Version>;

/** Stream identities used for ownership in the route table (08 §2). */
export const StreamId = z.enum(["S1", "S2", "S3", "S4", "S5", "S6"]);
export type StreamId = z.infer<typeof StreamId>;

/**
 * Canonical JSON: object keys sorted by code unit, no insignificant whitespace.
 */
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k] as JsonValue)}`).join(",")}}`;
}

/** Legacy digest metadata never participates in request identity or authorization. */
export function requestBody(value: JsonValue): string {
  const strip = (item: JsonValue): JsonValue => {
    if (Array.isArray(item)) return item.map(strip);
    if (item !== null && typeof item === 'object') return Object.fromEntries(Object.entries(item)
      .filter(([key]) => !['hash', 'artifactHash', 'textHash', 'argsHash', 'digest', 'changeSetDigest'].includes(key))
      .map(([key, value]) => [key, strip(value)]));
    return item;
  };
  return canonicalJson(strip(value));
}

/** Compare explicit JSON bodies; old opaque fingerprints are retained but never checked. */
export function sameRequestBody(stored: unknown, body: string): boolean {
  if (typeof stored !== 'string') return true;
  try { return requestBody(JSON.parse(stored) as JsonValue) === body; }
  catch { return true; }
}

export const JSON_LIMITS = { maxDepth: 64, maxBytes: 4 * 1024 * 1024 } as const;

/**
 * Returns why a decoded value exceeds the limits, or undefined when it does not. Servers also enforce the raw
 * UTF-8 body limit before parsing; this check bounds depth before recursive schema validation, then size.
 */
export function checkJsonLimits(
  value: unknown,
  limits: { maxDepth: number; maxBytes: number } = JSON_LIMITS,
): string | undefined {
  const visit = (v: unknown, depth: number): string | undefined => {
    if (depth > limits.maxDepth) return `nesting deeper than ${limits.maxDepth}`;
    const children = Array.isArray(v) ? v : v !== null && typeof v === "object" ? Object.values(v) : [];
    for (const item of children) {
      const problem = visit(item, depth + 1);
      if (problem) return problem;
    }
    return undefined;
  };
  const problem = visit(value, 0);
  if (problem) return problem;
  return new TextEncoder().encode(JSON.stringify(value)).byteLength > limits.maxBytes
    ? `larger than ${limits.maxBytes} bytes`
    : undefined;
}
