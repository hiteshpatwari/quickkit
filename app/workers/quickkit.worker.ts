/// <reference lib="webworker" />

import { diffJson, diffText, formatJson, jsonToTypescript, parseCsv } from "../lib/operations";

type WorkerRequest = {
  requestId: string;
  operation: "format-json" | "json-diff" | "json-to-typescript" | "text-diff" | "parse-csv";
  payload: Record<string, unknown>;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { requestId, operation, payload } = event.data;
  const startedAt = performance.now();
  try {
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
    self.postMessage({ requestId, success: true, data, metrics: { workerMs: performance.now() - startedAt } });
  } catch (error) {
    self.postMessage({
      requestId,
      success: false,
      error: error instanceof Error ? error.message : "The local operation failed.",
      metrics: { workerMs: performance.now() - startedAt },
    });
  }
};

export {};
