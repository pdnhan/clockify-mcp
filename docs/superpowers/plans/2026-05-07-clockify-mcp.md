# Clockify MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Docker-deployable MCP server (~21 tools) wrapping the Clockify time-tracking + Reports APIs, configured via env vars, served over streamable HTTP.

**Architecture:** TypeScript on Node 22. Layered: `tools/*` (smart defaults) → `clockify/endpoints/*` (request builders) → `clockify/client.ts` (auth, retry, host switching) → `fetch`. Single `lib/userCache.ts` lazily resolves the current user. Reports API hits a second host via the same client. Streamable HTTP MCP transport on port 3000.

**Tech Stack:** Node 22, `@modelcontextprotocol/sdk`, `zod`, native `fetch`, `pnpm`, `tsc`, `vitest`, `msw`, Docker.

**Spec:** `docs/superpowers/specs/2026-05-07-clockify-mcp-design.md`

---

## File Layout

```
.
├── Dockerfile
├── docker-compose.yml
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── .dockerignore
├── .env.example
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── config.ts
│   ├── lib/
│   │   ├── dates.ts
│   │   ├── errors.ts
│   │   └── userCache.ts
│   ├── clockify/
│   │   ├── client.ts
│   │   ├── types.ts
│   │   └── endpoints/
│   │       ├── users.ts
│   │       ├── workspaces.ts
│   │       ├── projects.ts
│   │       ├── tasks.ts
│   │       ├── timeEntries.ts
│   │       ├── tags.ts
│   │       ├── clients.ts
│   │       └── reports.ts
│   └── tools/
│       ├── index.ts
│       ├── workspaces.ts
│       ├── timer.ts
│       ├── timeEntries.ts
│       ├── projects.ts
│       ├── tasks.ts
│       ├── tags.ts
│       ├── clients.ts
│       └── reports.ts
└── tests/
    ├── helpers/
    │   └── mockServer.ts
    ├── lib/
    │   ├── dates.test.ts
    │   ├── errors.test.ts
    │   └── userCache.test.ts
    ├── clockify/
    │   ├── client.test.ts
    │   └── endpoints/
    │       ├── users.test.ts
    │       ├── workspaces.test.ts
    │       ├── projects.test.ts
    │       ├── tasks.test.ts
    │       ├── timeEntries.test.ts
    │       ├── tags.test.ts
    │       ├── clients.test.ts
    │       └── reports.test.ts
    ├── tools/
    │   ├── workspaces.test.ts
    │   ├── timer.test.ts
    │   ├── timeEntries.test.ts
    │   ├── projects.test.ts
    │   ├── tasks.test.ts
    │   ├── tags.test.ts
    │   ├── clients.test.ts
    │   └── reports.test.ts
    └── integration/
        └── smoke.test.ts
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.dockerignore`, `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "clockify-mcp",
  "version": "0.1.0",
  "description": "MCP server for the Clockify time-tracking API",
  "type": "module",
  "private": true,
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "msw": "^2.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.0"
  },
  "packageManager": "pnpm@9.10.0"
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 5000
  }
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules
dist
.env
.env.local
*.log
.DS_Store
coverage
```

- [ ] **Step 5: Create `.dockerignore`**

```
node_modules
dist
.git
.env
.env.local
tests
docs
*.md
.gitignore
.dockerignore
```

- [ ] **Step 6: Create `.env.example`**

```
CLOCKIFY_API_KEY=your-personal-key-here
CLOCKIFY_WORKSPACE_ID=your-workspace-id-here
# CLOCKIFY_BASE_URL=https://api.clockify.me/api/v1
# CLOCKIFY_REPORTS_BASE_URL=https://reports.api.clockify.me/v1
# PORT=3000
# LOG_LEVEL=info
```

- [ ] **Step 7: Install deps**

Run: `pnpm install`
Expected: lockfile generated, no errors.

- [ ] **Step 8: Verify typecheck passes (vacuously)**

