// S3 (docs/agent/08 §2). Placeholder from W0; the owning stream replaces the body.
import type { CreateTaskShells, CreateWorkerService } from "../contracts.ts";
import { notImplemented } from "../not-implemented.ts";

export const createWorkerService: CreateWorkerService = () => notImplemented("S3 createWorkerService");

export const createControllerTaskShells: CreateTaskShells = () => [];
