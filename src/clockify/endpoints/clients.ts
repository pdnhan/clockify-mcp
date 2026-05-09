import type { Client } from "../client.js";
import { ClientSchema, type Client as ClockifyClient } from "../types.js";
import { z } from "zod";

export type ListClientsArgs = { name?: string; archived?: boolean };

export async function listClients(
  client: Client,
  workspaceId: string,
  args: ListClientsArgs = {}
): Promise<ClockifyClient[]> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/clients`,
    query: { name: args.name, archived: args.archived }
  });
  return z.array(ClientSchema).parse(data);
}

export type CreateClientArgs = { name: string; address?: string; note?: string };

export async function createClockifyClient(
  client: Client,
  workspaceId: string,
  args: CreateClientArgs
): Promise<ClockifyClient> {
  const data = await client.request({
    host: "api",
    method: "POST",
    path: `/workspaces/${workspaceId}/clients`,
    body: args
  });
  return ClientSchema.parse(data);
}
