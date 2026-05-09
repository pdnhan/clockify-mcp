import type { Client } from "../client.js";
import { WorkspaceSchema, type Workspace } from "../types.js";
import { z } from "zod";

export async function listWorkspaces(client: Client): Promise<Workspace[]> {
  const data = await client.request({ host: "api", method: "GET", path: "/workspaces" });
  return z.array(WorkspaceSchema).parse(data);
}
