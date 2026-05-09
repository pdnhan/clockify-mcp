import type { Client } from "../client.js";

export type ReportSummaryArgs = {
  start: string;
  end: string;
  groups?: Array<"PROJECT" | "USER" | "CLIENT" | "TASK" | "TAG" | "DATE">;
  users?: string[];
  projects?: string[];
  clients?: string[];
  tags?: string[];
  billable?: boolean;
};

export async function reportSummary(
  client: Client,
  workspaceId: string,
  args: ReportSummaryArgs
): Promise<unknown> {
  const body: Record<string, unknown> = {
    dateRangeStart: args.start,
    dateRangeEnd: args.end,
    summaryFilter: { groups: args.groups ?? ["PROJECT"] },
    exportType: "JSON"
  };
  if (args.users) body.users = { ids: args.users, contains: "CONTAINS", status: "ALL" };
  if (args.projects) body.projects = { ids: args.projects, contains: "CONTAINS", status: "ALL" };
  if (args.clients) body.clients = { ids: args.clients, contains: "CONTAINS", status: "ALL" };
  if (args.tags) body.tags = { ids: args.tags, contains: "CONTAINS", status: "ALL" };
  if (args.billable !== undefined) body.billable = args.billable;

  return client.request({
    host: "reports",
    method: "POST",
    path: `/workspaces/${workspaceId}/reports/summary`,
    body
  });
}

export type ReportDetailedArgs = {
  start: string;
  end: string;
  page?: number;
  pageSize?: number;
  sortColumn?: "DATE" | "USER" | "DURATION" | "PROJECT";
  users?: string[];
  projects?: string[];
  tags?: string[];
  billable?: boolean;
};

export async function reportDetailed(
  client: Client,
  workspaceId: string,
  args: ReportDetailedArgs
): Promise<unknown> {
  const body: Record<string, unknown> = {
    dateRangeStart: args.start,
    dateRangeEnd: args.end,
    detailedFilter: {
      page: args.page ?? 1,
      pageSize: args.pageSize ?? 50,
      sortColumn: args.sortColumn ?? "DATE"
    },
    exportType: "JSON"
  };
  if (args.users) body.users = { ids: args.users, contains: "CONTAINS", status: "ALL" };
  if (args.projects) body.projects = { ids: args.projects, contains: "CONTAINS", status: "ALL" };
  if (args.tags) body.tags = { ids: args.tags, contains: "CONTAINS", status: "ALL" };
  if (args.billable !== undefined) body.billable = args.billable;

  return client.request({
    host: "reports",
    method: "POST",
    path: `/workspaces/${workspaceId}/reports/detailed`,
    body
  });
}

export type ReportWeeklyArgs = {
  start: string;
  end: string;
  weeklyFilter?: { group: "USER" | "PROJECT"; subgroup: "TIME" | "EARNED" };
  users?: string[];
  projects?: string[];
};

export async function reportWeekly(
  client: Client,
  workspaceId: string,
  args: ReportWeeklyArgs
): Promise<unknown> {
  const body: Record<string, unknown> = {
    dateRangeStart: args.start,
    dateRangeEnd: args.end,
    weeklyFilter: args.weeklyFilter ?? { group: "USER", subgroup: "TIME" },
    exportType: "JSON"
  };
  if (args.users) body.users = { ids: args.users, contains: "CONTAINS", status: "ALL" };
  if (args.projects) body.projects = { ids: args.projects, contains: "CONTAINS", status: "ALL" };

  return client.request({
    host: "reports",
    method: "POST",
    path: `/workspaces/${workspaceId}/reports/weekly`,
    body
  });
}

export async function listSharedReports(
  client: Client,
  workspaceId: string,
  args: { page?: number; pageSize?: number } = {}
): Promise<unknown> {
  return client.request({
    host: "reports",
    method: "GET",
    path: `/workspaces/${workspaceId}/shared-reports`,
    query: { page: args.page, "page-size": args.pageSize }
  });
}
