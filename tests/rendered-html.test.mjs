import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders complete Voia experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Find the right care, in your voice \| Voia<\/title>/i);
  assert.match(
    html,
    /<meta property="og:image" content="https?:\/\/(?:localhost(?::\d+)?|arya\.health)\/og\.png"/i,
  );
  assert.match(html, /Care starts with/);
  assert.match(html, /being heard/);
  assert.match(html, /Request appointment/);
  assert.match(html, /Protected preview/);
  assert.match(html, /Screening is currently off/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("renders semantic page landmarks", async () => {
  const html = await (await render()).text();
  assert.match(html, /<main>/i);
  assert.match(html, /<header class="site-header">/i);
  assert.match(html, /<nav aria-label="Main navigation">/i);
  assert.match(html, /<h1>/i);
  assert.match(html, /<footer>/i);
});
