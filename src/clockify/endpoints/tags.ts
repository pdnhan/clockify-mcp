import type { Client } from "../client.js";
import { TagSchema, type Tag } from "../types.js";
import { z } from "zod";

export type ListTagsArgs = { name?: string; archived?: boolean };

export async function listTags(
  client: Client,
  workspaceId: string,
  args: ListTagsArgs = {}
): Promise<Tag[]> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/tags`,
    query: { name: args.name, archived: args.archived }
  });
  return z.array(TagSchema).parse(data);
}
