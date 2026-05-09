import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import type { ListProjectsArgs, CreateProjectArgs } from "../clockify/endpoints/projects.js";
import {
  listProjects, getProject, createProject
} from "../clockify/endpoints/projects.js";

const ListInput = z.object({
  name: z.string().optional(),
  archived: z.boolean().optional(),
  clientId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional(),
  workspaceId: z.string().optional()
});

const GetInput = z.object({
  id: z.string(),
  workspaceId: z.string().optional()
});

const CreateInput = z.object({
  name: z.string().min(1),
  clientId: z.string().optional(),
  color: z.string().optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

export function projectTools(ctx: ToolContext): ToolMap {
  return {
    list_projects: {
      name: "list_projects",
      description: "List projects in a workspace. Filters by name, archived flag, and clientId.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build args conditionally to satisfy exactOptionalPropertyTypes
        const args: ListProjectsArgs = {};
        if (input.name !== undefined) args.name = input.name;
        if (input.archived !== undefined) args.archived = input.archived;
        if (input.clientId !== undefined) args.clientId = input.clientId;
        if (input.page !== undefined) args.page = input.page;
        if (input.pageSize !== undefined) args.pageSize = input.pageSize;
        return listProjects(ctx.client, ws, args);
      }
    },
    get_project: {
      name: "get_project",
      description: "Fetch a project by id.",
      inputSchema: GetInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return getProject(ctx.client, ws, input.id);
      }
    },
    create_project: {
      name: "create_project",
      description: "Create a project.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build args conditionally to satisfy exactOptionalPropertyTypes
        const args: CreateProjectArgs = { name: input.name };
        if (input.clientId !== undefined) args.clientId = input.clientId;
        if (input.color !== undefined) args.color = input.color;
        if (input.billable !== undefined) args.billable = input.billable;
        return createProject(ctx.client, ws, args);
      }
    }
  };
}