Run: `pnpm typecheck`
Expected: exit 0 (no source files yet — tsc passes).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts .gitignore .dockerignore .env.example
git commit -m "feat: project scaffold (Node 22, TS, vitest)"
```

---

## Task 2: Config module

**Files:**
- Create: `src/config.ts`
- Test: `tests/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/config.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  beforeEach(() => {
    delete process.env.CLOCKIFY_API_KEY;
    delete process.env.CLOCKIFY_WORKSPACE_ID;
    delete process.env.CLOCKIFY_BASE_URL;
    delete process.env.CLOCKIFY_REPORTS_BASE_URL;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
  });

  it("returns parsed config when required vars are set", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    const cfg = loadConfig();
    expect(cfg.apiKey).toBe("k");
    expect(cfg.workspaceId).toBe("w");
    expect(cfg.baseUrl).toBe("https://api.clockify.me/api/v1");
    expect(cfg.reportsBaseUrl).toBe("https://reports.api.clockify.me/v1");
    expect(cfg.port).toBe(3000);
    expect(cfg.logLevel).toBe("info");
  });

  it("throws with the missing var name when CLOCKIFY_API_KEY is absent", () => {
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    expect(() => loadConfig()).toThrow(/CLOCKIFY_API_KEY/);
  });

  it("throws with the missing var name when CLOCKIFY_WORKSPACE_ID is absent", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    expect(() => loadConfig()).toThrow(/CLOCKIFY_WORKSPACE_ID/);
  });

  it("accepts optional overrides", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    process.env.CLOCKIFY_BASE_URL = "https://euc1.api.clockify.me/api/v1";
    process.env.PORT = "4000";
    process.env.LOG_LEVEL = "debug";
    const cfg = loadConfig();
    expect(cfg.baseUrl).toBe("https://euc1.api.clockify.me/api/v1");
    expect(cfg.port).toBe(4000);
    expect(cfg.logLevel).toBe("debug");
  });

  it("rejects an invalid LOG_LEVEL", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    process.env.LOG_LEVEL = "verbose";
    expect(() => loadConfig()).toThrow(/LOG_LEVEL/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/config.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/lib/config.test.ts
git commit -m "feat(config): zod-validated env loader"
```

---

## Task 3: Errors module

**Files:**
- Create: `src/lib/errors.ts`
- Test: `tests/lib/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/errors.test.ts
import { describe, it, expect } from "vitest";
import { ClockifyError, toMcpErrorMessage } from "../../src/lib/errors.js";

describe("ClockifyError", () => {
  it("captures status, code, and message", () => {
    const e = new ClockifyError(404, "RESOURCE_NOT_FOUND", "Project not found");
    expect(e.status).toBe(404);
    expect(e.code).toBe("RESOURCE_NOT_FOUND");
    expect(e.message).toBe("Project not found");
    expect(e instanceof Error).toBe(true);
  });
});

describe("toMcpErrorMessage", () => {
  it("rewrites 401 to an auth-key hint", () => {
    const msg = toMcpErrorMessage(new ClockifyError(401, null, "unauthorized"));
    expect(msg).toMatch(/CLOCKIFY_API_KEY/);
  });

  it("rewrites 403 to an auth-key hint", () => {
    const msg = toMcpErrorMessage(new ClockifyError(403, null, "forbidden"));
    expect(msg).toMatch(/CLOCKIFY_API_KEY/);
  });

  it("preserves the upstream code and message for other errors", () => {
    const msg = toMcpErrorMessage(new ClockifyError(404, "NOT_FOUND", "no such project"));
    expect(msg).toBe("Clockify 404 NOT_FOUND: no such project");
  });

  it("falls back to status only when code is missing", () => {
    const msg = toMcpErrorMessage(new ClockifyError(500, null, "boom"));
    expect(msg).toBe("Clockify 500: boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/errors.ts`**

```ts
export class ClockifyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string
  ) {
    super(message);
    this.name = "ClockifyError";
  }
}

export function toMcpErrorMessage(err: ClockifyError): string {
  if (err.status === 401 || err.status === 403) {
    return `Clockify auth failed — check CLOCKIFY_API_KEY (${err.status}: ${err.message})`;
  }
  if (err.code) return `Clockify ${err.status} ${err.code}: ${err.message}`;
  return `Clockify ${err.status}: ${err.message}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/errors.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts tests/lib/errors.test.ts
git commit -m "feat(errors): ClockifyError + MCP message mapper"
```

---

## Task 4: HTTP client — request, auth, host switching

**Files:**
- Create: `src/clockify/client.ts`, `tests/helpers/mockServer.ts`
- Test: `tests/clockify/client.test.ts`

- [ ] **Step 1: Write helper `tests/helpers/mockServer.ts`**

```ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

export { http, HttpResponse };
```

- [ ] **Step 2: Write failing tests for auth + host switching**

```ts
// tests/clockify/client.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { ClockifyError } from "../../src/lib/errors.js";

const config = {
  apiKey: "test-key",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("createClient", () => {
  it("sends X-Api-Key header on every request", async () => {
    let received: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/user", ({ request }) => {
        received = request.headers.get("X-Api-Key");
        return HttpResponse.json({ id: "u1" });
      })
    );
    const client = createClient(config);
    await client.request({ host: "api", method: "GET", path: "/user" });
    expect(received).toBe("test-key");
  });

  it("uses baseUrl when host is 'api'", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces", () =>
        HttpResponse.json([{ id: "w1" }])
      )
    );
    const client = createClient(config);
    const out = await client.request<Array<{ id: string }>>({
      host: "api",
      method: "GET",
      path: "/workspaces"
    });
    expect(out).toEqual([{ id: "w1" }]);
  });

  it("uses reportsBaseUrl when host is 'reports'", async () => {
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/summary", () =>
        HttpResponse.json({ totals: [] })
      )
    );
    const client = createClient(config);
    const out = await client.request<{ totals: unknown[] }>({
      host: "reports",
      method: "POST",
      path: "/workspaces/w1/reports/summary",
      body: { dateRangeStart: "2026-05-01T00:00:00Z" }
    });
    expect(out.totals).toEqual([]);
  });

  it("returns the parsed JSON body on 2xx", async () => {
    server.use(
      http.get("https://api.test/api/v1/x", () =>
        HttpResponse.json({ ok: true }, { status: 200 })
      )
    );
    const client = createClient(config);
    const out = await client.request<{ ok: boolean }>({
      host: "api",
      method: "GET",
      path: "/x"
    });
    expect(out).toEqual({ ok: true });
  });

  it("returns null on 204", async () => {
    server.use(
      http.delete("https://api.test/api/v1/x/1", () => new HttpResponse(null, { status: 204 }))
    );
    const client = createClient(config);
    const out = await client.request({
      host: "api",
      method: "DELETE",
      path: "/x/1"
    });
    expect(out).toBeNull();
  });

  it("throws ClockifyError with code+message from a JSON 404", async () => {
    server.use(
      http.get("https://api.test/api/v1/x", () =>
        HttpResponse.json({ code: "NOT_FOUND", message: "nope" }, { status: 404 })
      )
    );
    const client = createClient(config);
    await expect(
      client.request({ host: "api", method: "GET", path: "/x" })
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND", message: "nope" });
  });

  it("throws ClockifyError with null code when body is non-JSON", async () => {
    server.use(
      http.get("https://api.test/api/v1/x", () =>
        new HttpResponse("oops", { status: 500 })
      )
    );
    const client = createClient(config);
    const err = await client.request({ host: "api", method: "GET", path: "/x" }).catch(e => e);
    expect(err).toBeInstanceOf(ClockifyError);
    expect((err as ClockifyError).status).toBe(500);
    expect((err as ClockifyError).code).toBeNull();
  });

  it("appends query parameters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/x", ({ request }) => {
        url = request.url;
        return HttpResponse.json({});
      })
    );
    const client = createClient(config);
    await client.request({
      host: "api",
      method: "GET",
      path: "/x",
      query: { page: 2, name: "foo bar" }
    });
    expect(url).toBe("https://api.test/api/v1/x?page=2&name=foo+bar");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test tests/clockify/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/clockify/client.ts`**

```ts
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
  const res = await fetch(url, { method: args.method, headers, body });
  if (res.status === 204) return null as T;
  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }
  if (!res.ok) {
    const code = isObject(parsed) && typeof parsed.code === "string" ? parsed.code : null;
    const message =
      isObject(parsed) && typeof parsed.message === "string" ? parsed.message : text || res.statusText;
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test tests/clockify/client.test.ts`
Expected: 8/8 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/clockify/client.ts tests/helpers/mockServer.ts tests/clockify/client.test.ts
git commit -m "feat(client): HTTP client with auth, host switching, JSON error mapping"
```

---

## Task 5: HTTP client — retry on 429 and 5xx, timeout

**Files:**
- Modify: `src/clockify/client.ts`
- Modify: `tests/clockify/client.test.ts`

- [ ] **Step 1: Append failing retry tests**

```ts
// append to tests/clockify/client.test.ts
import { vi } from "vitest";

describe("createClient retry", () => {
  it("retries 429 up to 3 times then succeeds", async () => {
    let n = 0;
    server.use(
      http.get("https://api.test/api/v1/x", () => {
        n += 1;
        if (n < 3) return new HttpResponse(null, { status: 429 });
        return HttpResponse.json({ ok: true });
      })
    );
    const client = createClient({ ...config, retryDelayMs: () => 1 });
    const out = await client.request<{ ok: boolean }>({
      host: "api",
      method: "GET",
      path: "/x"
    });
    expect(out).toEqual({ ok: true });
    expect(n).toBe(3);
  });

  it("surfaces 429 after exhausting retries", async () => {
    server.use(
      http.get("https://api.test/api/v1/x", () =>
        new HttpResponse(null, { status: 429 })
      )
    );
    const client = createClient({ ...config, retryDelayMs: () => 1 });
    await expect(
      client.request({ host: "api", method: "GET", path: "/x" })
    ).rejects.toMatchObject({ status: 429 });
  });

  it("retries a 500 GET once", async () => {
    let n = 0;
    server.use(
      http.get("https://api.test/api/v1/x", () => {
        n += 1;
        if (n === 1) return new HttpResponse("boom", { status: 500 });
        return HttpResponse.json({ ok: true });
      })
    );
    const client = createClient({ ...config, retryDelayMs: () => 1 });
    const out = await client.request<{ ok: boolean }>({
      host: "api",
      method: "GET",
      path: "/x"
    });
    expect(out).toEqual({ ok: true });
    expect(n).toBe(2);
  });

  it("does not retry a 500 POST", async () => {
    let n = 0;
    server.use(
      http.post("https://api.test/api/v1/x", () => {
        n += 1;
        return new HttpResponse("boom", { status: 500 });
      })
    );
    const client = createClient({ ...config, retryDelayMs: () => 1 });
    await expect(
      client.request({ host: "api", method: "POST", path: "/x", body: {} })
    ).rejects.toMatchObject({ status: 500 });
    expect(n).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/clockify/client.test.ts`
Expected: 4 new FAIL (config option `retryDelayMs` unused; retry not implemented).

- [ ] **Step 3: Replace `src/clockify/client.ts` with retry-aware version**

```ts
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
    const res = await fetch(url, { method: args.method, headers, body, signal: ac.signal });
    if (res.status === 204) return { kind: "ok", value: null };
    const text = await res.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try { parsed = JSON.parse(text); } catch { parsed = null; }
    }
    if (!res.ok) {
      const code = isObject(parsed) && typeof parsed.code === "string" ? parsed.code : null;
      const message =
        isObject(parsed) && typeof parsed.message === "string" ? parsed.message : text || res.statusText;
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
```

- [ ] **Step 4: Run all client tests**

Run: `pnpm test tests/clockify/client.test.ts`
Expected: 12/12 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/clockify/client.ts tests/clockify/client.test.ts
git commit -m "feat(client): retry 429 (3x) and 5xx GET (1x), 10s timeout"
```

---

## Task 6: Date literals (`lib/dates.ts`)

**Files:**
- Create: `src/lib/dates.ts`
- Test: `tests/lib/dates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/dates.test.ts
import { describe, it, expect } from "vitest";
import { resolveDateRange, isLiteralRange } from "../../src/lib/dates.js";

const TZ = "UTC";
const NOW = new Date("2026-05-07T14:30:00Z"); // Thursday

describe("resolveDateRange", () => {
  it("passes ISO strings through unchanged", () => {
    const r = resolveDateRange(
      { start: "2026-05-01T00:00:00Z", end: "2026-05-02T00:00:00Z" },
      { tz: TZ, now: NOW }
    );
    expect(r.start).toBe("2026-05-01T00:00:00Z");
    expect(r.end).toBe("2026-05-02T00:00:00Z");
  });

  it("expands 'today' to the full UTC day", () => {
    const r = resolveDateRange({ start: "today", end: "today" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-07T00:00:00.000Z");
    expect(r.end).toBe("2026-05-07T23:59:59.999Z");
  });

  it("expands 'yesterday' to the previous full UTC day", () => {
    const r = resolveDateRange({ start: "yesterday", end: "yesterday" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-06T00:00:00.000Z");
    expect(r.end).toBe("2026-05-06T23:59:59.999Z");
  });

  it("expands 'this_week' Monday→Sunday", () => {
    const r = resolveDateRange({ start: "this_week", end: "this_week" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-04T00:00:00.000Z"); // Mon
    expect(r.end).toBe("2026-05-10T23:59:59.999Z");   // Sun
  });

  it("expands 'last_week' to previous Mon→Sun", () => {
    const r = resolveDateRange({ start: "last_week", end: "last_week" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-04-27T00:00:00.000Z");
    expect(r.end).toBe("2026-05-03T23:59:59.999Z");
  });

  it("expands 'this_month' to first→last day", () => {
    const r = resolveDateRange({ start: "this_month", end: "this_month" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-01T00:00:00.000Z");
    expect(r.end).toBe("2026-05-31T23:59:59.999Z");
  });

  it("supports mixing a literal start and an ISO end", () => {
    const r = resolveDateRange(
      { start: "this_week", end: "2026-05-07T12:00:00Z" },
      { tz: TZ, now: NOW }
    );
    expect(r.start).toBe("2026-05-04T00:00:00.000Z");
    expect(r.end).toBe("2026-05-07T12:00:00Z");
  });
});

describe("isLiteralRange", () => {
  it("recognises supported literals", () => {
    expect(isLiteralRange("today")).toBe(true);
    expect(isLiteralRange("this_month")).toBe(true);
  });
  it("rejects ISO strings and unknown literals", () => {
    expect(isLiteralRange("2026-05-07")).toBe(false);
    expect(isLiteralRange("next_week")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/dates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
export type Literal = "today" | "yesterday" | "this_week" | "last_week" | "this_month";

const LITERALS = ["today", "yesterday", "this_week", "last_week", "this_month"] as const;

export function isLiteralRange(s: string): s is Literal {
  return (LITERALS as readonly string[]).includes(s);
}

export type Resolver = { tz: string; now?: Date };

export function resolveDateRange(
  input: { start: string; end: string },
  ctx: Resolver
): { start: string; end: string } {
  const now = ctx.now ?? new Date();
  return {
    start: resolveOne(input.start, now, "start"),
    end: resolveOne(input.end, now, "end")
  };
}

function resolveOne(s: string, now: Date, side: "start" | "end"): string {
  if (!isLiteralRange(s)) return s;
  const range = literalRange(s, now);
  return side === "start" ? range.start.toISOString() : range.end.toISOString();
}

function literalRange(lit: Literal, now: Date): { start: Date; end: Date } {
  const day = (d: Date) => {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    return { start, end };
  };
  if (lit === "today") return day(now);
  if (lit === "yesterday") {
    const y = new Date(now);
    y.setUTCDate(y.getUTCDate() - 1);
    return day(y);
  }
  if (lit === "this_week" || lit === "last_week") {
    const weekday = (now.getUTCDay() + 6) % 7; // Mon = 0
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - weekday);
    if (lit === "last_week") monday.setUTCDate(monday.getUTCDate() - 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return { start: day(monday).start, end: day(sunday).end };
  }
  // this_month
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: day(first).start, end: day(last).end };
}
```

> **Note:** v1 resolves literals in UTC. The user's Clockify timezone is a future-iteration improvement; the `tz` field is plumbed through so we can swap the implementation without changing callers.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/dates.test.ts`
Expected: 8/8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts tests/lib/dates.test.ts
git commit -m "feat(dates): literal date-range resolver (UTC)"
```

---

## Task 7: Clockify response types

**Files:**
- Create: `src/clockify/types.ts`

> Pure type/zod definitions, no behaviour to test in isolation. Schemas are exercised by endpoint and tool tests later.

- [ ] **Step 1: Implement `src/clockify/types.ts`**

```ts
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  defaultWorkspace: z.string().optional(),
  activeWorkspace: z.string().optional(),
  settings: z.object({ timeZone: z.string().optional() }).partial().optional()
});
export type User = z.infer<typeof UserSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string()
}).passthrough();
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  clientId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  color: z.string().optional(),
  billable: z.boolean().optional()
}).passthrough();
export type Project = z.infer<typeof ProjectSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  status: z.enum(["ACTIVE", "DONE"]).optional(),
  assigneeIds: z.array(z.string()).optional()
}).passthrough();
export type Task = z.infer<typeof TaskSchema>;

export const TimeIntervalSchema = z.object({
  start: z.string(),
  end: z.string().nullable().optional(),
  duration: z.string().nullable().optional()
}).passthrough();

export const TimeEntrySchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  timeInterval: TimeIntervalSchema.optional()
}).passthrough();
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean().optional()
}).passthrough();
export type Tag = z.infer<typeof TagSchema>;

export const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean().optional(),
  address: z.string().optional(),
  note: z.string().optional()
}).passthrough();
export type Client = z.infer<typeof ClientSchema>;
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/clockify/types.ts
git commit -m "feat(types): zod schemas for Clockify resources"
```

---

## Task 8: Endpoint — users

**Files:**
- Create: `src/clockify/endpoints/users.ts`
- Test: `tests/clockify/endpoints/users.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/clockify/endpoints/users.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { getCurrentUser } from "../../../src/clockify/endpoints/users.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("getCurrentUser", () => {
  it("GETs /user and parses the result", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", email: "a@b", defaultWorkspace: "w1" })
      )
    );
    const client = createClient(cfg);
    const user = await getCurrentUser(client);
    expect(user.id).toBe("u1");
    expect(user.defaultWorkspace).toBe("w1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/clockify/endpoints/users.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/clockify/endpoints/users.ts`**

```ts
import type { Client } from "../client.js";
import { UserSchema, type User } from "../types.js";

export async function getCurrentUser(client: Client): Promise<User> {
  const data = await client.request({ host: "api", method: "GET", path: "/user" });
  return UserSchema.parse(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/clockify/endpoints/users.test.ts`
Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/clockify/endpoints/users.ts tests/clockify/endpoints/users.test.ts
git commit -m "feat(endpoints): users.getCurrentUser"
```

---

## Task 9: User cache (`lib/userCache.ts`)

**Files:**
- Create: `src/lib/userCache.ts`
- Test: `tests/lib/userCache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/userCache.test.ts
import { describe, it, expect, vi } from "vitest";
import { createUserCache } from "../../src/lib/userCache.js";
import type { User } from "../../src/clockify/types.js";
import type { Client } from "../../src/clockify/client.js";

function fakeClient(user: User): { client: Client; calls: { n: number } } {
  const calls = { n: 0 };
  const client: Client = {
    async request() {
      calls.n += 1;
      return user as unknown;
    }
  };
  return { client, calls };
}

describe("createUserCache", () => {
  it("fetches the user once and caches subsequent calls", async () => {
    const { client, calls } = fakeClient({ id: "u1" });
    const cache = createUserCache(client);
    expect((await cache.get()).id).toBe("u1");
    expect((await cache.get()).id).toBe("u1");
    expect(calls.n).toBe(1);
  });

  it("dedupes concurrent first calls", async () => {
    const { client, calls } = fakeClient({ id: "u1" });
    const cache = createUserCache(client);
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(calls.n).toBe(1);
  });

  it("re-fetches if the first call rejected", async () => {
    let n = 0;
    const client: Client = {
      async request() {
        n += 1;
        if (n === 1) throw new Error("boom");
        return { id: "u1" } as unknown;
      }
    };
    const cache = createUserCache(client);
    await expect(cache.get()).rejects.toThrow("boom");
    expect((await cache.get()).id).toBe("u1");
    expect(n).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/userCache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/userCache.ts`**

```ts
import type { Client } from "../clockify/client.js";
import { getCurrentUser } from "../clockify/endpoints/users.js";
import type { User } from "../clockify/types.js";

export type UserCache = { get(): Promise<User> };

export function createUserCache(client: Client): UserCache {
  let pending: Promise<User> | null = null;
  let cached: User | null = null;
  return {
    async get(): Promise<User> {
      if (cached) return cached;
      if (pending) return pending;
      pending = getCurrentUser(client)
        .then((u) => {
          cached = u;
          return u;
        })
        .catch((e) => {
          pending = null;
          throw e;
        });
      return pending;
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/userCache.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/userCache.ts tests/lib/userCache.test.ts
git commit -m "feat(userCache): lazy current-user cache with single-flight"
```

---

## Task 10: Endpoint — workspaces

**Files:**
- Create: `src/clockify/endpoints/workspaces.ts`
- Test: `tests/clockify/endpoints/workspaces.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/clockify/endpoints/workspaces.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { listWorkspaces } from "../../../src/clockify/endpoints/workspaces.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("listWorkspaces", () => {
  it("GETs /workspaces and parses an array", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces", () =>
        HttpResponse.json([
          { id: "w1", name: "Acme" },
          { id: "w2", name: "Beta" }
        ])
      )
    );
    const client = createClient(cfg);
    const out = await listWorkspaces(client);
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe("w1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/clockify/endpoints/workspaces.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/clockify/endpoints/workspaces.ts`**

```ts
import type { Client } from "../client.js";
import { WorkspaceSchema, type Workspace } from "../types.js";
import { z } from "zod";

export async function listWorkspaces(client: Client): Promise<Workspace[]> {
  const data = await client.request({ host: "api", method: "GET", path: "/workspaces" });
  return z.array(WorkspaceSchema).parse(data);
}
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/clockify/endpoints/workspaces.test.ts`
Expected: 1/1 PASS.

```bash
git add src/clockify/endpoints/workspaces.ts tests/clockify/endpoints/workspaces.test.ts
git commit -m "feat(endpoints): workspaces.listWorkspaces"
```

---

## Task 11: Endpoint — projects

**Files:**
- Create: `src/clockify/endpoints/projects.ts`
- Test: `tests/clockify/endpoints/projects.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/clockify/endpoints/projects.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import {
  listProjects, getProject, createProject
} from "../../../src/clockify/endpoints/projects.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("projects", () => {
  it("listProjects sends filters as query params", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/projects", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "p1", name: "X" }]);
      })
    );
    const out = await listProjects(createClient(cfg), "w1", { name: "X", archived: false, page: 2 });
    expect(url).toContain("name=X");
    expect(url).toContain("archived=false");
    expect(url).toContain("page=2");
    expect(out[0]?.id).toBe("p1");
  });

  it("getProject GETs the project by id", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/projects/p1", () =>
        HttpResponse.json({ id: "p1", name: "X" })
      )
    );
    const out = await getProject(createClient(cfg), "w1", "p1");
    expect(out.id).toBe("p1");
  });

  it("createProject POSTs the body", async () => {
    let body: unknown = null;
    server.use(
      http.post("https://api.test/api/v1/workspaces/w1/projects", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "p2", name: "New" });
      })
    );
    const out = await createProject(createClient(cfg), "w1", {
      name: "New",
      clientId: "c1",
      billable: true
    });
    expect(out.id).toBe("p2");
    expect(body).toMatchObject({ name: "New", clientId: "c1", billable: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/clockify/endpoints/projects.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/clockify/endpoints/projects.ts`**

```ts
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
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/clockify/endpoints/projects.test.ts`
Expected: 3/3 PASS.

```bash
git add src/clockify/endpoints/projects.ts tests/clockify/endpoints/projects.test.ts
git commit -m "feat(endpoints): projects list/get/create"
```

---

## Task 12: Endpoint — tasks

**Files:**
- Create: `src/clockify/endpoints/tasks.ts`
- Test: `tests/clockify/endpoints/tasks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/clockify/endpoints/tasks.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { listTasks, createTask } from "../../../src/clockify/endpoints/tasks.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("tasks", () => {
  it("listTasks GETs the tasks endpoint with filters", async () => {
    let url: string | null = null;
    server.use(
      http.get(
        "https://api.test/api/v1/workspaces/w1/projects/p1/tasks",
        ({ request }) => {
          url = request.url;
          return HttpResponse.json([{ id: "t1", name: "x", projectId: "p1" }]);
        }
      )
    );
    await listTasks(createClient(cfg), "w1", "p1", { name: "x", status: "ACTIVE" });
    expect(url).toContain("name=x");
    expect(url).toContain("status=ACTIVE");
  });

  it("createTask POSTs the body", async () => {
    let body: unknown = null;
    server.use(
      http.post(
        "https://api.test/api/v1/workspaces/w1/projects/p1/tasks",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ id: "t1", name: "Build", projectId: "p1" });
        }
      )
    );
    const out = await createTask(createClient(cfg), "w1", "p1", {
      name: "Build",
      assigneeIds: ["u1"]
    });
    expect(out.id).toBe("t1");
    expect(body).toMatchObject({ name: "Build", assigneeIds: ["u1"] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/clockify/endpoints/tasks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/clockify/endpoints/tasks.ts`**

```ts
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
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/clockify/endpoints/tasks.test.ts`
Expected: 2/2 PASS.

```bash
git add src/clockify/endpoints/tasks.ts tests/clockify/endpoints/tasks.test.ts
git commit -m "feat(endpoints): tasks list/create"
```

---

## Task 13: Endpoint — time entries

**Files:**
- Create: `src/clockify/endpoints/timeEntries.ts`
- Test: `tests/clockify/endpoints/timeEntries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/clockify/endpoints/timeEntries.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import {
  listUserTimeEntries,
  getRunningTimeEntry,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  stopRunningTimer
} from "../../../src/clockify/endpoints/timeEntries.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};
const client = createClient(cfg);

describe("time entries", () => {
  it("listUserTimeEntries GETs user time entries with date filters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/user/u1/time-entries", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "e1" }]);
      })
    );
    await listUserTimeEntries(client, "w1", "u1", {
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-02T00:00:00Z",
      project: "p1",
      page: 1,
      pageSize: 50
    });
    expect(url).toContain("start=2026-05-01T00%3A00%3A00Z");
    expect(url).toContain("end=2026-05-02T00%3A00%3A00Z");
    expect(url).toContain("project=p1");
    expect(url).toContain("page=1");
    expect(url).toContain("page-size=50");
  });

  it("getRunningTimeEntry uses in-progress=true and returns the first entry or null", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/user/u1/time-entries", ({ request }) => {
        expect(new URL(request.url).searchParams.get("in-progress")).toBe("true");
        return HttpResponse.json([{ id: "e1" }]);
      })
    );
    const out = await getRunningTimeEntry(client, "w1", "u1");
    expect(out?.id).toBe("e1");
  });

  it("getRunningTimeEntry returns null when no entry", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/user/u1/time-entries", () =>
        HttpResponse.json([])
      )
    );
    const out = await getRunningTimeEntry(client, "w1", "u1");
    expect(out).toBeNull();
  });

  it("createTimeEntry POSTs the body and returns the parsed entry", async () => {
    let body: unknown = null;
    server.use(
      http.post("https://api.test/api/v1/workspaces/w1/time-entries", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "e2", description: "x" });
      })
    );
    const out = await createTimeEntry(client, "w1", {
      description: "x",
      start: "2026-05-07T10:00:00Z",
      end: "2026-05-07T11:00:00Z",
      projectId: "p1",
      tagIds: ["tg1"],
      billable: true
    });
    expect(out.id).toBe("e2");
    expect(body).toMatchObject({
      description: "x",
      start: "2026-05-07T10:00:00Z",
      end: "2026-05-07T11:00:00Z",
      projectId: "p1",
      tagIds: ["tg1"],
      billable: true
    });
  });

  it("updateTimeEntry PUTs the body", async () => {
    server.use(
      http.put("https://api.test/api/v1/workspaces/w1/time-entries/e1", async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ description: "y" });
        return HttpResponse.json({ id: "e1", description: "y" });
      })
    );
    const out = await updateTimeEntry(client, "w1", "e1", { description: "y" });
    expect(out.description).toBe("y");
  });

  it("deleteTimeEntry DELETEs and returns null", async () => {
    server.use(
      http.delete("https://api.test/api/v1/workspaces/w1/time-entries/e1", () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    await expect(deleteTimeEntry(client, "w1", "e1")).resolves.toBeNull();
  });

  it("stopRunningTimer PATCHes user time-entries with end=now", async () => {
    let body: { end?: string } | null = null;
    server.use(
      http.patch(
        "https://api.test/api/v1/workspaces/w1/user/u1/time-entries",
        async ({ request }) => {
          body = (await request.json()) as { end?: string };
          return HttpResponse.json({ id: "e1" });
        }
      )
    );
    const out = await stopRunningTimer(client, "w1", "u1", "2026-05-07T11:00:00Z");
    expect(out.id).toBe("e1");
    expect(body?.end).toBe("2026-05-07T11:00:00Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/clockify/endpoints/timeEntries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/clockify/endpoints/timeEntries.ts`**

```ts
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
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/clockify/endpoints/timeEntries.test.ts`
Expected: 7/7 PASS.

```bash
git add src/clockify/endpoints/timeEntries.ts tests/clockify/endpoints/timeEntries.test.ts
git commit -m "feat(endpoints): time entries list/get-running/create/update/delete/stop"
```

---

## Task 14: Endpoint — tags + clients

**Files:**
- Create: `src/clockify/endpoints/tags.ts`, `src/clockify/endpoints/clients.ts`
- Test: `tests/clockify/endpoints/tags.test.ts`, `tests/clockify/endpoints/clients.test.ts`

- [ ] **Step 1: Write failing tag tests**

```ts
// tests/clockify/endpoints/tags.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { listTags } from "../../../src/clockify/endpoints/tags.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("tags", () => {
  it("listTags GETs tags with filters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/tags", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "tg1", name: "client" }]);
      })
    );
    const out = await listTags(createClient(cfg), "w1", { name: "client", archived: false });
    expect(url).toContain("name=client");
    expect(url).toContain("archived=false");
    expect(out[0]?.id).toBe("tg1");
  });
});
```

- [ ] **Step 2: Write failing client tests**

```ts
// tests/clockify/endpoints/clients.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient as createHttp } from "../../../src/clockify/client.js";
import { listClients, createClockifyClient } from "../../../src/clockify/endpoints/clients.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("clients", () => {
  it("listClients GETs clients with filters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/clients", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "c1", name: "Acme" }]);
      })
    );
    const out = await listClients(createHttp(cfg), "w1", { name: "Acme" });
    expect(url).toContain("name=Acme");
    expect(out[0]?.id).toBe("c1");
  });

  it("createClockifyClient POSTs the body", async () => {
    let body: unknown = null;
    server.use(
      http.post("https://api.test/api/v1/workspaces/w1/clients", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "c2", name: "Beta" });
      })
    );
    const out = await createClockifyClient(createHttp(cfg), "w1", {
      name: "Beta",
      address: "1 St"
    });
    expect(out.id).toBe("c2");
    expect(body).toMatchObject({ name: "Beta", address: "1 St" });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test tests/clockify/endpoints/tags.test.ts tests/clockify/endpoints/clients.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/clockify/endpoints/tags.ts`**

```ts
import type { Client } from "../client.js";
import { TagSchema, type Tag } from "../types.js";
import { z } from "zod";

export type ListTagsArgs = { name?: string; archived?: boolean };

export async function listTags(
  client: Client,
  workspaceId: string,
  args: ListTagsArgs = {}
): Promise<Tag[]> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/tags`,
    query: { name: args.name, archived: args.archived }
  });
  return z.array(TagSchema).parse(data);
}
```

- [ ] **Step 5: Implement `src/clockify/endpoints/clients.ts`**

```ts
import type { Client } from "../client.js";
import { ClientSchema, type Client as ClockifyClient } from "../types.js";
import { z } from "zod";

export type ListClientsArgs = { name?: string; archived?: boolean };

export async function listClients(
  client: Client,
  workspaceId: string,
  args: ListClientsArgs = {}
): Promise<ClockifyClient[]> {
  const data = await client.request({
    host: "api",
    method: "GET",
    path: `/workspaces/${workspaceId}/clients`,
    query: { name: args.name, archived: args.archived }
  });
  return z.array(ClientSchema).parse(data);
}

export type CreateClientArgs = { name: string; address?: string; note?: string };

export async function createClockifyClient(
  client: Client,
  workspaceId: string,
  args: CreateClientArgs
): Promise<ClockifyClient> {
  const data = await client.request({
    host: "api",
    method: "POST",
    path: `/workspaces/${workspaceId}/clients`,
    body: args
  });
  return ClientSchema.parse(data);
}
```

- [ ] **Step 6: Run tests, then commit**

Run: `pnpm test tests/clockify/endpoints/tags.test.ts tests/clockify/endpoints/clients.test.ts`
Expected: 3/3 PASS.

```bash
git add src/clockify/endpoints/tags.ts src/clockify/endpoints/clients.ts \
        tests/clockify/endpoints/tags.test.ts tests/clockify/endpoints/clients.test.ts
git commit -m "feat(endpoints): tags list, clients list/create"
```

---

## Task 15: Endpoint — reports

**Files:**
- Create: `src/clockify/endpoints/reports.ts`
- Test: `tests/clockify/endpoints/reports.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/clockify/endpoints/reports.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import {
  reportSummary,
  reportDetailed,
  reportWeekly,
  listSharedReports
} from "../../../src/clockify/endpoints/reports.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};
const client = createClient(cfg);

describe("reports", () => {
  it("reportSummary POSTs to the reports host with grouping", async () => {
    let body: any = null;
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/summary", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ totals: [{ totalTime: 3600 }], groupOne: [] });
      })
    );
    const out = await reportSummary(client, "w1", {
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-07T23:59:59Z",
      groups: ["PROJECT", "USER"],
      users: ["u1"],
      projects: ["p1"]
    });
    expect(body.dateRangeStart).toBe("2026-05-01T00:00:00Z");
    expect(body.dateRangeEnd).toBe("2026-05-07T23:59:59Z");
    expect(body.summaryFilter.groups).toEqual(["PROJECT", "USER"]);
    expect(body.users.ids).toEqual(["u1"]);
    expect(body.projects.ids).toEqual(["p1"]);
    expect(body.exportType).toBe("JSON");
    expect((out as any).totals[0].totalTime).toBe(3600);
  });

  it("reportDetailed POSTs with detailedFilter pagination", async () => {
    let body: any = null;
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/detailed", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ timeentries: [], totals: [] });
      })
    );
    await reportDetailed(client, "w1", {
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-07T23:59:59Z",
      page: 2,
      pageSize: 100,
      sortColumn: "DATE"
    });
    expect(body.detailedFilter.page).toBe(2);
    expect(body.detailedFilter.pageSize).toBe(100);
    expect(body.detailedFilter.sortColumn).toBe("DATE");
  });

  it("reportWeekly POSTs with weekly grouping", async () => {
    let body: any = null;
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/weekly", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ totals: [], weekly: [] });
      })
    );
    await reportWeekly(client, "w1", {
      start: "2026-05-04T00:00:00Z",
      end: "2026-05-10T23:59:59Z",
      weeklyFilter: { group: "USER", subgroup: "TIME" }
    });
    expect(body.weeklyFilter).toEqual({ group: "USER", subgroup: "TIME" });
  });

  it("listSharedReports GETs the shared-reports endpoint", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://reports.test/v1/workspaces/w1/shared-reports", ({ request }) => {
        url = request.url;
        return HttpResponse.json([]);
      })
    );
    await listSharedReports(client, "w1", { page: 1, pageSize: 10 });
    expect(url).toContain("page=1");
    expect(url).toContain("page-size=10");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/clockify/endpoints/reports.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/clockify/endpoints/reports.ts`**

```ts
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
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/clockify/endpoints/reports.test.ts`
Expected: 4/4 PASS.

```bash
git add src/clockify/endpoints/reports.ts tests/clockify/endpoints/reports.test.ts
git commit -m "feat(endpoints): reports summary/detailed/weekly + shared list"
```

---

## Task 16: Tool registry shape + workspace tools

**Files:**
- Create: `src/tools/index.ts`, `src/tools/workspaces.ts`
- Test: `tests/tools/workspaces.test.ts`

> Tools are registered against an `McpServer`. We'll wrap the server interactions so each tool is a pure function we can call from tests without spinning up MCP.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/workspaces.test.ts
import { describe, it, expect } from "vitest";
import { workspacesTools } from "../../src/tools/workspaces.js";
import type { ToolContext } from "../../src/tools/index.js";
import type { Client } from "../../src/clockify/client.js";

function ctx(client: Client): ToolContext {
  return {
    client,
    config: {
      apiKey: "k",
      workspaceId: "wDefault",
      baseUrl: "https://api.test/api/v1",
      reportsBaseUrl: "https://reports.test/v1",
      port: 3000,
      logLevel: "info"
    },
    userCache: { async get() { return { id: "u1", defaultWorkspace: "wDefault" }; } }
  };
}

describe("workspacesTools", () => {
  it("get_current_user returns the cached user", async () => {
    const client: Client = { async request() { throw new Error("should not call"); } };
    const tools = workspacesTools(ctx(client));
    const out = await tools.get_current_user.handler({});
    expect(out).toEqual({ id: "u1", defaultWorkspace: "wDefault" });
  });

  it("list_workspaces calls the endpoint", async () => {
    let called = false;
    const client: Client = {
      async request(args) {
        called = true;
        expect(args.path).toBe("/workspaces");
        return [{ id: "w1", name: "Acme" }];
      }
    };
    const tools = workspacesTools(ctx(client));
    const out = (await tools.list_workspaces.handler({})) as Array<{ id: string }>;
    expect(called).toBe(true);
    expect(out[0]?.id).toBe("w1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/workspaces.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/tools/index.ts`**

