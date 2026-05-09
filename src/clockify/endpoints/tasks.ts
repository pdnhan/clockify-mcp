import type { Client } from "../client.js";
import { TaskSchema, type Task } from "../types.js";
import { z } from "zod";

export type ListTasksArgs = {
  name?: string;
  status?: "ACTIVE" | "DONE";
};

export async function listTasks(
  client: Client,
  workspaceId: string,
  projectId: string,
  args: ListTasksArgs = {}
): Promise<Task[]> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    query: { name: args.name, status: args.status }
  });
  return z.array(TaskSchema).parse(data);
}

export type CreateTaskArgs = {
  name: string;
  assigneeIds?: string[];
};

export async function createTask(
  client: Client,
  workspaceId: string,
  projectId: string,
  args: CreateTaskArgs
): Promise<Task> {
  const data = await client.request({
    host: "api",
    method: "POST",
    path: `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    body: args
  });
  return TaskSchema.parse(data);
}
