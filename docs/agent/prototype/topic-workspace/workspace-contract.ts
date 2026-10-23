/**
 * The application contract now lives beside the formal research client.
 * This type-only reference keeps the original design link useful without a
 * second schema copy. The standalone HTML still uses its own scenario data.
 *
 * Backend browser adapters consume these types through the research package's
 * /client entry and register with ctx.researchWorkspaces. See the package README.
 */
export type * from '../../../../packages/client/ui-aitp-research/src/client/workspace-contract.ts'
