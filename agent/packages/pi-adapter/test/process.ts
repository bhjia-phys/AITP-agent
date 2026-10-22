import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";

export async function child(script: string, args: string[]) {
  const process = spawn(globalThis.process.execPath, [script, ...args], { stdio: "ignore", env: { ...globalThis.process.env, NODE_OPTIONS: "--max-old-space-size=1024" } });
  const done = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => { process.once("error", reject); process.once("exit", (code, signal) => resolve({ code, signal })); });
  void done.catch(() => {});
  return { process, done };
}
export async function marker(path: string, failure?: string) {
  for (let i = 0; i < 500; i++) {
    try { await access(path); return; } catch { /* process has not reached this boundary */ }
    if (failure) { try { const error = await readFile(failure, "utf8"); throw new Error(error); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Child never reached ${path}`);
}
