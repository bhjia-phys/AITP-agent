// A private copy of the synthetic fixture workspace with an absolute, valid configuration.
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Config } from "@aitp/protocol";

const FIXTURE = fileURLToPath(new URL("../../fixtures/workspace", import.meta.url));

export type FixtureWorkspace = {
  /** The workspace root (contains topics/, knowledge/, aitp/, external-skills/). */
  root: string;
  /** A fresh runtime data directory (`AITP_AGENT_HOME`). */
  dataDir: string;
  config: Config;
  /** What the research core must extract from the fixtures (fixtures/workspace/expected.json). */
  expected: Record<string, unknown>;
  /** Absolute path of the libdemo checkout. */
  checkout: string;
  cleanup(): Promise<void>;
};

/**
 * Copies the fixture workspace to a temporary directory. With `git: true`, the libdemo checkout becomes a git
 * repository with one commit, and `src/screen.cpp` is then modified so the working tree is dirty.
 */
export async function createFixtureWorkspace(options: { git?: boolean } = {}): Promise<FixtureWorkspace> {
  const base = await mkdtemp(join(tmpdir(), "aitp-fixture-"));
  const root = join(base, "workspace");
  const dataDir = join(base, "data");
  await cp(FIXTURE, root, { recursive: true });
  const raw = JSON.parse(await readFile(join(root, "config.fixture.json"), "utf8")) as Record<string, any>;
  const abs = (p: string) => join(root, p);
  const config = Config.parse({
    ...raw,
    workspace: {
      ...raw.workspace,
      root,
      topicsRoot: abs(raw.workspace.topicsRoot),
      knowledgeRoot: abs(raw.workspace.knowledgeRoot),
      extraReadRoots: (raw.workspace.extraReadRoots as string[]).map(abs),
    },
    aitp: { ...raw.aitp, checkout: abs(raw.aitp.checkout), extraSkillRoots: (raw.aitp.extraSkillRoots as string[]).map(abs) },
  });
  const checkout = abs("topics/spectra/workspace/development/libdemo");
  if (options.git) {
    const run = (...args: string[]) => execFileSync("git", args, { cwd: checkout, stdio: "ignore" });
    run("init", "-q", "-b", "main");
    run("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "add", ".");
    run("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", "fixture");
    const file = join(checkout, "src/screen.cpp");
    const text = await readFile(file, "utf8");
    await writeFile(file, text.replace("eps / (q * q + 1.0)", "eps / (q * q + 2.0)"));
  }
  const expected = JSON.parse(await readFile(join(root, "expected.json"), "utf8")) as Record<string, unknown>;
  return { root, dataDir, config, expected, checkout, cleanup: () => rm(base, { recursive: true, force: true }) };
}
