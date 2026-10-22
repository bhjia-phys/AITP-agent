import type { Context } from "@earendil-works/chord";
import { defineTask, GenerationTask, LiveDoc } from "@earendil-works/pi-durable";
import type { LiveState, Registry, RegistryReader, TaskId } from "@earendil-works/pi-durable";

/**
 * Pi 1.3.0 ends a round only when every call asks to terminate. ExecutionPort's terminateRun ends the run
 * when any tool requests it (notably a required card). Delegate every native phase and checkpoint unchanged;
 * only the completed tool round's read of controls is widened. Persisted task outcomes remain untouched.
 */
export function executionRegistry(registry: Registry): RegistryReader {
  const native = GenerationTask.definition.phases.tools;
  const tools: typeof native = async (task, runtime, context) => {
    const checkpoint = task.state.checkpoint;
    if (checkpoint.pending.length) return native(task, runtime, context);
    const outcomes = await runtime.outcomes(checkpoint.tools, context);
    const terminate = outcomes.some(outcome => outcome.status === "completed" && outcome.result.kind !== "nested" && outcome.result.control?.terminate);
    if (!terminate) return native(task, runtime, context);
    const ids = new Set<number>(checkpoint.tools);
    const adapted = new Proxy(runtime, {
      get(target, key) {
        if (key === "outcomes") return async (tasks: readonly TaskId[], ctx: Context) => {
          const actual = await target.outcomes(tasks, ctx);
          if (!tasks.every(id => ids.has(id))) return actual;
          return actual.map(outcome => ({ status: "completed", result: {
            ...(outcome.status === "completed" ? outcome.result as object : {}),
            kind: "model", control: { ...(outcome.status === "completed" ? (outcome.result as { control?: object }).control : {}), terminate: true },
          } }));
        };
        if (key === "snapshot") return async (...args: unknown[]) => {
          const reader = Reflect.get(target, key, target) as (...args: unknown[]) => Promise<unknown>;
          const value = await Reflect.apply(reader, target, args);
          // Unavailable calls have result entries but no tool task. Keep those entries in the actual transcript;
          // they do not veto a required decision's termination when Pi computes its all-calls control predicate.
          if (args[0] === LiveDoc && value) return { ...value, tools: (value as LiveState).tools?.filter(slot => slot.taskId !== undefined) };
          return value;
        };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return native(task, adapted, context);
  };
  const generation = defineTask({ ...GenerationTask.definition, phases: { ...GenerationTask.definition.phases, tools } });
  // RegistryReader is the public host-owned resolution boundary. Registry.install itself forbids replacing
  // built-ins; the adapter supplies this reader instead, retaining all original registry publications.
  return {
    subscribe: listener => registry.subscribe(listener),
    snapshot() {
      const snapshot = registry.snapshot();
      return {
        installed: () => snapshot.installed(), extension: name => snapshot.extension(name),
        tools: () => snapshot.tools(), sections: () => snapshot.sections(),
        tasks: () => snapshot.tasks().map(task => task.definition.name === GenerationTask.definition.name ? generation : task),
        task: name => name === GenerationTask.definition.name ? generation : snapshot.task(name),
      };
    },
  };
}
