// S1: the server surface the composition root calls (docs/agent/02, 07).
import type { RuntimeServices } from "@aitp/runtime/contracts";

export type HttpServerOptions = {
  host: "127.0.0.1";
  port: number;
  dataDir: string;
  /** The built workbench, served as static files. */
  staticDir?: string;
  faux: boolean;
  version: string;
  configPath?: string;
  profile?: 'full' | 'read-only';
};

export type HttpServer = {
  listen(): Promise<{ port: number; url: string }>;
  close(): Promise<void>;
};

export type CreateHttpServer = (services: RuntimeServices, options: HttpServerOptions) => HttpServer; // S4: app.ts
