import { createFixtureWorkspace } from '@aitp/test-support';
import { nodeHasher, systemClock } from '../../src/compose.ts';
import { createWorkspaceFs } from '../../src/paths/index.ts';
import { createDerivedIndex } from '../../src/index/index.ts';
import { createWorkspaceModel } from '../../src/locations/index.ts';
export async function fixture() {
  const ws = await createFixtureWorkspace();
  const deps = { config: ws.config, dataDir: ws.dataDir, clock: systemClock, hasher: nodeHasher };
  const fs = createWorkspaceFs(deps);
  const index = createDerivedIndex({ ...deps, fs });
  return { ...ws, deps, fs, index, workspace: createWorkspaceModel({ ...deps, fs, index }) };
}