```ts
import type { z } from "zod";
import type { Client } from "../clockify/client.js";
import type { Config } from "../config.js";
import type { UserCache } from "../lib/userCache.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ToolContext = {
  client: Client;
  config: Config;
  userCache: UserCache;
};

export type ToolDef<I extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: I;
  handler(input: z.infer<I>): Promise<unknown>;
};

export type ToolMap = Record<string, ToolDef>;

export function registerToolMaps(server: McpServer, maps: ToolMap[]): void {
  for (const map of maps) {
    for (const tool of Object.values(map)) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputSchema as z.ZodTypeAny as never },
        async (input: unknown) => {
          const value = await tool.handler(input as never);
          return {
            content: [{ type: "text", text: JSON.stringify(value, null, 2) }]
          };
        }
      );
    }
  }
}
```

- [ ] **Step 4: Implement `src/tools/workspaces.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import { listWorkspaces } from "../clockify/endpoints/workspaces.js";

export function workspacesTools(ctx: ToolContext): ToolMap {
  return {
    get_current_user: {
      name: "get_current_user",
      description: "Return the Clockify user authenticated by CLOCKIFY_API_KEY.",
      inputSchema: z.object({}),
      async handler() {
        return ctx.userCache.get();
      }
    },
    list_workspaces: {
      name: "list_workspaces",
      description: "List all workspaces the authenticated user belongs to.",
      inputSchema: z.object({}),
      async handler() {
        return listWorkspaces(ctx.client);
      }
    }
  };
}
```

