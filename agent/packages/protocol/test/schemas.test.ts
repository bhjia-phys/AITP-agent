import { describe, expect, it } from "vitest";
import {
  ACTION_TRANSITIONS,
  ActionRecord,
  ActionState,
  canonicalJson,
  checkJsonLimits,
  ContextItem,
  EFFECT_KINDS,
  FrozenRef,
  Grant,
  GrantRequest,
  Hash,
  JsonValue,
  Locator,
  ReviewRequest,
  ROUTES,
  WorkspacePath,
} from "../src/index.ts";

const hash = `sha256:${"a".repeat(64)}`;
const at = "2026-10-21T10:00:00Z";

describe("primitives", () => {
  it("rejects non-finite numbers in JSON values", () => {
    expect(JsonValue.safeParse({ a: [1, { b: null }] }).success).toBe(true);
    expect(JsonValue.safeParse({ a: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(JsonValue.safeParse({ a: Number.NaN }).success).toBe(false);
  });

  it("produces canonical JSON independent of key order", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: null }] })).toBe('{"a":[{"c":null,"d":2}],"b":1}');
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });

  it("reports values beyond the JSON limits, counting encoded bytes", () => {
    let deep: unknown = 1;
    for (let i = 0; i < 70; i++) deep = [deep];
    expect(checkJsonLimits(deep)).toMatch(/nesting/);
    expect(checkJsonLimits({ a: "x".repeat(10) }, { maxDepth: 4, maxBytes: 5 })).toMatch(/larger/);
    expect(checkJsonLimits({ a: Array(40).fill(123456) }, { maxDepth: 4, maxBytes: 100 })).toMatch(/larger/);
    expect(checkJsonLimits({ a: "é".repeat(30) }, { maxDepth: 4, maxBytes: 50 })).toMatch(/larger/);
    expect(checkJsonLimits({ a: [1, 2, 3] })).toBeUndefined();
  });

  it("keeps workspace paths relative and free of '..'", () => {
    expect(WorkspacePath.safeParse("topics/a/research.md").success).toBe(true);
    expect(WorkspacePath.safeParse("/topics/a").success).toBe(false);
    expect(WorkspacePath.safeParse("topics/../secrets").success).toBe(false);
  });
});

describe("references", () => {
  it("rejects inverted line ranges", () => {
    expect(Locator.safeParse({ kind: "lines", start: 5, end: 2 }).success).toBe(false);
  });

  it("retains observed references without requiring a version", () => {
    const ref = { kind: "note", address: { kind: "workspace", path: "topics/a/research.md" } };
    expect(FrozenRef.safeParse(ref).success).toBe(true);
    expect(FrozenRef.safeParse({ ...ref, version: { hash, observedAt: at } }).success).toBe(true);
  });

  it("binds page locators to an edition", () => {
    const ref = { kind: "edition", address: { kind: "artifact", artifact: "a1" }, locator: { kind: "pdf-page", index: 3 } };
    expect(FrozenRef.safeParse(ref).success).toBe(false);
    expect(FrozenRef.safeParse({ ...ref, edition: "e1", artifactHash: hash }).success).toBe(true);
  });

  it("accepts mutable source identities without version gates", () => {
    const web = { kind: "web", address: { kind: "workspace", path: "topics/a/research.md" } };
    expect(FrozenRef.safeParse(web).success).toBe(true);
    expect(FrozenRef.safeParse({ kind: "action", address: { kind: "action", action: "act-1" } }).success).toBe(true);
    expect(FrozenRef.safeParse({ kind: "episode", address: { kind: "episode", episode: "ep-1" } }).success).toBe(true);
  });

  it("keeps regions non-empty and on the page", () => {
    const region = { kind: "region", pdfPage: 1, x: 0.5, y: 0.5, w: 0.4, h: 0.4 };
    expect(Locator.safeParse(region).success).toBe(true);
    expect(Locator.safeParse({ ...region, w: 0.6 }).success).toBe(false);
    expect(Locator.safeParse({ ...region, h: 0 }).success).toBe(false);
  });
});

