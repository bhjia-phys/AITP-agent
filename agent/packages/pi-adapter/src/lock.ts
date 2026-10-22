import { DatabaseSync } from "node:sqlite";

/** Separate lock database: SQLite's OS lock is released on close or SIGKILL. */
export async function lockStorage(path: string): Promise<() => Promise<void>> {
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA busy_timeout = 0; BEGIN EXCLUSIVE");
  } catch {
    database.close();
    throw new Error("Runtime storage is already locked");
  }
  return async () => { database.exec("ROLLBACK"); database.close(); };
}
