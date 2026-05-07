import { z } from "zod";

const Schema = z.object({
  CLOCKIFY_API_KEY: z.string().min(1),
  CLOCKIFY_WORKSPACE_ID: z.string().min(1),
  CLOCKIFY_BASE_URL: z.string().url().default("https://api.clockify.me/api/v1"),
  CLOCKIFY_REPORTS_BASE_URL: z.string().url().default("https://reports.api.clockify.me/v1"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info")
});

export type Config = {
  apiKey: string;
  workspaceId: string;
  baseUrl: string;
  reportsBaseUrl: string;
  port: number;
  logLevel: "error" | "warn" | "info" | "debug";
};

export function loadConfig(): Config {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const first = parsed.error.issues[0]!;
    const path = first.path.join(".");
    throw new Error(`invalid config: ${path}: ${first.message}`);
  }
  const e = parsed.data;
  return {
    apiKey: e.CLOCKIFY_API_KEY,
    workspaceId: e.CLOCKIFY_WORKSPACE_ID,
    baseUrl: e.CLOCKIFY_BASE_URL,
    reportsBaseUrl: e.CLOCKIFY_REPORTS_BASE_URL,
    port: e.PORT,
    logLevel: e.LOG_LEVEL
  };
}
