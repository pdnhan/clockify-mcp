import { z } from "zod";

const optionalUrl = (defaultUrl: string) =>
  z.string().transform(v => v || defaultUrl).pipe(z.string().url()).default(defaultUrl);

const Schema = z.object({
  CLOCKIFY_API_KEY: z.string().min(1),
  CLOCKIFY_WORKSPACE_ID: z.string().min(1),
  CLOCKIFY_BASE_URL: optionalUrl("https://api.clockify.me/api/v1"),
  CLOCKIFY_REPORTS_BASE_URL: optionalUrl("https://reports.api.clockify.me/v1"),
  PORT: z.coerce.number().int().nonnegative().default(3000),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info")
});

type Parsed = z.infer<typeof Schema>;

export type Config = {
  apiKey: Parsed["CLOCKIFY_API_KEY"];
  workspaceId: Parsed["CLOCKIFY_WORKSPACE_ID"];
  baseUrl: Parsed["CLOCKIFY_BASE_URL"];
  reportsBaseUrl: Parsed["CLOCKIFY_REPORTS_BASE_URL"];
  port: Parsed["PORT"];
  logLevel: Parsed["LOG_LEVEL"];
};

export function loadConfig(): Config {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (!first) throw new Error("invalid config: unknown error");
    const path = first.path.join(".");
    throw new Error(`invalid config: ${path}: ${first.message}`);
  }
  const env = parsed.data;
  return {
    apiKey: env.CLOCKIFY_API_KEY,
    workspaceId: env.CLOCKIFY_WORKSPACE_ID,
    baseUrl: env.CLOCKIFY_BASE_URL,
    reportsBaseUrl: env.CLOCKIFY_REPORTS_BASE_URL,
    port: env.PORT,
    logLevel: env.LOG_LEVEL
  };
}
