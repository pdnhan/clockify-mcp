import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import {
  reportSummary,
  reportDetailed,
  reportWeekly,
  listSharedReports
} from "../clockify/endpoints/reports.js";
import type { ReportSummaryArgs, ReportDetailedArgs, ReportWeeklyArgs } from "../clockify/endpoints/reports.js";
import { resolveDateRange } from "../lib/dates.js";

const SummaryInput = z.object({
  start: z.string(),
  end: z.string(),
  groups: z.array(z.enum(["PROJECT", "USER", "CLIENT", "TASK", "TAG", "DATE"])).optional(),
  users: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  clients: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const DetailedInput = z.object({
  start: z.string(),
  end: z.string(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(1000).optional(),
  sortColumn: z.enum(["DATE", "USER", "DURATION", "PROJECT"]).optional(),
  users: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const WeeklyInput = z.object({
  start: z.string(),
  end: z.string(),
  weeklyFilter: z
    .object({
      group: z.enum(["USER", "PROJECT"]),
      subgroup: z.enum(["TIME", "EARNED"])
    })
    .optional(),
  users: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  workspaceId: z.string().optional()
});

const SharedInput = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional(),
  workspaceId: z.string().optional()
});

export function reportTools(ctx: ToolContext): ToolMap {
  return {
    report_summary: {
      name: "report_summary",
      description:
        "Summary report. start/end accept ISO or 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month'.",
      inputSchema: SummaryInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const range = resolveDateRange(
          { start: input.start, end: input.end },
          { tz: "UTC" }
        );
        const args: ReportSummaryArgs = {
          start: range.start,
          end: range.end
        };
        if (input.groups !== undefined) args.groups = input.groups;
        if (input.users !== undefined) args.users = input.users;
        if (input.projects !== undefined) args.projects = input.projects;
        if (input.clients !== undefined) args.clients = input.clients;
        if (input.tags !== undefined) args.tags = input.tags;
        if (input.billable !== undefined) args.billable = input.billable;
        return reportSummary(ctx.client, ws, args);
      }
    },
    report_detailed: {
      name: "report_detailed",
      description: "Detailed (per-entry) report.",
      inputSchema: DetailedInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const range = resolveDateRange(
          { start: input.start, end: input.end },
          { tz: "UTC" }
        );
        const args: ReportDetailedArgs = {
          start: range.start,
          end: range.end
        };
        if (input.page !== undefined) args.page = input.page;
        if (input.pageSize !== undefined) args.pageSize = input.pageSize;
        if (input.sortColumn !== undefined) args.sortColumn = input.sortColumn;
        if (input.users !== undefined) args.users = input.users;
        if (input.projects !== undefined) args.projects = input.projects;
        if (input.tags !== undefined) args.tags = input.tags;
        if (input.billable !== undefined) args.billable = input.billable;
        return reportDetailed(ctx.client, ws, args);
      }
    },
    report_weekly: {
      name: "report_weekly",
      description: "Weekly report grouped by user or project.",
      inputSchema: WeeklyInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const range = resolveDateRange(
          { start: input.start, end: input.end },
          { tz: "UTC" }
        );
        const args: ReportWeeklyArgs = {
          start: range.start,
          end: range.end
        };
        if (input.weeklyFilter !== undefined) args.weeklyFilter = input.weeklyFilter;
        if (input.users !== undefined) args.users = input.users;
        if (input.projects !== undefined) args.projects = input.projects;
        return reportWeekly(ctx.client, ws, args);
      }
    },
    list_shared_reports: {
      name: "list_shared_reports",
      description: "List shared reports.",
      inputSchema: SharedInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const args: { page?: number; pageSize?: number } = {};
        if (input.page !== undefined) args.page = input.page;
        if (input.pageSize !== undefined) args.pageSize = input.pageSize;
        return listSharedReports(ctx.client, ws, args);
      }
    }
  };
}