describe("actions and grants", () => {
  const base = {
    id: "a1", operationId: "op1", kind: "cluster-submit", tool: "submit_job",
    call: { conversation: "c1", toolCallId: "t1" }, argsHash: hash, display: {}, targets: [], session: "s1",
  };

  it("accepts histories that follow the transition table", () => {
    const history = ["proposed", "approved", "reserved", "executing", "interrupted", "uncertain"].map((state) => ({ state, at }));
    expect(ActionRecord.safeParse({ ...base, state: "uncertain", history }).success).toBe(true);
  });

  it("rejects skipped transitions and histories not starting at proposed", () => {
    const skipped = ["proposed", "executing"].map((state) => ({ state, at }));
    expect(ActionRecord.safeParse({ ...base, state: "executing", history: skipped }).success).toBe(false);
    expect(ActionRecord.safeParse({ ...base, state: "approved", history: [{ state: "approved", at }] }).success).toBe(false);
  });

  it("lets uncertain move only to done or failed, and only interrupted move to uncertain", () => {
    expect(ACTION_TRANSITIONS.uncertain).toEqual(["done", "failed"]);
    for (const state of ActionState.options) {
      if (state !== "interrupted") expect(ACTION_TRANSITIONS[state]).not.toContain("uncertain");
    }
  });

  it("treats remote operations and local commits as effects", () => {
    expect(EFFECT_KINDS).toContain("cluster-submit");
    expect(EFFECT_KINDS).toContain("git-commit");
    expect(EFFECT_KINDS).not.toContain("note-write");
  });

  it("requires a version on thread scopes and a binding on once requests", () => {
    const thread = { location: "topics/a/research.md", key: "k", name: "K" };
    const grant = { id: "g2", actions: ["run-read"], source: "researcher", createdAt: at };
    expect(Grant.safeParse({ ...grant, scope: { kind: "thread", thread } }).success).toBe(true);
    expect(Grant.safeParse({ ...grant, scope: { kind: "thread", thread: { ...thread, version: { hash, observedAt: at } } } }).success).toBe(true);
    expect(GrantRequest.safeParse({ actions: ["git-push"], scope: { kind: "once" }, reason: "r" }).success).toBe(true);
  });

  it("allows unbound grants but only the researcher to override", () => {
    const grant = { id: "g1", actions: ["git-push"], source: "researcher", createdAt: at };
    expect(Grant.safeParse({ ...grant, scope: { kind: "once" } }).success).toBe(true);
    expect(Grant.safeParse({ ...grant, scope: { kind: "once" }, bind: { argsHash: hash, targets: [] } }).success).toBe(true);
    expect(Grant.safeParse({ ...grant, source: "plan", scope: { kind: "session", session: "s1" } }).success).toBe(true);
    expect(Grant.safeParse({ ...grant, source: "default", scope: { kind: "workspace" }, overrides: ["analyticOnly"] }).success).toBe(false);
  });
});

describe("context and reviews", () => {
  it("separates data and instruction items", () => {
    const item = { id: "i1", role: "location", ref: { kind: "note", address: { kind: "workspace", path: "a.md" } }, reason: "r", tokens: 1, status: "placed" };
    expect(ContextItem.safeParse({ ...item, channel: "data" }).success).toBe(false);
    expect(ContextItem.safeParse({ ...item, channel: "data", delivery: { requestId: "deliver-0001" } }).success).toBe(true);
    expect(ContextItem.safeParse({ ...item, channel: "instruction" }).success).toBe(false);
  });

  it("requires the whole-session flag on handoff reviews and a change set on restructuring reviews", () => {
    const request = {
      id: "r1", session: "s1", wholeSession: false, status: "queued", mergedFrom: [], createdAt: at,
      ranges: [{ conversation: "c1", to: { conversation: "c1", entry: "5", ordinal: 5 } }],
    };
    expect(ReviewRequest.safeParse({ ...request, signal: "handoff" }).success).toBe(false);
    expect(ReviewRequest.safeParse({ ...request, signal: "handoff", wholeSession: true }).success).toBe(true);
    expect(ReviewRequest.safeParse({ ...request, signal: "restructuring" }).success).toBe(false);
  });
});

describe("route table", () => {
  const routes = Object.entries(ROUTES);

  it("has one route per method and path", () => {
    const keys = routes.map(([, r]) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("declares a params schema for every path parameter", () => {
    for (const [name, r] of routes) {
      const names = [...r.path.matchAll(/:([a-zA-Z]+)/g)].map((m) => m[1]);
      const shape = "params" in r && r.params ? Object.keys((r.params as { shape: object }).shape) : [];
      expect(shape.sort(), name).toEqual(names.sort());
    }
  });

  it("requires a request id on every mutating route", () => {
    for (const [name, r] of routes) {
      if (!r.mutating) continue;
      const body = "body" in r ? r.body : undefined;
      const query = "query" in r ? r.query : undefined;
      const inBody = body !== undefined && body !== "multipart" && "shape" in body && "requestId" in (body as { shape: object }).shape;
      const inQuery = query !== undefined && "shape" in query && "requestId" in (query as { shape: object }).shape;
      expect(inBody || inQuery || body === "multipart", name).toBe(true);
    }
  });
});
