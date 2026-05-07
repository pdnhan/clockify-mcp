import { ClockifyError } from "../lib/errors.js";

export type ClientConfig = {
  apiKey: string;
  baseUrl: string;
  reportsBaseUrl: string;
  /** Override retry backoff (used by tests). Default: exponential 1s/2s/4s. */
  retryDelayMs?: (attempt: number) => number;
  /** Per-request timeout in ms. Default 10_000. */
  timeoutMs?: number;
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

const DEFAULT_BACKOFF = (attempt: number) => 1000 * Math.pow(2, attempt);
const DEFAULT_TIMEOUT_MS = 10_000;

export function createClient(cfg: ClientConfig): Client {
  return { request: (args) => doRequest(cfg, args) };
}

async function doRequest<T>(cfg: ClientConfig, args: RequestArgs): Promise<T> {
  const idempotent = args.method === "GET";
  const max429 = 3;
  const max5xx = idempotent ? 1 : 0;

  let attempt429 = 0;
  let attempt5xx = 0;

  while (true) {
    const res = await sendOnce(cfg, args);
    if (res.kind === "ok") return res.value as T;

    if (res.status === 429 && attempt429 < max429) {
      await sleep((cfg.retryDelayMs ?? DEFAULT_BACKOFF)(attempt429));
      attempt429 += 1;
      continue;
    }
    if (res.status >= 500 && attempt5xx < max5xx) {
      await sleep((cfg.retryDelayMs ?? DEFAULT_BACKOFF)(attempt5xx));
      attempt5xx += 1;
      continue;
    }
    throw new ClockifyError(res.status, res.code, res.message);
  }
}

type Outcome =
  | { kind: "ok"; value: unknown }
  | { kind: "err"; status: number; code: string | null; message: string };

async function sendOnce(cfg: ClientConfig, args: RequestArgs): Promise<Outcome> {
  const base = args.host === "api" ? cfg.baseUrl : cfg.reportsBaseUrl;
  const url = buildUrl(base, args.path, args.query);
  const headers: Record<string, string> = { "X-Api-Key": cfg.apiKey };
  let body: string | undefined;
  if (args.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(args.body);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const fetchInit: RequestInit = { method: args.method, headers, signal: ac.signal };
    if (body !== undefined) fetchInit.body = body;
    const res = await fetch(url, fetchInit);
    if (res.status === 204) return { kind: "ok", value: null };
    const text = await res.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try { parsed = JSON.parse(text); } catch { parsed = null; }
    }
    if (!res.ok) {
      const code = isObject(parsed) && typeof parsed["code"] === "string" ? parsed["code"] : null;
      const message =
        isObject(parsed) && typeof parsed["message"] === "string" ? parsed["message"] : text || res.statusText;
      return { kind: "err", status: res.status, code, message };
    }
    return { kind: "ok", value: parsed };
  } finally {
    clearTimeout(timer);
  }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
