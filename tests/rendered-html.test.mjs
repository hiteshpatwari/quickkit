import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the QuickKit product home", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>QuickKit/);
  assert.match(html, /Tiny tools\./);
  assert.match(html, /Zero unnecessary uploads\./);
  assert.match(html, /Your browser is the backend/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps privacy boundaries explicit in source", async () => {
  const [page, layout, workerClient, storageAudit] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/worker-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/privacy.md", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<HomePage \/>/);
  assert.match(layout, /AppChrome/);
  assert.match(workerClient, /new Worker/);
  assert.match(storageAudit, /quickkit\.theme/);
  assert.match(storageAudit, /JWT content is never persisted/);
});
