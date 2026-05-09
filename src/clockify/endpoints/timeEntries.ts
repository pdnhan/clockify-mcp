import type { Client } from "../client.js";
import { TimeEntrySchema, type TimeEntry } from "../types.js";
import { z } from "zod";

export type ListUserTimeEntriesArgs = {
  start?: string;
  end?: string;
  project?: string;
  page?: number;
  pageSize?: number;
};

export async function listUserTimeEntries(
  client: Client,
  workspaceId: string,
  userId: string,
  args: ListUserTimeEntriesArgs = {}
): Promise<TimeEntry[]> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/user/${userId}/time-entries`,
    query: {
      start: args.start,
      end: args.end,
      project: args.project,
      page: args.page,
      "page-size": args.pageSize
    }
  });
  return z.array(TimeEntrySchema).parse(data);
}

export async function getRunningTimeEntry(
  client: Client,
  workspaceId: string,
  userId: string
): Promise<TimeEntry | null> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/user/${userId}/time-entries`,
    query: { "in-progress": true }
  });
  const arr = z.array(TimeEntrySchema).parse(data);
  return arr[0] ?? null;
}

export type CreateTimeEntryArgs = {
  description?: string;
  start: string;
  end?: string;
  projectId?: string;
  taskId?: string;
  tagIds?: string[];
  billable?: boolean;
};

export async function createTimeEntry(
  client: Client,
  workspaceId: string,
  args: CreateTimeEntryArgs
): Promise<TimeEntry> {
  const data = await client.request({
    host: "api",
    method: "POST",
    path: `/workspaces/${workspaceId}/time-entries`,
    body: args
  });
  return TimeEntrySchema.parse(data);
}

export type UpdateTimeEntryArgs = Partial<CreateTimeEntryArgs>;

export async function updateTimeEntry(
  client: Client,
  workspaceId: string,
  id: string,
  args: UpdateTimeEntryArgs
): Promise<TimeEntry> {
  const data = await client.request({
    host: "api",
    method: "PUT",
    path: `/workspaces/${workspaceId}/time-entries/${id}`,
    body: args
  });
  return TimeEntrySchema.parse(data);
}

export async function deleteTimeEntry(
  client: Client,
  workspaceId: string,
  id: string
): Promise<null> {
  await client.request({
    host: "api",
    method: "DELETE",
    path: `/workspaces/${workspaceId}/time-entries/${id}`
  });
  return null;
}

export async function stopRunningTimer(
  client: Client,
  workspaceId: string,
  userId: string,
  endIso: string
): Promise<TimeEntry> {
  const data = await client.request({
    host: "api",
    method: "PATCH",
    path: `/workspaces/${workspaceId}/user/${userId}/time-entries`,
    body: { end: endIso }
  });
  return TimeEntrySchema.parse(data);
}