- [ ] **Step 5: Run test, then commit**

Run: `pnpm test tests/tools/workspaces.test.ts`
Expected: 2/2 PASS.

```bash
git add src/tools/index.ts src/tools/workspaces.ts tests/tools/workspaces.test.ts
git commit -m "feat(tools): tool registry + workspace/current-user tools"
```

---

## Task 17: Timer tools

**Files:**
- Create: `src/tools/timer.ts`
- Test: `tests/tools/timer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/timer.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { timerTools } from "../../src/tools/timer.js";

const cfg = {
  apiKey: "k",
  workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1",
  port: 3000,
  logLevel: "info" as const
};

function setup() {
  const client = createClient(cfg);
  const userCache = createUserCache(client);
  return timerTools({ client, config: cfg, userCache });
}

describe("timerTools", () => {
  it("start_timer falls back to default workspace and current user", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.post("https://api.test/api/v1/workspaces/wDefault/time-entries", async ({ request }) => {
        const body = (await request.json()) as { description: string; start: string; end?: string };
        expect(body.description).toBe("hack");
        expect(body.end).toBeUndefined();
        expect(typeof body.start).toBe("string");
        return HttpResponse.json({ id: "e1", description: "hack" });
      })
    );
    const out = (await setup().start_timer.handler({ description: "hack" })) as { id: string };
    expect(out.id).toBe("e1");
  });

  it("start_timer honours workspaceId override", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wOther/time-entries", () =>
        HttpResponse.json({ id: "e2" })
      )
    );
    const out = (await setup().start_timer.handler({
      description: "x",
      workspaceId: "wOther"
    })) as { id: string };
    expect(out.id).toBe("e2");
  });

  it("get_running_timer returns null when no entry", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.get("https://api.test/api/v1/workspaces/wDefault/user/u1/time-entries", () =>
        HttpResponse.json([])
      )
    );
    const out = await setup().get_running_timer.handler({});
    expect(out).toBeNull();
  });

  it("stop_timer PATCHes user time-entries with end=now", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.patch(
        "https://api.test/api/v1/workspaces/wDefault/user/u1/time-entries",
        async ({ request }) => {
          const body = (await request.json()) as { end: string };
          expect(typeof body.end).toBe("string");
          return HttpResponse.json({ id: "e1" });
        }
      )
    );
    const out = (await setup().stop_timer.handler({})) as { id: string };
    expect(out.id).toBe("e1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/timer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/timer.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import {
  createTimeEntry,
  getRunningTimeEntry,
  stopRunningTimer
} from "../clockify/endpoints/timeEntries.js";

const StartTimerInput = z.object({
  description: z.string().min(1),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const StopTimerInput = z.object({
  userId: z.string().optional(),
  workspaceId: z.string().optional()
});

const GetRunningInput = StopTimerInput;

export function timerTools(ctx: ToolContext): ToolMap {
  return {
    start_timer: {
      name: "start_timer",
      description:
        "Start a timer. Creates a time entry with no end. Falls back to CLOCKIFY_WORKSPACE_ID and the current user.",
      inputSchema: StartTimerInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return createTimeEntry(ctx.client, ws, {
          description: input.description,
          start: new Date().toISOString(),
          projectId: input.projectId,
          taskId: input.taskId,
          tagIds: input.tags,
          billable: input.billable
        });
      }
    },
    stop_timer: {
      name: "stop_timer",
      description: "Stop the currently running timer for the given (or current) user.",
      inputSchema: StopTimerInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const userId = input.userId ?? (await ctx.userCache.get()).id;
        return stopRunningTimer(ctx.client, ws, userId, new Date().toISOString());
      }
    },
    get_running_timer: {
      name: "get_running_timer",
      description: "Return the currently running time entry for the given (or current) user, or null.",
      inputSchema: GetRunningInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const userId = input.userId ?? (await ctx.userCache.get()).id;
        return getRunningTimeEntry(ctx.client, ws, userId);
      }
    }
  };
}
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/tools/timer.test.ts`
Expected: 4/4 PASS.

