// Package dependency rules (docs/agent/02, packages): Pi is isolated in pi-adapter, Zod in protocol, and the
// workbench sees only the protocol. Relative imports never leave their package.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const AGENT = fileURLToPath(new URL("../../", import.meta.url));

type Pkg = "protocol" | "core" | "runtime" | "pi-adapter" | "server" | "workbench";
const ROOTS: Record<Pkg, string> = {
  protocol: "packages/protocol/src",
  core: "packages/core/src",
  runtime: "packages/runtime/src",
  "pi-adapter": "packages/pi-adapter/src",
  server: "packages/server/src",
  workbench: "apps/workbench/src",
};

/** Workspace imports each package may make; `type-only` ones must use `import type` or `export type`. */
const ALLOWED: Record<Pkg, { value: string[]; typeOnly: string[] }> = {
  protocol: { value: [], typeOnly: [] },
  core: { value: ["@aitp/protocol"], typeOnly: [] },
  runtime: { value: ["@aitp/protocol"], typeOnly: ["@aitp/core/contracts"] },
  "pi-adapter": { value: ["@aitp/protocol"], typeOnly: ["@aitp/runtime/contracts"] },
  server: {
    value: ["@aitp/protocol", "@aitp/core", "@aitp/runtime", "@aitp/pi-adapter"],
    typeOnly: ["@aitp/core/contracts", "@aitp/runtime/contracts"],
  },
  workbench: { value: ["@aitp/protocol"], typeOnly: [] },
};

type Import = { file: string; specifier: string; typeOnly: boolean };

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

function imports(file: string): Import[] {
  const text = readFileSync(file, "utf8");
  const found: Import[] = [];
  const statement = /^\s*(import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm;
  for (const m of text.matchAll(statement)) found.push({ file, specifier: m[3]!, typeOnly: Boolean(m[2]) });
  for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) found.push({ file, specifier: m[1]!, typeOnly: false });
  return found;
}

/** The problem with one import of a file in `pkg`, or undefined when it is allowed. */
function checkImport(pkg: Pkg, file: string, { specifier, typeOnly }: Import): string | undefined {
  const packageRoot = dirname(join(AGENT, ROOTS[pkg]));
  const where = `${relative(AGENT, file)}: ${specifier}`;
  if (specifier.startsWith(".")) {
    return resolve(dirname(file), specifier).startsWith(packageRoot + "/") ? undefined : `${where} leaves its package`;
  }
  if (specifier.startsWith("@earendil-works/") && pkg !== "pi-adapter") return `${where} imports Pi outside pi-adapter`;
  if ((specifier === "zod" || specifier.startsWith("zod/")) && pkg !== "protocol") return `${where} imports zod outside protocol`;
  if (specifier.startsWith("node:") && (pkg === "protocol" || pkg === "workbench")) return `${where} imports a Node builtin in browser code`;
  if (specifier.startsWith("@aitp/")) {
    const allowed = ALLOWED[pkg];
    if (allowed.value.includes(specifier)) return undefined;
    if (allowed.typeOnly.includes(specifier)) return typeOnly ? undefined : `${where} must be a type-only import`;
    return `${where} is not an allowed dependency of ${pkg}`;
  }
  return undefined;
}

function violations(pkg: Pkg): string[] {
  const problems: string[] = [];
  for (const file of sources(join(AGENT, ROOTS[pkg]))) {
    for (const imp of imports(file)) {
      const problem = checkImport(pkg, file, imp);
      if (problem) problems.push(problem);
    }
  }
  return problems;
}

describe("import boundaries", () => {
  for (const pkg of Object.keys(ROOTS) as Pkg[]) {
    it(`${pkg} imports only what it may`, () => {
      expect(violations(pkg)).toEqual([]);
    });
  }

  it("finds imports in source text", () => {
    expect(imports(fileURLToPath(import.meta.url)).some((i) => i.specifier === "vitest")).toBe(true);
  });

  it("flags each kind of violation", () => {
    const file = (pkg: Pkg, name: string) => join(AGENT, ROOTS[pkg], name);
    const imp = (specifier: string, typeOnly = false): Import => ({ file: "", specifier, typeOnly });
    expect(checkImport("runtime", file("runtime", "a.ts"), imp("@earendil-works/pi-durable"))).toMatch(/Pi outside/);
    expect(checkImport("core", file("core", "a.ts"), imp("zod"))).toMatch(/zod outside/);
    expect(checkImport("workbench", file("workbench", "a.ts"), imp("node:fs"))).toMatch(/Node builtin/);
    expect(checkImport("pi-adapter", file("pi-adapter", "a.ts"), imp("@aitp/runtime/contracts"))).toMatch(/type-only/);
    expect(checkImport("pi-adapter", file("pi-adapter", "a.ts"), imp("@aitp/runtime/contracts", true))).toBeUndefined();
    expect(checkImport("core", file("core", "a.ts"), imp("@aitp/runtime"))).toMatch(/not an allowed dependency/);
    expect(checkImport("core", file("core", "x/a.ts"), imp("../../../runtime/src/compose.ts"))).toMatch(/leaves its package/);
    expect(checkImport("core", file("core", "x/a.ts"), imp("../contracts.ts"))).toBeUndefined();
  });
});
