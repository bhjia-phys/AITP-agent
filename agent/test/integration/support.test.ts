// The shared test support behaves as the contracts promise.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createFixtureWorkspace, createMemoryState } from "@aitp/test-support";
import { describe, expect, it } from "vitest";

describe("fixture workspace", () => {
  it("copies the fixtures with a valid absolute configuration", async () => {
    const ws = await createFixtureWorkspace();
    try {
      expect(ws.config.workspace.root).toBe(ws.root);
      expect(existsSync(join(ws.root, "topics/research.md"))).toBe(true);
      expect(existsSync(join(ws.root, "knowledge/library/arxiv/2101.00001v2/paper.pdf"))).toBe(true);
      expect(Object.keys(ws.expected)).toContain("threads");
    } finally {
      await ws.cleanup();
    }
  });
});

describe("memory state", () => {
  it("applies a transaction all or nothing", async () => {
    const state = createMemoryState();
    const address = { family: "grant", key: "g1" } as const;
    await state.transact(async (tx) => tx.put(address, { consumed: false }));
    await expect(
      state.transact(async (tx) => {
        await tx.put(address, { consumed: true });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await state.read.get(address)).toEqual({ consumed: false });
  });

  it("serializes transactions so a once-grant is consumed only once", async () => {
    const state = createMemoryState();
    const address = { family: "grant", key: "once" } as const;
    await state.transact(async (tx) => tx.put(address, { consumedBy: null }));
    const consume = (action: string) =>
      state.transact(async (tx) => {
        const grant = await tx.get<{ consumedBy: string | null }>(address);
        if (grant?.consumedBy) return false;
        await new Promise((r) => setTimeout(r, 5));
        await tx.put(address, { consumedBy: action });
        return true;
      });
    const results = await Promise.all([consume("a1"), consume("a2"), consume("a3")]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("rejects every operation on a handle kept after its callback ended", async () => {
    const state = createMemoryState();
    let kept: Parameters<Parameters<typeof state.transact>[0]>[0] | undefined;
    await state.transact(async (tx) => {
      kept = tx;
    });
    await expect(kept!.put({ family: "grant", key: "late" }, { x: 1 })).rejects.toThrow(/after its callback ended/);
    await expect(kept!.get({ family: "grant", key: "late" })).rejects.toThrow(/after its callback ended/);
    expect(await state.read.get({ family: "grant", key: "late" })).toBeUndefined();
  });

  it("starts a task once per request id, and only when the transaction commits", async () => {
    const state = createMemoryState();
    const spec = { shell: "integrate", input: { worker: "w1" }, owner: { task: "ctl-1" }, requestId: "integrate-w1" };
    await expect(
      state.transact(async (tx) => {
        await tx.startTask(spec);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(state.tasks).toHaveLength(0);
    const first = await state.transact((tx) => tx.startTask(spec));
    const second = await state.transact((tx) => tx.startTask(spec));
    expect(second).toBe(first);
    expect(state.tasks).toHaveLength(1);
  });

  it("pages through a family", async () => {
    const state = createMemoryState();
    await state.transact(async (tx) => {
      for (const k of ["a", "b", "c"]) await tx.put({ family: "card", key: k }, { k });
    });
    const first = await state.read.list("card", { limit: 2 });
    expect(first.items.map((i) => i.key)).toEqual(["a", "b"]);
    const second = await state.read.list("card", { after: first.next!, limit: 2 });
    expect(second.items.map((i) => i.key)).toEqual(["c"]);
    expect(second.next).toBeUndefined();
  });
});
