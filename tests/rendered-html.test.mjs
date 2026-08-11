import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost/"), {
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
  const [page, layout, workerClient, storageAudit, appChrome] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/worker-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/privacy.md", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AppChrome.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<HomePage \/>/);
  assert.match(layout, /AppChrome/);
  assert.match(workerClient, /new QuickKitWorker/);
  assert.match(workerClient, /quickkit\.worker\?worker/);
  assert.doesNotMatch(workerClient, /new URL\([^)]*import\.meta\.url/);
  assert.match(workerClient, /runInline/);
  assert.match(storageAudit, /quickkit\.theme/);
  assert.match(storageAudit, /JWT content is never persisted/);
  assert.match(appChrome, /quickkit\.favorites/);
});

test("renders durable navigation anchors for every primary destination", async () => {
  const response = await render();
  const html = await response.text();
  for (const href of ["/", "/favorites", "/about", "/settings", "/privacy", "/about#architecture"]) {
    assert.match(html, new RegExp(`href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`));
  }

  const navigationSources = await Promise.all([
    "AppChrome.tsx",
    "ToolCard.tsx",
    "ToolWorkspace.tsx",
    "FavoritesPage.tsx",
  ].map((file) => readFile(new URL(`../app/components/${file}`, import.meta.url), "utf8")));
  assert.doesNotMatch(navigationSources.join("\n"), /next\/link|router\.push/);
  assert.match(navigationSources[0], /window\.location\.assign/);
});

test("serves every reported destination and an origin-relative worker", async () => {
  for (const route of ["/", "/favorites", "/about", "/settings", "/privacy", "/tools/json-formatter"]) {
    const response = await render(route);
    assert.equal(response.status, 200, `${route} should render successfully`);
  }

  const staticDirectory = new URL("../dist/client/_next/static/", import.meta.url);
  const staticFiles = await readdir(staticDirectory);
  assert.ok(staticFiles.some((file) => /^quickkit\.worker-[\w-]+\.js$/.test(file)), "worker asset should be emitted");

  const chunkDirectory = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunkFiles = (await readdir(chunkDirectory)).filter((file) => file.endsWith(".js"));
  const chunks = (await Promise.all(chunkFiles.map((file) => readFile(new URL(file, chunkDirectory), "utf8")))).join("\n");
  assert.match(chunks, /new Worker\(`\/_next\/static\/quickkit\.worker-/);
  assert.doesNotMatch(chunks, /file:\/\/\/_next\/static\/quickkit\.worker-/);
});