```bash
git add src/tools/timer.ts tests/tools/timer.test.ts
git commit -m "feat(tools): timer start/stop/get-running with smart defaults"
```

---

## Task 18: Time-entry tools

**Files:**
- Create: `src/tools/timeEntries.ts`
- Test: `tests/tools/timeEntries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/timeEntries.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { timeEntryTools } from "../../src/tools/timeEntries.js";

const cfg = {
  apiKey: "k",
  workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1",
  port: 3000,
  logLevel: "info" as const
};

function setup() {
  const client = createClient(cfg);
  return timeEntryTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("timeEntryTools", () => {
  it("list_time_entries resolves 'today' literal and uses current user", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.get(
        "https://api.test/api/v1/workspaces/wDefault/user/u1/time-entries",
        ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("start")).toMatch(/T00:00:00\.000Z$/);
          expect(u.searchParams.get("end")).toMatch(/T23:59:59\.999Z$/);
          return HttpResponse.json([{ id: "e1" }]);
        }
      )
    );
    const out = (await setup().list_time_entries.handler({ start: "today", end: "today" })) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("e1");
  });

  it("create_time_entry passes through fields", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wDefault/time-entries", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.description).toBe("x");
        expect(body.tagIds).toEqual(["tg1"]);
        return HttpResponse.json({ id: "e1" });
      })
    );
    await setup().create_time_entry.handler({
      description: "x",
      start: "2026-05-07T10:00:00Z",
      end: "2026-05-07T11:00:00Z",
      tags: ["tg1"]
    });
  });

  it("delete_time_entry returns null", async () => {
    server.use(
      http.delete("https://api.test/api/v1/workspaces/wDefault/time-entries/e1", () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    const out = await setup().delete_time_entry.handler({ id: "e1" });
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/timeEntries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/timeEntries.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import {
  listUserTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry
} from "../clockify/endpoints/timeEntries.js";
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
        return listUserTimeEntries(ctx.client, ws, userId, {
          start: range.start,
          end: range.end,
          project: input.projectId,
          page: input.page,
          pageSize: input.pageSize
        });
      }
    },
    create_time_entry: {
      name: "create_time_entry",
      description: "Create a manual (closed) time entry.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return createTimeEntry(ctx.client, ws, {
          description: input.description,
          start: input.start,
          end: input.end,
          projectId: input.projectId,
          taskId: input.taskId,
          tagIds: input.tags,
          billable: input.billable
        });
      }
    },
    update_time_entry: {
      name: "update_time_entry",
      description: "Update fields on an existing time entry.",
      inputSchema: UpdateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        const { id, workspaceId: _ws, tags, ...rest } = input;
        return updateTimeEntry(ctx.client, ws, id, { ...rest, tagIds: tags });
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
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/tools/timeEntries.test.ts`
Expected: 3/3 PASS.

