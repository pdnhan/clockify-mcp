import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import {
  createTimeEntry,
  getRunningTimeEntry,
  stopRunningTimer
} from "../clockify/endpoints/timeEntries.js";
import type { CreateTimeEntryArgs } from "../clockify/endpoints/timeEntries.js";

const StartTimerInput = z.object({
  description: z.string().min(1),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const StopTimerInput = z.object({
  userId: z.string().optional(),
  workspaceId: z.string().optional()
});

const GetRunningInput = StopTimerInput;

export function timerTools(ctx: ToolContext): ToolMap {
  return {
    start_timer: {
      name: "start_timer",
      description:
        "Start a timer. Creates a time entry with no end. Falls back to CLOCKIFY_WORKSPACE_ID and the current user.",
      inputSchema: StartTimerInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build body conditionally to satisfy exactOptionalPropertyTypes —
        // only include optional fields when their value is defined.
        const body: CreateTimeEntryArgs = {
          description: input.description,
          start: new Date().toISOString()
        };
        if (input.projectId !== undefined) body.projectId = input.projectId;
        if (input.taskId !== undefined) body.taskId = input.taskId;
        if (input.tags !== undefined) body.tagIds = input.tags;
        if (input.billable !== undefined) body.billable = input.billable;
        return createTimeEntry(ctx.client, ws, body);
      }
    },
    stop_timer: {
      name: "stop_timer",
      description: "Stop the currently running timer for the given (or current) user.",
      inputSchema: StopTimerInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const userId = input.userId ?? (await ctx.userCache.get()).id;
        return stopRunningTimer(ctx.client, ws, userId, new Date().toISOString());
      }
    },
    get_running_timer: {
      name: "get_running_timer",
      description:
        "Return the currently running time entry for the given (or current) user, or null.",
      inputSchema: GetRunningInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const userId = input.userId ?? (await ctx.userCache.get()).id;
        return getRunningTimeEntry(ctx.client, ws, userId);
      }
    }
  };
}
