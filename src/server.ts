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

export async function startServer(): Promise<StartedServer> {
  const config = loadConfig();
  const client = createClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    reportsBaseUrl: config.reportsBaseUrl
  });
  const userCache = createUserCache(client);
  const ctx: ToolContext = { client, config, userCache };

  const mcp = new McpServer({ name: "clockify-mcp", version: "0.1.0" });
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

  // Omit sessionIdGenerator to enable stateless mode (it is optional in the SDK).
  // Cast to Transport to satisfy exactOptionalPropertyTypes — the SDK's onclose
  // getter/setter returns `(() => void) | undefined` but the Transport interface
  // declares `onclose?: () => void`; they are structurally identical at runtime.
  const transport = new StreamableHTTPServerTransport({});
  await mcp.connect(transport as unknown as Transport);

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url?.startsWith("/mcp")) {
      transport.handleRequest(req, res).catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(config.port, resolve));

  return {
    http: server,
    port: config.port,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
      await transport.close();
      await mcp.close();
    }
  };
}