```bash
git add src/tools/timeEntries.ts tests/tools/timeEntries.test.ts
git commit -m "feat(tools): time entry list/create/update/delete with date literals"
```

---

## Task 19: Project + task tools

**Files:**
- Create: `src/tools/projects.ts`, `src/tools/tasks.ts`
- Test: `tests/tools/projects.test.ts`, `tests/tools/tasks.test.ts`

- [ ] **Step 1: Write failing project tests**

```ts
// tests/tools/projects.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { projectTools } from "../../src/tools/projects.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};
function setup() {
  const client = createClient(cfg);
  return projectTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("projectTools", () => {
  it("list_projects falls back to default workspace", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/projects", () =>
        HttpResponse.json([{ id: "p1", name: "X" }])
      )
    );
    const out = (await setup().list_projects.handler({})) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("p1");
  });

  it("get_project requires id", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/projects/p9", () =>
        HttpResponse.json({ id: "p9", name: "Y" })
      )
    );
    const out = (await setup().get_project.handler({ id: "p9" })) as { id: string };
    expect(out.id).toBe("p9");
  });

  it("create_project POSTs the body", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wDefault/projects", async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ name: "Z" });
        return HttpResponse.json({ id: "p2", name: "Z" });
      })
    );
    const out = (await setup().create_project.handler({ name: "Z" })) as { id: string };
    expect(out.id).toBe("p2");
  });
});
```

- [ ] **Step 2: Write failing task tests**

```ts
// tests/tools/tasks.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { taskTools } from "../../src/tools/tasks.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};
function setup() {
  const client = createClient(cfg);
  return taskTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("taskTools", () => {
  it("list_tasks GETs project tasks", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/projects/p1/tasks", () =>
        HttpResponse.json([{ id: "t1", name: "x", projectId: "p1" }])
      )
    );
    const out = (await setup().list_tasks.handler({ projectId: "p1" })) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("t1");
  });

  it("create_task POSTs the body", async () => {
    server.use(
      http.post(
        "https://api.test/api/v1/workspaces/wDefault/projects/p1/tasks",
        async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({ name: "Build" });
          return HttpResponse.json({ id: "t2", name: "Build", projectId: "p1" });
        }
      )
    );
    const out = (await setup().create_task.handler({ projectId: "p1", name: "Build" })) as {
      id: string;
    };
    expect(out.id).toBe("t2");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test tests/tools/projects.test.ts tests/tools/tasks.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/tools/projects.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import {
  listProjects, getProject, createProject
} from "../clockify/endpoints/projects.js";

const ListInput = z.object({
  name: z.string().optional(),
  archived: z.boolean().optional(),
  clientId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional(),
  workspaceId: z.string().optional()
});

const GetInput = z.object({
  id: z.string(),
  workspaceId: z.string().optional()
});

const CreateInput = z.object({
  name: z.string().min(1),
  clientId: z.string().optional(),
  color: z.string().optional(),
  billable: z.boolean().optional(),
  workspaceId: z.string().optional()
});

export function projectTools(ctx: ToolContext): ToolMap {
  return {
    list_projects: {
      name: "list_projects",
      description: "List projects in a workspace. Filters by name, archived flag, and clientId.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return listProjects(ctx.client, ws, {
          name: input.name,
          archived: input.archived,
          clientId: input.clientId,
          page: input.page,
          pageSize: input.pageSize
        });
      }
    },
    get_project: {
      name: "get_project",
      description: "Fetch a project by id.",
      inputSchema: GetInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return getProject(ctx.client, ws, input.id);
      }
    },
    create_project: {
      name: "create_project",
      description: "Create a project.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return createProject(ctx.client, ws, {
          name: input.name,
          clientId: input.clientId,
          color: input.color,
          billable: input.billable
        });
      }
    }
  };
}
```

