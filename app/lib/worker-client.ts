"use client";

type Operation = "format-json" | "json-diff" | "json-to-typescript" | "text-diff" | "parse-csv";
type WorkerResponse<T> = {
  requestId: string;
  success: boolean;
  data?: T;
  error?: string;
  metrics?: { workerMs: number };
};

let worker: Worker | undefined;
const pending = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("../workers/quickkit.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResponse<unknown>>) => {
      const task = pending.get(event.data.requestId);
      if (!task) return;
      pending.delete(event.data.requestId);
      if (event.data.success) task.resolve(event.data);
      else task.reject(new Error(event.data.error || "The local operation failed."));
    };
    worker.onerror = () => {
      for (const task of pending.values()) task.reject(new Error("The background worker stopped unexpectedly."));
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return worker;
}

export function runToolTask<T>(operation: Operation, payload: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
  const task = new Promise<WorkerResponse<T>>((resolve, reject) => {
    pending.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    getWorker().postMessage({ requestId, operation, payload });
  });
  return task;
}
