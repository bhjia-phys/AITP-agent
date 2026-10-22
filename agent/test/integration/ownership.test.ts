// Every file under agent/ has exactly one owner (streams.json; docs/agent/08 §2).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const AGENT = fileURLToPath(new URL("../../", import.meta.url));
const SKIP = new Set(["node_modules", "dist", ".vite", "coverage", ".local"]);
const SKIP_PATHS = new Set(["apps/workbench/e2e/screenshots"]);

export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      out += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") out += "[^/]*";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      out += `(?:${glob.slice(i + 1, end).split(",").map((s) => s.replace(/[.+^$()|[\]\\]/g, "\\$&")).join("|")})`;
      i = end;
    } else out += c.replace(/[.+?^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    const rel = relative(AGENT, path);
    if (SKIP_PATHS.has(rel)) continue;
    if (entry.isDirectory()) out.push(...files(path));
    else out.push(rel);
  }
  return out;
}

const manifest = JSON.parse(readFileSync(join(AGENT, "streams.json"), "utf8")) as Record<string, string[] | string>;
const owners = Object.entries(manifest)
  .filter(([key]) => !key.startsWith("$"))
  .map(([stream, globs]) => ({ stream, patterns: (globs as string[]).map(globToRegExp) }));

export function ownersOf(path: string): string[] {
  const matching = owners.filter((o) => o.patterns.some((p) => p.test(path))).map((o) => o.stream);
  return matching.includes("S1") ? ["S1"] : matching;
}

describe("path ownership", () => {
  it("matches globs as documented", () => {
    expect(globToRegExp("packages/*/src/index.ts").test("packages/core/src/index.ts")).toBe(true);
    expect(globToRegExp("packages/core/src/{a,b}/**").test("packages/core/src/b/x/y.ts")).toBe(true);
    expect(globToRegExp("apps/workbench/**").test("apps/workbench/src/main.tsx")).toBe(true);
    expect(globToRegExp("notes/S2-*.md").test("notes/S2-A.md")).toBe(true);
  });

  it("gives every file exactly one owner", () => {
    const problems = files(AGENT)
      .map((path) => ({ path, owners: ownersOf(path) }))
      .filter((f) => f.owners.length !== 1);
    expect(problems).toEqual([]);
  });

  it("keeps the S1 wiring files with S1", () => {
    for (const path of [
      "packages/runtime/src/contracts.ts",
      "packages/server/src/compose.ts",
      "packages/pi-adapter/src/index.ts",
      "apps/workbench/package.json",
    ]) {
      expect(ownersOf(path), path).toEqual(["S1"]);
    }
    expect(ownersOf("packages/pi-adapter/src/port.ts")).toEqual(["S3"]);
    expect(ownersOf("packages/server/src/app.ts")).toEqual(["S4"]);
    expect(ownersOf("apps/workbench/src/main.tsx")).toEqual(["S6"]);
  });
});
