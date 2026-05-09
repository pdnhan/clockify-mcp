import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import http from "node:http";

import { loadConfig } from "./config.js";
import { createClient } from "./clockify/client.js";
import { createUserCache } from "./lib/userCache.js";
import { registerToolMaps, type ToolContext } from "./tools/index.js";
import { workspacesTools } from "./tools/workspaces.js";
import { timerTools } from "./tools/timer.js";
import { timeEntryTools } from "./tools/timeEntries.js";
import { projectTools } from "./tools/projects.js";
import { taskTools } from "./tools/tasks.js";
import { tagTools } from "./tools/tags.js";
import { clientTools } from "./tools/clients.js";
import { reportTools } from "./tools/reports.js";

export type StartedServer = {
  http: http.Server;
  port: number;
  close(): Promise<void>;
};

/**
 * Factory: creates a fresh McpServer with all 8 tool maps registered.
 * Called once per /mcp request so each request gets its own isolated server
 * instance (required by SDK 1.29 stateless transport semantics).
 */
function buildMcpServer(ctx: ToolContext): McpServer {
  const mcp = new McpServer({ name: "clockify-mcp", version: "0.1.1" });
  registerToolMaps(mcp, [
    workspacesTools(ctx),
    timerTools(ctx),
    timeEntryTools(ctx),
    projectTools(ctx),
    taskTools(ctx),
    tagTools(ctx),
    clientTools(ctx),
    reportTools(ctx)
  ]);
  return mcp;
}

/** Returns true when the URL targets the /mcp endpoint (exact, sub-path, or query string). */
function isMcpUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url === "/mcp" || url.startsWith("/mcp/") || url.startsWith("/mcp?");
}

export async function startServer(): Promise<StartedServer> {
  const config = loadConfig();
  const client = createClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    reportsBaseUrl: config.reportsBaseUrl
  });
  const userCache = createUserCache(client);
  const ctx: ToolContext = { client, config, userCache };

  // Captured by the request handler so the DNS-rebinding allowlist always
  // matches the *actually bound* port. config.port may be 0 (ephemeral) when
  // tests ask the OS to pick a free port; the real port is only known after
  // server.listen() returns.
  let boundPort = config.port;

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (isMcpUrl(req.url)) {
      // Create a fresh transport + McpServer per request — SDK 1.29 stateless
      // mode throws "Stateless transport cannot be reused across requests" if the
      // same transport instance handles more than one request.
      //
      // DNS-rebinding protection: a malicious page on `evil.com` can rebind to
      // 127.0.0.1 and POST to /mcp. The SDK validates Host + Origin headers
      // against the allowlists below when enableDnsRebindingProtection is true.
      // Allowlist matches the bound port — both 127.0.0.1 and localhost forms.
      //
      // Cast to Transport to satisfy exactOptionalPropertyTypes: the SDK's
      // onclose getter returns `(() => void) | undefined` while Transport
      // declares `onclose?: () => void`; they are structurally identical at
      // runtime but differ in the TS optional-property encoding.
      const transport = new StreamableHTTPServerTransport({
        enableDnsRebindingProtection: true,
        allowedHosts: [
          `127.0.0.1:${boundPort}`,
          `localhost:${boundPort}`
        ],
        allowedOrigins: [
          `http://127.0.0.1:${boundPort}`,
          `http://localhost:${boundPort}`
        ]
      });
      const mcp = buildMcpServer(ctx);

      // Tear down both objects as soon as the response stream closes,
      // regardless of whether the handler finished normally or errored.
      res.on("close", () => {
        void transport.close();
        void mcp.close();
      });

      mcp
        .connect(transport as unknown as Transport)
        .then(() => transport.handleRequest(req, res))
        .catch((err) => {
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(config.port, resolve));

  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : config.port;
  // Update the closure used by the request handler so the rebinding allowlist
  // includes the ephemeral port the OS picked.
  boundPort = actualPort;

  return {
    http: server,
    port: actualPort,
    async close() {
      // Per-request transports/servers are cleaned up via res.on("close") in
      // their own handlers; only the HTTP server needs explicit shutdown here.
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  };
}
