import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import {
  listUserTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry
} from "../clockify/endpoints/timeEntries.js";
import type { CreateTimeEntryArgs, UpdateTimeEntryArgs } from "../clockify/endpoints/timeEntries.js";
import { resolveDateRange } from "../lib/dates.js";

const ListInput = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional(),
  workspaceId: z.string().optional()
});

const CreateInput = z.object({
  description: z.string(),
  start: z.string(),
  end: z.string(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const UpdateInput = z.object({
  id: z.string(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const DeleteInput = z.object({
  id: z.string(),
  workspaceId: z.string().optional()
});

export function timeEntryTools(ctx: ToolContext): ToolMap {
  return {
    list_time_entries: {
      name: "list_time_entries",
      description:
        "List a user's time entries. start/end accept ISO strings or 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month'.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const userId = input.userId ?? (await ctx.userCache.get()).id;
        const range = resolveDateRange(
          { start: input.start ?? "today", end: input.end ?? "today" },
          { tz: "UTC" }
        );
        // Build query args conditionally to satisfy exactOptionalPropertyTypes
        const args: Parameters<typeof listUserTimeEntries>[3] = {
          start: range.start,
          end: range.end
        };
        if (input.projectId !== undefined) args.project = input.projectId;
        if (input.page !== undefined) args.page = input.page;
        if (input.pageSize !== undefined) args.pageSize = input.pageSize;
        return listUserTimeEntries(ctx.client, ws, userId, args);
      }
    },
    create_time_entry: {
      name: "create_time_entry",
      description: "Create a manual (closed) time entry.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build body conditionally to satisfy exactOptionalPropertyTypes
        const body: CreateTimeEntryArgs = {
          start: input.start
        };
        body.description = input.description;
        body.end = input.end;
        if (input.projectId !== undefined) body.projectId = input.projectId;
        if (input.taskId !== undefined) body.taskId = input.taskId;
        if (input.tags !== undefined) body.tagIds = input.tags;
        if (input.billable !== undefined) body.billable = input.billable;
        return createTimeEntry(ctx.client, ws, body);
      }
    },
    update_time_entry: {
      name: "update_time_entry",
      description: "Update fields on an existing time entry.",
      inputSchema: UpdateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        // Build body conditionally to satisfy exactOptionalPropertyTypes
        const body: UpdateTimeEntryArgs = {};
        if (input.description !== undefined) body.description = input.description;
        if (input.start !== undefined) body.start = input.start;
        if (input.end !== undefined) body.end = input.end;
        if (input.projectId !== undefined) body.projectId = input.projectId;
        if (input.taskId !== undefined) body.taskId = input.taskId;
        if (input.tags !== undefined) body.tagIds = input.tags;
        if (input.billable !== undefined) body.billable = input.billable;
        return updateTimeEntry(ctx.client, ws, input.id, body);
      }
    },
    delete_time_entry: {
      name: "delete_time_entry",
      description: "Delete a time entry by id.",
      inputSchema: DeleteInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return deleteTimeEntry(ctx.client, ws, input.id);
      }
    }
  };
}