- [ ] **Step 5: Implement `src/tools/tasks.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import { listTasks, createTask } from "../clockify/endpoints/tasks.js";

const ListInput = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  status: z.enum(["ACTIVE", "DONE"]).optional(),
  workspaceId: z.string().optional()
});

const CreateInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  assigneeIds: z.array(z.string()).optional(),
  workspaceId: z.string().optional()
});

export function taskTools(ctx: ToolContext): ToolMap {
  return {
    list_tasks: {
      name: "list_tasks",
      description: "List tasks within a project.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return listTasks(ctx.client, ws, input.projectId, {
          name: input.name,
          status: input.status
        });
      }
    },
    create_task: {
      name: "create_task",
      description: "Create a task within a project.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return createTask(ctx.client, ws, input.projectId, {
          name: input.name,
          assigneeIds: input.assigneeIds
        });
      }
    }
  };
}
```

- [ ] **Step 6: Run tests, then commit**

Run: `pnpm test tests/tools/projects.test.ts tests/tools/tasks.test.ts`
Expected: 5/5 PASS.

```bash
git add src/tools/projects.ts src/tools/tasks.ts \
        tests/tools/projects.test.ts tests/tools/tasks.test.ts
git commit -m "feat(tools): project list/get/create + task list/create"
```

---

## Task 20: Tag + client tools

**Files:**
- Create: `src/tools/tags.ts`, `src/tools/clients.ts`
- Test: `tests/tools/tags.test.ts`, `tests/tools/clients.test.ts`

- [ ] **Step 1: Write failing tag tests**

```ts
// tests/tools/tags.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { tagTools } from "../../src/tools/tags.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};

describe("tagTools", () => {
  it("list_tags falls back to default workspace", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/tags", () =>
        HttpResponse.json([{ id: "tg1", name: "client" }])
      )
    );
    const client = createClient(cfg);
    const tools = tagTools({ client, config: cfg, userCache: createUserCache(client) });
    const out = (await tools.list_tags.handler({})) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("tg1");
  });
});
```

- [ ] **Step 2: Write failing client tests**

```ts
// tests/tools/clients.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { clientTools } from "../../src/tools/clients.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};

describe("clientTools", () => {
  it("list_clients GETs default workspace clients", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/clients", () =>
        HttpResponse.json([{ id: "c1", name: "Acme" }])
      )
    );
    const client = createClient(cfg);
    const tools = clientTools({ client, config: cfg, userCache: createUserCache(client) });
    const out = (await tools.list_clients.handler({})) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("c1");
  });

  it("create_client POSTs the body", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wDefault/clients", async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ name: "Beta" });
        return HttpResponse.json({ id: "c2", name: "Beta" });
      })
    );
    const client = createClient(cfg);
    const tools = clientTools({ client, config: cfg, userCache: createUserCache(client) });
    const out = (await tools.create_client.handler({ name: "Beta" })) as { id: string };
    expect(out.id).toBe("c2");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test tests/tools/tags.test.ts tests/tools/clients.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/tools/tags.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import { listTags } from "../clockify/endpoints/tags.js";

const ListInput = z.object({
  name: z.string().optional(),
  archived: z.boolean().optional(),
  workspaceId: z.string().optional()
});

export function tagTools(ctx: ToolContext): ToolMap {
  return {
    list_tags: {
      name: "list_tags",
      description: "List tags in a workspace.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return listTags(ctx.client, ws, { name: input.name, archived: input.archived });
      }
    }
  };
}
```

- [ ] **Step 5: Implement `src/tools/clients.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import { listClients, createClockifyClient } from "../clockify/endpoints/clients.js";

const ListInput = z.object({
  name: z.string().optional(),
  archived: z.boolean().optional(),
  workspaceId: z.string().optional()
});

const CreateInput = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  note: z.string().optional(),
  workspaceId: z.string().optional()
});

export function clientTools(ctx: ToolContext): ToolMap {
  return {
    list_clients: {
      name: "list_clients",
      description: "List clients in a workspace.",
      inputSchema: ListInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return listClients(ctx.client, ws, { name: input.name, archived: input.archived });
      }
    },
    create_client: {
      name: "create_client",
      description: "Create a new client.",
      inputSchema: CreateInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return createClockifyClient(ctx.client, ws, {
          name: input.name,
          address: input.address,
          note: input.note
        });
      }
    }
  };
}
```

- [ ] **Step 6: Run tests, then commit**

Run: `pnpm test tests/tools/tags.test.ts tests/tools/clients.test.ts`
Expected: 3/3 PASS.

```bash
git add src/tools/tags.ts src/tools/clients.ts \
        tests/tools/tags.test.ts tests/tools/clients.test.ts
git commit -m "feat(tools): tag list + client list/create"
```

---

## Task 21: Report tools

**Files:**
- Create: `src/tools/reports.ts`
- Test: `tests/tools/reports.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/reports.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { reportTools } from "../../src/tools/reports.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};
function setup() {
  const client = createClient(cfg);
  return reportTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("reportTools", () => {
  it("report_summary resolves date literals and posts to reports host", async () => {
    let body: any = null;
    server.use(
      http.post(
        "https://reports.test/v1/workspaces/wDefault/reports/summary",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ totals: [], groupOne: [] });
        }
      )
    );
    await setup().report_summary.handler({
      start: "this_week",
      end: "today",
      groups: ["PROJECT"]
    });
    expect(body.dateRangeStart).toMatch(/T00:00:00\.000Z$/);
    expect(body.dateRangeEnd).toMatch(/T23:59:59\.999Z$/);
    expect(body.summaryFilter.groups).toEqual(["PROJECT"]);
  });

  it("report_detailed defaults pagination", async () => {
    let body: any = null;
    server.use(
      http.post(
        "https://reports.test/v1/workspaces/wDefault/reports/detailed",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({});
        }
      )
    );
    await setup().report_detailed.handler({
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-07T23:59:59Z"
    });
    expect(body.detailedFilter.page).toBe(1);
    expect(body.detailedFilter.pageSize).toBe(50);
  });

  it("report_weekly defaults the weekly grouping", async () => {
    let body: any = null;
    server.use(
      http.post(
        "https://reports.test/v1/workspaces/wDefault/reports/weekly",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({});
        }
      )
    );
    await setup().report_weekly.handler({
      start: "this_week",
      end: "this_week"
    });
    expect(body.weeklyFilter).toEqual({ group: "USER", subgroup: "TIME" });
  });

  it("list_shared_reports passes pagination", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://reports.test/v1/workspaces/wDefault/shared-reports", ({ request }) => {
        url = request.url;
        return HttpResponse.json([]);
      })
    );
    await setup().list_shared_reports.handler({ page: 2, pageSize: 25 });
    expect(url).toContain("page=2");
    expect(url).toContain("page-size=25");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/reports.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/reports.ts`**

```ts
import { z } from "zod";
import type { ToolContext, ToolMap } from "./index.js";
import {
  reportSummary,
  reportDetailed,
  reportWeekly,
  listSharedReports
} from "../clockify/endpoints/reports.js";
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
        return reportSummary(ctx.client, ws, {
          start: range.start,
          end: range.end,
          groups: input.groups,
          users: input.users,
          projects: input.projects,
          clients: input.clients,
          tags: input.tags,
          billable: input.billable
        });
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
        return reportDetailed(ctx.client, ws, {
          start: range.start,
          end: range.end,
          page: input.page,
          pageSize: input.pageSize,
          sortColumn: input.sortColumn,
          users: input.users,
          projects: input.projects,
          tags: input.tags,
          billable: input.billable
        });
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
        return reportWeekly(ctx.client, ws, {
          start: range.start,
          end: range.end,
          weeklyFilter: input.weeklyFilter,
          users: input.users,
          projects: input.projects
        });
      }
    },
    list_shared_reports: {
      name: "list_shared_reports",
      description: "List shared reports.",
      inputSchema: SharedInput,
      async handler(input) {
        const ws = input.workspaceId ?? ctx.config.workspaceId;
        return listSharedReports(ctx.client, ws, {
          page: input.page,
          pageSize: input.pageSize
        });
      }
    }
  };
}
```

- [ ] **Step 4: Run test, then commit**

Run: `pnpm test tests/tools/reports.test.ts`
Expected: 4/4 PASS.

```bash
git add src/tools/reports.ts tests/tools/reports.test.ts
git commit -m "feat(tools): summary/detailed/weekly reports + shared list"
```

---

## Task 22: MCP server + HTTP transport

