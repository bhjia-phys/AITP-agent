// M1 persists requests and their actual log exports. Reviewer execution and assessments belong to S3-B.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReviewRequest, SessionMeta } from '@aitp/protocol';
import type { Cursor, ReviewRequest as Request } from '@aitp/protocol';
import type { CreateReviewService, CreateTaskShells } from "../contracts.ts";
import { NotImplementedError } from "../not-implemented.ts";
import { all, object, serialByKey, fingerprint } from '../sessions/state.ts';

export const createReviewService: CreateReviewService = (deps, services) => {
  const serial = serialByKey();
  return {
    request: (signal, id, options) => serial(id, async () => {
      const meta = SessionMeta.parse(await deps.port.read.get({ family: 'session', key: id }));
      if (meta.kind === 'review') throw new Error('Reviewer sessions are not reviewed');
      let cutoff: Cursor = { conversation: meta.conversation, entry: '0', ordinal: 0 };
      for await (const entry of deps.port.readLog(meta.conversation)) cutoff = entry.cursor;
      const trigger = deps.hasher.sha256(fingerprint({ signal, id, compaction: options?.compaction ?? null, changeSet: options?.changeSet?.id ?? null, ...(options?.compaction ? {} : { cutoff }) }));
      const binding = { family: 'request' as const, key: `review-trigger:${trigger}` };
      const prior = await deps.port.read.get(binding);
      if (prior) {
        const value = await deps.port.read.get({ family: 'review', key: String(prior.request) });
        return ReviewRequest.parse(value!.request);
      }
      const candidates = await all(deps.port.read, 'review');
      const queued = candidates.find(value => value.kind === 'request' && (value.request as Request).session === id && (value.request as Request).signal === signal && (value.request as Request).status === 'queued' && !options?.changeSet);
      const old = queued ? ReviewRequest.parse(queued.request) : undefined;
      const request = ReviewRequest.parse({ id: old?.id ?? `review:${trigger.slice(7, 39)}`, session: id, signal,
        wholeSession: ['handoff', 'session-end', 'delegation'].includes(signal), ranges: [{ conversation: meta.conversation, to: cutoff }],
        ...(options?.changeSet ? { changeSet: options.changeSet } : {}), status: 'queued', mergedFrom: old ? [...old.mergedFrom, trigger] : [], createdAt: old?.createdAt ?? deps.clock.now().toISOString() });
      const directory = join(deps.dataDir, 'exports'); await mkdir(directory, { recursive: true });
      const path = join(directory, `${request.id.replaceAll(':', '-')}-${trigger.slice(-16)}.jsonl`);
      let exported = ''; for await (const line of services().sessions.export(id)) exported += line;
      await writeFile(path, exported, { mode: 0o600 });
      await deps.port.transact(async tx => {
        await tx.put({ family: 'review', key: request.id }, object({ kind: 'request', request, export: path, execution: 'unavailable-until-S3-B' }));
        await tx.put(binding, { request: request.id });
        await tx.appendAudit(meta.conversation, { type: 'review-request', at: deps.clock.now().toISOString(), request });
      });
      return request;
    }),
    async list(session) {
      const rows = await all(deps.port.read, 'review');
      const requests = rows.filter(row => row.kind === 'request').map(row => ReviewRequest.parse(row.request)).filter(request => !session || request.session === session);
      return { requests, reports: [], assessments: [] };
    },
    async assess() { throw new NotImplementedError('Reviewer execution and assessments require S3-B'); },
    async gate() { return { open: false, reason: 'Independent review execution and assessment are not available yet' }; },
  };
};

export const createReviewTaskShells: CreateTaskShells = () => [];
