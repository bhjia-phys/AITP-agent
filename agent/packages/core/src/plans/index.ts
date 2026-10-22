import type { Outline, PlanRef, ResourceRef } from '@aitp/protocol';
export function parsePlan(outline: Outline, text: string, ref: ResourceRef): PlanRef {
  const lines = text.split('\n');
  const headings = outline.headings.filter(h => h.level === 2);
  const phases = headings.map((h, i) => ({ title: h.text, span: { startLine: h.line, endLine: (headings[i + 1]?.line ?? lines.length + 1) - 1 } }));
  const operative = phases.findIndex(p => /\boperative\b/i.test(p.title) || /\boperative\b/i.test(lines.slice(p.span.startLine, p.span.endLine).join('\n').match(/\*\*([^*]+)\*\*/)?.[1]?.split(/[.!?]/)[0] ?? ''));
  return { ref, title: outline.title, phases, ...(operative >= 0 ? { operative } : {}) };
}
