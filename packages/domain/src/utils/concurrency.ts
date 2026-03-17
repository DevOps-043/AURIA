/**
 * Concurrency utility — Ejecución paralela con límite de concurrencia.
 * Migrado de autodev-package/electron/utils/concurrency.ts.
 */

/**
 * Ejecuta tareas en paralelo con un límite de concurrencia.
 * Cada tarea se identifica por nombre y retorna un resultado tipado.
 */
export async function runParallel<T>(
  tasks: Array<{ name: string; fn: () => Promise<T> }>,
  maxConcurrency: number,
  onTaskDone?: (name: string, result: T) => void,
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const queue = [...tasks];

  const runNext = async (): Promise<void> => {
    const task = queue.shift();
    if (!task) return;
    try {
      const result = await task.fn();
      results.set(task.name, result);
      onTaskDone?.(task.name, result);
    } catch {
      results.set(task.name, [] as unknown as T);
    }
    await runNext();
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => runNext(),
  );
  await Promise.all(workers);
  return results;
}
