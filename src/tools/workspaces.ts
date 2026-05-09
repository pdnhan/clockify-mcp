import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import { listWorkspaces } from "../clockify/endpoints/workspaces.js";

export function workspacesTools(ctx: ToolContext): ToolMap {
  return {
    get_current_user: {
      name: "get_current_user",
      description: "Return the Clockify user authenticated by CLOCKIFY_API_KEY.",
      inputSchema: z.object({}),
      async handler() {
        return ctx.userCache.get();
      }
    },
    list_workspaces: {
      name: "list_workspaces",
      description: "List all workspaces the authenticated user belongs to.",
      inputSchema: z.object({}),
      async handler() {
        return listWorkspaces(ctx.client);
      }
    }
  };
}
