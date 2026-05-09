import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import type { ListClientsArgs, CreateClientArgs } from "../clockify/endpoints/clients.js";
import { listClients, createClockifyClient } from "../clockify/endpoints/clients.js";

const ListInput = z.object({
  name: z.string().optional(),
  archived: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const CreateInput = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  note: z.string().optional(),
  workspaceId: z.string().optional()
});

export function clientTools(ctx: ToolContext): ToolMap {
  return {
    list_clients: {
      name: "list_clients",
      description: "List clients in a workspace.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build args conditionally to satisfy exactOptionalPropertyTypes
        const args: ListClientsArgs = {};
        if (input.name !== undefined) args.name = input.name;
        if (input.archived !== undefined) args.archived = input.archived;
        return listClients(ctx.client, ws, args);
      }
    },
    create_client: {
      name: "create_client",
      description: "Create a new client.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build args conditionally to satisfy exactOptionalPropertyTypes
        const args: CreateClientArgs = { name: input.name };
        if (input.address !== undefined) args.address = input.address;
        if (input.note !== undefined) args.note = input.note;
        return createClockifyClient(ctx.client, ws, args);
      }
    }
  };
}
