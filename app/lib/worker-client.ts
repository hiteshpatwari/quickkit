"use client";

import QuickKitWorker from "../workers/quickkit.worker?worker";
import { diffJson, diffText, formatJson, jsonToTypescript, parseCsv } from "./operations";

type Operation = "format-json" | "json-diff" | "json-to-typescript" | "text-diff" | "parse-csv";
type WorkerResponse<T> = {
  requestId: string;
  success: boolean;
  data?: T;
  error?: string;
  metrics?: { workerMs: number };
};

let worker: Worker | undefined;
let workerUnavailable = false;
const pending = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();

function getWorker() {
  if (workerUnavailable) throw new Error("The background worker is unavailable.");
  if (!worker) {
    try {
      worker = new QuickKitWorker();
    } catch (error) {
      workerUnavailable = true;
      throw error;
    }
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
      workerUnavailable = true;
    };
  }
  return worker;
}

function runInline<T>(requestId: string, operation: Operation, payload: Record<string, unknown>): WorkerResponse<T> {
  const startedAt = performance.now();
  let data: unknown;
  switch (operation) {
    case "format-json":
      data = formatJson(payload.input as string, payload.mode as "format" | "minify", payload.indent as number);
      break;
    case "json-diff":
      data = diffJson(payload.left as string, payload.right as string);
      break;
    case "json-to-typescript":
      data = jsonToTypescript(payload.input as string, payload.options as Parameters<typeof jsonToTypescript>[1]);
      break;
    case "text-diff":
      data = diffText(payload.left as string, payload.right as string, Boolean(payload.ignoreWhitespace));
      break;
    case "parse-csv":
      data = parseCsv(payload.input as string);
      break;
  }
  return {
    requestId,
    success: true,
    data: data as T,
    metrics: { workerMs: performance.now() - startedAt },
  };
}

export async function runToolTask<T>(operation: Operation, payload: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
  const task = new Promise<WorkerResponse<T>>((resolve, reject) => {
    pending.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    try {
      getWorker().postMessage({ requestId, operation, payload });
    } catch (error) {
      pending.delete(requestId);
      reject(error instanceof Error ? error : new Error("The background worker is unavailable."));
    }
  });
  try {
    return await task;
  } catch {
    return runInline<T>(requestId, operation, payload);
  }
}
