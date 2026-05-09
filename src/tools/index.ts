import type { z } from "zod";
import type { Client } from "../clockify/client.js";
import type { Config } from "../config.js";
import type { UserCache } from "../lib/userCache.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";

export type ToolContext = {
  client: Client;
  config: Config;
  userCache: UserCache;
};

export type ToolDef<I extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: I;
  handler(input: z.infer<I>): Promise<unknown>;
};

export type ToolMap = Record<string, ToolDef>;

export function registerToolMaps(server: McpServer, maps: ToolMap[]): void {
  for (const map of maps) {
    for (const tool of Object.values(map)) {
      // inputSchema: AnySchema bridges our generic ToolDef<I> (where I is ZodTypeAny,
      // which satisfies z3.ZodTypeAny) to the SDK's union type.
      // The callback is typed against the same AnySchema so both sides are consistent.
      const inputSchema = tool.inputSchema as unknown as AnySchema;
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema },
        async (input: unknown) => {
          const value = await tool.handler(input as never);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
          };
        }
      );
    }
  }
}
