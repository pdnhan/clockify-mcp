// tests/integration/smoke.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import nodeHttp from "node:http";
import { passthrough } from "msw";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { startServer, type StartedServer } from "../../src/server.js";

let app: StartedServer;

// Allow all requests to 127.0.0.1 (our real test server) to pass through MSW.
// mockServer.ts registers afterEach(() => server.resetHandlers()) which wipes
// handlers added via server.use(), so we re-register this passthrough before
// each test. The regex matches any URL on the loopback interface.
const localhostPassthrough = http.all(/^http:\/\/127\.0\.0\.1/, () => passthrough());

beforeAll(async () => {
  process.env.CLOCKIFY_API_KEY = "k";
  process.env.CLOCKIFY_WORKSPACE_ID = "wDefault";
  process.env.CLOCKIFY_BASE_URL = "https://api.test/api/v1";
  process.env.CLOCKIFY_REPORTS_BASE_URL = "https://reports.test/v1";
  process.env.PORT = "0"; // ephemeral — allowed after nonnegative() relaxation
  app = await startServer();
});

beforeEach(() => {
  // Re-register the passthrough after each afterEach reset from mockServer.ts.
  server.use(localhostPassthrough);
});

afterAll(async () => { await app.close(); });

/**
 * Parse an SSE response body and return the first `data:` payload as JSON.
 * The MCP StreamableHTTP transport returns SSE-formatted responses when the
 * client Accept header includes `text/event-stream`.
 */
function parseSseJson(text: string): any {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const data = trimmed.slice("data:".length).trim();
      if (data) return JSON.parse(data);
    }
  }
  throw new Error(`No data: line found in SSE body:\n${text}`);
}

async function rpc(body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`http://127.0.0.1:${app.port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  const json = contentType.includes("text/event-stream")
    ? parseSseJson(text)
    : JSON.parse(text);
  return { status: res.status, json };
}

describe("smoke", () => {
  it("GET /health returns 200", async () => {
    const res = await fetch(`http://127.0.0.1:${app.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("tools/list returns 21 tools", async () => {
    const { status, json } = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    });
    expect(status).toBe(200);
    expect(json.result.tools).toHaveLength(21);
  });

  it("tools/call list_workspaces calls the upstream API", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces", () =>
        HttpResponse.json([{ id: "w1", name: "Acme" }])
      )
    );
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_workspaces", arguments: {} }
    });
    const text = json.result.content[0].text as string;
    expect(text).toContain("Acme");
  });

  it("rejects /mcp requests with a foreign Host header (DNS rebinding)", async () => {
    // Node's fetch (undici) rewrites the Host header on the way out, so we
    // drop down to node:http to actually attach Host: evil.com on the wire.
    const status = await new Promise<number>((resolve, reject) => {
      const req = nodeHttp.request({
        host: "127.0.0.1",
        port: app.port,
        path: "/mcp",
        method: "POST",
        headers: {
          Host: "evil.com",
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream"
        }
      }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      });
      req.on("error", reject);
      req.end(JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "tools/list",
        params: {}
      }));
    });
    expect(status).toBe(403);
  });

  it("rejects /mcp requests with a foreign Origin header (DNS rebinding)", async () => {
    const res = await fetch(`http://127.0.0.1:${app.port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Origin": "http://evil.com"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 100,
        method: "tools/list",
        params: {}
      })
    });
    expect(res.status).toBe(403);
  });
});
