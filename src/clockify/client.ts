import { ClockifyError } from "../lib/errors.js";

export type ClientConfig = {
  apiKey: string;
  baseUrl: string;
  reportsBaseUrl: string;
};

export type Host = "api" | "reports";

export type RequestArgs = {
  host: Host;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export type Client = {
  request<T = unknown>(args: RequestArgs): Promise<T>;
};

export function createClient(cfg: ClientConfig): Client {
  return { request: (args) => doRequest(cfg, args) };
}

async function doRequest<T>(cfg: ClientConfig, args: RequestArgs): Promise<T> {
  const base = args.host === "api" ? cfg.baseUrl : cfg.reportsBaseUrl;
  const url = buildUrl(base, args.path, args.query);
  const headers: Record<string, string> = { "X-Api-Key": cfg.apiKey };
  let body: string | undefined;
  if (args.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(args.body);
  }
  const fetchInit: RequestInit = { method: args.method, headers };
  if (body !== undefined) fetchInit.body = body;
  const res = await fetch(url, fetchInit);
  if (res.status === 204) return null as T;
  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }
  if (!res.ok) {
    const code = isObject(parsed) && typeof parsed["code"] === "string" ? parsed["code"] : null;
    const message =
      isObject(parsed) && typeof parsed["message"] === "string" ? parsed["message"] : text || res.statusText;
    throw new ClockifyError(res.status, code, message);
  }
  return parsed as T;
}

function buildUrl(
  base: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(base.replace(/\/$/, "") + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
