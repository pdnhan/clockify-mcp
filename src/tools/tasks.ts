import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import type { ListTasksArgs, CreateTaskArgs } from "../clockify/endpoints/tasks.js";
import { listTasks, createTask } from "../clockify/endpoints/tasks.js";

const ListInput = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  status: z.enum(["ACTIVE", "DONE"]).optional(),
  workspaceId: z.string().optional()
});

const CreateInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  assigneeIds: z.array(z.string()).optional(),
  workspaceId: z.string().optional()
});

export function taskTools(ctx: ToolContext): ToolMap {
  return {
    list_tasks: {
      name: "list_tasks",
      description: "List tasks within a project.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build args conditionally to satisfy exactOptionalPropertyTypes
        const args: ListTasksArgs = {};
        if (input.name !== undefined) args.name = input.name;
        if (input.status !== undefined) args.status = input.status;
        return listTasks(ctx.client, ws, input.projectId, args);
      }
    },
    create_task: {
      name: "create_task",
      description: "Create a task within a project.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build args conditionally to satisfy exactOptionalPropertyTypes
        const args: CreateTaskArgs = { name: input.name };
        if (input.assigneeIds !== undefined) args.assigneeIds = input.assigneeIds;
        return createTask(ctx.client, ws, input.projectId, args);
      }
    }
  };
}
