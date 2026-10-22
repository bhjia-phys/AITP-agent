import type { Outline, ResearchLocation, ThreadRow } from '@aitp/protocol';
import type { BoardFilter } from '../contracts.ts';

export function boardRows(locations: ResearchLocation[], outlines: Map<string, Outline>, filter?: BoardFilter): ThreadRow[] {
  return locations
    .filter(owner => (!filter?.owner || owner.id === filter.owner) && (!filter?.grouping || owner.groupings.includes(filter.grouping)))
    .flatMap(owner => (outlines.get(owner.id)?.currentWork?.entries ?? []).map(entry => {
      const grouping = filter?.grouping ?? owner.groupings[0];
      return { ...entry, ownerTitle: owner.title, ownerKind: owner.kind, ...(grouping ? { grouping } : {}) };
    }))
    .filter(row => !filter?.state || row.state === filter.state);
}
