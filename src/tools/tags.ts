import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import type { ListTagsArgs } from "../clockify/endpoints/tags.js";
import { listTags } from "../clockify/endpoints/tags.js";

const ListInput = z.object({
  name: z.string().optional(),
  archived: z.boolean().optional(),
  workspaceId: z.string().optional()
});

export function tagTools(ctx: ToolContext): ToolMap {
  return {
    list_tags: {
      name: "list_tags",
      description: "List tags in a workspace.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build args conditionally to satisfy exactOptionalPropertyTypes
        const args: ListTagsArgs = {};
        if (input.name !== undefined) args.name = input.name;
        if (input.archived !== undefined) args.archived = input.archived;
        return listTags(ctx.client, ws, args);
      }
    }
  };
}
