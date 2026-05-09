import type { Client } from "../client.js";
import { ProjectSchema, type Project } from "../types.js";
import { z } from "zod";

export type ListProjectsArgs = {
  name?: string;
  archived?: boolean;
  clientId?: string;
  page?: number;
  pageSize?: number;
};

export async function listProjects(
  client: Client,
  workspaceId: string,
  args: ListProjectsArgs = {}
): Promise<Project[]> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/projects`,
    query: {
      name: args.name,
      archived: args.archived,
      clients: args.clientId,
      page: args.page,
      "page-size": args.pageSize
    }
  });
  return z.array(ProjectSchema).parse(data);
}

export async function getProject(
  client: Client,
  workspaceId: string,
  id: string
): Promise<Project> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/projects/${id}`
  });
  return ProjectSchema.parse(data);
}

export type CreateProjectArgs = {
  name: string;
  clientId?: string;
  color?: string;
  billable?: boolean;
};

export async function createProject(
  client: Client,
  workspaceId: string,
  args: CreateProjectArgs
): Promise<Project> {
  const data = await client.request({
    host: "api",
    method: "POST",
    path: `/workspaces/${workspaceId}/projects`,
    body: args
  });
  return ProjectSchema.parse(data);
}
