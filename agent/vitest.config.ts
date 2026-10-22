import { defineConfig } from "vitest/config";

// One test worker at a time: the workstation is shared with editors and other agents (docs/agent/08 §4).
export default defineConfig({
  test: {
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["packages/*/test/**/*.test.ts", "test/integration/**/*.test.ts"],
        },
      },
      "apps/workbench",
    ],
  },
});