**Files:**
- Create: `src/server.ts`, `src/index.ts`

> Wire up the MCP server, register all tools, expose streamable HTTP on `/mcp`, expose `/health`. Integration smoke test in next task.

- [ ] **Step 1: Implement `src/server.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "node:http";

import { loadConfig } from "./config.js";
import { createClient } from "./clockify/client.js";
import { createUserCache } from "./lib/userCache.js";
import { registerToolMaps, type ToolContext } from "./tools/index.js";
import { workspacesTools } from "./tools/workspaces.js";
import { timerTools } from "./tools/timer.js";
import { timeEntryTools } from "./tools/timeEntries.js";
import { projectTools } from "./tools/projects.js";
import { taskTools } from "./tools/tasks.js";
import { tagTools } from "./tools/tags.js";
import { clientTools } from "./tools/clients.js";
import { reportTools } from "./tools/reports.js";

export type StartedServer = {
  http: http.Server;
  port: number;
  close(): Promise<void>;
};

export async function startServer(): Promise<StartedServer> {
  const config = loadConfig();
  const client = createClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    reportsBaseUrl: config.reportsBaseUrl
  });
  const userCache = createUserCache(client);
  const ctx: ToolContext = { client, config, userCache };

  const mcp = new McpServer({ name: "clockify-mcp", version: "0.1.0" });
  registerToolMaps(mcp, [
    workspacesTools(ctx),
    timerTools(ctx),
    timeEntryTools(ctx),
    projectTools(ctx),
    taskTools(ctx),
    tagTools(ctx),
    clientTools(ctx),
    reportTools(ctx)
  ]);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined // stateless
  });
  await mcp.connect(transport);

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url?.startsWith("/mcp")) {
      transport.handleRequest(req, res).catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(config.port, resolve));

  return {
    http: server,
    port: config.port,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
      await transport.close();
      await mcp.close();
    }
  };
}
```

- [ ] **Step 2: Implement `src/index.ts`**

```ts
import { startServer } from "./server.js";

startServer()
  .then(({ port }) => {
    console.log(JSON.stringify({ level: "info", msg: "clockify-mcp listening", port }));
  })
  .catch((err) => {
    console.error(JSON.stringify({ level: "error", msg: String(err?.message ?? err) }));
    process.exit(1);
  });
```

- [ ] **Step 3: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: exit 0; `dist/` populated.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "feat(server): MCP HTTP transport, health probe, tool registration"
```

---

## Task 23: Integration smoke test

**Files:**
- Create: `tests/integration/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/smoke.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { startServer, type StartedServer } from "../../src/server.js";

let app: StartedServer;

beforeAll(async () => {
  process.env.CLOCKIFY_API_KEY = "k";
  process.env.CLOCKIFY_WORKSPACE_ID = "wDefault";
  process.env.CLOCKIFY_BASE_URL = "https://api.test/api/v1";
  process.env.CLOCKIFY_REPORTS_BASE_URL = "https://reports.test/v1";
  process.env.PORT = "0"; // ephemeral
  app = await startServer();
});

afterAll(async () => { await app.close(); });

async function rpc(body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`http://127.0.0.1:${app.port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json() };
}

describe("smoke", () => {
  it("GET /health returns 200", async () => {
    const res = await fetch(`http://127.0.0.1:${app.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("tools/list returns 21 tools", async () => {
    const { status, json } = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    });
    expect(status).toBe(200);
    expect(json.result.tools).toHaveLength(21);
  });

  it("tools/call list_workspaces calls the upstream API", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces", () =>
        HttpResponse.json([{ id: "w1", name: "Acme" }])
      )
    );
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_workspaces", arguments: {} }
    });
    const text = json.result.content[0].text as string;
    expect(text).toContain("Acme");
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test tests/integration/smoke.test.ts`
Expected: 3/3 PASS. The test boots the real server with mocked upstreams and exercises the MCP HTTP transport end-to-end.

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`
Expected: ALL pass.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/smoke.test.ts
git commit -m "test(integration): smoke test for HTTP transport + tools/list + tools/call"
```

---

## Task 24: Docker

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  clockify-mcp:
    build: .
    image: clockify-mcp:latest
    container_name: clockify-mcp
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      CLOCKIFY_API_KEY: ${CLOCKIFY_API_KEY}
      CLOCKIFY_WORKSPACE_ID: ${CLOCKIFY_WORKSPACE_ID}
      CLOCKIFY_BASE_URL: ${CLOCKIFY_BASE_URL:-}
      CLOCKIFY_REPORTS_BASE_URL: ${CLOCKIFY_REPORTS_BASE_URL:-}
      PORT: "3000"
      LOG_LEVEL: ${LOG_LEVEL:-info}
    restart: unless-stopped
```

- [ ] **Step 3: Build the image**

Run: `docker build -t clockify-mcp:dev .`
Expected: image built, no errors.

- [ ] **Step 4: Smoke-run the container**

Run:
```bash
docker run --rm -d --name clockify-mcp-smoke \
  -e CLOCKIFY_API_KEY=fake -e CLOCKIFY_WORKSPACE_ID=fake \
  -p 127.0.0.1:3001:3000 clockify-mcp:dev
sleep 2
curl -s http://127.0.0.1:3001/health
docker stop clockify-mcp-smoke
```
Expected: `{"ok":true}`.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat(docker): multi-stage image + compose with healthcheck"
```

---

## Task 25: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# clockify-mcp

MCP server for the Clockify time-tracking API. Runs as a Docker container, speaks streamable HTTP, exposes 21 tools covering time tracking, projects, tasks, tags, clients, and reports.

## Quick start

```bash
cp .env.example .env
# fill in CLOCKIFY_API_KEY and CLOCKIFY_WORKSPACE_ID
docker compose up -d
curl http://127.0.0.1:3000/health
```

## Configuration

| Var | Required | Default |
|---|---|---|
| `CLOCKIFY_API_KEY` | yes | — |
| `CLOCKIFY_WORKSPACE_ID` | yes | — |
| `CLOCKIFY_BASE_URL` | no | `https://api.clockify.me/api/v1` |
| `CLOCKIFY_REPORTS_BASE_URL` | no | `https://reports.api.clockify.me/v1` |
| `PORT` | no | `3000` |
| `LOG_LEVEL` | no | `info` |

Use the regional base URLs for EU (`euc1`), USA (`use2`), UK (`euw2`), or AU (`apse2`) deployments.

## Connecting from Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clockify": {
      "transport": { "type": "http", "url": "http://127.0.0.1:3000/mcp" }
    }
  }
}
```

## Tools

Time tracking: `start_timer`, `stop_timer`, `get_running_timer`, `list_time_entries`, `create_time_entry`, `update_time_entry`, `delete_time_entry`.

Workspace / user: `get_current_user`, `list_workspaces`.

Projects / tasks: `list_projects`, `get_project`, `create_project`, `list_tasks`, `create_task`.

Tags / clients: `list_tags`, `list_clients`, `create_client`.

Reports: `report_summary`, `report_detailed`, `report_weekly`, `list_shared_reports`.

Date arguments accept ISO strings or the literals `today`, `yesterday`, `this_week`, `last_week`, `this_month` (resolved in UTC).

## Development

```bash
pnpm install
pnpm test
pnpm dev
```

## Security

The server binds inside the container only; the compose file maps it to `127.0.0.1` on the host. Do not expose port 3000 publicly without adding authentication in front of it.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quickstart, config table, tool list"
```

---

## Task 26: Final verification

- [ ] **Step 1: Full test run**

Run: `pnpm test`
Expected: every suite passes.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: exit 0; `dist/index.js` exists.

- [ ] **Step 4: Compose up against fake creds**

Run:
```bash
CLOCKIFY_API_KEY=fake CLOCKIFY_WORKSPACE_ID=fake docker compose up -d
sleep 3
curl -s http://127.0.0.1:3000/health
docker compose down
```
Expected: `{"ok":true}`.

- [ ] **Step 5: Tag the release**

```bash
git tag v0.1.0
```

---

## Self-Review Notes

- **Spec coverage:** §7 of the spec lists 21 tools; the plan registers 21 (Tasks 16, 17, 18, 19, 20, 21). Reports API: Task 15 (endpoint) + Task 21 (tools). Docker: Task 24. Health probe: Task 22. Integration test: Task 23.
- **Type consistency:** `Client` interface is defined in Task 4 and used unchanged across all endpoint and tool tasks. `ToolContext` defined in Task 16 and reused. `resolveDateRange` defined in Task 6 and reused in Tasks 18, 21.
- **Naming gotcha:** `tests/clockify/endpoints/clients.test.ts` and `src/clockify/endpoints/clients.ts` define `createClockifyClient` (not `createClient`) to avoid colliding with the HTTP `createClient` exported from `src/clockify/client.ts`. Tool layer in Task 20 follows the same naming.
- **No placeholders detected.**

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-clockify-mcp.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task with two-stage review between tasks. Best for keeping context lean across 26 tasks.
2. **Inline Execution** — execute tasks in this session via executing-plans, batched with checkpoints.

Which approach?
